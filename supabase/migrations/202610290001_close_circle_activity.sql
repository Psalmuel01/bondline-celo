-- Circle activity is derived from finalized chain_events by get_circle_snapshot.
-- Browser-authored rows were spoofable by anyone holding the public anon key,
-- so the table is closed to direct PostgREST access.

drop policy if exists "public Circle activity write" on public.circle_activity;
drop policy if exists "public Circle activity read" on public.circle_activity;

comment on table public.circle_activity is
  'Deprecated. Legacy browser-authored rows are untrusted; timelines use chain_events.';
