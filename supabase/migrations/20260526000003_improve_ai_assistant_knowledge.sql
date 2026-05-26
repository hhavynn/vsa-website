-- Improve approved public knowledge coverage for the VSA AI Assistant.
-- These snippets are public-safe and avoid private Drive links, member data,
-- attendance records, check-in codes, budgets, and admin resources.

update public.ai_knowledge_base
set
  content = 'VSA members earn leaderboard points by attending eligible VSA at UCSD events and activities. General GBMs and normal events are usually 1 point. Paid, cultural, or mission-heavy GBMs are usually 2 points. Paid mixers and banquet are usually 3 points. VCN, WNC, and retreat are usually 5 points. Externals are usually 4 points. Always check current public event details because point values can vary by event.',
  priority = 96,
  tags = array['points', 'leaderboard', 'earn points', 'event points', 'gbm', 'mixer', 'banquet', 'vcn', 'wnc', 'retreat', 'externals', 'score'],
  last_verified_at = now()
where title = 'Points basics';

update public.ai_knowledge_base
set
  content = 'Cabinet and interns do not earn leaderboard points for required role duties, staffing, setup, cleanup, assigned shifts, or responsibilities that are part of their role. They can still earn points for eligible participation outside required duties when VSA policy allows it.',
  priority = 92,
  tags = array['cabinet', 'interns', 'duties', 'staffing', 'setup', 'cleanup', 'shifts', 'points'],
  last_verified_at = now()
where title = 'Cabinet and intern required duties do not count for leaderboard points';

update public.ai_knowledge_base
set
  content = 'The House Program is a year-long community experience within VSA at UCSD. Members are placed into Bowser, Boo, Toad, or Donkey Kong and participate in socials, bonding activities, and VSA events to build friendships and earn points. House points are based on active house membership on the event date. Individual points still count even if someone has no house. Unassigned members do not contribute to house standings, and house assignments are not retroactive.',
  priority = 94,
  tags = array['house', 'houses', 'house system', 'Bowser', 'Boo', 'Toad', 'Donkey Kong', 'standings', 'assignments', 'points'],
  last_verified_at = now()
where title = 'House System basics';

update public.ai_knowledge_base
set
  content = 'To attend an external, find the external you want to attend, check the host school''s Linktree or Instagram for RSVP or tickets, and look for a VSA at UCSD Linktree ride form when UCSD coordinates rides. Show up respectfully and follow the announced public points proof or check-in process. Do not ask the assistant for private check-in codes.',
  priority = 90,
  tags = array['externals', 'external', 'rides', 'ride form', 'rsvp', 'tickets', 'linktree', 'uvsa', 'other schools'],
  last_verified_at = now()
where title = 'How to attend externals';

update public.ai_knowledge_base
set
  content = 'Attending any UVSA external earns 4 points on the UCSD VSA leaderboard by default. Wild N'' Culture earns 5 points because it is a major UCSD-hosted event. 2026-2027 externals are decided after summer ICC planning, so members should check the UVSA Network page and official VSA channels for current showcase information.',
  priority = 91,
  tags = array['external points', 'externals', 'uvsa', 'wnc', 'wild n culture', 'points', 'icc', 'showcase'],
  last_verified_at = now()
where title = 'External points policy';

update public.ai_knowledge_base
set
  content = 'For feedback, points corrections, or questions the assistant cannot answer, use the public Feedback page or official VSA at UCSD channels. If points look wrong, they may update after admin imports or review. Do not submit private attendance records, member emails, budgets, check-in codes, or cabinet-only links through chat.',
  priority = 88,
  tags = array['feedback', 'contact', 'points correction', 'corrections', 'help', 'imports', 'wrong points'],
  last_verified_at = now()
where title = 'Feedback and points correction';

insert into public.ai_knowledge_base
  (title, content, category, source_type, source_url, priority, tags, last_verified_at)
select
  title,
  content,
  category,
  source_type,
  source_url,
  priority,
  tags,
  now()
from (
  values
    (
      'Upcoming events and current details',
      'The Events page is the public source for current VSA at UCSD event details, including upcoming events, dates, locations, event types, descriptions, and point values when listed. Event dates, times, locations, and points can change, so members should check the Events page or official VSA channels for the latest updates.',
      'events',
      'public_page',
      '/events',
      97,
      array['events', 'upcoming events', 'next event', 'when is', 'what is happening', 'gbm', 'meeting', 'social']
    ),
    (
      'Detailed points policy',
      'Common public point values: general GBMs and normal events are 1 point; paid, cultural, or mission-heavy GBMs are 2 points; paid mixers are 3 points; banquet is 3 points; VCN is 5 points; WNC is 5 points; retreat is 5 points; externals are 4 points. The assistant should not invent point values not present in approved public context.',
      'points',
      'faq',
      '/leaderboard',
      95,
      array['points', 'point values', 'leaderboard', 'gbm', 'paid mixer', 'banquet', 'vcn', 'wnc', 'retreat', 'externals']
    ),
    (
      'House points and assignment rules',
      'House points count based on active house membership on the event date. Individual points still count even if someone has no house. Unassigned members do not contribute to house standings. House assignments are not retroactive, so points are not moved backward to a house for events before the assignment was active.',
      'house',
      'faq',
      '/house-system',
      90,
      array['house', 'house points', 'active membership', 'unassigned', 'retroactive', 'standings']
    ),
    (
      'UVSA Network externals and ride forms',
      'The UVSA Network page shows schools in the SoCal VSA network and external showcase information. All externals are worth 4 points by default. When VSA at UCSD coordinates rides, ride forms are usually shared through the VSA at UCSD Linktree or official channels. 2026-2027 externals are decided after summer ICC planning.',
      'uvsa_network',
      'public_page',
      '/uvsa-network',
      90,
      array['uvsa', 'externals', 'external', 'rides', 'ride forms', 'linktree', 'schools', 'icc', 'showcase']
    ),
    (
      'Assistant trust and fallback',
      'The assistant should only answer from approved public VSA at UCSD context or live public event data. If it does not know, it should say it is not sure and direct users to the Events page, Feedback page, or official VSA channels instead of guessing.',
      'trust',
      'faq',
      '/feedback',
      86,
      array['fallback', 'not sure', 'trust', 'approved info', 'official channels', 'feedback']
    )
) as snippets(title, content, category, source_type, source_url, priority, tags)
where not exists (
  select 1 from public.ai_knowledge_base kb where kb.title = snippets.title
);
