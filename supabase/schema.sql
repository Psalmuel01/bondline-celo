-- Bondline social layer (testnet prototype). Run in the Supabase SQL editor.
-- The client uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
create table if not exists public.profiles (
  address text primary key check (address ~ '^0x[0-9a-f]{40}$'),
  display_name text not null check (char_length(display_name) between 1 and 32),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  avatar_color text not null default '#514332' check (avatar_color ~ '^#[0-9a-fA-F]{6}$'),
  updated_at timestamptz not null default now()
);
-- Safe when upgrading from the earlier name-only profile schema.
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists avatar_color text not null default '#514332';

create table if not exists public.circle_metadata (
  chain_id bigint not null,
  circle_address text not null check (circle_address ~ '^0x[0-9a-f]{40}$'),
  mission text check (mission is null or char_length(mission) <= 120),
  pot_goal numeric check (pot_goal is null or pot_goal > 0),
  banner_url text check (banner_url is null or char_length(banner_url) <= 2048),
  updated_at timestamptz not null default now(),
  primary key (chain_id, circle_address)
);

create table if not exists public.circle_activity (
  id uuid primary key default gen_random_uuid(),
  chain_id bigint not null,
  circle_address text not null check (circle_address ~ '^0x[0-9a-f]{40}$'),
  actor_address text check (actor_address is null or actor_address ~ '^0x[0-9a-f]{40}$'),
  kind text not null check (kind in ('bond_opened', 'bond_declared', 'bond_met', 'bond_crossed', 'cosigned', 'payout_proposed', 'payout_paid')),
  body text not null check (char_length(body) between 1 and 280),
  tx_hash text check (tx_hash is null or tx_hash ~ '^0x[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index if not exists circle_activity_circle_created_at on public.circle_activity (chain_id, circle_address, created_at desc);

create table if not exists public.circle_messages (
  id uuid primary key default gen_random_uuid(),
  chain_id bigint not null,
  circle_address text not null check (circle_address ~ '^0x[0-9a-f]{40}$'),
  sender_address text not null check (sender_address ~ '^0x[0-9a-f]{40}$'),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists circle_messages_circle_created_at on public.circle_messages (chain_id, circle_address, created_at desc);

-- Public display media for profile avatars and Circle banners. The app stores
-- the resulting public URL in profiles.avatar_url / circle_metadata.banner_url.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('circle-media', 'circle-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

alter table public.profiles enable row level security;
alter table public.circle_messages enable row level security;
alter table public.circle_metadata enable row level security;
alter table public.circle_activity enable row level security;

-- Public identity metadata remains readable. Private Circle chat has no anon or
-- authenticated PostgREST policy: it is accessed only through Bondline's
-- wallet-authenticated server route, whose service role verifies membership.
drop policy if exists "public profile read" on public.profiles;
drop policy if exists "public profile upsert" on public.profiles;
drop policy if exists "public profile update" on public.profiles;
drop policy if exists "public Circle chat read" on public.circle_messages;
drop policy if exists "public Circle chat send" on public.circle_messages;
drop policy if exists "public Circle metadata read" on public.circle_metadata;
drop policy if exists "public Circle metadata write" on public.circle_metadata;
drop policy if exists "public Circle metadata update" on public.circle_metadata;
drop policy if exists "public Circle activity read" on public.circle_activity;
drop policy if exists "public Circle activity write" on public.circle_activity;
create policy "public profile read" on public.profiles for select using (true);
create policy "public Circle metadata read" on public.circle_metadata for select using (true);

drop policy if exists "public Circle media read" on storage.objects;
drop policy if exists "public Circle media upload" on storage.objects;
drop policy if exists "public Circle media delete" on storage.objects;
create policy "public Circle media read" on storage.objects for select using (bucket_id = 'circle-media');

alter table public.circle_messages replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'circle_messages'
  ) then
    alter publication supabase_realtime add table public.circle_messages;
  end if;
end $$;
