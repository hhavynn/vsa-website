-- Site-wide settings table (logo URL, etc.)
-- Admins can update via /admin/settings; read is public.

create table if not exists site_settings (
  id          text primary key,
  logo_url    text,
  logo_alt    text not null default 'VSA at UC San Diego',
  updated_at  timestamptz not null default now()
);

-- Seed the single global row
insert into site_settings (id) values ('global')
on conflict (id) do nothing;

-- RLS
alter table site_settings enable row level security;

create policy "Public can read site settings"
  on site_settings for select
  using (true);

create policy "Admins can update site settings"
  on site_settings for update
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Storage bucket for site asset uploads (logos, etc.)
insert into storage.buckets (id, name, public)
values ('site_assets', 'site_assets', true)
on conflict (id) do nothing;

create policy "Public can read site assets"
  on storage.objects for select
  using (bucket_id = 'site_assets');

create policy "Admins can upload site assets"
  on storage.objects for insert
  with check (
    bucket_id = 'site_assets'
    and exists (
      select 1 from user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can delete site assets"
  on storage.objects for delete
  using (
    bucket_id = 'site_assets'
    and exists (
      select 1 from user_profiles
      where id = auth.uid() and is_admin = true
    )
  );
