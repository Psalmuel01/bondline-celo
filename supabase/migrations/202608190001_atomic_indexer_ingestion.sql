-- Replays one contiguous finalized event batch into canonical projections and
-- advances the cursor in the same transaction. Safe to retry and safe against
-- concurrent workers.

create or replace function public.apply_chain_event_batch(
  p_chain_id bigint,
  p_deployment_block bigint,
  p_from_block bigint,
  p_last_finalized_block bigint,
  p_last_finalized_hash text,
  p_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sync public.chain_sync_state%rowtype;
  v_event record;
  v_payload jsonb;
  v_status integer;
begin
  if p_last_finalized_block < p_from_block then
    raise exception 'Indexer block range is invalid';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_events, '[]'::jsonb)) as e(
      chain_id bigint, block_number bigint
    )
    where e.chain_id <> p_chain_id
      or e.block_number < p_from_block
      or e.block_number > p_last_finalized_block
  ) then
    raise exception 'Indexer event is outside its declared chain or block range';
  end if;

  perform pg_advisory_xact_lock(p_chain_id);
  select * into v_sync
  from public.chain_sync_state
  where chain_id = p_chain_id
  for update;

  if found then
    if v_sync.deployment_block <> p_deployment_block then
      raise exception 'Deployment block does not match the existing cursor';
    end if;
    if p_last_finalized_block <= v_sync.last_finalized_block then
      return jsonb_build_object('applied', false, 'lastFinalizedBlock', v_sync.last_finalized_block);
    end if;
    if p_from_block <> v_sync.last_finalized_block + 1 then
      raise exception 'Indexer batch is not contiguous with the existing cursor';
    end if;
  elsif p_from_block <> p_deployment_block then
    raise exception 'First indexer batch must begin at the deployment block';
  end if;

  for v_event in
    select *
    from jsonb_to_recordset(coalesce(p_events, '[]'::jsonb)) as x(
      chain_id bigint, tx_hash text, log_index integer, block_number bigint,
      block_hash text, contract_address text, event_name text, circle_address text,
      actor_address text, bond_id numeric, payout_id numeric, payload jsonb,
      block_timestamp timestamptz
    )
    order by block_number, log_index
  loop
    v_payload := coalesce(v_event.payload, '{}'::jsonb);

    insert into public.chain_events (
      chain_id, tx_hash, log_index, block_number, block_hash, contract_address,
      event_name, circle_address, actor_address, bond_id, payout_id, payload, block_timestamp
    ) values (
      v_event.chain_id, lower(v_event.tx_hash), v_event.log_index, v_event.block_number,
      lower(v_event.block_hash), lower(v_event.contract_address), v_event.event_name,
      lower(v_event.circle_address), lower(v_event.actor_address), v_event.bond_id,
      v_event.payout_id, v_payload, v_event.block_timestamp
    )
    on conflict (chain_id, tx_hash, log_index) do nothing;

    case v_event.event_name
      when 'CircleCreated' then
        insert into public.indexed_circles (
          chain_id, circle_address, creator_address, name, members, cosign_threshold_bps,
          balance, created_block, updated_block, updated_at
        ) values (
          p_chain_id, lower(v_payload->>'circle'), lower(v_payload->>'creator'), v_payload->>'name',
          array(select lower(value) from jsonb_array_elements_text(v_payload->'members')),
          (v_payload->>'cosignThresholdBps')::integer, 0, v_event.block_number,
          v_event.block_number, now()
        )
        on conflict (chain_id, circle_address) do update set
          creator_address = excluded.creator_address,
          name = excluded.name,
          members = excluded.members,
          cosign_threshold_bps = excluded.cosign_threshold_bps,
          updated_block = greatest(public.indexed_circles.updated_block, excluded.updated_block),
          updated_at = now();

      when 'BondOpened' then
        insert into public.indexed_bonds (
          chain_id, bond_id, creator_address, circle_address, stake, deadline, cosign_closes_at,
          status, cosigns, objections, description, receipts_hash, receipts_uri,
          opened_block, updated_block, updated_at
        ) values (
          p_chain_id, (v_payload->>'id')::numeric, lower(v_payload->>'creator'), lower(v_payload->>'circle'),
          (v_payload->>'stake')::numeric, to_timestamp((v_payload->>'deadline')::numeric), null,
          0, 0, 0, v_payload->>'description', null, null,
          v_event.block_number, v_event.block_number, now()
        )
        on conflict (chain_id, bond_id) do nothing;

      when 'BondDeclared' then
        update public.indexed_bonds set
          status = 1,
          cosign_closes_at = to_timestamp((v_payload->>'cosignClosesAt')::numeric),
          receipts_hash = v_payload->>'receiptsHash',
          receipts_uri = v_payload->>'receiptsUri',
          updated_block = v_event.block_number,
          updated_at = now()
        where chain_id = p_chain_id and bond_id = (v_payload->>'id')::numeric;

      when 'Cosigned' then
        update public.indexed_bonds set
          cosigns = (v_payload->>'cosigns')::integer,
          updated_block = v_event.block_number,
          updated_at = now()
        where chain_id = p_chain_id and bond_id = (v_payload->>'id')::numeric;

      when 'Objected' then
        update public.indexed_bonds set
          objections = (v_payload->>'objections')::integer,
          updated_block = v_event.block_number,
          updated_at = now()
        where chain_id = p_chain_id and bond_id = (v_payload->>'id')::numeric;

      when 'BondResolved' then
        v_status := (v_payload->>'status')::integer;
        update public.indexed_bonds set
          status = v_status,
          updated_block = v_event.block_number,
          updated_at = now()
        where chain_id = p_chain_id and bond_id = (v_payload->>'id')::numeric;
        if v_status = 3 then
          update public.indexed_circles set
            balance = balance + (v_payload->>'stake')::numeric,
            updated_block = v_event.block_number,
            updated_at = now()
          where chain_id = p_chain_id and circle_address = lower(v_event.circle_address);
        end if;

      when 'PayoutProposed' then
        insert into public.indexed_payouts (
          chain_id, payout_id, circle_address, recipient_address, amount, executed, cosigns,
          memo, proposed_block, updated_block, updated_at
        ) values (
          p_chain_id, (v_payload->>'payoutId')::numeric, lower(v_payload->>'circle'),
          lower(v_payload->>'to'), (v_payload->>'amount')::numeric, false, 0,
          v_payload->>'memo', v_event.block_number, v_event.block_number, now()
        )
        on conflict (chain_id, payout_id) do nothing;

      when 'PayoutCosigned' then
        update public.indexed_payouts set
          cosigns = (v_payload->>'cosigns')::integer,
          updated_block = v_event.block_number,
          updated_at = now()
        where chain_id = p_chain_id and payout_id = (v_payload->>'payoutId')::numeric;

      when 'PayoutExecuted' then
        update public.indexed_payouts set
          executed = true,
          updated_block = v_event.block_number,
          updated_at = now()
        where chain_id = p_chain_id and payout_id = (v_payload->>'payoutId')::numeric;
        update public.indexed_circles set
          balance = balance - (v_payload->>'amount')::numeric,
          updated_block = v_event.block_number,
          updated_at = now()
        where chain_id = p_chain_id and circle_address = lower(v_payload->>'circle');
      else
        raise exception 'Unsupported Bondline event: %', v_event.event_name;
    end case;
  end loop;

  insert into public.chain_sync_state (
    chain_id, deployment_block, last_finalized_block, last_finalized_hash, updated_at
  ) values (
    p_chain_id, p_deployment_block, p_last_finalized_block, lower(p_last_finalized_hash), now()
  )
  on conflict (chain_id) do update set
    last_finalized_block = excluded.last_finalized_block,
    last_finalized_hash = excluded.last_finalized_hash,
    updated_at = now();

  return jsonb_build_object(
    'applied', true,
    'lastFinalizedBlock', p_last_finalized_block,
    'eventCount', jsonb_array_length(coalesce(p_events, '[]'::jsonb)),
    'circleCount', (select count(*) from public.indexed_circles where chain_id = p_chain_id),
    'bondCount', (select count(*) from public.indexed_bonds where chain_id = p_chain_id),
    'payoutCount', (select count(*) from public.indexed_payouts where chain_id = p_chain_id)
  );
