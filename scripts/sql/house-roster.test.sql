-- Disposable fixture for 20261028075801_admin_house_roster.sql (data shared with the overview test). Stub tables
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
create table public.members (id uuid primary key, first_name text, last_name text, email text);
create table public.events (id uuid primary key, name text, date timestamptz, academic_term_id uuid);
create table public.member_event_attendance (member_id uuid, event_id uuid, points_earned integer, unique (member_id, event_id));
create table public.house_page_assets (id uuid primary key, academic_year_start integer, house_key text, display_name text, image_url text, accent_color text, is_active boolean, display_order integer);
create table public.house_memberships (id uuid primary key default gen_random_uuid(), member_id uuid, house_profile_id uuid, academic_year_start integer, effective_start_date date, effective_end_date date);
create table public.house_parents (id uuid primary key default gen_random_uuid(), house_profile_id uuid, member_id uuid);
create table public.house_events (id uuid primary key, academic_year_start integer, event_date date, is_published boolean);
create table public.house_event_houses (house_event_id uuid, house_page_asset_id uuid);
create view public.house_yearly_points as
 SELECT hp.house_key AS house, hp.id AS house_profile_id, hp.display_name, t.academic_year_start, (sum(mea.points_earned))::integer AS total_points,
        (count(DISTINCT mea.member_id))::integer AS unique_members, max(e.date) AS latest_activity_at
 FROM member_event_attendance mea JOIN events e ON e.id = mea.event_id JOIN academic_terms t ON t.id = e.academic_term_id
 JOIN house_memberships hm ON hm.member_id = mea.member_id AND hm.academic_year_start = t.academic_year_start AND (e.date)::date >= hm.effective_start_date AND (hm.effective_end_date IS NULL OR (e.date)::date < hm.effective_end_date)
 JOIN house_page_assets hp ON hp.id = hm.house_profile_id
 WHERE e.date IS NOT NULL AND e.academic_term_id IS NOT NULL AND hp.is_active = true AND mea.points_earned > 0 AND (t.academic_year_start <> 2025 OR (e.date)::date >= '2025-11-08'::date)
 GROUP BY hp.house_key, hp.id, hp.display_name, t.academic_year_start;

set client_min_messages = warning;
\ir ../../supabase/migrations/20261028075801_admin_house_roster.sql
\ir ../../supabase/migrations/20261028210000_admin_house_member_attendance_overlap.sql
\ir ../../supabase/migrations/20261028220000_admin_house_roster_weighted_points.sql
set client_min_messages = notice;
insert into public.members select ('30000000-0000-0000-0000-00000000000'||x)::uuid, 'Fictional', upper(x), x||'@example.invalid' from unnest(array['a','b','c','d','e','f']) x;

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
insert into public.events (id, date, academic_term_id) values
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
select pg_temp.expect($$select public.admin_house_roster('20000000-0000-0000-0000-000000000002')$$, '42501', 'anon cannot read a House roster');
select pg_temp.expect($$select public.admin_house_member_attendance('30000000-0000-0000-0000-00000000000b', 2026)$$, '42501', 'anon cannot read member attendance');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select pg_temp.expect($$select public.admin_house_roster('20000000-0000-0000-0000-000000000002')$$, '42501', 'a signed-in non-admin cannot read a roster');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select pg_temp.expect($$select public.admin_house_roster(gen_random_uuid())$$, 'P0002', 'an unknown House is refused');
select pg_temp.expect($$select public.admin_house_roster('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000025')$$, '22023', 'a term from another year is refused');

create function pg_temp.m(house text, term uuid, letter text, field text) returns text language sql as $$
 select x->>field from jsonb_array_elements(public.admin_house_roster(house::uuid, term)->'members') x
 where x->>'member_id' = '30000000-0000-0000-0000-' || lpad(letter, 12, '0') $$;

