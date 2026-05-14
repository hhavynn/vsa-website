create table if not exists public.intern_cohort_members (
  id uuid primary key default gen_random_uuid(),
  academic_year_start integer not null,
  academic_year_end integer not null,
  name text not null,
  photo_url text,
  role_or_track text,
  caption text,
  display_order integer not null default 0,
  is_published boolean not null default false,
  source_doc_url text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intern_cohort_members_year_span_check check (academic_year_end = academic_year_start + 1)
);

create index if not exists intern_cohort_members_year_order_idx
  on public.intern_cohort_members (academic_year_start desc, display_order asc, created_at asc);

create index if not exists intern_cohort_members_published_idx
  on public.intern_cohort_members (academic_year_start, is_published)
  where is_published = true;

alter table public.intern_cohort_members enable row level security;

drop trigger if exists update_intern_cohort_members_updated_at on public.intern_cohort_members;
create trigger update_intern_cohort_members_updated_at
  before update on public.intern_cohort_members
  for each row
  execute function public.update_updated_at_column();

drop policy if exists "Admins can view intern cohort members" on public.intern_cohort_members;
create policy "Admins can view intern cohort members"
  on public.intern_cohort_members for select
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can insert intern cohort members" on public.intern_cohort_members;
create policy "Admins can insert intern cohort members"
  on public.intern_cohort_members for insert
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can update intern cohort members" on public.intern_cohort_members;
create policy "Admins can update intern cohort members"
  on public.intern_cohort_members for update
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

drop policy if exists "Admins can delete intern cohort members" on public.intern_cohort_members;
create policy "Admins can delete intern cohort members"
  on public.intern_cohort_members for delete
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create or replace view public.published_intern_cohort_members as
select
  id,
  academic_year_start,
  academic_year_end,
  name,
  photo_url,
  role_or_track,
  caption,
  display_order,
  created_at,
  updated_at
from public.intern_cohort_members
where is_published = true;

grant select on public.published_intern_cohort_members to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('intern_images', 'intern_images', true)
on conflict (id) do nothing;

drop policy if exists "Allow public read access to intern images" on storage.objects;
create policy "Allow public read access to intern images"
  on storage.objects for select
  using (bucket_id = 'intern_images');

drop policy if exists "Admins can upload intern images" on storage.objects;
create policy "Admins can upload intern images"
  on storage.objects for insert
  with check (
    bucket_id = 'intern_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can update intern images" on storage.objects;
create policy "Admins can update intern images"
  on storage.objects for update
  using (
    bucket_id = 'intern_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    bucket_id = 'intern_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can delete intern images" on storage.objects;
create policy "Admins can delete intern images"
  on storage.objects for delete
  using (
    bucket_id = 'intern_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );
