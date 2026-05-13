-- Add optional house assignment support for imported members.
-- House is intentionally nullable because not every member joins a house.
alter table public.members
  add column if not exists house text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'members_house_valid'
      and conrelid = 'public.members'::regclass
  ) then
    alter table public.members
      add constraint members_house_valid
      check (
        house is null
        or house in ('Bowser', 'Donkey Kong', 'Boo', 'Toad')
      );
  end if;
end $$;

create index if not exists members_house_idx
  on public.members (house)
  where house is not null;

-- Preserve house assignment when duplicate member records are merged.
create or replace function public.smart_merge_members(p_source_id uuid, p_target_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_source record;
  v_target record;
begin
  select * into v_source from public.members where id = p_source_id;
  select * into v_target from public.members where id = p_target_id;

  if v_source.id is null or v_target.id is null then
    raise exception 'Source or target member not found.';
  end if;

  update public.members
  set
    college = coalesce(v_target.college, v_source.college),
    year = coalesce(v_target.year, v_source.year),
    house = coalesce(v_target.house, v_source.house),
    email = coalesce(v_target.email, v_source.email),
    updated_at = now()
  where id = p_target_id;

  insert into public.member_event_attendance (member_id, event_id, points_earned, imported_at)
  select p_target_id, event_id, points_earned, imported_at
  from public.member_event_attendance
  where member_id = p_source_id
  on conflict (member_id, event_id) do nothing;

  delete from public.members where id = p_source_id;
end;
$$;

-- Yearly house totals use the imported attendance system only:
-- members -> member_event_attendance -> events -> academic_terms.
create or replace view public.house_yearly_points as
select
  m.house,
  t.academic_year_start,
  t.academic_year_end,
  sum(mea.points_earned)::int as total_points,
  count(*)::int as events_attended,
  count(distinct mea.event_id)::int as unique_events,
  count(distinct m.id)::int as unique_members,
  round(
    sum(mea.points_earned)::numeric / nullif(count(distinct m.id), 0),
    2
  ) as average_points_per_member,
  max(coalesce(mea.imported_at, e.date)) as latest_activity_at
from public.members m
join public.member_event_attendance mea
  on mea.member_id = m.id
join public.events e
  on e.id = mea.event_id
join public.academic_terms t
  on t.id = e.academic_term_id
where nullif(trim(m.house), '') is not null
group by
  m.house,
  t.academic_year_start,
  t.academic_year_end;

create or replace view public.house_all_time_points as
select
  m.house,
  sum(m.points)::int as total_points,
  sum(m.events_attended)::int as events_attended,
  count(*)::int as unique_members,
  round(
    sum(m.points)::numeric / nullif(count(*), 0),
    2
  ) as average_points_per_member,
  max(m.updated_at) as latest_activity_at
from public.members m
where nullif(trim(m.house), '') is not null
group by m.house;

create or replace view public.house_recent_activity as
select
  m.house,
  e.id as event_id,
  e.name as event_name,
  e.date as event_date,
  t.academic_year_start,
  t.academic_year_end,
  sum(mea.points_earned)::int as total_points,
  count(distinct m.id)::int as contributing_members,
  max(coalesce(mea.imported_at, e.date)) as latest_activity_at
from public.members m
join public.member_event_attendance mea
  on mea.member_id = m.id
join public.events e
  on e.id = mea.event_id
join public.academic_terms t
  on t.id = e.academic_term_id
where nullif(trim(m.house), '') is not null
group by
  m.house,
  e.id,
  e.name,
  e.date,
  t.academic_year_start,
  t.academic_year_end;

grant select on public.house_yearly_points to anon, authenticated;
grant select on public.house_all_time_points to anon, authenticated;
grant select on public.house_recent_activity to anon, authenticated;
