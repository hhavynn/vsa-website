-- Supabase usage audit for vsawebsite.
-- Run sections 1-7 first. They are read-only.
-- Do not run cleanup templates until you have reviewed exact candidate rows.

-- 1) Storage usage by bucket.
select
  b.id as bucket_id,
  b.public,
  count(o.id) as object_count,
  pg_size_pretty(coalesce(sum((o.metadata->>'size')::bigint), 0)) as total_size,
  round(coalesce(sum((o.metadata->>'size')::numeric), 0) / 1024 / 1024 / 1024, 3) as total_gb,
  pg_size_pretty(coalesce(max((o.metadata->>'size')::bigint), 0)) as largest_object,
  min(o.created_at) as oldest_object_at,
  max(o.updated_at) as newest_update_at
from storage.buckets b
left join storage.objects o on o.bucket_id = b.id
group by b.id, b.public
order by coalesce(sum((o.metadata->>'size')::bigint), 0) desc;

-- 2) Largest storage objects across likely image buckets.
select
  bucket_id,
  name,
  pg_size_pretty((metadata->>'size')::bigint) as size,
  round((metadata->>'size')::numeric / 1024 / 1024, 2) as size_mb,
  metadata->>'mimetype' as mimetype,
  metadata->>'eTag' as etag,
  created_at,
  updated_at
from storage.objects
where bucket_id in (
  'gallery_images',
  'event_images',
  'cabinet_images',
  'site_assets',
  'presidents_images',
  'house_images',
  'ace_family_images',
  'avatars'
)
order by (metadata->>'size')::bigint desc nulls last
limit 200;

-- 3) Storage by bucket and MIME type/extension.
select
  bucket_id,
  coalesce(metadata->>'mimetype', 'unknown') as mimetype,
  lower(coalesce(nullif(regexp_replace(name, '^.*\.', ''), name), 'no_ext')) as extension,
  count(*) as object_count,
  pg_size_pretty(sum((metadata->>'size')::bigint)) as total_size,
  round(sum((metadata->>'size')::numeric) / 1024 / 1024, 2) as total_mb,
  pg_size_pretty(max((metadata->>'size')::bigint)) as largest_object
from storage.objects
group by bucket_id, coalesce(metadata->>'mimetype', 'unknown'), lower(coalesce(nullif(regexp_replace(name, '^.*\.', ''), name), 'no_ext'))
order by sum((metadata->>'size')::bigint) desc nulls last;

-- 4) Likely duplicate files by exact storage ETag.
-- Review these manually. ETag is a strong signal for duplicate content in normal Supabase Storage uploads.
with duplicate_groups as (
  select
    bucket_id,
    metadata->>'eTag' as etag,
    count(*) as object_count,
    sum((metadata->>'size')::bigint) as total_bytes,
    max((metadata->>'size')::bigint) as one_copy_bytes
  from storage.objects
  where metadata ? 'eTag'
    and metadata ? 'size'
  group by bucket_id, metadata->>'eTag'
  having count(*) > 1
)
select
  d.bucket_id,
  d.etag,
  d.object_count,
  pg_size_pretty(d.total_bytes) as total_size,
  pg_size_pretty(d.total_bytes - d.one_copy_bytes) as possible_savings,
  o.name,
  pg_size_pretty((o.metadata->>'size')::bigint) as size,
  o.created_at,
  o.updated_at
from duplicate_groups d
join storage.objects o
  on o.bucket_id = d.bucket_id
 and o.metadata->>'eTag' = d.etag
order by d.total_bytes desc, d.bucket_id, d.etag, o.created_at;

-- 5) Referenced storage objects from app tables.
-- This normalizes public Supabase Storage URLs back to bucket_id/name.
with referenced_urls as (
  select 'event_images' as expected_bucket, 'events.image_url' as source, id::text as row_id, image_url as url
  from public.events
  where image_url is not null and image_url <> ''
  union all
  select 'gallery_images', 'gallery_events.cover_image_url', id::text, cover_image_url
  from public.gallery_events
  where cover_image_url is not null and cover_image_url <> ''
  union all
  select 'gallery_images', 'gallery_events.images[]', id::text, unnest(images)
  from public.gallery_events
  where images is not null
  union all
  select 'cabinet_images', 'cabinet_members.image_url', id::text, image_url
  from public.cabinet_members
  where image_url is not null and image_url <> ''
  union all
  select 'site_assets', 'site_settings.logo_url', id::text, logo_url
  from public.site_settings
  where logo_url is not null and logo_url <> ''
  union all
  select 'presidents_images', 'homepage_content.presidents_photo_url', id::text, presidents_photo_url
  from public.homepage_content
  where presidents_photo_url is not null and presidents_photo_url <> ''
  union all
  select 'house_images', 'house_page_assets.image_url', id::text, image_url
  from public.house_page_assets
  where image_url is not null and image_url <> ''
  union all
  select 'ace_family_images', 'ace_families.cover_image_url', id::text, cover_image_url
  from public.ace_families
  where cover_image_url is not null and cover_image_url <> ''
  union all
  select 'ace_family_images', 'ace_family_members.photo_url', id::text, photo_url
  from public.ace_family_members
  where photo_url is not null and photo_url <> ''
  union all
  select 'avatars', 'user_profiles.avatar_url', id::text, avatar_url
  from public.user_profiles
  where avatar_url is not null and avatar_url <> ''
),
normalized_refs as (
  select
    expected_bucket,
    source,
    row_id,
    url,
    split_part(split_part(url, '/storage/v1/object/public/', 2), '/', 1) as bucket_id,
    substring(split_part(url, '/storage/v1/object/public/', 2) from position('/' in split_part(url, '/storage/v1/object/public/', 2)) + 1) as object_name
  from referenced_urls
  where url like '%/storage/v1/object/public/%'
)
select *
from normalized_refs
order by bucket_id, object_name, source;

-- 6) Orphaned storage candidates: objects not referenced by current app rows.
-- These are candidates only. Export/review before deleting through Storage API or UI.
with referenced_urls as (
  select image_url as url from public.events where image_url is not null and image_url <> ''
  union all select cover_image_url from public.gallery_events where cover_image_url is not null and cover_image_url <> ''
  union all select unnest(images) from public.gallery_events where images is not null
  union all select image_url from public.cabinet_members where image_url is not null and image_url <> ''
  union all select logo_url from public.site_settings where logo_url is not null and logo_url <> ''
  union all select presidents_photo_url from public.homepage_content where presidents_photo_url is not null and presidents_photo_url <> ''
  union all select image_url from public.house_page_assets where image_url is not null and image_url <> ''
  union all select cover_image_url from public.ace_families where cover_image_url is not null and cover_image_url <> ''
  union all select photo_url from public.ace_family_members where photo_url is not null and photo_url <> ''
  union all select avatar_url from public.user_profiles where avatar_url is not null and avatar_url <> ''
),
normalized_refs as (
  select
    split_part(split_part(url, '/storage/v1/object/public/', 2), '/', 1) as bucket_id,
    substring(split_part(url, '/storage/v1/object/public/', 2) from position('/' in split_part(url, '/storage/v1/object/public/', 2)) + 1) as object_name
  from referenced_urls
  where url like '%/storage/v1/object/public/%'
),
orphan_candidates as (
  select
    o.bucket_id,
    o.name,
    pg_size_pretty((o.metadata->>'size')::bigint) as size,
    round((o.metadata->>'size')::numeric / 1024 / 1024, 2) as size_mb,
    o.metadata->>'mimetype' as mimetype,
    o.created_at,
    o.updated_at
  from storage.objects o
  left join normalized_refs r
    on r.bucket_id = o.bucket_id
   and r.object_name = o.name
  where o.bucket_id in (
    'gallery_images',
    'event_images',
    'cabinet_images',
    'site_assets',
    'presidents_images',
    'house_images',
    'ace_family_images',
    'avatars'
  )
    and r.object_name is null
)
select *
from orphan_candidates
order by size_mb desc, bucket_id, name
limit 500;

