-- Private Cabinet roster cycles (draft -> lock -> publish) for yearly rollover.
--
-- Lets admins prepare next year's Cabinet before anyone is public: copy the
-- position structure from a previous year (role / category / display_order
-- only, never people), paste the new roster, link members, resolve warnings,
-- lock, then publish.
--
-- Access boundary: admin only. Nothing here is readable by anon or by
-- non-admin authenticated clients, so a draft roster can never leak early.
--
-- Publishing writes the roster into public.cabinet_members for the cycle's
-- cabinet year (the one source the public Cabinet page already reads) and
-- records each resulting id on the draft so a repeat publish updates in place
-- instead of duplicating. Publishing never activates the cabinet year; that is
-- its own explicit action (cabinet_years.is_active). These tables never become
-- a second public source of truth.
--
-- Additive only. No attendance, points, House membership, leaderboard, photo
-- approval, or RLS behavior on any existing table changes.

-- ─── Cycles ──────────────────────────────────────────────────────────────────

create table if not exists public.cabinet_roster_cycles (
  id uuid primary key default gen_random_uuid(),
  cabinet_year_id uuid not null references public.cabinet_years(id) on delete restrict,
  -- The year whose position structure seeded this draft. Informational only.
  source_cabinet_year_id uuid references public.cabinet_years(id) on delete set null,
  status text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  locked_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cabinet_roster_cycles_status_check
    check (status in ('draft', 'locked', 'published', 'archived'))
);

-- One live roster cycle per cabinet year; an archived cycle frees the year.
create unique index if not exists cabinet_roster_cycles_one_live_per_year_idx
  on public.cabinet_roster_cycles (cabinet_year_id)
  where status <> 'archived';

-- ─── Draft positions ─────────────────────────────────────────────────────────

create table if not exists public.cabinet_roster_drafts (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cabinet_roster_cycles(id) on delete cascade,
  role text not null,
  category text not null,
  display_order integer not null default 0,
  name text,
  member_id uuid references public.members(id) on delete set null,
  year text,
  college text,
  major text,
  pronouns text,
  favorite_snack text,
  fun_fact text,
  published_cabinet_member_id uuid references public.cabinet_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cabinet_roster_drafts_role_check check (length(btrim(role)) > 0),
  constraint cabinet_roster_drafts_category_check
    check (category in ('Executive Board', 'General Board'))
);

create index if not exists cabinet_roster_drafts_cycle_order_idx
  on public.cabinet_roster_drafts (cycle_id, display_order);

create index if not exists cabinet_roster_drafts_member_idx
  on public.cabinet_roster_drafts (member_id)
  where member_id is not null;

-- ─── Guards ──────────────────────────────────────────────────────────────────

drop trigger if exists update_cabinet_roster_cycles_updated_at on public.cabinet_roster_cycles;
create trigger update_cabinet_roster_cycles_updated_at
  before update on public.cabinet_roster_cycles
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists update_cabinet_roster_drafts_updated_at on public.cabinet_roster_drafts;
create trigger update_cabinet_roster_drafts_updated_at
  before update on public.cabinet_roster_drafts
  for each row
  execute function public.update_updated_at_column();

-- Status only moves forward (a locked cycle can be reopened). A cycle that has
-- left 'draft' keeps its cabinet year.
create or replace function public.guard_cabinet_roster_cycle_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' and new.cabinet_year_id <> old.cabinet_year_id then
    raise exception 'Cabinet roster year is fixed once it is locked.';
  end if;

  if new.status <> old.status then
    if not (
      (old.status = 'draft' and new.status in ('locked', 'archived'))
      or (old.status = 'locked' and new.status in ('draft', 'published', 'archived'))
      or (old.status = 'published' and new.status = 'archived')
    ) then
      raise exception 'Cabinet roster cannot move from % to %.', old.status, new.status;
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

drop trigger if exists guard_cabinet_roster_cycle_update on public.cabinet_roster_cycles;
create trigger guard_cabinet_roster_cycle_update
  before update on public.cabinet_roster_cycles
  for each row
  execute function public.guard_cabinet_roster_cycle_update();

-- Only a draft cycle can be deleted; locked and published cycles are the audit
-- trail for what was announced.
create or replace function public.guard_cabinet_roster_cycle_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    raise exception 'Only draft Cabinet rosters can be deleted (status: %).', old.status;
  end if;
  return old;
end;
$$;

