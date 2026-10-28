-- Disposable cluster fixture for 20261028000000_house_payment_eligibility.sql.
\pset tuples_only on
-- Prerequisites are stubs; the House batch tables, placement columns, override
-- RPC and payment eligibility objects come from the exact repo migrations.
-- Every person here is fictional.
create role anon;
create role authenticated;
create schema auth;
grant usage on schema public, auth to anon, authenticated;
create table auth.users (id uuid primary key);
create table public.members (id uuid primary key);
create table public.house_page_assets (id uuid primary key);
create table public.house_memberships (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null,
  house_profile_id uuid not null,
  academic_year_start integer not null,
  source text,
  source_import_id uuid
);
grant select, insert on public.house_memberships to authenticated;
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create function public.is_admin_user(p_id uuid) returns boolean language sql stable as $$
 select coalesce(p_id = auth.uid() and p_id = '00000000-0000-0000-0000-000000000001', false);
$$;
create function public.update_updated_at_column() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
set client_min_messages = warning;
\ir ../../supabase/migrations/20261001213414_create_house_assignment_batches.sql
\ir ../../supabase/migrations/20261026230757_house_assignment_timestamp_placement.sql
\ir ../../supabase/migrations/20261027120000_house_placement_override_rpc.sql
\ir ../../supabase/migrations/20261028000000_house_payment_eligibility.sql
set client_min_messages = notice;

insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
-- Four Houses, eight fictional members (m1..m8).
insert into public.house_page_assets values
 ('20000000-0000-0000-0000-000000000001'), ('20000000-0000-0000-0000-000000000002'),
 ('20000000-0000-0000-0000-000000000003'), ('20000000-0000-0000-0000-000000000004');
insert into public.members select ('40000000-0000-0000-0000-00000000000' || n)::uuid from generate_series(1, 8) n;

create function pg_temp.expect_error(statement text, expected_state text, label text) returns void language plpgsql as $$
declare actual_state text; actual_message text;
begin
 begin
  execute statement;
 exception when others then
  actual_state := sqlstate;
  actual_message := sqlerrm;
 end;
 if actual_state is distinct from expected_state then
  raise exception 'FAIL (%): expected SQLSTATE %, got % (%)', label, expected_state, actual_state, actual_message;
 end if;
 raise notice 'PASS: % (%)', label, expected_state;
end $$;
grant execute on function pg_temp.expect_error(text, text, text) to authenticated;

-- ─── Privileges ──────────────────────────────────────────────────────────────
do $$ begin
 if has_table_privilege('anon', 'public.house_applicants', 'select')
   or has_table_privilege('anon', 'public.house_payment_cycles', 'select')
   or has_table_privilege('anon', 'public.house_payment_audit', 'select')
   or has_table_privilege('anon', 'public.house_payment_requests', 'select') then
  raise exception 'FAIL: anon can read a payment table';
 end if;
 if has_table_privilege('authenticated', 'public.house_payment_requests', 'select') then
  raise exception 'FAIL: clients can read idempotency results';
 end if;
 if has_column_privilege('authenticated', 'public.house_applicants', 'payment_status', 'update')
   or has_column_privilege('authenticated', 'public.house_payment_cycles', 'status_version', 'update')
   or has_column_privilege('authenticated', 'public.house_payment_cycles', 'publishing_batch_id', 'update') then
  raise exception 'FAIL: payment status or version is directly writable';
 end if;
 if has_table_privilege('authenticated', 'public.house_applicants', 'delete')
   or has_table_privilege('authenticated', 'public.house_payment_audit', 'insert')
   or has_table_privilege('authenticated', 'public.house_payment_audit', 'delete') then
  raise exception 'FAIL: eligibility history is deletable or forgeable';
 end if;
 if has_function_privilege('anon', 'public.admin_set_house_applicant_payments(uuid,jsonb,text,text,uuid,bigint)', 'execute')
   or has_function_privilege('anon', 'public.admin_register_house_applicants(uuid,jsonb,text)', 'execute')
   or has_function_privilege('anon', 'public.admin_begin_house_batch_publish(uuid)', 'execute')
   or has_function_privilege('anon', 'public.house_batch_payment_blockers(uuid)', 'execute') then
  raise exception 'FAIL: anon can execute a payment function';
 end if;
 if has_function_privilege('authenticated', 'public.guard_house_batch_payment()', 'execute')
   or has_function_privilege('authenticated', 'public.guard_house_membership_payment()', 'execute') then
  raise exception 'FAIL: guard trigger functions are client-callable';
 end if;
 raise notice 'PASS: anon has no access; status/version/audit are not client-writable; guards not callable.';
