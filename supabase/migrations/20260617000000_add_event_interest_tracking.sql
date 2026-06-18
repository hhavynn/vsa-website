-- Migration: Add Event Interest Tracking
-- Description: Aggregate interest tracking for public events.

-- 1. Create the aggregate table
create table if not exists public.event_interest_counts (
  event_id uuid primary key references public.events(id) on delete cascade,
  interested_count integer not null default 0,
  going_count integer not null default 0,
  updated_at timestamptz not null default now()
);

-- 2. Enable RLS
alter table public.event_interest_counts enable row level security;

-- 3. RLS Policies
create policy "Allow public read access to interest counts for published events"
  on public.event_interest_counts
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.events
      where events.id = event_interest_counts.event_id
      and events.is_published = true
    )
  );

create policy "Admins can view all interest counts"
  on public.event_interest_counts
  for select
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.is_admin = true
    )
  );

-- 4. RPC for recording interest
-- This function is security definer so it can increment counts without broad public write access to the table.
-- It strictly validates that the event is published before allowing an increment.
create or replace function public.record_event_interest(p_event_id uuid, p_signal text)
returns void as $$
begin
  -- Validate signal
  if p_signal not in ('interested', 'going') then
    raise exception 'Invalid signal. Must be "interested" or "going".';
  end if;

  -- Validate event is published
  if not exists (select 1 from public.events where id = p_event_id and is_published = true) then
    raise exception 'Event not found or not published.';
  end if;

  -- Upsert count
  insert into public.event_interest_counts (event_id, interested_count, going_count, updated_at)
  values (
    p_event_id,
    case when p_signal = 'interested' then 1 else 0 end,
    case when p_signal = 'going' then 1 else 0 end,
    now()
  )
  on conflict (event_id)
  do update set
    interested_count = event_interest_counts.interested_count + (case when p_signal = 'interested' then 1 else 0 end),
    going_count = event_interest_counts.going_count + (case when p_signal = 'going' then 1 else 0 end),
    updated_at = now();
end;
$$ language plpgsql security definer;

-- 5. Grant access to RPC
grant execute on function public.record_event_interest(uuid, text) to anon, authenticated;
