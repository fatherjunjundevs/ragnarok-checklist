-- Ragnarok Tracker v5 cloud-sync table.
-- Run once in the Supabase SQL editor for the project connected to this Vercel site.

create table if not exists public.tracker_states (
  room_id text primary key,
  secret_hash text not null,
  payload jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.tracker_states enable row level security;

-- Deliberately create NO public RLS policies.
-- The browser never talks to this table directly. Only the Vercel server function uses
-- the SUPABASE_SERVICE_ROLE_KEY, and pairing secrets are SHA-256 hashed before storage.

create index if not exists tracker_states_updated_at_idx
  on public.tracker_states (updated_at desc);