end $$;

-- ─── Non-admin sees nothing and changes nothing ─────────────────────────────
insert into public.house_payment_cycles (id, academic_year_start, application_key)
values ('50000000-0000-0000-0000-000000000001', 2026, 'house_fall');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$ begin
 if exists (select 1 from public.house_payment_cycles) then
  raise exception 'FAIL: a non-admin can read payment cycles';
 end if;
 raise notice 'PASS: non-admin reads no payment cycles.';
end $$;
select pg_temp.expect_error($s$select public.admin_register_house_applicants('50000000-0000-0000-0000-000000000001', '[{"applicant_key":"x"}]')$s$, '42501', 'non-admin cannot register applicants');
select pg_temp.expect_error($s$select public.admin_set_house_applicant_payments('50000000-0000-0000-0000-000000000001', '[{"applicant_id":"60000000-0000-0000-0000-000000000001","payment_status":"paid"}]', 'single', null, gen_random_uuid())$s$, '42501', 'non-admin cannot change payment status');

-- ─── Admin: register eight applicants (2 per House) ──────────────────────────
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
create temp table applicant_ids as
select * from public.admin_register_house_applicants('50000000-0000-0000-0000-000000000001', (
 select jsonb_agg(jsonb_build_object(
   'applicant_key', format('2026-10-0%sT17:00:00.000Z#%s', n, n + 1),
   'source_name', format('Fictional Applicant %s', n),
   'submission_timestamp', format('2026-10-0%sT17:00:00Z', n),
   'source_row_number', n + 1,
   'preferences', jsonb_build_array(
     format('20000000-0000-0000-0000-00000000000%s', ((n - 1) % 4) + 1),
     format('20000000-0000-0000-0000-00000000000%s', (n % 4) + 1)),
   'member_id', format('40000000-0000-0000-0000-00000000000%s', n),
   'match_status', 'match',
   'match_method', 'email'))
 from generate_series(1, 8) n));
do $$ begin
 if (select count(*) from applicant_ids where created) <> 8 then raise exception 'FAIL: 8 applicants not registered'; end if;
 if (select status_version from public.house_payment_cycles) <> 1 then raise exception 'FAIL: registering did not bump the version once'; end if;
 if exists (select 1 from public.house_applicants where payment_status <> 'unverified') then
  raise exception 'FAIL: unknown payment did not default to unverified';
 end if;
 raise notice 'PASS: 8 applicants registered as Unverified; version 0 -> 1.';
end $$;

-- Re-registering the same rows is a no-op; a changed ranking or moved row is refused.
do $$ begin
 perform * from public.admin_register_house_applicants('50000000-0000-0000-0000-000000000001',
  '[{"applicant_key":"2026-10-01T17:00:00.000Z#2","source_name":"Fictional Applicant 1","submission_timestamp":"2026-10-01T17:00:00Z","source_row_number":2,"preferences":["20000000-0000-0000-0000-000000000001","20000000-0000-0000-0000-000000000002"]}]');
 if (select status_version from public.house_payment_cycles) <> 1 then raise exception 'FAIL: idempotent re-register bumped the version'; end if;
 raise notice 'PASS: re-registering an identical application changes nothing.';
end $$;
select pg_temp.expect_error($s$select public.admin_register_house_applicants('50000000-0000-0000-0000-000000000001',
 '[{"applicant_key":"2026-10-01T17:00:00.000Z#2","source_name":"Fictional Applicant 1","submission_timestamp":"2026-10-01T17:00:00Z","source_row_number":2,"preferences":["20000000-0000-0000-0000-000000000003"]}]')$s$,
 '23514', 'a saved application is never silently re-ranked');
select pg_temp.expect_error($s$select public.admin_register_house_applicants('50000000-0000-0000-0000-000000000001',
 '[{"applicant_key":"2026-10-01T17:00:00.000Z#9","source_name":"fictional applicant 1","submission_timestamp":"2026-10-01T17:00:00Z","source_row_number":9,"preferences":["20000000-0000-0000-0000-000000000001"]}]')$s$,
 '23514', 'the same submission at a shifted sheet row is refused');

-- ─── Payment status RPC ──────────────────────────────────────────────────────
-- Applicants 7 and 8 never paid; 1-6 paid. One request, retried.
do $$
declare
 r1 jsonb; r2 jsonb;
 changes jsonb := (
  select jsonb_agg(jsonb_build_object('applicant_id', a.id,
    'payment_status', case when a.source_row_number >= 8 then 'unpaid' else 'paid' end,
    'payment_evidence', 'payment_checklist'))
  from public.house_applicants a);
begin
 r1 := public.admin_set_house_applicant_payments('50000000-0000-0000-0000-000000000001', changes, 'bulk', 'CRC checklist 10/30', '70000000-0000-0000-0000-000000000001', 1);
 r2 := public.admin_set_house_applicant_payments('50000000-0000-0000-0000-000000000001', changes, 'bulk', 'CRC checklist 10/30', '70000000-0000-0000-0000-000000000001', 1);
 if (r1->>'applied')::int <> 8 or (r1->>'status_version')::int <> 2 then raise exception 'FAIL: bulk update result %', r1; end if;
 if not (r2->>'replayed')::boolean or (r2->>'applied')::int <> 8 then raise exception 'FAIL: retry did not replay %', r2; end if;
 if (select status_version from public.house_payment_cycles) <> 2 then raise exception 'FAIL: retry bumped the version again'; end if;
 if (select count(*) from public.house_payment_audit where event_type = 'status_changed') <> 8 then raise exception 'FAIL: retry duplicated audit rows'; end if;
 if (select count(*) from public.house_applicants where payment_status = 'unpaid') <> 2 then raise exception 'FAIL: unpaid count'; end if;
 raise notice 'PASS: one bulk request marks 6 Paid + 2 Unpaid atomically; the retry replays without re-applying.';
end $$;
select pg_temp.expect_error($s$select public.admin_set_house_applicant_payments('50000000-0000-0000-0000-000000000001',
 (select jsonb_agg(jsonb_build_object('applicant_id', id, 'payment_status', 'pending')) from public.house_applicants where source_row_number = 2),
 'single', null, gen_random_uuid(), 1)$s$, '40001', 'a stale preview version is refused');
select pg_temp.expect_error($s$select public.admin_set_house_applicant_payments('50000000-0000-0000-0000-000000000001',
 (select jsonb_agg(jsonb_build_object('applicant_id', id, 'payment_status', 'waived')) from public.house_applicants where source_row_number = 8),
 'single', null, gen_random_uuid())$s$, '23514', 'a waiver needs an authorization reason');
select pg_temp.expect_error($s$select public.admin_set_house_applicant_payments('50000000-0000-0000-0000-000000000001',
 (select jsonb_agg(x) from (select jsonb_build_object('applicant_id', id, 'payment_status', 'paid') x from public.house_applicants where source_row_number = 2
   union all select jsonb_build_object('applicant_id', id, 'payment_status', 'unpaid') from public.house_applicants where source_row_number = 2) s),
 'bulk', null, gen_random_uuid())$s$, '22023', 'one applicant twice in a request is refused');

-- ─── Cutoff ──────────────────────────────────────────────────────────────────
-- Before the deadline exists, a final draft cannot be saved.
select pg_temp.expect_error($s$insert into public.house_assignment_batches (academic_year_start, academic_year_end, effective_start_date, assignment_method, payment_cycle_id, eligibility_mode, payment_snapshot_version)
 values (2026, 2027, '2026-11-01', 'timestamp_ranked', '50000000-0000-0000-0000-000000000001', 'final', 2)$s$, '23514', 'a final draft needs the cutoff');
