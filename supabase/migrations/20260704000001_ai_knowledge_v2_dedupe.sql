-- Ask VSA knowledge base v2 dedupe.
-- Multiple entries were competing to answer the same intents. Keep one
-- canonical entry per topic, fold in anything unique from the duplicate,
-- give the canonical entry a rich alias bank, then deactivate the duplicate.
-- Duplicates are deactivated (not deleted) so admins can review the history.

-- ==========================================================================
-- VCN: keep the detailed entry, retire 'VCN basics'
-- ==========================================================================
update public.ai_knowledge_base
set
  title = 'VCN — Vietnamese Culture Night',
  content = 'VCN stands for Vietnamese Culture Night, also known by its Vietnamese name Đêm Văn Hóa Việt Nam. It is VSA at UCSD''s largest annual student-run cultural production, celebrating Vietnamese heritage, identity, family, and community through storytelling, a dramatic play, modern and traditional dance, and technical/creative production. VCN is student-led with opportunities on stage (acting, dance) and behind the scenes (tech, production, media, volunteering). Audition and sign-up info changes each cycle — check VSA''s Instagram or Linktree for the current year.',
  aliases = array['vcn', 'culture night', 'vietnamese culture night', 'dem van hoa', 'culture show', 'vcn show', 'vcn play', 'vcn dance'],
  freshness = 'stable',
  confidence = 'high'
where title = 'VCN — Vietnamese Culture Night full name and description';

update public.ai_knowledge_base
set is_active = false
where title = 'VCN basics';

-- ==========================================================================
-- WNC: keep the detailed entry, retire 'WNC basics'
-- ==========================================================================
update public.ai_knowledge_base
set
  title = 'WNC — Wild N'' Culture',
  content = 'WNC stands for Wild N'' Culture. It is VSA at UCSD''s annual high-energy intercollegiate comedy competition modeled on Wild N'' Out — live improv-style games, roast battles, team competition, and crowd participation, incorporating Vietnamese and Asian American cultural humor. It brings together VSAs and Asian American student groups from across Southern California and is typically open to everyone. WNC earns 5 points on the VSA leaderboard because it is a major UCSD-hosted event.',
  aliases = array['wnc', 'wild n culture', 'wild and culture', 'wild n out', 'comedy competition', 'comedy show'],
  freshness = 'stable',
  confidence = 'high'
where title = 'WNC — Wild N'' Culture description';

update public.ai_knowledge_base
set is_active = false
where title = 'WNC basics';

-- ==========================================================================
-- Points: keep one canonical general policy, retire 'Current points policy'
-- (live event listings carry event-specific values separately)
-- ==========================================================================
update public.ai_knowledge_base
set
  title = 'Points — general policy',
  content = 'VSA members earn leaderboard points by attending eligible VSA events and activities. Points appear on the leaderboard and help members and Houses track participation. Event point values vary: when a public event listing shows a point value, that live value is the correct one and overrides any typical or historical value. The assistant should never invent point values for events without a public point value in the approved context.',
  aliases = array['points', 'leaderboard', 'earn points', 'how many points', 'point value', 'point system'],
  freshness = 'stable',
  confidence = 'high'
where title = 'Points basics';

update public.ai_knowledge_base
set is_active = false
where title = 'Current points policy';

-- ==========================================================================
-- House system: keep 'How the House system works', retire 'House System basics'
-- ==========================================================================
update public.ai_knowledge_base
set
  content = 'Houses are smaller year-long communities inside VSA where members meet people, attend close-knit events, and compete for House points. The modern system uses four Houses with two House Parents each (2024–2025 was a rare three-House year). Themes change every year — past eras include superheroes, designer/streetwear, mythical creatures, Pokémon, drinks, Sanrio, and Super Mario. At the end of the year, the House with the most points wins. House is a VSA community/team system, not a fraternity or sorority.',
  aliases = array['house', 'houses', 'house system', 'what house am i', 'my team', 'house parents', 'hp', 'house points', 'house winner', 'join house'],
  freshness = 'stable',
  confidence = 'high'
where title = 'How the House system works';

update public.ai_knowledge_base
set is_active = false
where title = 'House System basics';

