-- Grounded public knowledge for the VSA AI Assistant MVP.
-- The assistant reads only active public snippets and logs usage metadata only.

create table if not exists public.ai_knowledge_base (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text not null,
  source_type text not null check (source_type in ('manual','public_page','public_event','faq')),
  source_url text,
  is_public boolean not null default true,
  is_active boolean not null default true,
  priority integer not null default 0,
  tags text[] not null default '{}',
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector not null default ''::tsvector
);

create or replace function public.ai_knowledge_base_set_search_vector()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.search_vector =
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.category, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(new.tags, ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.content, '')), 'C');
  return new;
end;
$$;

drop trigger if exists set_ai_knowledge_base_search_vector on public.ai_knowledge_base;
create trigger set_ai_knowledge_base_search_vector
  before insert or update on public.ai_knowledge_base
  for each row
  execute function public.ai_knowledge_base_set_search_vector();

create index if not exists ai_knowledge_base_search_idx
  on public.ai_knowledge_base using gin(search_vector);

create index if not exists ai_knowledge_base_active_idx
  on public.ai_knowledge_base (is_active, is_public, priority desc);

create table if not exists public.ai_chat_usage_logs (
  id uuid primary key default gen_random_uuid(),
  session_id_hash text not null,
  ip_hash text,
  message_count integer not null default 1,
  blocked_reason text,
  matched_knowledge_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'
);

create index if not exists ai_chat_usage_logs_session_created_idx
  on public.ai_chat_usage_logs (session_id_hash, created_at desc);

create index if not exists ai_chat_usage_logs_ip_created_idx
  on public.ai_chat_usage_logs (ip_hash, created_at desc)
  where ip_hash is not null;

alter table public.ai_knowledge_base enable row level security;
alter table public.ai_chat_usage_logs enable row level security;

drop policy if exists "Public can read active AI knowledge" on public.ai_knowledge_base;
create policy "Public can read active AI knowledge"
  on public.ai_knowledge_base
  for select
  using (is_public = true and is_active = true);

drop policy if exists "Admins can manage AI knowledge" on public.ai_knowledge_base;
create policy "Admins can manage AI knowledge"
  on public.ai_knowledge_base
  for all
  using (
    exists (
      select 1
      from public.user_profiles
      where user_profiles.id = auth.uid()
        and user_profiles.is_admin = true
    )
  )
  with check (
    exists (
      select 1
      from public.user_profiles
      where user_profiles.id = auth.uid()
        and user_profiles.is_admin = true
    )
  );

-- No public policies for usage logs. Inserts happen through the Edge Function
-- with the service role and store metadata, not raw chat text.

create or replace function public.match_ai_knowledge_base(
  query_text text,
  match_limit integer default 6
)
returns table (
  id uuid,
  title text,
  content text,
  category text,
  source_type text,
  source_url text,
  rank real
)
language sql
stable
security definer
set search_path = public
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  )
  select
    kb.id,
    kb.title,
    kb.content,
    kb.category,
    kb.source_type,
    kb.source_url,
    ts_rank_cd(kb.search_vector, query.tsq) + (kb.priority::real * 0.02) as rank
  from public.ai_knowledge_base kb, query
  where kb.is_public = true
    and kb.is_active = true
    and (
      query.tsq @@ kb.search_vector
      or kb.title ilike '%' || coalesce(query_text, '') || '%'
      or kb.category ilike '%' || coalesce(query_text, '') || '%'
    )
  order by rank desc, kb.priority desc, kb.updated_at desc
  limit greatest(1, least(match_limit, 6));
$$;

revoke all on function public.match_ai_knowledge_base(text, integer) from public;
grant execute on function public.match_ai_knowledge_base(text, integer) to anon, authenticated, service_role;

insert into public.ai_knowledge_base
  (title, content, category, source_type, source_url, priority, tags, last_verified_at)
values
  (
    'What is VSA at UCSD?',
    'VSA at UCSD is a Vietnamese cultural and social community at UC San Diego, established in 1977. The organization promotes community, culture, social connection, and academic support. VSA is nonprofit and open to all UCSD students.',
    'general',
    'public_page',
    '/',
    100,
    array['vsa', 'mission', 'ucsd', 'join'],
    now()
  ),
  (
    'How to join or get involved',
    'Students can get involved by attending events, using the Get Involved page, checking the new member checklist, joining programs, and following official VSA channels for updates. There is no single right way to be in VSA. Members can explore events, mentorship, houses, leadership, performances, and traditions at their own pace.',
    'get_involved',
    'public_page',
    '/get-involved',
    95,
    array['join', 'get involved', 'new member', 'events'],
    now()
  ),
  (
    'Points basics',
    'VSA members earn leaderboard points by attending eligible VSA events and activities. Points are shown on the leaderboard and can help members and houses track participation. Event point values may vary by event and should be checked on current event information when available.',
    'points',
    'faq',
    '/leaderboard',
    90,
    array['points', 'leaderboard', 'earn points', 'events'],
    now()
  ),
  (
    'Current points policy',
    'The public site describes events and externals as ways to earn points. Public event listings may show point values when points are available. The assistant should not invent point values for events that do not have a public point value in the approved context.',
    'points',
    'manual',
    '/events',
    85,
    array['points policy', 'event points', 'leaderboard'],
    now()
  ),
  (
    'Cabinet and intern required duties do not count for leaderboard points',
    'Cabinet and interns do not earn leaderboard points for required work duties, including staffing, shifts, or responsibilities that are part of their role. This policy is stated on the public UVSA Network points explainer for externals.',
    'points',
    'public_page',
    '/uvsa-network',
    86,
    array['cabinet', 'interns', 'duties', 'points'],
    now()
  ),
  (
    'House System basics',
    'The House Program is a year-long community experience within VSA. Members are placed into one of four houses and participate in socials, bonding activities, and VSA events to earn points and build friendships. At the end of the year, the house with the most points wins.',
    'house',
    'public_page',
    '/house-system',
    90,
    array['house', 'houses', 'competition', 'points'],
    now()
  ),
  (
    'Find My Points',
    'Members can use the public Find My Points area on the leaderboard page to check their points. If points look incorrect, members should use the feedback or points correction route provided by VSA rather than sharing private attendance details in chat.',
    'points',
    'public_page',
    '/leaderboard',
    84,
    array['find my points', 'points correction', 'leaderboard'],
    now()
  ),
  (
    'ACE basics',
    'Anh Chi Em, also called ACE, is VSA''s mentorship program. It helps members meet future bigs, build bonds, and become part of a lineage with bigs, pseudos, siblings, and grands.',
    'ace',
    'public_page',
    '/ace',
    78,
    array['ace', 'anh chi em', 'mentorship', 'bigs'],
    now()
  ),
  (
    'Intern Program basics',
    'The Intern Program is a leadership opportunity where students shadow cabinet, build leadership experience, and learn what it takes to help run VSA from the inside.',
    'intern_program',
    'public_page',
    '/intern-program',
    78,
    array['intern', 'internship', 'leadership', 'cabinet'],
    now()
  ),
  (
    'VCN basics',
    'Vietnamese Culture Night, or VCN, is UCSD VSA''s large annual cultural production. It celebrates Vietnamese culture through storytelling, dance, theatre, and performance. VCN is student-led, with opportunities on stage and behind the scenes.',
    'vcn',
    'public_page',
    '/vcn',
    82,
    array['vcn', 'vietnamese culture night', 'performance', 'show'],
    now()
  ),
  (
    'WNC basics',
    'Wild N'' Culture, or WNC, is UCSD VSA''s annual intercollegiate comedy competition. It brings together Vietnamese Student Associations and Asian American student groups from across Southern California for live improv-style games, roast battles, and crowd energy. WNC is typically open to everyone.',
    'wnc',
    'public_page',
    '/wild-n-culture',
    82,
    array['wnc', 'wild n culture', 'comedy', 'competition'],
    now()
  ),
  (
    'SoCal VSA Network and externals',
    'VSA at UCSD is part of the larger UVSA SoCal network of 13 schools across Southern California. Externals are events hosted by other VSAs where UCSD members can attend, support, compete, and meet people from other schools.',
    'uvsa_network',
    'public_page',
    '/uvsa-network',
    86,
    array['uvsa', 'externals', 'network', 'other schools'],
    now()
  ),
  (
    'How to attend externals',
    'To attend an external, find an external you want to attend, check the host school''s Linktree or Instagram for RSVP or tickets, look for a UCSD VSA ride form when VSA coordinates attendance, show up respectfully, and follow the announced points proof or check-in process.',
    'uvsa_network',
    'public_page',
    '/uvsa-network',
    84,
    array['externals', 'rides', 'rsvp', 'tickets', 'linktree'],
    now()
  ),
  (
    'External points policy',
    'Attending any UVSA external earns 4 points on the UCSD VSA leaderboard by default. Wild N'' Culture earns 5 points because it is a major UCSD-hosted event. Points reward members for representing VSA at UCSD in the wider UVSA community.',
    'points',
    'public_page',
    '/uvsa-network',
    88,
    array['external points', 'externals', 'wnc', 'points'],
    now()
  ),
  (
    'Feedback and points correction',
    'For feedback, points corrections, or questions the assistant cannot answer, use the public Feedback page or official VSA channels. Do not submit private attendance records, member emails, budgets, check-in codes, or cabinet-only links through chat.',
    'contact',
    'faq',
    '/feedback',
    80,
    array['feedback', 'contact', 'points correction', 'help'],
    now()
  )
on conflict do nothing;
