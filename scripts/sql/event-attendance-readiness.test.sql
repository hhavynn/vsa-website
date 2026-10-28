-- Disposable fixture for 20261028090000_admin_event_attendance_readiness.sql.
-- Stub tables carry only the columns the functions read; house_yearly_points
-- is the production view definition, so the per-event House credits can be
-- checked against it. Synthetic people only.
\pset tuples_only on
create role anon;
create role authenticated;
create schema auth;
grant usage on schema public, auth to anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function public.is_admin_user(p_id uuid default auth.uid()) returns boolean language sql stable as $$ select coalesce(p_id = '00000000-0000-0000-0000-000000000001', false) $$;

create table public.academic_terms (id uuid primary key, label text, academic_year_start integer, academic_year_end integer);
create table public.events (id uuid primary key, name text, date timestamptz, event_type text, points integer, is_published boolean, academic_term_id uuid references public.academic_terms(id));
create table public.members (id uuid primary key, first_name text, email text);
create table public.member_event_attendance (id uuid primary key default gen_random_uuid(), member_id uuid, event_id uuid, points_earned integer, imported_at timestamptz default now(), unique (member_id, event_id));
create table public.house_page_assets (id uuid primary key, house_key text, display_name text, image_url text, accent_color text, is_active boolean);
create table public.house_memberships (member_id uuid, house_profile_id uuid, academic_year_start integer, effective_start_date date, effective_end_date date);
create table public.import_jobs (id uuid primary key, event_id uuid, status text, created_at timestamptz, completed_at timestamptz, total_rows integer, review_rows integer, error_count integer);
create table public.import_job_rows (id uuid primary key, import_job_id uuid, event_id uuid, decision text, attendance_member_id uuid, matched_member_id uuid, csv_email text, match_details jsonb);
create table public.import_recovery_actions (id uuid primary key, import_job_row_id uuid, previous_action_id uuid, resulting_status text);
create table public.attendance_reconciliation_log (id uuid primary key default gen_random_uuid(), run_id text not null, event_id uuid, source_row integer, outcome text default 'already_credited', created_at timestamptz default now());

create view public.house_yearly_points as
 SELECT hp.house_key AS house, hp.id AS house_profile_id, hp.display_name, t.academic_year_start, (count(*))::integer AS total_points
 FROM member_event_attendance mea JOIN events e ON e.id = mea.event_id JOIN academic_terms t ON t.id = e.academic_term_id
 JOIN house_memberships hm ON hm.member_id = mea.member_id AND hm.academic_year_start = t.academic_year_start AND (e.date)::date >= hm.effective_start_date AND (hm.effective_end_date IS NULL OR (e.date)::date < hm.effective_end_date)
 JOIN house_page_assets hp ON hp.id = hm.house_profile_id
 WHERE e.date IS NOT NULL AND e.academic_term_id IS NOT NULL AND hp.is_active = true AND mea.points_earned > 0 AND (t.academic_year_start <> 2025 OR (e.date)::date >= '2025-11-08'::date)
 GROUP BY hp.house_key, hp.id, hp.display_name, t.academic_year_start;

set client_min_messages = warning;
\ir ../../supabase/migrations/20261028090000_admin_event_attendance_readiness.sql
\ir ../../supabase/migrations/20261028120000_attendance_readiness_resolved_reconciliation.sql
set client_min_messages = notice;

insert into public.academic_terms values
 ('10000000-0000-0000-0000-000000000026', 'Fall 2026', 2026, 2027),
 ('10000000-0000-0000-0000-000000000027', 'Winter 2027', 2026, 2027),
 ('10000000-0000-0000-0000-000000000025', 'Fall 2025', 2025, 2026);
insert into public.house_page_assets values
 ('20000000-0000-0000-0000-000000000001', 'twilight', 'Twilight Sparkle', null, null, true),
 ('20000000-0000-0000-0000-000000000002', 'rarity', 'Rarity', null, null, true),
 ('20000000-0000-0000-0000-000000000003', 'applejack', 'Applejack', null, null, false);
insert into public.members values
 ('30000000-0000-0000-0000-000000000001', 'Fictional A', 'a@example.invalid'), ('30000000-0000-0000-0000-000000000002', 'Fictional B', 'b@example.invalid'),
 ('30000000-0000-0000-0000-000000000003', 'Fictional C', null), ('30000000-0000-0000-0000-000000000004', 'Fictional D', 'd@example.invalid');
insert into public.house_memberships values
 ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 2026, '2026-10-01', null),
 -- joins mid-quarter: E1 (Oct 10) is before her start and must not count for Rarity.
 ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 2026, '2026-10-15', null),
 -- inactive (unrevealed) profile: never counted.
 ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 2026, '2026-10-01', null);

