insert into public.cabinet_years (
  label,
  slug,
  start_year,
  end_year,
  is_active,
  display_order
)
values (
  '2026-2027 Cabinet',
  '2026-2027',
  2026,
  2027,
  false,
  2026
)
on conflict (slug) do update
set
  label = excluded.label,
  start_year = excluded.start_year,
  end_year = excluded.end_year,
  display_order = excluded.display_order,
  updated_at = now();
