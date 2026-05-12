-- Create a view for yearly member leaderboard totals.
-- This view aggregates points from member_event_attendance joined through events to academic_terms.
create or replace view public.member_yearly_points as
select
    m.id as member_id,
    m.first_name,
    m.last_name,
    m.college,
    m.year as graduation_year,
    m.user_id,
    t.academic_year_start,
    t.academic_year_end,
    sum(mea.points_earned)::int as total_points,
    count(distinct mea.event_id)::int as events_attended
from
    public.members m
join
    public.member_event_attendance mea on m.id = mea.member_id
join
    public.events e on mea.event_id = e.id
join
    public.academic_terms t on e.academic_term_id = t.id
group by
    m.id, m.first_name, m.last_name, m.college, m.year, m.user_id, t.academic_year_start, t.academic_year_end;

-- Grant access to the view
grant select on public.member_yearly_points to anon, authenticated;

-- Note: No RLS is needed on the view itself as it respects RLS of underlying tables if defined,
-- but since this is a summary view for a public leaderboard, we ensure it's selectable.
-- Supabase views don't have RLS in the same way tables do, but they inherit access from the schema grants.
