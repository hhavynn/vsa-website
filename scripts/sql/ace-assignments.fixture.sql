-- Disposable cluster fixture for scripts/test-ace-assignments.sh. Supabase
-- prerequisites are stubs; every ACE table, policy, trigger and function comes
-- from the exact repo migrations. scripts/verify-ace-assignments.sql then
-- seeds its own synthetic rows and rolls them back.

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
create table public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  academic_year_start integer not null,
  academic_year_end integer not null,
  quarter text not null
);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date timestamptz not null,
  is_published boolean not null default false,
  academic_term_id uuid references public.academic_terms(id)
);
-- Events are admin-managed in production; the verifier deletes one as an admin.
grant select, delete on public.events to authenticated;

\ir ../../supabase/migrations/20260514000000_create_ace_families.sql
\ir ../../supabase/migrations/20260514000001_make_ace_fams_timeless.sql
\ir ../../supabase/migrations/20260929071851_link_ace_cabinet_members_to_members.sql
\ir ../../supabase/migrations/20261001213356_ace_assignment_workspace.sql
