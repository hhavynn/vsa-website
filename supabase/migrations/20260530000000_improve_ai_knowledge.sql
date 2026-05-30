-- Improve Ask VSA knowledge base.
-- Adds public-safe snippets from the VSA Drive knowledge pack audit:
--   organization purpose, Houses (current + legacy + corrections),
--   ACE detail, Intern Program, Cabinet, GBMs, Banquet/EOYB,
--   VCN, WNC, UVSA background, website navigation.
-- All content is public-safe. No private rosters, emails, Drive links,
-- check-in logs, payment data, or member assignment data is included.

insert into public.ai_knowledge_base
  (title, content, category, source_type, source_url, priority, tags, last_verified_at)
values

  -- =====================================================================
  -- ORGANIZATION
  -- =====================================================================
  (
    'VSA at UCSD — official purpose and name',
    'The full formal name is Vietnamese Student Association at UC San Diego. For casual member-facing use, the preferred short form is VSA at UCSD. The organization promotes and preserves Vietnamese culture through social, cultural, community, and educational activities. It is a student nonprofit open to anyone interested in community, culture, friendship, and learning — members do not need to be Vietnamese. VSA has existed at UCSD since 1977.',
    'general',
    'manual',
    '/',
    100,
    array['vsa', 'mission', 'purpose', 'ucsd', 'official name', 'nonprofit', 'vietnamese'],
    now()
  ),

  (
    'What does VSA do? Events and programs overview',
    'VSA at UCSD hosts a wide range of events and programs throughout the year: GBMs (General Body Meetings), socials, cultural events, fundraisers, retreats, House events, ACE family events, Vietnamese Culture Night (VCN), Wild N'' Culture (WNC), externals with other schools, and the End of Year Banquet. There is no single right way to be in VSA — members can explore at their own pace.',
    'general',
    'manual',
    '/events',
    95,
    array['events', 'programs', 'vsa', 'gbm', 'social', 'cultural', 'vcn', 'wnc', 'house', 'ace', 'banquet'],
    now()
  ),

  (
    'What is a GBM?',
    'A GBM is a General Body Meeting — one of the recurring member-facing events where VSA members gather for activities, announcements, community bonding, and themed programming. GBMs are one of the best ways for new members to meet people and see what VSA is doing. They are beginner-friendly and open to everyone.',
    'events',
    'manual',
    '/events',
    85,
    array['gbm', 'general body meeting', 'events', 'new member', 'beginner'],
    now()
  ),

  -- =====================================================================
  -- HOUSES — CURRENT
  -- =====================================================================
  (
    'Current Houses — 2025–2026 (Super Mario theme)',
    'For the 2025–2026 academic year, VSA at UCSD has four Houses following a Super Mario theme: Bowser, Donkey Kong, Boo, and Toad. Each House has two House Parents and its own events and community. Bowser House won the 2025–2026 House competition with 247 points. Final standings: Bowser 247, Donkey Kong 215, Toad 158, Boo 125.',
    'house',
    'manual',
    '/house',
    100,
    array['houses', 'current houses', '2025-2026', 'bowser', 'donkey kong', 'boo', 'toad', 'mario', 'winner'],
    now()
  ),

  (
    'How the House system works',
    'Houses are smaller communities inside VSA where members can meet people, attend close-knit events, and compete for House points throughout the year. The House system uses 4 Houses with two House Parents each. Themes change every year — past eras include superheroes, designer/streetwear, mythical creatures, Pokémon, drinks, Sanrio, and Super Mario. At the end of the year, the House with the most points wins.',
    'house',
    'manual',
    '/house',
    92,
    array['house', 'house system', 'how houses work', 'house parents', 'points', 'theme'],
    now()
  ),

  (
    'House vs ACE — different programs',
    'House and ACE are two separate programs. House gives members a year-long team that competes for points. ACE (Anh Chi Em) is VSA''s Big/Little family and mentorship system. You can be in one, both, or neither depending on what sign-ups are open. They run independently of each other.',
    'house',
    'manual',
    '/house',
    88,
    array['house vs ace', 'house', 'ace', 'difference', 'separate', 'programs'],
    now()
  ),

  (
    'How to find your House assignment',
    'House assignments are handled through the House sign-up or sorting process each year. If you need to look up which House you are in, use the website''s House lookup feature if available, or reach out to the current House/CRC team through official VSA channels. The assistant cannot look up or guess individual House assignments.',
    'house',
    'manual',
    '/house',
    80,
    array['house assignment', 'my house', 'which house', 'house lookup'],
    now()
  ),

  -- =====================================================================
  -- HOUSES — LEGACY ARCHIVE
  -- =====================================================================
  (
    'Legacy House history — all years',
    'VSA at UCSD has had a House system going back to at least 2018–2019. Each year uses a new theme. Known eras: 2018–2019: Flash, Iron, Loki, Light (Superhero era). 2019–2020: Gucci, CDG/Comme des Garçons, Supreme, YSL/Yves Saint Laurent (Designer/Streetwear era). 2020–2021: no confirmed public House archive found. 2021–2022: Phoenix, Unicorn, Dragon, Tortoise (Four Holy Beasts era — some records say Turtle instead of Tortoise). 2022–2023: Squirtle, Pikachu, Bulbasaur, Charmander (Pokémon era). 2023–2024: Ca Phe Sua Da, Banana Milk, Matcha, Yakult (Drink era). 2024–2025: Badtz-maru, Keroppi, Kuromi (Sanrio era — a rare three-House year). 2025–2026: Bowser, Donkey Kong, Boo, Toad (Super Mario era).',
    'house',
    'manual',
    '/house',
    90,
    array['legacy houses', 'house history', 'past houses', 'house archive', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', 'superhero', 'designer', 'pokemon', 'sanrio', 'mario'],
    now()
  ),

  (
    'House correction — Designer Houses belong to 2019–2020, not 2023–2024',
    'IMPORTANT CORRECTION: The designer/streetwear Houses — Gucci, CDG (Comme des Garçons), Supreme, and YSL (Yves Saint Laurent) — belong to the 2019–2020 academic year. They are NOT the 2023–2024 Houses. The 2023–2024 Houses were Ca Phe Sua Da, Banana Milk, Matcha, and Yakult (Drink era).',
    'house',
    'manual',
    '/house',
    95,
    array['house correction', 'gucci', 'cdg', 'supreme', 'ysl', '2019-2020', '2023-2024', 'designer houses', 'ca phe sua da', 'banana milk', 'matcha', 'yakult'],
    now()
  ),

  (
    '2020–2021 House year — unconfirmed archive',
    'No confirmed public House archive has been found for the 2020–2021 academic year. This year likely overlapped with remote/pandemic conditions, which may explain the gap. The archive is kept as unconfirmed until more records are found. Alumni who remember that year are encouraged to help VSA fill in the history.',
    'house',
    'manual',
    '/house',
    82,
    array['2020-2021', 'house', 'unconfirmed', 'archive gap', 'pandemic', 'covid'],
    now()
  ),

  (
    '2026–2027 Houses — not yet announced',
    'The 2026–2027 Houses have not been confirmed or announced yet. VSA reveals the new House theme each year at the start of the academic cycle, usually in Fall. Check VSA''s official Instagram, Linktree, or website when the new year begins for the announcement.',
    'house',
    'manual',
    '/house',
    88,
    array['2026-2027', 'next year houses', 'future houses', 'upcoming houses', 'not announced'],
    now()
  ),

  (
    '2024–2025 Houses — Sanrio era',
    'The 2024–2025 academic year used a Sanrio theme with three Houses: Badtz-maru, Keroppi, and Kuromi. This was an unusual three-House year instead of the usual four.',
    'house',
    'manual',
    '/house',
    85,
    array['2024-2025', 'sanrio', 'badtz-maru', 'keroppi', 'kuromi', 'three houses'],
    now()
  ),

  (
    '2023–2024 Houses — Drink era',
    'The 2023–2024 academic year used a drink/beverage theme with four Houses: Ca Phe Sua Da, Banana Milk, Matcha, and Yakult. Matcha members had the nickname "Matcha munchkins." Note: some old files may have incorrect designer House names attached to this year — those designer Houses actually belong to 2019–2020.',
    'house',
    'manual',
    '/house',
    85,
    array['2023-2024', 'drink era', 'ca phe sua da', 'banana milk', 'matcha', 'yakult', 'beverage'],
    now()
  ),

  (
    '2022–2023 Houses — Pokémon era',
    'The 2022–2023 academic year used a Pokémon starter theme with four Houses: Squirtle, Pikachu, Bulbasaur, and Charmander.',
    'house',
    'manual',
    '/house',
    83,
    array['2022-2023', 'pokemon', 'squirtle', 'pikachu', 'bulbasaur', 'charmander'],
    now()
  ),

  (
    '2021–2022 Houses — Four Holy Beasts era',
    'The 2021–2022 academic year used a mythical creatures / Four Holy Beasts theme with four Houses: Phoenix, Unicorn, Dragon, and Tortoise. Some older records may say Turtle instead of Tortoise.',
    'house',
    'manual',
    '/house',
    83,
    array['2021-2022', 'mythical', 'phoenix', 'unicorn', 'dragon', 'tortoise', 'turtle', 'four holy beasts'],
    now()
  ),

  (
    '2019–2020 Houses — Designer/Streetwear era',
    'The 2019–2020 academic year used a designer/streetwear theme with four Houses: Gucci, CDG (Comme des Garçons), Supreme, and YSL (Yves Saint Laurent). Gucci won House Spirit Week 2020 with 414 points.',
    'house',
    'manual',
    '/house',
    83,
    array['2019-2020', 'designer', 'streetwear', 'gucci', 'cdg', 'comme des garcons', 'supreme', 'ysl', 'yves saint laurent'],
    now()
  ),

  (
    '2018–2019 Houses — Superhero era',
    'The 2018–2019 academic year is the earliest confirmed House era. It used a superheroes/comic characters theme with four Houses: Flash, Iron, Loki, and Light.',
    'house',
    'manual',
    '/house',
    83,
    array['2018-2019', 'superhero', 'flash', 'iron', 'loki', 'light', 'earliest', 'first houses'],
    now()
  ),

  -- =====================================================================
  -- ACE
  -- =====================================================================
  (
    'ACE — Anh Chi Em Big/Little family system (detailed)',
    'ACE stands for Anh Chi Em, which means older sibling / younger sibling in Vietnamese. ACE is VSA''s Big/Little family and mentorship system. It connects members with similar interests, career goals, backgrounds, and personalities to build mentorships, working relationships, and friendships. ACE families grow over time into lineages with Bigs, Littles, Pseudos, Siblings, and Grands. ACE is separate from House — you can be in both, one, or neither. ACE is for mentorship and friendship, not romantic connections. To join, watch for ACE application forms on VSA''s Instagram or Linktree when they open each cycle.',
    'ace',
    'manual',
    '/get-involved',
    88,
    array['ace', 'anh chi em', 'big little', 'mentorship', 'family', 'lineage', 'bigs', 'littles', 'pseudo', 'siblings'],
    now()
  ),

  -- =====================================================================
  -- INTERN PROGRAM
  -- =====================================================================
  (
    'Intern Program — leadership pathway into cabinet',
    'The Intern Program is a leadership development pathway for members who want to learn how VSA works from the inside. Interns support cabinet, help with events and programs, and build skills across the end of Fall and through Winter and Spring quarters. The program covers VSA''s pillars: social involvement, cultural programming, leadership/professional development, and organizational operations. It is typically for members who are interested in eventually joining cabinet. Application timing changes each year — watch VSA''s Instagram or Linktree for when applications open.',
    'intern_program',
    'manual',
    '/get-involved',
    88,
    array['intern program', 'internship', 'leadership', 'cabinet', 'fall', 'winter', 'spring', 'apply', 'pillars'],
    now()
  ),

  -- =====================================================================
  -- CABINET
  -- =====================================================================
  (
    'Cabinet — what it is and how to get involved',
    'Cabinet is the student leadership team that plans events, runs programs, manages communications, oversees culture shows, handles finances, and makes VSA run. Cabinet roles include positions like President, Internal Vice President, ICC/External VP, Secretary, Treasurer, Events Chair, Cultural/Philanthropy Chair, Media Chair, PR Chair, Historian, ACE Chair, CRC Chair, VCN Chair, and others depending on the year. The typical path into cabinet: attend events → join programs like House/ACE → consider the Intern Program → apply when cabinet applications or elections are announced.',
    'cabinet',
    'manual',
    '/cabinet',
    88,
    array['cabinet', 'leadership', 'roles', 'president', 'officer', 'join cabinet', 'intern program', 'apply'],
    now()
  ),

  -- =====================================================================
  -- BANQUET / EOYB
  -- =====================================================================
  (
    'End of Year Banquet (EOYB) — traditions and program',
    'The End of Year Banquet, also called EOYB, is VSA''s year-closing celebration. The program typically includes: opening remarks, a recap video of the year, House winner announcement (with final standings), senior sendoff, superlatives, Member of the Year award, new cabinet introduction, closing remarks, and the VSA chant. Banquet is one of VSA''s most significant annual traditions. For current year ticket info and date, check VSA''s Instagram or Linktree.',
    'banquet',
    'manual',
    '/events',
    85,
    array['banquet', 'eoyb', 'end of year', 'house winner', 'senior sendoff', 'superlatives', 'member of the year', 'traditions', 'closing'],
    now()
  ),

  -- =====================================================================
  -- VCN / WNC (supplements existing snippets)
  -- =====================================================================
  (
    'VCN — Vietnamese Culture Night full name and description',
    'VCN stands for Vietnamese Culture Night, also known by its Vietnamese name Đêm Văn Hóa Việt Nam. It is VSA at UCSD''s largest annual student-run cultural event, celebrating Vietnamese heritage and stories through modern and traditional dances and a play. VCN is student-led with opportunities to participate on stage (dance teams, acting) and behind the scenes (tech, volunteering). Audition and sign-up info changes each cycle — check VSA''s Instagram or Linktree for the current year.',
    'vcn',
    'manual',
    '/get-involved',
    85,
    array['vcn', 'vietnamese culture night', 'dem van hoa viet nam', 'dance', 'performance', 'cultural show', 'audition'],
    now()
  ),

  (
    'WNC — Wild N'' Culture description',
    'WNC stands for Wild N'' Culture. It is a VSA at UCSD event modeled on Wild N'' Out — an improv-style comedy competition that incorporates Vietnamese culture and humor. WNC is typically open to audience members and sometimes involves performers or participants from multiple schools. It is a high-energy crowd event. WNC earns 5 points on the VSA leaderboard because it is a major UCSD-hosted event.',
    'wnc',
    'manual',
    '/get-involved',
    82,
    array['wnc', 'wild n culture', 'wild n out', 'comedy', 'improv', 'humor', 'vietnamese', 'competition'],
    now()
  ),

  -- =====================================================================
  -- UVSA / EXTERNALS
  -- =====================================================================
  (
    'UVSA SoCal — history and mission',
    'UVSA SoCal is the Union of Vietnamese Student Associations of Southern California. It is a 501(c)(3) nonprofit organization founded in 1982 that serves 13 Vietnamese Student Associations across Southern California through collaborative programming, mentorship, and cultural initiatives. VSA at UCSD is one of the 13 member schools.',
    'uvsa_network',
    'public_page',
    '/uvsa-network',
    88,
    array['uvsa', 'uvsa socal', 'union', 'nonprofit', '1982', '13 schools', 'southern california', 'network'],
    now()
  ),

  -- =====================================================================
  -- WEBSITE NAVIGATION
  -- =====================================================================
  (
    'VSA website navigation — where to find things',
    'The VSA at UCSD website has several member-facing sections: /events — upcoming and past events with dates, locations, and points. /leaderboard — member and House points standings. /house — current Houses, House standings, and House events. /gallery — photos and event recaps. /cabinet — current board members and roles. /uvsa-network — UVSA SoCal externals information. The website also has a Get Involved section covering House, ACE, VCN, Intern Program, and other programs.',
    'website',
    'manual',
    '/',
    85,
    array['website', 'navigation', 'where to find', 'events page', 'leaderboard', 'house page', 'gallery', 'cabinet', 'uvsa network', 'get involved'],
    now()
  ),

  -- =====================================================================
  -- POINTS CORRECTION GUIDANCE
  -- =====================================================================
  (
    'Points correction — what to do if points are missing',
    'If your leaderboard points look wrong or seem to be missing after an event, reach out through the current VSA contact channel (check Instagram, Linktree, or the website Feedback page) with your name, the event name, and what you think is missing. The public Ask VSA assistant cannot view private check-in logs, attendance records, or individual point histories. Only cabinet/admin can investigate and correct points.',
    'points',
    'faq',
    '/leaderboard',
    88,
    array['points correction', 'missing points', 'wrong points', 'fix points', 'contact admin', 'feedback'],
    now()
  )

on conflict do nothing;
