-- Private intern cohort cycles (draft -> lock -> publish).
--
-- Lets admins prepare the accepted intern cohort before anyone is public.
-- Access boundary: admin only. Nothing here is readable by anon or by
-- non-admin authenticated clients.
--
-- Publishing writes the cohort into public.cabinet_members with
-- category = 'Interns' for the cycle's cabinet year, because that is the one
-- source the public Internship and Cabinet pages already read. These tables
-- never become a second public source of truth, and the live-only
-- public.intern_cohort_members / published_intern_cohort_members objects
-- (absent from this repo's migrations; see docs/anon-key-exposure-audit-2026-08-19.md)
-- are deliberately left untouched.
--
-- Additive only. No attendance, points, House membership, leaderboard, photo
-- approval, or RLS behavior changes.

-- ─── Cycles ──────────────────────────────────────────────────────────────────

create table if not exists public.intern_cohort_cycles (
  id uuid primary key default gen_random_uuid(),
  academic_year_start integer not null,
  academic_year_end integer not null,
  cabinet_year_id uuid not null references public.cabinet_years(id) on delete restrict,
  status text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  locked_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intern_cohort_cycles_status_check
    check (status in ('draft', 'locked', 'published', 'archived')),
  constraint intern_cohort_cycles_year_span_check
    check (academic_year_end = academic_year_start + 1)
);

-- One live cycle per cabinet year; an archived cycle frees the year.
create unique index if not exists intern_cohort_cycles_one_live_per_year_idx
  on public.intern_cohort_cycles (cabinet_year_id)
  where status <> 'archived';

-- ─── Draft interns ───────────────────────────────────────────────────────────

create table if not exists public.intern_cohort_drafts (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.intern_cohort_cycles(id) on delete cascade,
  name text not null,
  member_id uuid references public.members(id) on delete set null,
  mentor_cabinet_member_id uuid references public.cabinet_members(id) on delete set null,
  role_or_track text,
  caption text,
  internal_notes text,
  display_order integer not null default 0,
  published_cabinet_member_id uuid references public.cabinet_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intern_cohort_drafts_name_check check (length(btrim(name)) > 0)
);

create index if not exists intern_cohort_drafts_cycle_order_idx
  on public.intern_cohort_drafts (cycle_id, display_order);

create index if not exists intern_cohort_drafts_member_idx
  on public.intern_cohort_drafts (member_id)
  where member_id is not null;

-- ─── Guards ──────────────────────────────────────────────────────────────────

drop trigger if exists update_intern_cohort_cycles_updated_at on public.intern_cohort_cycles;
create trigger update_intern_cohort_cycles_updated_at
  before update on public.intern_cohort_cycles
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists update_intern_cohort_drafts_updated_at on public.intern_cohort_drafts;
create trigger update_intern_cohort_drafts_updated_at
  before update on public.intern_cohort_drafts
  for each row
  execute function public.update_updated_at_column();

create or replace function public.guard_intern_cohort_cycle_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' and (
    new.academic_year_start <> old.academic_year_start
    or new.academic_year_end <> old.academic_year_end
    or new.cabinet_year_id <> old.cabinet_year_id
  ) then
    raise exception 'Intern cohort year and cabinet year are fixed once it is locked.';
  end if;

  if new.status <> old.status then
    if not (
      (old.status = 'draft' and new.status in ('locked', 'archived'))
      or (old.status = 'locked' and new.status in ('draft', 'published', 'archived'))
      or (old.status = 'published' and new.status = 'archived')
    ) then
      raise exception 'Intern cohort cannot move from % to %.', old.status, new.status;
    end if;

    if new.status = 'locked' then
      new.locked_at := now();
    elsif new.status = 'draft' then
      new.locked_at := null;
    elsif new.status = 'published' then
      new.published_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_intern_cohort_cycle_update on public.intern_cohort_cycles;
create trigger guard_intern_cohort_cycle_update
  before update on public.intern_cohort_cycles
  for each row
  execute function public.guard_intern_cohort_cycle_update();

create or replace function public.guard_intern_cohort_cycle_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    raise exception 'Only draft intern cohorts can be deleted (status: %).', old.status;
  end if;
  return old;
