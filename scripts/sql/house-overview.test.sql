-- Disposable fixture for 20261028075724_admin_house_overview.sql. Stub tables
-- carry only the columns read; house_yearly_points is the production view
-- definition, so the window credits can be checked against it. Synthetic people.
\pset tuples_only on
create role anon;
create role authenticated;
create schema auth;
grant usage on schema public, auth to anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function public.is_admin_user(p_id uuid default auth.uid()) returns boolean language sql stable as $$ select coalesce(p_id = '00000000-0000-0000-0000-000000000001', false) $$;

create table public.academic_terms (id uuid primary key, label text, academic_year_start integer, starts_on date, ends_on date);
create table public.events (id uuid primary key, date timestamptz, academic_term_id uuid);
create table public.member_event_attendance (member_id uuid, event_id uuid, points_earned integer, unique (member_id, event_id));
create table public.house_page_assets (id uuid primary key, academic_year_start integer, house_key text, display_name text, image_url text, accent_color text, is_active boolean, display_order integer);
create table public.house_memberships (id uuid primary key default gen_random_uuid(), member_id uuid, house_profile_id uuid, academic_year_start integer, effective_start_date date, effective_end_date date);
create table public.house_parents (id uuid primary key default gen_random_uuid(), house_profile_id uuid, member_id uuid);
create table public.house_events (id uuid primary key, academic_year_start integer, event_date date, is_published boolean);
create table public.house_event_houses (house_event_id uuid, house_page_asset_id uuid);
create view public.house_yearly_points as
 SELECT hp.house_key AS house, hp.id AS house_profile_id, hp.display_name, t.academic_year_start, (count(*))::integer AS total_points,
        (count(DISTINCT mea.member_id))::integer AS unique_members, max(e.date) AS latest_activity_at
 FROM member_event_attendance mea JOIN events e ON e.id = mea.event_id JOIN academic_terms t ON t.id = e.academic_term_id
 JOIN house_memberships hm ON hm.member_id = mea.member_id AND hm.academic_year_start = t.academic_year_start AND (e.date)::date >= hm.effective_start_date AND (hm.effective_end_date IS NULL OR (e.date)::date < hm.effective_end_date)
 JOIN house_page_assets hp ON hp.id = hm.house_profile_id
 WHERE e.date IS NOT NULL AND e.academic_term_id IS NOT NULL AND hp.is_active = true AND mea.points_earned > 0 AND (t.academic_year_start <> 2025 OR (e.date)::date >= '2025-11-08'::date)
 GROUP BY hp.house_key, hp.id, hp.display_name, t.academic_year_start;

set client_min_messages = warning;
\ir ../../supabase/migrations/20261028075724_admin_house_overview.sql
\ir ../../supabase/migrations/20261029015642_admin_house_overview_weighted_reconciliation.sql
\ir ../../supabase/migrations/20261029080000_house_reconciliation_count_not_sum.sql
set client_min_messages = notice;

-- Two terms of 2026-27, one of 2025-26.
insert into public.academic_terms values
 ('10000000-0000-0000-0000-000000000001', 'Fall 2026', 2026, '2026-09-20', '2026-12-15'),
 ('10000000-0000-0000-0000-000000000002', 'Winter 2027', 2026, '2027-01-05', '2027-03-20'),
 ('10000000-0000-0000-0000-000000000025', 'Fall 2025', 2025, '2025-09-20', '2025-12-15');
insert into public.house_page_assets values
 ('20000000-0000-0000-0000-000000000001', 2026, 'twilight', 'Twilight Sparkle', null, null, true, 1),
 ('20000000-0000-0000-0000-000000000002', 2026, 'rarity', 'Rarity', null, null, true, 2),
 ('20000000-0000-0000-0000-000000000003', 2026, 'applejack', 'Applejack', null, null, true, 3),
 ('20000000-0000-0000-0000-000000000004', 2026, 'pinkie', 'Pinkie Pie', null, null, false, 4);
-- A: Twilight all year. B: Rarity, joins mid-fall (Oct 15). C: Twilight then transfers to Applejack Nov 1.
-- D: Applejack all year, never attends. E: inactive Pinkie Pie profile.
insert into public.house_memberships (member_id, house_profile_id, academic_year_start, effective_start_date, effective_end_date) values
 ('30000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001', 2026, '2026-09-20', null),
 ('30000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-000000000002', 2026, '2026-10-15', null),
 ('30000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-000000000001', 2026, '2026-09-20', '2026-11-01'),
 ('30000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-000000000003', 2026, '2026-11-01', null),
 ('30000000-0000-0000-0000-00000000000d', '20000000-0000-0000-0000-000000000003', 2026, '2026-09-20', null),
 ('30000000-0000-0000-0000-00000000000e', '20000000-0000-0000-0000-000000000004', 2026, '2026-09-20', null),
 -- joins in winter only: in the winter roster, not in fall's.
 ('30000000-0000-0000-0000-00000000000f', '20000000-0000-0000-0000-000000000002', 2026, '2027-01-10', null);