do $$ declare r jsonb := public.admin_house_roster('20000000-0000-0000-0000-000000000002'); begin
 if jsonb_array_length(r->'members') <> 2 then raise exception 'FAIL: Rarity year roster %', r; end if;
 if r::text like '%example.invalid%' then raise exception 'FAIL: the roster exposes email addresses'; end if;
 if pg_temp.m('20000000-0000-0000-0000-000000000002', null, 'b', 'credited_attendance') <> '1'
   or pg_temp.m('20000000-0000-0000-0000-000000000002', null, 'b', 'events_attended') <> '2' then
  raise exception 'FAIL: B should have 1 House credit (after joining) and 2 VSA events';
 end if;
 raise notice 'PASS: attendance before the House start is never House-credited, and all VSA attendance is shown separately; no emails.';
 if pg_temp.m('20000000-0000-0000-0000-000000000001', null, 'c', 'other_house_memberships') <> '1'
   or pg_temp.m('20000000-0000-0000-0000-000000000001', null, 'c', 'end_date') <> '2026-11-01'
   or pg_temp.m('20000000-0000-0000-0000-000000000001', null, 'c', 'credited_attendance') <> '1'
   or pg_temp.m('20000000-0000-0000-0000-000000000003', null, 'c', 'credited_attendance') <> '1' then
  raise exception 'FAIL: a transfer should show on both rosters with each House''s own credits';
 end if;
 raise notice 'PASS: a transferred member appears once per House, flagged, with each House''s own credits.';
 if pg_temp.m('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'f', 'member_id') is not null
   or pg_temp.m('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'b', 'joined_in_period') <> 'true' then
  raise exception 'FAIL: fall roster scope';
 end if;
 raise notice 'PASS: a term roster holds only memberships overlapping the term, and marks who joined during it.';
end $$;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$ declare total int; v int; h uuid; begin
 for h in select id from public.house_page_assets where academic_year_start = 2026 and is_active loop
  select coalesce(sum((x->>'credited_points')::int), 0) into total from jsonb_array_elements(public.admin_house_roster(h)->'members') x;
  select coalesce((select total_points from public.house_yearly_points where house_profile_id = h), 0) into v;
  if total <> v then raise exception 'FAIL: roster credits % <> view % for %', total, v, h; end if;
 end loop;
 raise notice 'PASS: each House''s roster credits add up to house_yearly_points.';
end $$;

-- A weighted two-point event still counts as one attendance, but two points.
do $$ begin
 if pg_temp.m('20000000-0000-0000-0000-000000000001', null, 'a', 'credited_attendance') <> '2'
    or pg_temp.m('20000000-0000-0000-0000-000000000001', null, 'a', 'credited_points') <> '3' then
   raise exception 'FAIL: weighted event credits must be separate from attendance count';
 end if;
 raise notice 'PASS: attendance and weighted House points are distinct values.';
end $$;

create function pg_temp.why(letter text, event_n text) returns text language sql as $$
 select x->>'reason' from jsonb_array_elements(public.admin_house_member_attendance(('30000000-0000-0000-0000-00000000000'||letter)::uuid, 2026)->'events') x
 where x->>'event_id' = '40000000-0000-0000-0000-00000000000' || event_n $$;
do $$ begin
 if pg_temp.why('b','1') <> 'before_house_start' or pg_temp.why('b','2') <> 'counted' then raise exception 'FAIL: B reasons % %', pg_temp.why('b','1'), pg_temp.why('b','2'); end if;
 if pg_temp.why('e','2') <> 'house_not_public' or pg_temp.why('d','3') <> 'no_points' then raise exception 'FAIL: E/D reasons'; end if;
 if pg_temp.why('c','2') <> 'counted' or pg_temp.why('c','3') <> 'counted' then raise exception 'FAIL: C reasons'; end if;
 if (select x->>'house_name' from jsonb_array_elements(public.admin_house_member_attendance('30000000-0000-0000-0000-00000000000c', 2026)->'events') x where x->>'event_id' = '40000000-0000-0000-0000-000000000003') <> 'Applejack' then
  raise exception 'FAIL: the transferred member''s Nov 10 credit should be Applejack''s';
 end if;
 raise notice 'PASS: the drilldown says which House each event counted for, or why not.';
end $$;

set request.method = 'GET';
select pg_temp.expect($$select public.admin_house_roster('20000000-0000-0000-0000-000000000002')$$, '42501', 'a roster is never served to a GET');
select pg_temp.expect($$select public.admin_house_member_attendance('30000000-0000-0000-0000-00000000000b', 2026)$$, '42501', 'member attendance is never served to a GET');
reset request.method;

reset role;
insert into public.academic_terms values ('10000000-0000-0000-0000-000000000003', 'Spring 2027', 2026, null, null);
insert into public.members values ('30000000-0000-0000-0000-000000000010', 'Fictional', 'Late', 'late@example.invalid');
insert into public.events (id, date, academic_term_id) values ('40000000-0000-0000-0000-000000000009', '2026-12-20 19:00+00', '10000000-0000-0000-0000-000000000001');
insert into public.house_memberships (member_id, house_profile_id, academic_year_start, effective_start_date, effective_end_date)
 values ('30000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000002', 2026, '2026-12-16', null);
insert into public.member_event_attendance values ('30000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000009', 1);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$ begin
 if (public.admin_house_roster('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003')->'window'->>'dated')::boolean is not false then
  raise exception 'FAIL: an undated term must be flagged';
 end if;
 if pg_temp.m('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '10', 'credited_attendance') is distinct from '1' then
  raise exception 'FAIL: a member credited on a Fall event dated after the term must be on the Fall roster';
 end if;
 raise notice 'PASS: an undated term is flagged, and anyone credited in the period is on the roster.';
end $$;

-- Left and came back: Twilight Sep 20 - Oct 1, Rarity Oct 1 - Jan 10, Twilight from Jan 10.
reset role;
insert into public.members values ('30000000-0000-0000-0000-000000000011', 'Fictional', 'Return', 'r@example.invalid');
insert into public.house_memberships (member_id, house_profile_id, academic_year_start, effective_start_date, effective_end_date) values
 ('30000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000001', 2026, '2026-09-20', '2026-10-01'),
 ('30000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000002', 2026, '2026-10-01', '2027-01-10'),
 ('30000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000001', 2026, '2027-01-10', null);
-- A dated event with no term in the year: the roster's VSA count and the drilldown agree.
insert into public.events (id, date, academic_term_id) values ('40000000-0000-0000-0000-000000000012', '2026-11-20 19:00+00', null);
insert into public.member_event_attendance values ('30000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000012', 1);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$ begin
 if pg_temp.m('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '11', 'start_date') <> '2027-01-10'
   or pg_temp.m('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '11', 'joined_in_period') <> 'true'
   or pg_temp.m('20000000-0000-0000-0000-000000000001', null, '11', 'stints') <> '2' then
  raise exception 'FAIL: the winter Twilight roster should show the Jan 10 return as a new stint';
 end if;
 if pg_temp.m('20000000-0000-0000-0000-000000000001', null, '11', 'events_attended')::int
    <> jsonb_array_length(public.admin_house_member_attendance('30000000-0000-0000-0000-000000000011', 2026)->'events') then
  raise exception 'FAIL: the roster VSA count and the drilldown disagree';
 end if;
 raise notice 'PASS: a member who left and came back shows the stint in the period, and the VSA count matches the drilldown.';
end $$;

-- An accidental overlapping House assignment must never be silently
-- attributed only to whichever House sorts first in the drilldown.
reset role;
insert into public.members values ('30000000-0000-0000-0000-000000000013', 'Fictional', 'Overlap', 'overlap@example.invalid');
insert into public.house_memberships (member_id, house_profile_id, academic_year_start, effective_start_date, effective_end_date) values
 ('30000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000001', 2026, '2026-09-20', null),
 ('30000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000002', 2026, '2026-09-20', null);
insert into public.member_event_attendance values ('30000000-0000-0000-0000-000000000013', '40000000-0000-0000-0000-000000000002', 1);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare e jsonb;
begin
 select x into e from jsonb_array_elements(public.admin_house_member_attendance('30000000-0000-0000-0000-000000000013', 2026)->'events') x
 where x->>'event_id' = '40000000-0000-0000-0000-000000000002';
 if e is null or e->>'reason' <> 'overlapping_houses'
    or e->>'house_name' not like '%Twilight%'
    or e->>'house_name' not like '%Rarity%'
    or e->>'house_profile_id' is not null then
   raise exception 'FAIL: overlapping active Houses must both be shown, without a misleading single House id: %', e;
 end if;
 raise notice 'PASS: overlapping active Houses are visible for follow-up, not silently picked.';
end $$;