update public.house_payment_cycles set payment_deadline = now() - interval '1 day' where id = '50000000-0000-0000-0000-000000000001';
select pg_temp.expect_error($s$update public.house_payment_cycles set payment_deadline = now() + interval '1 day' where id = '50000000-0000-0000-0000-000000000001'$s$,
 '23514', 'moving a passed deadline needs a reason');
do $$ begin
 if exists (select 1 from public.house_payment_audit where event_type = 'deadline_changed' and reason is not null) then
  raise exception 'FAIL: unexpected reasoned deadline audit';
 end if;
 raise notice 'PASS: setting a first deadline is audited; moving it after the cutoff is refused without a reason.';
end $$;

-- ─── Draft A (provisional, all 8) and Draft B (final, 6 paid) ───────────────
insert into public.house_assignment_batches (id, academic_year_start, academic_year_end, effective_start_date, assignment_method, capacity_config, payment_cycle_id, eligibility_mode, payment_snapshot_version, generation_reason)
values ('10000000-0000-0000-0000-00000000000a', 2026, 2027, '2026-11-01', 'timestamp_ranked',
 '{"20000000-0000-0000-0000-000000000001":2,"20000000-0000-0000-0000-000000000002":2,"20000000-0000-0000-0000-000000000003":2,"20000000-0000-0000-0000-000000000004":2}',
 '50000000-0000-0000-0000-000000000001', 'provisional', 1, 'initial');
insert into public.house_assignment_drafts (batch_id, member_id, house_profile_id, generated_house_profile_id, match_status, source_order, applicant_id)
select '10000000-0000-0000-0000-00000000000a', a.member_id, (a.preferences->>0)::uuid, (a.preferences->>0)::uuid, 'match', a.source_row_number - 2, a.id
from public.house_applicants a;
select pg_temp.expect_error($s$update public.house_assignment_batches set status = 'locked' where id = '10000000-0000-0000-0000-00000000000a'$s$,
 '23514', 'a provisional Draft A (with 2 unpaid) cannot be locked');

insert into public.house_assignment_batches (id, academic_year_start, academic_year_end, effective_start_date, assignment_method, capacity_config, payment_cycle_id, eligibility_mode, payment_snapshot_version, generation_reason, revised_from_batch_id)
values ('10000000-0000-0000-0000-00000000000b', 2026, 2027, '2026-11-01', 'timestamp_ranked', '{}',
 '50000000-0000-0000-0000-000000000001', 'final', 2, 'post_payment_rerun', '10000000-0000-0000-0000-00000000000a');
insert into public.house_assignment_drafts (batch_id, member_id, house_profile_id, generated_house_profile_id, match_status, source_order, applicant_id)
select '10000000-0000-0000-0000-00000000000b', a.member_id, (a.preferences->>0)::uuid, (a.preferences->>0)::uuid, 'match', a.source_row_number - 2, a.id
from public.house_applicants a where a.payment_status = 'paid';
select pg_temp.expect_error($s$insert into public.house_assignment_batches (academic_year_start, academic_year_end, effective_start_date, assignment_method, payment_cycle_id, eligibility_mode, payment_snapshot_version)
 values (2026, 2027, '2026-11-01', 'timestamp_ranked', '50000000-0000-0000-0000-000000000001', 'final', 1)$s$, '40001', 'a final draft from an old payment version cannot be saved');
select pg_temp.expect_error($s$update public.house_assignment_batches set eligibility_mode = 'final' where id = '10000000-0000-0000-0000-00000000000a'$s$,
 '42501', 'eligibility and lineage are fixed after save');
select pg_temp.expect_error($s$delete from public.house_assignment_batches where id = '10000000-0000-0000-0000-00000000000a'$s$,
 '23001', 'Draft A cannot be deleted while Draft B revises it');
select pg_temp.expect_error($s$insert into public.house_assignment_drafts (batch_id, source_order, applicant_id) values ('10000000-0000-0000-0000-00000000000b', 99, gen_random_uuid())$s$,
 '23514', 'a draft row cannot point at an applicant outside its roster');

-- Unlinked timestamp batch in a gated year is refused; a manual batch is not.
insert into public.house_assignment_batches (id, academic_year_start, academic_year_end, effective_start_date, assignment_method)
values ('10000000-0000-0000-0000-00000000000c', 2026, 2027, '2026-11-01', 'timestamp_ranked'),
       ('10000000-0000-0000-0000-00000000000d', 2026, 2027, '2026-11-01', 'manual');
