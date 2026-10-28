-- Disposable cluster fixture for scripts/test-ace-pickup-year.sh. Supabase
-- prerequisites are stubs; every ACE table, view, policy and the publish
-- function come from the exact repo migrations. All people are synthetic.

-- Supabase grants ALL on new relations, and EXECUTE on new functions, to anon
-- and authenticated by default.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;

create schema auth;
create schema storage;
grant usage on schema public, auth to anon, authenticated;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text);

create table public.user_profiles (id uuid primary key, is_admin boolean not null default false);
create function public.is_admin_user(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user_id is not null and p_user_id = auth.uid()
     and exists (select 1 from public.user_profiles where id = p_user_id and is_admin);
$$;
create function public.update_updated_at_column() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create table public.members (id uuid primary key, first_name text, last_name text);
create view public.member_yearly_points as
  select null::uuid as member_id, null::integer as academic_year_start where false;
create table public.cabinet_years (id uuid primary key, start_year integer);
create table public.cabinet_members (id uuid primary key, cabinet_year_id uuid, name text);

\ir ../../supabase/migrations/20260514000000_create_ace_families.sql
\ir ../../supabase/migrations/20260514000001_make_ace_fams_timeless.sql
\ir ../../supabase/migrations/20260929071851_link_ace_cabinet_members_to_members.sql
\ir ../../supabase/migrations/20261001213356_ace_assignment_workspace.sql

-- Seed: the live tree as it exists before the pickup-year migration ---------
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2');
insert into public.user_profiles (id, is_admin) values
  ('00000000-0000-0000-0000-0000000000a1', true),
  ('00000000-0000-0000-0000-0000000000b2', false);
insert into public.members (id, first_name, last_name) values
  ('10000000-0000-0000-0000-000000000001', 'Synthetic', 'Linked');

insert into public.ace_families (id, name, slug, is_published, academic_year_start, academic_year_end) values
  ('20000000-0000-0000-0000-000000000001', 'Synthetic Live', 'synthetic-live', true, null, null),
  ('20000000-0000-0000-0000-000000000002', 'Synthetic Draft Fam', 'synthetic-draft', false, null, null),
  ('20000000-0000-0000-0000-000000000003', '(Dead) Synthetic Graveyard', 'synthetic-graveyard', true, 2016, 2017);

insert into public.ace_family_members
  (id, family_id, name, role_label, photo_url, parent_member_id, member_id, display_order, is_published)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Root Person', 'Big',
   'https://example.invalid/root.webp', null, null, 0, true),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Middle Person', 'Big',
   null, '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, true),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Leaf Person', 'Little',
   null, '30000000-0000-0000-0000-000000000002', null, 2, true),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'Hidden Person', 'Little',
   null, '30000000-0000-0000-0000-000000000002', null, 3, false),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', 'Draft Fam Person', 'Little',
   null, null, null, 0, true),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000003', 'Graveyard Person', 'Little',
   null, null, null, 0, true);

-- Byte-for-byte snapshot of every pre-existing column, compared after the
-- migration runs.
create table public.zz_pre_snapshot as
  select id, to_jsonb(m) as row_json from public.ace_family_members m;
create table public.zz_pre_families as
  select id, to_jsonb(f) as row_json from public.ace_families f;
