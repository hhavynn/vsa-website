-- Add emoji column to house_page_assets
-- This allows legacy and current houses to have custom icons/emojis in the UI.

alter table public.house_page_assets
  add column if not exists emoji text;

-- Update the published view to include the emoji column
create or replace view public.published_house_page_assets as
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
  emoji,
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

-- Backfill emojis for current 2025-2026 Mario houses if they exist
update public.house_page_assets set emoji = '🐢' where academic_year_start = 2025 and house = 'Bowser';
update public.house_page_assets set emoji = '🦍' where academic_year_start = 2025 and house = 'Donkey Kong';
update public.house_page_assets set emoji = '👻' where academic_year_start = 2025 and house = 'Boo';
update public.house_page_assets set emoji = '🍄' where academic_year_start = 2025 and house = 'Toad';