select pg_temp.expect_error($s$update public.house_assignment_batches set status = 'locked' where id = '10000000-0000-0000-0000-00000000000c'$s$,
 '23514', 'an unlinked timestamp draft in a gated year cannot be locked');
update public.house_assignment_batches set status = 'locked' where id = '10000000-0000-0000-0000-00000000000d';
update public.house_assignment_batches set status = 'draft' where id = '10000000-0000-0000-0000-00000000000d';
do $$ begin raise notice 'PASS: manual batches keep the old lock/reopen behavior.'; end $$;

-- ─── Lock B, then a late payment makes it stale ──────────────────────────────
do $$ begin
 if cardinality(public.house_batch_payment_blockers('10000000-0000-0000-0000-00000000000b')) <> 0 then
  raise exception 'FAIL: Draft B blocked: %', public.house_batch_payment_blockers('10000000-0000-0000-0000-00000000000b');
 end if;
 update public.house_assignment_batches set status = 'locked' where id = '10000000-0000-0000-0000-00000000000b';
 raise notice 'PASS: the payment-cleared Draft B locks.';
end $$;
select pg_temp.expect_error($s$insert into public.house_memberships (member_id, house_profile_id, academic_year_start, source, source_import_id)
 values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 2026, 'house_assignment_batch', '10000000-0000-0000-0000-00000000000b')$s$,
 '42501', 'no membership from a gated batch before its Reveal starts');
select pg_temp.expect_error($s$update public.house_assignment_batches set status = 'published' where id = '10000000-0000-0000-0000-00000000000b'$s$,
 '23514', 'publishing without starting the Reveal is refused');

do $$ begin
 perform public.admin_set_house_applicant_payments('50000000-0000-0000-0000-000000000001',
  (select jsonb_agg(jsonb_build_object('applicant_id', id, 'payment_status', 'paid')) from public.house_applicants where source_row_number = 9),
  'single', 'Late payment verified by CRC', gen_random_uuid());
 if (select status_version from public.house_payment_cycles) <> 3 then raise exception 'FAIL: late payment did not bump the version'; end if;
 if cardinality(public.house_batch_payment_blockers('10000000-0000-0000-0000-00000000000b')) = 0 then
  raise exception 'FAIL: stale Draft B still passes the gate';
 end if;
 raise notice 'PASS: a late payer makes the locked Draft B stale: %', public.house_batch_payment_blockers('10000000-0000-0000-0000-00000000000b');
end $$;
select pg_temp.expect_error($s$select public.admin_begin_house_batch_publish('10000000-0000-0000-0000-00000000000b')$s$,
 '23514', 'a stale locked draft cannot start its Reveal');
update public.house_assignment_batches set status = 'draft' where id = '10000000-0000-0000-0000-00000000000b';

-- ─── Draft C: the 7 cleared applicants, Reveal ───────────────────────────────
insert into public.house_assignment_batches (id, academic_year_start, academic_year_end, effective_start_date, assignment_method, capacity_config, payment_cycle_id, eligibility_mode, payment_snapshot_version, generation_reason, revised_from_batch_id)
values ('10000000-0000-0000-0000-0000000000c1', 2026, 2027, '2026-11-01', 'timestamp_ranked', '{}',
 '50000000-0000-0000-0000-000000000001', 'final', 3, 'post_payment_rerun', '10000000-0000-0000-0000-00000000000b');
insert into public.house_assignment_drafts (batch_id, member_id, house_profile_id, generated_house_profile_id, match_status, source_order, applicant_id)
select '10000000-0000-0000-0000-0000000000c1', a.member_id, (a.preferences->>0)::uuid, (a.preferences->>0)::uuid, 'match', a.source_row_number - 2, a.id
from public.house_applicants a where a.payment_status = 'paid';
update public.house_assignment_batches set status = 'locked' where id = '10000000-0000-0000-0000-0000000000c1';
select public.admin_begin_house_batch_publish('10000000-0000-0000-0000-0000000000c1');
select public.admin_begin_house_batch_publish('10000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error($s$select public.admin_set_house_applicant_payments('50000000-0000-0000-0000-000000000001',
 (select jsonb_agg(jsonb_build_object('applicant_id', id, 'payment_status', 'unpaid')) from public.house_applicants where source_row_number = 2),
 'single', 'refund', gen_random_uuid())$s$, '55006', 'payment statuses are frozen during the Reveal');
