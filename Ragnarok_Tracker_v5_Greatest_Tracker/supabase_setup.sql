-- Ragnarok Tracker v5.2 cloud-sync tables and security controls.
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

-- v5.2: database-backed API rate limiting. Only the service role may access this table.
create table if not exists public.sync_rate_limits (
  scope text not null check (char_length(scope) between 1 and 64),
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count >= 1),
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash, window_start)
);

alter table public.sync_rate_limits enable row level security;
revoke all on table public.sync_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.sync_rate_limits to service_role;

create index if not exists sync_rate_limits_updated_at_idx
  on public.sync_rate_limits (updated_at desc);

create or replace function public.check_sync_rate_limit(
  p_scope text,
  p_key_hash text,
  p_window_seconds integer,
  p_limit integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_scope is null
     or char_length(p_scope) < 1
     or char_length(p_scope) > 64
     or p_key_hash !~ '^[a-f0-9]{64}$'
     or p_window_seconds < 1
     or p_window_seconds > 86400
     or p_limit < 1
     or p_limit > 10000 then
    raise exception 'invalid rate limit arguments' using errcode = '22023';
  end if;

  v_window_start :=
    to_timestamp(
      floor(extract(epoch from clock_timestamp()) / p_window_seconds)
      * p_window_seconds
    );

  insert into public.sync_rate_limits (
    scope, key_hash, window_start, request_count, updated_at
  )
  values (
    p_scope, p_key_hash, v_window_start, 1, now()
  )
  on conflict (scope, key_hash, window_start)
  do update set
    request_count = public.sync_rate_limits.request_count + 1,
    updated_at = now()
  returning request_count into v_count;

  -- Opportunistic cleanup keeps old counters from growing forever.
  if random() < 0.01 then
    delete from public.sync_rate_limits
    where window_start < now() - interval '2 days';
  end if;

  return query
  select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    v_window_start + make_interval(secs => p_window_seconds);
end;
$$;

-- SECURITY DEFINER functions are not public APIs. Only the Vercel service role may invoke this RPC.
revoke all on function public.check_sync_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_sync_rate_limit(text, text, integer, integer)
  to service_role;
