-- Restore 2025-2026 House images and data.
-- This fixes a regression where current house images were lost or replaced by fallbacks.

do $$
begin
  -- 1. Ensure 2025-2026 Houses exist with consistent lowercase house_key and correct labels.
  -- We use the original display names (capitalized) for the 'house' column to match old constraints,
  -- and predictable lowercase 'house_key' for slugging.
  
  -- Bowser
  insert into public.house_page_assets (academic_year_start, academic_year_end, house, house_key, display_name, description, accent_color, image_url, emoji, display_order, is_active)
  values (2025, 2026, 'Bowser', 'bowser', 'Bowser', 'Big boss energy. Show up, dominate, repeat.', '#f97316', '/images/houses/2025_bowser.webp', '🐢', 0, true)
  on conflict (academic_year_start, house) do update
  set
    house_key = 'bowser',
    display_name = 'Bowser',
    image_url = case 
      when house_page_assets.image_url is null or house_page_assets.image_url = '' then '/images/houses/2025_bowser.webp' 
      else house_page_assets.image_url 
    end,
    description = coalesce(house_page_assets.description, excluded.description),
    emoji = coalesce(house_page_assets.emoji, excluded.emoji),
    accent_color = coalesce(house_page_assets.accent_color, excluded.accent_color),
    is_active = true;

  -- Donkey Kong
  insert into public.house_page_assets (academic_year_start, academic_year_end, house, house_key, display_name, description, accent_color, image_url, emoji, display_order, is_active)
  values (2025, 2026, 'Donkey Kong', 'donkey-kong', 'Donkey Kong', 'Loud, wild, and impossible to ignore.', '#eab308', '/images/houses/2025_donkey-kong.webp', '🦍', 1, true)
  on conflict (academic_year_start, house) do update
  set
    house_key = 'donkey-kong',
    display_name = 'Donkey Kong',
    image_url = case 
      when house_page_assets.image_url is null or house_page_assets.image_url = '' then '/images/houses/2025_donkey-kong.webp' 
      else house_page_assets.image_url 
    end,
    description = coalesce(house_page_assets.description, excluded.description),
    emoji = coalesce(house_page_assets.emoji, excluded.emoji),
    accent_color = coalesce(house_page_assets.accent_color, excluded.accent_color),
    is_active = true;

  -- Boo
  insert into public.house_page_assets (academic_year_start, academic_year_end, house, house_key, display_name, description, accent_color, image_url, emoji, display_order, is_active)
  values (2025, 2026, 'Boo', 'boo', 'Boo', 'Silent… until it''s time to go off.', '#94a3b8', '/images/houses/2025_boo.webp', '👻', 2, true)
  on conflict (academic_year_start, house) do update
  set
    house_key = 'boo',
    display_name = 'Boo',
    image_url = case 
      when house_page_assets.image_url is null or house_page_assets.image_url = '' then '/images/houses/2025_boo.webp' 
      else house_page_assets.image_url 
    end,
    description = coalesce(house_page_assets.description, excluded.description),
    emoji = coalesce(house_page_assets.emoji, excluded.emoji),
    accent_color = coalesce(house_page_assets.accent_color, excluded.accent_color),
    is_active = true;

  -- Toad
  insert into public.house_page_assets (academic_year_start, academic_year_end, house, house_key, display_name, description, accent_color, image_url, emoji, display_order, is_active)
  values (2025, 2026, 'Toad', 'toad', 'Toad', 'Small but mighty. Always ahead of the curve.', '#ef4444', '/images/houses/2025_toad.webp', '🍄', 3, true)
  on conflict (academic_year_start, house) do update
  set
    house_key = 'toad',
    display_name = 'Toad',
    image_url = case 
      when house_page_assets.image_url is null or house_page_assets.image_url = '' then '/images/houses/2025_toad.webp' 
      else house_page_assets.image_url 
    end,
    description = coalesce(house_page_assets.description, excluded.description),
    emoji = coalesce(house_page_assets.emoji, excluded.emoji),
    accent_color = coalesce(house_page_assets.accent_color, excluded.accent_color),
    is_active = true;

  -- 2. Secondary cleanup: Ensure no duplicates with lowercase 'house' names if they were created by mistake
  update public.house_page_assets set is_active = false
  where academic_year_start = 2025
    and house not in ('Bowser', 'Donkey Kong', 'Boo', 'Toad')
    and house_key not in ('bowser', 'donkey-kong', 'boo', 'toad');

end $$;