end;
$$;

drop trigger if exists guard_intern_cohort_cycle_delete on public.intern_cohort_cycles;
create trigger guard_intern_cohort_cycle_delete
  before delete on public.intern_cohort_cycles
  for each row
  execute function public.guard_intern_cohort_cycle_delete();

-- Draft rows change only while the cycle is a draft. The single exception is
-- publishing: while a cycle is 'locked', the publish step may record the
-- resulting cabinet_members id on a row, and nothing else on it may change.
-- A missing parent means the row is being removed by the cycle's own cascade.
create or replace function public.guard_intern_cohort_draft_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_id uuid;
  parent_status text;
begin
  if tg_op = 'INSERT' then
    parent_id := new.cycle_id;
  else
    parent_id := old.cycle_id;
  end if;

  if tg_op = 'UPDATE' and new.cycle_id <> old.cycle_id then
    raise exception 'Intern cohort draft rows cannot move between cycles.';
  end if;

  select status into parent_status
  from public.intern_cohort_cycles
  where id = parent_id;

  if parent_status is not null and parent_status <> 'draft' then
    if tg_op = 'UPDATE'
      and parent_status = 'locked'
      and (to_jsonb(new) - 'published_cabinet_member_id' - 'updated_at')
        = (to_jsonb(old) - 'published_cabinet_member_id' - 'updated_at')
    then
      return new;
    end if;
    raise exception 'Intern cohort is % and cannot be edited. Reopen it first.', parent_status;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_intern_cohort_draft_mutation on public.intern_cohort_drafts;
create trigger guard_intern_cohort_draft_mutation
  before insert or update or delete on public.intern_cohort_drafts
  for each row
  execute function public.guard_intern_cohort_draft_mutation();

-- ─── RLS: admin only ─────────────────────────────────────────────────────────

alter table public.intern_cohort_cycles enable row level security;
alter table public.intern_cohort_drafts enable row level security;

revoke all on public.intern_cohort_cycles from anon, authenticated;
revoke all on public.intern_cohort_drafts from anon, authenticated;
grant select, insert, update, delete on public.intern_cohort_cycles to authenticated;
grant select, insert, update, delete on public.intern_cohort_drafts to authenticated;

drop policy if exists "Admins can view intern cohort cycles" on public.intern_cohort_cycles;
create policy "Admins can view intern cohort cycles"
  on public.intern_cohort_cycles for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can insert intern cohort cycles" on public.intern_cohort_cycles;
create policy "Admins can insert intern cohort cycles"
  on public.intern_cohort_cycles for insert
  to authenticated
  with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can update intern cohort cycles" on public.intern_cohort_cycles;
create policy "Admins can update intern cohort cycles"
  on public.intern_cohort_cycles for update
  to authenticated
  using (public.is_admin_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can delete intern cohort cycles" on public.intern_cohort_cycles;
create policy "Admins can delete intern cohort cycles"
  on public.intern_cohort_cycles for delete
  to authenticated
  using (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can view intern cohort drafts" on public.intern_cohort_drafts;
create policy "Admins can view intern cohort drafts"
  on public.intern_cohort_drafts for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can insert intern cohort drafts" on public.intern_cohort_drafts;
create policy "Admins can insert intern cohort drafts"
  on public.intern_cohort_drafts for insert
  to authenticated
  with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can update intern cohort drafts" on public.intern_cohort_drafts;
create policy "Admins can update intern cohort drafts"
  on public.intern_cohort_drafts for update
  to authenticated
  using (public.is_admin_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can delete intern cohort drafts" on public.intern_cohort_drafts;
create policy "Admins can delete intern cohort drafts"
  on public.intern_cohort_drafts for delete
  to authenticated
  using (public.is_admin_user(auth.uid()));

comment on table public.intern_cohort_cycles is
  'Admin-only intern cohort cycle. Publishing writes cabinet_members rows with category Interns for cabinet_year_id; it is not a public source.';
comment on table public.intern_cohort_drafts is
  'Admin-only draft interns. internal_notes and mentor_cabinet_member_id never leave this table; published_cabinet_member_id links the public row.';