-- ==========================================================================
-- ACE: keep the detailed entry, retire 'ACE basics'
-- ==========================================================================
update public.ai_knowledge_base
set
  title = 'ACE — Anh Chi Em Big/Little family system',
  aliases = array['ace', 'anh chi em', 'big little', 'big/little', 'fam', 'family', 'vsa family', 'mentor', 'mentorship', 'big', 'little', 'pseudo', 'grand', 'pickup', 'pick up', 'ace reveal', 'family reveal', 'how do i get a big', 'how do i get a little'],
  freshness = 'stable',
  confidence = 'high'
where title = 'ACE — Anh Chi Em Big/Little family system (detailed)';

update public.ai_knowledge_base
set is_active = false
where title = 'ACE basics';

-- ==========================================================================
-- Intern Program: keep the detailed entry, retire 'Intern Program basics'
-- ==========================================================================
update public.ai_knowledge_base
set
  aliases = array['intern', 'interns', 'intern program', 'internship', 'leadership program', 'shadow cabinet'],
  freshness = 'yearly',
  confidence = 'high'
where title = 'Intern Program — leadership pathway into cabinet';

update public.ai_knowledge_base
set is_active = false
where title = 'Intern Program basics';

-- ==========================================================================
-- UVSA: keep 'UVSA SoCal — history and mission' with externals folded in,
-- retire 'SoCal VSA Network and externals'
-- ==========================================================================
update public.ai_knowledge_base
set
  content = 'UVSA SoCal is the Union of Vietnamese Student Associations of Southern California — a 501(c)(3) nonprofit founded in 1982 that serves 13 Vietnamese Student Associations across Southern California through collaborative programming, mentorship, and cultural initiatives. VSA at UCSD is one of the 13 member schools but is not the same organization as UVSA. Externals are events hosted by other VSAs or the network where UCSD members can attend, support, compete, and meet people from other schools.',
  aliases = array['uvsa', 'uvsa socal', 'union of vietnamese student associations', 'network', 'externals', 'other schools', 'socal vsa'],
  freshness = 'stable',
  confidence = 'high'
where title = 'UVSA SoCal — history and mission';

update public.ai_knowledge_base
set is_active = false
where title = 'SoCal VSA Network and externals';

-- ==========================================================================
-- Alias banks for other existing canonical entries
-- ==========================================================================
update public.ai_knowledge_base
set aliases = array['cab', 'cabinet', 'board', 'eboard', 'e-board', 'officer', 'officers', 'leadership', 'chair', 'exec', 'join cabinet']
where title = 'Cabinet — what it is and how to get involved';

update public.ai_knowledge_base
set
  aliases = array['banquet', 'eoyb', 'end of year banquet', 'end of the year banquet', 'year end banquet'],
  freshness = 'stable'
where title = 'End of Year Banquet (EOYB) — traditions and program';

update public.ai_knowledge_base
set
  aliases = array['current houses', 'this year houses', 'mario houses', 'bowser', 'donkey kong', 'boo', 'toad', 'who won house'],
  freshness = 'yearly',
  academic_year = '2025-2026'
where title = 'Current Houses — 2025–2026 (Super Mario theme)';

update public.ai_knowledge_base
set
  aliases = array['old houses', 'past houses', 'house history', 'house eras', 'legacy houses', 'house archive'],
  source_type = 'historical_archive'
where title = 'Legacy House history — all years';

update public.ai_knowledge_base
set academic_year = '2024-2025', source_type = 'historical_archive'
where title = '2024–2025 Houses — Sanrio era';

update public.ai_knowledge_base
set academic_year = '2023-2024', source_type = 'historical_archive'
where title = '2023–2024 Houses — Drink era';

update public.ai_knowledge_base
set academic_year = '2022-2023', source_type = 'historical_archive'
where title = '2022–2023 Houses — Pokémon era';

update public.ai_knowledge_base
set academic_year = '2021-2022', source_type = 'historical_archive'
where title = '2021–2022 Houses — Four Holy Beasts era';

update public.ai_knowledge_base
set academic_year = '2019-2020', source_type = 'historical_archive'
where title = '2019–2020 Houses — Designer/Streetwear era';

update public.ai_knowledge_base
set academic_year = '2018-2019', source_type = 'historical_archive'
where title = '2018–2019 Houses — Superhero era';

update public.ai_knowledge_base
set academic_year = '2020-2021', source_type = 'historical_archive', confidence = 'low'
where title = '2020–2021 House year — unconfirmed archive';

update public.ai_knowledge_base
set
  aliases = array['who is president', 'co presidents', 'current cabinet', 'current board', 'president'],
  freshness = 'yearly'
where title = 'Current Cabinet and Co-Presidents';