-- 7) Largest Postgres tables and indexes.
select
  schemaname,
  relname as table_name,
  n_live_tup as estimated_live_rows,
  n_dead_tup as estimated_dead_rows,
  pg_size_pretty(pg_relation_size(relid)) as table_heap,
  pg_size_pretty(pg_indexes_size(relid)) as indexes,
  pg_size_pretty(pg_total_relation_size(relid)) as total
from pg_stat_user_tables
order by pg_total_relation_size(relid) desc;

select
  schemaname,
  relname as table_name,
  indexrelname as index_name,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  idx_scan
from pg_stat_user_indexes
order by pg_relation_size(indexrelid) desc
limit 50;

-- 8) Largest rows in app tables likely to contain large text/arrays.
select 'gallery_events' as table_name, id::text, pg_column_size(gallery_events.*) as row_bytes, title as label, created_at
from public.gallery_events
order by row_bytes desc
limit 50;

select 'homepage_content' as table_name, id::text, pg_column_size(homepage_content.*) as row_bytes, presidents_names as label, created_at
from public.homepage_content
order by row_bytes desc
limit 50;

select 'program_content' as table_name, id::text, pg_column_size(program_content.*) as row_bytes, concat(page_key, ':', section_key) as label, created_at
from public.program_content
order by row_bytes desc
limit 50;

-- Optional: run only if this project has public.chat_logs.
-- select 'chat_logs' as table_name, id::text, pg_column_size(chat_logs.*) as row_bytes, left(user_message, 80) as label, created_at
-- from public.chat_logs
-- order by row_bytes desc
-- limit 50;

-- 9) Attendance/import duplicate checks.
select
  member_id,
  event_id,
  count(*) as duplicate_count,
  min(imported_at) as first_imported_at,
  max(imported_at) as last_imported_at,
  sum(points_earned) as summed_points
from public.member_event_attendance
group by member_id, event_id
having count(*) > 1
order by duplicate_count desc, last_imported_at desc;

select
  user_id,
  event_id,
  count(*) as duplicate_count,
  min(checked_in_at) as first_checked_in_at,
  max(checked_in_at) as last_checked_in_at,
  sum(points_earned) as summed_points
from public.event_attendance
group by user_id, event_id
having count(*) > 1
order by duplicate_count desc, last_checked_in_at desc;

select
  date_trunc('hour', imported_at) as import_hour,
  event_id,
  count(*) as rows_imported,
  count(distinct member_id) as distinct_members,
  sum(points_earned) as points_imported
from public.member_event_attendance
group by date_trunc('hour', imported_at), event_id
order by import_hour desc, rows_imported desc;

-- 10) Suspicious test/demo rows. Review only.
select 'events' as table_name, id::text, name as label, created_at
from public.events
where name ilike any(array['%test%', '%dummy%', '%sample%', '%demo%'])
   or description ilike any(array['%test%', '%dummy%', '%sample%', '%demo%'])
union all
select 'gallery_events', id::text, title, created_at
from public.gallery_events
where title ilike any(array['%test%', '%dummy%', '%sample%', '%demo%'])
   or coalesce(description, '') ilike any(array['%test%', '%dummy%', '%sample%', '%demo%'])
union all
select 'members', id::text, concat(first_name, ' ', last_name, ' ', coalesce(email, '')), created_at
from public.members
where first_name ilike any(array['%test%', '%dummy%', '%sample%', '%demo%'])
   or last_name ilike any(array['%test%', '%dummy%', '%sample%', '%demo%'])
   or coalesce(email, '') ilike any(array['%test%', '%dummy%', '%sample%', '%demo%', '%example.com%'])
order by created_at desc;

-- 11) Member duplicate candidates.
select
  lower(coalesce(email, concat(first_name, '.', last_name))) as duplicate_key,
  count(*) as row_count,
  array_agg(id order by created_at) as ids,
  array_agg(concat(first_name, ' ', last_name, ' <', coalesce(email, ''), '>') order by created_at) as members
