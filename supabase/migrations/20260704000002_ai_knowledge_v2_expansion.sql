-- Ask VSA knowledge map v2 expansion bank.
-- Adds: glossary/slang, new-member onboarding, event help, points edge cases,
-- House detail, ACE detail, cabinet role explorer, Intern Program detail,
-- VCN/WNC/banquet archive, UVSA/externals, website self-service, VSA history,
-- culture/education, recommendation intents, and trust/uncertainty answers.
-- Pure assistant behavior rules live in the Edge Function system prompt, not here.
-- All content is public-safe: no rosters, pairings, payment data, private venues,
-- application responses, or Drive links.

insert into public.ai_knowledge_base
  (title, content, category, source_type, source_url, priority, tags, aliases, confidence, freshness, academic_year, last_verified_at)
select v.title, v.content, v.category, v.source_type, v.source_url, v.priority, v.tags, v.aliases, v.confidence, v.freshness, v.academic_year, now()
from (
  values

  -- =====================================================================
  -- B. GLOSSARY / VSA VOCABULARY AND SLANG
  -- =====================================================================
  (
    'What does gen mem mean?',
    '"Gen mem" means general member — someone participating in VSA without necessarily serving on Cabinet. Anyone can be a general member just by showing up to events.',
    'glossary', 'manual', null::text, 96,
    array['glossary', 'slang', 'general member']::text[],
    array['gen mem', 'general member', 'genmem']::text[],
    'high', 'stable', null::text
  ),
  (
    'What does ICC mean?',
    'ICC refers to Intercollegiate Council. VSA at UCSD''s ICC representatives help connect UCSD VSA with UVSA and other VSAs and coordinate external participation. In recent role structures, ICC and External Vice President responsibilities are combined as ICC/EVP.',
    'glossary', 'manual', null, 96,
    array['glossary', 'icc', 'intercollegiate council', 'externals'],
    array['icc', 'intercollegiate council'],
    'high', 'stable', null
  ),
  (
    'What does EVP mean?',
    'EVP means External Vice President. In recent VSA at UCSD role structures, ICC and EVP responsibilities are combined as Intercollegiate Council / External Vice President — the officer who connects UCSD VSA with UVSA and other schools.',
    'glossary', 'manual', null, 96,
    array['glossary', 'evp', 'external vice president'],
    array['evp', 'external vice president', 'external vp'],
    'high', 'stable', null
  ),
  (
    'What does IVP mean?',
    'IVP means Internal Vice President. The IVP focuses on internal cabinet health, leadership development, the Intern Program, and supporting internal operations.',
    'glossary', 'manual', null, 96,
    array['glossary', 'ivp', 'internal vice president'],
    array['ivp', 'internal vice president', 'internal vp'],
    'high', 'stable', null
  ),
  (
    'What does CRC mean?',
    'CRC means Community Relations Chair. The role is closely connected to the House system, House Parents, House Reveal, community service, and major House/community programs.',
    'glossary', 'manual', null, 96,
    array['glossary', 'crc', 'community relations chair', 'house'],
    array['crc', 'community relations chair', 'community relations'],
    'high', 'stable', null
  ),
  (
    'What does CPC mean?',
    'CPC means Cultural Philanthropy Chair. The role focuses on Vietnamese cultural programming, education, philanthropy, and community connections.',
    'glossary', 'manual', null, 96,
    array['glossary', 'cpc', 'cultural philanthropy chair', 'culture'],
    array['cpc', 'cultural philanthropy chair', 'cultural chair', 'philanthropy chair'],
    'high', 'stable', null
  ),
  (
    'What does HP mean in VSA?',
    'HP usually means House Parent — one of the student leaders guiding a House. Each House typically has two House Parents.',
    'glossary', 'manual', null, 96,
    array['glossary', 'hp', 'house parent', 'house'],
    array['hp', 'house parent', 'house parents'],
    'high', 'stable', null
  ),
  (
    'What is an aftersocial?',
    'An aftersocial is a social gathering after a VSA event such as a GBM. Details vary by event and year — check current announcements for whether one is planned.',
    'glossary', 'manual', null, 96,
    array['glossary', 'aftersocial', 'social', 'gbm'],
    array['aftersocial', 'after social', 'after-social'],
    'high', 'stable', null
  ),
  (
    'What is a rollout?',
    'In external-event context, a rollout usually means the organized public information and coordination for attending an external — RSVP details, rides, deadlines, and event expectations.',
    'glossary', 'manual', null, 94,
    array['glossary', 'rollout', 'externals'],
    array['rollout', 'roll out'],
    'high', 'stable', null
  ),
  (
    'What is a Big?',
    'In ACE, a Big is an older sibling or mentor figure who picks up one or more Littles through the program. Bigs guide, mentor, and befriend their Littles as part of an ACE family.',
    'glossary', 'manual', '/ace', 96,
    array['glossary', 'ace', 'big', 'mentorship'],
    array['big', 'bigs', 'what is a big'],
    'high', 'stable', null
  ),
  (
    'What is a Little?',
    'In ACE, a Little is a newer family member picked up by a Big. Littles get a mentor and become part of a larger ACE family lineage.',
    'glossary', 'manual', '/ace', 96,
    array['glossary', 'ace', 'little', 'mentorship'],
    array['little', 'littles', 'what is a little'],
    'high', 'stable', null
  ),
  (
    'What is a Pseudo?',
    'In ACE family terminology, a Pseudo is generally another Big-like family connection created through family structure rather than the primary direct Big/Little relationship. Exact family terminology can vary by lineage.',
    'glossary', 'manual', '/ace', 94,
    array['glossary', 'ace', 'pseudo', 'family'],
    array['pseudo', 'pseudos'],
    'medium', 'stable', null
  ),
  (
    'What is a Grand?',
    'In ACE lineage terminology, a Grand is generally the Big of your Big (grandbig) or the Little of your Little (grandlittle), depending on direction through the family tree.',
    'glossary', 'manual', '/ace', 94,
    array['glossary', 'ace', 'grand', 'lineage'],
    array['grand', 'grandbig', 'grandlittle', 'grand big', 'grand little'],
    'medium', 'stable', null
  ),
  (
    'What does spearhead mean?',
    'To spearhead an event means to take primary ownership of planning and leading it while coordinating with other cabinet members.',
    'glossary', 'manual', null, 94,
    array['glossary', 'spearhead', 'cabinet'],
    array['spearhead'],
    'high', 'stable', null
  ),
  (
    'What is an external?',
    'An external is an event hosted by another VSA, UVSA, or partner school organization that UCSD VSA members may attend or support. Externals are a way to meet students from other schools and represent VSA at UCSD in the wider SoCal community.',
    'glossary', 'manual', '/uvsa-network', 94,
    array['glossary', 'external', 'externals', 'uvsa'],
    array['external', 'externals', 'what is an external'],
    'high', 'stable', null
  ),

  -- =====================================================================
  -- C. NEW MEMBER ONBOARDING
  -- =====================================================================
  (
    'I am new to VSA. Where should I start?',
    'Start with an upcoming event or GBM, browse the Get Involved page, and explore programs like House and ACE when applications are open. There is no required order and you do not need to know anyone before attending.',
    'new_member', 'manual', '/get-involved', 98,
    array['new member', 'start', 'first event', 'onboarding'],
    array['i am new', 'im new', 'where do i start', 'how do i start', 'new to vsa', 'first time'],
    'high', 'stable', null
  ),
  (
    'I do not know anyone. Can I still come?',
    'Yes. Many people first attend VSA without already having a friend group. GBMs, Welcome Week events, House, ACE, and smaller socials are designed to help members meet people.',
    'new_member', 'manual', '/events', 98,
    array['new member', 'friends', 'alone', 'first event'],
    array['dont know anyone', 'no friends', 'come alone', 'by myself'],
    'high', 'stable', null
  ),
  (
    'Do I need to be Vietnamese to join VSA?',
    'No. VSA at UCSD welcomes people interested in Vietnamese culture, community, friendship, and learning. You do not need to be Vietnamese to participate.',
    'new_member', 'manual', '/', 98,
    array['new member', 'vietnamese', 'eligibility', 'join'],
    array['do i need to be vietnamese', 'not vietnamese', 'non vietnamese', 'am i allowed to join'],
    'high', 'stable', null
  ),
  (
    'Do I need to speak Vietnamese?',
    'No. Vietnamese-language ability is not required to participate in VSA events or programs.',
    'new_member', 'manual', '/', 97,
    array['new member', 'vietnamese language', 'speak'],
    array['speak vietnamese', 'dont speak vietnamese', 'language requirement'],
    'high', 'stable', null
  ),
  (
    'What is the easiest first event to attend?',
    'GBMs and general social events are usually strong starting points because they are designed for broad member participation. Check the current Events page for the next beginner-friendly option.',
    'new_member', 'manual', '/events', 97,
    array['new member', 'first event', 'gbm', 'beginner'],
    array['easiest event', 'first event', 'beginner event', 'which event first'],
    'high', 'stable', null
  ),
  (
    'I am shy. What should I join?',
    'Consider smaller or recurring communities such as House or ACE when applications are open. Smaller events and bonding programs can be easier than walking into only large events, and behind-the-scenes volunteering is another low-pressure option. Being introverted does not mean you cannot lead in VSA.',
    'new_member', 'manual', '/get-involved', 97,
    array['new member', 'shy', 'introvert', 'recommendations'],
    array['i am shy', 'im shy', 'introverted', 'social anxiety', 'quiet person'],
    'high', 'stable', null
  ),
  (
    'I want to make friends. What should I join?',
    'House and ACE are the most directly community-focused programs. House gives you a year-long team community; ACE gives you a Big/Little mentorship and family structure. You can also start with a GBM before committing to either.',
    'new_member', 'manual', '/get-involved', 96,
    array['new member', 'friends', 'community', 'recommendations'],
    array['make friends', 'meet people', 'find community', 'want friends'],
    'high', 'stable', null
  ),
  (
    'I want leadership experience. What should I do?',
    'Attend events consistently, learn how VSA''s programs work, consider the Intern Program when applications open, and explore Cabinet roles that match your strengths. House Parent positions are another leadership opportunity when they open.',
    'new_member', 'manual', '/get-involved', 96,
    array['new member', 'leadership', 'cabinet', 'intern'],
    array['leadership experience', 'become a leader', 'get into leadership'],
    'high', 'stable', null
  ),
  (
    'I want Vietnamese cultural involvement. What should I join?',
    'Look for cultural events, CPC programming, VCN opportunities, Tết-related activities, Black April programming, Mid-Autumn activities, and cultural GBMs.',
    'new_member', 'manual', '/events', 96,
    array['new member', 'culture', 'vietnamese', 'recommendations'],
    array['cultural involvement', 'learn about vietnamese culture', 'cultural events'],
    'high', 'stable', null
  ),
  (
    'I want to perform. What are my options?',
    'VCN may offer acting, modern dance, traditional dance, and other performance opportunities depending on the year. WNC may also have contestant or performance participation opportunities. Check current sign-up forms on VSA''s Instagram or Linktree.',
    'new_member', 'manual', '/get-involved', 96,
    array['new member', 'perform', 'vcn', 'wnc', 'dance', 'acting'],
    array['i want to perform', 'perform on stage', 'dance team', 'acting', 'audition'],
    'high', 'stable', null
  ),
  (
    'I want behind-the-scenes experience. What are my options?',
    'Consider VCN production, tech, media, PR/video, volunteering, event logistics, Historian work, or future Intern/Cabinet opportunities.',
    'new_member', 'manual', '/get-involved', 96,
    array['new member', 'behind the scenes', 'production', 'tech'],
    array['behind the scenes', 'backstage', 'production team', 'tech crew'],
    'high', 'stable', null
  ),
  (
    'Can I be involved without joining House or ACE?',
    'Yes. House and ACE are optional programs. You can attend events, participate in VCN/WNC, support externals, volunteer, join the Intern Program, or simply be a general member.',
    'new_member', 'manual', '/get-involved', 95,
    array['new member', 'house', 'ace', 'optional'],
    array['without house', 'without ace', 'just a member', 'casual member'],
    'high', 'stable', null
  ),
  (
    'I missed Fall quarter. Is it too late to join?',
    'Not necessarily. VSA runs events throughout the academic year, and some programs or opportunities may reopen later. Check current events and application windows on the website or VSA''s official channels.',
    'new_member', 'manual', '/events', 95,
    array['new member', 'late', 'fall', 'timing'],
    array['too late to join', 'missed fall', 'join late', 'mid year'],
    'high', 'stable', null
  ),
  (
    'I am busy. Can I still be involved in VSA?',
    'Yes. You can participate at your own pace as a general member. More structured programs such as the Intern Program or Cabinet require greater commitment, but general membership has no attendance requirement.',
    'new_member', 'manual', '/events', 95,
    array['new member', 'busy', 'time commitment'],
    array['too busy', 'time commitment', 'how much time'],
    'high', 'stable', null
  ),
  (
    'What should I do before applying for Cabinet?',
    'Attend events, understand the organization, learn what the role actually does, talk to current or former officers when appropriate, and be realistic about your time and strengths. The Intern Program is a useful (but not required) preparation pathway.',
    'new_member', 'manual', '/cabinet', 95,
    array['new member', 'cabinet', 'apply', 'preparation'],
    array['before applying cabinet', 'prepare for cabinet', 'ready for cabinet'],
    'high', 'stable', null
  ),

  -- =====================================================================
  -- D. EVENT HELP AND DECISION SUPPORT
  -- =====================================================================
  (
    'Do I need to RSVP for events?',
    'It depends on the event. Check the current event listing on the Events page. Some events are walk-in, while retreats, mixers, banquets, externals, and limited-capacity events may require RSVP or tickets.',
    'events', 'manual', '/events', 98,
    array['events', 'rsvp', 'tickets'],
    array['rsvp', 'do i need to rsvp', 'sign up for event', 'tickets'],
    'high', 'stable', null
  ),
  (
    'Is this event free?',
    'Check the live event listing on the Events page. Some VSA events are free and others have tickets or costs — the assistant should never assume an event is free or paid unless current public details confirm it.',
    'events', 'manual', '/events', 98,
    array['events', 'free', 'cost', 'price'],
    array['is it free', 'event cost', 'how much is', 'ticket price'],
    'high', 'stable', null
  ),
  (
    'Where is the event located?',
    'Use the current public event listing on the Events page for locations. Old locations from past years may be outdated, and some events use private or limited-access venues whose addresses are only shared through official current channels.',
    'events', 'manual', '/events', 97,
    array['events', 'location', 'where'],
    array['where is the event', 'event location', 'address'],
    'high', 'stable', null
  ),
  (
    'Can I come late to an event?',
    'Late-arrival rules depend on the event. If no current public rule is posted, arrival expectations are unclear — check the event listing or ask through official channels rather than assuming.',
    'events', 'manual', '/events', 97,
    array['events', 'late', 'arrival'],
    array['come late', 'arrive late', 'show up late'],
    'high', 'stable', null
  ),
  (
    'Can I leave an event early?',
    'It depends on the event, especially for point eligibility or structured programs like retreats. Follow current event instructions, and check the event listing for any check-in/check-out expectations.',
    'events', 'manual', '/events', 97,
    array['events', 'leave early', 'points'],
    array['leave early', 'dip early', 'partial attendance'],
    'high', 'stable', null
  ),
  (
    'What should I bring to an event?',
    'Use the event description on the Events page when available. Common needs such as ID, water, payment confirmation, or specific clothing are only requirements when publicly announced for that event — never assume unlisted requirements.',
    'events', 'manual', '/events', 97,
    array['events', 'bring', 'requirements'],
    array['what to bring', 'what should i bring', 'do i need to bring'],
    'high', 'stable', null
  ),
  (
    'Is this event beginner-friendly?',
    'Most general member events and GBMs are designed to welcome broad participation. For a specific event, check its current listing — retreats and structured programs may have sign-ups, while GBMs and socials are typically open to everyone.',
    'events', 'manual', '/events', 96,
    array['events', 'beginner', 'new member'],
    array['beginner friendly', 'first timers', 'newcomer friendly'],
    'high', 'stable', null
  ),
  (
    'Is this a VSA event or an external?',
    'A VSA event is organized by VSA at UCSD. An external is hosted by another VSA or network organization — UCSD members often attend externals together. The Events page and UVSA Network page distinguish the two.',
    'events', 'manual', '/uvsa-network', 96,
    array['events', 'external', 'uvsa'],
    array['vsa event or external', 'who is hosting'],
    'high', 'stable', null
  ),
  (
    'What are recurring VSA traditions?',
    'Recurring traditions include GBMs, Welcome Week programming, House events, ACE events, Winter Retreat, VCN, WNC, externals, fundraising events, and the End of Year Banquet — though exact programming changes by year.',
    'events', 'manual', '/events', 95,
    array['events', 'traditions', 'annual'],
    array['traditions', 'annual events', 'recurring events', 'every year'],
    'high', 'stable', null
  ),
  (
    'What is La Jolla S''mores?',
    'La Jolla S''mores is a recurring VSA social tradition associated with Events programming in recent officer documents — a beach s''mores social. Current scheduling varies by year; check the Events page.',
    'events', 'approved_drive', '/events', 95,
    array['events', 'smores', 'social', 'tradition'],
    array['la jolla smores', 'smores', 's''mores', 'beach social'],
    'high', 'stable', null
  ),
  (
    'What is Service Auction?',
    'Service Auction is a recurring fundraising/community event in recent VSA planning where members participate in offered experiences or services. Exact rules and format vary by year.',
    'events', 'approved_drive', '/events', 95,
    array['events', 'service auction', 'fundraising'],
    array['service auction', 'auction'],
    'high', 'stable', null
  ),
  (
    'What is Winter Retreat?',
    'Winter Retreat is a major bonding trip/event focused on member connection and VSA community-building. Exact locations, capacity, dates, and logistics change each year and should only come from current public information — the retreat venue is not shared publicly until announced.',
    'events', 'manual', '/events', 95,
    array['events', 'winter retreat', 'retreat', 'bonding'],
    array['winter retreat', 'retreat', 'cabin trip'],
    'high', 'stable', null
  ),
  (
    'Why can''t Ask VSA tell me a private event address?',
    'Some events use private residences or limited-access venues. Ask VSA only shares locations that VSA has publicly approved. For private-venue events, location details come through the official RSVP or announcement process.',
    'trust', 'manual', '/events', 94,
    array['trust', 'privacy', 'location', 'address'],
    array['private address', 'why no address', 'retreat address'],
    'high', 'stable', null
  ),

  -- =====================================================================
  -- E. POINTS AND LEADERBOARD EDGE CASES
  -- =====================================================================
  (
    'Why have my points not updated yet?',
    'Points may require attendance review, imports, or admin processing after an event. Use Find My Points on the leaderboard page, and if something still looks missing, use the public feedback/points correction route.',
    'points', 'manual', '/points', 97,
    array['points', 'not updated', 'missing', 'processing'],
    array['points not updated', 'points missing', 'where are my points', 'points late'],
    'high', 'stable', null
  ),
  (
    'Can Ask VSA change or fix my points?',
    'No. Ask VSA cannot edit leaderboard records. Only authorized VSA admins can investigate and correct points. Use the Feedback page or official channels to request a correction.',
    'trust', 'manual', '/feedback', 97,
    array['trust', 'points', 'correction'],
    array['fix my points', 'change my points', 'add my points'],
    'high', 'stable', null
  ),
  (
    'Can Ask VSA see my attendance history?',
    'No. Ask VSA cannot access or expose private attendance history, check-in logs, or event-by-event records. Use the public Find My Points feature, or contact cabinet through official channels for anything it cannot show.',
    'trust', 'manual', '/points', 97,
    array['trust', 'attendance', 'privacy'],
    array['my attendance', 'did i attend', 'attendance history', 'check my attendance'],
    'high', 'stable', null
  ),
  (
    'Can I earn points without being in a House?',
    'Yes. Individual points still count even when you are not assigned to a House. Unassigned members simply do not contribute those points to House standings.',
    'points', 'manual', '/leaderboard', 96,
    array['points', 'house', 'unassigned'],
    array['points without house', 'no house points', 'unassigned points'],
    'high', 'stable', null
  ),
  (
    'Do my old points move to my House after I join one?',
    'House assignments are not retroactive under the current approved policy. Points earned before your active House assignment are not moved backward to the House.',
    'points', 'manual', '/leaderboard', 96,
    array['points', 'house', 'retroactive'],
    array['retroactive points', 'points before house', 'old points transfer'],
    'high', 'stable', null
  ),
  (
    'Why are House points different from my individual points?',
    'House standings aggregate eligible points from active House members under House assignment rules. Individual points and House contributions are related but not identical — your personal total and what you contribute to your House can differ.',
    'points', 'manual', '/leaderboard', 96,
    array['points', 'house points', 'individual points'],
    array['house points vs my points', 'points dont match'],
    'high', 'stable', null
  ),
  (
    'Can point policy change?',
    'Yes. Event values and policy can change over time. Current public event listings and the current approved policy always override older entries or past years'' values.',
    'points', 'manual', '/events', 95,
    array['points', 'policy', 'changes'],
    array['points policy change', 'point values change'],
    'high', 'stable', null
  ),
  (
    'Can I see someone else''s point history?',
    'Ask VSA does not reveal hidden attendance or event-by-event point history for other members. Only publicly visible leaderboard information is available.',
    'trust', 'manual', '/leaderboard', 94,
    array['trust', 'privacy', 'points'],
    array['someone elses points', 'other members points', 'their attendance'],
    'high', 'stable', null
  ),

  -- =====================================================================
  -- F. HOUSE SYSTEM — EXPANDED
  -- =====================================================================
  (
    'Why does the House theme change every year?',
    'The House system is designed to restart with a new yearly theme, giving each academic year its own identity and traditions. Themes generally do not repeat, though there is no confirmed rule that a theme can never come back.',
    'house', 'manual', '/house', 97,
    array['house', 'theme', 'yearly'],
    array['house theme change', 'new theme', 'why new houses', 'themes repeat'],
    'high', 'stable', null
  ),
  (
    'What do House Parents do?',
    'House Parents guide their House community, help plan bonding activities and events, communicate with members, and work with the House/CRC structure. The modern guide describes four Houses with two House Parents each, though yearly structure can change.',
    'house', 'approved_drive', '/house', 97,
    array['house', 'house parents', 'hp', 'leadership'],
    array['house parents', 'what do hps do', 'house parent role', 'how many house parents'],
    'high', 'stable', null
  ),
  (
    'What is House Reveal?',
    'House Reveal is the event/tradition where members learn their House assignment for the year. Exact timing and format vary by year — watch official channels around the start of the House cycle.',
    'house', 'manual', '/house', 95,
    array['house', 'house reveal', 'assignment'],
    array['house reveal', 'when is house reveal', 'find out my house'],
    'high', 'stable', null
  ),
  (
    'Can Ask VSA tell me another person''s House?',
    'Ask VSA does not expose private House membership unless it is already clearly public. Use the official website lookup features or public profiles where available.',
    'trust', 'manual', '/house', 95,
    array['trust', 'privacy', 'house'],
    array['someones house', 'what house is', 'their house'],
    'high', 'stable', null
  ),
  (
    'What was the closest House race?',
    'Ask VSA only answers this for years with confirmed final standings in the archive. Midyear point snapshots are never treated as final results. The most detailed confirmed record is 2025–2026: Bowser 247, Donkey Kong 215, Toad 158, Boo 125.',
    'house', 'historical_archive', '/house', 94,
    array['house', 'history', 'standings', 'race'],
    array['closest house race', 'closest competition'],
    'medium', 'stable', null
  ),
  (
    'Who won each past House year?',
    'Confirmed winners: Bowser won 2025–2026 (Super Mario era, 247 points). Gucci won House Spirit Week 2020 (414 points) in the Designer era. Final full-year winners for most other years are not in the confirmed public archive — Ask VSA does not convert midyear standings into a final winner, and admits when a year''s record is missing.',
    'house', 'historical_archive', '/house', 94,
    array['house', 'history', 'winners'],
    array['who won house', 'past house winners', 'house winner history'],
    'medium', 'stable', null
  ),
  (
    'What is House lore?',
    'House lore refers to the themes, nicknames, traditions, rivalries, event memories, and community identity associated with a House era — for example, the 2023–2024 Matcha members'' "Matcha munchkins" nickname. Only confirmed or approved lore is presented; archive gaps are acknowledged rather than filled in with guesses.',
    'house', 'historical_archive', '/house', 94,
    array['house', 'lore', 'history', 'traditions'],
    array['house lore', 'house nicknames', 'house rivalries'],
    'medium', 'stable', null
  ),

  -- =====================================================================
  -- G. ACE — EXPANDED
  -- =====================================================================
  (
    'What does Anh Chị Em literally mean?',
    'Anh, Chị, and Em are Vietnamese relational terms commonly associated with older brother, older sister, and younger sibling. In VSA, ACE is used as the name of the Big/Little family and mentorship program.',
    'ace', 'manual', '/ace', 97,
    array['ace', 'anh chi em', 'meaning', 'vietnamese'],
    array['anh chi em meaning', 'what does ace stand for', 'ace meaning'],
    'high', 'stable', null
  ),
  (
    'Is ACE a dating program?',
    'No. ACE is intended for mentorship, friendship, and family-style community, not romantic matching.',
    'ace', 'manual', '/ace', 97,
    array['ace', 'dating', 'mentorship'],
    array['ace dating', 'is ace romantic', 'matchmaking'],
    'high', 'stable', null
  ),
  (
    'Can I request a specific Big or Little?',
    'ACE materials indicate applicants may sometimes express preferences or requests, but exact matching rules vary each cycle and no pairing is guaranteed. Check the current cycle''s application for how preferences work this year.',
    'ace', 'approved_drive', '/ace', 97,
    array['ace', 'request', 'pairing', 'preferences'],
    array['request a big', 'request a little', 'choose my big', 'pick my big'],
    'medium', 'yearly', null
  ),
  (
    'How are ACE pairings chosen?',
    'Pairings are organized by the ACE team using the current cycle''s process and available application information — interests, goals, and preferences may factor in to support compatible mentorship connections. Ask VSA does not reveal private matching deliberations or individual application responses.',
    'ace', 'manual', '/ace', 96,
    array['ace', 'pairing', 'matching'],
    array['how are pairings chosen', 'ace matching', 'pairing process'],
    'high', 'stable', null
  ),
  (
    'What is an ACE family?',
    'An ACE family is the broader Big/Little lineage that grows across cycles and generations — including Bigs, Littles, Pseudos, Siblings, and Grands.',
    'ace', 'manual', '/ace', 96,
    array['ace', 'family', 'lineage'],
    array['ace family', 'ace lineage', 'family tree'],
    'high', 'stable', null
  ),
  (
    'What is ACE Reveal?',
    'ACE Reveal is the event/process where Big/Little pairings are revealed. Exact format varies by year — some years use themed reveal events.',
    'ace', 'manual', '/ace', 96,
    array['ace', 'reveal', 'pairing'],
    array['ace reveal', 'big little reveal', 'family reveal', 'when is ace reveal'],
    'high', 'stable', null
  ),
  (
    'Can Ask VSA tell me someone''s ACE lineage?',
    'Only if the relationship is part of an approved public or opt-in archive. Ask VSA never exposes private pairing spreadsheets or application data.',
    'trust', 'manual', '/ace', 95,
    array['trust', 'privacy', 'ace', 'lineage'],
    array['someones lineage', 'who is their big', 'ace pairings list'],
    'high', 'stable', null
  ),
  (
    'Why do ACE applications ask personal questions?',
    'The matching process may use interests, goals, and preferences to support compatible mentorship and friendship connections. Individual responses stay private and are never revealed by Ask VSA.',
    'ace', 'manual', '/ace', 95,
    array['ace', 'application', 'personal questions'],
    array['ace application questions', 'why so personal'],
    'high', 'stable', null
  ),
  (
    'Can alumni still be part of an ACE lineage?',
    'Family lineages can continue across graduating classes. Any public lineage feature uses opt-in or approved display information only.',
    'ace', 'manual', '/ace', 95,
    array['ace', 'alumni', 'lineage'],
    array['alumni lineage', 'graduated big', 'alumni ace'],
    'high', 'stable', null
  ),

  -- =====================================================================
  -- H. CABINET — GENERAL
  -- =====================================================================
  (
    'What is E-board?',
    'Executive Board is the group of executive officers responsible for higher-level organizational decisions and leadership. In the 2026–2027 officer structure, executive roles include President, Internal Vice President (IVP), ICC/External Vice President, Treasurer, and Secretary.',
    'cabinet', 'approved_drive', '/cabinet', 98,
    array['cabinet', 'eboard', 'executive board', 'officers'],
    array['eboard', 'e-board', 'exec board', 'executive board', 'executives'],
    'high', 'yearly', '2026-2027'
  ),
  (
    'What are general Cabinet expectations?',
    'Cabinet members are expected to participate in meetings, retreats, GBMs, major events, collaboration, organizational representation, and responsibilities beyond only their individual title. Officer documents explicitly expect Cabinet members to support other events and sometimes assume additional leadership responsibilities.',
    'cabinet', 'approved_drive', '/cabinet', 97,
    array['cabinet', 'expectations', 'commitment'],
    array['cabinet expectations', 'cabinet commitment', 'what does cabinet require'],
    'high', 'yearly', null
  ),
  (
    'Do Cabinet members only do their own role?',
    'No. Officer documents explicitly expect Cabinet members to collaborate, support other officers'' events, and sometimes take on additional leadership responsibilities beyond their title.',
    'cabinet', 'approved_drive', '/cabinet', 97,
    array['cabinet', 'collaboration', 'roles'],
    array['only their role', 'cabinet collaboration', 'help other events'],
    'high', 'stable', null
  ),
  (
    'Does every Cabinet role exist every year?',
    'No. Role titles and structure evolve — roles have changed, split, disappeared, and been renamed over time. Ask VSA uses the current-year role list for current questions and identifies historical roles as historical.',
    'cabinet', 'manual', '/cabinet', 96,
    array['cabinet', 'roles', 'structure', 'evolution'],
    array['roles every year', 'role changes', 'does this role still exist'],
    'high', 'stable', null
  ),

  -- =====================================================================
  -- I. CABINET ROLE EXPLORER (2026–2027 officer descriptions)
  -- =====================================================================
  (
    'President — role description',
    'The President guides VSA''s vision, keeps Cabinet aligned with the organization''s mission, facilitates leadership systems and meetings, supports officers, plans retreats, conducts check-ins, and helps lead major transitions and banquet.',
    'cabinet_roles', 'approved_drive', '/cabinet', 96,
    array['cabinet roles', 'president', 'leadership'],
    array['president role', 'what does the president do'],
    'high', 'yearly', '2026-2027'
  ),
  (
    'Internal Vice President (IVP) — role description',
    'The Internal Vice President supports Cabinet wellness, leadership development, internal operations, Cabinet check-ins, and the Intern Program.',
    'cabinet_roles', 'approved_drive', '/cabinet', 96,
    array['cabinet roles', 'ivp', 'internal'],
    array['ivp role', 'internal vice president role', 'what does ivp do'],
    'high', 'yearly', '2026-2027'
  ),
  (
    'ICC/External Vice President — role description',
    'ICC/EVP connects VSA at UCSD with UVSA and other VSAs, coordinates externals, represents UCSD in intercollegiate spaces, and helps spearhead Wild N'' Culture.',
    'cabinet_roles', 'approved_drive', '/cabinet', 96,
    array['cabinet roles', 'icc', 'evp', 'externals', 'wnc'],
    array['icc role', 'evp role', 'what does icc do', 'external vp role'],
    'high', 'yearly', '2026-2027'
  ),
  (
    'Treasurer — role description',
    'The Treasurer manages financial records, reimbursements, funding, budgets, financial reports, grants, and financial support for events and VCN sponsorship.',
    'cabinet_roles', 'approved_drive', '/cabinet', 96,
    array['cabinet roles', 'treasurer', 'finance'],
    array['treasurer role', 'what does the treasurer do'],
    'high', 'yearly', '2026-2027'
  ),
  (
    'Secretary — role description',
    'The Secretary handles meeting documentation, the VSA email, calendar and Drive organization, TAP/event administration, room bookings, and operational coordination.',
    'cabinet_roles', 'approved_drive', '/cabinet', 96,
    array['cabinet roles', 'secretary', 'operations'],
    array['secretary role', 'what does the secretary do'],
    'high', 'yearly', '2026-2027'
  ),
  (
    'Events Chair — role description',
    'Events Chairs create welcoming social programming, help lead Welcome Week, plan retreats and social events, create logistics plans, delegate tasks, and coordinate cross-role execution.',
    'cabinet_roles', 'approved_drive', '/cabinet', 96,
    array['cabinet roles', 'events chair', 'social'],
    array['events chair role', 'what does events chair do'],
    'high', 'yearly', '2026-2027'
  ),
  (
    'Community Relations Chair (CRC) — role description',
    'The CRC leads the House system, House Parent coordination, House Reveal, House events, community service opportunities, Service Auction, and major House collaborations.',
    'cabinet_roles', 'approved_drive', '/cabinet', 96,
    array['cabinet roles', 'crc', 'house'],
    array['crc role', 'community relations chair role', 'who runs the house system'],
    'high', 'yearly', '2026-2027'
  ),
  (
    'Cultural Philanthropy Chair (CPC) — role description',
    'The CPC leads Vietnamese cultural education and programming, philanthropy, Black April discussion, Lunar New Year and Mid-Autumn activities, Tết Festival participation, and community relationships.',
    'cabinet_roles', 'approved_drive', '/cabinet', 96,
    array['cabinet roles', 'cpc', 'culture', 'philanthropy'],
    array['cpc role', 'cultural philanthropy chair role', 'cultural chair role'],
    'high', 'yearly', '2026-2027'
  ),
  (
    'ACE Chair — role description',
    'The ACE Chair leads recruitment-related member engagement and VSA''s Anh Chị Em Big/Little program, including pairings, bonding events, feedback, and collaboration on Welcome Week.',
    'cabinet_roles', 'approved_drive', '/cabinet', 96,
    array['cabinet roles', 'ace chair', 'mentorship'],
    array['ace chair role', 'who runs ace'],
    'high', 'yearly', '2026-2027'
  ),
  (
    'Media Director — role description',
    'Media Directors manage VSA''s digital presence, social media, visual marketing strategy, newsletters, graphics, flyers, and major marketing support.',
    'cabinet_roles', 'approved_drive', '/cabinet', 96,
    array['cabinet roles', 'media', 'marketing', 'graphics'],
    array['media role', 'media director role', 'who runs social media'],
    'high', 'yearly', '2026-2027'
  ),
  (
    'Fundraising Chair — role description',
    'The Fundraising Chair plans fundraising projects, works with vendors and restaurants, supports merchandise, coordinates certain aftersocial logistics, and partners with the Treasurer on financial sustainability.',
    'cabinet_roles', 'approved_drive', '/cabinet', 96,
    array['cabinet roles', 'fundraising', 'merch'],
    array['fundraising chair role', 'who does fundraisers', 'merch'],
    'high', 'yearly', '2026-2027'
  ),
  (
    'Historian — role description',
    'The Historian preserves VSA history primarily through photography, event documentation, albums, photoshoots, and visual memory-keeping. Historian documentation explicitly treats preserving VSA history, photos, ACE, House Reveal, and VCN as part of VSA''s institutional memory.',
    'cabinet_roles', 'approved_drive', '/cabinet', 96,
    array['cabinet roles', 'historian', 'photography'],
    array['historian role', 'who takes photos', 'photographer'],
    'high', 'yearly', '2026-2027'
  ),
  (
    'PR Chair — role description',
    'The Public Relations Chair is a newer role focused on video storytelling — footage, edits, recap videos, trailers, teasers, TikToks, and polished public-facing event content.',
    'cabinet_roles', 'approved_drive', '/cabinet', 96,
    array['cabinet roles', 'pr', 'video', 'tiktok'],
    array['pr chair role', 'pr role', 'who makes tiktoks', 'video editor role'],
    'high', 'yearly', '2026-2027'
  ),
  (
    'VCN Director — role description',
    'The VCN Director leads the creative and storytelling direction of Vietnamese Culture Night, including script development, VCN groups, staff coordination, run-throughs, and participant experience.',
    'cabinet_roles', 'approved_drive', '/cabinet', 96,
    array['cabinet roles', 'vcn director', 'vcn'],
    array['vcn director role', 'who runs vcn'],
    'high', 'yearly', '2026-2027'
  ),
  (
    'VCN Executive Producer — role description',
    'The VCN Executive Producer leads major logistical production responsibilities such as production committees, venue coordination, photoshoot logistics, run-through execution, and operational support.',
    'cabinet_roles', 'approved_drive', '/cabinet', 96,
    array['cabinet roles', 'vcn executive producer', 'vcn', 'production'],
    array['vcn executive producer role', 'vcn ep role', 'vcn producer'],
    'high', 'yearly', '2026-2027'
  ),
  (
    'Is PR Chair a new role?',
    'Yes. The 2026–2027 officer material marks PR Chair as relatively new. Older officer descriptions did not show a standalone PR Chair — video work previously lived under Historian/Creative Director-style roles.',
    'history', 'approved_drive', '/cabinet', 95,
    array['history', 'pr chair', 'role evolution'],
    array['is pr new', 'pr chair new', 'when did pr start'],
    'high', 'stable', null
  ),
  (
    'PR Chair vs Historian — what is the difference?',
    'Historian is primarily focused on photo-based documentation and preserving VSA history. PR Chair is focused more on video — edits, trailers, recaps, and public-facing motion content.',
    'cabinet_roles', 'approved_drive', '/cabinet', 95,
    array['cabinet roles', 'pr', 'historian', 'comparison'],
    array['pr vs historian', 'historian vs pr', 'photo vs video role'],
    'high', 'stable', null
  ),
  (
    'PR Chair vs Media — what is the difference?',
    'Media manages broader branding, graphics, social media strategy, flyers, newsletters, and marketing. PR focuses more specifically on video storytelling and polished recap/promotional content like trailers, teasers, and TikToks.',
    'cabinet_roles', 'approved_drive', '/cabinet', 95,
    array['cabinet roles', 'pr', 'media', 'comparison'],
    array['pr vs media', 'media vs pr'],
    'high', 'stable', null
  ),
  (
    'How has the Historian role changed?',
    'Older Historian or Creative Director-style descriptions combined photos and videos. The newer structure separates photo/history work under Historian and video/recap work under PR Chair.',
    'history', 'approved_drive', '/cabinet', 95,
    array['history', 'historian', 'role evolution'],
    array['historian changed', 'historian history', 'creative director'],
    'high', 'stable', null
  ),
  (
    'How has the cultural role evolved?',
    'The cultural role has appeared under names such as Cultural Education Chair, Culture and Philanthropy Chair, and Cultural Philanthropy Chair. The modern role combines cultural education with philanthropy and community-facing work.',
    'history', 'approved_drive', '/cabinet', 95,
    array['history', 'cpc', 'role evolution'],
    array['cultural role history', 'cultural education chair', 'culture chair evolution'],
    'high', 'stable', null
  ),
  (
    'Did Outreach Chair exist?',
    'Yes. Outreach Chair appears in older officer descriptions with campus resources, collaborations, tabling, inquiries, and academic-pillar duties. It should be presented as historical — it is not confirmed in the current officer structure.',
    'history', 'approved_drive', '/cabinet', 94,
    array['history', 'outreach chair', 'role evolution'],
    array['outreach chair', 'what happened to outreach'],
    'medium', 'stable', null
  ),
  (
    'Is there an Intern Coordinator role?',
    'A standalone Intern Coordinator is not confirmed in the current officer structure. Intern Program leadership is associated with the Internal Vice President (IVP).',
    'cabinet_roles', 'approved_drive', '/cabinet', 94,
    array['cabinet roles', 'intern coordinator', 'ivp'],
    array['intern coordinator', 'who runs interns'],
    'medium', 'yearly', '2026-2027'
  ),

  -- =====================================================================
  -- J. INTERN PROGRAM — EXPANDED
  -- =====================================================================
  (
    'Who is the Intern Program for?',
    'It is for members interested in learning how VSA operates, developing leadership skills, supporting Cabinet work, and potentially pursuing future leadership.',
    'intern_program', 'manual', '/intern-program', 97,
    array['intern program', 'who for', 'leadership'],
    array['who should intern', 'intern program for me'],
    'high', 'stable', null
  ),
  (
    'Is being an Intern the same as being on Cabinet?',
    'No. Interns participate in a structured leadership-development pathway connected to Cabinet but are not the same as elected/appointed Cabinet officers.',
    'intern_program', 'manual', '/intern-program', 96,
    array['intern program', 'cabinet', 'difference'],
    array['intern vs cabinet', 'are interns cabinet'],
    'high', 'stable', null
  ),
  (
    'Does being an Intern guarantee a Cabinet spot?',
    'No. The program can prepare members for future leadership, but it does not guarantee a Cabinet position.',
    'intern_program', 'manual', '/intern-program', 96,
    array['intern program', 'cabinet', 'guarantee'],
    array['intern guarantee cabinet', 'does intern lead to cabinet'],
    'high', 'stable', null
  ),
  (
    'Do I need to be an Intern before joining Cabinet?',
    'Not necessarily, unless current application rules state otherwise. The Intern Program is a useful pathway, not a universal prerequisite.',
    'intern_program', 'manual', '/intern-program', 95,
    array['intern program', 'cabinet', 'prerequisite'],
    array['intern before cabinet', 'required to intern'],
    'high', 'stable', null
  ),

  -- =====================================================================
  -- K. VCN — EXPANDED
  -- =====================================================================
  (
    'How can I join VCN?',
    'Depending on the year, opportunities may include acting, modern dance, traditional dance, production, tech, creative work, marketing/media, sponsorship, volunteering, or other committees. Check the current audition and interest forms on VSA''s Instagram or Linktree.',
    'vcn', 'manual', '/vcn', 96,
    array['vcn', 'join', 'audition', 'committees'],
    array['join vcn', 'vcn auditions', 'vcn sign up', 'be in vcn'],
    'high', 'yearly', null
  ),
  (
    'Do I need performance experience for VCN?',
    'Requirements vary by team and year. Check the current audition or interest forms rather than assuming experience is required — many teams welcome beginners.',
    'vcn', 'manual', '/vcn', 96,
    array['vcn', 'experience', 'audition', 'beginner'],
    array['vcn experience required', 'never danced', 'never acted'],
    'high', 'stable', null
  ),
  (
    'Who runs VCN?',
    'The current role structure includes a VCN Director (creative/storytelling direction) and a VCN Executive Producer (production logistics), working with multiple committees and coordinators.',
    'vcn', 'approved_drive', '/vcn', 96,
    array['vcn', 'director', 'executive producer', 'leadership'],
    array['who runs vcn', 'vcn leadership', 'vcn staff'],
    'high', 'yearly', '2026-2027'
  ),
  (
    'What was VCN 2026?',
    'The 2026 VCN project was titled "Tình Yêu Thầm Lặng," commonly described in English as "Unspoken Love" or "Silent Love." Its central theme focused on love expressed through actions rather than words within a traditional Vietnamese family context.',
    'vcn', 'approved_drive', '/vcn', 95,
    array['vcn', '2026', 'unspoken love', 'history'],
    array['vcn 2026', 'tinh yeu tham lang', 'unspoken love', 'silent love'],
    'high', 'stable', '2025-2026'
  ),
  (
    'Is VCN free to attend?',
    'Do not assume — use current public event information. Historical sponsorship materials have described admission-free productions, but the current year''s details control.',
    'vcn', 'manual', '/events', 95,
    array['vcn', 'free', 'tickets'],
    array['vcn free', 'vcn tickets', 'vcn admission'],
    'medium', 'yearly', null
  ),
  (
    'What is a VCN run-through?',
    'A VCN run-through is a major rehearsal/production coordination event used to bring show elements together before the performance.',
    'vcn', 'approved_drive', '/vcn', 94,
    array['vcn', 'run-through', 'rehearsal'],
    array['run through', 'runthrough', 'vcn rehearsal'],
    'high', 'stable', null
  ),
  (
    'What were past VCN shows about?',
    'Older VCN titles and production details are only answered when confirmed through approved archive material. The confirmed recent record is VCN 2026, "Tình Yêu Thầm Lặng" (Unspoken Love). For other years, the public archive is incomplete — Ask VSA does not infer titles from drafts or brainstorms.',
    'vcn', 'historical_archive', '/vcn', 94,
    array['vcn', 'history', 'past shows'],
    array['past vcn', 'old vcn', 'vcn history', 'previous vcn themes'],
    'medium', 'stable', null
  ),

  -- =====================================================================
  -- L. WNC — EXPANDED
  -- =====================================================================
  (
    'Who runs WNC?',
    'Recent officer descriptions place major WNC leadership under ICC/EVP, which helps spearhead the event and coordinate external relationships with other schools.',
    'wnc', 'approved_drive', '/wild-n-culture', 96,
    array['wnc', 'icc', 'leadership'],
    array['who runs wnc', 'wnc leadership'],
    'high', 'yearly', '2026-2027'
  ),
  (
    'Is WNC the same as VCN?',
    'No. VCN is a cultural production centered on storytelling and performance. WNC is a high-energy comedy/game competition. They are separate flagship events.',
    'wnc', 'manual', '/wild-n-culture', 96,
    array['wnc', 'vcn', 'difference'],
    array['wnc vs vcn', 'vcn vs wnc', 'difference between vcn and wnc'],
    'high', 'stable', null
  ),
  (
    'What happens at WNC?',
    'Formats can include live comedy games, prompts, improv-style rounds, roast battles, team competition, and crowd participation. Exact games change by year, and teams from multiple schools have historically participated.',
    'wnc', 'manual', '/wild-n-culture', 95,
    array['wnc', 'format', 'games'],
    array['what happens at wnc', 'wnc games', 'wnc format'],
    'high', 'stable', null
  ),
  (
    'Is WNC appropriate for everyone?',
    'WNC is known for energetic comedy and may contain more mature humor than a standard GBM. Use current event guidance when available if you are unsure.',
    'wnc', 'manual', '/wild-n-culture', 95,
    array['wnc', 'humor', 'audience'],
    array['wnc appropriate', 'wnc mature', 'can i bring'],
    'high', 'stable', null
  ),
  (
    'What is WNC''s history?',
    'WNC has run across multiple recent years with intercollegiate participation from SoCal schools. Detailed internal scripts, contestant notes, and game-planning materials from the archive are not public — Ask VSA shares only approved public history.',
    'wnc', 'historical_archive', '/wild-n-culture', 94,
    array['wnc', 'history', 'archive'],
    array['wnc history', 'past wnc', 'old wnc'],
    'medium', 'stable', null
  ),

  -- =====================================================================
  -- M. BANQUET / EOYB ARCHIVE
  -- =====================================================================
  (
    'Is banquet the same every year?',
    'No. The theme, venue, schedule, pricing, and program details change yearly. The common thread is that EOYB closes out the year with recaps, recognition, senior sendoff, and Cabinet transition.',
    'banquet', 'manual', '/events', 96,
    array['banquet', 'eoyb', 'yearly'],
    array['banquet every year', 'banquet theme', 'banquet different'],
    'high', 'stable', null
  ),
  (
    '2022 banquet — Enchanted Forest',
    'The confirmed 2022 archive used the theme "Enchanted Forest." It was combined with a VCN Showcase in the available logistics material.',
    'banquet', 'historical_archive', null, 95,
    array['banquet', '2022', 'enchanted forest', 'history'],
    array['2022 banquet', 'enchanted forest'],
    'high', 'stable', '2021-2022'
  ),
  (
    '2023 banquet — A Sky Full of Stars',
    'The confirmed 2023 banquet theme was "A Sky Full of Stars."',
    'banquet', 'historical_archive', null, 95,
    array['banquet', '2023', 'sky full of stars', 'history'],
    array['2023 banquet', 'sky full of stars'],
    'high', 'stable', '2022-2023'
  ),
  (
    '2024 banquet — I See the Light',
    'The confirmed 2024 banquet theme was "I See the Light."',
    'banquet', 'historical_archive', null, 95,
    array['banquet', '2024', 'i see the light', 'history'],
    array['2024 banquet', 'i see the light'],
    'high', 'stable', '2023-2024'
  ),
  (
    '2025 banquet — Solstice',
    'The confirmed 2025 banquet theme was "Solstice: Where the Light Lingers."',
    'banquet', 'historical_archive', null, 95,
    array['banquet', '2025', 'solstice', 'history'],
    array['2025 banquet', 'solstice'],
    'high', 'stable', '2024-2025'
  ),
  (
    '2026 banquet — Afterglow',
    'The confirmed 2026 banquet theme was "Afterglow: A Night of Memories."',
    'banquet', 'historical_archive', null, 95,
    array['banquet', '2026', 'afterglow', 'history'],
    array['2026 banquet', 'afterglow'],
    'high', 'stable', '2025-2026'
  ),
  (
    'Banquet theme evolution',
    'Recent confirmed banquet themes: Enchanted Forest (2022), A Sky Full of Stars (2023), I See the Light (2024), Solstice: Where the Light Lingers (2025), and Afterglow: A Night of Memories (2026).',
    'banquet', 'historical_archive', null, 90,
    array['banquet', 'themes', 'history'],
    array['banquet themes', 'past banquets', 'banquet history'],
    'high', 'stable', null
  ),
  (
    'What are banquet superlatives?',
    'Superlatives are playful year-end awards voted or selected through that year''s banquet process. Winners and private voting records are not something Ask VSA invents or reveals.',
    'banquet', 'manual', null, 94,
    array['banquet', 'superlatives', 'awards'],
    array['superlatives', 'banquet awards'],
    'high', 'stable', null
  ),
  (
    'What is Senior Sendoff?',
    'Senior Sendoff is a banquet/end-of-year tradition recognizing graduating members. Exact format varies by year.',
    'banquet', 'manual', null, 94,
    array['banquet', 'senior sendoff', 'seniors'],
    array['senior sendoff', 'graduating seniors'],
    'high', 'stable', null
  ),
  (
    'What is Member of the Year?',
    'Member of the Year is a year-end recognition associated with banquet programming. Selection details may vary by year and are not guessed at.',
    'banquet', 'manual', null, 94,
    array['banquet', 'member of the year', 'awards'],
    array['member of the year', 'moty'],
    'high', 'stable', null
  ),

  -- =====================================================================
  -- N. UVSA, EXTERNALS, AND NETWORK
  -- =====================================================================
  (
    'Why attend externals?',
    'Externals let members meet students from other schools, support partner VSAs, participate in intercollegiate traditions, and experience the broader SoCal VSA community. Attending externals also earns leaderboard points under the current policy.',
    'uvsa_network', 'manual', '/uvsa-network', 96,
    array['externals', 'uvsa', 'why attend'],
    array['why go to externals', 'externals worth it'],
    'high', 'stable', null
  ),
  (
    'What is Friendship Games?',
    'Friendship Games is a UVSA/network tradition referenced in VSA external programming. Current participation details should come from current public announcements.',
    'uvsa_network', 'manual', '/uvsa-network', 96,
    array['externals', 'friendship games', 'uvsa'],
    array['friendship games', 'fg'],
    'medium', 'yearly', null
  ),
  (
    'What is UVSA Tết Festival?',
    'UVSA Tết Festival is a major regional Vietnamese cultural event. VSA at UCSD has historically participated through activities such as cultural/Tết booths.',
    'uvsa_network', 'manual', '/uvsa-network', 96,
    array['externals', 'tet festival', 'uvsa', 'culture'],
    array['tet festival', 'uvsa tet', 'tet fest'],
    'high', 'stable', null
  ),
  (
    'Does UCSD provide rides to every external?',
    'No. Ride coordination depends on the event and year. Check current rollout and ride forms for each external.',
    'uvsa_network', 'manual', '/uvsa-network', 95,
    array['externals', 'rides', 'carpool'],
    array['rides to externals', 'carpool', 'how do i get there'],
    'high', 'stable', null
  ),
  (
    'Can Ask VSA assign me a ride?',
    'No. Ask VSA directs users to the current public ride process and never exposes private driver/passenger assignments.',
    'trust', 'manual', '/uvsa-network', 95,
    array['trust', 'rides', 'privacy'],
    array['assign me a ride', 'who is my driver', 'ride assignment'],
    'high', 'stable', null
  ),
  (
    'What does ICC do at externals?',
    'ICC/EVP helps coordinate participation, communicate with other schools, attend intercollegiate meetings, and organize external-event logistics.',
    'uvsa_network', 'approved_drive', '/uvsa-network', 95,
    array['externals', 'icc', 'coordination'],
    array['icc externals', 'icc at externals'],
    'high', 'stable', null
  ),

  -- =====================================================================
  -- O. WEBSITE NAVIGATION AND SELF-SERVICE
  -- =====================================================================
  (
    'Where do I find upcoming events?',
    'Use the [Events](/events) page for upcoming public events, dates, locations, descriptions, and point values when listed.',
    'website', 'public_page', '/events', 97,
    array['website', 'events', 'navigation'],
    array['upcoming events', 'next events', 'events page'],
    'high', 'stable', null
  ),
  (
    'Where do I find past events?',
    'Use the past events view on the [Events](/events) page. Note that historical data may be incomplete — an event missing from the archive does not mean it never happened.',
    'website', 'public_page', '/events', 97,
    array['website', 'past events', 'archive'],
    array['past events', 'old events', 'event archive'],
    'high', 'stable', null
  ),
  (
    'Where do I check House standings?',
    'Use the [House](/house) page or the House view of the [Leaderboard](/leaderboard) where available.',
    'website', 'public_page', '/house', 97,
    array['website', 'house', 'standings'],
    array['house standings', 'house leaderboard', 'house rankings'],
    'high', 'stable', null
  ),
  (
    'Where do I find the current Cabinet?',
    'Use the [Cabinet](/cabinet) page for current and historical Cabinet information by academic year.',
    'website', 'public_page', '/cabinet', 97,
    array['website', 'cabinet', 'navigation'],
    array['cabinet page', 'see the board', 'current officers'],
    'high', 'stable', null
  ),
  (
    'Where do I learn about externals on the website?',
    'Use the [UVSA Network](/uvsa-network) page and current official rollout information for externals.',
    'website', 'public_page', '/uvsa-network', 96,
    array['website', 'externals', 'uvsa network'],
    array['uvsa network page', 'externals page'],
    'high', 'stable', null
  ),
  (
    'Where do I report wrong information?',
    'Use the [Feedback](/feedback) page and identify the page or Ask VSA answer that appears incorrect. Do not submit passwords or sensitive personal data.',
    'website', 'public_page', '/feedback', 96,
    array['website', 'feedback', 'corrections'],
    array['report wrong info', 'incorrect answer', 'wrong information'],
    'high', 'stable', null
  ),
  (
    'The website and Instagram disagree. Which is right?',
    'For current event details, compare timestamps and use the newest official update. When sources conflict, Ask VSA acknowledges the conflict rather than pretending both are correct — and recommends confirming through the most recently updated official channel.',
    'website', 'manual', '/events', 96,
    array['website', 'instagram', 'conflict'],
    array['website vs instagram', 'conflicting info', 'which is right'],
    'high', 'stable', null
  ),
  (
    'Why can''t I find an application?',
    'The application may not be open yet, may have closed, or may not be active this cycle. Application buttons only appear during their configured active window, so a missing button usually means the window is closed — not a website error. Check Get Involved or official channels for current status.',
    'applications', 'manual', '/get-involved', 95,
    array['applications', 'missing', 'closed', 'window'],
    array['cant find application', 'application gone', 'apply button missing', 'application closed'],
    'high', 'stable', null
  ),
  (
    'Why is an old event missing from the site?',
    'Historical data may be incomplete. "Not in the public archive" is different from "the event never happened" — Ask VSA distinguishes the two rather than guessing.',
    'website', 'manual', '/events', 95,
    array['website', 'archive', 'missing events'],
    array['old event missing', 'event not listed', 'archive gap'],
    'high', 'stable', null
  ),

  -- =====================================================================
  -- P. VSA HISTORY AND LEGACY
  -- =====================================================================
  (
    'When was VSA at UCSD established?',
    'Approved VSA sponsorship and history documents state that VSA at UCSD was established in 1977.',
    'history', 'approved_drive', '/', 97,
    array['history', '1977', 'founded', 'established'],
    array['when was vsa founded', 'how old is vsa', 'vsa established', '1977'],
    'high', 'stable', null
  ),
  (
    'How far back does Cabinet history go?',
    'The internal historical Cabinet archive contains records reaching at least the 2003–2004 Cabinet year. Public display uses only reviewed names, roles, and years — see the [Cabinet](/cabinet) page for the public archive.',
    'history', 'approved_drive', '/cabinet', 96,
    array['history', 'cabinet archive', '2003'],
    array['cabinet history', 'oldest cabinet', 'past cabinets'],
    'high', 'stable', null
  ),
  (
    'When did CRC become a role?',
    'Community Relations Chair appears as a newer role in the 2023–2024 officer materials and continues in later structures.',
    'history', 'approved_drive', '/cabinet', 95,
    array['history', 'crc', 'role evolution'],
    array['when did crc start', 'crc history'],
    'high', 'stable', null
  ),
  (
    'When did VCN Executive Producer become a separate role?',
    'The 2026–2027 structure explicitly lists VCN Director and VCN Executive Producer separately. Older recent officer documents placed more combined responsibilities under VCN Director.',
    'history', 'approved_drive', '/cabinet', 95,
    array['history', 'vcn', 'executive producer', 'role evolution'],
    array['vcn ep history', 'when did vcn producer start'],
    'high', 'stable', null
  ),
  (
    'Is the public VSA history complete?',
    'No. Some years and programs have archive gaps — for example, the 2020–2021 House year is unconfirmed. Ask VSA treats archive gaps as part of the history rather than inventing missing facts. Alumni and former members are encouraged to submit corrections through the Feedback page.',
    'history', 'manual', '/feedback', 94,
    array['history', 'archive gaps', 'corrections', 'alumni'],
    array['history complete', 'missing history', 'archive gaps', 'alumni corrections'],
    'high', 'stable', null
  ),

  -- =====================================================================
  -- Q. CULTURE AND EDUCATION
  -- =====================================================================
  (
    'What is Black April?',
    'Black April commonly refers to remembrance and reflection around the end of the Vietnam War on April 30, 1975. VSA cultural programming has included Black April discussion. This topic is handled respectfully, and Ask VSA does not present partisan political claims as organizational policy.',
    'culture', 'manual', null, 96,
    array['culture', 'black april', 'remembrance', 'vietnam war'],
    array['black april', 'april 30', 'thang tu den'],
    'high', 'stable', null
  ),
  (
    'Does VSA celebrate Tết?',
    'Yes — VSA cultural programming has included Lunar New Year/Tết activities and participation in Tết-related community events such as the UVSA Tết Festival.',
    'culture', 'manual', '/events', 96,
    array['culture', 'tet', 'lunar new year'],
    array['tet', 'lunar new year', 'new year celebration'],
    'high', 'stable', null
  ),
  (
    'Does VSA do Mid-Autumn programming?',
    'Yes — recent cultural role descriptions include Mid-Autumn Moon Festival activities.',
    'culture', 'approved_drive', '/events', 96,
    array['culture', 'mid-autumn', 'moon festival'],
    array['mid autumn', 'moon festival', 'trung thu'],
    'high', 'stable', null
  ),
  (
    'What is Giving Thanks Dinner?',
    'Giving Thanks Dinner is a recurring program referenced in cultural and community role responsibilities. Exact format varies by year.',
    'culture', 'approved_drive', '/events', 96,
    array['culture', 'giving thanks dinner', 'community'],
    array['giving thanks dinner', 'thanksgiving dinner'],
    'high', 'stable', null
  ),
  (
    'Is VSA political?',
    'For political-status questions, the approved organizational policy and current constitution are the authority. Political positions are not inferred from individual members or historical scripts. VSA''s stated purpose centers on culture, community, social connection, and education.',
    'culture', 'manual', '/', 95,
    array['culture', 'political', 'policy'],
    array['is vsa political', 'political stance'],
    'medium', 'stable', null
  ),
  (
    'Does VSA only focus on social events?',
    'No. VSA''s work spans social connection, Vietnamese cultural preservation and education, community engagement, leadership development, philanthropy, and major cultural productions like VCN.',
    'culture', 'manual', '/', 95,
    array['culture', 'purpose', 'programs'],
    array['only social', 'just parties', 'more than social'],
    'high', 'stable', null
  ),

  -- =====================================================================
  -- R. RECOMMENDATION / "WHAT SHOULD I JOIN?" INTENTS
  -- =====================================================================
  (
    'I like event planning. What fits me?',
    'Consider Events Chair pathways, event volunteering, the Intern Program, and helping with VSA event programming. Events Chairs plan Welcome Week, retreats, and social events with real logistics ownership.',
    'recommendations', 'manual', '/get-involved', 97,
    array['recommendations', 'event planning', 'events chair'],
    array['like event planning', 'plan events', 'organize events'],
    'high', 'stable', null
  ),
  (
    'I like photography. What fits me?',
    'Consider Historian-related involvement, Gallery/event photography, or approved documentation opportunities. The Historian preserves VSA history through photos, albums, and photoshoots.',
    'recommendations', 'manual', '/get-involved', 97,
    array['recommendations', 'photography', 'historian'],
    array['like photography', 'take photos', 'camera'],
    'high', 'stable', null
  ),
  (
    'I like video editing. What fits me?',
    'PR Chair is probably the closest Cabinet fit — it is a newer role focused on footage, recap videos, trailers, teasers, TikToks, and video storytelling. VCN/WNC media work is another option. (Media, by contrast, is more focused on graphics, branding, and broader social strategy.)',
    'recommendations', 'manual', '/get-involved', 97,
    array['recommendations', 'video', 'pr chair', 'tiktok'],
    array['like video editing', 'make tiktoks', 'edit videos', 'videography'],
    'high', 'stable', null
  ),
  (
    'I like graphic design. What fits me?',
    'Consider Media-related opportunities (graphics, flyers, newsletters, social media strategy) and production marketing teams when forms are open.',
    'recommendations', 'manual', '/get-involved', 97,
    array['recommendations', 'graphic design', 'media'],
    array['like graphic design', 'make graphics', 'design flyers'],
    'high', 'stable', null
  ),
  (
    'I like coding. What fits me?',
    'Website and technical project opportunities exist when publicly available — like the VSA website itself. There is no official Cabinet engineering role confirmed by current leadership, so check current openings rather than assuming one exists.',
    'recommendations', 'manual', '/get-involved', 97,
    array['recommendations', 'coding', 'website', 'technical'],
    array['like coding', 'programmer', 'software', 'web dev'],
    'high', 'stable', null
  ),
  (
    'I like mentoring people. What fits me?',
    'Consider ACE (as a Big), IVP/Intern leadership pathways, House Parent opportunities, or community-building roles depending on current openings.',
    'recommendations', 'manual', '/get-involved', 97,
    array['recommendations', 'mentoring', 'ace', 'house parent'],
    array['like mentoring', 'be a mentor', 'guide people'],
    'high', 'stable', null
  ),
  (
    'I like Vietnamese culture. What fits me?',
    'Consider CPC programming, VCN, Tết/Mid-Autumn events, cultural GBMs, and related volunteering.',
    'recommendations', 'manual', '/get-involved', 97,
    array['recommendations', 'culture', 'cpc', 'vcn'],
    array['like vietnamese culture', 'cultural programs'],
    'high', 'stable', null
  ),
  (
    'I like performing. What fits me?',
    'Consider VCN acting/dance and WNC participation opportunities when current forms are open.',
    'recommendations', 'manual', '/get-involved', 97,
    array['recommendations', 'performing', 'vcn', 'wnc'],
    array['like performing', 'stage', 'spotlight'],
    'high', 'stable', null
  ),
  (
    'I like meeting people from other schools. What fits me?',
    'Consider externals, ICC/EVP-related opportunities, UVSA events, WNC, and intercollegiate programming.',
    'recommendations', 'manual', '/uvsa-network', 97,
    array['recommendations', 'externals', 'icc', 'other schools'],
    array['meet other schools', 'intercollegiate', 'other vsas'],
    'high', 'stable', null
  ),
  (
    'I like finance or business. What fits me?',
    'Consider Treasurer/Fundraising pathways, sponsorship work, vendor coordination, and event-budget experience.',
    'recommendations', 'manual', '/get-involved', 97,
    array['recommendations', 'finance', 'business', 'treasurer', 'fundraising'],
    array['like finance', 'like business', 'money management', 'sponsorships'],
    'high', 'stable', null
  ),
  (
    'I want to be President someday. What should I do?',
    'Learn multiple areas of VSA, attend consistently, develop relationships across Cabinet and general membership, consider Intern/Cabinet pathways, and build leadership experience. No specific path or election result can be promised.',
    'recommendations', 'manual', '/get-involved', 97,
    array['recommendations', 'president', 'leadership path'],
    array['be president', 'become president', 'president someday'],
    'high', 'stable', null
  )

) as v(title, content, category, source_type, source_url, priority, tags, aliases, confidence, freshness, academic_year)
where not exists (
  select 1 from public.ai_knowledge_base kb where kb.title = v.title
);

-- =====================================================================
-- Alias enrichment for existing entries that new intents should hit
-- =====================================================================
update public.ai_knowledge_base
set aliases = array['gbm', 'general body meeting', 'what is a gbm', 'body meeting']
where title = 'What is a GBM?' and aliases = '{}';

update public.ai_knowledge_base
set aliases = array['join', 'get involved', 'sign up', 'how do i join', 'become a member', 'membership']
where title = 'How to join or get involved' and aliases = '{}';
