-- Bound public Storage writes before issuing a one-object upload capability.
-- Manual apply before the member-photo-upload Edge Function and frontend deploy.
begin;

create table public.member_photo_upload_reservations (
  request_id uuid primary key references public.member_photo_requests(id),
  ip_hash text not null check (ip_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);
alter table public.member_photo_upload_reservations enable row level security;
revoke all on public.member_photo_upload_reservations from public, anon, authenticated;
grant select, insert on public.member_photo_upload_reservations to service_role;
create index member_photo_upload_reservations_ip_created_idx
  on public.member_photo_upload_reservations (ip_hash, created_at);

create function public.reserve_member_photo_upload(
  p_ip_hash text, p_member_id uuid, p_name text, p_email text,
  p_note text, p_content_type text, p_size integer
) returns table (request_id uuid, pending_path text)
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := gen_random_uuid();
  v_extension text;
  v_path text;
  v_now timestamptz;
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Photo upload requires read committed isolation' using errcode = '25000';
  end if;
  if auth.role() is distinct from 'service_role' then
    raise exception 'Photo upload authorization unavailable' using errcode = '42501';
  end if;
  if p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$'
    or p_size is null or p_size < 1 or p_size > 5242880
    or p_name is null or char_length(trim(p_name)) not between 1 and 200
    or p_email is null or char_length(trim(p_email)) > 200
    or lower(trim(p_email)) !~ '^[^[:space:]@]+@ucsd[.]edu$'
    or char_length(coalesce(p_note, '')) > 1000 then
    raise exception 'Invalid photo request' using errcode = '22023';
  end if;
  v_extension := case p_content_type when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png' when 'image/webp' then 'webp' end;
  if v_extension is null or not exists (select 1 from public.members where id = p_member_id) then
    raise exception 'Invalid photo request' using errcode = '22023';
  end if;

  -- Serializes reservation counts AND existing per-email/member pending checks
  -- for every public upload across Edge isolates and concurrent requests.
  perform pg_catalog.pg_advisory_xact_lock(610010002);
  v_now := clock_timestamp();
  if (select count(*) from public.member_photo_upload_reservations) >= 1000
    or (select count(*) from public.member_photo_upload_reservations
      where created_at >= v_now - interval '24 hours') >= 100
    or (select count(*) from public.member_photo_upload_reservations
      where ip_hash = p_ip_hash and created_at >= v_now - interval '24 hours') >= 5 then
    raise exception 'Photo request limit reached. Please contact VSA.' using errcode = 'P0001';
  end if;

  v_path := 'pending/' || v_id::text || '.' || v_extension;
  -- Existing trigger enforces pending/member<=3 and pending/email<=5;
  -- both request and reservation commit atomically before Storage can be used.
  insert into public.member_photo_requests (
    id, user_id, matched_member_id, submitted_name, submitted_email,
    note_to_admins, consent_confirmed, storage_path_pending
  ) values (v_id, null, p_member_id, trim(p_name), lower(trim(p_email)),
    nullif(trim(p_note), ''), true, v_path);
  insert into public.member_photo_upload_reservations (request_id, ip_hash)
    values (v_id, p_ip_hash);
  return query select v_id, v_path;
end;
$$;
revoke all on function public.reserve_member_photo_upload(text, uuid, text, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_member_photo_upload(text, uuid, text, text, text, text, integer)
  to service_role;

-- Clients can no longer create rows independently of an upload reservation.
drop policy if exists "Anyone can submit photo requests" on public.member_photo_requests;
revoke insert on public.member_photo_requests from anon, authenticated;

-- Preserve the admin original-upload flow; public clients need signed tokens.
drop policy if exists "Anyone can upload pending photo requests" on storage.objects;
create policy "Admins can upload pending photo requests" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'member-photo-requests'
    and (storage.foldername(name))[1] = 'pending'
    and public.is_admin_user(auth.uid())
  );
-- Restrictive check also blocks permissive policy drift for this bucket.
create policy "Pending photo uploads require admin" on storage.objects
  as restrictive for insert to anon, authenticated with check (
    bucket_id <> 'member-photo-requests' or public.is_admin_user(auth.uid())
  );

comment on table public.member_photo_upload_reservations is
  'Service-only, append-only photo upload budget. HMAC IP hashes only. Failed uploads consume quota; no automatic release. Lifetime1000, rolling24h100 global/5 perIP.';
commit;
