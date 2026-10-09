-- Serialize cached member point totals across every attendance writer.
--
-- Ledger (authoritative): member_event_attendance, one row per member/event,
-- valued at the event's points (events.points). Derived (cached):
-- members.points and members.events_attended. House and yearly standings are
-- live views over the ledger and are not cached.
--
-- Before this migration (production definitions, read 2026-10-08):
--   trg_sync_member_points  AFTER INSERT/UPDATE/DELETE FOR EACH ROW
--     -> sync_member_points() -> recalculate_member_points(member_id), a single
--        UPDATE members SET points = (SELECT SUM(...)) WHERE id = member_id.
--   1. Lost update. That UPDATE takes its snapshot before it waits for the
--      members row lock. When a concurrent writer for the same member commits
--      first, the recheck keeps the stale subquery snapshot and writes a total
--      that omits the other writer's row (7 + 10 cached as 10).
--   2. On UPDATE only NEW.member_id was recalculated, so moving a credit to
--      another member left the previous owner's total stale.
--   3. A client that read events.points before a points edit committed could
--      insert the old value after the edit's cascade had already run.
--   4. Multi-row statements locked members in row order, so two bulk imports
--      crediting the same members in opposite order deadlocked.
--
-- After:
--   * recalculate_members_points(uuid[]) first locks the members rows FOR NO KEY
--     UPDATE in id order, then recalculates in a separate statement. Under READ
--     COMMITTED that statement gets a fresh snapshot taken after the lock, so it
--     sees every committed attendance row of any writer that held the lock
--     before it. Every writer locks before it recalculates and holds the lock to
--     commit, so the last writer to commit always computes from the full ledger.
--     REPEATABLE READ / SERIALIZABLE callers that race a writer get a
--     serialization error instead of a wrong total.
--   * Three statement-level triggers (insert, update, delete) collect the
--     affected member ids from transition tables (both old and new owners on
--     update; FK cascades included) and recalculate them once per statement.
--   * trg_attendance_points_from_event (BEFORE INSERT OR UPDATE OF event_id)
--     reads the event FOR SHARE and stores its current points. A concurrent
--     points edit either commits first (the new row takes the new value) or
--     waits for this transaction and then cascades to the new row.
--
-- Rule change, deliberately: a credit is stored at the event's current points
-- whatever value the writer sends. The importer, Admin Members and Historical
-- Recovery already send that value, so for them only the race changes.
-- smart_merge_members copies the source's stored value; a source credit that
-- differs from its event (production: 23 VCN credits stored at 1, event at 5)
-- is stored at the event's value on the merged member. A direct UPDATE of
-- points_earned alone is not overridden (no client does this).
--
-- Locks. Within one statement members are locked in ascending id, so
-- statement-against-statement deadlocks on members are gone (cause 4). Order by
-- writer:
--   importer / Admin Members   event (FOR SHARE) -> attendance -> members
--   event points edit          event -> attendance -> members
--   Historical Recovery        import row -> event -> member advisory -> member -> attendance
--   smart_merge_members        target member -> events -> attendance -> source member
-- Remaining deadlocks need two multi-step transactions crossing those orders
-- (e.g. a merge racing a points edit on an event both members attended, or two
-- imports writing the same member/event pairs in opposite order). PostgreSQL
-- detects them and rolls one transaction back whole, recalculation included,
-- so they surface as a retryable error, never as drift. All existed before.
--
-- Access: anon's remaining write privileges on member_event_attendance are
-- revoked (RLS already refused them; the new BEFORE trigger would otherwise run
-- before RLS rejects an anonymous insert). No grant is added to any client role.
--
-- Rollback: scripts/sql/points-recalculation-rollback.sql (one transaction,
-- restores the row trigger; tested by scripts/test-points-concurrency.sh).

begin;

-- Fail fast instead of queueing behind a long transaction while holding a
-- table lock that blocks leaderboard reads; re-run when it is quiet.
set local lock_timeout = '5s';

-- Recalculates the cached totals of the given members from the ledger.
create or replace function public.recalculate_members_points(p_member_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_member_ids is null or cardinality(p_member_ids) = 0 then
    return;
  end if;

  -- Statement 1: wait for, then hold, every affected members row in id order.
  perform m.id
  from public.members m
  where m.id = any (p_member_ids)
  order by m.id
  for no key update;

  -- Statement 2: a new snapshot, taken after the locks above were granted.
  update public.members m
  set
    points = coalesce((
      select sum(a.points_earned)
      from public.member_event_attendance a
      where a.member_id = m.id
    ), 0),
    events_attended = (
      select count(*)
      from public.member_event_attendance a
      where a.member_id = m.id
    ),
    updated_at = now()
  where m.id = any (p_member_ids);
end;
$function$;

revoke all on function public.recalculate_members_points(uuid[]) from public, anon, authenticated;
grant execute on function public.recalculate_members_points(uuid[]) to service_role;

-- Same signature and grants as before; now goes through the locking path.
create or replace function public.recalculate_member_points(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform public.recalculate_members_points(array[p_member_id]);
end;
$function$;

-- Matches production (service_role only); re-stated so no environment drifts.
revoke all on function public.recalculate_member_points(uuid) from public, anon, authenticated;
grant execute on function public.recalculate_member_points(uuid) to service_role;

create or replace function public.sync_member_points_for_statement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_member_ids uuid[];
begin
  if tg_op = 'INSERT' then
    select array_agg(distinct member_id) into v_member_ids from new_rows;
  elsif tg_op = 'DELETE' then
    select array_agg(distinct member_id) into v_member_ids from old_rows;
  else
    select array_agg(distinct member_id) into v_member_ids
    from (select member_id from old_rows union select member_id from new_rows) changed;
  end if;

  perform public.recalculate_members_points(v_member_ids);
  return null;
end;
$function$;

create or replace function public.attendance_points_from_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_points integer;
begin
  if tg_op = 'UPDATE' and new.event_id is not distinct from old.event_id then
    return new;
  end if;

  select e.points into v_points
  from public.events e
  where e.id = new.event_id
  for share;

  if found and v_points is not null then
    new.points_earned := v_points;
  end if;
  return new;
end;
$function$;

revoke all on function public.sync_member_points_for_statement() from public, anon, authenticated;
revoke all on function public.attendance_points_from_event() from public, anon, authenticated;

drop trigger if exists trg_sync_member_points on public.member_event_attendance;
drop trigger if exists trg_sync_member_points_insert on public.member_event_attendance;
drop trigger if exists trg_sync_member_points_update on public.member_event_attendance;
drop trigger if exists trg_sync_member_points_delete on public.member_event_attendance;
drop trigger if exists trg_attendance_points_from_event on public.member_event_attendance;

create trigger trg_attendance_points_from_event
  before insert or update of event_id on public.member_event_attendance
  for each row execute function public.attendance_points_from_event();

create trigger trg_sync_member_points_insert
  after insert on public.member_event_attendance
  referencing new table as new_rows
  for each statement execute function public.sync_member_points_for_statement();

create trigger trg_sync_member_points_update
  after update on public.member_event_attendance
  referencing old table as old_rows new table as new_rows
  for each statement execute function public.sync_member_points_for_statement();

create trigger trg_sync_member_points_delete
  after delete on public.member_event_attendance
  referencing old table as old_rows
  for each statement execute function public.sync_member_points_for_statement();

revoke insert, update, delete, truncate, references, trigger on public.member_event_attendance from anon;

commit;
