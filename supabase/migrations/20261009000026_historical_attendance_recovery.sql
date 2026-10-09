-- Historical attendance recovery (follow-up to #518 and the #519 audit).
--
-- Lets an admin act on one flagged import_job_rows row at a time: credit the
-- confirmed existing member, create a separate member, credit the correct member
-- for a row that was matched to the wrong one, dismiss the finding, or mark it as
-- needing more information. Nothing here runs automatically or in bulk, nothing
-- infers identity from a name, and NOTHING HERE DELETES ATTENDANCE.
--
-- Objects
--   import_recovery_actions            immutable history, one row per admin action
--   admin_import_recovery_findings()   read-only evidence per audited import row
--   admin_recover_import_row(...)      the only writer; one transaction per action
--
-- Access boundary: admin only. anon and non-admin users can neither read the
-- history nor execute either function. Admins can read the history but cannot
-- write it: it is written only by admin_recover_import_row, and a trigger rejects
-- every UPDATE, DELETE and TRUNCATE, whoever runs it (service_role and SECURITY
-- DEFINER code included). History columns hold plain ids, not foreign keys, so no
-- cascade from deleting a member, event, user or import job can rewrite them.
--
-- Why SECURITY DEFINER for admin_recover_import_row: it must write the history
-- table, which has no client write grant. It checks public.is_admin_user()
-- before reading anything, pins search_path to '' and schema-qualifies every
-- reference. The read function is SECURITY INVOKER and still checks admin.
--
-- Points: attendance is only ever inserted, into member_event_attendance with
-- the event's current points (the event row is read FOR SHARE so a concurrent
-- points edit cannot leave the new row at the old value). The existing
-- trg_sync_member_points trigger recalculates cached totals; no cached total is
-- written here. UNIQUE(member_id, event_id) plus ON CONFLICT DO NOTHING means a
-- member can never be credited twice for one event.
--
-- Wrong matches are never corrected destructively. member_event_attendance has
-- no provenance: the importer sets import_job_rows.attendance_member_id even when
-- its upsert inserted nothing, records only per-job counts, and the Admin Members
-- editor writes no audit trail. No timestamp or counter can prove that a given
-- attendance row exists only because of the bad match, and even if it could, the
-- originally credited member may have genuinely attended (their own sheet row may
-- have been skipped). So "Correct incorrect match" credits the correct member,
-- keeps the original credit, and puts the finding in an "investigating" state.
-- An admin who confirms the original member did not attend removes that credit
-- in Admin Members (the existing confirmed path), then resolves the
-- investigation here; the resolution verifies the ledger matches what it records.
--
-- Concurrency and idempotency: the import row is locked FOR UPDATE, the caller
-- must name the latest action it saw (stale callers are rejected), every call
-- carries a client request id (a replay of the same request returns the
-- original result without writing; a reused id with different parameters is
-- refused), and the history enforces one successor per action. Every attendance
-- insert takes a transaction advisory lock per member, so two recoveries for one
-- member (on any events) never compute that member's total from snapshots that
-- miss each other's rows. New-member emails are serialized by another advisory
-- lock. Both locks cover this function only: the importer and Admin Members do
-- not take them, and members.email has no unique index.
--
-- Additive only: no existing table, policy, grant, trigger or function changes.
-- import_job_rows is never modified. Safe to apply before the frontend that uses
-- it. Apply manually after staging verification (scripts/test-attendance-recovery.sh,
-- MIGRATION_CHECKLIST.md).

-- ─── Guard against an earlier draft ─────────────────────────────────────────
-- A first draft of this migration (never applied to production; checked
-- 2026-10-08) had a destructive "move". If it is present anywhere, stop rather
-- than leave its 10-argument writer callable beside this one.
do $guard$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'import_recovery_actions'
               and column_name = 'removed_attendance') then
    raise exception 'An earlier draft of import_recovery_actions is present; reconcile it manually before applying this migration';
  end if;
end
$guard$;
drop function if exists public.admin_recover_import_row(uuid, uuid, text, uuid, uuid, uuid, jsonb, boolean, text, text);

-- ─── History ────────────────────────────────────────────────────────────────

