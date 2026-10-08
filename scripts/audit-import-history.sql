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
--
-- "Already recorded" needs identity-strong evidence in the attendance ledger: a member with the
-- row's email, or another completed-job row with the same email whose member still has attendance.
-- A shared name is never treated as proof that two rows are one person.
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
    b.md ->> 'final_reason' as final_reason,
    b.md ->> 'match_method' as match_method,
    -- Since #518: manual_decision {kind: match|new|skip}. Before: manual_override force-match|mark-new.
    coalesce(
      case when b.md -> 'manual_decision' ->> 'kind' in ('match', 'new', 'skip') then b.md -> 'manual_decision' ->> 'kind' end,
      case b.md ->> 'manual_override' when 'force-match' then 'match' when 'mark-new' then 'new' end
    ) as manual_decision,
    (b.md ->> 'name_score')::numeric as name_score,
    case when jsonb_typeof(b.md -> 'candidate_member_ids') = 'array'
         then jsonb_array_length(b.md -> 'candidate_member_ids') else 0 end as candidate_count,
    (b.md ->> 'can_mark_new')::boolean as can_mark_new,
    (b.norm_email <> '') as has_csv_email,
    case when b.attendance_member_id is null then null
         else exists (select 1 from member_event_attendance a
                      where a.member_id = b.attendance_member_id and a.event_id = b.event_id) end as attendance_exists,
    exists (select 1 from member_event_attendance a
            where a.member_id = b.matched_member_id and a.event_id = b.event_id) as matched_member_attended,
    exists (select 1 from members m join member_event_attendance a on a.member_id = m.id and a.event_id = b.event_id
            where b.norm_email <> '' and lower(trim(m.email)) = b.norm_email) as email_member_attended,
    exists (select 1 from member_event_attendance a
            where a.event_id = b.event_id
              and (a.member_id = b.matched_member_id
                   or a.member_id::text in (select jsonb_array_elements_text(
                        case when jsonb_typeof(b.md -> 'candidate_member_ids') = 'array'
                             then b.md -> 'candidate_member_ids' else '[]'::jsonb end)))) as candidate_attended,
    exists (select 1 from import_job_rows r2
            join import_jobs j2 on j2.id = r2.import_job_id and j2.status = 'completed'
            join member_event_attendance a on a.member_id = r2.attendance_member_id and a.event_id = r2.event_id
            where r2.id <> b.row_id and r2.event_id = b.event_id
              and b.norm_email <> '' and lower(trim(coalesce(r2.csv_email, ''))) = b.norm_email) as resolved_elsewhere,
    (select case when bool_or(b.norm_email <> '' and lower(trim(coalesce(r2.csv_email, ''))) = b.norm_email) then 'email'
                 when bool_or(b.norm_name <> '' and lower(trim(regexp_replace(coalesce(r2.display_name, ''), '[^A-Za-z ]', '', 'g'))) = b.norm_name) then 'name' end
       from import_job_rows r2
       join member_event_attendance a on a.member_id = r2.attendance_member_id and a.event_id = r2.event_id
      where r2.import_job_id = b.import_job_id and r2.source_row_index < b.source_row_index) as duplicate_twin_attended,
    exists (select 1 from members m where b.norm_email <> '' and lower(trim(m.email)) = b.norm_email) as email_in_members,
    (select count(*) from members m
      where b.norm_name <> ''
        and lower(trim(regexp_replace(m.first_name || ' ' || m.last_name, '[^A-Za-z ]', '', 'g'))) = b.norm_name) as exact_name_members,
    exists (select 1 from members mm where mm.id = b.matched_member_id
            and b.norm_email <> '' and coalesce(mm.email, '') <> '' and lower(trim(mm.email)) <> b.norm_email) as email_conflict,
    -- Both UCSD addresses (isSchoolEmail in memberMatching.ts): one person rarely has two.
    exists (select 1 from members mm where mm.id = b.matched_member_id
            and b.norm_email <> '' and coalesce(mm.email, '') <> '' and lower(trim(mm.email)) <> b.norm_email
            and split_part(b.norm_email, '@', 2) ~ '(^|\.)ucsd\.edu$'
            and split_part(lower(trim(mm.email)), '@', 2) ~ '(^|\.)ucsd\.edu$') as email_conflict_both_school,
    exists (select 1 from members mm where mm.id = b.matched_member_id
            and b.norm_year <> '' and coalesce(mm.year, '') <> '' and lower(trim(mm.year)) <> b.norm_year) as year_differs,
    exists (select 1 from members mm where mm.id = b.matched_member_id
            and b.norm_college <> '' and coalesce(mm.college, '') <> '' and lower(trim(mm.college)) <> b.norm_college) as college_differs
  from base b
),
flags as (
  select
    e.*,
    (e.email_member_attended or e.resolved_elsewhere) as person_recorded,
    -- guessed: fuzzy or admin-chosen. name_based adds pre-#518 exact-name auto-matches, which
    -- were accepted even when the email or college disagreed.
    (e.match_method = 'fuzzy_name' or e.manual_decision = 'match') as guessed,
    (e.match_method in ('fuzzy_name', 'exact_name') or e.manual_decision = 'match') as name_based
  from evidence e
),
scored as (
  select
    f.*,
    (case when f.name_based and f.email_conflict then case when f.email_conflict_both_school then 3 else 2 end else 0 end)
    + (case when f.guessed and f.name_score < 90 then 2 else 0 end)
    + (case when f.guessed and f.year_differs then 1 else 0 end)
    + (case when f.name_based and f.college_differs then 1 else 0 end)
    + (case when f.manual_decision = 'match' and f.candidate_count > 1 then 1 else 0 end) as match_risk
  from flags f
),
labelled as (
  -- Branch order mirrors classifyHistoricalRow in src/lib/importHistoryAudit.ts.
  select
    s.*,
    case
      when s.decision = 'created' and s.attendance_member_id is null and s.person_recorded then 'legitimate|already_recorded|low'
      when s.decision = 'created' and s.attendance_member_id is null then 'confirmed_missing|created_row_without_member|high'
      when s.decision = 'matched' and s.attendance_member_id is null and s.matched_member_attended then 'legitimate|duplicate_row|low'
      when s.decision = 'matched' and s.attendance_member_id is null then 'confirmed_missing|attendance_row_absent|high'
      when s.decision in ('matched', 'created') and s.attendance_exists is false then 'confirmed_missing|attendance_row_absent|high'
      when s.decision in ('matched', 'created') and s.match_risk = 0 then 'no_issue|ok|low'
      when s.decision in ('matched', 'created') then
        'possible_incorrect_match|'
        || case when s.name_based and s.email_conflict then 'email_conflict_match'
                when s.guessed and s.name_score < 90 then 'weak_name_match'
                else 'context_mismatch_match' end
        || '|' || case when s.match_risk >= 3 then 'high' when s.match_risk = 2 then 'medium' else 'low' end

      when s.decision = 'skipped_duplicate' and (s.matched_member_attended or s.person_recorded or s.duplicate_twin_attended = 'email')
        then 'legitimate|' || case when s.match_reason = 'duplicate_row' then 'duplicate_row' else 'already_recorded' end || '|low'
      when s.decision = 'skipped_duplicate' and s.duplicate_twin_attended = 'name' then 'insufficient_evidence|duplicate_name_only|low'
      when s.decision = 'skipped_duplicate' then 'insufficient_evidence|skipped_without_attendance|medium'

      when s.decision = 'review' and (s.final_reason = 'skipped_by_admin' or s.manual_decision = 'skip') then 'legitimate|intentional_skip|low'
      when s.decision = 'review' and s.final_reason = 'invalid_row_no_name' then 'insufficient_evidence|invalid_row|low'
      when s.decision = 'review' and s.match_reason is null then 'insufficient_evidence|missing_audit_metadata|medium'
      when s.decision = 'review' and s.person_recorded then 'legitimate|already_recorded|low'
      when s.decision = 'review' and s.candidate_attended then 'insufficient_evidence|candidate_already_attended|medium'
      when s.decision = 'review' and s.match_reason in ('email_name_conflict', 'duplicate_email_conflict')
        then 'suspected_missing|identity_conflict_unresolved|medium'
      when s.decision = 'review' and s.can_mark_new is false and s.has_csv_email and s.candidate_count <= 1
           and not s.email_in_members and s.exact_name_members = 0 then 'suspected_missing|no_new_member_path|high'
      when s.decision = 'review' and (s.candidate_count > 1 or s.exact_name_members > 1)
        then 'suspected_missing|multiple_candidates_unresolved|medium'
      when s.decision = 'review' then 'suspected_missing|unresolved_review|medium'
      else 'insufficient_evidence|missing_audit_metadata|medium'
    end as label
  from scored s
),
classified as (
  select
    l.row_id, l.import_job_id, l.event_id, l.source_row_index, l.decision,
    split_part(l.label, '|', 1) as category,
    split_part(l.label, '|', 2) as kind,
    split_part(l.label, '|', 3) as priority
  from labelled l
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
