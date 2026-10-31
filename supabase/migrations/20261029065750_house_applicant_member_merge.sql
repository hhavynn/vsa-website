-- ─── Member Merge: House Applicants Reconciliation (#697) ─────────────────────
-- When merging member p_source_id into p_target_id:
--
-- 1. Reveal Freeze Guard:
--    If either member is linked to an applicant in a payment cycle where a Reveal
--    is currently in progress (publishing_batch_id is not null), the merge is
--    refused with SQLSTATE 55006, matching admin_link_house_applicant_member.
--
-- 2. Single Application (Source has applicant, Target does not in this cycle):
--    Repoint member_id to p_target_id. Record 'member_link_changed' in
--    house_payment_audit (source 'system', actor auth.uid()). Bump cycle's
--    status_version.
--
-- 3. Cycle Conflict (Both Source and Target have an applicant in this cycle):
--    A member can have at most one active confirmed application per cycle.
--    Reconciliation selects a primary (surviving active application) and a
--    secondary (duplicate application to withdraw and unlink):
--    * Selection hierarchy:
--      - Draft Placement: An applicant placed in house_assignment_drafts must
--        remain primary (withdrawing a placed applicant breaks batch validation).
--      - Active vs Withdrawn: An active applicant beats an already withdrawn one.
--      - Payment Rank: paid (5) > waived (4) > pending (3) > unpaid (2) > unverified (1).
--      - Identity default: Target's applicant is primary (surviving member).
--    * State & Payment Reconciliation:
--      - If secondary had strictly higher payment rank, primary inherits secondary's
--        payment_status, evidence, reference, and updater, audited as 'status_changed'.
--      - Primary absorbs missing evidence / reference from secondary.
--      - Primary appends secondary's payment_note (truncated to 500 chars).
--      - Primary points to p_target_id (if it was source's applicant, repointed & audited).
--      - Secondary is marked withdrawn ('Duplicate application: merged with <key> during member merge'),
--        unlinked (member_id = null, match_status = 'unmatched', match_method = null),
--        and audited ('withdrawal_changed' and 'member_link_changed').
--      - Bump cycle's status_version.

create or replace function public.smart_merge_members(
  p_source_id uuid,
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.members%rowtype;
  v_target public.members%rowtype;
  v_source_seen integer;
  v_target_seen integer;
  v_link record;
  v_src_app public.house_applicants%rowtype;
  v_tgt_app public.house_applicants%rowtype;
  v_primary public.house_applicants%rowtype;
  v_secondary public.house_applicants%rowtype;
  v_src_in_draft boolean;
  v_tgt_in_draft boolean;
  v_src_rank integer;
  v_tgt_rank integer;
  v_primary_rank integer;
  v_secondary_rank integer;
  v_cycle_id uuid;
  v_affected_cycles uuid[] := '{}';
begin
  if not exists (
    select 1 from public.user_profiles
    where id = auth.uid() and is_admin = true
  ) then
    raise exception 'Permission denied: admin access required for smart_merge_members';
  end if;

  if p_source_id is null or p_target_id is null or p_source_id = p_target_id then
    raise exception 'Choose two different members to merge';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('vsa-member-points:' || least(p_source_id, p_target_id)::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('vsa-member-points:' || greatest(p_source_id, p_target_id)::text, 0));
  perform 1 from public.members where id in (p_source_id, p_target_id) order by id for update;

  select * into v_source from public.members where id = p_source_id;
  if not found then
    raise exception 'Source member not found: %', p_source_id;
  end if;

  select * into v_target from public.members where id = p_target_id;
  if not found then
    raise exception 'Target member not found: %', p_target_id;
  end if;

  -- Reveal Freeze Guard: identities are frozen while a Reveal is in progress
  if exists (
    select 1
    from public.house_applicants a
    join public.house_payment_cycles c on c.id = a.cycle_id
    where a.member_id in (p_source_id, p_target_id)
      and c.publishing_batch_id is not null
  ) then
    raise exception 'A Reveal is in progress for this payment cycle; identities are frozen until it finishes.' using errcode = '55006';
  end if;

  select max(academic_year_start) into v_source_seen from public.member_year_observations where member_id = p_source_id;
  select max(academic_year_start) into v_target_seen from public.member_year_observations where member_id = p_target_id;

  update public.members
  set
    college    = coalesce(v_target.college, v_source.college),
    year       = case
                   when v_target.year is not null and v_source.year is not null
                        and coalesce(v_source_seen, -1) > coalesce(v_target_seen, -1)
                     then v_source.year
                   else coalesce(v_target.year, v_source.year)
                 end,
    email      = coalesce(v_target.email, v_source.email),
    house      = coalesce(v_target.house, v_source.house),
    updated_at = now()
  where id = p_target_id;

  insert into public.member_event_attendance
    (member_id, event_id, points_earned, imported_at)
  select p_target_id, event_id, points_earned, imported_at
  from public.member_event_attendance
  where member_id = p_source_id
  on conflict (member_id, event_id) do nothing;

  delete from public.member_year_observations s
  where s.member_id = p_source_id
    and exists (
      select 1 from public.member_year_observations t
      where t.member_id = p_target_id
        and t.academic_year_start = s.academic_year_start
        and t.year_label = s.year_label
        and t.source = s.source
    );
  update public.member_year_observations set member_id = p_target_id where member_id = p_source_id;

  update public.member_identity_emails
  set member_id = p_target_id, moved_from_member_id = p_source_id
  where member_id = p_source_id;

  update public.house_memberships s
  set member_id = p_target_id
  where s.member_id = p_source_id
    and not exists (
      select 1 from public.house_memberships t
      where t.member_id = p_target_id and t.academic_year_start = s.academic_year_start
    );

  -- ── House Applicants Reconciliation ──────────────────────────────────────────
  for v_src_app in
    select * from public.house_applicants
    where member_id = p_source_id
    order by submission_timestamp asc, created_at asc
  loop
    v_cycle_id := v_src_app.cycle_id;

    select * into v_tgt_app
    from public.house_applicants
    where cycle_id = v_cycle_id
      and member_id = p_target_id
      and id <> v_src_app.id;

    if not found then
      -- No conflict: repoint source applicant to target member
      update public.house_applicants
      set member_id = p_target_id,
          updated_at = now()
      where id = v_src_app.id;

      insert into public.house_payment_audit (
        cycle_id, applicant_id, event_type, from_value, to_value, reason, source, actor
      ) values (
        v_cycle_id,
        v_src_app.id,
        'member_link_changed',
        p_source_id::text,
        p_target_id::text,
        'Member merge: repointed to target member',
        'system',
        auth.uid()
      );

      if not (v_cycle_id = any(v_affected_cycles)) then
        v_affected_cycles := array_append(v_affected_cycles, v_cycle_id);
      end if;
    else
      -- Conflict: both members have an application in this cycle
      select exists (
        select 1 from public.house_assignment_drafts where applicant_id = v_src_app.id
      ) into v_src_in_draft;

      select exists (
        select 1 from public.house_assignment_drafts where applicant_id = v_tgt_app.id
      ) into v_tgt_in_draft;

      v_src_rank := case v_src_app.payment_status
        when 'paid' then 5
        when 'waived' then 4
        when 'pending' then 3
        when 'unpaid' then 2
        when 'unverified' then 1
        else 0
      end;

      v_tgt_rank := case v_tgt_app.payment_status
        when 'paid' then 5
        when 'waived' then 4
        when 'pending' then 3
        when 'unpaid' then 2
        when 'unverified' then 1
        else 0
      end;

      -- Priority decision tree:
      -- 1. Draft placement: an applicant placed in a draft cannot be withdrawn without breaking draft checks.
      -- 2. Active vs Withdrawn: an active applicant beats an already withdrawn one.
      -- 3. Default: Target applicant is primary (preserving surviving member's application identity).
      -- Payment status is inherited from secondary if secondary has higher rank.
      if v_src_in_draft and not v_tgt_in_draft then
        v_primary := v_src_app;
        v_secondary := v_tgt_app;
        v_primary_rank := v_src_rank;
        v_secondary_rank := v_tgt_rank;
      elsif v_tgt_in_draft and not v_src_in_draft then
        v_primary := v_tgt_app;
        v_secondary := v_src_app;
        v_primary_rank := v_tgt_rank;
        v_secondary_rank := v_src_rank;
      elsif v_src_app.withdrawn_reason is null and v_tgt_app.withdrawn_reason is not null then
        v_primary := v_src_app;
        v_secondary := v_tgt_app;
        v_primary_rank := v_src_rank;
        v_secondary_rank := v_tgt_rank;
      else
        v_primary := v_tgt_app;
        v_secondary := v_src_app;
        v_primary_rank := v_tgt_rank;
        v_secondary_rank := v_src_rank;
      end if;

      -- A. Payment status inheritance
      if v_secondary_rank > v_primary_rank then
        update public.house_applicants
        set payment_status = v_secondary.payment_status,
            payment_evidence = coalesce(v_secondary.payment_evidence, v_primary.payment_evidence),
            payment_reference = coalesce(v_secondary.payment_reference, v_primary.payment_reference),
            payment_updated_by = coalesce(v_secondary.payment_updated_by, auth.uid()),
            payment_updated_at = now(),
            updated_at = now()
        where id = v_primary.id;

        insert into public.house_payment_audit (
          cycle_id, applicant_id, event_type, from_value, to_value, reason, source, actor
        ) values (
          v_cycle_id,
          v_primary.id,
          'status_changed',
          v_primary.payment_status,
          v_secondary.payment_status,
          'Payment status inherited from merged applicant ' || v_secondary.applicant_key,
          'system',
          auth.uid()
        );
      else
        if v_primary.payment_evidence is null and v_secondary.payment_evidence is not null then
          update public.house_applicants
          set payment_evidence = v_secondary.payment_evidence,
              payment_reference = coalesce(v_primary.payment_reference, v_secondary.payment_reference),
              updated_at = now()
          where id = v_primary.id;
        end if;
      end if;

      -- B. Note preservation
      if v_secondary.payment_note is not null then
        update public.house_applicants
        set payment_note = case
          when v_primary.payment_note is null then v_secondary.payment_note
          else substring(v_primary.payment_note || '; [From merged ' || v_secondary.applicant_key || ']: ' || v_secondary.payment_note from 1 for 500)
        end,
        updated_at = now()
        where id = v_primary.id;
      end if;

      -- C. Repoint primary to target member if primary was source applicant
      if v_primary.id = v_src_app.id then
        update public.house_applicants
        set member_id = p_target_id,
            updated_at = now()
        where id = v_primary.id;

        insert into public.house_payment_audit (
          cycle_id, applicant_id, event_type, from_value, to_value, reason, source, actor
        ) values (
          v_cycle_id,
          v_primary.id,
          'member_link_changed',
          p_source_id::text,
          p_target_id::text,
          'Member merge: repointed to target member',
          'system',
          auth.uid()
        );
      end if;

      -- D. Withdraw and unlink secondary applicant
      update public.house_applicants
      set withdrawn_reason = substring('Duplicate application: merged with ' || v_primary.applicant_key || ' during member merge' from 1 for 500),
          member_id = null,
          match_status = 'unmatched',
          match_method = null,
          updated_at = now()
      where id = v_secondary.id;

      insert into public.house_payment_audit (
        cycle_id, applicant_id, event_type, from_value, to_value, reason, source, actor
      ) values (
        v_cycle_id,
        v_secondary.id,
        'withdrawal_changed',
        v_secondary.withdrawn_reason,
        substring('Duplicate application: merged with ' || v_primary.applicant_key || ' during member merge' from 1 for 500),
        'Member merge duplicate resolution',
        'system',
        auth.uid()
      );

      insert into public.house_payment_audit (
        cycle_id, applicant_id, event_type, from_value, to_value, reason, source, actor
      ) values (
        v_cycle_id,
        v_secondary.id,
        'member_link_changed',
        v_secondary.member_id::text,
        null,
        'Duplicate application unlinked during member merge',
        'system',
        auth.uid()
      );

      if not (v_cycle_id = any(v_affected_cycles)) then
        v_affected_cycles := array_append(v_affected_cycles, v_cycle_id);
      end if;
    end if;
  end loop;

  if array_length(v_affected_cycles, 1) > 0 then
    update public.house_payment_cycles
    set status_version = status_version + 1,
        updated_at = now()
    where id = any(v_affected_cycles);
  end if;

  -- ── Other Identity Links ─────────────────────────────────────────────────────
  for v_link in
    select c.table_name, c.column_name
    from information_schema.columns c
    join (values
      ('import_job_rows', 'matched_member_id'),
      ('import_job_rows', 'created_member_id'),
      ('import_job_rows', 'attendance_member_id'),
      ('member_photo_requests', 'matched_member_id'),
      ('ace_family_members', 'member_id'),
      ('cabinet_members', 'member_id'),
      ('ace_assignment_drafts', 'little_member_id'),
      ('house_assignment_drafts', 'member_id'),
      ('intern_cohort_drafts', 'member_id'),
      ('cabinet_roster_drafts', 'member_id')
    ) as links(table_name, column_name)
      on links.table_name = c.table_name and links.column_name = c.column_name
    where c.table_schema = 'public'
    order by 1, 2
  loop
    begin
      execute format('update public.%I set %I = $1 where %I = $2', v_link.table_name, v_link.column_name, v_link.column_name)
        using p_target_id, p_source_id;
    exception when unique_violation then
      null;
    end;
  end loop;

  delete from public.members where id = p_source_id;
end;
$$;

revoke execute on function public.smart_merge_members(uuid, uuid) from public, anon;
grant execute on function public.smart_merge_members(uuid, uuid) to authenticated;
