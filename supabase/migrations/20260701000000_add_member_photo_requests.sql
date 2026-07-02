-- Member photo request + admin approval workflow (privacy PR D groundwork).
--
-- Members submit a photo request (uploaded to a PRIVATE bucket); admins
-- review, approve into the public `avatars` bucket as a small thumbnail,
-- reject with an internal note, or later remove for privacy/data-rights
-- reasons. All status transitions run through admin-guarded SECURITY
-- DEFINER functions and are recorded in an append-only audit table.
--
-- This migration also closes the legacy unmoderated self-serve avatar
-- path: users can no longer write to the `avatars` bucket or change
-- `user_profiles.avatar_url` directly. Existing avatar_url values are
-- left untouched.
--
-- No attendance, points, House, check-in, or import behavior changes.

-- ─── Request table ────────────────────────────────────────────────────────────

create table public.member_photo_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  matched_member_id uuid references public.members(id) on delete set null,
  submitted_name text not null,
  submitted_email text not null,
  note_to_admins text,
  consent_confirmed boolean not null default false,
  storage_path_pending text not null,
  storage_path_approved text,
  approved_avatar_url text,
  status text not null default 'pending',
  admin_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_photo_requests_status_check check (
    status in ('pending', 'approved', 'rejected', 'removed')
  ),
  constraint member_photo_requests_consent_check check (consent_confirmed = true),
  constraint member_photo_requests_name_length check (
    char_length(submitted_name) between 1 and 200
  ),
  constraint member_photo_requests_email_length check (
    char_length(submitted_email) between 3 and 200
  ),
  constraint member_photo_requests_note_length check (
    note_to_admins is null or char_length(note_to_admins) <= 1000
  ),
  constraint member_photo_requests_admin_notes_length check (
    admin_notes is null or char_length(admin_notes) <= 2000
  ),
  constraint member_photo_requests_pending_path_check check (
    storage_path_pending like (user_id::text || '/%')
    and char_length(storage_path_pending) <= 500
  ),
  constraint member_photo_requests_approved_path_length check (
    storage_path_approved is null or char_length(storage_path_approved) <= 500
  )
);

comment on table public.member_photo_requests is
  'Member-submitted profile photo requests awaiting admin review. Pending objects live in the private member-photo-requests bucket; only approved thumbnails are published to the public avatars bucket.';
comment on column public.member_photo_requests.admin_notes is
  'Internal admin-only review/rejection context. Never rendered outside admin surfaces.';
comment on column public.member_photo_requests.matched_member_id is
  'Optional explicit member match set by an admin at approval time; falls back to members.user_id linkage in public_member_avatars.';

create index member_photo_requests_status_created_idx
  on public.member_photo_requests (status, created_at desc);
create index member_photo_requests_user_idx
  on public.member_photo_requests (user_id, created_at desc);

-- One in-flight request per account.
create unique index member_photo_requests_one_pending_per_user
  on public.member_photo_requests (user_id)
  where status = 'pending';

create or replace function public.set_member_photo_request_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_member_photo_request_updated_at
  before update on public.member_photo_requests
  for each row
  execute function public.set_member_photo_request_updated_at();

alter table public.member_photo_requests enable row level security;

-- Members can only create their own pending request and cannot pre-fill
-- review fields. There is intentionally no owner SELECT policy: members read
-- status through the my_member_photo_requests view, which excludes
-- admin-only columns.
create policy "Members can submit their own photo requests"
  on public.member_photo_requests
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and consent_confirmed = true
    and matched_member_id is null
    and storage_path_approved is null
    and approved_avatar_url is null
    and admin_notes is null
    and reviewed_by is null
    and reviewed_at is null
  );

create policy "Admins can view photo requests"
  on public.member_photo_requests
  for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

-- No UPDATE/DELETE policies: every transition goes through the admin-guarded
-- SECURITY DEFINER functions below.

-- ─── Append-only audit trail ─────────────────────────────────────────────────

create table public.member_photo_request_events (
  id uuid primary key default gen_random_uuid(),
  -- CASCADE (not RESTRICT): the submission trigger guarantees every request
  -- has an event row, so RESTRICT would permanently block deleting the
  -- request — and, through the user_id CASCADE, deleting the auth user.
  request_id uuid not null references public.member_photo_requests(id) on delete cascade,
  action text not null,
  actor uuid default auth.uid() references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  constraint member_photo_request_events_action_check check (
    action in ('submitted', 'approved', 'rejected', 'removed')
  ),
  constraint member_photo_request_events_note_length check (
    note is null or char_length(note) <= 300
  )
);

