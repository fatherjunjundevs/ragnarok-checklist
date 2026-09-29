create table if not exists public.tracker_feedback (
  id uuid primary key default gen_random_uuid(),
  feedback_type text not null check (feedback_type in ('bug','suggestion','general')),
  area text not null check (area in ('dailies','weeklies','journal','characters','layout','mobile','cloud','other')),
  message text not null check (char_length(message) between 3 and 3000),
  steps text not null default '' check (char_length(steps) <= 2000),
  expected text not null default '' check (char_length(expected) <= 1500),
  contact text not null default '' check (char_length(contact) <= 160),
  diagnostics jsonb not null default '{}'::jsonb check (jsonb_typeof(diagnostics) = 'object'),
  status text not null default 'new' check (status in ('new','reviewing','planned','fixed','closed')),
  created_at timestamptz not null default now()
);

create index if not exists tracker_feedback_status_created_idx on public.tracker_feedback (status, created_at desc);

alter table public.tracker_feedback enable row level security;
revoke all on table public.tracker_feedback from anon, authenticated;
grant all on table public.tracker_feedback to service_role;

comment on table public.tracker_feedback is 'Private tracker feedback submitted through the server-only feedback endpoint. No public RLS policies.';
