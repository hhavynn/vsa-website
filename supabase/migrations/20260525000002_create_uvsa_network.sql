-- Migration: Create UVSA Network tables
-- Description: Adds uvsa_schools and external_events tables for the SoCal VSA Network feature.

-- 1. Create uvsa_schools table
create table if not exists public.uvsa_schools (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  short_name text not null,
  slug text unique not null,
  system_type text not null check (system_type in ('UC', 'CSU', 'Private')),
  city text,
  vsa_name text,
  instagram_url text,
  linktree_url text,
  website_url text,
  facebook_url text,
  youtube_url text,
  tiktok_url text,
  description text,
  known_for text[] default '{}',
  recurring_events text[] default '{}',
  logo_url text,
  image_url text,
  confidence_level text check (confidence_level in ('high', 'medium', 'low')) default 'high',
  verification_notes text,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 2. Create external_events table
create table if not exists public.external_events (
  id uuid primary key default gen_random_uuid(),
  uvsa_school_id uuid references public.uvsa_schools(id) on delete set null,
  title text not null,
  event_type text,
  date date,
  academic_term_id uuid references public.academic_terms(id) on delete set null,
  location text,
  description text,
  points integer default 4,
  rsvp_url text,
  ride_form_url text,
  instagram_url text,
  host_info_url text,
  ride_info text,
  status text check (status in ('draft', 'upcoming', 'past', 'historical', 'canceled')) default 'draft',
  photo_album_url text,
  recap text,
  source_notes text,
  confidence_level text check (confidence_level in ('high', 'medium', 'low')) default 'high',
  is_featured boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 3. Add updated_at triggers
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_uvsa_schools_updated_at
  before update on public.uvsa_schools
  for each row execute function public.handle_updated_at();

create trigger set_external_events_updated_at
  before update on public.external_events
  for each row execute function public.handle_updated_at();

-- 4. Enable RLS
alter table public.uvsa_schools enable row level security;
alter table public.external_events enable row level security;

-- 5. Create RLS Policies

-- uvsa_schools policies
create policy "Public can read active uvsa schools"
  on public.uvsa_schools for select
  using (is_active = true);

create policy "Admins can manage uvsa schools"
  on public.uvsa_schools for all
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

-- external_events policies
create policy "Public can read non-draft external events"
  on public.external_events for select
  using (status != 'draft');

create policy "Admins can manage external events"
  on public.external_events for all
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

-- 6. Seed UVSA Schools
insert into public.uvsa_schools (school_name, short_name, slug, system_type, city, vsa_name, linktree_url, sort_order)
values
  ('University of Southern California', 'USC', 'usc', 'Private', 'Los Angeles', 'USC VSA', 'https://linktr.ee/uscvsa', 1),
  ('Chapman University', 'Chapman', 'chapman', 'Private', 'Orange', 'Chapman VSA', 'https://linktr.ee/chapmanvsa', 2),
  ('University of California, Riverside', 'UCR', 'ucr', 'UC', 'Riverside', 'UCR VSA', 'https://linktr.ee/ucrvsa', 3),
  ('University of California, Irvine', 'UCI', 'uci', 'UC', 'Irvine', 'VSA UCI', 'https://linktr.ee/vsauci', 4),
  ('University of California, San Diego', 'UCSD', 'ucsd', 'UC', 'La Jolla', 'UCSD VSA', 'https://linktr.ee/vsaatucsd', 5),
  ('University of California, Santa Barbara', 'UCSB', 'ucsb', 'UC', 'Santa Barbara', 'UCSB VSA', 'https://linktr.ee/ucsbvsa', 6),
  ('California State University, Fullerton', 'CSUF', 'csuf', 'CSU', 'Fullerton', 'CSUF VSA', 'https://linktr.ee/CSUFVSA', 7),
  ('California State University, Northridge', 'CSUN', 'csun', 'CSU', 'Northridge', 'CSUN VSA', 'https://linktr.ee/csunvsa2023', 8),
  ('California State University, San Marcos', 'CSUSM', 'csusm', 'CSU', 'San Marcos', 'CSUSM VSA', 'https://linktr.ee/csusmvsa', 9),
  ('California Polytechnic State University, San Luis Obispo', 'CPSLO', 'cpslo', 'CSU', 'San Luis Obispo', 'CPSLO VSA', 'https://linktr.ee/cptvsa', 10),
  ('California State Polytechnic University, Pomona', 'CPP', 'cpp', 'CSU', 'Pomona', 'CPP VSA', 'https://linktr.ee/vsacpp', 11),
  ('California State University, Long Beach', 'CSULB', 'csulb', 'CSU', 'Long Beach', 'CSULB VSA', 'https://linktr.ee/lbvsa1', 12),
  ('San Diego State University', 'SDSU', 'sdsu', 'CSU', 'San Diego', 'SDSU VSA', 'https://linktr.ee/sdsuvsa', 13)
on conflict (slug) do nothing;

-- 7. Seed External Showcase Events (2025-2026)
do $$
declare
  sdsu_id uuid;
  csusm_id uuid;
  csulb_id uuid;
  cpp_id uuid;
  cpslo_id uuid;
  csun_id uuid;
  csuf_id uuid;
  ucsb_id uuid;
  uci_id uuid;
  ucr_id uuid;
  chapman_id uuid;
  usc_id uuid;
  ucsd_id uuid;
begin
  select id into sdsu_id from public.uvsa_schools where short_name = 'SDSU';
  select id into csusm_id from public.uvsa_schools where short_name = 'CSUSM';
  select id into csulb_id from public.uvsa_schools where short_name = 'CSULB';
  select id into cpp_id from public.uvsa_schools where short_name = 'CPP';
  select id into cpslo_id from public.uvsa_schools where short_name = 'CPSLO';
  select id into csun_id from public.uvsa_schools where short_name = 'CSUN';
  select id into csuf_id from public.uvsa_schools where short_name = 'CSUF';
  select id into ucsb_id from public.uvsa_schools where short_name = 'UCSB';
  select id into uci_id from public.uvsa_schools where short_name = 'UCI';
  select id into ucr_id from public.uvsa_schools where short_name = 'UCR';
  select id into chapman_id from public.uvsa_schools where short_name = 'Chapman';
  select id into usc_id from public.uvsa_schools where short_name = 'USC';
  select id into ucsd_id from public.uvsa_schools where short_name = 'UCSD';

  insert into public.external_events (uvsa_school_id, title, event_type, points, status, description)
  values
    (sdsu_id, 'Mount Jamprov', 'Improv / Skit Competition', 4, 'past', 'Teams are given prompts and perform skits in a competition format, mixing improv, music, Vietnamese-American culture, and Asian American themes.'),
    (csusm_id, 'Gettin'' Hot', 'Hot Sauce Competition / Challenge Event', 4, 'past', 'Contestants eat progressively spicier sauces while completing physical challenges and trivia involving pop culture, Vietnamese culture, and random facts.'),
    (csulb_id, 'Long Beach Lip Sync', 'Lip Sync / Dance Performance Competition', 4, 'past', 'Teams perform themed lip sync battles. Judging can include dance execution, lip sync ability, and overall performance.'),
    (cpp_id, 'VietWit', 'Trivia / Game Competition', 4, 'past', 'Teams compete in head-to-head challenges and trivia rounds, with point values similar to Jeopardy. Losing teams may face funny wheel challenges.'),
    (cpslo_id, 'Saigon Runway', 'Fashion / Runway Challenge', 4, 'historical', 'Teams create runway outfits out of unconventional materials and compete in mini games to win supplies. Each team needs a model to showcase the final design. Note: CPSLO did not host this in 2025–2026 according to current notes; most recent known year was 2024–2025.'),
    (csun_id, 'Cinemania', 'Short Film / Skit Festival', 4, 'historical', 'Schools create short films or skits around a yearly theme, gather to watch the videos, and vote for favorites. Note: CSUN did not host this in 2025–2026 according to current notes; most recent known year was 2024–2025.'),
    (csuf_id, 'Get To The Point', 'Competitive Prompt Game', 4, 'past', 'Teams of four answer prompts in funny, unique, and comedic ways while competing head-to-head.'),
    (ucsb_id, 'Pho King', 'Male Pageant / Charity Showcase', 4, 'past', 'Contestants represent their schools in a male pageant celebrating brotherhood, Asian American identity, family, culture, and confidence. Includes performances and Q&A.'),
    (uci_id, 'Rose Pageant', 'Pageant / Cultural Showcase', 4, 'past', 'A pageant celebrating Vietnamese culture, confidence, leadership, public speaking, and personal storytelling. UCI Rose Pageant has its own Instagram: @uci.rp.'),
    (ucr_id, 'Viet Idol', 'Singing Competition / Talent Show', 4, 'past', 'An annual singing competition hosted by UCR VSA, inviting musical students from universities across Southern California.'),
    (chapman_id, 'Survey Says', 'Game Show / Family Feud-style Competition', 4, 'past', 'Contestants go head-to-head trying to guess popular survey answers.'),
    (usc_id, 'Finding Yeu', 'Dating Show / Challenge Event', 4, 'past', 'Contestants are paired and compete through challenges and conversations, with a final "would you go on another date?" style reveal.'),
    (ucsd_id, 'Wild N'' Culture', 'UCSD-hosted External / Culture-Game Event', 5, 'past', 'UCSD VSA''s hosted external that brings schools together for competition, culture, performance, and inter-school connection.');
end $$;
