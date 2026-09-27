-- Enforce NOT NULL on columns that have a default and have never held NULL.
--
-- APPLIED to production 2026-09-27 (schema_migrations version 20260927220043)
-- after a rolled-back dry run; the filename matches the recorded version.
--
-- These columns were created nullable only because their DEFAULT made the
-- constraint look redundant. The generated types therefore mark them
-- `| null`, which forced the app to cast rows into its domain types at the
-- repository boundary (#421, #424). Enforcing NOT NULL makes the database
-- state what the app already assumes.
--
-- Pre-checks against production on 2026-09-27:
--   * every column below held 0 NULLs;
--   * every writer (admin forms, repos, Edge Functions, scripts, and all
--     public-schema SQL functions) sends a real value or omits the key, so no
--     insert or update passes an explicit NULL. A default does not apply to
--     an explicit NULL, so this was the case that mattered.
--
-- Deliberately excluded:
--   * points / attendance columns (event_attendance.points_earned,
--     user_points.last_updated) and members.needs_review -- protected domains;
--   * user_profiles.is_admin -- auth-critical, left to its own change;
--   * created_by columns defaulting to auth.uid() -- NULL when a service-role
--     job writes;
--   * member_photo_request_events.actor -- already holds NULLs;
--   * unused legacy tables (achievements, check_ins, check_in_codes,
--     check_in_code_usage).

alter table public.events
  alter column created_at set not null,
  alter column updated_at set not null,
  alter column is_code_expired set not null,
  alter column points set not null;

alter table public.external_events
  alter column created_at set not null,
  alter column updated_at set not null,
  alter column confidence_level set not null,
  alter column is_featured set not null,
  alter column points set not null,
  alter column status set not null;

alter table public.uvsa_schools
  alter column created_at set not null,
  alter column updated_at set not null,
  alter column confidence_level set not null,
  alter column is_active set not null,
  alter column known_for set not null,
  alter column recurring_events set not null,
  alter column sort_order set not null;

alter table public.feedback
  alter column created_at set not null,
  alter column updated_at set not null;

alter table public.house_event_houses
  alter column created_at set not null;

alter table public.uvsa_network_page_settings
  alter column updated_at set not null;
