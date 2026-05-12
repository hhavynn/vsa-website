-- Foundation for year/quarter archives.
-- This migration is additive: current event and cabinet flows continue to work
-- even before the admin UI starts writing these foreign keys.

create table if not exists public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  academic_year_start integer not null,
  academic_year_end integer not null,
  quarter text not null check (quarter in ('fall', 'winter', 'spring', 'summer')),
  starts_on date,
  ends_on date,
  is_active boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_terms_year_span_check check (academic_year_end = academic_year_start + 1)
);

create unique index if not exists academic_terms_one_active_idx
  on public.academic_terms (is_active)
  where is_active;

create index if not exists academic_terms_year_order_idx
  on public.academic_terms (academic_year_start desc, display_order asc);

create table if not exists public.cabinet_years (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  slug text not null unique,
  start_year integer not null,
  end_year integer not null,
  theme_name text,
  is_active boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cabinet_years_year_span_check check (end_year = start_year + 1)
);

create unique index if not exists cabinet_years_one_active_idx
  on public.cabinet_years (is_active)
  where is_active;

create index if not exists cabinet_years_order_idx
  on public.cabinet_years (start_year desc, display_order asc);

alter table public.events
  add column if not exists academic_term_id uuid references public.academic_terms(id) on delete set null;

alter table public.cabinet_members
  add column if not exists cabinet_year_id uuid references public.cabinet_years(id) on delete set null;

create index if not exists events_academic_term_id_idx
  on public.events (academic_term_id);

create index if not exists cabinet_members_cabinet_year_id_idx
  on public.cabinet_members (cabinet_year_id);

alter table public.academic_terms enable row level security;
alter table public.cabinet_years enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'academic_terms'
      and policyname = 'Anyone can view academic terms'
  ) then
    create policy "Anyone can view academic terms"
      on public.academic_terms for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'academic_terms'
      and policyname = 'Admins can insert academic terms'
  ) then
    create policy "Admins can insert academic terms"
      on public.academic_terms for insert
      with check (
        exists (
          select 1 from public.user_profiles
          where id = auth.uid() and is_admin = true
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'academic_terms'
      and policyname = 'Admins can update academic terms'
  ) then
    create policy "Admins can update academic terms"
      on public.academic_terms for update
      using (
        exists (
          select 1 from public.user_profiles
          where id = auth.uid() and is_admin = true
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'academic_terms'
      and policyname = 'Admins can delete academic terms'
  ) then
    create policy "Admins can delete academic terms"
      on public.academic_terms for delete
      using (
        exists (
          select 1 from public.user_profiles
          where id = auth.uid() and is_admin = true
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'cabinet_years'
      and policyname = 'Anyone can view cabinet years'
  ) then
    create policy "Anyone can view cabinet years"
      on public.cabinet_years for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'cabinet_years'
      and policyname = 'Admins can insert cabinet years'
  ) then
    create policy "Admins can insert cabinet years"
      on public.cabinet_years for insert
      with check (
        exists (
          select 1 from public.user_profiles
          where id = auth.uid() and is_admin = true
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'cabinet_years'
      and policyname = 'Admins can update cabinet years'
  ) then
    create policy "Admins can update cabinet years"
      on public.cabinet_years for update
      using (
        exists (
          select 1 from public.user_profiles
          where id = auth.uid() and is_admin = true
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'cabinet_years'
      and policyname = 'Admins can delete cabinet years'
  ) then
    create policy "Admins can delete cabinet years"
      on public.cabinet_years for delete
      using (
        exists (
          select 1 from public.user_profiles
          where id = auth.uid() and is_admin = true
        )
      );
  end if;
end $$;

with event_terms as (
  select distinct
    case
      when extract(month from date)::int between 9 and 12 then 'fall'
      when extract(month from date)::int between 1 and 3 then 'winter'
      when extract(month from date)::int between 4 and 6 then 'spring'
      else 'summer'
    end as quarter,
    case
      when extract(month from date)::int between 9 and 12 then extract(year from date)::int
      else extract(year from date)::int - 1
    end as academic_year_start,
    extract(year from date)::int as calendar_year
  from public.events
  where date is not null
),
normalized_terms as (
  select
    case quarter
      when 'fall' then 'FA'
      when 'winter' then 'WI'
      when 'spring' then 'SP'
      else 'SU'
    end || right(calendar_year::text, 2) as code,
    initcap(quarter) || ' ' || calendar_year::text as label,
    academic_year_start,
    academic_year_start + 1 as academic_year_end,
    quarter,
    case quarter
      when 'fall' then make_date(calendar_year, 9, 1)
      when 'winter' then make_date(calendar_year, 1, 1)
      when 'spring' then make_date(calendar_year, 4, 1)
      else make_date(calendar_year, 7, 1)
    end as starts_on,
    case quarter
      when 'fall' then make_date(calendar_year, 12, 31)
      when 'winter' then make_date(calendar_year, 3, 31)
      when 'spring' then make_date(calendar_year, 6, 30)
      else make_date(calendar_year, 8, 31)
    end as ends_on,
    academic_year_start * 10 + case quarter
      when 'fall' then 1
      when 'winter' then 2
      when 'spring' then 3
      else 4
    end as display_order
  from event_terms
)
insert into public.academic_terms (
  code,
  label,
  academic_year_start,
  academic_year_end,
  quarter,
  starts_on,
  ends_on,
  display_order
)
select
  code,
  label,
  academic_year_start,
  academic_year_end,
  quarter,
  starts_on,
  ends_on,
  display_order
from normalized_terms
on conflict (code) do update
set
  label = excluded.label,
  academic_year_start = excluded.academic_year_start,
  academic_year_end = excluded.academic_year_end,
  quarter = excluded.quarter,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  display_order = excluded.display_order,
  updated_at = now();

update public.events as e
set academic_term_id = t.id
from public.academic_terms as t
where e.academic_term_id is null
  and t.code =
    case
      when extract(month from e.date)::int between 9 and 12 then 'FA'
      when extract(month from e.date)::int between 1 and 3 then 'WI'
      when extract(month from e.date)::int between 4 and 6 then 'SP'
      else 'SU'
    end || right(extract(year from e.date)::int::text, 2);

insert into public.cabinet_years (
  label,
  slug,
  start_year,
  end_year,
  is_active,
  display_order
)
values (
  '2025-2026 Cabinet',
  '2025-2026',
  2025,
  2026,
  not exists (select 1 from public.cabinet_years where is_active),
  2025
)
on conflict (slug) do update
set
  label = excluded.label,
  start_year = excluded.start_year,
  end_year = excluded.end_year,
  display_order = excluded.display_order,
  updated_at = now();

update public.cabinet_members
set cabinet_year_id = (
  select id from public.cabinet_years where slug = '2025-2026'
)
where cabinet_year_id is null;
