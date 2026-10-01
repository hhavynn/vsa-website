-- Private Big/Little assignment workspace for Admin → ACE.
--
-- Admins prepare the upcoming ACE sorting in draft tables that the public site
-- never reads, lock it for final review, then publish. Publishing is the only
-- step that touches the live tree: it inserts one `ace_family_members` row per
-- Little under the chosen Big (parent_member_id = the Big's node id, so public
-- lineage semantics are unchanged) and records the new node id on the draft.
--
-- Additive only. No existing table, view, policy, or row is modified. No
-- attendance, points, House membership, or leaderboard behavior is touched.
--
-- Privacy: both tables are admin-only (no anon access at all). Applicant
-- emails are never stored here; imports use them for matching and discard them.

-- ─── Cycles ──────────────────────────────────────────────────────────────────

create table if not exists public.ace_assignment_cycles (
  id uuid primary key default gen_random_uuid(),
  academic_year_start integer not null,
  academic_year_end integer not null,
  status text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ace_assignment_cycles_status_check
    check (status in ('draft', 'locked', 'published', 'archived')),
  constraint ace_assignment_cycles_year_span_check
    check (academic_year_end = academic_year_start + 1)
);

-- One live cycle per academic year; archiving frees the year for a fresh start.
create unique index if not exists ace_assignment_cycles_one_open_per_year
  on public.ace_assignment_cycles (academic_year_start)
  where status <> 'archived';

-- ─── Drafts ──────────────────────────────────────────────────────────────────

create table if not exists public.ace_assignment_drafts (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.ace_assignment_cycles(id) on delete cascade,
  little_name text not null,
  little_member_id uuid references public.members(id) on delete set null,
  big_ace_member_id uuid references public.ace_family_members(id) on delete set null,
  published_ace_member_id uuid references public.ace_family_members(id) on delete set null,
  notes text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ace_assignment_drafts_name_check check (length(btrim(little_name)) > 0)
);

create index if not exists ace_assignment_drafts_cycle_idx
  on public.ace_assignment_drafts (cycle_id, display_order);
create index if not exists ace_assignment_drafts_big_idx
  on public.ace_assignment_drafts (big_ace_member_id) where big_ace_member_id is not null;
create index if not exists ace_assignment_drafts_member_idx
  on public.ace_assignment_drafts (little_member_id) where little_member_id is not null;
-- A live node can come from at most one draft.
create unique index if not exists ace_assignment_drafts_published_node_key
  on public.ace_assignment_drafts (published_ace_member_id) where published_ace_member_id is not null;

drop trigger if exists update_ace_assignment_cycles_updated_at on public.ace_assignment_cycles;
create trigger update_ace_assignment_cycles_updated_at
  before update on public.ace_assignment_cycles
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_ace_assignment_drafts_updated_at on public.ace_assignment_drafts;
create trigger update_ace_assignment_drafts_updated_at
  before update on public.ace_assignment_drafts
  for each row execute function public.update_updated_at_column();

-- ─── RLS: admin only ─────────────────────────────────────────────────────────

alter table public.ace_assignment_cycles enable row level security;
alter table public.ace_assignment_drafts enable row level security;

revoke all on public.ace_assignment_cycles from anon, authenticated;
revoke all on public.ace_assignment_drafts from anon, authenticated;
grant select, insert, update, delete on public.ace_assignment_cycles to authenticated;
grant select, insert, update, delete on public.ace_assignment_drafts to authenticated;

drop policy if exists "Admins manage ace assignment cycles" on public.ace_assignment_cycles;
create policy "Admins manage ace assignment cycles"
  on public.ace_assignment_cycles for all to authenticated
  using (public.is_admin_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()));

drop policy if exists "Admins manage ace assignment drafts" on public.ace_assignment_drafts;
create policy "Admins manage ace assignment drafts"
  on public.ace_assignment_drafts for all to authenticated
  using (public.is_admin_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()));

-- ─── Lifecycle guards ────────────────────────────────────────────────────────
--
-- draft ⇄ locked → published → archived. Locking freezes the drafts; only the
-- publish function (which sets the transaction-local flag below) may move a
-- cycle to published or stamp published_ace_member_id. Admins can unlock.

