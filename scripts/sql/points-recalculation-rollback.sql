-- Rollback for 20261010000000_serialize_member_points_recalculation.sql.
-- Run only if the new triggers must come off. One transaction: the old row
-- trigger is created before the new ones are dropped, so no attendance write
-- ever runs without a recalculation trigger.
--
-- Resulting behaviour (tested in scripts/test-points-concurrency.sh):
--   * trg_sync_member_points (FOR EACH ROW) is back and calls the unchanged
--     sync_member_points(), which calls recalculate_member_points(uuid). That
--     function keeps its locking body from the migration, so concurrent writers
--     for one member still do not lose updates.
--   * Moving a credit to another member again leaves the previous owner stale,
--     a write racing an event points edit can again store the old value, and
--     bulk imports can again deadlock on members locked in row order.
--   * anon's revoked write privileges on member_event_attendance stay revoked.
-- Afterwards run scripts/sql/points-integrity-check.sql.

begin;
set local lock_timeout = '5s';

create trigger trg_sync_member_points
  after insert or delete or update on public.member_event_attendance
  for each row execute function public.sync_member_points();

drop trigger trg_attendance_points_from_event on public.member_event_attendance;
drop trigger trg_sync_member_points_insert on public.member_event_attendance;
drop trigger trg_sync_member_points_update on public.member_event_attendance;
drop trigger trg_sync_member_points_delete on public.member_event_attendance;

commit;