drop trigger if exists guard_cabinet_roster_cycle_delete on public.cabinet_roster_cycles;
create trigger guard_cabinet_roster_cycle_delete
  before delete on public.cabinet_roster_cycles
  for each row
  execute function public.guard_cabinet_roster_cycle_delete();

-- Draft rows change only while the cycle is a draft. The single exception is
-- publishing: while a cycle is 'locked', the publish step may record the
-- resulting cabinet_members id on a row, and nothing else on it may change.
-- A missing parent means the row is being removed by the cycle's own cascade.
create or replace function public.guard_cabinet_roster_draft_mutation()
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
    raise exception 'Cabinet roster rows cannot move between cycles.';
  end if;

  select status into parent_status
  from public.cabinet_roster_cycles
  where id = parent_id;

  if parent_status is not null and parent_status <> 'draft' then
    if tg_op = 'UPDATE'
      and parent_status = 'locked'
      and (to_jsonb(new) - 'published_cabinet_member_id' - 'updated_at')
        = (to_jsonb(old) - 'published_cabinet_member_id' - 'updated_at')
    then
      return new;
    end if;
    raise exception 'Cabinet roster is % and cannot be edited. Reopen it first.', parent_status;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_cabinet_roster_draft_mutation on public.cabinet_roster_drafts;
create trigger guard_cabinet_roster_draft_mutation
  before insert or update or delete on public.cabinet_roster_drafts
  for each row
  execute function public.guard_cabinet_roster_draft_mutation();

-- Trigger functions never need client EXECUTE (the convention set by
-- 20260928005621): they would otherwise be callable as RPCs by any signed-in user.
revoke execute on function public.guard_cabinet_roster_cycle_update() from public, anon, authenticated;
revoke execute on function public.guard_cabinet_roster_cycle_delete() from public, anon, authenticated;
revoke execute on function public.guard_cabinet_roster_draft_mutation() from public, anon, authenticated;

-- ─── RLS: admin only ─────────────────────────────────────────────────────────

alter table public.cabinet_roster_cycles enable row level security;
alter table public.cabinet_roster_drafts enable row level security;

revoke all on public.cabinet_roster_cycles from anon, authenticated;
revoke all on public.cabinet_roster_drafts from anon, authenticated;
grant select, insert, update, delete on public.cabinet_roster_cycles to authenticated;
grant select, insert, update, delete on public.cabinet_roster_drafts to authenticated;

drop policy if exists "Admins can view cabinet roster cycles" on public.cabinet_roster_cycles;
create policy "Admins can view cabinet roster cycles"
  on public.cabinet_roster_cycles for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can insert cabinet roster cycles" on public.cabinet_roster_cycles;
create policy "Admins can insert cabinet roster cycles"
  on public.cabinet_roster_cycles for insert
  to authenticated
  with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can update cabinet roster cycles" on public.cabinet_roster_cycles;
create policy "Admins can update cabinet roster cycles"
  on public.cabinet_roster_cycles for update
  to authenticated
  using (public.is_admin_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can delete cabinet roster cycles" on public.cabinet_roster_cycles;
create policy "Admins can delete cabinet roster cycles"
  on public.cabinet_roster_cycles for delete
  to authenticated
  using (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can view cabinet roster drafts" on public.cabinet_roster_drafts;
create policy "Admins can view cabinet roster drafts"
  on public.cabinet_roster_drafts for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can insert cabinet roster drafts" on public.cabinet_roster_drafts;
create policy "Admins can insert cabinet roster drafts"
  on public.cabinet_roster_drafts for insert
  to authenticated
  with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can update cabinet roster drafts" on public.cabinet_roster_drafts;
create policy "Admins can update cabinet roster drafts"
  on public.cabinet_roster_drafts for update
  to authenticated
  using (public.is_admin_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can delete cabinet roster drafts" on public.cabinet_roster_drafts;
create policy "Admins can delete cabinet roster drafts"
  on public.cabinet_roster_drafts for delete
  to authenticated
  using (public.is_admin_user(auth.uid()));

comment on table public.cabinet_roster_cycles is
  'Admin-only Cabinet roster cycle. Publishing writes cabinet_members rows for cabinet_year_id; it never activates the year and is not a public source.';
comment on table public.cabinet_roster_drafts is
  'Admin-only draft positions. Structure copies carry role/category/display_order only; published_cabinet_member_id links the public row.';
