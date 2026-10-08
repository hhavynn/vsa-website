-- Historical attendance-import reconciliation. READ ONLY: every statement is a SELECT.
-- Run as an admin in the Supabase SQL editor (RLS on import_jobs / import_job_rows is admin-only).
-- See docs/import-history-audit.md for how to read the output.
--
-- Output contains stable ids, enums and booleans only: no names, emails or raw rows.
-- Join back to import_job_rows / members by id inside the SQL editor if you must look at a person,
-- and do not paste those results into tickets, PRs or chat.
--
-- Classification mirrors src/lib/importHistoryAudit.ts (the tested reference). Keep them in sync.
-- Name matching here is lower-case letters-and-spaces only, a bit looser than the app's normalizer.

-- ── Query A: per-job reconciliation ─────────────────────────────────────────
-- expected = matched rows + members created. A positive shortfall means rows collapsed onto
-- attendance that already existed (or two rows hit one member); it is not by itself a loss.
select
  j.id as import_job_id,
  j.event_id,
  to_char(j.created_at, 'YYYY-MM-DD') as run_date,
  j.status,
  j.total_rows,
  j.matched_rows,
  j.created_members,
  j.created_attendance_count,
  (j.matched_rows + j.created_members) - j.created_attendance_count as shortfall,
  j.skipped_duplicate_rows,
  j.review_rows,
  (select count(*) from import_job_rows r where r.import_job_id = j.id) as audit_rows_stored,
  (select count(*) from import_jobs j2 where j2.event_id = j.event_id) as jobs_for_event
from import_jobs j
order by j.created_at;

