-- Remove auth UUIDs (user_id) from public-facing member views and block
-- column-level SELECT on members.user_id so anon and authenticated roles
-- can no longer read auth UUIDs through any PostgREST path.
--
-- Trade-off accepted: public leaderboard avatars fall back to initials
-- because Avatar.tsx resolves photos via user_id. Privacy > cosmetics.

-- ─── member_yearly_points ────────────────────────────────────────────────────
-- Must DROP then CREATE (not CREATE OR REPLACE) because a column is removed.

drop view if exists public.member_yearly_points;

create view public.member_yearly_points as
select
    m.id              as member_id,
    m.first_name,
    m.last_name,
    m.college,
    m.year            as graduation_year,
    t.academic_year_start,
    t.academic_year_end,
    sum(mea.points_earned)::int        as total_points,
    count(distinct mea.event_id)::int  as events_attended
from public.members m
join public.member_event_attendance mea on m.id = mea.member_id
join public.events e                    on e.id  = mea.event_id
join public.academic_terms t            on t.id  = e.academic_term_id
group by
    m.id,
    m.first_name,
    m.last_name,
    m.college,
    m.year,
    t.academic_year_start,
    t.academic_year_end;

grant select on public.member_yearly_points to anon, authenticated;

-- ─── house_member_yearly_points ──────────────────────────────────────────────

drop view if exists public.house_member_yearly_points;

create view public.house_member_yearly_points as
select
  hp.house_key                          as house,
  hp.id                                 as house_profile_id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  m.id                                  as member_id,
  m.first_name,
  m.last_name,
  m.college,
  m.year                                as graduation_year,
  t.academic_year_start,
  t.academic_year_end,
  count(*)::int                         as total_points,
  count(*)::int                         as events_attended,
  count(distinct mea.event_id)::int     as unique_events,
  max(e.date)                           as latest_activity_at
from public.member_event_attendance mea
join public.members m
  on m.id = mea.member_id
join public.events e
  on e.id = mea.event_id
join public.academic_terms t
  on t.id = e.academic_term_id
join public.house_memberships hm
  on  hm.member_id            = mea.member_id
  and hm.academic_year_start  = t.academic_year_start
  and e.date::date            >= hm.effective_start_date
  and (hm.effective_end_date is null or e.date::date < hm.effective_end_date)
join public.house_page_assets hp
  on hp.id = hm.house_profile_id
where e.date              is not null
  and e.academic_term_id  is not null
  and hp.is_active        = true
  and mea.points_earned   > 0
  and (t.academic_year_start != 2025 or e.date::date >= '2025-11-08')
group by
  hp.house_key,
  hp.id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  m.id,
  m.first_name,
  m.last_name,
  m.college,
  m.year,
  t.academic_year_start,
  t.academic_year_end;

grant select on public.house_member_yearly_points to anon, authenticated;

-- ─── house_member_all_time_points ────────────────────────────────────────────

drop view if exists public.house_member_all_time_points;

create view public.house_member_all_time_points as
select
  hp.house_key                          as house,
  hp.id                                 as house_profile_id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  m.id                                  as member_id,
  m.first_name,
  m.last_name,
  m.college,
  m.year                                as graduation_year,
  t.academic_year_start,
  t.academic_year_end,
  count(*)::int                         as total_points,
  count(*)::int                         as events_attended,
  count(distinct mea.event_id)::int     as unique_events,
  max(e.date)                           as latest_activity_at
from public.member_event_attendance mea
join public.members m
  on m.id = mea.member_id
join public.events e
  on e.id = mea.event_id
join public.academic_terms t
  on t.id = e.academic_term_id
join public.house_memberships hm
  on  hm.member_id            = mea.member_id
  and hm.academic_year_start  = t.academic_year_start
  and e.date::date            >= hm.effective_start_date
  and (hm.effective_end_date is null or e.date::date < hm.effective_end_date)
join public.house_page_assets hp
  on hp.id = hm.house_profile_id
where e.date              is not null
  and e.academic_term_id  is not null
  and hp.is_active        = true
  and mea.points_earned   > 0
  and (t.academic_year_start != 2025 or e.date::date >= '2025-11-08')
group by
  hp.house_key,
  hp.id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  m.id,
  m.first_name,
  m.last_name,
  m.college,
  m.year,
  t.academic_year_start,
  t.academic_year_end;

grant select on public.house_member_all_time_points to anon, authenticated;

-- ─── members table: column-level REVOKE ──────────────────────────────────────
-- PostgREST respects column-level privileges. With user_id revoked, any
-- select('... user_id ...') or select('*') from the members table returns
-- a permission error for that column.

revoke select (user_id) on public.members from anon;
revoke select (user_id) on public.members from authenticated;
