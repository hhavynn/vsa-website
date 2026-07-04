-- Migration: Create editable UVSA Network page settings
-- Description: Adds a singleton settings table for public UVSA Network page copy and labels.

create table if not exists public.uvsa_network_page_settings (
  id text primary key default 'main' check (id = 'main'),
  hero_kicker text not null default 'UVSA 101',
  hero_title text not null default 'SoCal VSA',
  hero_emphasis text not null default 'Network',
  hero_description text not null default '13 schools. One community. VSA at UCSD is part of the larger UVSA SoCal network of students across Southern California.',
  intro_heading text not null default 'Externals',
  intro_body text not null default 'Externals are events hosted by other VSAs where UCSD members can attend, support, compete, and meet people from other schools. Externals can look like pageants, game shows, talent competitions, showcases, or performance nights, but they are also a way for schools to support each other''s philanthropy projects and cultural programming.',
  intro_note text not null default 'Many externals are also tied to philanthropy, culture, or community causes. Some feel like big competitions or showcases, but they still help connect schools and support the values behind UVSA.',
  stat_school_count_label text not null default '13 Schools',
  stat_competitions_label text not null default 'Competitions',
  stat_community_label text not null default 'VSA Community',
  upcoming_heading text not null default 'Upcoming Externals',
  showcase_heading text not null default '2025-2026 External Showcase',
  showcase_description text not null default 'A look at the externals from the previous year. UCSD''s Wild N'' Culture is listed first as our home-hosted event. Many externals also connect to philanthropy and cultural programming at the hosting school.',
  schools_heading text not null default 'Explore the 13 Schools',
  empty_state_title text not null default 'Upcoming externals will be added once they are confirmed by VSA at UCSD and the host schools.',
  empty_state_message text not null default 'Check back soon for the upcoming season.',
  updated_at timestamp with time zone default now()
);

create trigger set_uvsa_network_page_settings_updated_at
  before update on public.uvsa_network_page_settings
  for each row execute function public.handle_updated_at();

alter table public.uvsa_network_page_settings enable row level security;

create policy "Public can read uvsa network page settings"
  on public.uvsa_network_page_settings for select
  using (true);

create policy "Admins can manage uvsa network page settings"
  on public.uvsa_network_page_settings for all
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

insert into public.uvsa_network_page_settings (id)
values ('main')
on conflict (id) do nothing;
