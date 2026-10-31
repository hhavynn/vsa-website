-- Disposable cluster fixture for 20261028060000_public_house_memberships.sql.
-- House batch tables come from the exact repo migrations; the rest are stubs.
-- Every person here is fictional.
\pset tuples_only on
create role anon;
create role authenticated;
create schema auth;
grant usage on schema public, auth to anon, authenticated;
create table auth.users (id uuid primary key);
create table public.members (id uuid primary key);
create table public.house_page_assets (id uuid primary key, house_key text, display_name text, accent_color text, is_active boolean);
create table public.academic_terms (id serial primary key, academic_year_start integer, is_active boolean);
create table public.house_memberships (
  id uuid primary key default gen_random_uuid(), member_id uuid, house_profile_id uuid,
  academic_year_start integer, academic_year_end integer, effective_start_date date, effective_end_date date,
  source text, source_import_id uuid, notes text
);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create function public.is_admin_user(p_id uuid) returns boolean language sql stable as $$ select false $$;
create function public.update_updated_at_column() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
set client_min_messages = warning;
\ir ../../supabase/migrations/20261001213414_create_house_assignment_batches.sql
\ir ../../supabase/migrations/20261026230757_house_assignment_timestamp_placement.sql
\ir ../../supabase/migrations/20261028060000_public_house_memberships.sql
-- Full embargo migration is deliberately not loaded by this isolated fixture
-- (it also replaces multiple score views). Stub its already-live badge RPC,
-- then prove the #802 forward migration replaces that signature.
create function public.public_member_house_badge(p_member_id uuid, p_year integer default null)
returns jsonb language sql stable as $$select null::jsonb$$;
\ir ../../supabase/migrations/20261031093000_public_member_house_badge_matches_view.sql
\ir ../../supabase/migrations/20261031093000_public_member_house_badge_matches_view.sql
set client_min_messages = notice;

insert into academic_terms (academic_year_start, is_active) values (2026, true);
insert into house_page_assets values
 ('11111111-0000-0000-0000-000000000001', 'twilight', 'Twilight Sparkle', '#7b5ea7', true),
 ('11111111-0000-0000-0000-000000000002', 'retired', 'Retired', '#000000', false),
 ('11111111-0000-0000-0000-000000000024', 'toad', 'Toad', '#ff0000', true);
-- Fall and Winter batches for 2026; memberships written by each, one by hand.
insert into house_assignment_batches (id, academic_year_start, academic_year_end, effective_start_date) values
 ('33333333-0000-0000-0000-00000000fa11', 2026, 2027, '2026-11-08'),
 ('33333333-0000-0000-0000-0000000a1e72', 2026, 2027, '2027-01-10');
insert into house_memberships (member_id, house_profile_id, academic_year_start, academic_year_end, effective_start_date, source, source_import_id, notes) values
 ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 2026, 2027, '2026-11-08', 'house_assignment_batch', '33333333-0000-0000-0000-00000000fa11', 'private admin note'),
 ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 2026, 2027, '2026-11-08', 'house_assignment_batch', '33333333-0000-0000-0000-00000000fa11', null),
 ('22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', 2026, 2027, '2027-01-10', 'house_assignment_batch', '33333333-0000-0000-0000-0000000a1e72', null),
 ('22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001', 2026, 2027, '2026-12-01', 'admin', null, null),
 ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000024', 2024, 2025, '2024-11-01', 'legacy_backfill', null, null);

set role anon;
do $$
begin
 if public.public_member_house_badge('22222222-0000-0000-0000-000000000001', 2026) is not null
   or public.public_member_house_badge('22222222-0000-0000-0000-000000000004', null) is not null then
   raise exception 'FAIL: badge RPC disclosed a House before any batch was revealed';
 end if;
 if public.public_member_house_badge('22222222-0000-0000-0000-000000000003', 2024)
      ->> 'display_name' <> 'Toad' then
   raise exception 'FAIL: historical published House should remain visible by selected year';
 end if;
 if public.public_member_house_badge(null::uuid, 2026) is not null
    or public.public_member_house_badge('22222222-0000-0000-0000-000000000001', 2101) is not null then
   raise exception 'FAIL: null identity or invalid year must return null';
 end if;
 raise notice 'PASS: pre-Reveal badge is null even for guessed IDs, legacy year remains public, and invalid input is refused.';
