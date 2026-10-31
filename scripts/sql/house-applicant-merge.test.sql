-- Disposable cluster test fixture for #697 (Member merge house_applicants reconciliation).
\pset tuples_only on
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
grant usage on schema public, auth to anon, authenticated, service_role;

create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table public.user_profiles (id uuid primary key references auth.users(id), is_admin boolean not null default false);

create function public.is_admin_user(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path to '' as $$
  select p_user_id is not null and p_user_id = auth.uid()
    and exists (select 1 from public.user_profiles as profile where profile.id = p_user_id and profile.is_admin = true);
$$;

create function public.update_updated_at_column() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create table public.academic_terms (id uuid primary key default gen_random_uuid(), label text not null, academic_year_start integer not null default 2026);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date timestamptz not null default now(),
  points integer default 0,
  academic_term_id uuid references public.academic_terms(id)
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  college text,
  year text,
  points integer not null default 0,
  events_attended integer not null default 0,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text,
  needs_review boolean default false,
  house text
);

create table public.member_event_attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  points_earned integer not null default 0,
  imported_at timestamptz not null default now(),
  constraint member_event_attendance_member_event_key unique (member_id, event_id)
);

create table public.house_page_assets (id uuid primary key default gen_random_uuid(), house_key text not null);
create table public.house_memberships (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null,
  house_profile_id uuid not null references public.house_page_assets(id) on delete restrict,
  academic_year_start integer not null,
  source text,
  source_import_id uuid
);

grant all on schema public to authenticated, anon, service_role;
grant all on all tables in schema public to authenticated, anon, service_role;
grant all on all sequences in schema public to authenticated, anon, service_role;

set client_min_messages = warning;
\ir ../../supabase/migrations/20261001213414_create_house_assignment_batches.sql
\ir ../../supabase/migrations/20261026075912_member_identity_aliases.sql
\ir ../../supabase/migrations/20261026230757_house_assignment_timestamp_placement.sql
\ir ../../supabase/migrations/20261027120000_house_placement_override_rpc.sql
\ir ../../supabase/migrations/20261028050216_house_payment_eligibility.sql
\ir ../../supabase/migrations/20261029065750_house_applicant_member_merge.sql
\ir ../../supabase/migrations/20261031034444_house_applicant_merge_reveal_lock.sql
set client_min_messages = notice;

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

create function pg_temp.expect_admin_error(statement text, expected_state text, label text) returns void language plpgsql as $$
declare actual_state text; actual_message text;
begin
 begin
  set local role authenticated;
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
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

create function pg_temp.run_as_admin(statement text) returns void language plpgsql as $$
begin
  set local role authenticated;
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
  execute statement;
end $$;

grant execute on function pg_temp.expect_error(text, text, text) to authenticated;
grant execute on function pg_temp.expect_admin_error(text, text, text) to authenticated;
grant execute on function pg_temp.run_as_admin(text) to authenticated;

-- Setup test users
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@ucsd.edu'),
  ('00000000-0000-0000-0000-0000000000a2', 'user@ucsd.edu');
insert into public.user_profiles (id, is_admin) values
  ('00000000-0000-0000-0000-0000000000a1', true),
  ('00000000-0000-0000-0000-0000000000a2', false);

-- Four Houses
insert into public.house_page_assets (id, house_key) values
  ('20000000-0000-0000-0000-000000000001', 'twilight'),
  ('20000000-0000-0000-0000-000000000002', 'applejack'),
  ('20000000-0000-0000-0000-000000000003', 'pinkie'),
  ('20000000-0000-0000-0000-000000000004', 'rarity');

-- ─── 1. Security & Validation Checks ──────────────────────────────────────────
do $$ begin
  set local role authenticated;
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2'; -- non-admin
  perform pg_temp.expect_error(
    'select public.smart_merge_members(''10000000-0000-0000-0000-000000000001'', ''10000000-0000-0000-0000-000000000002'')',
    'P0001',
    'non-admin cannot run smart_merge_members'
  );
