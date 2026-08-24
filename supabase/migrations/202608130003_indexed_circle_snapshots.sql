-- Canonical, idempotent projections populated by the Bondline event indexer.
-- This migration does not alter the current frontend read path. Switch reads
-- only after backfill and reconciliation have completed successfully.

create table if not exists public.chain_events (
  chain_id bigint not null,
  tx_hash text not null check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  log_index integer not null,
  block_number bigint not null,
  block_hash text not null check (block_hash ~ '^0x[0-9a-f]{64}$'),
  contract_address text not null check (contract_address ~ '^0x[0-9a-f]{40}$'),
  event_name text not null,
  circle_address text check (circle_address is null or circle_address ~ '^0x[0-9a-f]{40}$'),
  actor_address text check (actor_address is null or actor_address ~ '^0x[0-9a-f]{40}$'),
  bond_id numeric,
  payout_id numeric,
  payload jsonb not null default '{}'::jsonb,
  block_timestamp timestamptz not null,
  primary key (chain_id, tx_hash, log_index)
);
create index if not exists chain_events_circle_block on public.chain_events (chain_id, circle_address, block_number desc, log_index desc);

create table if not exists public.chain_sync_state (
  chain_id bigint primary key,
  deployment_block bigint not null,
  last_finalized_block bigint not null,
  last_finalized_hash text,
  updated_at timestamptz not null default now()
);

create table if not exists public.indexed_circles (
  chain_id bigint not null,
  circle_address text not null check (circle_address ~ '^0x[0-9a-f]{40}$'),
  creator_address text not null check (creator_address ~ '^0x[0-9a-f]{40}$'),
  name text not null,
  members text[] not null,
  cosign_threshold_bps integer not null check (cosign_threshold_bps between 1 and 10000),
  balance numeric not null default 0,
  created_block bigint not null,
  updated_block bigint not null,
  updated_at timestamptz not null default now(),
  primary key (chain_id, circle_address)
);

create table if not exists public.indexed_bonds (
  chain_id bigint not null,
  bond_id numeric not null,
  creator_address text not null check (creator_address ~ '^0x[0-9a-f]{40}$'),
  circle_address text not null check (circle_address ~ '^0x[0-9a-f]{40}$'),
  stake numeric not null,
  deadline timestamptz not null,
  cosign_closes_at timestamptz,
  status integer not null check (status between 0 and 3),
  cosigns integer not null default 0,
  objections integer not null default 0,
  description text not null,
  receipts_hash text,
  receipts_uri text,
  opened_block bigint not null,
  updated_block bigint not null,
  updated_at timestamptz not null default now(),
  primary key (chain_id, bond_id)
);
create index if not exists indexed_bonds_circle_status_deadline on public.indexed_bonds (chain_id, circle_address, status, deadline);

create table if not exists public.indexed_payouts (
  chain_id bigint not null,
  payout_id numeric not null,
  circle_address text not null check (circle_address ~ '^0x[0-9a-f]{40}$'),
  recipient_address text not null check (recipient_address ~ '^0x[0-9a-f]{40}$'),
  amount numeric not null,
  executed boolean not null default false,
  cosigns integer not null default 0,
  memo text not null,
  proposed_block bigint not null,
  updated_block bigint not null,
  updated_at timestamptz not null default now(),
  primary key (chain_id, payout_id)
);
create index if not exists indexed_payouts_circle_executed on public.indexed_payouts (chain_id, circle_address, executed, payout_id desc);

alter table public.chain_events enable row level security;
alter table public.chain_sync_state enable row level security;
alter table public.indexed_circles enable row level security;
alter table public.indexed_bonds enable row level security;
alter table public.indexed_payouts enable row level security;

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
      from public.profiles p
      where p.address = any(c.members)
    ), '[]'::jsonb),
    'bonds', coalesce((
      select jsonb_agg(to_jsonb(b) order by b.status, b.deadline, b.bond_id desc)
      from public.indexed_bonds b
      where b.chain_id = p_chain_id and b.circle_address = c.circle_address
    ), '[]'::jsonb),
    'payouts', coalesce((
      select jsonb_agg(to_jsonb(py) order by py.executed, py.payout_id desc)
      from public.indexed_payouts py
      where py.chain_id = p_chain_id and py.circle_address = c.circle_address
    ), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at desc)
      from (select * from public.circle_activity where chain_id = p_chain_id and circle_address = c.circle_address order by created_at desc limit 50) a
    ), '[]'::jsonb),
    'indexedThroughBlock', (select last_finalized_block from public.chain_sync_state where chain_id = p_chain_id)
  ) end
  from public.indexed_circles c
  where c.chain_id = p_chain_id and c.circle_address = lower(p_circle_address)
  limit 1;
$$;

revoke all on function public.get_circle_snapshot(bigint, text) from public, anon, authenticated;
grant execute on function public.get_circle_snapshot(bigint, text) to service_role;
