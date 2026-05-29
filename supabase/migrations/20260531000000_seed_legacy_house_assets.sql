-- Seed legacy House profiles for archive display.
-- This migration is idempotent and does not overwrite existing image assets or events.

do $$
begin
  -- 2018-2019: Superhero Era
  insert into public.house_page_assets (academic_year_start, academic_year_end, house, house_key, display_name, accent_color, display_order)
  values
    (2018, 2019, 'Flash', 'flash', 'Flash', '#e74c3c', 0),
    (2018, 2019, 'Iron', 'iron', 'Iron', '#7f8c8d', 1),
    (2018, 2019, 'Loki', 'loki', 'Loki', '#27ae60', 2),
    (2018, 2019, 'Light', 'light', 'Light', '#f1c40f', 3)
  on conflict (academic_year_start, house_key) do nothing;

  -- 2019-2020: Streetwear Era
  insert into public.house_page_assets (academic_year_start, academic_year_end, house, house_key, display_name, accent_color, display_order)
  values
    (2019, 2020, 'Gucci', 'gucci', 'Gucci', '#2d5a27', 0),
    (2019, 2020, 'CDG', 'cdg', 'Comme des Garçons', '#000000', 1),
    (2019, 2020, 'Supreme', 'supreme', 'Supreme', '#ed1c24', 2),
    (2019, 2020, 'YSL', 'ysl', 'Yves Saint Laurent', '#000000', 3)
  on conflict (academic_year_start, house_key) do nothing;

  -- 2021-2022: Four Holy Beasts Era
  insert into public.house_page_assets (academic_year_start, academic_year_end, house, house_key, display_name, accent_color, display_order)
  values
    (2021, 2022, 'Phoenix', 'phoenix', 'Phoenix', '#e67e22', 0),
    (2021, 2022, 'Unicorn', 'unicorn', 'Unicorn', '#e6e6fa', 1),
    (2021, 2022, 'Dragon', 'dragon', 'Dragon', '#228b22', 2),
    (2021, 2022, 'Tortoise', 'tortoise', 'Tortoise', '#008080', 3)
  on conflict (academic_year_start, house_key) do nothing;

  -- 2022-2023: Pokemon Era
  insert into public.house_page_assets (academic_year_start, academic_year_end, house, house_key, display_name, accent_color, display_order)
  values
    (2022, 2023, 'Squirtle', 'squirtle', 'Squirtle', '#3498db', 0),
    (2022, 2023, 'Pikachu', 'pikachu', 'Pikachu', '#f1c40f', 1),
    (2022, 2023, 'Bulbasaur', 'bulbasaur', 'Bulbasaur', '#2ecc71', 2),
    (2022, 2023, 'Charmander', 'charmander', 'Charmander', '#e67e22', 3)
  on conflict (academic_year_start, house_key) do nothing;

  -- 2023-2024: Drink Era
  insert into public.house_page_assets (academic_year_start, academic_year_end, house, house_key, display_name, accent_color, display_order)
  values
    (2023, 2024, 'Ca Phe Sua Da', 'ca-phe-sua-da', 'Ca Phe Sua Da', '#6f4e37', 0),
    (2023, 2024, 'Banana Milk', 'banana-milk', 'Banana Milk', '#fff44f', 1),
    (2023, 2024, 'Matcha', 'matcha', 'Matcha', '#74c365', 2),
    (2023, 2024, 'Yakult', 'yakult', 'Yakult', '#ed1c24', 3)
  on conflict (academic_year_start, house_key) do nothing;

  -- 2024-2025: Sanrio Era
  -- If existing rows exist, we only update safe display fields if they are null.
  insert into public.house_page_assets (academic_year_start, academic_year_end, house, house_key, display_name, accent_color, display_order)
  values
    (2024, 2025, 'Badtz-maru', 'badtz-maru', 'Badtz-maru', '#000000', 0),
    (2024, 2025, 'Keroppi', 'keroppi', 'Keroppi', '#32cd32', 1),
    (2024, 2025, 'Kuromi', 'kuromi', 'Kuromi', '#800080', 2)
  on conflict (academic_year_start, house_key) do update
  set
    accent_color = coalesce(house_page_assets.accent_color, excluded.accent_color),
    display_name = coalesce(house_page_assets.display_name, excluded.display_name);
end $$;