comment on table public.member_photo_request_events is
  'Append-only audit events for photo request review decisions. Metadata only; never image payloads.';

create index member_photo_request_events_request_idx
  on public.member_photo_request_events (request_id, created_at desc);

alter table public.member_photo_request_events enable row level security;

create policy "Admins can view photo request events"
  on public.member_photo_request_events
  for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

-- Inserts happen only inside the SECURITY DEFINER functions (owner bypasses
-- RLS) and the submission trigger below; clients have no INSERT policy.

create or replace function public.record_member_photo_request_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.member_photo_request_events (request_id, action, actor)
  values (new.id, 'submitted', auth.uid());
  return new;
end;
$$;

create trigger record_member_photo_request_submission
  after insert on public.member_photo_requests
  for each row
  execute function public.record_member_photo_request_submission();

-- ─── Member-facing status view (safe columns only) ──────────────────────────

-- Definer view (owner bypasses table RLS) anchored on auth.uid(); exposes no
-- admin notes, reviewer identity, or other members' rows.
create view public.my_member_photo_requests
with (security_barrier = true) as
select
  r.id,
  r.status,
  r.submitted_name,
  r.storage_path_pending,
  r.created_at,
  r.reviewed_at
from public.member_photo_requests r
where r.user_id = auth.uid();

-- Supabase default privileges grant ALL on new relations to anon and
-- authenticated. This simple view is auto-updatable and definer-owned, so a
-- leftover INSERT/UPDATE/DELETE grant would let members write through it
-- past the base table's RLS. Revoke everything, then grant SELECT only.
revoke all on public.my_member_photo_requests from anon, authenticated;
grant select on public.my_member_photo_requests to authenticated;

-- ─── Public approved-avatar view ─────────────────────────────────────────────

-- Public surfaces (leaderboard, member cards) join avatars by member_id.
-- Exposes ONLY member_id + the approved public image URL: no auth UUIDs,
-- emails, request notes, or pending/rejected rows.
create view public.public_member_avatars
with (security_barrier = true) as
select distinct on (coalesce(r.matched_member_id, m.id))
  coalesce(r.matched_member_id, m.id) as member_id,
  r.approved_avatar_url as avatar_url
from public.member_photo_requests r
left join public.members m on m.user_id = r.user_id
where r.status = 'approved'
  and r.approved_avatar_url is not null
  and coalesce(r.matched_member_id, m.id) is not null
order by coalesce(r.matched_member_id, m.id), r.reviewed_at desc nulls last;

revoke all on public.public_member_avatars from anon, authenticated;
grant select on public.public_member_avatars to anon, authenticated;

-- ─── Private bucket for pending uploads ──────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'member-photo-requests',
  'member-photo-requests',
  false,
  5242880, -- 5 MB; client compresses to ~512px webp before upload
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Members can upload pending photo requests"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'member-photo-requests'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Admins can read pending photo requests"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'member-photo-requests'
    and public.is_admin_user(auth.uid())
  );

create policy "Admins can delete pending photo requests"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'member-photo-requests'
    and public.is_admin_user(auth.uid())
  );

-- ─── Close the legacy self-serve avatar path ─────────────────────────────────

-- Publishing now requires review: drop user self-serve write policies on the
-- public avatars bucket and replace them with admin-only management. The
-- public SELECT policy ("Avatars are publicly accessible") stays so approved
-- thumbnails remain CDN-cacheable.
drop policy if exists "Users can upload their own avatars" on storage.objects;
drop policy if exists "Users can update their own avatars" on storage.objects;
drop policy if exists "Users can delete their own avatars" on storage.objects;

create policy "Admins can upload avatar objects"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'avatars' and public.is_admin_user(auth.uid()));

create policy "Admins can update avatar objects"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'avatars' and public.is_admin_user(auth.uid()));

create policy "Admins can delete avatar objects"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'avatars' and public.is_admin_user(auth.uid()));

-- user_profiles.avatar_url becomes review-managed. Ordinary users keep
-- updating their other profile fields; only avatar_url changes are blocked.
-- Admin JWTs (including inside SECURITY DEFINER review/anonymization
-- functions) and server-side jobs (auth.uid() is null) remain allowed.
create or replace function public.guard_avatar_url_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.avatar_url is distinct from old.avatar_url
     and auth.uid() is not null
     and not public.is_admin_user(auth.uid()) then
    raise exception
      'Permission denied: avatar_url is managed through the photo request review workflow';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_avatar_url_review on public.user_profiles;
