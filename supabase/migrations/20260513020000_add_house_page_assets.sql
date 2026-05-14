create table if not exists public.house_page_assets (
  id uuid primary key default gen_random_uuid(),
  academic_year_start integer not null,
  academic_year_end integer not null,
  house text not null,
  image_url text,
  image_alt text,
  display_order integer not null default 0,
  source_doc_url text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint house_page_assets_year_span_check check (academic_year_end = academic_year_start + 1),
  constraint house_page_assets_house_check check (house in ('Bowser', 'Donkey Kong', 'Boo', 'Toad')),
  constraint house_page_assets_unique_house_year unique (academic_year_start, house)
);

create index if not exists house_page_assets_year_order_idx
  on public.house_page_assets (academic_year_start desc, display_order asc);

alter table public.house_page_assets enable row level security;

drop trigger if exists update_house_page_assets_updated_at on public.house_page_assets;
create trigger update_house_page_assets_updated_at
  before update on public.house_page_assets
  for each row
  execute function public.update_updated_at_column();

drop policy if exists "Admins can view house page assets" on public.house_page_assets;
create policy "Admins can view house page assets"
  on public.house_page_assets for select
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can insert house page assets" on public.house_page_assets;
create policy "Admins can insert house page assets"
  on public.house_page_assets for insert
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can update house page assets" on public.house_page_assets;
create policy "Admins can update house page assets"
  on public.house_page_assets for update
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

drop policy if exists "Admins can delete house page assets" on public.house_page_assets;
create policy "Admins can delete house page assets"
  on public.house_page_assets for delete
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create or replace view public.published_house_page_assets as
select
  id,
  academic_year_start,
  academic_year_end,
  house,
  image_url,
  image_alt,
  display_order,
  created_at,
  updated_at
from public.house_page_assets;

grant select on public.published_house_page_assets to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('house_images', 'house_images', true)
on conflict (id) do nothing;

drop policy if exists "Allow public read access to house images" on storage.objects;
create policy "Allow public read access to house images"
  on storage.objects for select
  using (bucket_id = 'house_images');

drop policy if exists "Admins can upload house images" on storage.objects;
create policy "Admins can upload house images"
  on storage.objects for insert
  with check (
    bucket_id = 'house_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can update house images" on storage.objects;
create policy "Admins can update house images"
  on storage.objects for update
  using (
    bucket_id = 'house_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    bucket_id = 'house_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can delete house images" on storage.objects;
create policy "Admins can delete house images"
  on storage.objects for delete
  using (
    bucket_id = 'house_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );
