-- When events.points is updated, cascade the new value to all
-- member_event_attendance rows for that event, then recalculate
-- the denormalized members.points and members.events_attended for
-- every affected member.
--
-- This fixes the stale-leaderboard bug where editing an event's
-- point value in Admin > Events did not update totals in
-- member_yearly_points, house_yearly_points, house_all_time_points,
-- house_recent_activity, or the all-time leaderboard.
--
-- Safety notes:
--   - Guard on `new.points is not distinct from old.points` makes
--     the trigger a no-op when points did not actually change.
--   - No attendance rows are created or deleted — only points_earned
--     is updated.
--   - members.points is recalculated from the full attendance history,
--     not just the changed event, to keep the value accurate.
--   - The trigger is idempotent: running it multiple times converges
--     to the same result.

create or replace function public.sync_attendance_points_on_event_update()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Skip expensive work when points did not actually change.
  if new.points is not distinct from old.points then
    return new;
  end if;

  -- 1. Cascade the new point value to every attendance row for this event.
  update public.member_event_attendance
  set points_earned = new.points
  where event_id = new.id;

  -- 2. Recalculate each affected member's denormalized totals.
  --    The subquery reads member_event_attendance after step 1 has
  --    already updated it, so the sum is correct.
  update public.members m
  set
    points = (
      select coalesce(sum(a.points_earned), 0)
      from public.member_event_attendance a
      where a.member_id = m.id
    ),
    events_attended = (
      select count(*)::int
      from public.member_event_attendance a
      where a.member_id = m.id
    ),
    updated_at = now()
  where m.id in (
    select member_id
    from public.member_event_attendance
    where event_id = new.id
  );

  return new;
end;
$$;

drop trigger if exists sync_attendance_points_on_event_update on public.events;
create trigger sync_attendance_points_on_event_update
  after update of points on public.events
  for each row
  execute function public.sync_attendance_points_on_event_update();
