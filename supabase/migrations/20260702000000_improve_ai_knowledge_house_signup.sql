-- Migration to add 'How do I join a House?' grounded knowledge snippet to Ask VSA.

INSERT INTO public.ai_knowledge_base (title, content, category, source_type, source_url, priority, tags)
SELECT 'How do I join a House?', 'To join the House System, watch for sign-up or application announcements at the start of the academic year (usually during Fall quarter). You can sign up through the /house page, check open forms on the homepage, or follow official VSA channels like @vsaatucsd on Instagram for updates.', 'house', 'faq', '/house', 95, array['house', 'join house', 'house sign-up', 'sorting', 'applications']
WHERE NOT EXISTS (SELECT 1 FROM public.ai_knowledge_base WHERE title = 'How do I join a House?');
INSERT INTO public.ai_knowledge_base (title, content, category, source_type, source_url, priority, tags)
SELECT 'Current Cabinet and Co-Presidents', 'The current Co-Presidents of VSA at UC San Diego are April Pham and Havyn Nguyen. The full student leadership team includes executive officers, event chairs, cultural chairs, and program directors. You can view the complete current cabinet list, roles, and profiles on the [Cabinet page](/cabinet).', 'cabinet', 'public_page', '/cabinet', 95, array['cabinet', 'president', 'co-president', 'leadership', 'officers', 'board', 'april pham', 'havyn nguyen']
WHERE NOT EXISTS (SELECT 1 FROM public.ai_knowledge_base WHERE title = 'Current Cabinet and Co-Presidents');