end;
$$;

revoke all on function public.apply_chain_event_batch(bigint, bigint, bigint, bigint, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_chain_event_batch(bigint, bigint, bigint, bigint, text, jsonb)
  to service_role;

-- Indexed snapshots use canonical chain activity rather than browser-authored rows.
create or replace function public.get_circle_snapshot(p_chain_id bigint, p_circle_address text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when c.circle_address is null then null else jsonb_build_object(
    'circle', to_jsonb(c),
    'metadata', (select to_jsonb(m) from public.circle_metadata m where m.chain_id = p_chain_id and m.circle_address = c.circle_address),
    'profiles', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.address)
      from public.profiles p where p.address = any(c.members)
    ), '[]'::jsonb),
    'bonds', coalesce((
      select jsonb_agg(to_jsonb(b) order by b.status, b.deadline, b.bond_id desc)
      from public.indexed_bonds b where b.chain_id = p_chain_id and b.circle_address = c.circle_address
    ), '[]'::jsonb),
    'payouts', coalesce((
      select jsonb_agg(to_jsonb(py) order by py.executed, py.payout_id desc)
      from public.indexed_payouts py where py.chain_id = p_chain_id and py.circle_address = c.circle_address
    ), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.block_number desc, e.log_index desc)
      from (
        select * from public.chain_events
        where chain_id = p_chain_id and circle_address = c.circle_address
        order by block_number desc, log_index desc limit 50
      ) e
    ), '[]'::jsonb),
    'indexedThroughBlock', (
      select last_finalized_block from public.chain_sync_state where chain_id = p_chain_id
    )
  ) end
  from public.indexed_circles c
  where c.chain_id = p_chain_id and c.circle_address = lower(p_circle_address)
  limit 1;
$$;

revoke all on function public.get_circle_snapshot(bigint, text) from public, anon, authenticated;
grant execute on function public.get_circle_snapshot(bigint, text) to service_role;
