create table if not exists public.house_events (
  id uuid primary key default gen_random_uuid(),
  house_profile_id uuid not null references public.house_page_assets(id) on delete restrict,
  academic_year_start integer not null,
  academic_year_end integer not null,
  title text not null,
  slug text,
  description text,
  event_date date not null,
  start_time time without time zone,
  end_time time without time zone,
  location text,
  image_url text,
  image_thumbnail_url text,
  gallery_url text,
  recap_url text,
  rsvp_url text,
  google_calendar_enabled boolean not null default true,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint house_events_year_span_check check (academic_year_end = academic_year_start + 1),
  constraint house_events_time_range_check check (
    start_time is null
    or end_time is null
    or end_time > start_time
  )
);

create index if not exists house_events_profile_date_idx
  on public.house_events (house_profile_id, event_date desc);

create index if not exists house_events_year_date_idx
  on public.house_events (academic_year_start desc, event_date asc)
  where is_published = true;

create index if not exists house_events_published_date_idx
  on public.house_events (event_date asc)
  where is_published = true;

drop trigger if exists update_house_events_updated_at on public.house_events;
create trigger update_house_events_updated_at
  before update on public.house_events
  for each row
  execute function public.update_updated_at_column();

alter table public.house_events enable row level security;

drop policy if exists "Public can view published house events" on public.house_events;
create policy "Public can view published house events"
  on public.house_events for select
  using (is_published = true);

drop policy if exists "Admins can view house events" on public.house_events;
create policy "Admins can view house events"
  on public.house_events for select
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can insert house events" on public.house_events;
create policy "Admins can insert house events"
  on public.house_events for insert
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can update house events" on public.house_events;
create policy "Admins can update house events"
  on public.house_events for update
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

drop policy if exists "Admins can delete house events" on public.house_events;
create policy "Admins can delete house events"
  on public.house_events for delete
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );
