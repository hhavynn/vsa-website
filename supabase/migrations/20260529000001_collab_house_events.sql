-- Migration to support collab House events (many-to-many)
-- One House event can belong to multiple Houses.

create table if not exists public.house_event_houses (
  house_event_id uuid not null references public.house_events(id) on delete cascade,
  house_page_asset_id uuid not null references public.house_page_assets(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (house_event_id, house_page_asset_id)
);

-- Backfill existing single-house associations
insert into public.house_event_houses (house_event_id, house_page_asset_id)
select id, house_profile_id from public.house_events
on conflict do nothing;

-- Add indexes for better query performance
create index if not exists house_event_houses_event_id_idx on public.house_event_houses(house_event_id);
create index if not exists house_event_houses_house_id_idx on public.house_event_houses(house_page_asset_id);

-- Enable RLS
alter table public.house_event_houses enable row level security;

-- Policies
drop policy if exists "Public can view house event associations" on public.house_event_houses;
create policy "Public can view house event associations"
  on public.house_event_houses for select
  using (
    exists (
      select 1 from public.house_events
      where id = house_event_houses.house_event_id
      and is_published = true
    )
  );

drop policy if exists "Admins can manage house event associations" on public.house_event_houses;
create policy "Admins can manage house event associations"
  on public.house_event_houses for all
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