create table if not exists public.import_recovery_actions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  request_fingerprint text not null,
  import_job_row_id uuid not null,
  import_job_id uuid,
  previous_action_id uuid references public.import_recovery_actions(id),
  action text not null,
  resulting_status text not null,
  outcome text not null,
  event_id uuid,
  member_id uuid,
  from_member_id uuid,
  created_member boolean not null default false,
  attendance_id uuid,
  points_awarded integer not null default 0,
  reason_code text,
  note text,
  actor_user_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint import_recovery_actions_request_unique unique (request_id),
  constraint import_recovery_actions_one_successor unique nulls not distinct (import_job_row_id, previous_action_id),
  constraint import_recovery_actions_action_check
    check (action in ('restore', 'create_member', 'reassign', 'resolve_investigation', 'dismiss', 'needs_info', 'reopen')),
  constraint import_recovery_actions_status_check
    check (resulting_status in ('recovered', 'investigating', 'dismissed', 'needs_info', 'open')),
  constraint import_recovery_actions_outcome_check
    check (outcome in (
      'attendance_added', 'already_recorded', 'correct_member_credited', 'correct_member_already_credited',
      'original_removed', 'original_attended', 'dismissed', 'needs_info', 'reopened'
    )),
  constraint import_recovery_actions_reason_check
    check (reason_code is null or reason_code in (
      'identity_confirmed', 'different_person', 'wrong_member_credited', 'original_removed', 'original_attended',
      'intentional_skip', 'legitimate_duplicate', 'not_actionable', 'more_info_needed', 'reopened'
    )),
  constraint import_recovery_actions_note_check check (note is null or char_length(note) <= 500)
);

create index if not exists import_recovery_actions_row_idx
  on public.import_recovery_actions (import_job_row_id, created_at);
create index if not exists import_recovery_actions_created_idx
  on public.import_recovery_actions (created_at desc);
create index if not exists import_recovery_actions_previous_idx
  on public.import_recovery_actions (previous_action_id);

alter table public.import_recovery_actions enable row level security;

revoke all on public.import_recovery_actions from public, anon, authenticated;
grant select on public.import_recovery_actions to authenticated;
-- service_role keeps read access for scripts but cannot write history either.
do $roles$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke insert, update, delete, truncate on public.import_recovery_actions from service_role';
  end if;
end
$roles$;

drop policy if exists "Admins can view import recovery actions" on public.import_recovery_actions;
create policy "Admins can view import recovery actions"
  on public.import_recovery_actions
  for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

-- Immutable: corrections are new entries. Changing this requires a reviewed
-- migration that drops these triggers, which is itself visible and auditable.
create or replace function public.import_recovery_actions_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Recovery history is append-only; record a new entry instead' using errcode = '42501';
end;
$$;

revoke all on function public.import_recovery_actions_immutable() from public, anon, authenticated;

drop trigger if exists import_recovery_actions_no_update_delete on public.import_recovery_actions;
create trigger import_recovery_actions_no_update_delete
  before update or delete on public.import_recovery_actions
  for each row execute function public.import_recovery_actions_immutable();

drop trigger if exists import_recovery_actions_no_truncate on public.import_recovery_actions;
create trigger import_recovery_actions_no_truncate
  before truncate on public.import_recovery_actions
  for each statement execute function public.import_recovery_actions_immutable();

-- ─── Findings (read only) ───────────────────────────────────────────────────
-- Evidence per audited import row, with the same meaning as the evidence CTE in
-- scripts/audit-import-history.sql, plus one addition: a finding recovered (or
-- credited pending investigation) to a member who still has the attendance
-- counts as identity evidence for other
-- rows with the same email ("resolved_elsewhere"), so a twin row is not offered
-- for a second credit. Classification happens in the client with the tested
-- src/lib/importHistoryAudit.ts. Correlated per-member scans are rewritten as
-- grouped joins: the audit script's shape took 4.2 s on production data
-- (1,320 rows, 1,005 members) against the 8 s authenticated statement timeout.
-- Returns one jsonb array so the PostgREST row cap cannot truncate it.

