-- Feedback Admin Dashboard workflow fields
-- Already applied to the connected production Supabase project.
alter table public.tracker_feedback
  add column if not exists admin_notes text not null default '',
  add column if not exists reviewed_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tracker_feedback_admin_notes_length'
      and conrelid = 'public.tracker_feedback'::regclass
  ) then
    alter table public.tracker_feedback
      add constraint tracker_feedback_admin_notes_length
      check (char_length(admin_notes) <= 5000);
  end if;
end $$;

create index if not exists tracker_feedback_created_idx on public.tracker_feedback (created_at desc);

create or replace function public.set_tracker_feedback_admin_timestamps()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status <> 'new' and new.reviewed_at is null then new.reviewed_at := now(); end if;
    if new.status in ('fixed','closed') then
      if old.status not in ('fixed','closed') or new.resolved_at is null then new.resolved_at := now(); end if;
    elsif old.status in ('fixed','closed') then
      new.resolved_at := null;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tracker_feedback_admin_timestamps on public.tracker_feedback;
create trigger tracker_feedback_admin_timestamps
before update on public.tracker_feedback
for each row execute function public.set_tracker_feedback_admin_timestamps();

alter table public.tracker_feedback enable row level security;
revoke all on table public.tracker_feedback from anon, authenticated;
grant all on table public.tracker_feedback to service_role;
