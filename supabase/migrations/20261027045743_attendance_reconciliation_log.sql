-- Private audit log for bulk attendance reconciliations.
--
-- WHY
--   Reconciling attendance in bulk (credits inserted, wrong credits removed,
--   duplicate member records merged) must leave a recoverable record of what
--   each source row became and why. One row per source row, plus one row per
--   removed credit / merge / profile correction with a JSON backup of what was
--   changed, so any single change can be traced or undone by hand.
--
-- WHAT (additive; nothing existing is changed)
--   attendance_reconciliation_log   append-only audit rows. Ids are plain uuids
--                                   (no foreign keys) so the record survives a
--                                   merged-away or removed member.
--
-- SECURITY
--   Holds names and emails of students, so: RLS on, admin-only SELECT, nothing
--   for anon, no client writes. Rows are written by the reconciliation run
--   (service/postgres role). Never exposed through a public view.
--
-- DEPLOY: independent of the frontend; apply before running a reconciliation.

begin;

create table if not exists public.attendance_reconciliation_log (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  event_id uuid not null,
  -- The "Source Row" column of the cleaned sign-in sheet; null for event-level actions.
  source_row integer,
  outcome text not null check (outcome in (
    'credit_inserted',        -- existing member matched, credit added
    'already_credited',       -- existing member matched, credit already present
    'new_member_credit',      -- member created and credited
    'duplicate_submission',   -- repeat of a person already counted in the same sheet
    'corrected_assignment',   -- row now credits the right member (a wrong credit was removed)
    'pending_review',         -- an admin must pick the identity
    'invalid_row',            -- no usable name
    'credit_removed',         -- event-level: attendance credit removed (backup holds the row)
    'members_merged',         -- event-level: duplicate member record merged away (backup holds it)
    'profile_corrected',      -- event-level: member profile field corrected (backup holds old values)
    'resolved_by_admin'       -- a pending row an admin later decided
  )),
  member_id uuid,
  related_member_id uuid,
  submitted_name text,
  submitted_emails text[] not null default '{}',
  submitted_college text,
  submitted_year text,
  rule text,
  note text,
  candidate_member_ids uuid[] not null default '{}',
  backup jsonb,
  created_at timestamptz not null default now()
);

create index if not exists attendance_reconciliation_log_event_idx
  on public.attendance_reconciliation_log (event_id, outcome);
create index if not exists attendance_reconciliation_log_run_idx
  on public.attendance_reconciliation_log (run_id);

comment on table public.attendance_reconciliation_log is
  'Private audit of bulk attendance reconciliations (admin-only; contains student names and emails).';

alter table public.attendance_reconciliation_log enable row level security;

revoke all on public.attendance_reconciliation_log from public, anon, authenticated;
grant select on public.attendance_reconciliation_log to authenticated;

drop policy if exists "Admins read attendance reconciliation log" on public.attendance_reconciliation_log;
create policy "Admins read attendance reconciliation log" on public.attendance_reconciliation_log
  for select to authenticated using (public.is_admin_user(auth.uid()));

commit;