create or replace function public.admin_import_recovery_findings()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can review historical import findings' using errcode = '42501';
  end if;

  with base as (
    select
      r.id as row_id, r.import_job_id, r.event_id, r.source_row_index, r.decision,
      r.attendance_member_id, r.matched_member_id, r.created_member_id, r.display_name, r.csv_email, r.csv_college, r.csv_year,
      r.match_details as md, j.status as job_status, j.created_at as job_created_at,
      lower(trim(regexp_replace(coalesce(r.display_name, ''), '[^A-Za-z ]', '', 'g'))) as norm_name,
      lower(trim(coalesce(r.csv_email, ''))) as norm_email,
      lower(trim(coalesce(r.csv_year, ''))) as norm_year,
      lower(trim(coalesce(r.csv_college, ''))) as norm_college
    from public.import_job_rows r
    join public.import_jobs j on j.id = r.import_job_id
  ),
  member_norm as (
    select m.id, lower(trim(coalesce(m.email, ''))) as norm_email,
      lower(trim(regexp_replace(m.first_name || ' ' || m.last_name, '[^A-Za-z ]', '', 'g'))) as norm_name
    from public.members m
  ),
  name_counts as (
    select norm_name, count(*) as n from member_norm where norm_name <> '' group by norm_name
  ),
  member_emails as (
    select distinct norm_email from member_norm where norm_email <> ''
  ),
  email_attended as (
    select distinct mn.norm_email, a.event_id
    from member_norm mn join public.member_event_attendance a on a.member_id = mn.id
    where mn.norm_email <> ''
  ),
  -- Rows whose credited member still has attendance for the row's event.
  credited as (
    select b.row_id, b.import_job_id, b.event_id, b.source_row_index, b.norm_email, b.norm_name, b.job_status
    from base b
    join public.member_event_attendance a on a.member_id = b.attendance_member_id and a.event_id = b.event_id
  ),
  latest_recovered as (
    select ra.import_job_row_id as row_id, ra.member_id
    from public.import_recovery_actions ra
    where ra.resulting_status in ('recovered', 'investigating')
      and not exists (select 1 from public.import_recovery_actions n where n.previous_action_id = ra.id)
  ),
  recovered_credit as (
    select b.row_id, b.event_id, b.norm_email
    from base b
    join latest_recovered lr on lr.row_id = b.row_id
    join public.member_event_attendance a on a.member_id = lr.member_id and a.event_id = b.event_id
  ),
  elsewhere as (
    select b.row_id
    from base b
    join (
      select row_id, event_id, norm_email from credited where job_status = 'completed'
      union all
      select row_id, event_id, norm_email from recovered_credit
    ) c on c.event_id = b.event_id and c.norm_email = b.norm_email and c.row_id <> b.row_id
    where b.norm_email <> ''
    group by b.row_id
  ),
  twin_email as (
    select b.row_id from base b
    join credited c on c.import_job_id = b.import_job_id and c.norm_email = b.norm_email and c.source_row_index < b.source_row_index
    where b.norm_email <> '' group by b.row_id
  ),
  twin_name as (
    select b.row_id from base b
    join credited c on c.import_job_id = b.import_job_id and c.norm_name = b.norm_name and c.source_row_index < b.source_row_index
    where b.norm_name <> '' group by b.row_id
  ),
  candidate_ids as (
    select b.row_id, b.event_id, b.matched_member_id as member_id from base b where b.matched_member_id is not null
    union
    select b.row_id, b.event_id, c.value::uuid
    from base b
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(b.md -> 'candidate_member_ids') = 'array' then b.md -> 'candidate_member_ids' else '[]'::jsonb end) c(value)
    where c.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  -- Latest history entry per row, and whether the member it credited still has
  -- the attendance (an admin can remove it later in Admin Members).
  latest_action as (
    select ra.import_job_row_id as row_id, ra.member_id, ra.from_member_id, ra.outcome
    from public.import_recovery_actions ra
    where ra.resulting_status in ('recovered', 'investigating') and ra.member_id is not null
      and not exists (select 1 from public.import_recovery_actions n where n.previous_action_id = ra.id)
  ),
  candidate_attended as (
    select ci.row_id from candidate_ids ci
    join public.member_event_attendance a on a.member_id = ci.member_id and a.event_id = ci.event_id
    group by ci.row_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'row_id', b.row_id,
      'import_job_id', b.import_job_id,
      'job_status', b.job_status,
      'job_created_at', b.job_created_at,
      'event_id', b.event_id,
      'event_name', ev.name,
      'event_date', ev.date,
      'source_row_index', b.source_row_index,
      'decision', b.decision,
      'display_name', b.display_name,
      'csv_email', b.csv_email,
      'csv_college', b.csv_college,
      'csv_year', b.csv_year,
      'attendance_member_id', b.attendance_member_id,
      'matched_member_id', b.matched_member_id,
      'match_reason', b.md ->> 'match_reason',
      'final_reason', b.md ->> 'final_reason',
      'match_method', b.md ->> 'match_method',
      'manual_decision', coalesce(
        case when b.md -> 'manual_decision' ->> 'kind' in ('match', 'new', 'skip') then b.md -> 'manual_decision' ->> 'kind' end,
        case b.md ->> 'manual_override' when 'force-match' then 'match' when 'mark-new' then 'new' end),
      'name_score', case when b.md ->> 'name_score' ~ '^-?[0-9]+(\.[0-9]+)?$' then (b.md ->> 'name_score')::numeric end,
      'candidate_count', case when jsonb_typeof(b.md -> 'candidate_member_ids') = 'array'
                              then jsonb_array_length(b.md -> 'candidate_member_ids') else 0 end,
      'can_mark_new', case when jsonb_typeof(b.md -> 'can_mark_new') = 'boolean' then (b.md ->> 'can_mark_new')::boolean end,
      'has_csv_email', b.norm_email <> '',
      'attendance_exists', case when b.attendance_member_id is null then null else cr.row_id is not null end,
      'matched_member_attended', mma.member_id is not null,
      'email_member_attended', ea.norm_email is not null,
      'candidate_attended', ca.row_id is not null,
      'resolved_elsewhere', el.row_id is not null,
      'duplicate_twin_attended', case when te.row_id is not null then 'email' when tn.row_id is not null then 'name' end,
      'email_in_members', me.norm_email is not null,
      'exact_name_members', coalesce(nc.n, 0),
      'email_conflict', coalesce(b.norm_email <> '' and coalesce(mm.email, '') <> '' and lower(trim(mm.email)) <> b.norm_email, false),
      'email_conflict_both_school', coalesce(b.norm_email <> '' and coalesce(mm.email, '') <> '' and lower(trim(mm.email)) <> b.norm_email
        and split_part(b.norm_email, '@', 2) ~ '(^|\.)ucsd\.edu$'
        and split_part(lower(trim(mm.email)), '@', 2) ~ '(^|\.)ucsd\.edu$', false),
      'year_differs', coalesce(b.norm_year <> '' and coalesce(mm.year, '') <> '' and lower(trim(mm.year)) <> b.norm_year, false),
      'college_differs', coalesce(b.norm_college <> '' and coalesce(mm.college, '') <> '' and lower(trim(mm.college)) <> b.norm_college, false),
      'recovered_credit_present', case when la.row_id is null then null else lca.member_id is not null end,
      -- An investigation resolved as "original also attended" claims that credit stays.
      'original_credit_present', case when la.outcome = 'original_attended' then oca.member_id is not null end,
      'created_member_id', b.created_member_id,
      'candidate_member_ids', case when jsonb_typeof(b.md -> 'candidate_member_ids') = 'array' then b.md -> 'candidate_member_ids' else '[]'::jsonb end
    ) order by b.job_created_at, b.import_job_id, b.source_row_index), '[]'::jsonb)
  into v_result
  from base b
  left join public.events ev on ev.id = b.event_id
  left join public.members mm on mm.id = b.matched_member_id
  left join credited cr on cr.row_id = b.row_id
  left join public.member_event_attendance mma on mma.member_id = b.matched_member_id and mma.event_id = b.event_id
  left join email_attended ea on b.norm_email <> '' and ea.norm_email = b.norm_email and ea.event_id = b.event_id
  left join candidate_attended ca on ca.row_id = b.row_id
  left join elsewhere el on el.row_id = b.row_id
  left join twin_email te on te.row_id = b.row_id
  left join twin_name tn on tn.row_id = b.row_id
  left join member_emails me on b.norm_email <> '' and me.norm_email = b.norm_email
  left join name_counts nc on b.norm_name <> '' and nc.norm_name = b.norm_name
  left join latest_action la on la.row_id = b.row_id
  left join public.member_event_attendance lca on lca.member_id = la.member_id and lca.event_id = b.event_id
  left join public.member_event_attendance oca on oca.member_id = la.from_member_id and oca.event_id = b.event_id;

  return v_result;
