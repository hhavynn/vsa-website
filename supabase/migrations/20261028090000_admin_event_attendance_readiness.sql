-- Post-event attendance readiness (#653). Admin-only, read-mostly.
--
-- WHY
--   After each event the Webmaster imports the sign-in sheet; House standings
--   are only meaningful once that happened. Nothing showed which events were
--   still waiting, which imports left rows to review, and which events have no
--   machine record at all (attendance before import auditing began, or entered
--   by hand), so a quiet House could be a missing import.
--
-- WHAT
--   public.event_attendance_attestations: an append-only log where an admin
--   records, with actor and time, what the database cannot know: that an event
--   had no sign-in, or that its attendance was checked by hand. 'cleared'
--   withdraws the previous statement. The latest row per event is current.
--
--   public.admin_attest_event_attendance(p_event_id, p_status, p_note)
--   appends one attestation. It never touches attendance or points.
--
--   public.admin_event_attendance_readiness(p_year, p_term_id) returns, per
--   event of the academic year (optionally one term), the facts the admin page
--   turns into a status: credits, the latest import job, review rows still
--   open, the last reconciliation run, the current attestation, and the
--   event's House credits. The House credits use exactly the attribution of
--   house_yearly_points (active profile, effective membership interval by the
--   event's date, positive points, the 2025-26 ledger cutoff); they are counts
--   for this one event, not a new score.
--
-- SECURITY
--   Both functions check is_admin_user themselves. The readiness read is
--   SECURITY DEFINER because the House score views are private to the API
--   since #692 (20261028073000); it returns event and House aggregates only,
--   no member names, emails or rows. The attestation table has RLS on and no
--   policies, and table privileges are revoked: it is reachable only through
--   these functions. EXECUTE is revoked from PUBLIC and anon.
--
-- DEPLOY
--   Additive. Apply before the frontend tab; until then the tab says the
--   status check is not available. Verify: bash scripts/test-event-attendance-readiness.sh

create table if not exists public.event_attendance_attestations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  status text not null check (status in ('no_signin', 'verified', 'cleared')),
  note text check (note is null or char_length(note) <= 500),
  attested_by uuid not null,
  attested_at timestamptz not null default clock_timestamp()
);

create index if not exists event_attendance_attestations_event_idx
  on public.event_attendance_attestations (event_id, attested_at desc);

alter table public.event_attendance_attestations enable row level security;
revoke all on table public.event_attendance_attestations from public, anon, authenticated;

-- Append-only: a statement is withdrawn by a later 'cleared' row, never edited
-- or deleted. Deleting the event still removes its rows (the cascade runs one
-- trigger level down).
create or replace function public.event_attendance_attestations_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' or pg_trigger_depth() = 1 then
    raise exception 'Attendance statements are append-only; record a new statement instead.' using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists event_attendance_attestations_append_only on public.event_attendance_attestations;
create trigger event_attendance_attestations_append_only
  before update or delete on public.event_attendance_attestations
  for each row execute function public.event_attendance_attestations_append_only();
revoke execute on function public.event_attendance_attestations_append_only() from public, anon, authenticated;

create or replace function public.admin_attest_event_attendance(
  p_event_id uuid,
  p_status text,
  p_note text default null
)
returns public.event_attendance_attestations
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.event_attendance_attestations%rowtype;
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can record attendance status.' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('no_signin', 'verified', 'cleared') then
    raise exception 'Status must be no_signin, verified or cleared.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.events e where e.id = p_event_id) then
    raise exception 'Event not found.' using errcode = 'P0002';
  end if;
  if p_status = 'no_signin' and exists (select 1 from public.member_event_attendance a where a.event_id = p_event_id) then
    raise exception 'This event has attendance credits, so it cannot be marked as having no sign-in.' using errcode = '23514';
  end if;

  insert into public.event_attendance_attestations (event_id, status, note, attested_by)
  values (p_event_id, p_status, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.admin_event_attendance_readiness(
  p_year integer,
  p_term_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_limit constant integer := 400;
  v_events jsonb;
  v_total integer;
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can read attendance status.' using errcode = '42501';
  end if;
  -- Same rule as admin_private_house_standings: private House credits are
  -- never served to a cacheable GET.
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'Attendance status requires POST' using errcode = '42501';
  end if;
  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Academic year is required.' using errcode = '22023';
  end if;

  select count(*) into v_total
  from public.events e
  join public.academic_terms t on t.id = e.academic_term_id
  where t.academic_year_start = p_year
    and (p_term_id is null or e.academic_term_id = p_term_id);

  with scoped as (
    select e.id, e.name, e.date, e.event_type, e.points, e.is_published,
           e.academic_term_id, t.label as term_label, t.academic_year_start
    from public.events e
    join public.academic_terms t on t.id = e.academic_term_id
    where t.academic_year_start = p_year
      and (p_term_id is null or e.academic_term_id = p_term_id)
    order by e.date desc nulls last, e.id
    limit v_limit
  ),
  credits as (
    select a.event_id,
           count(*)::integer as credits,
           count(*) filter (where a.points_earned > 0)::integer as scoring_credits,
           max(a.imported_at) as last_credit_at
    from public.member_event_attendance a
    where a.event_id in (select id from scoped)
    group by a.event_id
  ),
  jobs as (
    select distinct on (j.event_id)
           j.event_id, j.id, j.status, j.created_at, j.completed_at, j.total_rows, j.review_rows, j.error_count
    from public.import_jobs j
    where j.event_id in (select id from scoped)
    order by j.event_id, j.created_at desc, j.id desc
  ),
  job_counts as (
    select j.event_id, count(*)::integer as jobs
    from public.import_jobs j
    where j.event_id in (select id from scoped)
    group by j.event_id
  ),
  -- The latest recovery action on a row is the one no later action follows.
  latest_action as (
    select ra.import_job_row_id, ra.resulting_status
    from public.import_recovery_actions ra
    where not exists (
      select 1 from public.import_recovery_actions nx where nx.previous_action_id = ra.id
    )
  ),
  -- A review row is open when an admin flagged it (latest action open,
  -- investigating or needs_info), or when nobody acted on it and it is still
  -- unrecorded: from a completed import, not skipped or invalid, and with no
  -- identity-strong evidence that the person was credited another way (the
  -- matched member, or a member with the same email, has the attendance), as
  -- in docs/import-history-audit.md. A failed import's rows are not counted:
  -- the event shows "Import failed" instead.
  review_rows as (
    select r.id, r.event_id, r.decision, r.attendance_member_id, r.matched_member_id, r.match_details as md,
           lower(btrim(coalesce(r.csv_email, ''))) as norm_email, j.status as job_status
    from public.import_job_rows r
    join public.import_jobs j on j.id = r.import_job_id
    where r.event_id in (select id from scoped)
  ),
  email_attended as (
    select distinct lower(btrim(m.email)) as norm_email, a.event_id
    from public.member_event_attendance a
    join public.members m on m.id = a.member_id
    where a.event_id in (select id from scoped) and coalesce(btrim(m.email), '') <> ''
  ),
  open_reviews as (
    select b.event_id, count(*)::integer as open_review_rows
    from review_rows b
    left join latest_action la on la.import_job_row_id = b.id
    where la.resulting_status in ('open', 'investigating', 'needs_info')
       or (la.resulting_status is null
           and b.job_status = 'completed'
           and b.decision = 'review'
           and b.attendance_member_id is null
           and coalesce(b.md ->> 'final_reason', '') not in ('skipped_by_admin', 'invalid_row_no_name')
           and coalesce(b.md -> 'manual_decision' ->> 'kind', b.md ->> 'manual_decision', '') <> 'skip'
           and not exists (
             select 1 from public.member_event_attendance a
             where a.member_id = b.matched_member_id and a.event_id = b.event_id)
           and not exists (
             select 1 from email_attended ea
             where b.norm_email <> '' and ea.norm_email = b.norm_email and ea.event_id = b.event_id))
    group by b.event_id
  ),
  reconciled as (
    select l.event_id, max(l.created_at) as reconciled_at,
           count(*) filter (where l.outcome = 'pending_review')::integer as pending_review_rows
    from public.attendance_reconciliation_log l
    where l.event_id in (select id from scoped)
    group by l.event_id
  ),
  attested as (
    select distinct on (x.event_id) x.event_id, x.status, x.note, x.attested_by, x.attested_at
    from public.event_attendance_attestations x
    where x.event_id in (select id from scoped)
    order by x.event_id, x.attested_at desc, x.id desc
  ),
  -- Same attribution as house_yearly_points, for one event at a time.
  house_credits as (
    select a.event_id, hp.id as house_profile_id, hp.display_name, count(*)::integer as credits
    from public.member_event_attendance a
    join scoped s on s.id = a.event_id
    join public.house_memberships hm
      on hm.member_id = a.member_id
     and hm.academic_year_start = s.academic_year_start
     and (s.date)::date >= hm.effective_start_date
     and (hm.effective_end_date is null or (s.date)::date < hm.effective_end_date)
    join public.house_page_assets hp on hp.id = hm.house_profile_id
    where s.date is not null
      and hp.is_active = true
      and a.points_earned > 0
      and (s.academic_year_start <> 2025 or (s.date)::date >= date '2025-11-08')
    group by a.event_id, hp.id, hp.display_name
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'date', s.date,
    'event_type', s.event_type,
    'points', s.points,
    'is_published', s.is_published,
    'academic_term_id', s.academic_term_id,
    'term_label', s.term_label,
    'credits', coalesce(c.credits, 0),
    'scoring_credits', coalesce(c.scoring_credits, 0),
    'last_credit_at', c.last_credit_at,
    'jobs', coalesce(jc.jobs, 0),
    'latest_job', case when j.id is null then null else jsonb_build_object(
      'id', j.id, 'status', j.status, 'created_at', j.created_at, 'completed_at', j.completed_at,
      'total_rows', j.total_rows, 'review_rows', j.review_rows, 'error_count', j.error_count) end,
    'open_review_rows', coalesce(o.open_review_rows, 0),
    'reconciled_at', r.reconciled_at,
    'reconciliation_pending_rows', coalesce(r.pending_review_rows, 0),
    'attestation', case when x.event_id is null or x.status = 'cleared' then null else jsonb_build_object(
      'status', x.status, 'note', x.note, 'attested_at', x.attested_at,
      'by_current_user', x.attested_by = auth.uid()) end,
    'house_credits', coalesce((
      select jsonb_agg(jsonb_build_object('house_profile_id', h.house_profile_id, 'display_name', h.display_name, 'credits', h.credits)
                       order by h.display_name)
      from house_credits h where h.event_id = s.id), '[]'::jsonb)
  ) order by s.date desc nulls last, s.id), '[]'::jsonb)
  into v_events
  from scoped s
  left join credits c on c.event_id = s.id
  left join jobs j on j.event_id = s.id
  left join job_counts jc on jc.event_id = s.id
  left join open_reviews o on o.event_id = s.id
  left join reconciled r on r.event_id = s.id
  left join attested x on x.event_id = s.id;

  return jsonb_build_object(
    'events', v_events,
    'total_events', v_total,
    'truncated', v_total > v_limit,
    'checked_at', now()
  );
end;
$$;

revoke execute on function public.admin_attest_event_attendance(uuid, text, text) from public, anon;
grant execute on function public.admin_attest_event_attendance(uuid, text, text) to authenticated;
revoke execute on function public.admin_event_attendance_readiness(integer, uuid) from public, anon;
grant execute on function public.admin_event_attendance_readiness(integer, uuid) to authenticated;

comment on table public.event_attendance_attestations is
  'Append-only admin statements about an event''s attendance that the database cannot infer (#653). Latest row per event is current.';
comment on function public.admin_event_attendance_readiness(integer, uuid) is
  'Admin-only per-event attendance import facts and House credit counts for one academic year (#653). Read-only.';
