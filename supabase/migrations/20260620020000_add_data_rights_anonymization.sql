-- Admin-only, dry-run-first anonymization for approved data-rights requests.
-- This preserves attendance, points, House, event, and operational history.

alter table public.data_rights_request_events
  drop constraint data_rights_request_events_type_check;

alter table public.data_rights_request_events
  add constraint data_rights_request_events_type_check check (
    event_type in (
      'created',
      'status_changed',
      'verification_changed',
      'workflow_updated',
      'details_updated',
      'export_generated',
      'anonymization_completed'
    )
  );

create or replace function public.preview_data_rights_anonymization(
  p_request_id uuid,
  p_subject_auth_user_id uuid,
  p_subject_member_id uuid
)
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
  v_member_rows integer := 0;
  v_member_user_id uuid;
  v_member_already_anonymized boolean := false;
  v_auth_attendance_rows integer := 0;
  v_user_points_rows integer := 0;
  v_member_attendance_rows integer := 0;
  v_house_membership_rows integer := 0;
  v_feedback_rows integer := 0;
  v_legacy_chat_log_rows integer := 0;
  v_import_raw_rows integer := 0;
  v_avatar_reference_present boolean := false;
  v_blockers text[] := array[]::text[];
  v_deferred text[] := array[
    'Auth account and profile email remain until a separately approved Auth-account workflow is completed.',
    'Legacy chat text and import audit content require separate retention and legal-hold review.',
    'Avatar Storage objects, public media, leadership/program profiles, galleries, and external providers require manual removal review.'
  ]::text[];
begin
  if auth.uid() is null or not exists (
    select 1
    from public.user_profiles as caller_profile
    where caller_profile.id = auth.uid()
      and caller_profile.is_admin = true
  ) then
    raise exception 'Data-rights anonymization preview is unavailable.' using errcode = '42501';
  end if;

  select request_row.*
  into v_request
  from public.data_rights_requests as request_row
  where request_row.id = p_request_id;

  if not found then
    raise exception 'Data-rights anonymization preview is unavailable.' using errcode = 'P0002';
  end if;

  if p_subject_auth_user_id is null and p_subject_member_id is null then
    v_blockers := array_append(v_blockers, 'At least one explicit subject identifier is required.');
  end if;

  if p_subject_auth_user_id is distinct from v_request.subject_auth_user_id
     or p_subject_member_id is distinct from v_request.subject_member_id then
    v_blockers := array_append(v_blockers, 'The explicit subject identifiers do not match the saved request.');
  end if;

  if v_request.request_type <> 'anonymization' then
    v_blockers := array_append(v_blockers, 'The request type is not anonymization.');
  end if;
  if v_request.verification_status <> 'verified' then
    v_blockers := array_append(v_blockers, 'Identity verification is not complete.');
  end if;
  if v_request.status <> 'approved_for_future_action' then
    v_blockers := array_append(v_blockers, 'The request is not approved for future action.');
  end if;
  if v_request.assigned_to is null
     or v_request.reviewer_id is null
     or v_request.assigned_to = v_request.reviewer_id then
    v_blockers := array_append(v_blockers, 'An assigned processor and a different independent reviewer are required.');
  end if;

  if p_subject_auth_user_id is not null then
    select exists (
      select 1 from auth.users as auth_user where auth_user.id = p_subject_auth_user_id
    ) into v_auth_user_exists;

    if not v_auth_user_exists then
      v_blockers := array_append(v_blockers, 'The explicit Auth user does not exist.');
    end if;

    select count(*)::integer,
           coalesce(bool_or(profile.is_admin), false),
           coalesce(bool_or(
             nullif(trim(to_jsonb(profile)->>'avatar_url'), '') is not null
             or nullif(trim(to_jsonb(profile)->>'discord_avatar_url'), '') is not null
           ), false)
    into v_profile_rows, v_subject_is_admin, v_avatar_reference_present
    from public.user_profiles as profile
    where profile.id = p_subject_auth_user_id;

    if v_subject_is_admin then
      v_blockers := array_append(v_blockers, 'Admin subjects require a separate role-transfer and revocation workflow.');
    end if;

    select count(*)::integer
    into v_linked_member_rows
    from public.members as member
    where member.user_id = p_subject_auth_user_id;

    if p_subject_member_id is null and v_linked_member_rows > 0 then
      v_blockers := array_append(v_blockers, 'An Auth-linked member exists and must be recorded as an explicit member identifier.');
    elsif p_subject_member_id is not null and v_linked_member_rows > 1 then
      v_blockers := array_append(v_blockers, 'Multiple members are linked to the Auth user; resolve the identity map first.');
    end if;

    select count(*)::integer into v_auth_attendance_rows
    from public.event_attendance as attendance
    where attendance.user_id = p_subject_auth_user_id;

    select count(*)::integer into v_user_points_rows
    from public.user_points as points
    where points.user_id = p_subject_auth_user_id;

    select count(*)::integer into v_feedback_rows
    from public.feedback as feedback
    where feedback.user_id = p_subject_auth_user_id;

    select count(*)::integer into v_legacy_chat_log_rows
    from public.chat_logs as chat_log
    where chat_log.user_id = p_subject_auth_user_id;
  end if;

  if p_subject_member_id is not null then
    select count(*)::integer,
           (array_agg(member.user_id))[1],
           coalesce(bool_or(
             member.user_id is null
             and member.first_name = 'Deleted'
             and member.last_name = 'Member'
             and member.college is null
             and member.year is null
             and nullif(trim(to_jsonb(member)->>'email'), '') is null
           ), false)
    into v_member_rows, v_member_user_id, v_member_already_anonymized
    from public.members as member
    where member.id = p_subject_member_id;

    if v_member_rows = 0 then
      v_blockers := array_append(v_blockers, 'The explicit member does not exist.');
    elsif p_subject_auth_user_id is null and v_member_user_id is not null then
      v_blockers := array_append(v_blockers, 'The member is Auth-linked and requires the explicit Auth user identifier.');
    elsif p_subject_auth_user_id is not null
       and v_member_user_id is distinct from p_subject_auth_user_id
       and not v_member_already_anonymized then
      v_blockers := array_append(v_blockers, 'The explicit Auth user and member are not linked.');
    end if;

    select count(*)::integer into v_member_attendance_rows
    from public.member_event_attendance as attendance
    where attendance.member_id = p_subject_member_id;

    select count(*)::integer into v_house_membership_rows
    from public.house_memberships as membership
    where membership.member_id = p_subject_member_id;

    select count(*)::integer into v_import_raw_rows
    from public.import_job_rows as import_row
    where import_row.matched_member_id = p_subject_member_id
       or import_row.created_member_id = p_subject_member_id
       or import_row.attendance_member_id = p_subject_member_id;
  end if;

  return jsonb_build_object(
    'version', 1,
    'request_id', v_request.id,
    'dry_run', true,
    'ready_for_anonymization', cardinality(v_blockers) = 0,
    'subject_signals', jsonb_build_object(
      'has_auth_user_id', p_subject_auth_user_id is not null,
      'has_member_id', p_subject_member_id is not null,
      'subject_is_admin', v_subject_is_admin,
      'member_already_anonymized', v_member_already_anonymized
    ),
    'anonymize_counts', jsonb_build_object(
      'profile_rows', v_profile_rows,
      'member_rows', v_member_rows,
      'feedback_rows', v_feedback_rows
    ),
    'preserve_counts', jsonb_build_object(
      'auth_attendance_rows', v_auth_attendance_rows,
      'user_points_rows', v_user_points_rows,
      'member_attendance_rows', v_member_attendance_rows,
      'house_membership_rows', v_house_membership_rows
    ),
    'deferred_counts', jsonb_build_object(
      'legacy_chat_log_rows', v_legacy_chat_log_rows,
      'import_raw_rows', v_import_raw_rows,
      'avatar_reference_present', v_avatar_reference_present
    ),
    'blockers', to_jsonb(v_blockers),
    'deferred_actions', to_jsonb(v_deferred)
  );
end;
$$;

comment on function public.preview_data_rights_anonymization(uuid, uuid, uuid) is
  'Admin-only dry run for an explicit subject on a tracked data-rights request; returns counts and blockers only.';

revoke all on function public.preview_data_rights_anonymization(uuid, uuid, uuid) from public, anon;
grant execute on function public.preview_data_rights_anonymization(uuid, uuid, uuid) to authenticated;

create or replace function public.anonymize_data_rights_subject(
  p_request_id uuid,
  p_subject_auth_user_id uuid,
  p_subject_member_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.data_rights_requests%rowtype;
  v_preview jsonb;
  v_profile_rows integer := 0;
  v_member_rows integer := 0;
  v_feedback_rows integer := 0;
  v_avatar_reference_cleared boolean := false;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.user_profiles as caller_profile
    where caller_profile.id = auth.uid()
      and caller_profile.is_admin = true
  ) then
    raise exception 'Data-rights anonymization is unavailable.' using errcode = '42501';
  end if;

  select request_row.*
  into v_request
  from public.data_rights_requests as request_row
  where request_row.id = p_request_id
  for update;

  if not found then
    raise exception 'Data-rights anonymization is unavailable.' using errcode = 'P0002';
  end if;

  if p_subject_auth_user_id is not null then
    perform 1
    from auth.users as auth_user
    where auth_user.id = p_subject_auth_user_id
    for key share;

    perform 1
    from public.user_profiles as profile
    where profile.id = p_subject_auth_user_id
    for update;
  end if;

  if p_subject_member_id is not null then
    perform 1
    from public.members as member
    where member.id = p_subject_member_id
    for update;
  end if;

  select public.preview_data_rights_anonymization(
    p_request_id,
    p_subject_auth_user_id,
    p_subject_member_id
  ) into v_preview;

  if coalesce((v_preview->>'ready_for_anonymization')::boolean, false) is not true then
    raise exception 'Data-rights anonymization is unavailable.' using errcode = '22023';
  end if;

  if p_subject_auth_user_id is not null then
    v_avatar_reference_cleared := coalesce(
      (v_preview->'deferred_counts'->>'avatar_reference_present')::boolean,
      false
    );

    update public.user_profiles
    set
      first_name = 'Deleted',
      last_name = 'Member',
      avatar_url = null,
      updated_at = now()
    where id = p_subject_auth_user_id
      and is_admin = false;
    get diagnostics v_profile_rows = row_count;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'college'
    ) then
      execute 'update public.user_profiles set college = null where id = $1 and is_admin = false'
      using p_subject_auth_user_id;
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'year'
    ) then
      execute 'update public.user_profiles set year = null where id = $1 and is_admin = false'
      using p_subject_auth_user_id;
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'discord_user_id'
    ) then
      execute 'update public.user_profiles set discord_user_id = null where id = $1 and is_admin = false'
      using p_subject_auth_user_id;
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'discord_username'
    ) then
      execute 'update public.user_profiles set discord_username = null where id = $1 and is_admin = false'
      using p_subject_auth_user_id;
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'discord_avatar_url'
    ) then
      execute 'update public.user_profiles set discord_avatar_url = null where id = $1 and is_admin = false'
      using p_subject_auth_user_id;
    end if;

    update public.feedback
    set
      user_id = null,
      name = null,
      email = null,
      updated_at = now()
    where user_id = p_subject_auth_user_id;
    get diagnostics v_feedback_rows = row_count;
  end if;

  if p_subject_member_id is not null then
    update public.members
    set
      first_name = 'Deleted',
      last_name = 'Member',
      college = null,
      year = null,
      user_id = null,
      needs_review = false,
      updated_at = now()
    where id = p_subject_member_id;
    get diagnostics v_member_rows = row_count;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'members' and column_name = 'email'
    ) then
      execute 'update public.members set email = null where id = $1'
      using p_subject_member_id;
    end if;
  end if;

  insert into public.data_rights_request_events (
    request_id,
    event_type,
    event_summary,
    created_by
  ) values (
    v_request.id,
    'anonymization_completed',
    format(
      'Anonymization completed: profiles=%s, members=%s, feedback identities=%s; attendance, points, House, and event history preserved',
      v_profile_rows,
      v_member_rows,
      v_feedback_rows
    ),
    auth.uid()
  );

  return jsonb_build_object(
    'version', 1,
    'request_id', v_request.id,
    'completed', true,
    'counts', jsonb_build_object(
      'profile_rows_scrubbed', v_profile_rows,
      'member_rows_scrubbed', v_member_rows,
      'feedback_rows_detached', v_feedback_rows,
      'avatar_reference_cleared', v_avatar_reference_cleared
    ),
    'preserved_counts', v_preview->'preserve_counts',
    'deferred_counts', v_preview->'deferred_counts'
  );
end;
$$;

comment on function public.anonymize_data_rights_subject(uuid, uuid, uuid) is
  'Anonymizes an explicit non-admin subject for an approved request, preserves historical rows, and records counts-only audit metadata.';

revoke all on function public.anonymize_data_rights_subject(uuid, uuid, uuid) from public, anon;
grant execute on function public.anonymize_data_rights_subject(uuid, uuid, uuid) to authenticated;
