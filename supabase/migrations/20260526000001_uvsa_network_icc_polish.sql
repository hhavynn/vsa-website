-- Migration: UVSA Network ICC feedback polish
-- Reorders schools so UCSD appears first (sort_order = 1) as the home school.
-- Also updates the WNC event description to reflect its home-hosted role.
-- Standardizes UCSD vsa_name to "VSA at UCSD" (official wording).

-- 1. Reorder schools: UCSD first, then by ICC-preferred emphasis order
update public.uvsa_schools set sort_order = 1  where slug = 'ucsd';
update public.uvsa_schools set sort_order = 2  where slug = 'ucsb';
update public.uvsa_schools set sort_order = 3  where slug = 'uci';
update public.uvsa_schools set sort_order = 4  where slug = 'ucr';
update public.uvsa_schools set sort_order = 5  where slug = 'usc';
update public.uvsa_schools set sort_order = 6  where slug = 'csuf';
update public.uvsa_schools set sort_order = 7  where slug = 'sdsu';
update public.uvsa_schools set sort_order = 8  where slug = 'csulb';
update public.uvsa_schools set sort_order = 9  where slug = 'cpp';
update public.uvsa_schools set sort_order = 10 where slug = 'csusm';
update public.uvsa_schools set sort_order = 11 where slug = 'chapman';
update public.uvsa_schools set sort_order = 12 where slug = 'csun';
update public.uvsa_schools set sort_order = 13 where slug = 'cpslo';

-- 2. Strengthen Wild N' Culture description to reflect its home-hosted role
update public.external_events
set description = 'VSA at UCSD''s hosted external brings schools across SoCal together for competition, culture, performance, and community. It is one of our biggest chances to represent VSA at UCSD while welcoming the wider UVSA network to our campus.'
where title ilike '%Wild N%Culture%'
  and uvsa_school_id = (select id from public.uvsa_schools where slug = 'ucsd');

-- 3. Standardize UCSD school vsa_name to official wording
update public.uvsa_schools
set vsa_name = 'VSA at UCSD'
where slug = 'ucsd';
