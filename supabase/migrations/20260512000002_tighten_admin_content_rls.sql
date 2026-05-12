-- Tighten write access for admin-managed content while preserving public reads.
-- Public users can still read public site data; only admins can mutate these rows/assets.

drop policy if exists "Authenticated users can insert cabinet members" on public.cabinet_members;
drop policy if exists "Authenticated users can update cabinet members" on public.cabinet_members;
drop policy if exists "Authenticated users can delete cabinet members" on public.cabinet_members;
drop policy if exists "Admins can insert cabinet members" on public.cabinet_members;
drop policy if exists "Admins can update cabinet members" on public.cabinet_members;
drop policy if exists "Admins can delete cabinet members" on public.cabinet_members;

create policy "Admins can insert cabinet members"
  on public.cabinet_members for insert
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can update cabinet members"
  on public.cabinet_members for update
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can delete cabinet members"
  on public.cabinet_members for delete
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Allow authenticated users to insert gallery_events" on public.gallery_events;
drop policy if exists "Allow authenticated users to update gallery_events" on public.gallery_events;
drop policy if exists "Allow authenticated users to delete gallery_events" on public.gallery_events;
drop policy if exists "Admins can insert gallery events" on public.gallery_events;
drop policy if exists "Admins can update gallery events" on public.gallery_events;
drop policy if exists "Admins can delete gallery events" on public.gallery_events;

create policy "Admins can insert gallery events"
  on public.gallery_events for insert
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can update gallery events"
  on public.gallery_events for update
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can delete gallery events"
  on public.gallery_events for delete
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Authenticated users can insert homepage content" on public.homepage_content;
drop policy if exists "Authenticated users can update homepage content" on public.homepage_content;
drop policy if exists "Admins can insert homepage content" on public.homepage_content;
drop policy if exists "Admins can update homepage content" on public.homepage_content;

create policy "Admins can insert homepage content"
  on public.homepage_content for insert
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can update homepage content"
  on public.homepage_content for update
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Authenticated users can insert members" on public.members;
drop policy if exists "Authenticated users can update members" on public.members;
drop policy if exists "Authenticated users can delete members" on public.members;
drop policy if exists "Admins can insert members" on public.members;
drop policy if exists "Admins can update members" on public.members;
drop policy if exists "Admins can delete members" on public.members;

create policy "Admins can insert members"
  on public.members for insert
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can update members"
  on public.members for update
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can delete members"
  on public.members for delete
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Authenticated users can manage member attendance" on public.member_event_attendance;
drop policy if exists "Admins can manage member attendance" on public.member_event_attendance;

create policy "Admins can manage member attendance"
  on public.member_event_attendance for all
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Authenticated users can manage merge exclusions" on public.merge_exclusions;
drop policy if exists "Admins can manage merge exclusions" on public.merge_exclusions;

create policy "Admins can manage merge exclusions"
  on public.merge_exclusions for all
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Allow authenticated users to upload event images" on storage.objects;
drop policy if exists "Allow authenticated users to update event images" on storage.objects;
drop policy if exists "Allow authenticated users to delete event images" on storage.objects;
drop policy if exists "Admins can upload event images" on storage.objects;
drop policy if exists "Admins can update event images" on storage.objects;
drop policy if exists "Admins can delete event images" on storage.objects;

create policy "Admins can upload event images"
  on storage.objects for insert
  with check (
    bucket_id = 'event_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can update event images"
  on storage.objects for update
  using (
    bucket_id = 'event_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    bucket_id = 'event_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can delete event images"
  on storage.objects for delete
  using (
    bucket_id = 'event_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Authenticated users can upload cabinet images" on storage.objects;
drop policy if exists "Authenticated users can update cabinet images" on storage.objects;
drop policy if exists "Authenticated users can delete cabinet images" on storage.objects;
drop policy if exists "Admins can upload cabinet images" on storage.objects;
drop policy if exists "Admins can update cabinet images" on storage.objects;
drop policy if exists "Admins can delete cabinet images" on storage.objects;

create policy "Admins can upload cabinet images"
  on storage.objects for insert
  with check (
    bucket_id = 'cabinet_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can update cabinet images"
  on storage.objects for update
  using (
    bucket_id = 'cabinet_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    bucket_id = 'cabinet_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can delete cabinet images"
  on storage.objects for delete
  using (
    bucket_id = 'cabinet_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Allow authenticated users to upload gallery images" on storage.objects;
drop policy if exists "Allow authenticated users to update gallery images" on storage.objects;
drop policy if exists "Allow authenticated users to delete gallery images" on storage.objects;
drop policy if exists "Admins can upload gallery images" on storage.objects;
drop policy if exists "Admins can update gallery images" on storage.objects;
drop policy if exists "Admins can delete gallery images" on storage.objects;

create policy "Admins can upload gallery images"
  on storage.objects for insert
  with check (
    bucket_id = 'gallery_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can update gallery images"
  on storage.objects for update
  using (
    bucket_id = 'gallery_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    bucket_id = 'gallery_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can delete gallery images"
  on storage.objects for delete
  using (
    bucket_id = 'gallery_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Authenticated users can upload presidents images" on storage.objects;
drop policy if exists "Authenticated users can update presidents images" on storage.objects;
drop policy if exists "Authenticated users can delete presidents images" on storage.objects;
drop policy if exists "Admins can upload presidents images" on storage.objects;
drop policy if exists "Admins can update presidents images" on storage.objects;
drop policy if exists "Admins can delete presidents images" on storage.objects;

create policy "Admins can upload presidents images"
  on storage.objects for insert
  with check (
    bucket_id = 'presidents_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can update presidents images"
  on storage.objects for update
  using (
    bucket_id = 'presidents_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    bucket_id = 'presidents_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can delete presidents images"
  on storage.objects for delete
  using (
    bucket_id = 'presidents_images'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );
