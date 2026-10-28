-- Synthetic fixture for scripts/sql/house-points-reconciliation.sql. The two
-- House views are copied from production (2026-10-28) so the check runs
-- against the real attribution rule. Every person here is fictional.
set timezone = 'UTC';
create table public.academic_terms (id integer primary key, academic_year_start integer, academic_year_end integer);
create table public.events (id integer primary key, date timestamptz, academic_term_id integer, points integer default 1);
create table public.members (id text primary key, first_name text, last_name text, college text, year text);
create table public.house_page_assets (id text primary key, house_key text, display_name text, image_url text, accent_color text,
  is_active boolean, academic_year_start integer, display_order integer);
create table public.house_memberships (id serial primary key, member_id text, house_profile_id text, academic_year_start integer,
  effective_start_date date, effective_end_date date);
create table public.member_event_attendance (id serial primary key, member_id text, event_id integer, points_earned integer default 1);

create view public.house_member_yearly_points as
 select hp.house_key as house, hp.id as house_profile_id, hp.display_name, hp.image_url, hp.accent_color,
   m.id as member_id, m.first_name, m.last_name, m.college, m.year as graduation_year, t.academic_year_start, t.academic_year_end,
   count(*)::integer as total_points, count(*)::integer as events_attended, count(distinct mea.event_id)::integer as unique_events, max(e.date) as latest_activity_at
 from member_event_attendance mea join members m on m.id = mea.member_id join events e on e.id = mea.event_id
 join academic_terms t on t.id = e.academic_term_id
 join house_memberships hm on hm.member_id = mea.member_id and hm.academic_year_start = t.academic_year_start
   and e.date::date >= hm.effective_start_date and (hm.effective_end_date is null or e.date::date < hm.effective_end_date)
 join house_page_assets hp on hp.id = hm.house_profile_id
 where e.date is not null and e.academic_term_id is not null and hp.is_active = true and mea.points_earned > 0
   and (t.academic_year_start <> 2025 or e.date::date >= '2025-11-08'::date)
 group by hp.house_key, hp.id, hp.display_name, hp.image_url, hp.accent_color, m.id, m.first_name, m.last_name, m.college, m.year, t.academic_year_start, t.academic_year_end;

create view public.house_yearly_points as
 select hp.house_key as house, hp.id as house_profile_id, hp.display_name, hp.image_url, hp.accent_color, t.academic_year_start, t.academic_year_end,
   count(*)::integer as total_points, count(*)::integer as events_attended, count(distinct mea.event_id)::integer as unique_events,
   count(distinct mea.member_id)::integer as unique_members,
   round(count(*)::numeric / nullif(count(distinct mea.member_id), 0)::numeric, 2) as average_points_per_member, max(e.date) as latest_activity_at
 from member_event_attendance mea join events e on e.id = mea.event_id join academic_terms t on t.id = e.academic_term_id
 join house_memberships hm on hm.member_id = mea.member_id and hm.academic_year_start = t.academic_year_start
   and e.date::date >= hm.effective_start_date and (hm.effective_end_date is null or e.date::date < hm.effective_end_date)
 join house_page_assets hp on hp.id = hm.house_profile_id
 where e.date is not null and e.academic_term_id is not null and hp.is_active = true and mea.points_earned > 0
   and (t.academic_year_start <> 2025 or e.date::date >= '2025-11-08'::date)
 group by hp.house_key, hp.id, hp.display_name, hp.image_url, hp.accent_color, t.academic_year_start, t.academic_year_end;

insert into academic_terms values (1, 2026, 2027);
insert into house_page_assets values
 ('h1', 'twilight', 'Twilight Sparkle', null, null, true, 2026, 0),
 ('h2', 'applejack', 'Applejack', null, null, true, 2026, 1),
 ('h3', 'retired', 'Retired House', null, null, false, 2026, 2);
-- E1: 6 PM Pacific Oct 20 = Oct 21 01:00 UTC (crosses a member's Oct 21 start).
insert into events values (1, '2026-10-21 01:00:00+00', 1), (2, '2026-11-05 19:00:00+00', 1), (3, '2026-11-20 19:00:00+00', 1), (4, '2026-10-01 19:00:00+00', null);
insert into members (id, first_name) values ('a', 'Fictional A'), ('b', 'Fictional B'), ('c', 'Fictional C'), ('d', 'Fictional D'), ('e', 'Fictional E');
insert into house_memberships (member_id, house_profile_id, academic_year_start, effective_start_date, effective_end_date) values
 ('a', 'h1', 2026, '2026-10-21', null),
 ('c', 'h1', 2026, '2026-11-10', '2026-11-15'),
 ('c', 'h2', 2026, '2026-11-15', null),
 ('d', 'h3', 2026, '2026-10-01', null);
insert into member_event_attendance (member_id, event_id) values
 ('a', 1), ('a', 2),   -- both earn Twilight; E1 is a Pacific/UTC boundary credit
 ('b', 2),             -- no House this year
 ('c', 2), ('c', 3),   -- E2 before House start (individual points only); E3 earns Applejack after a transfer
 ('d', 2),             -- inactive House profile
 ('e', 4);             -- event without a term
