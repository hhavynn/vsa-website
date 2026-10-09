-- Read-only points integrity check. Safe to run against production
-- (psql -f, or paste into the SQL editor): one READ ONLY transaction, rolled
-- back. Returns member and event ids only, never names or emails.
--
-- Authoritative: member_event_attendance (the ledger) and events.points.
-- Cached: members.points, members.events_attended.
-- House standings (house_*_points views), member_yearly_points and
-- member_event_history are live views over the ledger, so they cannot drift
-- from it; House totals count credits (count(*)), not points_earned.
--
-- Never repair a finding by writing cached totals. See
-- docs/leaderboard-system.md "Points integrity".

begin transaction read only;

with ledger as (
  select m.id,
         m.points as cached_points,
         m.events_attended as cached_events,
         coalesce(sum(a.points_earned), 0)::integer as ledger_points,
         count(a.id)::integer as ledger_events
  from public.members m
  left join public.member_event_attendance a on a.member_id = m.id
  group by m.id
)
select 'summary' as check_name,
       (select count(*) from ledger where cached_points <> ledger_points) as members_points_drift,
       (select count(*) from ledger where cached_events <> ledger_events) as members_events_attended_drift,
       (select count(*) from public.member_event_attendance a join public.events e on e.id = a.event_id
         where a.points_earned is distinct from e.points) as credits_not_at_event_points,
       (select count(*) from public.members) as members,
       (select count(*) from public.member_event_attendance) as credits;

-- Members whose cached totals differ from the ledger.
select m.id as member_id,
       m.points as cached_points,
       coalesce(sum(a.points_earned), 0)::integer as ledger_points,
       m.events_attended as cached_events,
       count(a.id)::integer as ledger_events
from public.members m
left join public.member_event_attendance a on a.member_id = m.id
group by m.id
having m.points <> coalesce(sum(a.points_earned), 0)
    or m.events_attended <> count(a.id)
order by m.id;

-- Credits whose stored value differs from the event's current points, per
-- event. Cached totals follow the stored value; this is a ledger question for
-- an owner, not drift.
select e.id as event_id,
       e.points as event_points,
       a.points_earned,
       count(*) as credits,
       min(a.imported_at) as first_imported_at,
       max(a.imported_at) as last_imported_at
from public.member_event_attendance a
join public.events e on e.id = a.event_id
where a.points_earned is distinct from e.points
group by e.id, e.points, a.points_earned
order by e.id;

rollback;
