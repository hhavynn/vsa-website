-- Rollback for 20261025000000_member_identity_aliases.sql. One transaction.
-- Restores the production smart_merge_members body (20260619000000) and drops
-- only what that migration added. Attendance, members and points are not
-- touched. Aliases and year observations are discarded with their tables, so
-- export them first if they should be kept:
--   select * from public.member_identity_emails;
--   select * from public.member_year_observations;
-- Deploy the frontend that does not call admin_apply_attendance_import first.

begin;

set local lock_timeout = '5s';

drop trigger if exists trg_member_primary_email_alias on public.members;
drop trigger if exists trg_member_purge_identity_on_anonymize on public.members;
drop function if exists public.sync_member_primary_email_alias();
drop function if exists public.purge_member_identity_on_anonymize();
drop function if exists public.admin_apply_attendance_import(jsonb);
drop function if exists public.fold_person_name(text);

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
begin
  if not exists (
    select 1 from public.user_profiles
    where id = auth.uid() and is_admin = true
  ) then
    raise exception 'Permission denied: admin access required for smart_merge_members';
  end if;

  select * into v_source from public.members where id = p_source_id;
  if not found then
    raise exception 'Source member not found: %', p_source_id;
  end if;

  select * into v_target from public.members where id = p_target_id;
  if not found then
    raise exception 'Target member not found: %', p_target_id;
  end if;

  update public.members
  set
    college    = coalesce(v_target.college, v_source.college),
    year       = coalesce(v_target.year,    v_source.year),
    email      = coalesce(v_target.email,   v_source.email),
    updated_at = now()
  where id = p_target_id;

  insert into public.member_event_attendance
    (member_id, event_id, points_earned, imported_at)
  select p_target_id, event_id, points_earned, imported_at
  from public.member_event_attendance
  where member_id = p_source_id
  on conflict (member_id, event_id) do nothing;

  delete from public.members where id = p_source_id;
end;
$$;

revoke execute on function public.smart_merge_members(uuid, uuid) from public, anon;
grant execute on function public.smart_merge_members(uuid, uuid) to authenticated;

drop table if exists public.attendance_import_requests;
drop table if exists public.member_year_observations;
drop table if exists public.member_identity_emails;
drop index if exists public.members_email_normalized_idx;

commit;