end $$;
reset role;

set role anon;
do $$ begin
 if exists (select 1 from public.public_house_memberships where academic_year_start = 2026) then
  raise exception 'FAIL: 2026 memberships are public before the Reveal';
 end if;
 if (select count(*) from public.public_house_memberships where academic_year_start = 2024) <> 1 then
  raise exception 'FAIL: a historical membership is not public';
 end if;
 raise notice 'PASS: before the Reveal, the upcoming year is hidden; a historical year is public.';
end $$;
reset role;

update house_assignment_batches set status = 'locked';
set role anon;
do $$ begin
 if exists (select 1 from public.public_house_memberships where academic_year_start = 2026) then
  raise exception 'FAIL: a locked (unrevealed) batch made the year public';
 end if;
 raise notice 'PASS: a locked, unrevealed batch keeps the year hidden.';
end $$;
reset role;

-- Even though the rows are already written, neither a draft nor a locked
-- unrevealed batch can be read through a guessed canonical member ID.
set role anon;
do $$
begin
 if public.public_member_house_badge('22222222-0000-0000-0000-000000000001', 2026) is not null
    or public.public_member_house_badge('22222222-0000-0000-0000-000000000004', 2026) is not null then
   raise exception 'FAIL: locked batch disclosed a House through badge RPC';
 end if;
 raise notice 'PASS: badge RPC refuses locked unrevealed rows before any Reveal.';
end $$;
reset role;

-- Fall is revealed; Winter's Reveal failed partway (its rows exist, batch still locked).
update house_assignment_batches set status = 'published' where id = '33333333-0000-0000-0000-00000000fa11';
set role anon;
do $$ begin
 if exists (select 1 from public.public_house_memberships where member_id = '22222222-0000-0000-0000-000000000004') then
  raise exception 'FAIL: a row from the unrevealed Winter batch is public because Fall was revealed';
 end if;
 if (select count(*) from public.public_house_memberships where academic_year_start = 2026) <> 2 then
  raise exception 'FAIL: expected the Fall row and the hand-added row (year revealed) only';
 end if;
 raise notice 'PASS: each batch''s rows wait for that batch''s own Reveal; a hand-added row follows the year.';
end $$;
reset role;

set role anon;
do $$
declare
  v_visible jsonb;
begin
  if public.public_member_house_badge('22222222-0000-0000-0000-000000000004', 2026) is not null
    or public.public_member_house_badge('22222222-0000-0000-0000-000000000004', null) is not null then
    raise exception 'FAIL: later locked Winter batch leaked because Fall was revealed';
  end if;
  v_visible := public.public_member_house_badge('22222222-0000-0000-0000-000000000001', 2026);
  if v_visible->>'display_name' <> 'Twilight Sparkle'
    or v_visible->>'academic_year_start' <> '2026' then
    raise exception 'FAIL: published Fall House not visible immediately before its effective start';
  end if;
  if (v_visible ?| array['total_points','events_attended','review_note',
                             'source_import_id','member_id']) then
    raise exception 'FAIL: public badge included private scores, notes or identity IDs';
  end if;
  if (select count(*) from jsonb_object_keys(v_visible)) <> 6 then
    raise exception 'FAIL: public badge response keys changed';
  end if;
  if public.public_member_house_badge('22222222-0000-0000-0000-000000000005', 2026)
      ->> 'display_name' <> 'Twilight Sparkle' then
    raise exception 'FAIL: revealed hand-added upcoming membership not visible';
  end if;
  raise notice 'PASS: badge reveals Fall only, blocks later partial Winter, shows upcoming and returns only six safe fields.';
end $$;
reset role;

-- Archiving the revealed Fall batch must not hide it; moving the active term
-- forward must not reveal Winter's unpublished rows.
update house_assignment_batches set status = 'archived' where id = '33333333-0000-0000-0000-00000000fa11';
update academic_terms set academic_year_start = 2027;
set role anon;
do $$ begin
 if not exists (select 1 from public.public_house_memberships where member_id = '22222222-0000-0000-0000-000000000001') then
  raise exception 'FAIL: archiving a revealed batch hid its Houses';
 end if;
 if exists (select 1 from public.public_house_memberships where member_id = '22222222-0000-0000-0000-000000000004') then
  raise exception 'FAIL: rollover revealed an unpublished batch''s rows';
 end if;
 raise notice 'PASS: an archived Reveal stays public; rollover never reveals an unpublished batch.';
end $$;
reset role;
update academic_terms set academic_year_start = 2026;

set role anon;
do $$ begin
 if exists (select 1 from public.public_house_memberships where house_profile_id = '11111111-0000-0000-0000-000000000002') then
  raise exception 'FAIL: an inactive House profile is public';
 end if;
 raise notice 'PASS: after the Reveal the year is public, inactive Houses stay hidden.';
end $$;
reset role;

-- Transferred member: current active House should beat the older ended one.
-- A member with no successor must have no current-year House.
insert into public.house_memberships
  (member_id,house_profile_id,academic_year_start,academic_year_end,
   effective_start_date,effective_end_date,source,notes)
values
 ('22222222-0000-0000-0000-000000000006',
  '11111111-0000-0000-0000-000000000001',2026,2027,
  ((now() at time zone 'America/Los_Angeles')::date - 60),
  ((now() at time zone 'America/Los_Angeles')::date - 10),'admin',null),
 ('22222222-0000-0000-0000-000000000006',
  '11111111-0000-0000-0000-000000000024',2026,2027,
  ((now() at time zone 'America/Los_Angeles')::date - 10),
  null,'admin',null),
 ('22222222-0000-0000-0000-000000000007',
  '11111111-0000-0000-0000-000000000001',2026,2027,
  ((now() at time zone 'America/Los_Angeles')::date - 60),
  ((now() at time zone 'America/Los_Angeles')::date - 10),'admin',null);
set role anon;
do $$
begin
 if public.public_member_house_badge('22222222-0000-0000-0000-000000000001',2026)
     ->> 'display_name' <> 'Twilight Sparkle' then
   raise exception 'FAIL: archiving an already revealed Fall batch hid its public House';
 end if;
 if public.public_member_house_badge('22222222-0000-0000-0000-000000000004',2026) is not null then
   raise exception 'FAIL: Winter batch is still not published';
 end if;
 if public.public_member_house_badge('22222222-0000-0000-0000-000000000006',2026)
     ->> 'display_name' <> 'Toad' then
   raise exception 'FAIL: member transfer did not select currently active House';
 end if;
 if public.public_member_house_badge('22222222-0000-0000-0000-000000000007',2026) is not null then
   raise exception 'FAIL: ended current-year House without successor should not be shown';
 end if;
 if public.public_member_house_badge('22222222-0000-0000-0000-000000000003',2026) is not null then
   raise exception 'FAIL: requested year ignored for legacy House';
 end if;
 raise notice 'PASS: archived Reveal, active transfer, ended without successor, and explicit year isolation match view.';
end $$;
reset role;

do $$ declare cols text; begin
 select string_agg(column_name, ',' order by ordinal_position) into cols from information_schema.columns where table_name = 'public_house_memberships';
 if cols <> 'member_id,academic_year_start,academic_year_end,effective_start_date,effective_end_date,house_profile_id,house_key,display_name,accent_color' then
  raise exception 'FAIL: unexpected columns %', cols;
 end if;
 if has_table_privilege('anon', 'public.public_house_memberships', 'insert')
   or has_table_privilege('anon', 'public.public_house_memberships', 'update')
   or has_table_privilege('anon', 'public.public_house_memberships', 'delete')
   or has_table_privilege('authenticated', 'public.public_house_memberships', 'update') then
  raise exception 'FAIL: the public view is writable';
 end if;
 if (select is_updatable from information_schema.views where table_name = 'public_house_memberships') <> 'NO' then
  raise exception 'FAIL: the view is auto-updatable';
 end if;
 if not exists (select 1 from pg_class where relname = 'public_house_memberships' and 'security_barrier=true' = any(reloptions)) then
  raise exception 'FAIL: the view is not a security barrier';
 end if;
 raise notice 'PASS: score-free columns only (no notes, source, batch); read-only and not auto-updatable.';
end $$;