create trigger guard_avatar_url_review
  before update on public.user_profiles
  for each row
  execute function public.guard_avatar_url_review();

-- The guard trigger only covers UPDATE; also stop a first-time profile
-- INSERT from self-setting avatar_url (mirrors the is_admin guard added in
-- 20260620020000_fix_user_profiles_rls_recursion.sql).
drop policy if exists "Users can insert their own profile" on public.user_profiles;
create policy "Users can insert their own profile"
  on public.user_profiles
  for insert
  to authenticated
  with check (
    auth.uid() = id
    and is_admin = false
    and avatar_url is null
  );

-- ─── Review functions (admin-guarded, SECURITY DEFINER) ─────────────────────

create or replace function public.approve_member_photo_request(
  p_request_id uuid,
  p_approved_path text,
  p_public_url text,
  p_matched_member_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.member_photo_requests;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Permission denied: admin access required';
  end if;

  select * into v_request
  from public.member_photo_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Photo request not found';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'Only pending photo requests can be approved';
  end if;

  if p_approved_path is null or char_length(trim(p_approved_path)) = 0 then
    raise exception 'Approved storage path is required';
  end if;
  if position('/storage/v1/object/public/avatars/' in p_public_url) = 0
     or position(p_approved_path in p_public_url) = 0 then
    raise exception 'Approved URL must be a public avatars-bucket URL for the approved object';
  end if;

  if p_matched_member_id is not null
     and not exists (select 1 from public.members where id = p_matched_member_id) then
    raise exception 'Matched member not found';
  end if;

  update public.member_photo_requests
  set status = 'approved',
      storage_path_approved = p_approved_path,
      approved_avatar_url = p_public_url,
      matched_member_id = coalesce(p_matched_member_id, matched_member_id),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id;

  update public.user_profiles
  set avatar_url = p_public_url
  where id = v_request.user_id;

  insert into public.member_photo_request_events (request_id, action, actor)
  values (p_request_id, 'approved', auth.uid());
end;
$$;

create or replace function public.reject_member_photo_request(
  p_request_id uuid,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.member_photo_requests;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Permission denied: admin access required';
  end if;

  select * into v_request
  from public.member_photo_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Photo request not found';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'Only pending photo requests can be rejected';
  end if;

  update public.member_photo_requests
  set status = 'rejected',
      admin_notes = coalesce(nullif(trim(p_admin_note), ''), admin_notes),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id;

  insert into public.member_photo_request_events (request_id, action, actor, note)
  values (p_request_id, 'rejected', auth.uid(), left(nullif(trim(p_admin_note), ''), 300));
end;
$$;

create or replace function public.remove_member_photo_request(
  p_request_id uuid,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.member_photo_requests;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Permission denied: admin access required';
  end if;

  select * into v_request
  from public.member_photo_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Photo request not found';
  end if;
  if v_request.status <> 'approved' then
    raise exception 'Only approved photo requests can be removed';
  end if;

  update public.member_photo_requests
  set status = 'removed',
      admin_notes = coalesce(nullif(trim(p_admin_note), ''), admin_notes),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id;

  -- Clear the profile reference only if it still points at this request's
  -- approved image, so removing an old request never blanks a newer avatar.
  update public.user_profiles
  set avatar_url = null
  where id = v_request.user_id
    and avatar_url = v_request.approved_avatar_url;

  insert into public.member_photo_request_events (request_id, action, actor, note)
  values (p_request_id, 'removed', auth.uid(), left(nullif(trim(p_admin_note), ''), 300));
end;
$$;

revoke all on function public.approve_member_photo_request(uuid, text, text, uuid) from public;
revoke all on function public.approve_member_photo_request(uuid, text, text, uuid) from anon;
grant execute on function public.approve_member_photo_request(uuid, text, text, uuid) to authenticated;

revoke all on function public.reject_member_photo_request(uuid, text) from public;
revoke all on function public.reject_member_photo_request(uuid, text) from anon;
grant execute on function public.reject_member_photo_request(uuid, text) to authenticated;

revoke all on function public.remove_member_photo_request(uuid, text) from public;
revoke all on function public.remove_member_photo_request(uuid, text) from anon;
grant execute on function public.remove_member_photo_request(uuid, text) to authenticated;
