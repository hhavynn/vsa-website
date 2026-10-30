-- Saved pre-sort eligibility policy for Admin → ACE → Assignments.
--
-- While the ACE Chair sorts (cycle draft or locked), the workspace checks each
-- Little and each Big against VSA attendance minimums. The minimums and the
-- qualifying events are a per-cycle decision the Chair saves; nothing here
-- hardcodes a number. The UI pre-fills 4 (Littles) and 3 (Bigs) for a new
-- cycle, and the Chair still has to save them.
--
-- Additive only:
--   * two nullable columns on ace_assignment_cycles (null = not saved yet),
--   * a cycle-scoped table of qualifying event ids,
--   * guard triggers that freeze both once the cycle leaves draft, matching
--     the existing lifecycle guards (draft is the only editable status),
--   * save_ace_eligibility_policy, which replaces the whole policy in one
--     transaction (SECURITY INVOKER: RLS still applies to every row it writes).
-- No existing table, view, policy or row is modified. Nothing reads or writes
-- attendance or points; per-person eligibility is computed in the admin
-- browser and never stored. No published_* view or anon grant is touched.

-- ─── Minimums ────────────────────────────────────────────────────────────────

alter table public.ace_assignment_cycles
  add column if not exists little_min_events integer,
  add column if not exists big_min_events integer;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'ace_assignment_cycles_little_min_events_check') then
    alter table public.ace_assignment_cycles
      add constraint ace_assignment_cycles_little_min_events_check
      check (little_min_events between 1 and 20);
  end if;
  if not exists (select 1 from pg_constraint
                 where conname = 'ace_assignment_cycles_big_min_events_check') then
    alter table public.ace_assignment_cycles
      add constraint ace_assignment_cycles_big_min_events_check
      check (big_min_events between 1 and 20);
  end if;
end $$;

comment on column public.ace_assignment_cycles.little_min_events is
  'Admin-only. Qualifying events a Little must have attended to be picked up; null until the ACE Chair saves it.';
comment on column public.ace_assignment_cycles.big_min_events is
  'Admin-only. Qualifying events a Big must have attended to pick up a Little; null until the ACE Chair saves it.';

-- A separate trigger (rather than redefining guard_ace_assignment_cycle_update)
-- keeps the shipped lifecycle guard byte-for-byte unchanged.
create or replace function public.guard_ace_assignment_cycle_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'draft'
     and (new.little_min_events is distinct from old.little_min_events
          or new.big_min_events is distinct from old.big_min_events) then
    raise exception 'The eligibility policy is % and cannot be edited. Unlock the cycle first.', old.status;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_ace_assignment_cycle_policy on public.ace_assignment_cycles;
create trigger guard_ace_assignment_cycle_policy
  before update on public.ace_assignment_cycles
  for each row execute function public.guard_ace_assignment_cycle_policy();

-- ─── Qualifying events ───────────────────────────────────────────────────────

create table if not exists public.ace_assignment_cycle_events (
  cycle_id uuid not null references public.ace_assignment_cycles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint ace_assignment_cycle_events_pkey primary key (cycle_id, event_id)
);

create index if not exists ace_assignment_cycle_events_event_idx
  on public.ace_assignment_cycle_events (event_id);

alter table public.ace_assignment_cycle_events enable row level security;

revoke all on public.ace_assignment_cycle_events from public, anon, authenticated;
-- Rows are (cycle, event) pairs: change the set by deleting and inserting.
grant select, insert, delete on public.ace_assignment_cycle_events to authenticated;

drop policy if exists "Admins manage ace assignment cycle events" on public.ace_assignment_cycle_events;
create policy "Admins manage ace assignment cycle events"
  on public.ace_assignment_cycle_events for all to authenticated
  using (public.is_admin_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()));

create or replace function public.guard_ace_assignment_cycle_event_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle public.ace_assignment_cycles%rowtype;
  v_event record;
