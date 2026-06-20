-- Admin-only, read-only dependency counts for data-rights request review.
-- The result intentionally excludes row contents, contact data, notes, links,
-- raw imports, raw chat text, secrets, and export payloads.

create or replace function public.get_data_rights_dependency_preview(p_request_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_request public.data_rights_requests%rowtype;
  v_auth_user_exists boolean := false;
  v_profile_rows integer := 0;
  v_subject_is_admin boolean := false;
  v_linked_member_rows integer := 0;
  v_candidate_member_rows integer := 0;
  v_confirmed_member_rows integer := 0;
  v_auth_attendance_rows integer := 0;
  v_member_attendance_rows integer := 0;
  v_user_points_rows integer := 0;
  v_house_membership_rows integer := 0;
  v_feedback_rows integer := 0;
  v_legacy_chat_log_rows integer := 0;
  v_import_raw_rows integer := 0;
  v_avatar_reference_present boolean := false;
  v_subject_member_exists boolean := false;
  v_subject_member_link_matches boolean := false;
  v_identity_confidence text := 'needs_review';
  v_confirmed_member_ids uuid[] := array[]::uuid[];
  v_normalized_name text;
  v_warnings text[] := array[]::text[];
  v_next_steps text[] := array[]::text[];
begin
  if auth.uid() is null or not exists (
    select 1
    from public.user_profiles as caller_profile
    where caller_profile.id = auth.uid()
      and caller_profile.is_admin = true
  ) then
    raise exception 'Data-rights dependency preview is unavailable.' using errcode = '42501';
  end if;

  select request_row.*
  into v_request
  from public.data_rights_requests as request_row
  where request_row.id = p_request_id;

  if not found then
    raise exception 'Data-rights dependency preview is unavailable.' using errcode = 'P0002';
  end if;

  v_normalized_name := nullif(lower(regexp_replace(trim(v_request.subject_display_name), '\s+', ' ', 'g')), '');

  if v_request.subject_auth_user_id is not null then
    select exists (
      select 1
      from auth.users as auth_user
      where auth_user.id = v_request.subject_auth_user_id
    ) into v_auth_user_exists;

    select count(*)::integer,
           coalesce(bool_or(profile.is_admin), false),
           coalesce(bool_or(profile.avatar_url is not null and trim(profile.avatar_url) <> ''), false)
    into v_profile_rows, v_subject_is_admin, v_avatar_reference_present
    from public.user_profiles as profile
    where profile.id = v_request.subject_auth_user_id;

    select count(*)::integer
    into v_linked_member_rows
    from public.members as member
    where member.user_id = v_request.subject_auth_user_id;

    select coalesce(array_agg(member.id order by member.id), array[]::uuid[])
    into v_confirmed_member_ids
    from public.members as member
    where member.user_id = v_request.subject_auth_user_id;
  end if;

  if v_request.subject_member_id is not null then
    select exists (
      select 1
      from public.members as member
      where member.id = v_request.subject_member_id
    ) into v_subject_member_exists;

    if v_subject_member_exists and not (v_request.subject_member_id = any(v_confirmed_member_ids)) then
      v_confirmed_member_ids := array_append(v_confirmed_member_ids, v_request.subject_member_id);
    end if;

    if v_request.subject_auth_user_id is not null and v_subject_member_exists then
      select member.user_id = v_request.subject_auth_user_id
      into v_subject_member_link_matches
      from public.members as member
      where member.id = v_request.subject_member_id;
    end if;
  end if;

  v_confirmed_member_rows := cardinality(v_confirmed_member_ids);

  select count(*)::integer
  into v_candidate_member_rows
  from public.members as member
  where member.id = any(v_confirmed_member_ids)
     or (
       v_normalized_name is not null
       and lower(regexp_replace(trim(member.first_name || ' ' || member.last_name), '\s+', ' ', 'g')) = v_normalized_name
     );

  if v_request.subject_auth_user_id is not null then
    select count(*)::integer into v_auth_attendance_rows
    from public.event_attendance as attendance
    where attendance.user_id = v_request.subject_auth_user_id;

    select count(*)::integer into v_user_points_rows
    from public.user_points as points
    where points.user_id = v_request.subject_auth_user_id;

    select count(*)::integer into v_feedback_rows
    from public.feedback as feedback
    where feedback.user_id = v_request.subject_auth_user_id;

    select count(*)::integer into v_legacy_chat_log_rows
    from public.chat_logs as chat_log
    where chat_log.user_id = v_request.subject_auth_user_id;
  end if;

  if v_confirmed_member_rows > 0 then
    select count(*)::integer into v_member_attendance_rows
    from public.member_event_attendance as attendance
    where attendance.member_id = any(v_confirmed_member_ids);

    select count(*)::integer into v_house_membership_rows
    from public.house_memberships as membership
    where membership.member_id = any(v_confirmed_member_ids);

    select count(*)::integer into v_import_raw_rows
    from public.import_job_rows as import_row
    where import_row.matched_member_id = any(v_confirmed_member_ids)
       or import_row.created_member_id = any(v_confirmed_member_ids)
       or import_row.attendance_member_id = any(v_confirmed_member_ids);
  end if;

  if v_request.subject_auth_user_id is null and v_request.subject_member_id is null then
    v_warnings := array_append(v_warnings, 'No explicit Auth user or member ID is stored; name-only matches require manual identity review.');
  end if;
  if v_request.subject_auth_user_id is not null and not v_auth_user_exists then
    v_warnings := array_append(v_warnings, 'The stored Auth user ID does not resolve to an Auth user.');
  end if;
  if v_request.subject_member_id is not null and not v_subject_member_exists then
    v_warnings := array_append(v_warnings, 'The stored member ID does not resolve to a member row.');
  end if;
  if v_request.subject_auth_user_id is not null and v_linked_member_rows > 1 then
    v_warnings := array_append(v_warnings, 'Multiple member rows are linked to the Auth user; resolve duplicates before future action.');
  end if;
  if v_request.subject_auth_user_id is not null
     and v_request.subject_member_id is not null
     and v_subject_member_exists
     and v_subject_member_link_matches is not true then
    v_warnings := array_append(v_warnings, 'The stored Auth user and member IDs are not linked; verify the identity map before future action.');
  end if;
  if v_candidate_member_rows > greatest(v_confirmed_member_rows, 1) then
    v_warnings := array_append(v_warnings, 'Additional name-matched member candidates exist; name matches were not used for downstream counts.');
  end if;
  if v_request.verification_status not in ('verified', 'not_required') then
    v_warnings := array_append(v_warnings, 'Identity verification is incomplete; this preview must not authorize future action.');
  end if;
  if v_import_raw_rows > 0 then
    v_warnings := array_append(v_warnings, 'Attributable import audit rows may contain raw historical data and require separate retention review.');
  end if;
  if v_legacy_chat_log_rows > 0 then
    v_warnings := array_append(v_warnings, 'Legacy chat rows may contain raw text and require separate privacy review.');
  end if;
  if v_avatar_reference_present then
    v_warnings := array_append(v_warnings, 'An avatar reference exists; Storage ownership, copies, and caching need schema verification.');
  end if;
  if v_subject_is_admin then
    v_warnings := array_append(v_warnings, 'The subject has an admin profile; role transfer and revocation require separate approval before future action.');
  end if;
  v_warnings := array_append(v_warnings, 'Current AI usage metadata is not safely attributable to a named subject and was not counted.');
  v_warnings := array_append(v_warnings, 'Gallery, cabinet, ACE, external forms, and provider-hosted media require manual review; no name-only media attribution was performed.');

  if v_auth_user_exists and v_subject_member_exists and v_subject_member_link_matches is true then
    v_identity_confidence := 'confirmed_link';
  elsif (v_auth_user_exists and v_request.subject_member_id is null)
     or (v_subject_member_exists and v_request.subject_auth_user_id is null) then
    v_identity_confidence := 'explicit_identifier';
  end if;

  v_next_steps := array_append(v_next_steps, 'Resolve every identity warning before any future export, deletion, anonymization, or media action.');
  if v_candidate_member_rows > v_confirmed_member_rows then
    v_next_steps := array_append(v_next_steps, 'Review candidate member rows and record only confirmed identifiers on the request.');
  end if;
  if v_import_raw_rows > 0 or v_legacy_chat_log_rows > 0 then
    v_next_steps := array_append(v_next_steps, 'Apply approved retention policy to sensitive historical stores before future action.');
  end if;
  v_next_steps := array_append(v_next_steps, 'Manually review public profiles, media, and external providers because stable subject links are not available.');

  return jsonb_build_object(
    'version', 1,
    'request_id', v_request.id,
    'read_only', true,
    'subject_signals', jsonb_build_object(
      'has_auth_user_id', v_request.subject_auth_user_id is not null,
      'auth_user_exists', v_auth_user_exists,
      'has_member_id', v_request.subject_member_id is not null,
      'member_exists', v_subject_member_exists,
      'has_display_name', v_normalized_name is not null,
      'subject_is_admin', v_subject_is_admin,
      'identity_confidence', v_identity_confidence
    ),
    'counts', jsonb_build_object(
      'profile_rows', v_profile_rows,
      'linked_member_rows', v_linked_member_rows,
      'candidate_member_rows', v_candidate_member_rows,
      'confirmed_member_rows', v_confirmed_member_rows,
      'auth_attendance_rows', v_auth_attendance_rows,
      'member_attendance_rows', v_member_attendance_rows,
      'user_points_rows', v_user_points_rows,
      'house_membership_rows', v_house_membership_rows,
      'feedback_rows', v_feedback_rows,
      'legacy_chat_log_rows', v_legacy_chat_log_rows,
      'import_raw_rows', v_import_raw_rows
    ),
    'references', jsonb_build_object(
      'avatar_reference_present', v_avatar_reference_present,
      'ai_usage_attributable', false,
      'media_attribution', 'needs_schema_verification',
      'external_provider_review_required', true
    ),
    'warnings', to_jsonb(v_warnings),
    'next_steps', to_jsonb(v_next_steps)
  );
end;
$$;

comment on function public.get_data_rights_dependency_preview(uuid) is
  'Admin-only, read-only counts and warnings for a tracked data-rights request; returns no raw subject content.';

revoke all on function public.get_data_rights_dependency_preview(uuid) from public, anon;
grant execute on function public.get_data_rights_dependency_preview(uuid) to authenticated;
