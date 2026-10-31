-- #640 synthetic PostgreSQL fixture; never connect to a real Supabase project.
\pset tuples_only on
create role anon;
create role authenticated;
create schema auth;
grant usage on schema public, auth to anon, authenticated;
create table public.user_profiles (id uuid primary key, is_admin boolean not null);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function public.update_updated_at_column() returns trigger language plpgsql as $$
 begin new.updated_at := clock_timestamp(); return new; end
$$;
create table public.house_page_assets (
 id uuid primary key, academic_year_start integer not null, academic_year_end integer not null,
 house text not null, house_key text not null, display_name text not null,
 description text, image_url text, image_thumbnail_url text, image_alt text,
 cover_image_url text, accent_color text, display_order integer not null default 0,
 is_active boolean not null default true, house_parent_image_url text,
 house_parent_heading text, house_parent_body text, source_doc_url text,
 internal_notes text, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.house_page_assets enable row level security;
create policy "Admins can select private House profiles" on public.house_page_assets
 for select using (exists(select 1 from public.user_profiles
 where id=auth.uid() and is_admin=true));
set client_min_messages=warning;
\ir ../../supabase/migrations/20260529000000_add_house_events.sql
\ir ../../supabase/migrations/20260529000001_collab_house_events.sql
\ir ../../supabase/migrations/20260601000000_add_house_emoji.sql
set client_min_messages=notice;
-- Explicitly grant raw reads so the fixture tests RLS, not a missing grant.
grant select on all tables in schema public to anon, authenticated;
insert into public.house_page_assets
(id,academic_year_start,academic_year_end,house,house_key,display_name,is_active,internal_notes,source_doc_url)
values
('aaaaaaaa-0000-0000-0000-000000000001',2026,2027,'Alpha','alpha','Fictional Alpha',true,'synthetic-note','synthetic://source'),
('aaaaaaaa-0000-0000-0000-000000000002',2026,2027,'Beta','beta','Fictional Beta',false,'synthetic-note','synthetic://source');
insert into public.house_events
(id,house_profile_id,academic_year_start,academic_year_end,title,event_date,is_published)
values
('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',2026,2027,'Fictional Published Event','2026-11-12',true),
('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001',2026,2027,'Fictional Draft Event','2026-11-13',false);
insert into public.house_event_houses(house_event_id,house_page_asset_id)
values
('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001'),
('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002'),
('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001');
set role anon;
do $$
declare n integer;
begin
 select count(*) into n from public.house_page_assets;
 if n <> 0 then raise exception 'FAIL: private House profile visible'; end if;
 raise notice 'PASS: RLS filters private House profile rows';
 if exists(select 1 from information_schema.columns
  where table_schema='public' and table_name='published_house_page_assets'
  and column_name in ('internal_notes','source_doc_url')) then
  raise exception 'FAIL: published view has private column';
 end if;
 raise notice 'PASS: view omits private columns';
 select count(*) into n from public.house_events;
 if n <> 1 then raise exception 'FAIL: draft event visible or published event missing'; end if;
 raise notice 'PASS: published event visible and draft hidden';
 select count(*) into n from public.house_event_houses;
 if n <> 2 then raise exception 'FAIL: draft association visible or collaborator missing'; end if;
 raise notice 'PASS: both published association IDs visible and draft associations hidden';
 select count(*) into n from public.house_events e
 left join public.house_page_assets p on p.id=e.house_profile_id
 where e.is_published and p.id is not null;
 if n <> 0 then raise exception 'FAIL: private profile embedded in published event'; end if;
 raise notice 'PASS: nested private profile resolves to null';
 select count(*) into n from public.published_house_page_assets;
 if n <> 1 then raise exception 'FAIL: inactive profile exposed'; end if;
 raise notice 'PASS: published view has one active host';
 select count(*) into n from public.house_event_houses h
 join public.published_house_page_assets p on p.id=h.house_page_asset_id;
 if n <> 1 then raise exception 'FAIL: active host missing or inactive host resolved'; end if;
 raise notice 'PASS: only active collaborator resolved';
end $$;
reset role;