begin
  if tg_op = 'UPDATE' then
    raise exception 'Qualifying events cannot be changed in place; remove the event and add another';
  end if;

  select * into v_cycle
  from public.ace_assignment_cycles
  where id = case when tg_op = 'DELETE' then old.cycle_id else new.cycle_id end;

  if tg_op = 'DELETE' then
    -- Deleting the cycle or the event itself cascades here; the freeze must
    -- not block either, exactly like the draft guard's FK carve-out.
    if v_cycle.id is null or v_cycle.status = 'draft'
       or not exists (select 1 from public.events where id = old.event_id) then
      return old;
    end if;
    raise exception 'The eligibility policy is % and cannot be edited. Unlock the cycle first.', v_cycle.status;
  end if;

  if v_cycle.id is null then
    raise exception 'Assignment cycle not found';
  end if;
  if v_cycle.status <> 'draft' then
    raise exception 'The eligibility policy is % and cannot be edited. Unlock the cycle first.', v_cycle.status;
  end if;

  select e.date, e.is_published, t.academic_year_start into v_event
  from public.events e
  left join public.academic_terms t on t.id = e.academic_term_id
  where e.id = new.event_id;

  if not found then
    raise exception 'Event not found';
  end if;
  if v_event.is_published is not true or v_event.date is null or v_event.date > now() then
    raise exception 'Only completed, dated, published events can qualify';
  end if;
  -- Same year scoping as admin_event_attendance_readiness (the event's term).
  if v_event.academic_year_start is distinct from v_cycle.academic_year_start then
    raise exception 'Choose an event from the cycle''s academic year';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_ace_assignment_cycle_event_write on public.ace_assignment_cycle_events;
create trigger guard_ace_assignment_cycle_event_write
  before insert or update or delete on public.ace_assignment_cycle_events
  for each row execute function public.guard_ace_assignment_cycle_event_write();

revoke execute on function public.guard_ace_assignment_cycle_policy() from public, anon, authenticated;
revoke execute on function public.guard_ace_assignment_cycle_event_write() from public, anon, authenticated;

comment on table public.ace_assignment_cycle_events is
  'Admin-only. Events the ACE Chair chose as qualifying for a cycle''s eligibility check. Frozen once the cycle leaves draft.';

-- ─── Save ────────────────────────────────────────────────────────────────────
--
-- Replaces both minimums and the event set at once, serialized on the cycle
-- row. Only events that are new to the set are inserted, so a saved event that
-- later stopped qualifying is removed rather than re-validated.

create or replace function public.save_ace_eligibility_policy(
  p_cycle_id uuid,
  p_little_min_events integer,
  p_big_min_events integer,
  p_event_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
  v_ids uuid[];
  v_added integer;
  v_removed integer;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if p_little_min_events is null or p_little_min_events not between 1 and 20
     or p_big_min_events is null or p_big_min_events not between 1 and 20 then
    raise exception 'Minimums must be whole numbers from 1 to 20' using errcode = '22023';
  end if;
  if array_position(coalesce(p_event_ids, array[]::uuid[]), null) is not null then
    raise exception 'The event list contains a blank entry' using errcode = '22023';
  end if;

  v_ids := array(select distinct x from unnest(coalesce(p_event_ids, array[]::uuid[])) as x);
  if cardinality(v_ids) > 100 then
    raise exception 'Choose at most 100 qualifying events' using errcode = '22023';
  end if;

  select status into v_status
  from public.ace_assignment_cycles
  where id = p_cycle_id
  for update;

  if not found then
    raise exception 'Assignment cycle not found';
  end if;
  if v_status <> 'draft' then
    raise exception 'The eligibility policy is % and cannot be edited. Unlock the cycle first.', v_status;
  end if;

  update public.ace_assignment_cycles
  set little_min_events = p_little_min_events,
      big_min_events = p_big_min_events
  where id = p_cycle_id;

  delete from public.ace_assignment_cycle_events
  where cycle_id = p_cycle_id and event_id <> all (v_ids);
  get diagnostics v_removed = row_count;

  insert into public.ace_assignment_cycle_events (cycle_id, event_id)
  select p_cycle_id, chosen.event_id
  from unnest(v_ids) as chosen(event_id)
  where not exists (
    select 1 from public.ace_assignment_cycle_events existing
    where existing.cycle_id = p_cycle_id and existing.event_id = chosen.event_id
  );
  get diagnostics v_added = row_count;

  return jsonb_build_object(
    'cycle_id', p_cycle_id,
    'little_min_events', p_little_min_events,
    'big_min_events', p_big_min_events,
    'event_count', cardinality(v_ids),
    'added', v_added,
    'removed', v_removed
  );
end;
$$;

revoke execute on function public.save_ace_eligibility_policy(uuid, integer, integer, uuid[]) from public, anon;
grant execute on function public.save_ace_eligibility_policy(uuid, integer, integer, uuid[]) to authenticated;