insert into public.events values
 ('40000000-0000-0000-0000-000000000001', '2026-10-01 19:00+00', '10000000-0000-0000-0000-000000000001'),
 ('40000000-0000-0000-0000-000000000002', '2026-10-20 19:00+00', '10000000-0000-0000-0000-000000000001'),
 ('40000000-0000-0000-0000-000000000003', '2026-11-10 19:00+00', '10000000-0000-0000-0000-000000000001'),
 ('40000000-0000-0000-0000-000000000004', '2027-01-20 19:00+00', '10000000-0000-0000-0000-000000000002');
insert into public.member_event_attendance values
 ('30000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-000000000001', 2),
 ('30000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-000000000002', 1),
 -- B attends before joining (Oct 1) and after (Oct 20): only Oct 20 counts for Rarity.
 ('30000000-0000-0000-0000-00000000000b', '40000000-0000-0000-0000-000000000001', 1),
 ('30000000-0000-0000-0000-00000000000b', '40000000-0000-0000-0000-000000000002', 1),
 -- C: Oct 20 for Twilight, Nov 10 for Applejack.
 ('30000000-0000-0000-0000-00000000000c', '40000000-0000-0000-0000-000000000002', 1),
 ('30000000-0000-0000-0000-00000000000c', '40000000-0000-0000-0000-000000000003', 1),
 ('30000000-0000-0000-0000-00000000000e', '40000000-0000-0000-0000-000000000002', 1),
 ('30000000-0000-0000-0000-00000000000f', '40000000-0000-0000-0000-000000000004', 1),
 -- zero-point credit never counts
 ('30000000-0000-0000-0000-00000000000d', '40000000-0000-0000-0000-000000000003', 0);
insert into public.house_parents (house_profile_id, member_id) values
 ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-0000000000aa'),
 ('20000000-0000-0000-0000-000000000001', null),
 ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-0000000000bb');
insert into public.house_events values
 ('50000000-0000-0000-0000-000000000001', 2026, '2026-10-25', true),
 ('50000000-0000-0000-0000-000000000002', 2026, '2026-10-26', false),
 ('50000000-0000-0000-0000-000000000003', 2026, '2027-02-01', true);
insert into public.house_event_houses values
 ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
 ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002'),
 ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001'),
 ('50000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003');

grant select on all tables in schema public to authenticated;
create function pg_temp.expect(statement text, state text, label text) returns void language plpgsql as $$
declare got text; msg text;
begin
 begin execute statement; exception when others then got := sqlstate; msg := sqlerrm; end;
 if got is distinct from state then raise exception 'FAIL (%): expected %, got % %', label, state, got, msg; end if;
 raise notice 'PASS: %', label;
end $$;
grant execute on function pg_temp.expect(text, text, text) to anon, authenticated;

set role anon;
select pg_temp.expect($$select public.admin_house_overview(2026)$$, '42501', 'anon cannot read the House overview');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select pg_temp.expect($$select public.admin_house_overview(2026)$$, '42501', 'a signed-in non-admin cannot read it');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select pg_temp.expect($$select public.admin_house_overview(2026, '10000000-0000-0000-0000-000000000025')$$, '22023', 'a term from another year is refused');
set request.method = 'GET';
select pg_temp.expect($$select public.admin_house_overview(2026)$$, '42501', 'private standings are never served to a GET');
reset request.method;

create temp table yr as select h from jsonb_array_elements(public.admin_house_overview(2026)->'houses') h;
create temp table fall as select h from jsonb_array_elements(public.admin_house_overview(2026, '10000000-0000-0000-0000-000000000001')->'houses') h;
create function pg_temp.f(tbl text, house text, field text) returns text language plpgsql as $$
declare v text; begin execute format('select h->>%L from %I where h->>''house_key'' = %L', field, tbl, house) into v; return v; end $$;

