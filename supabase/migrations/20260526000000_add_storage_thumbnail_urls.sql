-- Add optional thumbnail URL fields for public card/grid/list rendering.
-- Existing original image URLs remain the fallback for older records.

alter table public.events
  add column if not exists thumbnail_url text;

alter table public.gallery_events
  add column if not exists cover_thumbnail_url text;

alter table public.cabinet_members
  add column if not exists thumbnail_url text;

alter table public.house_page_assets
  add column if not exists image_thumbnail_url text;

alter table public.homepage_content
  add column if not exists presidents_photo_thumbnail_url text;

alter table public.vcn_archives
  add column if not exists cover_thumbnail_url text;

drop view if exists public.published_house_page_assets;

create view public.published_house_page_assets as
select
  id,
  academic_year_start,
  academic_year_end,
  house,
  house_key,
  display_name,
  description,
  image_url,
  image_thumbnail_url,
  image_alt,
  cover_image_url,
  accent_color,
  display_order,
  is_active,
  created_at,
  updated_at
from public.house_page_assets
where is_active = true;

grant select on public.published_house_page_assets to anon, authenticated;

drop view if exists public.published_vcn_archives;

create view public.published_vcn_archives as
select
  id,
  year,
  title,
  annual_number,
  theme_name,
  event_date,
  event_time,
  venue,
  description,
  video_url,
  photo_album_url,
  album_source,
  cover_image_url,
  cover_thumbnail_url,
  poster_url,
  trailer_url,
  photo_credit,
  is_published,
  is_featured,
  is_current,
  ticket_status,
  ticket_url,
  ticket_note,
  display_order,
  created_at,
  updated_at
from public.vcn_archives
where is_published = true;

grant select on public.published_vcn_archives to anon, authenticated;
