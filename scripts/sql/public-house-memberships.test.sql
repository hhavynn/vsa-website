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
set client_min_messages = notice;

insert into academic_terms (academic_year_start, is_active) values (2026, true);
insert into house_page_assets values
 ('11111111-0000-0000-0000-000000000001', 'twilight', 'Twilight Sparkle', '#7b5ea7', true),
 ('11111111-0000-0000-0000-000000000002', 'retired', 'Retired', '#000000', false),
 ('11111111-0000-0000-0000-000000000024', 'toad', 'Toad', '#ff0000', true);
insert into house_memberships (member_id, house_profile_id, academic_year_start, academic_year_end, effective_start_date, notes) values
 ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 2026, 2027, '2026-11-08', 'private admin note'),
 ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 2026, 2027, '2026-11-08', null),
 ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000024', 2024, 2025, '2024-11-01', null);

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

insert into house_assignment_batches (academic_year_start, academic_year_end, effective_start_date, status) values (2026, 2027, '2026-11-08', 'draft');
update house_assignment_batches set status = 'locked';
set role anon;
do $$ begin
 if exists (select 1 from public.public_house_memberships where academic_year_start = 2026) then
  raise exception 'FAIL: a locked (unrevealed) batch made the year public';
 end if;
 raise notice 'PASS: a locked, unrevealed batch keeps the year hidden.';
end $$;
reset role;

update house_assignment_batches set status = 'published';
set role anon;
do $$ begin
 if (select count(*) from public.public_house_memberships where academic_year_start = 2026) <> 1 then
  raise exception 'FAIL: expected exactly the active-House 2026 membership after the Reveal';
 end if;
 if exists (select 1 from public.public_house_memberships where house_profile_id = '11111111-0000-0000-0000-000000000002') then
  raise exception 'FAIL: an inactive House profile is public';
 end if;
 raise notice 'PASS: after the Reveal the year is public, inactive Houses stay hidden.';
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
 raise notice 'PASS: score-free columns only (no notes, source, batch); read-only and not auto-updatable.';
end $$;