insert into public.events values
 ('40000000-0000-0000-0000-000000000001', 'E1 imported', '2026-10-10 19:00+00', 'gbm', 1, true, '10000000-0000-0000-0000-000000000026'),
 ('40000000-0000-0000-0000-000000000002', 'E2 review', '2026-10-20 19:00+00', 'gbm', 1, true, '10000000-0000-0000-0000-000000000026'),
 ('40000000-0000-0000-0000-000000000003', 'E3 legacy', '2026-10-05 19:00+00', 'mixer', 1, true, '10000000-0000-0000-0000-000000000026'),
 ('40000000-0000-0000-0000-000000000004', 'E4 pending', '2026-10-22 19:00+00', 'gbm', 1, true, '10000000-0000-0000-0000-000000000026'),
 ('40000000-0000-0000-0000-000000000005', 'E5 future', '2099-01-10 19:00+00', 'gbm', 1, true, '10000000-0000-0000-0000-000000000027'),
 ('40000000-0000-0000-0000-000000000006', 'E6 failed', '2026-10-23 19:00+00', 'gbm', 1, true, '10000000-0000-0000-0000-000000000026'),
 ('40000000-0000-0000-0000-000000000007', 'E7 reconciled', '2026-10-24 19:00+00', 'gbm', 1, true, '10000000-0000-0000-0000-000000000026'),
 ('40000000-0000-0000-0000-000000000008', 'E8 no sign-in', '2026-10-25 19:00+00', 'other', 0, true, '10000000-0000-0000-0000-000000000026'),
 ('40000000-0000-0000-0000-000000000009', 'E9 last year', '2025-11-20 19:00+00', 'gbm', 1, true, '10000000-0000-0000-0000-000000000025'),
 ('40000000-0000-0000-0000-000000000010', 'E10 re-imported', '2026-10-26 19:00+00', 'gbm', 1, true, '10000000-0000-0000-0000-000000000026'),
 ('40000000-0000-0000-0000-000000000011', 'E11 reconciling', '2026-10-27 19:00+00', 'gbm', 1, true, '10000000-0000-0000-0000-000000000026');