select pg_temp.expect_error($s$update public.house_payment_cycles set payment_deadline = now() where id = '50000000-0000-0000-0000-000000000001'$s$,
 '55006', 'the deadline is frozen during the Reveal');
select pg_temp.expect_error($s$insert into public.house_memberships (member_id, house_profile_id, academic_year_start, source, source_import_id)
 values ('40000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000003', 2026, 'house_assignment_batch', '10000000-0000-0000-0000-0000000000c1')$s$,
 '42501', 'an unpaid member cannot be written from the gated batch');
select pg_temp.expect_error($s$insert into public.house_memberships (member_id, house_profile_id, academic_year_start, source, source_import_id)
 values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 2026, 'house_assignment_batch', '10000000-0000-0000-0000-0000000000c1')$s$,
 '42501', 'a cleared member cannot be written into a different House than the draft');
insert into public.house_memberships (member_id, house_profile_id, academic_year_start, source, source_import_id)
select d.member_id, d.house_profile_id, 2026, 'house_assignment_batch', d.batch_id
from public.house_assignment_drafts d where d.batch_id = '10000000-0000-0000-0000-0000000000c1';
update public.house_assignment_batches set status = 'published' where id = '10000000-0000-0000-0000-0000000000c1';
do $$ begin
 if (select publishing_batch_id from public.house_payment_cycles) is not null then raise exception 'FAIL: Reveal freeze not released'; end if;
 if (select count(*) from public.house_memberships) <> 7 then raise exception 'FAIL: expected 7 memberships'; end if;
 raise notice 'PASS: the Reveal writes exactly the 7 cleared members and releases the freeze.';
end $$;

-- After Reveal, a refund is recorded for leadership review; no membership changes.
do $$ declare r jsonb; begin
 r := public.admin_set_house_applicant_payments('50000000-0000-0000-0000-000000000001',
  (select jsonb_agg(jsonb_build_object('applicant_id', id, 'payment_status', 'unpaid')) from public.house_applicants where source_row_number = 2),
  'single', 'Refund requested', gen_random_uuid());
 if not (r->>'post_reveal')::boolean then raise exception 'FAIL: post-Reveal change not flagged'; end if;
 if (select count(*) from public.house_memberships) <> 7 then raise exception 'FAIL: a payment change touched memberships'; end if;
 if not exists (select 1 from public.house_payment_audit where reason like '%after Reveal: leadership review%') then
  raise exception 'FAIL: post-Reveal audit note missing';
 end if;
 raise notice 'PASS: a post-Reveal refund is audited for leadership review and changes no membership.';
end $$;

-- Checklist imports never reverse an approved waiver.
do $$ declare r jsonb; begin
 perform public.admin_set_house_applicant_payments('50000000-0000-0000-0000-000000000001',
  (select jsonb_agg(jsonb_build_object('applicant_id', id, 'payment_status', 'waived')) from public.house_applicants where source_row_number = 8),
  'single', 'Hardship waiver approved by the CRC chair', gen_random_uuid());
 r := public.admin_set_house_applicant_payments('50000000-0000-0000-0000-000000000001',
  (select jsonb_agg(jsonb_build_object('applicant_id', id, 'payment_status', 'unpaid')) from public.house_applicants where source_row_number = 8),
  'checklist_import', 'Re-imported checklist', gen_random_uuid());
 if (r->>'kept_waivers')::int <> 1 or (select payment_status from public.house_applicants where source_row_number = 8) <> 'waived' then
  raise exception 'FAIL: checklist import reversed a waiver %', r;
 end if;
 raise notice 'PASS: a re-imported checklist keeps an approved waiver.';
end $$;

reset role;
do $$ begin raise notice 'PASS: all House payment eligibility checks.'; end $$;
