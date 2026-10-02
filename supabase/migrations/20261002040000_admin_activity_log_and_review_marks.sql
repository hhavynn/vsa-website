-- Admin quality-of-life (Phase 4): an append-only admin activity log and
-- "reviewed" marks for yearly-operations draft rows.
--
-- Access boundary: admin only (public.is_admin_user). Neither table is readable
-- or writable by anon, and nothing here is reachable from a public page.
--
-- admin_activity_log
--   A lightweight "what changed" trail for operational edits (ACE assignment,
--   House assignment, Cabinet, Interns, member links, year setup). It is
--   append-only: there is no UPDATE or DELETE policy, so an entry can never be
--   rewritten. Undo is recorded as a NEW entry that points at the original.
--   `summary` and `metadata` carry concise operational facts only (names, a
--   before/after label, record ids). The client never stores whole rows,
--   emails, or any other sensitive column here; the size checks below are a
--   backstop, not the privacy control.
--
-- admin_review_marks
--   One row per draft row an admin has marked "reviewed" in a bulk or inline
--   action. It is advisory: it never gates publish, lock, or reveal. It lives
--   in its own table so the four draft tables, their guard triggers, and the
--   publish RPCs stay untouched.
--
-- Additive only. No existing table, view, function, policy, or grant changes.
-- Apply manually after staging verification (see MIGRATION_CHECKLIST.md).

-- ─── admin_activity_log ──────────────────────────────────────────────────────

create table if not exists public.admin_activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid default auth.uid() references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  academic_year_start integer,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_activity_log_action_check
    check (action ~ '^[a-z_]+\.[a-z_]+$' and char_length(action) <= 80),
  constraint admin_activity_log_entity_type_check
    check (entity_type ~ '^[a-z_]+$' and char_length(entity_type) <= 60),
  constraint admin_activity_log_summary_check
    check (char_length(summary) between 1 and 300),
  constraint admin_activity_log_metadata_check
    check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 4000),
  constraint admin_activity_log_year_check
    check (academic_year_start is null or academic_year_start between 2000 and 2200)
);

create index if not exists admin_activity_log_created_idx
  on public.admin_activity_log (created_at desc);

create index if not exists admin_activity_log_year_created_idx
  on public.admin_activity_log (academic_year_start, created_at desc);

alter table public.admin_activity_log enable row level security;

revoke all on public.admin_activity_log from anon, authenticated;
grant select, insert on public.admin_activity_log to authenticated;

drop policy if exists "Admins can view admin activity" on public.admin_activity_log;
create policy "Admins can view admin activity"
  on public.admin_activity_log
  for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

-- An admin can only record activity as themselves (or without an actor).
drop policy if exists "Admins can record admin activity" on public.admin_activity_log;
create policy "Admins can record admin activity"
  on public.admin_activity_log
  for insert
  to authenticated
  with check (
    public.is_admin_user(auth.uid())
    and (actor_user_id is null or actor_user_id = auth.uid())
  );

-- ─── admin_review_marks ──────────────────────────────────────────────────────

create table if not exists public.admin_review_marks (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  academic_year_start integer,
  reviewed_by uuid default auth.uid() references auth.users(id) on delete set null,
  reviewed_at timestamptz not null default now(),
  constraint admin_review_marks_entity_type_check
    check (entity_type in (
      'ace_assignment_draft',
      'house_assignment_draft',
      'intern_cohort_draft',
      'cabinet_roster_draft'
    )),
  constraint admin_review_marks_unique unique (entity_type, entity_id)
);

create index if not exists admin_review_marks_year_idx
  on public.admin_review_marks (academic_year_start, entity_type);

alter table public.admin_review_marks enable row level security;

revoke all on public.admin_review_marks from anon, authenticated;
grant select, insert, delete on public.admin_review_marks to authenticated;

drop policy if exists "Admins can view review marks" on public.admin_review_marks;
create policy "Admins can view review marks"
  on public.admin_review_marks
  for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can add review marks" on public.admin_review_marks;
create policy "Admins can add review marks"
  on public.admin_review_marks
  for insert
  to authenticated
  with check (
    public.is_admin_user(auth.uid())
    and (reviewed_by is null or reviewed_by = auth.uid())
  );

drop policy if exists "Admins can remove review marks" on public.admin_review_marks;
create policy "Admins can remove review marks"
  on public.admin_review_marks
  for delete
  to authenticated
  using (public.is_admin_user(auth.uid()));
