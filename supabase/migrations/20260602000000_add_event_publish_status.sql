-- Add publish status for regular VSA events.
-- Existing events stay public; admins can explicitly hide drafts.

alter table public.events
  add column if not exists is_published boolean not null default true;

create index if not exists events_published_date_idx
  on public.events (date asc)
  where is_published = true;

drop policy if exists "Events are viewable by everyone" on public.events;
create policy "Events are viewable by everyone"
  on public.events
  for select
  using (is_published = true);

drop policy if exists "Admins can view all events" on public.events;
create policy "Admins can view all events"
  on public.events
  for select
  using (
    exists (
      select 1
      from public.user_profiles
      where id = auth.uid()
        and is_admin = true
    )
  );