from public.members
group by lower(coalesce(email, concat(first_name, '.', last_name)))
having count(*) > 1
order by row_count desc;

-- 11b) Detailed duplicate-member review.
-- Use this before calling smart_merge_members. Prefer keeping the row with:
-- user_id, email, more filled profile fields, or older created_at if otherwise equal.
with duplicate_keys as (
  select lower(coalesce(email, concat(first_name, '.', last_name))) as duplicate_key
  from public.members
  group by lower(coalesce(email, concat(first_name, '.', last_name)))
  having count(*) > 1
),
member_detail as (
  select
    lower(coalesce(m.email, concat(m.first_name, '.', m.last_name))) as duplicate_key,
    m.id,
    m.first_name,
    m.last_name,
    m.email,
    m.college,
    m.year,
    m.house,
    m.user_id,
    m.points,
    m.events_attended,
    m.needs_review,
    m.created_at,
    m.updated_at,
    count(mea.id) as attendance_rows,
    max(mea.imported_at) as latest_imported_at
  from public.members m
  join duplicate_keys dk
    on dk.duplicate_key = lower(coalesce(m.email, concat(m.first_name, '.', m.last_name)))
  left join public.member_event_attendance mea
    on mea.member_id = m.id
  group by
    m.id,
    duplicate_key
)
select *
from member_detail
order by duplicate_key, created_at, id;

-- 11c) Merge preview for a chosen pair.
-- Replace the UUIDs, review the result, then run the RPC only if source should be deleted.
-- with chosen as (
--   select
--     'SOURCE_MEMBER_UUID'::uuid as source_id,
--     'TARGET_MEMBER_UUID'::uuid as target_id
-- ),
-- source_attendance as (
--   select mea.*
--   from public.member_event_attendance mea
--   join chosen c on c.source_id = mea.member_id
-- ),
-- target_attendance as (
--   select mea.*
--   from public.member_event_attendance mea
--   join chosen c on c.target_id = mea.member_id
-- )
-- select
--   c.source_id,
--   c.target_id,
--   count(sa.id) as source_attendance_rows,
--   count(ta.id) as target_attendance_rows,
--   count(sa.id) filter (where ta.event_id is null) as rows_that_would_transfer,
--   count(sa.id) filter (where ta.event_id is not null) as duplicate_event_rows_that_would_be_ignored
-- from chosen c
-- left join source_attendance sa on true
-- left join target_attendance ta on ta.event_id = sa.event_id
-- group by c.source_id, c.target_id;

-- Run only after reviewing 11b and 11c:
-- select public.smart_merge_members(
--   'SOURCE_MEMBER_UUID'::uuid,
--   'TARGET_MEMBER_UUID'::uuid
-- );

-- 12) Cleanup templates, intentionally commented.
-- Storage deletion note:
-- Prefer Supabase Storage UI/API deletion using the exact bucket_id/name rows from section 6.
-- Direct SQL deletes from storage.objects are not recommended because they can bypass the Storage service path.

-- Database duplicate attendance cleanup template.
-- First preview exact rows:
-- with ranked as (
--   select
--     id,
--     member_id,
--     event_id,
--     points_earned,
--     imported_at,
--     row_number() over (
--       partition by member_id, event_id
--       order by imported_at asc, id asc
--     ) as keep_rank
--   from public.member_event_attendance
-- )
-- select *
-- from ranked
-- where keep_rank > 1
-- order by event_id, member_id, imported_at;

-- Then delete only after confirming the preview:
-- with ranked as (
--   select
--     id,
--     row_number() over (
--       partition by member_id, event_id
--       order by imported_at asc, id asc
--     ) as keep_rank
--   from public.member_event_attendance
-- )
-- delete from public.member_event_attendance mea
-- using ranked r
-- where mea.id = r.id
--   and r.keep_rank > 1;

-- Test-row cleanup template.
-- Replace the UUID list with exact ids from section 10 after review.
-- delete from public.events where id = any(array[
--   '00000000-0000-0000-0000-000000000000'::uuid
-- ]);
