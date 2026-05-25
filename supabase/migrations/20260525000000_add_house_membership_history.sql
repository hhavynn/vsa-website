-- Add event-date-based House membership history.
-- members.house remains as a current/display cache; House point views no longer use it.

alter table public.house_page_assets
  add column if not exists house_key text,
  add column if not exists display_name text,
  add column if not exists description text,
  add column if not exists cover_image_url text,
  add column if not exists accent_color text,
  add column if not exists is_active boolean not null default true;

alter table public.house_page_assets
  drop constraint if exists house_page_assets_house_check;

alter table public.members
  drop constraint if exists members_house_valid;

update public.house_page_assets
set
  house_key = coalesce(nullif(trim(house_key), ''), house),
  display_name = coalesce(nullif(trim(display_name), ''), house)
where house_key is null
   or display_name is null;

alter table public.house_page_assets
  alter column house_key set not null,
  alter column display_name set not null;

create unique index if not exists house_page_assets_unique_key_year_idx
  on public.house_page_assets (academic_year_start, house_key);

create index if not exists house_page_assets_active_year_order_idx
  on public.house_page_assets (academic_year_start desc, is_active, display_order asc);

create table if not exists public.house_memberships (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  house_profile_id uuid not null references public.house_page_assets(id) on delete restrict,
  academic_year_start integer not null,
  academic_year_end integer not null,
  effective_start_date date not null,
  effective_end_date date,
  source text,
  source_import_id uuid,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint house_memberships_year_span_check check (academic_year_end = academic_year_start + 1),
  constraint house_memberships_effective_range_check check (
    effective_end_date is null or effective_end_date > effective_start_date
  )
);

create index if not exists house_memberships_member_year_idx
  on public.house_memberships (member_id, academic_year_start, effective_start_date);

create index if not exists house_memberships_profile_idx
  on public.house_memberships (house_profile_id);

create index if not exists house_memberships_effective_idx
  on public.house_memberships (effective_start_date, effective_end_date);

drop trigger if exists update_house_memberships_updated_at on public.house_memberships;
create trigger update_house_memberships_updated_at
  before update on public.house_memberships
  for each row
  execute function public.update_updated_at_column();

create or replace function public.prevent_overlapping_house_memberships()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.house_memberships existing
    where existing.member_id = new.member_id
      and existing.academic_year_start = new.academic_year_start
      and existing.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and daterange(existing.effective_start_date, coalesce(existing.effective_end_date, 'infinity'::date), '[)')
        && daterange(new.effective_start_date, coalesce(new.effective_end_date, 'infinity'::date), '[)')
  ) then
    raise exception 'House memberships cannot overlap for the same member and academic year.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_overlapping_house_memberships on public.house_memberships;
create trigger prevent_overlapping_house_memberships
  before insert or update on public.house_memberships
  for each row
  execute function public.prevent_overlapping_house_memberships();

alter table public.house_memberships enable row level security;

drop policy if exists "Admins can view house memberships" on public.house_memberships;
create policy "Admins can view house memberships"
  on public.house_memberships for select
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can insert house memberships" on public.house_memberships;
create policy "Admins can insert house memberships"
  on public.house_memberships for insert
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can update house memberships" on public.house_memberships;
create policy "Admins can update house memberships"
  on public.house_memberships for update
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can delete house memberships" on public.house_memberships;
create policy "Admins can delete house memberships"
  on public.house_memberships for delete
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop view if exists public.published_house_page_assets;
drop view if exists public.house_yearly_points;
drop view if exists public.house_all_time_points;
drop view if exists public.house_recent_activity;
drop view if exists public.house_member_yearly_points;
drop view if exists public.house_member_all_time_points;

create view public.published_house_page_assets as
select
  id,
  academic_year_start,
  academic_year_end,
  house,
  house_key,
  display_name,
  description,
  image_url,
  image_alt,
  cover_image_url,
  accent_color,
  display_order,
  is_active,
  created_at,
  updated_at
from public.house_page_assets
where is_active = true;

create view public.house_yearly_points as
select
  hp.house_key as house,
  hp.id as house_profile_id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  t.academic_year_start,
  t.academic_year_end,
  sum(mea.points_earned)::int as total_points,
  count(*)::int as events_attended,
  count(distinct mea.event_id)::int as unique_events,
  count(distinct mea.member_id)::int as unique_members,
  round(
    sum(mea.points_earned)::numeric / nullif(count(distinct mea.member_id), 0),
    2
  ) as average_points_per_member,
  max(e.date) as latest_activity_at
from public.member_event_attendance mea
join public.events e
  on e.id = mea.event_id
join public.academic_terms t
  on t.id = e.academic_term_id
join public.house_memberships hm
  on hm.member_id = mea.member_id
  and hm.academic_year_start = t.academic_year_start
  and e.date::date >= hm.effective_start_date
  and (hm.effective_end_date is null or e.date::date < hm.effective_end_date)
join public.house_page_assets hp
  on hp.id = hm.house_profile_id
where e.date is not null
  and e.academic_term_id is not null
  and hp.is_active = true
group by
  hp.house_key,
  hp.id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  t.academic_year_start,
  t.academic_year_end;

