-- Dedicated archive records for Vietnamese Culture Night productions.
-- Public users can read only published rows; admins can manage all rows.

create table if not exists public.vcn_archives (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique,
  title text,
  annual_number text,
  theme_name text,
  event_date date,
  venue text,
  description text,
  video_url text,
  photo_album_url text,
  album_source text,
  cover_image_url text,
  photo_credit text,
  is_published boolean not null default false,
  is_featured boolean not null default false,
  display_order integer not null default 0,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vcn_archives enable row level security;

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_vcn_archives_updated_at on public.vcn_archives;
create trigger update_vcn_archives_updated_at
  before update on public.vcn_archives
  for each row
  execute function public.update_updated_at_column();

drop policy if exists "Admins can view all VCN archives" on public.vcn_archives;
create policy "Admins can view all VCN archives"
  on public.vcn_archives for select
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can insert VCN archives" on public.vcn_archives;
create policy "Admins can insert VCN archives"
  on public.vcn_archives for insert
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can update VCN archives" on public.vcn_archives;
create policy "Admins can update VCN archives"
  on public.vcn_archives for update
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

drop policy if exists "Admins can delete VCN archives" on public.vcn_archives;
create policy "Admins can delete VCN archives"
  on public.vcn_archives for delete
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

insert into public.vcn_archives (
  year,
  title,
  annual_number,
  theme_name,
  event_date,
  venue,
  description,
  video_url,
  photo_album_url,
  album_source,
  cover_image_url,
  photo_credit,
  is_published,
  is_featured,
  display_order,
  internal_notes
) values
  (
    2026,
    'Tình Yêu Thầm Lặng',
    '29th Annual',
    null,
    '2026-04-18',
    'Mandeville Auditorium',
    'The story centers on love expressed through actions rather than words. It follows children growing up in a traditional Vietnamese household where parents rarely verbalize affection, leading the children to misunderstand acts of service as obligation rather than love.',
    null,
    'https://photos.app.goo.gl/zURcmEoSiqLGcBmx5',
    'Google Photos',
    null,
    null,
    true,
    true,
    10,
    'Video unknown. Photo album user-provided; verify public access.'
  ),
  (
    2025,
    'A Fractured Bloom (Hoa Sen Nở Trong Đêm Tối)',
    '28th Annual',
    null,
    '2025-04-19',
    null,
    'Follows a young woman trying to reconnect with her estranged sister while facing family wounds, generational divides, cultural identity, emotional abandonment, loyalty, forgiveness, and healing.',
    'https://www.youtube.com/watch?v=Ad3w8_xtcNY&t=862s',
    'https://uvsa.smugmug.com/UVSA-School-Events-/VCN-2025/UCSD-VCN-25',
    'SmugMug',
    null,
    'Photos by UVSA SoCal / UVSA Media Team. Please credit @uvsasocal if using photos.',
    true,
    false,
    20,
    'Date and photo album came from a 2025 recap marketing request. Venue appeared in script/recap context, but no clean venue field was found.'
  ),
  (
    2024,
    'Homecoming: Đi Xa Để Trở Về',
    '27th Annual',
    null,
    '2024-04-20',
    'Mandeville Auditorium @ UC San Diego',
    'A Vietnamese-American teen, Vince, grapples with his parents'' expectations and his own identity, caught in a tug-of-war between his Vietnamese heritage and American upbringing. When a life-altering event throws him off course, he''ll be forced to confront his roots and discover what home truly means.',
    'https://youtu.be/FCNjXFYZllY?si=mLgC3tAkiW7TPoDM',
    'https://uvsa.smugmug.com/UVSA-School-Events-/VCN-2024/UCSD-VCN',
    'SmugMug',
    null,
    'Photos by UVSA SoCal / UVSA Media Team. Please credit @uvsasocal if using photos.',
    true,
    false,
    30,
    'Strongest archive source is a planning/marketing spreadsheet, not an exported final flyer image.'
  ),
  (
    2023,
    'History Repeats Itself',
    '26th Annual',
    null,
    '2023-04-22',
    'Mandeville',
    'Casey, a recent college graduate, faces repeated rejection until a time traveler appears and reveals a family curse. The show explores first-generation Vietnamese-American expectations, immigrant parent sacrifice, and whether history repeats itself.',
    null,
    null,
    null,
    null,
    null,
    false,
    false,
    40,
    'Ready metadata from Drive/notes if available, but missing public video/photo links.'
  )
on conflict (year) do update set
  title = excluded.title,
  annual_number = excluded.annual_number,
  theme_name = excluded.theme_name,
  event_date = excluded.event_date,
  venue = excluded.venue,
  description = excluded.description,
  video_url = excluded.video_url,
  photo_album_url = excluded.photo_album_url,
  album_source = excluded.album_source,
  cover_image_url = excluded.cover_image_url,
  photo_credit = excluded.photo_credit,
  is_published = excluded.is_published,
  is_featured = excluded.is_featured,
  display_order = excluded.display_order,
  internal_notes = excluded.internal_notes,
  updated_at = now();

create or replace view public.published_vcn_archives as
select
  id,
  year,
  title,
  annual_number,
  theme_name,
  event_date,
  venue,
  description,
  video_url,
  photo_album_url,
  album_source,
  cover_image_url,
  photo_credit,
  is_published,
  is_featured,
  display_order,
  created_at,
  updated_at
from public.vcn_archives
where is_published = true;

grant select on public.published_vcn_archives to anon, authenticated;