insert into public.member_event_attendance (member_id, event_id, points_earned) values
 ('30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 1),
 ('30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 1),
 ('30000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000001', 1),
 ('30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 1),
 ('30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 1),
 ('30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', 1),
 ('30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 1),
 ('30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000007', 1),
 ('30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000007', 0),
 ('30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000009', 1);

insert into public.import_jobs values
 ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'completed', '2026-10-11', '2026-10-11', 3, 0, 0),
 ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'completed', '2026-10-21', '2026-10-21', 6, 3, 0),
 ('50000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000006', 'failed', '2026-10-24', null, 0, 0, 1),
 ('50000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000007', 'completed', '2026-10-25', '2026-10-25', 2, 0, 0),
 ('50000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000010', 'failed', '2026-10-27 01:00', null, 5, 5, 1),
 ('50000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000010', 'completed', '2026-10-27 02:00', '2026-10-27 02:05', 5, 0, 0);
insert into public.import_job_rows values
 -- open: no action yet, nobody with that identity credited
 ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'review', null, null, 'nobody@example.invalid', '{}'),
 -- resolved: recovered
 ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'review', null, null, null, '{}'),
 -- reopened then dismissed: the latest action (dismissed) wins
 ('60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'review', null, null, null, '{}'),
 -- investigating a wrong match: the row is credited (member set) and still open
 ('60000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'matched', '30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', null, '{}'),
 -- matched rows are never open
 ('60000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'matched', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', null, '{}'),
 -- recorded elsewhere: a member with the same email already has this event
 ('60000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'review', null, null, ' B@Example.invalid ', '{}'),
 -- recorded elsewhere: the matched member has the attendance
 ('60000000-0000-0000-0000-000000000007', '50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'review', null, '30000000-0000-0000-0000-000000000001', null, '{}'),
 -- skipped by the admin, and an invalid row: not actionable
 ('60000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'review', null, null, null, '{"final_reason":"skipped_by_admin"}'),
 ('60000000-0000-0000-0000-000000000009', '50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'review', null, null, null, '{"manual_decision":{"kind":"skip"}}'),
 -- a failed import's rows: the clean re-import supersedes them
 ('60000000-0000-0000-0000-000000000010', '50000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000010', 'review', null, null, 'gone@example.invalid', '{}'),
 ('60000000-0000-0000-0000-000000000011', '50000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000010', 'review', null, null, null, '{}');
insert into public.import_recovery_actions values
 ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', null, 'recovered'),
 ('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000003', null, 'investigating'),
 ('70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000002', 'dismissed'),
 ('70000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000004', null, 'investigating');
insert into public.attendance_reconciliation_log (run_id, event_id, created_at)
values ('run-e7', '40000000-0000-0000-0000-000000000007', '2026-10-26');
insert into public.attendance_reconciliation_log (run_id, event_id, source_row, outcome, created_at) values
 ('run-e11-a', '40000000-0000-0000-0000-000000000011', 1, 'credit_inserted', '2026-10-28'),
 ('run-e11-a', '40000000-0000-0000-0000-000000000011', 2, 'pending_review', '2026-10-28'),
 -- row 3 was pending then resolved within the same source run.
 ('run-e11-a', '40000000-0000-0000-0000-000000000011', 3, 'pending_review', '2026-10-28'),
 ('run-e11-a', '40000000-0000-0000-0000-000000000011', 3, 'resolved_by_admin', '2026-10-28 01:00'),
 -- row 4 in a later, independently ordered sheet belongs to a different person.
 ('run-e11-a', '40000000-0000-0000-0000-000000000011', 4, 'pending_review', '2026-10-28'),
 ('run-e11-b', '40000000-0000-0000-0000-000000000011', 4, 'already_credited', '2026-10-28 02:00'),
 -- NULL source rows are event-level actions and must not clear open identities.
 ('run-e11-a', '40000000-0000-0000-0000-000000000011', null, 'pending_review', '2026-10-28'),
 ('run-e11-a', '40000000-0000-0000-0000-000000000011', null, 'credit_removed', '2026-10-28 03:00');

grant select on all tables in schema public to authenticated;
revoke all on public.event_attendance_attestations from authenticated;

create function pg_temp.expect(statement text, state text, label text) returns void language plpgsql as $$
declare got text; msg text;
begin
 begin execute statement; exception when others then got := sqlstate; msg := sqlerrm; end;
 if got is distinct from state then raise exception 'FAIL (%): expected %, got % %', label, state, got, msg; end if;
 raise notice 'PASS: %', label;
end $$;
grant execute on function pg_temp.expect(text, text, text) to anon, authenticated;

set role anon;
select pg_temp.expect($$select public.admin_event_attendance_readiness(2026)$$, '42501', 'anon cannot read attendance status');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select pg_temp.expect($$select public.admin_event_attendance_readiness(2026)$$, '42501', 'a signed-in non-admin cannot read attendance status');
select pg_temp.expect($$select public.admin_attest_event_attendance('40000000-0000-0000-0000-000000000004', 'no_signin')$$, '42501', 'a non-admin cannot record attendance status');
select pg_temp.expect($$select * from public.event_attendance_attestations$$, '42501', 'the attestation log is not readable through the API');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select pg_temp.expect($$select * from public.event_attendance_attestations$$, '42501', 'not even by an admin, except through the functions');
select pg_temp.expect($$select public.admin_attest_event_attendance('40000000-0000-0000-0000-000000000001', 'no_signin')$$, '23514', 'an event with credits cannot be marked as having no sign-in');
select pg_temp.expect($$select public.admin_attest_event_attendance('40000000-0000-0000-0000-000000000004', 'done')$$, '22023', 'unknown statuses are refused');
select pg_temp.expect($$select public.admin_event_attendance_readiness(null)$$, '22023', 'a year is required');

do $$ begin
 perform public.admin_attest_event_attendance('40000000-0000-0000-0000-000000000008', 'no_signin', ' Rained out ');
 perform public.admin_attest_event_attendance('40000000-0000-0000-0000-000000000003', 'verified', 'Checked against the sheet');
 perform public.admin_attest_event_attendance('40000000-0000-0000-0000-000000000004', 'verified');
 perform pg_sleep(0.01);
 perform public.admin_attest_event_attendance('40000000-0000-0000-0000-000000000004', 'cleared');
 raise notice 'PASS: an admin can record and withdraw attendance statements.';
end $$;

create temp table r as select public.admin_event_attendance_readiness(2026) as j;
create temp table ev as select e->>'id' as id, e from r, jsonb_array_elements(r.j->'events') e;
grant select on r, ev to authenticated;

do $$
declare e jsonb;
begin
 if (select count(*) from ev) <> 10 or (select (j->>'total_events')::int from r) <> 10 or (select (j->>'truncated')::boolean from r) then
  raise exception 'FAIL: expected the 10 events of 2026-27 and no truncation, got %', (select count(*) from ev);
 end if;
 if exists (select 1 from ev where id = '40000000-0000-0000-0000-000000000009') then raise exception 'FAIL: last year''s event leaked into 2026'; end if;
 raise notice 'PASS: the year scope holds and reports its size honestly.';

 select ev.e into e from ev where id = '40000000-0000-0000-0000-000000000002';
 if (e->>'open_review_rows')::int <> 2 then raise exception 'FAIL: open review rows %, expected 2 (unrecorded + investigating a credited row)', e->>'open_review_rows'; end if;
 if (e->'latest_job'->>'status') <> 'completed' or (e->>'credits')::int <> 3 then raise exception 'FAIL: E2 facts wrong %', e; end if;
 raise notice 'PASS: open review rows: unrecorded or under investigation; not recovered, dismissed, skipped, invalid or recorded under the same identity.';
 select ev.e into e from ev where id = '40000000-0000-0000-0000-000000000010';
 if (e->>'open_review_rows')::int <> 0 or e->'latest_job'->>'status' <> 'completed' then raise exception 'FAIL: a failed import''s rows linger after a clean re-import %', e; end if;
 raise notice 'PASS: a clean re-import supersedes a failed import''s rows.';
 select ev.e into e from ev where id = '40000000-0000-0000-0000-000000000011';
 if (e->>'reconciliation_pending_rows')::int <> 3 then raise exception 'FAIL: pending reconciliation rows (same-run resolution vs cross-run collision and NULL) not reported %', e; end if;
 raise notice 'PASS: same-run resolution clears only that row; cross-run collisions and NULL event-level actions leave pending rows open.';

 select ev.e into e from ev where id = '40000000-0000-0000-0000-000000000001';
 if e->'house_credits' <> '[{"credits": 1, "display_name": "Twilight Sparkle", "house_profile_id": "20000000-0000-0000-0000-000000000001"}]'::jsonb then
  raise exception 'FAIL: E1 House credits %, expected only Twilight 1 (Rarity member joined after the event)', e->'house_credits';
 end if;
 raise notice 'PASS: attendance before a member''s House start date is not credited to the House.';

 select ev.e into e from ev where id = '40000000-0000-0000-0000-000000000003';
 if e->'latest_job' <> 'null'::jsonb or (e->>'credits')::int <> 1 or e->'attestation'->>'status' <> 'verified' then raise exception 'FAIL: E3 facts wrong %', e; end if;
 select ev.e into e from ev where id = '40000000-0000-0000-0000-000000000004';
 if e->'attestation' <> 'null'::jsonb or (e->>'credits')::int <> 0 then raise exception 'FAIL: a cleared attestation is still current %', e; end if;
 select ev.e into e from ev where id = '40000000-0000-0000-0000-000000000008';
 if e->'attestation'->>'status' <> 'no_signin' or e->'attestation'->>'note' <> 'Rained out' or not (e->'attestation'->>'by_current_user')::boolean then raise exception 'FAIL: E8 attestation %', e; end if;
 select ev.e into e from ev where id = '40000000-0000-0000-0000-000000000006';
 if e->'latest_job'->>'status' <> 'failed' then raise exception 'FAIL: E6 job %', e; end if;
 select ev.e into e from ev where id = '40000000-0000-0000-0000-000000000007';
 if e->>'reconciled_at' is null or (e->>'scoring_credits')::int <> 1 or (e->>'credits')::int <> 2 then raise exception 'FAIL: E7 facts %', e; end if;
 raise notice 'PASS: legacy, cleared, no-sign-in, failed and reconciled events carry distinct facts.';
end $$;

-- The per-event House credits add up to the authoritative view, House by House.
reset role;
do $$ begin
 if exists (
  select 1 from public.house_yearly_points v
  full join (
   select (h->>'house_profile_id')::uuid as house_profile_id, sum((h->>'credits')::int) as credits
   from ev, jsonb_array_elements(ev.e->'house_credits') h group by 1
  ) s on s.house_profile_id = v.house_profile_id
  where coalesce(v.academic_year_start, 2026) = 2026 and coalesce(v.total_points, 0) <> coalesce(s.credits, 0)
 ) then raise exception 'FAIL: per-event House credits do not add up to house_yearly_points'; end if;
 if exists (select 1 from ev, jsonb_array_elements(ev.e->'house_credits') h where h->>'display_name' = 'Applejack') then
  raise exception 'FAIL: an inactive House profile was credited';
 end if;
 raise notice 'PASS: per-event House credits match house_yearly_points exactly and skip inactive profiles.';
end $$;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$ begin
 if jsonb_array_length(public.admin_event_attendance_readiness(2026, '10000000-0000-0000-0000-000000000027')->'events') <> 1 then
  raise exception 'FAIL: term filter';
 end if;
 raise notice 'PASS: the term filter keeps one term only.';
end $$;

reset role;
select pg_temp.expect($$update public.event_attendance_attestations set status = 'verified'$$, '42501', 'statements cannot be edited');
select pg_temp.expect($$delete from public.event_attendance_attestations$$, '42501', 'statements cannot be deleted directly');
do $$ begin
 delete from public.events where id = '40000000-0000-0000-0000-000000000008';
 if exists (select 1 from public.event_attendance_attestations where event_id = '40000000-0000-0000-0000-000000000008') then raise exception 'FAIL: cascade'; end if;
 raise notice 'PASS: deleting an event still removes its statements.';
end $$;
