-- Let admins publish a photo for a member directly from Admin -> Members.
--
-- Applied to production 2026-09-29 (schema_migrations version 20260930053224;
-- the filename matches) with owner approval.
--
-- Until now every avatar started as a member-submitted request and went
-- through review in Admin -> Photo requests. Admins also need to add a photo
-- for someone who handed it to them in person. The existing client insert
-- path cannot express that: its RLS policy binds an authenticated row to
-- user_id = auth.uid(), so an admin-made request would be attributed to the
-- admin's own account, and approving it would set the ADMIN's
-- user_profiles.avatar_url.
--
-- This adds one admin-guarded SECURITY DEFINER function that records the
-- upload as an already-approved member_photo_requests row. Reusing that table
-- keeps a single photo source: public_member_avatars picks it up unchanged,
-- it appears in Admin -> Photo requests with the usual audit trail, and the
-- existing remove_member_photo_request handles privacy removal.
--
-- Row shape for an admin upload:
--   user_id            NULL (no member account made the submission)
--   matched_member_id  the member chosen in the editor
--   submitted_name     the member's current name
--   submitted_email    the uploading admin's email, as the contact of record
--   consent_confirmed  true: the admin attests the member agreed
--   reviewed_by/at     the admin, now
-- Audit: the existing insert trigger records 'submitted' (actor = admin),
-- and this function records 'approved' with an 'Admin upload' note.
--
-- Why SECURITY DEFINER: member_photo_requests has no UPDATE policy and its
-- INSERT policy only admits pending rows, so every status transition already
-- runs through admin-guarded DEFINER functions. This follows the same
-- pattern as approve_member_photo_request.
--
-- The client uploads both objects before calling this function, the original
-- to the private member-photo-requests bucket under pending/ and the 256px
-- thumbnail to the public avatars bucket under approved/. If the call fails,
-- the client checks for the request row by id before deleting them, so a
-- committed call whose response was lost never loses its image.
--
-- It also narrows guard_member_photo_request_rate_limit to pending inserts.
-- The trigger counted pending rows for every insert, so anyone could block
-- admin uploads for a member by filing three pending public requests for
-- that member. Clients can only insert pending rows (RLS), so the pending-
-- only limit still covers every public submission.
--
-- No attendance, points, House, check-in, import, or RLS policy changes.
-- Forward-only; apply before the frontend that calls it.

-- CREATE OR REPLACE keeps the function's owner and its EXECUTE grants
-- (revoked from PUBLIC/anon in 20260820000003 and from authenticated in
-- 20260928005621). Body identical to 20260701000000 apart from the early
-- return.
create or replace function public.guard_member_photo_request_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pending_count_for_member integer;
  v_pending_count_for_email integer;
begin
  -- Only public submissions (always pending) are rate limited; admin-made
  -- approved rows must not be blockable by a backlog of pending requests.
  if new.status is distinct from 'pending' then
    return new;
  end if;

  -- 1. Check matched_member_id pending limit
  select count(*) into v_pending_count_for_member
  from public.member_photo_requests
  where matched_member_id = new.matched_member_id
    and status = 'pending';

  if v_pending_count_for_member >= 3 then
    raise exception 'Too many pending photo requests. Please try again later or contact VSA.';
  end if;

  -- 2. Check submitted_email pending limit
  select count(*) into v_pending_count_for_email
  from public.member_photo_requests
  where lower(trim(submitted_email)) = lower(trim(new.submitted_email))
    and status = 'pending';

  if v_pending_count_for_email >= 5 then
    raise exception 'Too many pending photo requests. Please try again later or contact VSA.';
  end if;

  return new;
end;
$$;

create or replace function public.admin_publish_member_photo(
  p_request_id uuid,
  p_member_id uuid,
  p_pending_path text,
  p_approved_path text,
  p_public_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_name text;
  v_member_email text;
  v_admin_email text;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Permission denied: admin access required';
  end if;

  select trim(concat_ws(' ', m.first_name, m.last_name)), m.email
  into v_member_name, v_member_email
  from public.members m
  where m.id = p_member_id;

  if not found then
    raise exception 'Member not found';
  end if;

  if p_pending_path is null or p_pending_path not like 'pending/%' then
    raise exception 'Original photo path must be in the pending/ folder';
  end if;
  if p_approved_path is null or p_approved_path not like 'approved/%' then
    raise exception 'Approved photo path must be in the approved/ folder';
  end if;
  if position('/storage/v1/object/public/avatars/' in p_public_url) = 0
     or position(p_approved_path in p_public_url) = 0 then
    raise exception 'Approved URL must be a public avatars-bucket URL for the approved object';
  end if;

  select u.email into v_admin_email
  from auth.users u
  where u.id = auth.uid();

  insert into public.member_photo_requests (
    id,
    user_id,
    matched_member_id,
    submitted_name,
    submitted_email,
    note_to_admins,
    consent_confirmed,
    storage_path_pending,
    storage_path_approved,
    approved_avatar_url,
    status,
    reviewed_by,
    reviewed_at
  )
  values (
    p_request_id,
    null,
    p_member_id,
    left(coalesce(nullif(v_member_name, ''), 'Member'), 200),
    left(coalesce(nullif(trim(v_admin_email), ''), nullif(trim(v_member_email), ''), 'admin upload'), 200),
    'Uploaded by an admin from Admin -> Members.',
    true,
    p_pending_path,
    p_approved_path,
    p_public_url,
    'approved',
    auth.uid(),
    now()
  );

  insert into public.member_photo_request_events (request_id, action, actor, note)
  values (p_request_id, 'approved', auth.uid(), 'Admin upload');
end;
$$;

comment on function public.admin_publish_member_photo(uuid, uuid, text, text, text) is
  'Admin-only: record an admin-uploaded member photo as an approved member_photo_requests row. The client uploads the pending original and approved thumbnail first.';

revoke all on function public.admin_publish_member_photo(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.admin_publish_member_photo(uuid, uuid, text, text, text) to authenticated;
