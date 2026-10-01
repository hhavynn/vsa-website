-- Persisted, admin-only House assignment drafts (draft -> lock -> publish).
--
-- Admin -> Houses used to write straight into house_memberships from a pasted
-- sheet. These two tables hold the sheet's result privately first, so the
-- assignments can be reviewed, edited, balanced, locked, and only then revealed.
--
-- Access boundary: admin only (anon and authenticated clients get no rows
-- unless public.is_admin_user() is true). Nothing here is readable publicly, so
-- a draft assignment can never leak before House Reveal.
--
-- Additive only. This migration does NOT touch house_memberships, members,
-- attendance, points, or any view. Publishing is performed by Admin -> Houses
-- through the existing dated-membership logic; locking never writes to
-- house_memberships. No emails from imported sheets are stored: email is used
-- transiently for matching and only the match method is recorded.

-- ─── Batches ─────────────────────────────────────────────────────────────────

create table if not exists public.house_assignment_batches (
  id uuid primary key default gen_random_uuid(),
  academic_year_start integer not null,
  academic_year_end integer not null,
  effective_start_date date not null,
  status text not null default 'draft',
  source_label text,
  created_by uuid references auth.users(id) on delete set null,
  locked_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint house_assignment_batches_status_check
    check (status in ('draft', 'locked', 'published', 'archived')),
  constraint house_assignment_batches_year_span_check
    check (academic_year_end = academic_year_start + 1)
);

create index if not exists house_assignment_batches_year_status_idx
  on public.house_assignment_batches (academic_year_start, status);

-- ─── Draft rows ──────────────────────────────────────────────────────────────

create table if not exists public.house_assignment_drafts (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.house_assignment_batches(id) on delete cascade,
  source_name text not null default '',
  -- House text exactly as it appeared in the sheet, kept so an unrecognized
  -- House can be shown to the admin instead of silently disappearing.
  source_house text,
  member_id uuid references public.members(id) on delete set null,
  house_profile_id uuid references public.house_page_assets(id) on delete set null,
  match_status text not null default 'unmatched',
  match_method text,
  match_score smallint,
  -- Ordered House choices (first choice first), e.g. ["Toad", "Boo"].
  preferences jsonb,
  notes text,
  source_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint house_assignment_drafts_match_status_check
    check (match_status in ('match', 'review', 'unmatched', 'invalid', 'manual')),
  constraint house_assignment_drafts_match_method_check
    check (match_method is null or match_method in ('email', 'name', 'manual')),
  constraint house_assignment_drafts_preferences_check
    check (preferences is null or jsonb_typeof(preferences) = 'array')
);

create index if not exists house_assignment_drafts_batch_order_idx
  on public.house_assignment_drafts (batch_id, source_order);

create index if not exists house_assignment_drafts_member_idx
  on public.house_assignment_drafts (member_id)
  where member_id is not null;

-- ─── Guards ──────────────────────────────────────────────────────────────────

drop trigger if exists update_house_assignment_batches_updated_at on public.house_assignment_batches;
create trigger update_house_assignment_batches_updated_at
  before update on public.house_assignment_batches
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists update_house_assignment_drafts_updated_at on public.house_assignment_drafts;
create trigger update_house_assignment_drafts_updated_at
  before update on public.house_assignment_drafts
  for each row
  execute function public.update_updated_at_column();

-- Status may only move forward through the workflow (a locked batch can be
-- reopened). A batch that has left 'draft' keeps its year and effective date.
create or replace function public.guard_house_assignment_batch_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' and (
    new.academic_year_start <> old.academic_year_start
    or new.academic_year_end <> old.academic_year_end
    or new.effective_start_date <> old.effective_start_date
  ) then
    raise exception 'House assignment batch year and effective date are fixed once it is locked.';
  end if;

  if new.status <> old.status then
    if not (
      (old.status = 'draft' and new.status in ('locked', 'archived'))
      or (old.status = 'locked' and new.status in ('draft', 'published', 'archived'))
      or (old.status = 'published' and new.status = 'archived')
    ) then
      raise exception 'House assignment batch cannot move from % to %.', old.status, new.status;
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

