-- Synthetic records only, for scripts/test-member-identity.sh. Loaded after
-- attendance-recovery.fixture.sql (members, ledger, production points
-- triggers, import audit tables) and BEFORE 20261025000000, so the backfill
-- runs against existing data the way it will in production.

alter table public.academic_terms add column if not exists academic_year_start integer;

create table public.house_page_assets (
  id uuid primary key default gen_random_uuid(),
  academic_year_start integer not null,
  house_key text not null
);
create table public.house_memberships (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  house_profile_id uuid not null references public.house_page_assets(id) on delete restrict,
  academic_year_start integer not null,
  academic_year_end integer not null,
  effective_start_date date not null default current_date
);
create table public.ace_family_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  member_id uuid references public.members(id) on delete set null
);
grant all on public.house_page_assets, public.house_memberships, public.ace_family_members to anon, authenticated;

insert into public.academic_terms (id, label, academic_year_start) values
  ('71000000-0000-0000-0000-000000000024', 'Fall 2024', 2024),
  ('71000000-0000-0000-0000-000000000025', 'Fall 2025', 2025),
  ('71000000-0000-0000-0000-000000000026', 'Fall 2026', 2026);
insert into public.events (id, name, points, academic_term_id) values
  ('81000000-0000-0000-0000-000000000024', 'GBM 2024', 2, '71000000-0000-0000-0000-000000000024'),
  ('81000000-0000-0000-0000-000000000025', 'GBM 2025', 5, '71000000-0000-0000-0000-000000000025'),
  ('81000000-0000-0000-0000-000000000026', 'GBM 2026', 3, '71000000-0000-0000-0000-000000000026'),
  ('81000000-0000-0000-0000-000000000027', 'Social 2026', 7, '71000000-0000-0000-0000-000000000026'),
  ('81000000-0000-0000-0000-000000000028', 'Retreat 2026', 4, '71000000-0000-0000-0000-000000000026'),
  ('81000000-0000-0000-0000-000000000099', 'No term', 1, null);

insert into public.members (id, first_name, last_name, email, college, year) values
  ('11000000-0000-0000-0000-000000000001', 'Alex', 'Nguyen', 'alex@gmail.com', 'Muir', '2nd Year'),
  ('11000000-0000-0000-0000-000000000002', 'Ryan', 'Le', 'shared@ucsd.edu', 'Warren', '1st Year'),
  ('11000000-0000-0000-0000-000000000003', 'Ryan', 'Le', 'shared@ucsd.edu', 'Sixth', '3rd Year'),
  ('11000000-0000-0000-0000-000000000004', 'Not', 'Email', 'not-an-email', null, null),
  ('11000000-0000-0000-0000-000000000005', 'Hana', 'Vo', null, 'Revelle', '1st Year'),
  ('11000000-0000-0000-0000-000000000006', 'Tri', 'Ha', null, null, null),
  ('11000000-0000-0000-0000-000000000007', 'Minh', 'Pham', 'minh@ucsd.edu', 'ERC', '3rd Year'),
  ('11000000-0000-0000-0000-000000000010', 'Kim', 'Do', 'kim@gmail.com', 'Seventh', '2nd Year'),
  ('11000000-0000-0000-0000-000000000011', 'Kim', 'Do', 'kim@ucsd.edu', null, '3rd Year');

insert into public.member_event_attendance (member_id, event_id, points_earned) values
  ('11000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000025', 5),
  ('11000000-0000-0000-0000-000000000006', '81000000-0000-0000-0000-000000000025', 5),
  ('11000000-0000-0000-0000-000000000007', '81000000-0000-0000-0000-000000000024', 2),
  ('11000000-0000-0000-0000-000000000007', '81000000-0000-0000-0000-000000000025', 5),
  ('11000000-0000-0000-0000-000000000010', '81000000-0000-0000-0000-000000000024', 2),
  ('11000000-0000-0000-0000-000000000011', '81000000-0000-0000-0000-000000000024', 2),
  ('11000000-0000-0000-0000-000000000011', '81000000-0000-0000-0000-000000000025', 5);
