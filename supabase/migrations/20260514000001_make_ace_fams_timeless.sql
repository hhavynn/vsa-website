-- ACE families are timeless. Keep legacy year columns for compatibility, but
-- stop requiring them for new or imported fams.

alter table public.ace_families
  alter column academic_year_start drop not null,
  alter column academic_year_end drop not null;

alter table public.ace_families
  drop constraint if exists ace_families_year_span_check;

alter table public.ace_families
  drop constraint if exists ace_families_unique_slug_per_year;

create index if not exists ace_families_slug_idx
  on public.ace_families (slug);
