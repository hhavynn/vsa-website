-- Restore 2025-2026 House images and data.
-- This fixes a regression where current house images were lost or replaced by fallbacks.

do $$
begin
  -- 1. Ensure 2025-2026 Houses use consistent lowercase house_key for reliable slugging.
  update public.house_page_assets set house_key = 'bowser' where academic_year_start = 2025 and lower(house) = 'bowser';
  update public.house_page_assets set house_key = 'donkey-kong' where academic_year_start = 2025 and (lower(house) = 'donkey kong' or house = 'donkey-kong');
  update public.house_page_assets set house_key = 'boo' where academic_year_start = 2025 and lower(house) = 'boo';
  update public.house_page_assets set house_key = 'toad' where academic_year_start = 2025 and lower(house) = 'toad';

  -- 2. Restore images and taglines for 2025-2026.
  -- We use the static assets that were already migrated to the repo.
  
  -- Bowser
  update public.house_page_assets
  set
    image_url = coalesce(image_url, '/images/houses/2025_bowser.webp'),
    description = coalesce(description, 'Big boss energy. Show up, dominate, repeat.'),
    emoji = coalesce(emoji, '🐢'),
    accent_color = coalesce(accent_color, '#f97316'),
    is_active = true
  where academic_year_start = 2025 and house_key = 'bowser';

  -- Donkey Kong
  update public.house_page_assets
  set
    image_url = coalesce(image_url, '/images/houses/2025_donkey-kong.webp'),
    description = coalesce(description, 'Loud, wild, and impossible to ignore.'),
    emoji = coalesce(emoji, '🦍'),
    accent_color = coalesce(accent_color, '#eab308'),
    is_active = true
  where academic_year_start = 2025 and house_key = 'donkey-kong';

  -- Boo
  update public.house_page_assets
  set
    image_url = coalesce(image_url, '/images/houses/2025_boo.webp'),
    description = coalesce(description, 'Silent… until it''s time to go off.'),
    emoji = coalesce(emoji, '👻'),
    accent_color = coalesce(accent_color, '#94a3b8'),
    is_active = true
  where academic_year_start = 2025 and house_key = 'boo';

  -- Toad
  update public.house_page_assets
  set
    image_url = coalesce(image_url, '/images/houses/2025_toad.webp'),
    description = coalesce(description, 'Small but mighty. Always ahead of the curve.'),
    emoji = coalesce(emoji, '🍄'),
    accent_color = coalesce(accent_color, '#ef4444'),
    is_active = true
  where academic_year_start = 2025 and house_key = 'toad';

  -- 3. Cleanup: If any rows still exist for 2025 that aren't the official four, deactivate them.
  -- We don't delete them yet to be safe, but we hide them from the public view.
  update public.house_page_assets
  set is_active = false
  where academic_year_start = 2025
    and house_key not in ('bowser', 'donkey-kong', 'boo', 'toad');

end $$;