drop trigger if exists guard_house_assignment_batch_update on public.house_assignment_batches;
create trigger guard_house_assignment_batch_update
  before update on public.house_assignment_batches
  for each row
  execute function public.guard_house_assignment_batch_update();

-- Only a draft batch can be deleted; locked and published batches are the audit
-- trail for what was revealed.
create or replace function public.guard_house_assignment_batch_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    raise exception 'Only draft House assignment batches can be deleted (status: %).', old.status;
  end if;
  return old;
end;
$$;

drop trigger if exists guard_house_assignment_batch_delete on public.house_assignment_batches;
create trigger guard_house_assignment_batch_delete
  before delete on public.house_assignment_batches
  for each row
  execute function public.guard_house_assignment_batch_delete();

-- Draft rows only change while their batch is a draft, so a locked or published
-- batch can never be mutated silently. A missing parent means the row is being
-- removed by the batch's own ON DELETE CASCADE.
create or replace function public.guard_house_assignment_draft_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_id uuid;
  parent_status text;
begin
  if tg_op = 'INSERT' then
    parent_id := new.batch_id;
  else
    parent_id := old.batch_id;
  end if;

  if tg_op = 'UPDATE' and new.batch_id <> old.batch_id then
    raise exception 'House assignment draft rows cannot move between batches.';
  end if;

  select status into parent_status
  from public.house_assignment_batches
  where id = parent_id;

  if parent_status is not null and parent_status <> 'draft' then
    raise exception 'House assignment batch is % and cannot be edited. Reopen it first.', parent_status;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_house_assignment_draft_mutation on public.house_assignment_drafts;
create trigger guard_house_assignment_draft_mutation
  before insert or update or delete on public.house_assignment_drafts
  for each row
  execute function public.guard_house_assignment_draft_mutation();

-- ─── RLS: admin only ─────────────────────────────────────────────────────────

alter table public.house_assignment_batches enable row level security;
alter table public.house_assignment_drafts enable row level security;

revoke all on public.house_assignment_batches from anon, authenticated;
revoke all on public.house_assignment_drafts from anon, authenticated;
grant select, insert, update, delete on public.house_assignment_batches to authenticated;
grant select, insert, update, delete on public.house_assignment_drafts to authenticated;

drop policy if exists "Admins can view house assignment batches" on public.house_assignment_batches;
create policy "Admins can view house assignment batches"
  on public.house_assignment_batches for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can insert house assignment batches" on public.house_assignment_batches;
create policy "Admins can insert house assignment batches"
  on public.house_assignment_batches for insert
  to authenticated
  with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can update house assignment batches" on public.house_assignment_batches;
create policy "Admins can update house assignment batches"
  on public.house_assignment_batches for update
  to authenticated
  using (public.is_admin_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can delete house assignment batches" on public.house_assignment_batches;
create policy "Admins can delete house assignment batches"
  on public.house_assignment_batches for delete
  to authenticated
  using (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can view house assignment drafts" on public.house_assignment_drafts;
create policy "Admins can view house assignment drafts"
  on public.house_assignment_drafts for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can insert house assignment drafts" on public.house_assignment_drafts;
create policy "Admins can insert house assignment drafts"
  on public.house_assignment_drafts for insert
  to authenticated
  with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can update house assignment drafts" on public.house_assignment_drafts;
create policy "Admins can update house assignment drafts"
  on public.house_assignment_drafts for update
  to authenticated
  using (public.is_admin_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can delete house assignment drafts" on public.house_assignment_drafts;
create policy "Admins can delete house assignment drafts"
  on public.house_assignment_drafts for delete
  to authenticated
  using (public.is_admin_user(auth.uid()));

comment on table public.house_assignment_batches is
  'Admin-only House assignment batch. Locking keeps assignments private; publishing materializes them into house_memberships via Admin -> Houses.';
comment on table public.house_assignment_drafts is
  'Admin-only draft rows for a House assignment batch. Stores no emails; preferences is an ordered jsonb array of House choices.';