end;
$$;

revoke all on function public.admin_import_recovery_findings() from public, anon;
grant execute on function public.admin_import_recovery_findings() to authenticated;

-- ─── Recovery (the only writer) ─────────────────────────────────────────────
--
-- p_action          restore | create_member | reassign | resolve_investigation
--                   | dismiss | needs_info | reopen
-- p_expected_previous_action_id
--                   the latest history entry the admin reviewed for this row (null if none)
-- p_member_id       restore: confirmed existing member; reassign: correct member
-- p_from_member_id  reassign: the member the row currently credits (kept, flagged)
-- p_new_member      create_member: {first_name, last_name, email?, college?, year?}
-- p_reason_code     dismiss: intentional_skip | legitimate_duplicate | not_actionable
--                   resolve_investigation: original_removed | original_attended

create or replace function public.admin_recover_import_row(
  p_request_id uuid,
  p_row_id uuid,
  p_action text,
  p_expected_previous_action_id uuid default null,
  p_member_id uuid default null,
  p_from_member_id uuid default null,
  p_new_member jsonb default null,
  p_reason_code text default null,
  p_note text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_prior public.import_recovery_actions%rowtype;
  v_latest public.import_recovery_actions%rowtype;
  v_row public.import_job_rows%rowtype;
  v_job_status text;
  v_event_name text;
  v_event_points integer := 0;
  v_status text;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_fingerprint text;
  v_member_id uuid;
  v_member_name text;
  v_from_id uuid;
  v_from_name text;
  v_created boolean := false;
  v_attendance_id uuid;
  v_points integer := 0;
  v_outcome text;
  v_new_status text;
  v_reason text;
  v_first text;
  v_last text;
  v_email text;
  v_existing uuid;
  v_action_id uuid;
  v_activity text;
  v_summary text;
begin
  if not public.is_admin_user(v_uid) then
    raise exception 'Only admins can recover historical attendance' using errcode = '42501';
  end if;
  if p_request_id is null or p_row_id is null then
    raise exception 'A request id and an import row are required' using errcode = 'P0001';
  end if;
  if p_action is null or p_action not in ('restore', 'create_member', 'reassign', 'resolve_investigation', 'dismiss', 'needs_info', 'reopen') then
    raise exception 'Unknown recovery action' using errcode = 'P0001';
  end if;
  if char_length(coalesce(v_note, '')) > 500 then
    raise exception 'Notes are limited to 500 characters' using errcode = 'P0001';
  end if;
  v_fingerprint := md5(concat_ws('|', p_action, coalesce(p_member_id::text, ''), coalesce(p_from_member_id::text, ''),
    coalesce(p_new_member::text, ''), coalesce(p_reason_code, ''), coalesce(v_note, '')));

  -- Serialize every action on this finding.
  select * into v_row from public.import_job_rows where id = p_row_id for update;
  if not found then
    raise exception 'Import row not found' using errcode = 'P0001';
  end if;

  -- A replay of a request that already committed returns its result unchanged.
  select * into v_prior from public.import_recovery_actions where request_id = p_request_id;
  if found then
    if v_prior.import_job_row_id <> p_row_id or v_prior.request_fingerprint <> v_fingerprint then
      raise exception 'This request id was already used for a different recovery' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'action_id', v_prior.id, 'status', v_prior.resulting_status, 'outcome', v_prior.outcome,
      'member_id', v_prior.member_id, 'from_member_id', v_prior.from_member_id,
      'created_member', v_prior.created_member, 'attendance_id', v_prior.attendance_id,
      'points_awarded', v_prior.points_awarded, 'replayed', true);
  end if;

  select a.* into v_latest
  from public.import_recovery_actions a
  where a.import_job_row_id = p_row_id
    and not exists (select 1 from public.import_recovery_actions n where n.previous_action_id = a.id);
  if v_latest.id is distinct from p_expected_previous_action_id then
    raise exception 'This finding changed since you opened it. Refresh and review it again.'
      using errcode = 'P0001', hint = 'stale_finding';
  end if;
  v_status := coalesce(v_latest.resulting_status, 'open');

  if p_action in ('restore', 'create_member', 'reassign', 'dismiss', 'needs_info') and v_status not in ('open', 'needs_info') then
    raise exception 'This finding is already %; it cannot be changed with this action', v_status
      using errcode = 'P0001', hint = 'finding_closed';
  end if;
  if p_action = 'resolve_investigation' and v_status <> 'investigating' then
    raise exception 'Only a finding under investigation can be resolved' using errcode = 'P0001', hint = 'finding_closed';
  end if;
  -- A recovered (or investigating) finding reopens only when the ledger no longer
  -- holds the credit it recorded, i.e. someone removed it in Admin Members. Then
  -- the history would otherwise claim a credit that does not exist.
  if p_action = 'reopen' and not coalesce(
       v_status in ('dismissed', 'needs_info')
       or (v_status in ('recovered', 'investigating') and v_latest.member_id is not null
           and not exists (select 1 from public.member_event_attendance a
                           where a.member_id = v_latest.member_id and a.event_id = v_row.event_id))
       or (coalesce(v_latest.outcome, '') = 'original_attended'
           and not exists (select 1 from public.member_event_attendance a
                           where a.member_id = v_latest.from_member_id and a.event_id = v_row.event_id)), false) then
    raise exception 'This finding cannot be reopened: its recorded credit is still in place. Change that attendance in Admin Members.'
      using errcode = 'P0001', hint = 'finding_closed';
  end if;

  -- Attendance-writing actions need the event and a completed import job. The
  -- event row is held FOR SHARE until commit, so a concurrent points edit either
  -- finishes first (and we read its value) or waits and then cascades to our row.
  if p_action in ('restore', 'create_member', 'reassign') then
    select status into v_job_status from public.import_jobs where id = v_row.import_job_id;
    if v_job_status is distinct from 'completed' then
      raise exception 'Rows from a failed import cannot be recovered here; re-run the import' using errcode = 'P0001';
    end if;
    if v_row.event_id is null then
      raise exception 'This row has no event, so attendance cannot be restored' using errcode = 'P0001';
    end if;
    select e.name, coalesce(e.points, 0) into v_event_name, v_event_points
    from public.events e where e.id = v_row.event_id for share;
    if not found then
      raise exception 'The event for this row no longer exists' using errcode = 'P0001';
    end if;
  else
    select e.name into v_event_name from public.events e where e.id = v_row.event_id;
  end if;

  if p_action in ('restore', 'create_member')
     and v_row.attendance_member_id is not null
     and exists (select 1 from public.member_event_attendance a
                 where a.member_id = v_row.attendance_member_id and a.event_id = v_row.event_id) then
    raise exception 'This row already credits a member for the event; use Correct match instead'
      using errcode = 'P0001', hint = 'row_already_credited';
  end if;

  if p_action = 'restore' then
    if p_member_id is null then
      raise exception 'Choose the confirmed member' using errcode = 'P0001';
    end if;
    -- Member advisory lock first, then the members row: two recoveries for one
    -- member queue on the advisory lock and never deadlock on the row.
    perform pg_advisory_xact_lock(hashtextextended('vsa-member-points:' || p_member_id::text, 0));
    -- Then the members row itself: if another writer (importer, Admin Members)
    -- has just changed this member's attendance, wait for it to commit, so the
    -- points trigger below recalculates from a snapshot that includes it.
    select m.id, trim(m.first_name || ' ' || m.last_name) into v_member_id, v_member_name
    from public.members m where m.id = p_member_id for no key update;
    if not found then
      raise exception 'The selected member no longer exists' using errcode = 'P0001';
    end if;
    v_reason := 'identity_confirmed';

  elsif p_action = 'create_member' then
    if p_new_member is null or jsonb_typeof(p_new_member) <> 'object' then
      raise exception 'New member details are required' using errcode = 'P0001';
    end if;
    v_first := trim(coalesce(p_new_member ->> 'first_name', ''));
    v_last := trim(coalesce(p_new_member ->> 'last_name', ''));
    v_email := nullif(lower(trim(coalesce(p_new_member ->> 'email', ''))), '');
    if v_first = '' or v_last = '' or char_length(v_first) > 100 or char_length(v_last) > 100 then
      raise exception 'A first and last name (up to 100 characters each) are required' using errcode = 'P0001';
    end if;
    if v_email is not null then
      if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
        raise exception 'The email address is not valid' using errcode = 'P0001';
      end if;
      -- Two admins creating the same email at once would both pass the check below.
      perform pg_advisory_xact_lock(hashtextextended('vsa-member-email:' || v_email, 0));
      select m.id into v_existing from public.members m where lower(trim(m.email)) = v_email limit 1;
      if found then
        raise exception 'A member already has this email. Match that member, or create the new member without an email.'
          using errcode = 'P0001', hint = 'email_in_use:' || v_existing::text;
      end if;
    end if;
    insert into public.members (first_name, last_name, email, college, year)
    values (
      v_first, v_last, v_email,
      nullif(left(trim(coalesce(p_new_member ->> 'college', '')), 100), ''),
      nullif(left(trim(coalesce(p_new_member ->> 'year', '')), 40), ''))
    returning id into v_member_id;
    v_member_name := v_first || ' ' || v_last;
    v_created := true;
    v_reason := 'different_person';

  elsif p_action = 'reassign' then
    if p_member_id is null or p_from_member_id is null then
      raise exception 'Choose the correct member and confirm the original one' using errcode = 'P0001';
    end if;
    if p_member_id = p_from_member_id then
      raise exception 'The correct member must be different from the original one' using errcode = 'P0001';
    end if;
    if v_row.attendance_member_id is distinct from p_from_member_id then
      raise exception 'This row no longer credits the member you reviewed. Refresh and review it again.'
        using errcode = 'P0001', hint = 'stale_finding';
    end if;
    if not exists (select 1 from public.member_event_attendance a
                   where a.member_id = p_from_member_id and a.event_id = v_row.event_id) then
      raise exception 'The original member no longer has this attendance, so this is not a wrong match any more. Use Match existing member instead.'
        using errcode = 'P0001', hint = 'original_missing';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('vsa-member-points:' || p_member_id::text, 0));
    -- Then the members row itself: if another writer (importer, Admin Members)
    -- has just changed this member's attendance, wait for it to commit, so the
    -- points trigger below recalculates from a snapshot that includes it.
    select m.id, trim(m.first_name || ' ' || m.last_name) into v_member_id, v_member_name
    from public.members m where m.id = p_member_id for no key update;
    if not found then
      raise exception 'The selected member no longer exists' using errcode = 'P0001';
    end if;
    select trim(m.first_name || ' ' || m.last_name) into v_from_name from public.members m where m.id = p_from_member_id;
    v_from_id := p_from_member_id;
    v_reason := 'wrong_member_credited';

  elsif p_action = 'resolve_investigation' then
    if p_reason_code is null or p_reason_code not in ('original_removed', 'original_attended') then
      raise exception 'Choose what the investigation found' using errcode = 'P0001';
    end if;
    if v_note is null then
      raise exception 'Record the evidence for this decision' using errcode = 'P0001';
    end if;
    v_from_id := v_latest.from_member_id;
    v_member_id := v_latest.member_id;
    select trim(m.first_name || ' ' || m.last_name) into v_from_name from public.members m where m.id = v_from_id;
    -- The entry must describe the ledger as it is, not as the admin believes it is.
    if p_reason_code = 'original_removed' and exists (
         select 1 from public.member_event_attendance a where a.member_id = v_from_id and a.event_id = v_row.event_id) then
      raise exception 'The original member still has this attendance. Remove it in Admin Members first, then resolve.'
        using errcode = 'P0001', hint = 'original_still_credited';
    end if;
    if p_reason_code = 'original_attended' and not exists (
         select 1 from public.member_event_attendance a where a.member_id = v_from_id and a.event_id = v_row.event_id) then
      raise exception 'The original member no longer has this attendance; record it as removed instead.'
        using errcode = 'P0001', hint = 'original_missing';
    end if;
    v_reason := p_reason_code;
    v_outcome := p_reason_code;
    v_new_status := 'recovered';

  elsif p_action = 'dismiss' then
    if p_reason_code is null or p_reason_code not in ('intentional_skip', 'legitimate_duplicate', 'not_actionable') then
      raise exception 'Choose why this finding is dismissed' using errcode = 'P0001';
    end if;
    if p_reason_code = 'not_actionable' and v_note is null then
      raise exception 'Explain why this finding is not actionable' using errcode = 'P0001';
    end if;
    v_reason := p_reason_code;
    v_outcome := 'dismissed';
    v_new_status := 'dismissed';

  elsif p_action = 'needs_info' then
    if v_note is null then
      raise exception 'Note what information is missing' using errcode = 'P0001';
    end if;
    v_reason := 'more_info_needed';
    v_outcome := 'needs_info';
    v_new_status := 'needs_info';

  else
    v_reason := 'reopened';
    v_outcome := 'reopened';
    v_new_status := 'open';
  end if;

  -- The only attendance write: an insert. Restore and reassign already hold the
  -- per-member lock, so the trigger's total for this member includes every other
  -- recovery's committed row (a brand-new member has no other rows).
  if p_action in ('restore', 'create_member', 'reassign') then
    insert into public.member_event_attendance (member_id, event_id, points_earned)
    values (v_member_id, v_row.event_id, v_event_points)
    on conflict (member_id, event_id) do nothing
    returning id into v_attendance_id;
    v_points := case when v_attendance_id is null then 0 else v_event_points end;
    if p_action = 'reassign' then
      v_outcome := case when v_attendance_id is null then 'correct_member_already_credited' else 'correct_member_credited' end;
      v_new_status := 'investigating';
    else
      v_outcome := case when v_attendance_id is null then 'already_recorded' else 'attendance_added' end;
      v_new_status := 'recovered';
    end if;
  end if;

  insert into public.import_recovery_actions (
    request_id, request_fingerprint, import_job_row_id, import_job_id, previous_action_id, action, resulting_status, outcome,
    event_id, member_id, from_member_id, created_member, attendance_id, points_awarded, reason_code, note, actor_user_id)
  values (
    p_request_id, v_fingerprint, p_row_id, v_row.import_job_id, v_latest.id, p_action, v_new_status, v_outcome,
    v_row.event_id, v_member_id, v_from_id, v_created, v_attendance_id, v_points, v_reason, v_note, v_uid)
  returning id into v_action_id;

  v_activity := case p_action
    when 'reassign' then 'member.recovery_credit_flagged'
    when 'resolve_investigation' then 'member.recovery_investigation_resolved'
    when 'dismiss' then 'member.recovery_dismissed'
    when 'needs_info' then 'member.recovery_on_hold'
    when 'reopen' then 'member.recovery_reopened'
    else 'member.attendance_recovered' end;
  v_summary := case
    when p_action = 'reassign' then
      format('Credited %s at %s; kept %s''s credit for investigation (import row %s)',
        v_member_name, coalesce(v_event_name, 'an event'), coalesce(v_from_name, 'a member'), v_row.source_row_index + 2)
    when p_action = 'resolve_investigation' then
      format('Investigation resolved: %s %s at %s (import row %s)', coalesce(v_from_name, 'the original member'),
        case when p_reason_code = 'original_removed' then 'did not attend; credit was removed' else 'also attended; credit kept' end,
        coalesce(v_event_name, 'an event'), v_row.source_row_index + 2)
    when p_action in ('restore', 'create_member') then
      format('%s %s at %s%s (import row %s)',
        case when v_outcome = 'already_recorded' then 'Confirmed existing attendance for' else 'Restored attendance for' end,
        v_member_name, coalesce(v_event_name, 'an event'),
        case when v_created then ' as a new member' else '' end, v_row.source_row_index + 2)
    when p_action = 'dismiss' then
      format('Dismissed import finding (%s), row %s', replace(v_reason, '_', ' '), v_row.source_row_index + 2)
    when p_action = 'needs_info' then
      format('Put import finding on hold for more information, row %s', v_row.source_row_index + 2)
    else format('Reopened import finding, row %s', v_row.source_row_index + 2)
  end;

  insert into public.admin_activity_log (actor_user_id, action, entity_type, entity_id, summary, metadata)
  values (v_uid, v_activity, 'import_job_row', p_row_id, left(v_summary, 300), jsonb_build_object(
    'recovery_action_id', v_action_id,
    'import_job_id', v_row.import_job_id,
    'event_id', v_row.event_id,
    'member_id', v_member_id,
    'from_member_id', v_from_id,
    'created_member', v_created,
    'attendance_id', v_attendance_id,
    'points_awarded', v_points,
    'outcome', v_outcome,
    'reason', v_reason));

  return jsonb_build_object(
    'action_id', v_action_id, 'status', v_new_status, 'outcome', v_outcome,
    'member_id', v_member_id, 'from_member_id', v_from_id,
    'created_member', v_created, 'attendance_id', v_attendance_id,
    'points_awarded', v_points, 'replayed', false);
end;
$$;

revoke all on function public.admin_recover_import_row(uuid, uuid, text, uuid, uuid, uuid, jsonb, text, text) from public, anon;
grant execute on function public.admin_recover_import_row(uuid, uuid, text, uuid, uuid, uuid, jsonb, text, text) to authenticated;
