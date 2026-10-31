-- #673: reviewed ACE pickup-year corrections: expected-state CAS + atomic audit.
-- Applied to production 2026-10-31 (schema_migrations version 20261031080736).
-- Forward-only; apply manually to staging first, then owner-approved production.
-- This adds no public grants, no lineage writes and no role/publish changes.
-- Requires 20261027190000_ace_member_pickup_year.sql and admin_activity_log.
do $$
begin
  if to_regprocedure('public.set_ace_member_pickup_year(uuid,integer,text,uuid)') is null
    or to_regclass('public.ace_member_pickup_evidence') is null
    or to_regclass('public.admin_activity_log') is null then
    raise exception 'Apply ACE pickup year and admin activity migrations first.';
  end if;
end $$;

create or replace function public.correct_ace_member_pickup_year(
  p_ace_member_id uuid,
  p_expected_year integer,
  p_expected_term text,
  p_academic_year_start integer,
  p_term text,
  p_source_kind text,
  p_evidence_id uuid default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_node public.ace_family_members%rowtype;
  v_evidence public.ace_member_pickup_evidence%rowtype;
  v_evidence_id uuid := p_evidence_id;
  v_term text := nullif(upper(btrim(coalesce(p_term, ''))), '');
  v_expected_term text := nullif(upper(btrim(coalesce(p_expected_term, ''))), '');
  v_raw_value text;
  v_result jsonb;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can correct ACE pickup years.' using errcode = '42501';
  end if;
  if p_source_kind not in ('official_pairing', 'workbook_year_row', 'import_json', 'admin_entry')
     or p_source_kind is null then
    raise exception 'Select a valid ACE pickup-year evidence source.' using errcode = '22023';
  end if;
  if p_academic_year_start is null and v_term is not null then
    raise exception 'An exact pickup term requires an academic year.' using errcode = '22023';
  end if;
  if p_academic_year_start is null and p_evidence_id is not null then
    raise exception 'Clearing a year cannot approve a dated evidence row.' using errcode = '22023';
  end if;
  select * into v_node from public.ace_family_members
    where id = p_ace_member_id for update;
  if not found then
    raise exception 'ACE member not found.' using errcode = 'P0002';
  end if;
  if v_node.pickup_academic_year_start is distinct from p_expected_year
    or v_node.pickup_term is distinct from v_expected_term then
    raise exception 'Someone else changed this pickup year. Refresh and try again.'
      using errcode = 'P0001';
  end if;

  if p_academic_year_start is not null then
    if v_evidence_id is null then
      v_raw_value := coalesce(v_term,
        p_academic_year_start::text || '-' || (p_academic_year_start + 1)::text);
      -- Replayed reviewer inputs reuse the same row, not a second source.
      insert into public.ace_member_pickup_evidence (
        ace_member_id, source_kind, source_label, raw_value,
        candidate_academic_year_start, candidate_term, created_by
      ) values (
        p_ace_member_id, p_source_kind, 'Admin year review', v_raw_value,
        p_academic_year_start, v_term, auth.uid()
      )
      on conflict (ace_member_id, source_kind, source_label, raw_value)
      do nothing;
      select * into v_evidence
        from public.ace_member_pickup_evidence
        where ace_member_id = p_ace_member_id
          and source_kind = p_source_kind
          and source_label = 'Admin year review'
          and raw_value = v_raw_value
        for update;
      if not found then
        raise exception 'Could not record pickup-year evidence.' using errcode = 'P0002';
      end if;
      v_evidence_id := v_evidence.id;
    else
      select * into v_evidence
        from public.ace_member_pickup_evidence
        where id = v_evidence_id and ace_member_id = p_ace_member_id
        for update;
      if not found then
        raise exception 'Evidence does not belong to this ACE node.' using errcode = 'P0002';
      end if;
    end if;
    if v_evidence.source_kind is distinct from p_source_kind
       or v_evidence.candidate_academic_year_start is distinct from p_academic_year_start
       or v_evidence.candidate_term is distinct from v_term then
      raise exception 'The selected evidence does not match the approved value and source.'
        using errcode = '22023';
    end if;
  end if;

  -- Existing #669 function owns the ONLY node write. A failure to stamp
  -- evidence or insert audit rolls back the full enclosing transaction.
  v_result := public.set_ace_member_pickup_year(
    p_ace_member_id, p_academic_year_start, v_term, v_evidence_id
  );
  if coalesce((v_result->>'changed')::boolean, false) then
    insert into public.admin_activity_log (
      actor_user_id, action, entity_type, entity_id, academic_year_start,
      summary, metadata
    ) values (
      auth.uid(), 'ace.pickup_year_changed', 'ace_family_member', p_ace_member_id,
      null, 'Reviewed ACE pickup year correction',
      jsonb_build_object(
        'previous', v_result->'previous',
        'current', v_result->'current',
        'source_kind', p_source_kind
      )
    );
  end if;
  return v_result;
end;
$$;

comment on function public.correct_ace_member_pickup_year(uuid,integer,text,integer,text,text,uuid)
  is 'Admin-only compare-and-swap ACE pickup correction, approved evidence and atomic activity audit; touches only member pickup columns.';

revoke all on function public.correct_ace_member_pickup_year(uuid,integer,text,integer,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.correct_ace_member_pickup_year(uuid,integer,text,integer,text,text,uuid)
  to authenticated;
