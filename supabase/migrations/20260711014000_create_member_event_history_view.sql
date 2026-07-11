-- Public-safe view exposing a member's individual attended-events, for the
-- public Leaderboard profile modal ("show the actual events they attended").
--
-- Prior to this migration, member_event_attendance (the individual per-event
-- record table) was not exposed to anon/authenticated at all -- only
-- aggregate views (member_yearly_points, house_member_yearly_points, etc.)
-- were. This view is a new, deliberate exposure of individual attendance
-- history, publicly visible on any member's leaderboard profile (owner
-- decision, 2026-07-11). It exposes only columns already public elsewhere
-- (event name/date/type, same as the public Events page) plus the
-- points_earned for that specific check-in. No check-in codes, no import
-- metadata, no other member's data.

create view public.member_event_history as
select
    mea.member_id,
    e.id           as event_id,
    e.name         as event_name,
    e.date         as event_date,
    e.end_date     as event_end_date,
    e.event_type,
    mea.points_earned,
    t.academic_year_start,
    t.academic_year_end
from public.member_event_attendance mea
join public.events e on e.id = mea.event_id
left join public.academic_terms t on t.id = e.academic_term_id
where e.is_published = true;

grant select on public.member_event_history to anon, authenticated;
