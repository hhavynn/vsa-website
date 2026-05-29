-- House Parent announcement content belongs to a specific House profile/year.
-- These fields support poster-style graphics first, with optional copy for public display.

alter table public.house_page_assets
  add column if not exists house_parent_image_url text,
  add column if not exists house_parent_heading text,
  add column if not exists house_parent_body text;

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
  house_parent_image_url,
  house_parent_heading,
  house_parent_body,
  created_at,
  updated_at
from public.house_page_assets
where is_active = true;

grant select on public.published_house_page_assets to anon, authenticated;