end $$;

select pg_temp.expect_admin_error(
  $s$select public.smart_merge_members('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001')$s$,
  'P0001',
  'merging member into itself is refused'
);

-- ─── 2. Reveal Freeze Guard (SQLSTATE 55006) ──────────────────────────────────
insert into public.members (id, first_name, last_name, email) values
  ('11000000-0000-0000-0000-000000000001', 'Freeze', 'Source', 'fsrc@ucsd.edu'),
  ('11000000-0000-0000-0000-000000000002', 'Freeze', 'Target', 'ftgt@ucsd.edu');

insert into public.house_assignment_batches (id, academic_year_start, academic_year_end, effective_start_date, assignment_method, status) values
  ('31000000-0000-0000-0000-000000000001', 2026, 2027, '2026-11-01', 'timestamp_ranked', 'draft');

insert into public.house_payment_cycles (id, academic_year_start, application_key) values
  ('51000000-0000-0000-0000-000000000001', 2026, 'house_fall');

update public.house_payment_cycles
set publishing_batch_id = '31000000-0000-0000-0000-000000000001'
where id = '51000000-0000-0000-0000-000000000001';

insert into public.house_applicants (id, cycle_id, applicant_key, source_name, submission_timestamp, source_row_number, preferences, member_id, match_status) values
  ('61000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'freeze#1', 'Freeze Source', now(), 1, '["20000000-0000-0000-0000-000000000001"]'::jsonb, '11000000-0000-0000-0000-000000000001', 'match');

select pg_temp.expect_admin_error(
  $s$select public.smart_merge_members('11000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002')$s$,
  '55006',
  'merge refused during active Reveal'
);

-- ─── 3. Single Application Merge (No conflict) ────────────────────────────────
insert into public.members (id, first_name, last_name, email) values
  ('12000000-0000-0000-0000-000000000001', 'Single', 'Source', 'ssrc@ucsd.edu'),
  ('12000000-0000-0000-0000-000000000002', 'Single', 'Target', 'stgt@ucsd.edu');

insert into public.house_payment_cycles (id, academic_year_start, application_key) values
  ('52000000-0000-0000-0000-000000000001', 2026, 'house_winter');

insert into public.house_applicants (id, cycle_id, applicant_key, source_name, submission_timestamp, source_row_number, preferences, member_id, match_status, payment_status, payment_note) values
  ('62000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', 'single#1', 'Single Source', now(), 1, '["20000000-0000-0000-0000-000000000001"]'::jsonb, '12000000-0000-0000-0000-000000000001', 'match', 'pending', 'Will pay at GBM');

select pg_temp.run_as_admin('select public.smart_merge_members(''12000000-0000-0000-0000-000000000001'', ''12000000-0000-0000-0000-000000000002'')');

do $$
declare
  v_app public.house_applicants%rowtype;
  v_cycle public.house_payment_cycles%rowtype;
  v_audit public.house_payment_audit%rowtype;
begin
  select * into v_app from public.house_applicants where id = '62000000-0000-0000-0000-000000000001';
  if v_app.member_id is distinct from '12000000-0000-0000-0000-000000000002'::uuid then
    raise exception 'FAIL: applicant member_id was not repointed to target member';
  end if;

  select * into v_cycle from public.house_payment_cycles where id = '52000000-0000-0000-0000-000000000001';
  if v_cycle.status_version <> 1 then
    raise exception 'FAIL: cycle status_version was not bumped (expected 1, got %)', v_cycle.status_version;
  end if;

  select * into v_audit from public.house_payment_audit
  where cycle_id = '52000000-0000-0000-0000-000000000001' and applicant_id = v_app.id;
  if v_audit.event_type <> 'member_link_changed' or v_audit.source <> 'system'
     or v_audit.from_value <> '12000000-0000-0000-0000-000000000001'
     or v_audit.to_value <> '12000000-0000-0000-0000-000000000002' then
    raise exception 'FAIL: audit record mismatch for single applicant repoint';
  end if;

  if exists (select 1 from public.members where id = '12000000-0000-0000-0000-000000000001') then
    raise exception 'FAIL: source member was not deleted';
  end if;

  raise notice 'PASS: single applicant repoints cleanly, bumps version, and writes audit record';
end $$;

-- ─── 4. Conflict: Payment Rank Inheritance & Note Absorption ──────────────────
insert into public.members (id, first_name, last_name, email) values
  ('13000000-0000-0000-0000-000000000001', 'Conflict', 'Source', 'csrc@ucsd.edu'),
  ('13000000-0000-0000-0000-000000000002', 'Conflict', 'Target', 'ctgt@ucsd.edu');

insert into public.house_payment_cycles (id, academic_year_start, application_key) values
  ('53000000-0000-0000-0000-000000000001', 2026, 'house_spring');

insert into public.house_applicants (
  id, cycle_id, applicant_key, source_name, submission_timestamp, source_row_number, preferences,
  member_id, match_status, payment_status, payment_evidence, payment_reference, payment_note
) values
  ('63000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000001', 'conflict#src', 'Conflict Source', now(), 1,
   '["20000000-0000-0000-0000-000000000001"]'::jsonb, '13000000-0000-0000-0000-000000000001', 'match',
   'paid', 'crc_confirmation', 'REF-PAY-999', 'Source paid via CRC table'),
  ('63000000-0000-0000-0000-000000000002', '53000000-0000-0000-0000-000000000001', 'conflict#tgt', 'Conflict Target', now(), 2,
   '["20000000-0000-0000-0000-000000000002"]'::jsonb, '13000000-0000-0000-0000-000000000002', 'match',
   'unverified', null, null, 'Target submitted form early');

select pg_temp.run_as_admin('select public.smart_merge_members(''13000000-0000-0000-0000-000000000001'', ''13000000-0000-0000-0000-000000000002'')');

do $$
declare
  v_pri public.house_applicants%rowtype;
  v_sec public.house_applicants%rowtype;
  v_cycle public.house_payment_cycles%rowtype;
begin
  select * into v_pri from public.house_applicants where id = '63000000-0000-0000-0000-000000000002'; -- target's app
  select * into v_sec from public.house_applicants where id = '63000000-0000-0000-0000-000000000001'; -- source's app

  -- Primary checks
  if v_pri.member_id <> '13000000-0000-0000-0000-000000000002'::uuid then
    raise exception 'FAIL: primary applicant not linked to target member';
  end if;
  if v_pri.payment_status <> 'paid' then
    raise exception 'FAIL: primary applicant did not inherit paid status (got %)', v_pri.payment_status;
  end if;
  if v_pri.payment_evidence <> 'crc_confirmation' or v_pri.payment_reference <> 'REF-PAY-999' then
    raise exception 'FAIL: primary applicant did not inherit evidence/reference';
  end if;
  if v_pri.payment_note not like '%Target submitted form early; [From merged conflict#src]: Source paid via CRC table%' then
    raise exception 'FAIL: payment notes were not concatenated properly (got %)', v_pri.payment_note;
  end if;

  -- Secondary checks
  if v_sec.member_id is not null then
    raise exception 'FAIL: secondary applicant member_id was not cleared';
  end if;
  if v_sec.match_status <> 'unmatched' then
    raise exception 'FAIL: secondary match_status was not set to unmatched';
  end if;
  if v_sec.withdrawn_reason not like 'Duplicate application: merged with conflict#tgt during member merge%' then
    raise exception 'FAIL: secondary withdrawn_reason not set correctly (got %)', v_sec.withdrawn_reason;
  end if;

  -- Cycle check
  select * into v_cycle from public.house_payment_cycles where id = '53000000-0000-0000-0000-000000000001';
  if v_cycle.status_version <> 1 then
    raise exception 'FAIL: cycle status_version was not bumped';
  end if;

  -- Audit checks
  if not exists (
    select 1 from public.house_payment_audit
    where cycle_id = v_cycle.id and applicant_id = v_pri.id
      and event_type = 'status_changed' and from_value = 'unverified' and to_value = 'paid'
  ) then
    raise exception 'FAIL: missing status_changed audit record for primary';
  end if;

  if not exists (
    select 1 from public.house_payment_audit
    where cycle_id = v_cycle.id and applicant_id = v_sec.id
      and event_type = 'withdrawal_changed' and to_value like 'Duplicate application%'
  ) then
    raise exception 'FAIL: missing withdrawal_changed audit record for secondary';
  end if;

  if not exists (
    select 1 from public.house_payment_audit
    where cycle_id = v_cycle.id and applicant_id = v_sec.id
      and event_type = 'member_link_changed' and from_value = '13000000-0000-0000-0000-000000000001' and to_value is null
  ) then
    raise exception 'FAIL: missing member_link_changed unlinking audit record for secondary';
  end if;

  raise notice 'PASS: conflict resolution inherits payment status, merges notes, withdraws secondary, and writes all audit rows';
end $$;

-- ─── 5. Conflict: Draft Placement Priority ─────────────────────────────────────
insert into public.members (id, first_name, last_name, email) values
  ('14000000-0000-0000-0000-000000000001', 'Draft', 'Source', 'dsrc@ucsd.edu'),
  ('14000000-0000-0000-0000-000000000002', 'Draft', 'Target', 'dtgt@ucsd.edu');

insert into public.house_payment_cycles (id, academic_year_start, application_key) values
  ('54000000-0000-0000-0000-000000000001', 2025, 'house_fall');

insert into public.house_assignment_batches (
  id, academic_year_start, academic_year_end, effective_start_date, assignment_method, status,
  payment_cycle_id, eligibility_mode, payment_snapshot_version
) values (
  '34000000-0000-0000-0000-000000000001', 2025, 2026, '2025-11-01', 'timestamp_ranked', 'draft',
  '54000000-0000-0000-0000-000000000001', 'provisional', 0
);

insert into public.house_applicants (
  id, cycle_id, applicant_key, source_name, submission_timestamp, source_row_number, preferences,
  member_id, match_status, payment_status
) values
  ('64000000-0000-0000-0000-000000000001', '54000000-0000-0000-0000-000000000001', 'draft#src', 'Draft Source', now(), 1,
   '["20000000-0000-0000-0000-000000000001"]'::jsonb, '14000000-0000-0000-0000-000000000001', 'match', 'paid'),
  ('64000000-0000-0000-0000-000000000002', '54000000-0000-0000-0000-000000000001', 'draft#tgt', 'Draft Target', now(), 2,
   '["20000000-0000-0000-0000-000000000002"]'::jsonb, '14000000-0000-0000-0000-000000000002', 'match', 'paid');

-- Place Source in draft row
insert into public.house_assignment_drafts (
  id, batch_id, source_name, member_id, applicant_id, match_status, match_method
) values (
  '74000000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000001', 'Draft Source',
  '14000000-0000-0000-0000-000000000001', '64000000-0000-0000-0000-000000000001', 'match', 'manual'
);

select pg_temp.run_as_admin('select public.smart_merge_members(''14000000-0000-0000-0000-000000000001'', ''14000000-0000-0000-0000-000000000002'')');

do $$
declare
  v_app_src public.house_applicants%rowtype;
  v_app_tgt public.house_applicants%rowtype;
  v_draft public.house_assignment_drafts%rowtype;
begin
  select * into v_app_src from public.house_applicants where id = '64000000-0000-0000-0000-000000000001';
  select * into v_app_tgt from public.house_applicants where id = '64000000-0000-0000-0000-000000000002';
  select * into v_draft from public.house_assignment_drafts where id = '74000000-0000-0000-0000-000000000001';

  -- Placed Source applicant MUST be primary, repointed to Target member
  if v_app_src.member_id <> '14000000-0000-0000-0000-000000000002'::uuid then
    raise exception 'FAIL: placed applicant was not selected as primary / repointed to target member';
  end if;
  if v_app_src.withdrawn_reason is not null then
    raise exception 'FAIL: placed applicant was improperly withdrawn';
  end if;

  -- Draft row member_id must be repointed to Target member
  if v_draft.member_id <> '14000000-0000-0000-0000-000000000002'::uuid then
    raise exception 'FAIL: draft row member_id was not repointed to target member';
  end if;

  -- Unplaced Target applicant becomes secondary, withdrawn and unlinked
  if v_app_tgt.member_id is not null then
    raise exception 'FAIL: unplaced duplicate applicant was not unlinked';
  end if;
  if v_app_tgt.withdrawn_reason is null then
    raise exception 'FAIL: unplaced duplicate applicant was not withdrawn';
  end if;

  raise notice 'PASS: draft placement priority keeps placed applicant active, repointing to target member';
end $$;

-- ─── 6. Conflict: Active Beats Withdrawn ──────────────────────────────────────
insert into public.members (id, first_name, last_name, email) values
  ('15000000-0000-0000-0000-000000000001', 'Active', 'Source', 'asrc@ucsd.edu'),
  ('15000000-0000-0000-0000-000000000002', 'Withdrawn', 'Target', 'wtgt@ucsd.edu');

insert into public.house_payment_cycles (id, academic_year_start, application_key) values
  ('55000000-0000-0000-0000-000000000001', 2024, 'house_fall');

insert into public.house_applicants (
  id, cycle_id, applicant_key, source_name, submission_timestamp, source_row_number, preferences,
  member_id, match_status, payment_status, withdrawn_reason
) values
  ('65000000-0000-0000-0000-000000000001', '55000000-0000-0000-0000-000000000001', 'act#src', 'Active Source', now(), 1,
   '["20000000-0000-0000-0000-000000000001"]'::jsonb, '15000000-0000-0000-0000-000000000001', 'match', 'unverified', null),
  ('65000000-0000-0000-0000-000000000002', '55000000-0000-0000-0000-000000000001', 'withdrawn#tgt', 'Withdrawn Target', now(), 2,
   '["20000000-0000-0000-0000-000000000001"]'::jsonb, '15000000-0000-0000-0000-000000000002', 'match', 'unverified', 'Member requested withdrawal');

select pg_temp.run_as_admin('select public.smart_merge_members(''15000000-0000-0000-0000-000000000001'', ''15000000-0000-0000-0000-000000000002'')');

do $$
declare
  v_src public.house_applicants%rowtype;
  v_tgt public.house_applicants%rowtype;
begin
  select * into v_src from public.house_applicants where id = '65000000-0000-0000-0000-000000000001';
  select * into v_tgt from public.house_applicants where id = '65000000-0000-0000-0000-000000000002';

  if v_src.member_id <> '15000000-0000-0000-0000-000000000002'::uuid then
    raise exception 'FAIL: active applicant was not repointed to target member';
  end if;
  if v_src.withdrawn_reason is not null then
    raise exception 'FAIL: active applicant was improperly withdrawn';
  end if;

  raise notice 'PASS: active applicant beats withdrawn applicant during conflict resolution';
end $$;

-- ─── 7. Conflict: Active Beats a Withdrawn Applicant Still in a Draft ─────────
insert into public.members (id, first_name, last_name, email) values
  ('16000000-0000-0000-0000-000000000001', 'Stale', 'Source', 'stalesrc@ucsd.edu'),
  ('16000000-0000-0000-0000-000000000002', 'Active', 'Target', 'activetgt@ucsd.edu');

insert into public.house_payment_cycles (id, academic_year_start, application_key) values
  ('56000000-0000-0000-0000-000000000001', 2023, 'house_fall');

insert into public.house_assignment_batches (
  id, academic_year_start, academic_year_end, effective_start_date, assignment_method, status,
  payment_cycle_id, eligibility_mode, payment_snapshot_version
) values (
  '36000000-0000-0000-0000-000000000001', 2023, 2024, '2023-11-01', 'timestamp_ranked', 'draft',
  '56000000-0000-0000-0000-000000000001', 'provisional', 0
);

insert into public.house_applicants (
  id, cycle_id, applicant_key, source_name, submission_timestamp, source_row_number, preferences,
  member_id, match_status, payment_status, withdrawn_reason
) values
  ('66000000-0000-0000-0000-000000000001', '56000000-0000-0000-0000-000000000001', 'stale#src', 'Stale Source', now(), 1,
   '["20000000-0000-0000-0000-000000000001"]'::jsonb, '16000000-0000-0000-0000-000000000001', 'match', 'unverified', 'Member requested withdrawal'),
  ('66000000-0000-0000-0000-000000000002', '56000000-0000-0000-0000-000000000001', 'active#tgt', 'Active Target', now(), 2,
   '["20000000-0000-0000-0000-000000000002"]'::jsonb, '16000000-0000-0000-0000-000000000002', 'match', 'unverified', null);

insert into public.house_assignment_drafts (
  id, batch_id, source_name, member_id, applicant_id, match_status, match_method
) values (
  '76000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', 'Stale Source',
  '16000000-0000-0000-0000-000000000001', '66000000-0000-0000-0000-000000000001', 'match', 'manual'
);

select pg_temp.run_as_admin('select public.smart_merge_members(''16000000-0000-0000-0000-000000000001'', ''16000000-0000-0000-0000-000000000002'')');

do $$
declare
  v_tgt public.house_applicants%rowtype;
begin
  select * into v_tgt from public.house_applicants where id = '66000000-0000-0000-0000-000000000002';

  if v_tgt.member_id is distinct from '16000000-0000-0000-0000-000000000002'::uuid then
    raise exception 'FAIL: active applicant lost its member link';
  end if;
  if v_tgt.withdrawn_reason is not null then
    raise exception 'FAIL: merge withdrew the only active application';
  end if;

  raise notice 'PASS: active applicant beats a withdrawn applicant still placed in a draft';
end $$;

-- Fixture for the two-session Reveal race in test-house-applicant-merge.sh.
insert into public.members (id, first_name, last_name, email) values
  ('17000000-0000-0000-0000-000000000001', 'Race', 'Source', 'racesrc@ucsd.edu'),
  ('17000000-0000-0000-0000-000000000002', 'Race', 'Target', 'racetgt@ucsd.edu');

insert into public.house_assignment_batches (id, academic_year_start, academic_year_end, effective_start_date, assignment_method, status) values
  ('37000000-0000-0000-0000-000000000001', 2022, 2023, '2022-11-01', 'timestamp_ranked', 'draft');

insert into public.house_payment_cycles (id, academic_year_start, application_key) values
  ('57000000-0000-0000-0000-000000000001', 2022, 'house_fall');

insert into public.house_applicants (id, cycle_id, applicant_key, source_name, submission_timestamp, source_row_number, preferences, member_id, match_status) values
  ('67000000-0000-0000-0000-000000000001', '57000000-0000-0000-0000-000000000001', 'race#src', 'Race Source', now(), 1,
   '["20000000-0000-0000-0000-000000000001"]'::jsonb, '17000000-0000-0000-0000-000000000001', 'match');

do $$ begin
  raise notice 'ALL HOUSE APPLICANT MERGE TESTS PASSED.';
end $$;