create view public.house_all_time_points as
select
  hp.house_key as house,
  hp.id as house_profile_id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  t.academic_year_start,
  t.academic_year_end,
  sum(mea.points_earned)::int as total_points,
  count(*)::int as events_attended,
  count(distinct mea.event_id)::int as unique_events,
  count(distinct mea.member_id)::int as unique_members,
  round(
    sum(mea.points_earned)::numeric / nullif(count(distinct mea.member_id), 0),
    2
  ) as average_points_per_member,
  max(e.date) as latest_activity_at
from public.member_event_attendance mea
join public.events e
  on e.id = mea.event_id
join public.academic_terms t
  on t.id = e.academic_term_id
join public.house_memberships hm
  on hm.member_id = mea.member_id
  and hm.academic_year_start = t.academic_year_start
  and e.date::date >= hm.effective_start_date
  and (hm.effective_end_date is null or e.date::date < hm.effective_end_date)
join public.house_page_assets hp
  on hp.id = hm.house_profile_id
where e.date is not null
  and e.academic_term_id is not null
  and hp.is_active = true
group by
  hp.house_key,
  hp.id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  t.academic_year_start,
  t.academic_year_end;

create view public.house_recent_activity as
select
  hp.house_key as house,
  hp.id as house_profile_id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  e.id as event_id,
  e.name as event_name,
  e.date as event_date,
  t.academic_year_start,
  t.academic_year_end,
  sum(mea.points_earned)::int as total_points,
  count(distinct mea.member_id)::int as contributing_members,
  max(e.date) as latest_activity_at
from public.member_event_attendance mea
join public.events e
  on e.id = mea.event_id
join public.academic_terms t
  on t.id = e.academic_term_id
join public.house_memberships hm
  on hm.member_id = mea.member_id
  and hm.academic_year_start = t.academic_year_start
  and e.date::date >= hm.effective_start_date
  and (hm.effective_end_date is null or e.date::date < hm.effective_end_date)
join public.house_page_assets hp
  on hp.id = hm.house_profile_id
where e.date is not null
  and e.academic_term_id is not null
  and hp.is_active = true
group by
  hp.house_key,
  hp.id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  e.id,
  e.name,
  e.date,
  t.academic_year_start,
  t.academic_year_end;

create view public.house_member_yearly_points as
select
  hp.house_key as house,
  hp.id as house_profile_id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  m.id as member_id,
  m.first_name,
  m.last_name,
  m.college,
  m.year as graduation_year,
  m.user_id,
  t.academic_year_start,
  t.academic_year_end,
  sum(mea.points_earned)::int as total_points,
  count(*)::int as events_attended,
  count(distinct mea.event_id)::int as unique_events,
  max(e.date) as latest_activity_at
from public.member_event_attendance mea
join public.members m
  on m.id = mea.member_id
join public.events e
  on e.id = mea.event_id
join public.academic_terms t
  on t.id = e.academic_term_id
join public.house_memberships hm
  on hm.member_id = mea.member_id
  and hm.academic_year_start = t.academic_year_start
  and e.date::date >= hm.effective_start_date
  and (hm.effective_end_date is null or e.date::date < hm.effective_end_date)
join public.house_page_assets hp
  on hp.id = hm.house_profile_id
where e.date is not null
  and e.academic_term_id is not null
  and hp.is_active = true
group by
  hp.house_key,
  hp.id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  m.id,
  m.first_name,
  m.last_name,
  m.college,
  m.year,
  m.user_id,
  t.academic_year_start,
  t.academic_year_end;

create view public.house_member_all_time_points as
select
  hp.house_key as house,
  hp.id as house_profile_id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  m.id as member_id,
  m.first_name,
  m.last_name,
  m.college,
  m.year as graduation_year,
  m.user_id,
  t.academic_year_start,
  t.academic_year_end,
  sum(mea.points_earned)::int as total_points,
  count(*)::int as events_attended,
  count(distinct mea.event_id)::int as unique_events,
  max(e.date) as latest_activity_at
from public.member_event_attendance mea
join public.members m
  on m.id = mea.member_id
join public.events e
  on e.id = mea.event_id
join public.academic_terms t
  on t.id = e.academic_term_id
join public.house_memberships hm
  on hm.member_id = mea.member_id
  and hm.academic_year_start = t.academic_year_start
  and e.date::date >= hm.effective_start_date
  and (hm.effective_end_date is null or e.date::date < hm.effective_end_date)
join public.house_page_assets hp
  on hp.id = hm.house_profile_id
where e.date is not null
  and e.academic_term_id is not null
  and hp.is_active = true
group by
  hp.house_key,
  hp.id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  m.id,
  m.first_name,
  m.last_name,
  m.college,
  m.year,
  m.user_id,
  t.academic_year_start,
  t.academic_year_end;

grant select on public.published_house_page_assets to anon, authenticated;
grant select on public.house_yearly_points to anon, authenticated;
grant select on public.house_all_time_points to anon, authenticated;
grant select on public.house_recent_activity to anon, authenticated;
grant select on public.house_member_yearly_points to anon, authenticated;
grant select on public.house_member_all_time_points to anon, authenticated;