create or replace function public.guard_ace_assignment_cycle_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = old.status then
    if old.status <> 'draft'
       and (new.academic_year_start <> old.academic_year_start
            or new.academic_year_end <> old.academic_year_end) then
      raise exception 'Unlock the assignment cycle before changing its academic year';
    end if;
    return new;
  end if;

  if old.status = 'draft' and new.status in ('locked', 'archived') then
    return new;
  elsif old.status = 'locked' and new.status in ('draft', 'archived') then
    return new;
  elsif old.status = 'locked' and new.status = 'published'
        and coalesce(current_setting('vsa.ace_publish', true), '') = 'on' then
    return new;
  elsif old.status = 'published' and new.status = 'archived' then
    return new;
  end if;

  raise exception 'Cannot move an assignment cycle from % to %', old.status, new.status;
end;
$$;

drop trigger if exists guard_ace_assignment_cycle_update on public.ace_assignment_cycles;
create trigger guard_ace_assignment_cycle_update
  before update on public.ace_assignment_cycles
  for each row execute function public.guard_ace_assignment_cycle_update();

create or replace function public.guard_ace_assignment_draft_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if tg_op = 'UPDATE' and new.cycle_id <> old.cycle_id then
    raise exception 'Assignments cannot move between cycles';
  end if;

  select status into v_status
  from public.ace_assignment_cycles
  where id = case when tg_op = 'DELETE' then old.cycle_id else new.cycle_id end;

  if v_status is null or v_status = 'draft'
     or coalesce(current_setting('vsa.ace_publish', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- Deleting an ACE node or member legitimately nulls its FK on a frozen
  -- draft; allow exactly that and nothing else.
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'big_ace_member_id' - 'little_member_id' - 'published_ace_member_id' - 'updated_at')
         = (to_jsonb(old) - 'big_ace_member_id' - 'little_member_id' - 'published_ace_member_id' - 'updated_at')
     and (new.big_ace_member_id is null or new.big_ace_member_id = old.big_ace_member_id)
     and (new.little_member_id is null or new.little_member_id = old.little_member_id)
     and (new.published_ace_member_id is null or new.published_ace_member_id = old.published_ace_member_id) then
    return new;
  end if;

  raise exception 'Assignments are % and cannot be edited. Unlock the cycle first.', v_status;
end;
$$;

drop trigger if exists guard_ace_assignment_draft_write on public.ace_assignment_drafts;
create trigger guard_ace_assignment_draft_write
  before insert or update or delete on public.ace_assignment_drafts
  for each row execute function public.guard_ace_assignment_draft_write();

revoke execute on function public.guard_ace_assignment_cycle_update() from public, anon, authenticated;
revoke execute on function public.guard_ace_assignment_draft_write() from public, anon, authenticated;

-- ─── Publish ─────────────────────────────────────────────────────────────────
--
-- One transaction, serialized on the cycle row:
--   * published cycle → no-op summary (safe to click twice)
--   * not locked      → refuse
--   * any hard blocker → refuse with every problem listed
--   * otherwise insert a node per unpublished draft and stamp it back.
-- Mirrors the hard blockers in src/lib/aceAssignments.ts so the client
-- preflight and this function agree.

create or replace function public.publish_ace_assignment_cycle(p_cycle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle public.ace_assignment_cycles%rowtype;
  v_total integer;
  v_created integer := 0;
  v_problems text[] := array[]::text[];
  v_count integer;
  v_draft public.ace_assignment_drafts%rowtype;
  v_big public.ace_family_members%rowtype;
  v_order integer;
  v_node_id uuid;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select * into v_cycle
  from public.ace_assignment_cycles
  where id = p_cycle_id
  for update;

  if not found then
    raise exception 'Assignment cycle not found';
  end if;

  select count(*) into v_total
  from public.ace_assignment_drafts where cycle_id = p_cycle_id;

  if v_cycle.status = 'published' then
    return jsonb_build_object(
      'cycle_id', p_cycle_id, 'status', 'published',
      'created', 0, 'total', v_total, 'already_published', true
    );
  end if;

  if v_cycle.status <> 'locked' then
    raise exception 'Lock the assignment cycle before publishing (it is %)', v_cycle.status;
  end if;

  if v_total = 0 then
    raise exception 'Nothing to publish: this cycle has no Littles';
  end if;

  select count(*) into v_count
  from public.ace_assignment_drafts
  where cycle_id = p_cycle_id and big_ace_member_id is null;
  if v_count > 0 then
    v_problems := v_problems || format('%s Little(s) have no Big (or their Big was deleted)', v_count);
  end if;

  select count(*) into v_count from (
    select 1
    from public.ace_assignment_drafts
    where cycle_id = p_cycle_id
    group by lower(regexp_replace(btrim(little_name), '\s+', ' ', 'g'))
    having count(*) > 1
  ) dup;
  if v_count > 0 then
    v_problems := v_problems || format('%s Little name(s) appear more than once', v_count);
  end if;

  select count(*) into v_count from (
    select 1
    from public.ace_assignment_drafts
    where cycle_id = p_cycle_id and little_member_id is not null
    group by little_member_id
    having count(*) > 1
  ) dup;
  if v_count > 0 then
    v_problems := v_problems || format('%s member(s) are assigned more than once', v_count);
  end if;

  select count(*) into v_count
  from public.ace_assignment_drafts
  where cycle_id = p_cycle_id and published_ace_member_id is not null;
  if v_count > 0 then
    v_problems := v_problems || format('%s assignment(s) already created a tree node', v_count);
  end if;

  select count(*) into v_count
  from public.ace_assignment_drafts d
  join public.ace_family_members n on n.parent_member_id = d.big_ace_member_id
  where d.cycle_id = p_cycle_id
    and (
      (d.little_member_id is not null and n.member_id = d.little_member_id)
      or lower(regexp_replace(btrim(n.name), '\s+', ' ', 'g'))
         = lower(regexp_replace(btrim(d.little_name), '\s+', ' ', 'g'))
    );
  if v_count > 0 then
    v_problems := v_problems || format('%s Little(s) are already on the tree under that Big', v_count);
  end if;

  if array_length(v_problems, 1) > 0 then
    raise exception 'Publish blocked: %', array_to_string(v_problems, '; ');
  end if;

  perform set_config('vsa.ace_publish', 'on', true);

  for v_draft in
    select * from public.ace_assignment_drafts
    where cycle_id = p_cycle_id and published_ace_member_id is null
    order by display_order, created_at, id
  loop
    select * into v_big from public.ace_family_members where id = v_draft.big_ace_member_id;

    select coalesce(max(display_order), -1) + 1 into v_order
    from public.ace_family_members
    where family_id = v_big.family_id and parent_member_id = v_big.id;

    insert into public.ace_family_members
      (family_id, name, role_label, parent_member_id, member_id, display_order, is_published)
    values
      (v_big.family_id, btrim(v_draft.little_name), 'Little', v_big.id,
       v_draft.little_member_id, v_order, true)
    returning id into v_node_id;

    update public.ace_assignment_drafts
    set published_ace_member_id = v_node_id
    where id = v_draft.id;

    v_created := v_created + 1;
  end loop;

  update public.ace_assignment_cycles set status = 'published' where id = p_cycle_id;

  perform set_config('vsa.ace_publish', 'off', true);

  return jsonb_build_object(
    'cycle_id', p_cycle_id, 'status', 'published',
    'created', v_created, 'total', v_total, 'already_published', false
  );
end;
$$;

revoke execute on function public.publish_ace_assignment_cycle(uuid) from public, anon;
grant execute on function public.publish_ace_assignment_cycle(uuid) to authenticated;

comment on table public.ace_assignment_cycles is
  'Admin-only yearly Big/Little sorting workspace. Nothing here is public until publish_ace_assignment_cycle runs.';
comment on table public.ace_assignment_drafts is
  'Admin-only draft assignments. published_ace_member_id records the live ace_family_members node created at publish.';