-- ── Query B: row-level classification (ids only) ────────────────────────────
-- Summary variant: replace the final SELECT with
--   select category, kind, priority, count(*) from classified group by 1, 2, 3 order by 1, 3;
with base as (
  select
    r.id as row_id,
    r.import_job_id,
    r.event_id,
    r.source_row_index,
    r.decision,
    r.attendance_member_id,
    r.matched_member_id,
    r.match_details as md,
    lower(trim(regexp_replace(coalesce(r.display_name, ''), '[^A-Za-z ]', '', 'g'))) as norm_name,
    lower(trim(coalesce(r.csv_email, ''))) as norm_email,
    lower(trim(coalesce(r.csv_year, ''))) as norm_year,
    lower(trim(coalesce(r.csv_college, ''))) as norm_college
  from import_job_rows r
),
evidence as (
  select
    b.*,
    b.md ->> 'match_reason' as match_reason,
    b.md ->> 'match_method' as match_method,
    nullif(b.md ->> 'manual_override', '') as manual_override,
    (b.md ->> 'name_score')::numeric as name_score,
    case when jsonb_typeof(b.md -> 'candidate_member_ids') = 'array'
         then jsonb_array_length(b.md -> 'candidate_member_ids') else 0 end as candidate_count,
    (b.md ->> 'can_mark_new')::boolean as can_mark_new,
    (b.norm_email <> '') as has_csv_email,
    case when b.attendance_member_id is null then null
         else exists (select 1 from member_event_attendance a
                      where a.member_id = b.attendance_member_id and a.event_id = b.event_id) end as attendance_exists,
    exists (select 1 from members m join member_event_attendance a on a.member_id = m.id and a.event_id = b.event_id
            where b.norm_email <> '' and lower(trim(m.email)) = b.norm_email) as email_member_attended,
    exists (select 1 from member_event_attendance a
            where a.event_id = b.event_id
              and (a.member_id = b.matched_member_id
                   or a.member_id::text in (select jsonb_array_elements_text(
                        case when jsonb_typeof(b.md -> 'candidate_member_ids') = 'array'
                             then b.md -> 'candidate_member_ids' else '[]'::jsonb end)))) as candidate_attended,
    exists (select 1 from import_job_rows r2
            where r2.id <> b.row_id and r2.event_id = b.event_id
              and r2.decision in ('matched', 'created', 'skipped_duplicate')
              and ((b.norm_email <> '' and lower(trim(coalesce(r2.csv_email, ''))) = b.norm_email)
                   or (b.norm_name <> '' and lower(trim(regexp_replace(coalesce(r2.display_name, ''), '[^A-Za-z ]', '', 'g'))) = b.norm_name))) as resolved_elsewhere,
    exists (select 1 from members m where b.norm_email <> '' and lower(trim(m.email)) = b.norm_email) as email_in_members,
    (select count(*) from members m
      where b.norm_name <> ''
        and lower(trim(regexp_replace(m.first_name || ' ' || m.last_name, '[^A-Za-z ]', '', 'g'))) = b.norm_name) as exact_name_members,
    exists (select 1 from members mm where mm.id = b.matched_member_id
            and b.norm_email <> '' and coalesce(mm.email, '') <> '' and lower(trim(mm.email)) <> b.norm_email) as email_conflict,
    exists (select 1 from members mm where mm.id = b.matched_member_id
            and b.norm_year <> '' and coalesce(mm.year, '') <> '' and lower(trim(mm.year)) <> b.norm_year) as year_differs,
    exists (select 1 from members mm where mm.id = b.matched_member_id
            and b.norm_college <> '' and coalesce(mm.college, '') <> '' and lower(trim(mm.college)) <> b.norm_college) as college_differs
  from base b
),
scored as (
  select
    e.*,
    (e.match_method = 'fuzzy_name' or e.manual_override = 'force-match') as guessed,
    (case when (e.match_method = 'fuzzy_name' or e.manual_override = 'force-match') and e.email_conflict then 3 else 0 end)
    + (case when (e.match_method = 'fuzzy_name' or e.manual_override = 'force-match') and e.name_score < 90 then 2 else 0 end)
    + (case when (e.match_method = 'fuzzy_name' or e.manual_override = 'force-match') and e.year_differs then 1 else 0 end)
    + (case when (e.match_method = 'fuzzy_name' or e.manual_override = 'force-match') and e.college_differs then 1 else 0 end)
    + (case when e.manual_override = 'force-match' and e.candidate_count > 1 then 1 else 0 end) as match_risk
  from evidence e
),
classified as (
  select
    s.row_id, s.import_job_id, s.event_id, s.source_row_index, s.decision,
    case
      when s.decision in ('matched', 'created') and s.decision = 'created' and s.attendance_member_id is null
           and not (s.email_member_attended or s.resolved_elsewhere) then 'confirmed_missing'
      when s.decision in ('matched', 'created') and s.attendance_member_id is not null and s.attendance_exists is false then 'confirmed_missing'
      when s.decision in ('matched', 'created') and s.decision = 'created' and s.attendance_member_id is null then 'legitimate'
      when s.decision in ('matched', 'created') and s.match_risk > 0 then 'possible_incorrect_match'
      when s.decision in ('matched', 'created') then 'no_issue'
      when s.decision = 'skipped_duplicate' then 'legitimate'
      when s.decision = 'review' and s.match_reason is null then 'insufficient_evidence'
      when s.decision = 'review' and (s.email_member_attended or s.resolved_elsewhere) then 'legitimate'
      when s.decision = 'review' and s.candidate_attended then 'insufficient_evidence'
      when s.decision = 'review' then 'suspected_missing'
      else 'insufficient_evidence'
    end as category,
    case
      when s.decision = 'created' and s.attendance_member_id is null and not (s.email_member_attended or s.resolved_elsewhere) then 'created_row_without_member'
      when s.decision in ('matched', 'created') and s.attendance_member_id is not null and s.attendance_exists is false then 'attendance_row_absent'
      when s.decision = 'created' and s.attendance_member_id is null then 'already_recorded'
      when s.decision in ('matched', 'created') and s.match_risk > 0 and s.email_conflict then 'email_conflict_match'
      when s.decision in ('matched', 'created') and s.match_risk > 0 and s.name_score < 90 then 'weak_name_match'
      when s.decision in ('matched', 'created') and s.match_risk > 0 then 'context_mismatch_match'
      when s.decision in ('matched', 'created') then 'ok'
      when s.decision = 'skipped_duplicate' and s.match_reason = 'duplicate_row' then 'duplicate_row'
      when s.decision = 'skipped_duplicate' then 'already_recorded'
      when s.decision = 'review' and s.match_reason is null then 'missing_audit_metadata'
      when s.decision = 'review' and (s.email_member_attended or s.resolved_elsewhere) then 'already_recorded'
      when s.decision = 'review' and s.candidate_attended then 'candidate_already_attended'
      when s.decision = 'review' and s.match_reason in ('email_name_conflict', 'duplicate_email_conflict') then 'identity_conflict_unresolved'
      when s.decision = 'review' and s.can_mark_new is false and s.has_csv_email and s.candidate_count <= 1
           and not s.email_in_members and s.exact_name_members = 0 then 'no_new_member_path'
      when s.decision = 'review' and (s.candidate_count > 1 or s.exact_name_members > 1) then 'multiple_candidates_unresolved'
      when s.decision = 'review' then 'unresolved_review'
      else 'missing_audit_metadata'
    end as kind,
    case
      when s.decision = 'created' and s.attendance_member_id is null and not (s.email_member_attended or s.resolved_elsewhere) then 'high'
      when s.decision in ('matched', 'created') and s.attendance_member_id is not null and s.attendance_exists is false then 'high'
      when s.decision in ('matched', 'created') and s.match_risk >= 3 then 'high'
      when s.decision in ('matched', 'created') and s.match_risk = 2 then 'medium'
      when s.decision = 'review' and s.match_reason is null then 'medium'
      when s.decision = 'review' and s.match_reason is not null and not (s.email_member_attended or s.resolved_elsewhere) and not s.candidate_attended
           and s.can_mark_new is false and s.has_csv_email and s.candidate_count <= 1
           and not s.email_in_members and s.exact_name_members = 0
           and s.match_reason not in ('email_name_conflict', 'duplicate_email_conflict') then 'high'
      when s.decision = 'review' and not (s.email_member_attended or s.resolved_elsewhere) then 'medium'
      else 'low'
    end as priority
  from scored s
)
select
  category,
  priority,
  kind,
  event_id,
  import_job_id,
  row_id as import_job_row_id,
  source_row_index + 2 as source_sheet_row
from classified
where category in ('confirmed_missing', 'suspected_missing', 'possible_incorrect_match', 'insufficient_evidence')
order by case priority when 'high' then 0 when 'medium' then 1 else 2 end, import_job_id, source_row_index;
