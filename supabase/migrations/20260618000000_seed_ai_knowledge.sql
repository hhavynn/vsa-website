-- Migration to seed robust public knowledge for Ask VSA

update public.ai_knowledge_base
set content = 'To get involved with VSA at UCSD: 
- Attend upcoming events listed on the /events page.
- Check open applications or buttons across the site for current opportunities.
- Join ACE (Anh Chi Em) for mentorship and family bonding.
- Participate in House activities and earn points for your house.
- Apply for the Intern Program if interested in leadership.
- Explore VCN (Vietnamese Culture Night) or WNC (Wild N Culture) for cultural and performance events.
- Check the /get-involved page as the central guide.
- Follow official VSA channels (Instagram, Linktree) for the latest updates.',
tags = array['join', 'get involved', 'new member', 'events', 'applications', 'how to join'],
updated_at = now()
where title = 'How to join or get involved';

INSERT INTO public.ai_knowledge_base (title, content, category, source_type, source_url, priority, tags)
SELECT 'What events does VSA host?', 'VSA hosts a wide variety of events including General Body Meetings (GBMs), social mixers, cultural workshops, big/little reveals, house socials, and large-scale events like Vietnamese Culture Night (VCN) and Wild N'' Culture (WNC). Check the /events page for upcoming events.', 'events', 'public_page', '/events', 95, array['events', 'gbms', 'socials', 'upcoming']
WHERE NOT EXISTS (SELECT 1 FROM public.ai_knowledge_base WHERE title = 'What events does VSA host?');

INSERT INTO public.ai_knowledge_base (title, content, category, source_type, source_url, priority, tags)
SELECT 'How do I join ACE?', 'To join the ACE (Anh Chi Em) mentorship program, keep an eye out for ACE applications to open during the fall or winter quarters. You can check the /ace page or our official Instagram for application deadlines and the pairing process.', 'ace', 'public_page', '/ace', 95, array['ace', 'join ace', 'family', 'fam', 'anh chi em']
WHERE NOT EXISTS (SELECT 1 FROM public.ai_knowledge_base WHERE title = 'How do I join ACE?');

INSERT INTO public.ai_knowledge_base (title, content, category, source_type, source_url, priority, tags)
SELECT 'How do I apply for cabinet or intern program?', 'Cabinet and Intern Program applications open at specific times during the year. The Intern Program typically opens in the Fall, while Cabinet applications open in the Spring. Check the /intern-program and /cabinet pages, or our Linktree for active application forms.', 'leadership', 'public_page', '/intern-program', 90, array['cabinet', 'intern', 'apply', 'applications', 'leadership', 'board']
WHERE NOT EXISTS (SELECT 1 FROM public.ai_knowledge_base WHERE title = 'How do I apply for cabinet or intern program?');

INSERT INTO public.ai_knowledge_base (title, content, category, source_type, source_url, priority, tags)
SELECT 'Where can I find photos/gallery?', 'You can find photos from past events, VCN, and other activities on the /gallery page. We regularly upload albums and event recaps there!', 'gallery', 'public_page', '/gallery', 80, array['photos', 'gallery', 'pictures', 'albums']
WHERE NOT EXISTS (SELECT 1 FROM public.ai_knowledge_base WHERE title = 'Where can I find photos/gallery?');

INSERT INTO public.ai_knowledge_base (title, content, category, source_type, source_url, priority, tags)
SELECT 'How do applications work / where are open applications?', 'Open applications for ACE, Houses, Interns, Cabinet, VCN, and WNC are linked directly on their respective pages (like /ace or /intern-program) and on the homepage when active. If you don''t see a link, the application is likely closed or hasn''t opened yet.', 'applications', 'faq', '/', 90, array['applications', 'forms', 'apply', 'open applications']
WHERE NOT EXISTS (SELECT 1 FROM public.ai_knowledge_base WHERE title = 'How do applications work / where are open applications?');

INSERT INTO public.ai_knowledge_base (title, content, category, source_type, source_url, priority, tags)
SELECT 'How do I check my points?', 'Members can use the public "Find My Points" area on the /leaderboard or /points page to check their points. Just search for your name! If points look incorrect, you can submit a points correction request.', 'points', 'public_page', '/points', 90, array['points', 'find my points', 'leaderboard', 'check points']
WHERE NOT EXISTS (SELECT 1 FROM public.ai_knowledge_base WHERE title = 'How do I check my points?');

INSERT INTO public.ai_knowledge_base (title, content, category, source_type, source_url, priority, tags)
SELECT 'How do I contact VSA or report website feedback?', 'For general questions, you can reach out via our official Instagram or talk to a cabinet member. If you want to report a bug or provide feedback about the website, use the /feedback page!', 'contact', 'faq', '/feedback', 80, array['contact', 'feedback', 'bug', 'report']
WHERE NOT EXISTS (SELECT 1 FROM public.ai_knowledge_base WHERE title = 'How do I contact VSA or report website feedback?');

INSERT INTO public.ai_knowledge_base (title, content, category, source_type, source_url, priority, tags)
SELECT 'How do I join a House?', 'To join the House System, watch for sign-up or application announcements at the start of the academic year (usually during Fall quarter). You can sign up through the /house page, check open forms on the homepage, or follow official VSA channels like @vsaatucsd on Instagram for updates.', 'house', 'faq', '/house', 95, array['house', 'join house', 'house sign-up', 'sorting', 'applications']
WHERE NOT EXISTS (SELECT 1 FROM public.ai_knowledge_base WHERE title = 'How do I join a House?');
INSERT INTO public.ai_knowledge_base (title, content, category, source_type, source_url, priority, tags)
SELECT 'Current Cabinet and Co-Presidents', 'The current Co-Presidents of VSA at UC San Diego are April Pham and Havyn Nguyen. The full student leadership team includes executive officers, event chairs, cultural chairs, and program directors. You can view the complete current cabinet list, roles, and profiles on the [Cabinet page](/cabinet).', 'cabinet', 'public_page', '/cabinet', 95, array['cabinet', 'president', 'co-president', 'leadership', 'officers', 'board', 'april pham', 'havyn nguyen']
WHERE NOT EXISTS (SELECT 1 FROM public.ai_knowledge_base WHERE title = 'Current Cabinet and Co-Presidents');
