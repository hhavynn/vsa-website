-- Future-proof only the volatile public CTA/status content.
-- This migration is additive and leaves existing public page structures intact.

alter table public.vcn_archives
  add column if not exists is_current boolean not null default false,
  add column if not exists ticket_status text not null default 'hidden',
  add column if not exists ticket_url text,
  add column if not exists ticket_note text,
  add column if not exists poster_url text,
  add column if not exists trailer_url text,
  add column if not exists event_time text,
  add column if not exists source_doc_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vcn_archives_ticket_status_check'
      and conrelid = 'public.vcn_archives'::regclass
  ) then
    alter table public.vcn_archives
      add constraint vcn_archives_ticket_status_check
      check (ticket_status in ('hidden', 'coming_soon', 'open', 'closed', 'active'));
  end if;
end $$;

create unique index if not exists vcn_archives_one_current_idx
  on public.vcn_archives (is_current)
  where is_current;

create or replace function public.ensure_single_current_vcn_archive()
returns trigger as $$
begin
  if new.is_current then
    update public.vcn_archives
    set is_current = false,
        updated_at = now()
    where id <> new.id
      and is_current = true;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists ensure_single_current_vcn_archive on public.vcn_archives;
create trigger ensure_single_current_vcn_archive
  before insert or update of is_current on public.vcn_archives
  for each row
  execute function public.ensure_single_current_vcn_archive();

update public.vcn_archives
set is_current = true,
    updated_at = now()
where id = (
  select id
  from public.vcn_archives
  where is_published = true
  order by year desc
  limit 1
)
and not exists (
  select 1 from public.vcn_archives where is_current = true
);

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
  updated_at,
  event_time,
  poster_url,
  trailer_url,
  is_current,
  ticket_status,
  ticket_url,
  ticket_note
from public.vcn_archives
where is_published = true;

grant select on public.published_vcn_archives to anon, authenticated;

create table if not exists public.program_content (
  id uuid primary key default gen_random_uuid(),
  page_key text not null,
  section_key text not null default 'current_cycle',
  title text,
  body text,
  status text not null default 'hidden',
  primary_link_label text,
  primary_link_url text,
  secondary_link_label text,
  secondary_link_url text,
  open_at timestamptz,
  close_at timestamptz,
  deadline_at timestamptz,
  event_date timestamptz,
  venue text,
  is_published boolean not null default false,
  display_order integer not null default 0,
  source_doc_url text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint program_content_page_check check (page_key in ('ace', 'intern', 'house', 'wnc')),
  constraint program_content_section_check check (section_key in ('current_cycle', 'application_cta', 'event_cta', 'notice')),
  constraint program_content_status_check check (status in ('hidden', 'coming_soon', 'open', 'closed', 'active')),
  constraint program_content_unique_slot unique (page_key, section_key)
);

alter table public.program_content enable row level security;

drop trigger if exists update_program_content_updated_at on public.program_content;
create trigger update_program_content_updated_at
  before update on public.program_content
  for each row
  execute function public.update_updated_at_column();

drop policy if exists "Public can read published program content" on public.program_content;
create policy "Public can read published program content"
  on public.program_content for select
  using (is_published = true);

drop policy if exists "Admins can view all program content" on public.program_content;
create policy "Admins can view all program content"
  on public.program_content for select
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can insert program content" on public.program_content;
create policy "Admins can insert program content"
  on public.program_content for insert
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can update program content" on public.program_content;
create policy "Admins can update program content"
  on public.program_content for update
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

drop policy if exists "Admins can delete program content" on public.program_content;
create policy "Admins can delete program content"
  on public.program_content for delete
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

insert into public.program_content (
  page_key,
  section_key,
  title,
  status,
  is_published,
  display_order
) values
  ('ace', 'current_cycle', 'Spring 2026 Cycle', 'hidden', false, 10),
  ('intern', 'current_cycle', 'Current Intern Cycle', 'hidden', false, 20),
  ('house', 'current_cycle', 'Current House Cycle', 'hidden', false, 30),
  ('wnc', 'current_cycle', 'Current Wild N'' Culture Event', 'hidden', false, 40)
on conflict (page_key, section_key) do nothing;
