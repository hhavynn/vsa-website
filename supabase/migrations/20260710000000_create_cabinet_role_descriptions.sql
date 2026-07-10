-- Create the cabinet_role_descriptions table
CREATE TABLE IF NOT EXISTS public.cabinet_role_descriptions (
  role_slug text PRIMARY KEY,
  role_name text NOT NULL,
  board_group text NOT NULL,
  short_description text NOT NULL,
  responsibilities text[] NOT NULL DEFAULT '{}',
  works_with text[] NOT NULL DEFAULT '{}',
  best_fit_for text[] NOT NULL DEFAULT '{}',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cabinet_role_descriptions ENABLE ROW LEVEL SECURITY;

-- Policies for cabinet_role_descriptions
CREATE POLICY "Anyone can view cabinet role descriptions"
  ON public.cabinet_role_descriptions FOR SELECT USING (true);

CREATE POLICY "Admins can insert cabinet role descriptions"
  ON public.cabinet_role_descriptions FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can update cabinet role descriptions"
  ON public.cabinet_role_descriptions FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can delete cabinet role descriptions"
  ON public.cabinet_role_descriptions FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Insert initial data
INSERT INTO public.cabinet_role_descriptions 
  (role_slug, role_name, board_group, short_description, responsibilities, works_with, best_fit_for, display_order)
VALUES
  ('president', 'President', 'Executive Board', 'The face and primary leader of the organization, responsible for guiding cabinet vision, overseeing all board members, and ensuring VSA meets its cultural, social, and academic goals.', ARRAY['Oversee and manage the entire Executive and General Board.', 'Facilitate weekly cabinet and general body meetings.', 'Serve as the primary liaison to UCSD CSI and the university.', 'Manage crisis resolution and high-level organizational strategy.'], ARRAY['Entire Cabinet', 'UCSD CSI', 'UVSA', 'Alumni'], ARRAY['Visionary leaders', 'Strong communicators', 'Experienced board members'], 1),
  ('ivp', 'Internal Vice President', 'Executive Board', 'The operational backbone of cabinet, focusing on internal member retention, the intern program, and supporting the President.', ARRAY['Manage the VSA Intern Program and guide new leaders.', 'Oversee internal cabinet relations and resolve conflicts.', 'Step in for the President when they are unavailable.', 'Monitor general member retention and engagement.'], ARRAY['President', 'Interns', 'Cabinet'], ARRAY['Empathetic listeners', 'Mentors', 'Organizers'], 2),
  ('evp', 'External Vice President', 'Executive Board', 'The bridge between UCSD VSA and the broader UVSA Southern California network.', ARRAY['Represent UCSD at monthly Intercollegiate Council (ICC) meetings.', 'Coordinate rides and logistics for members attending external events.', 'Communicate external opportunities to UCSD members.', 'Maintain relationships with other university VSAs.'], ARRAY['President', 'UVSA SoCal', 'External VSAs'], ARRAY['Social butterflies', 'Networkers', 'Drivers/Logisticians'], 3),
  ('treasurer', 'Treasurer', 'Executive Board', 'The financial controller responsible for budgeting, reimbursements, and funding.', ARRAY['Manage the VSA AS and off-campus bank accounts.', 'Process reimbursements for cabinet purchases.', 'Apply for AS funding for major events and VCN.', 'Keep detailed ledgers of all income and expenses.'], ARRAY['Fundraising Chair', 'President', 'Events Chair', 'VCN Directors'], ARRAY['Organized detail-oriented people', 'Spreadsheet lovers'], 4),
  ('secretary', 'Secretary', 'Executive Board', 'The organizational anchor, managing points, attendance, newsletters, and records.', ARRAY['Take minutes during cabinet meetings.', 'Track member attendance and update the points leaderboard.', 'Write and send the weekly VSA newsletter.', 'Book rooms for GBMs and events.'], ARRAY['President', 'Media Director', 'Events Chair'], ARRAY['Highly organized individuals', 'Writers', 'Punctual people'], 5),
  ('vcn-director', 'VCN Director', 'Culture & External', 'The creative and operational lead for Vietnamese Culture Night, managing the entire production.', ARRAY['Write and direct the VCN script/play.', 'Cast actors and coordinate acting rehearsals.', 'Oversee the VCN Executive Producer and committee leads.', 'Ensure the cultural integrity and vision of the show.'], ARRAY['VCN Exec Producer', 'Cast', 'Dance Coordinators', 'Cabinet'], ARRAY['Creative visionaries', 'Theater lovers', 'Strong managers'], 6),
  ('vcn-exec-producer', 'VCN Executive Producer', 'Culture & External', 'The logistical counterpart to the Director, handling VCN funding, room bookings, and backstage operations.', ARRAY['Manage the VCN budget and AS funding applications.', 'Book rehearsal spaces for cast and dance teams.', 'Coordinate backstage logistics, props, and stage ninjas.', 'Handle ticketing and front-of-house operations on show day.'], ARRAY['VCN Director', 'Treasurer', 'Stage Managers', 'CSI'], ARRAY['Organized problem-solvers', 'Logistics planners', 'Calm under pressure'], 7),
  ('events-chair', 'Events Chair', 'Programming & Member Experience', 'The primary planners of VSA''s social calendar, creating spaces for members to bond.', ARRAY['Plan and lead logistics for larger social events and retreats.', 'Coordinate with cabinet for event execution, including GBMs and socials.', 'Plan and organize the annual Winter Retreat.', 'Work with Media Chairs to promote VSA social events when relevant.'], ARRAY['Secretary', 'Treasurer', 'PR Chair', 'Media Chairs'], ARRAY['Outgoing planners', 'Creative hosts', 'Energetic speakers'], 8),
  ('ace-chair', 'ACE Chair', 'Programming & Member Experience', 'The leaders of the ACE (Anh Chị Em) family and mentorship program, fostering a supportive community for general members.', ARRAY['Coordinate Big/Little pairings and family assignments.', 'Organize ACE-specific events, reveals, and family competitions.', 'Support family heads and organize family bonding events.', 'Foster a welcoming environment for new members.'], ARRAY['IVP', 'General Members', 'Family Heads'], ARRAY['Mentors', 'Community builders', 'Approachable individuals'], 9),
  ('media-director', 'Media Director', 'Media & Storytelling', 'The creative lead for VSA''s brand, designing graphics, merch, and marketing materials.', ARRAY['Design graphics for Facebook, Instagram, and newsletters.', 'Create VSA merchandise (shirts, stickers, etc.).', 'Maintain the VSA brand identity and aesthetics.', 'Manage the media team or interns.'], ARRAY['PR Chair', 'Events Chair', 'Secretary'], ARRAY['Artists', 'Designers', 'Visual communicators'], 10),
  ('pr-chair', 'Public Relations Chair', 'Media & Storytelling', 'A newer role focused on video storytelling, event recaps, trailers, TikToks, and public-facing event content.', ARRAY['Film and edit video content for VSA social media (TikTok, Reels).', 'Create hype videos, event trailers, and recap videos.', 'Manage social media engagement strategies.', 'Work with Media to ensure consistent branding.'], ARRAY['Media Director', 'Historian', 'Events Chair'], ARRAY['Videographers', 'Social media savvy', 'Storytellers'], 11),
  ('historian', 'Historian', 'Media & Storytelling', 'The documentarian of VSA, capturing memories through photography.', ARRAY['Photograph all VSA events, GBMs, and socials.', 'Edit and upload photo albums in a timely manner.', 'Manage the end-of-year banquet slideshow/video.', 'Maintain the VSA camera equipment and photo archives.'], ARRAY['PR Chair', 'Media Director', 'Events Chair'], ARRAY['Photographers', 'Observers', 'Memory keepers'], 12),
  ('fundraising-chair', 'Fundraising Chair', 'Finance & Operations', 'The driving force behind VSA''s independent revenue through food sales, sponsorships, and events.', ARRAY['Plan and execute food fundraisers on Library Walk.', 'Organize restaurant fundraisers (e.g., boba/food nights).', 'Seek out sponsorships or grants for VSA.', 'Work with Treasurer to manage fundraiser profits.'], ARRAY['Treasurer', 'Events Chair'], ARRAY['Hustlers', 'Foodies', 'Sales-oriented people'], 13),
  ('cpc', 'Cultural Philanthropy Chair', 'Culture & External', 'The advocate for community service, cultural awareness, and philanthropic outreach within VSA.', ARRAY['Plan volunteering events and community service opportunities for members.', 'Promote cultural awareness and historical education within the general body.', 'Connect with local San Diego Vietnamese cultural organizations, community groups, and charters to build exposure, outreach, and partnership opportunities for VSA.', 'Organize fundraising campaigns and events for philanthropic causes.'], ARRAY['CRC', 'Fundraising Chair', 'EVP'], ARRAY['Volunteers', 'Advocates', 'Community-minded people'], 14),
  ('crc', 'Community Relations Chair', 'Culture & External', 'The primary coordinator for the House System and cabinet liaison for San Diego community involvement.', ARRAY['Serves as the main cabinet point person for the House System, coordinating house engagement, communication, and house-related planning across VSA.', 'Support House Heads and Parents in planning house events, tracking standings, and fostering house spirit.', 'Connect VSA members with external San Diego community events and local cultural activities.', 'Coordinate inter-house competitions and joint activities to maintain general member engagement.'], ARRAY['CPC', 'EVP', 'President', 'House Heads', 'ACE Chair'], ARRAY['Organizers', 'Community builders', 'House system enthusiasts'], 15);
