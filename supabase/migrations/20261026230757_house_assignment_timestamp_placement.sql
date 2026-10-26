-- Timestamp-priority automatic House placement metadata.
--
-- Applied to production 2026-10-26 (schema_migrations version 20261026230757)
-- via apply_migration; renamed from 20261026180000 to match.
--
-- Admin -> Houses can now generate a draft batch from a Google Forms House
-- application export: applicants are placed earliest-submission first into
-- their highest-ranked House with room. The draft still goes through the
-- existing review -> lock -> reveal workflow; nothing here writes
-- house_memberships.
--
-- Additive only. Every new column is nullable or defaulted, so existing manual
-- batches keep behaving exactly as before (assignment_method = 'manual').
-- No table, policy, grant, trigger or view is replaced: both tables keep the
-- admin-only RLS from 20261001213414_create_house_assignment_batches.sql, and
-- the draft-only mutation guard trigger keeps covering the new columns.
--
-- Privacy: no email, phone, birthday, allergy or other form answer is stored.
-- Email is used only in the browser for duplicate detection and member
-- matching. submission_timestamp and source_row_number record each
-- applicant's place in line; excluded_applicants records only the sheet row,
-- the name already shown in the draft, and the admin's reason.
--
-- Deploy order: apply this migration first, then ship the frontend. Until it
-- is applied, saving an automatic placement fails (column missing) before any
-- row is written; manual imports are unaffected because they never send the
-- new columns.

alter table public.house_assignment_batches
  add column if not exists assignment_method text not null default 'manual',
  -- { "<house_page_assets.id>": <integer capacity>, ... }
  add column if not exists capacity_config jsonb,
  -- [{ "source_row_number": 12, "name": "...", "reason": "..." }, ...]
  add column if not exists excluded_applicants jsonb;

alter table public.house_assignment_batches
  drop constraint if exists house_assignment_batches_assignment_method_check;
alter table public.house_assignment_batches
  add constraint house_assignment_batches_assignment_method_check
    check (assignment_method in ('manual', 'timestamp_ranked'));

alter table public.house_assignment_batches
  drop constraint if exists house_assignment_batches_capacity_config_check;
alter table public.house_assignment_batches
  add constraint house_assignment_batches_capacity_config_check
    check (capacity_config is null or jsonb_typeof(capacity_config) = 'object');

alter table public.house_assignment_batches
  drop constraint if exists house_assignment_batches_excluded_applicants_check;
alter table public.house_assignment_batches
  add constraint house_assignment_batches_excluded_applicants_check
    check (excluded_applicants is null or jsonb_typeof(excluded_applicants) = 'array');

alter table public.house_assignment_drafts
  -- Original form submission instant (the sheet's America/Los_Angeles
  -- wall-clock time converted to UTC).
  add column if not exists submission_timestamp timestamptz,
  -- 1-based row in the Form responses sheet; breaks exact timestamp ties.
  add column if not exists source_row_number integer,
  -- The House the allocator chose, kept so a manual override never hides the
  -- policy outcome.
  add column if not exists generated_house_profile_id uuid
    references public.house_page_assets(id) on delete set null,
  -- Required whenever an admin moves an automatically placed applicant.
  add column if not exists override_reason text;

alter table public.house_assignment_drafts
  drop constraint if exists house_assignment_drafts_source_row_number_check;
alter table public.house_assignment_drafts
  add constraint house_assignment_drafts_source_row_number_check
    check (source_row_number is null or source_row_number >= 1);

comment on column public.house_assignment_batches.assignment_method is
  'manual (pasted/CSV sheet) or timestamp_ranked (first-come, first-served by ranked preference).';
comment on column public.house_assignment_batches.capacity_config is
  'timestamp_ranked only: House profile id -> integer capacity used for the placement.';
comment on column public.house_assignment_batches.excluded_applicants is
  'timestamp_ranked only: applicants an admin left out, with sheet row, name and reason. No contact data.';
comment on column public.house_assignment_drafts.submission_timestamp is
  'timestamp_ranked only: original form submission instant; source_order holds the resulting priority.';
comment on column public.house_assignment_drafts.generated_house_profile_id is
  'timestamp_ranked only: the allocator''s House. Differs from house_profile_id only after a documented override.';
