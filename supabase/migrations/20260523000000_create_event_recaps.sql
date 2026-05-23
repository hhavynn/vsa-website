-- Internal event recap notes for preserving VSA institutional memory.
-- Full recap rows are admin-only. Public highlights should be exposed later
-- through a narrow view or RPC, not by granting public table reads.

create table if not exists public.event_recaps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  owner_names text,
  cabinet_roles text,
  attendance_notes text,
  what_worked text,
  what_failed text,
  next_time_improvements text,
  budget_notes text,
  aftersocial_notes text,
  risks_issues text,
  drive_folder_url text,
  planning_doc_url text,
  gallery_event_id uuid references public.gallery_events(id) on delete set null,
  public_highlight text,
  is_public_highlight_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_recaps_event_id_key unique (event_id)
);

create index if not exists event_recaps_event_id_idx
  on public.event_recaps(event_id);

create index if not exists event_recaps_gallery_event_id_idx
  on public.event_recaps(gallery_event_id);

alter table public.event_recaps enable row level security;

drop trigger if exists update_event_recaps_updated_at on public.event_recaps;
create trigger update_event_recaps_updated_at
  before update on public.event_recaps
  for each row
  execute function public.update_updated_at_column();

drop policy if exists "Admins can view event recaps" on public.event_recaps;
drop policy if exists "Admins can insert event recaps" on public.event_recaps;
drop policy if exists "Admins can update event recaps" on public.event_recaps;
drop policy if exists "Admins can delete event recaps" on public.event_recaps;

create policy "Admins can view event recaps"
  on public.event_recaps for select
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can insert event recaps"
  on public.event_recaps for insert
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can update event recaps"
  on public.event_recaps for update
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

create policy "Admins can delete event recaps"
  on public.event_recaps for delete
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );
