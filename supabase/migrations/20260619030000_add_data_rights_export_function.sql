-- Admin-only export generation for verified, approved data-rights requests.
-- The bundle uses fixed allowlists and is returned to the caller only. No
-- payload is written to request events, logs, Storage, or another table.

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
      'export_generated'
    )
  );

create or replace function public.generate_data_rights_export(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.data_rights_requests%rowtype;
  v_auth_user_exists boolean := false;
  v_subject_member_exists boolean := false;
  v_subject_member_user_id uuid;
  v_linked_member_count integer := 0;
  v_linked_member_id uuid;
  v_confirmed_member_ids uuid[] := array[]::uuid[];
  v_name_candidate_count integer := 0;
  v_normalized_name text;
  v_auth_account jsonb := null;
  v_profile jsonb := null;
  v_member_records jsonb := '[]'::jsonb;
  v_auth_attendance jsonb := '[]'::jsonb;
  v_member_attendance jsonb := '[]'::jsonb;
  v_auth_points jsonb := '[]'::jsonb;
  v_member_totals jsonb := '[]'::jsonb;
  v_house_memberships jsonb := '[]'::jsonb;
  v_feedback jsonb := '[]'::jsonb;
  v_media_references jsonb := '[]'::jsonb;
  v_warnings text[] := array[]::text[];
  v_exclusions text[] := array[
    'Raw import rows, match details, source data, and import notes are excluded.',
    'Check-in codes, check-in actors, admin notes, private rosters, payment data, and private links are excluded.',
    'Legacy and current AI chat text and usage metadata are excluded.',
    'External forms, albums, provider-hosted data, and unverified media are not included.',
    'Request conversations, verification material, internal notes, and identity documents are excluded.'
  ]::text[];
  v_browser_notes text[] := array[
    'Browser consent, theme, event-interest, and session state are device-local and are not included in this server bundle.',
    'The subject can clear device-local state in the browser and sign out to clear the local Auth session.'
  ]::text[];
  v_external_systems text[] := array[
    'Application submissions are managed by external form providers and require a separate provider-owner review.',
    'Gallery albums and other externally hosted media require manual identity and ownership review.'
  ]::text[];
  v_bundle jsonb;
  v_profile_count integer;
  v_member_count integer;
  v_auth_attendance_count integer;
  v_member_attendance_count integer;
  v_points_count integer;
  v_house_count integer;
  v_feedback_count integer;
  v_media_count integer;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.user_profiles as caller_profile
    where caller_profile.id = auth.uid()
      and caller_profile.is_admin = true
  ) then
    raise exception 'Data-rights export is unavailable.' using errcode = '42501';
  end if;

  select request_row.*
  into v_request
  from public.data_rights_requests as request_row
  where request_row.id = p_request_id;

  if not found
     or v_request.request_type <> 'export'
     or v_request.verification_status <> 'verified'
     or v_request.status <> 'approved_for_future_action'
     or (v_request.subject_auth_user_id is null and v_request.subject_member_id is null) then
    raise exception 'Data-rights export is unavailable.' using errcode = '22023';
  end if;

  v_normalized_name := nullif(
    lower(regexp_replace(trim(v_request.subject_display_name), '\s+', ' ', 'g')),
    ''
  );

  if v_request.subject_auth_user_id is not null then
    select exists (
      select 1
      from auth.users as auth_user
      where auth_user.id = v_request.subject_auth_user_id
    ) into v_auth_user_exists;

    if not v_auth_user_exists then
      raise exception 'Data-rights export is unavailable.' using errcode = '22023';
    end if;

    select count(*)::integer, (array_agg(member.id order by member.id))[1]
    into v_linked_member_count, v_linked_member_id
    from public.members as member
    where member.user_id = v_request.subject_auth_user_id;

    if v_linked_member_count > 1 then
      raise exception 'Data-rights export is unavailable.' using errcode = '22023';
    elsif v_linked_member_id is not null then
      v_confirmed_member_ids := array_append(v_confirmed_member_ids, v_linked_member_id);
    end if;
  end if;

  if v_request.subject_member_id is not null then
    select exists (
      select 1
      from public.members as member
      where member.id = v_request.subject_member_id
    ) into v_subject_member_exists;

    if not v_subject_member_exists then
      raise exception 'Data-rights export is unavailable.' using errcode = '22023';
    end if;

    select member.user_id
    into v_subject_member_user_id
    from public.members as member
    where member.id = v_request.subject_member_id;

    if v_request.subject_auth_user_id is not null
       and v_subject_member_user_id is not null
       and v_subject_member_user_id <> v_request.subject_auth_user_id then
      raise exception 'Data-rights export is unavailable.' using errcode = '22023';
    end if;

    if v_linked_member_id is not null and v_linked_member_id <> v_request.subject_member_id then
      raise exception 'Data-rights export is unavailable.' using errcode = '22023';
    end if;

    if not (v_request.subject_member_id = any(v_confirmed_member_ids)) then
      v_confirmed_member_ids := array_append(v_confirmed_member_ids, v_request.subject_member_id);
    end if;
  end if;

  if v_request.subject_auth_user_id is not null
     and v_request.subject_member_id is not null
     and v_subject_member_user_id is null then
    v_warnings := array_append(
      v_warnings,
      'The verified Auth and member identifiers are not linked in the current schema; their allowlisted categories were exported separately.'
    );
  end if;

  if v_normalized_name is not null then
    select count(*)::integer
    into v_name_candidate_count
    from public.members as member
    where lower(regexp_replace(trim(member.first_name || ' ' || member.last_name), '\s+', ' ', 'g')) = v_normalized_name;

    if v_name_candidate_count > cardinality(v_confirmed_member_ids) then
      v_warnings := array_append(
        v_warnings,
        'Additional name-matched member candidates exist and were excluded because name matches are not export authorization.'
      );
    end if;
  end if;

  if v_request.subject_auth_user_id is not null then
    select jsonb_build_object(
      'id', auth_user.id,
      'email', auth_user.email,
      'created_at', auth_user.created_at,
      'updated_at', auth_user.updated_at,
      'last_sign_in_at', auth_user.last_sign_in_at
    )
    into v_auth_account
    from auth.users as auth_user
    where auth_user.id = v_request.subject_auth_user_id;

    select jsonb_build_object(
      'id', profile.id,
      'email', profile.email,
      'first_name', profile.first_name,
      'last_name', profile.last_name,
      'college', profile.college,
      'year', profile.year,
      'is_admin', profile.is_admin,
      'discord_user_id', profile.discord_user_id,
      'discord_username', profile.discord_username,
      'created_at', profile.created_at,
      'updated_at', profile.updated_at
    )
    into v_profile
    from public.user_profiles as profile
    where profile.id = v_request.subject_auth_user_id;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', attendance.id,
      'event_id', attendance.event_id,
      'event_name', event_row.name,
      'event_date', event_row.date,
      'event_location', event_row.location,
      'event_type', event_row.event_type,
      'points_earned', attendance.points_earned,
      'check_in_type', attendance.check_in_type,
      'checked_in_at', attendance.checked_in_at,
      'created_at', attendance.created_at
    ) order by attendance.checked_in_at, attendance.id), '[]'::jsonb)
    into v_auth_attendance
    from public.event_attendance as attendance
    join public.events as event_row on event_row.id = attendance.event_id
    where attendance.user_id = v_request.subject_auth_user_id;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', points.id,
      'total_points', points.total_points,
      'points', points.points,
      'created_at', points.created_at,
      'updated_at', points.updated_at
    ) order by points.created_at, points.id), '[]'::jsonb)
    into v_auth_points
    from public.user_points as points
    where points.user_id = v_request.subject_auth_user_id;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', feedback.id,
      'type', feedback.type,
      'title', feedback.title,
      'description', feedback.description,
      'status', feedback.status,
      'created_at', feedback.created_at,
      'updated_at', feedback.updated_at
    ) order by feedback.created_at, feedback.id), '[]'::jsonb)
    into v_feedback
    from public.feedback as feedback
    where feedback.user_id = v_request.subject_auth_user_id;

    select coalesce(jsonb_agg(media_reference order by media_reference->>'kind'), '[]'::jsonb)
    into v_media_references
    from (
      select jsonb_build_object('kind', 'avatar', 'url', profile.avatar_url) as media_reference
      from public.user_profiles as profile
      where profile.id = v_request.subject_auth_user_id
        and profile.avatar_url is not null
        and trim(profile.avatar_url) <> ''
      union all
      select jsonb_build_object('kind', 'discord_avatar', 'url', profile.discord_avatar_url) as media_reference
      from public.user_profiles as profile
      where profile.id = v_request.subject_auth_user_id
        and profile.discord_avatar_url is not null
        and trim(profile.discord_avatar_url) <> ''
    ) as media_rows;
  end if;

  if cardinality(v_confirmed_member_ids) > 0 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', member.id,
      'first_name', member.first_name,
      'last_name', member.last_name,
      'college', member.college,
      'year', member.year,
      'house', member.house,
      'points', member.points,
      'events_attended', member.events_attended,
      'created_at', member.created_at,
      'updated_at', member.updated_at
    ) order by member.created_at, member.id), '[]'::jsonb)
    into v_member_records
    from public.members as member
    where member.id = any(v_confirmed_member_ids);

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', attendance.id,
      'member_id', attendance.member_id,
      'event_id', attendance.event_id,
      'event_name', event_row.name,
      'event_date', event_row.date,
      'event_location', event_row.location,
      'event_type', event_row.event_type,
      'points_earned', attendance.points_earned,
      'imported_at', attendance.imported_at
    ) order by attendance.imported_at, attendance.id), '[]'::jsonb)
    into v_member_attendance
    from public.member_event_attendance as attendance
    join public.events as event_row on event_row.id = attendance.event_id
    where attendance.member_id = any(v_confirmed_member_ids);

    select coalesce(jsonb_agg(jsonb_build_object(
      'member_id', member.id,
      'total_points', member.points,
      'events_attended', member.events_attended
    ) order by member.id), '[]'::jsonb)
    into v_member_totals
    from public.members as member
    where member.id = any(v_confirmed_member_ids);

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', membership.id,
      'member_id', membership.member_id,
      'house_key', house.house_key,
      'house_name', house.display_name,
      'academic_year_start', membership.academic_year_start,
      'academic_year_end', membership.academic_year_end,
      'effective_start_date', membership.effective_start_date,
      'effective_end_date', membership.effective_end_date,
      'created_at', membership.created_at,
      'updated_at', membership.updated_at
    ) order by membership.effective_start_date, membership.id), '[]'::jsonb)
    into v_house_memberships
    from public.house_memberships as membership
    join public.house_page_assets as house on house.id = membership.house_profile_id
    where membership.member_id = any(v_confirmed_member_ids);
  end if;

  v_bundle := jsonb_build_object(
    'version', 1,
    'request_id', v_request.id,
    'generated_at', now(),
    'subject', jsonb_build_object(
      'has_auth_user_id', v_request.subject_auth_user_id is not null,
      'has_member_id', v_request.subject_member_id is not null
    ),
    'auth_account', v_auth_account,
    'profile', v_profile,
    'member_records', v_member_records,
    'attendance', jsonb_build_object(
      'auth_attendance', v_auth_attendance,
      'member_attendance', v_member_attendance
    ),
    'points', jsonb_build_object(
      'auth_points', v_auth_points,
      'member_totals', v_member_totals
    ),
    'house_memberships', v_house_memberships,
    'feedback', v_feedback,
    'media_references', v_media_references,
    'browser_and_analytics_notes', to_jsonb(v_browser_notes),
    'external_systems', to_jsonb(v_external_systems),
    'exclusions', to_jsonb(v_exclusions),
    'warnings', to_jsonb(v_warnings)
  );

  v_profile_count := case when v_profile is null then 0 else 1 end;
  v_member_count := jsonb_array_length(v_member_records);
  v_auth_attendance_count := jsonb_array_length(v_auth_attendance);
  v_member_attendance_count := jsonb_array_length(v_member_attendance);
  v_points_count := jsonb_array_length(v_auth_points) + jsonb_array_length(v_member_totals);
  v_house_count := jsonb_array_length(v_house_memberships);
  v_feedback_count := jsonb_array_length(v_feedback);
  v_media_count := jsonb_array_length(v_media_references);

  insert into public.data_rights_request_events (
    request_id,
    event_type,
    event_summary,
    created_by
  ) values (
    v_request.id,
    'export_generated',
    format(
      'Export generated: profile=%s, members=%s, auth attendance=%s, member attendance=%s, points=%s, houses=%s, feedback=%s, media=%s',
      v_profile_count,
      v_member_count,
      v_auth_attendance_count,
      v_member_attendance_count,
      v_points_count,
      v_house_count,
      v_feedback_count,
      v_media_count
    ),
    auth.uid()
  );

  return v_bundle;
end;
$$;

comment on function public.generate_data_rights_export(uuid) is
  'Generates an allowlisted subject export for an approved, verified admin-tracked request and records counts only.';

revoke all on function public.generate_data_rights_export(uuid) from public, anon;
grant execute on function public.generate_data_rights_export(uuid) to authenticated;