do $$ begin
 -- Whole year. Twilight: A (2 attendance credits; first worth 2 points) + C (Oct 20) = 3 attendances / 4 points, 2 members. Rarity: B Oct 20 + F Jan 20 = 2.
 -- Applejack: C Nov 10 = 1. Pinkie Pie inactive: never credited.
 if pg_temp.f('yr','twilight','credited_attendance') <> '3' or pg_temp.f('yr','twilight','participating_members') <> '2' then raise exception 'FAIL: Twilight year %', (select h from yr where h->>'house_key'='twilight'); end if;
 if pg_temp.f('yr','rarity','credited_attendance') <> '2' then raise exception 'FAIL: Rarity counted attendance before the member joined'; end if;
 if pg_temp.f('yr','applejack','credited_attendance') <> '1' or pg_temp.f('yr','applejack','roster_members') <> '2' or pg_temp.f('yr','applejack','participating_members') <> '1' then raise exception 'FAIL: Applejack %', (select h from yr where h->>'house_key'='applejack'); end if;
 if pg_temp.f('yr','pinkie','credited_attendance') <> '0' or pg_temp.f('yr','pinkie','rank') is not null or pg_temp.f('yr','pinkie','is_active') <> 'false' then raise exception 'FAIL: inactive profile credited or ranked'; end if;
 raise notice 'PASS: credits follow effective membership (mid-quarter joins and transfers) and skip inactive profiles.';
 if exists (select 1 from yr where h->>'is_active' = 'true' and (h->>'matches_view')::boolean is not true) then raise exception 'FAIL: window credits differ from house_yearly_points'; end if;
 -- One House point per check-in: Twilight has a 2-point event but still totals 3 credits.
 if pg_temp.f('yr','twilight','year_total_points') <> '3' or pg_temp.f('yr','twilight','year_total_points') <> pg_temp.f('yr','twilight','credited_attendance') or pg_temp.f('yr','twilight','rank') <> '1' or pg_temp.f('yr','rarity','rank') <> '2' or pg_temp.f('yr','applejack','rank') <> '3' then raise exception 'FAIL: standings/rank'; end if;
 raise notice 'PASS: the year totals and ranks come from house_yearly_points and match the window credits.';
 if pg_temp.f('yr','twilight','parents_listed') <> '2' or pg_temp.f('yr','twilight','parents_linked') <> '1' then raise exception 'FAIL: parents'; end if;
 if pg_temp.f('yr','twilight','hosted_events') <> '1' or pg_temp.f('yr','rarity','hosted_events') <> '1' or pg_temp.f('yr','applejack','hosted_events') <> '1' then raise exception 'FAIL: hosted events (draft must not count)'; end if;
 if (public.admin_house_overview(2026)->>'distinct_house_events')::int <> 2 then raise exception 'FAIL: a collab counted twice globally'; end if;
 raise notice 'PASS: a collab counts once per host and once globally; drafts never count; parents linked vs listed.';
end $$;

do $$ begin
 -- Fall only: F (joins Jan) is not on Rarity's fall roster; B joined inside fall.
 if pg_temp.f('fall','rarity','roster_members') <> '1' or pg_temp.f('fall','rarity','joined_in_window') <> '1' or pg_temp.f('fall','rarity','credited_attendance') <> '1' then raise exception 'FAIL: Rarity fall %', (select h from fall where h->>'house_key'='rarity'); end if;
 if pg_temp.f('fall','twilight','roster_members') <> '2' then raise exception 'FAIL: a member who left mid-term must stay on that term''s roster'; end if;
 if pg_temp.f('fall','twilight','joined_in_window') <> '0' then raise exception 'FAIL: members assigned on the term''s first day are not new joiners'; end if;
 if pg_temp.f('fall','applejack','hosted_events') <> '0' or pg_temp.f('fall','twilight','matches_view') is not null then raise exception 'FAIL: fall window events or matches_view'; end if;
 raise notice 'PASS: a term window scopes rosters, joins, credits and House events.';
end $$;

-- Two Houses tied on points share a rank.
reset role;
insert into public.member_event_attendance values ('30000000-0000-0000-0000-00000000000d', '40000000-0000-0000-0000-000000000004', 1);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$ declare h jsonb := public.admin_house_overview(2026)->'houses'; begin
 if (select array_agg(x->>'rank' order by x->>'house_key') from jsonb_array_elements(h) x where x->>'house_key' in ('applejack','rarity')) <> array['2','2'] then
  raise exception 'FAIL: tied Houses should share a rank: %', h;
 end if;
 raise notice 'PASS: tied Houses share a rank (no winner inferred from a tie).';
end $$;

-- A term without dates says so; an event dated after its term keeps
-- participation at or under 100%.
reset role;
insert into public.academic_terms values ('10000000-0000-0000-0000-000000000003', 'Spring 2027', 2026, null, null);
insert into public.events values ('40000000-0000-0000-0000-000000000009', '2026-12-20 19:00+00', '10000000-0000-0000-0000-000000000001');
insert into public.house_memberships (member_id, house_profile_id, academic_year_start, effective_start_date, effective_end_date)
 values ('30000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000002', 2026, '2026-12-16', null);
insert into public.member_event_attendance values ('30000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000009', 1);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare o jsonb := public.admin_house_overview(2026, '10000000-0000-0000-0000-000000000003'); h jsonb;
begin
 if (o->'window'->>'dated')::boolean is not false then raise exception 'FAIL: an undated term must be flagged %', o->'window'; end if;
 if (public.admin_house_overview(2026)->'window'->>'dated')::boolean is not true then raise exception 'FAIL: the whole year is dated'; end if;
 select x into h from jsonb_array_elements(public.admin_house_overview(2026, '10000000-0000-0000-0000-000000000001')->'houses') x where x->>'house_key' = 'rarity';
 if (h->>'participating_members')::int > (h->>'roster_members')::int then raise exception 'FAIL: participation above 100%%: %', h; end if;
 raise notice 'PASS: an undated term is flagged, and credited members always count in the roster (never over 100%%).';
end $$;
