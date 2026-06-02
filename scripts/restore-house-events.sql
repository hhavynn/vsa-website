-- =============================================================================
-- HOUSE EVENTS RESTORATION SQL
-- Generated from image filenames in public/images/house-events/
-- =============================================================================
--
-- HOW TO USE:
--   PART A  — Run immediately. House is confirmed from title puns.
--             Still need to fix every  -- TODO: fix date  before running.
--
--   PART B  — DO NOT run yet. Each event has a house_profile_id placeholder
--             comment. Replace PLACEHOLDER_HOUSE_ID with the correct UUID,
--             set the date, then move the INSERT into PART A and run.
--             house_profile_id is NOT NULL — these won't insert until filled.
--
-- IMPORTANT: Fix dates before running. Placeholder dates (2025-01-01 etc.)
--            are just syntactically valid — they are NOT the real event dates.
--            is_published = false on all events so nothing goes live until you flip it.
--
-- ============================================================
-- HOUSE PROFILE ID REFERENCE
-- ============================================================
-- 2025-2026 (Super Mario Era)
--   Boo          449e9b37-cbe3-4470-95ec-55ae7218ddd9
--   Bowser       a4a6542d-a7c8-422e-a5c1-c4581b614f60
--   Donkey Kong  40205755-ccda-488a-a073-4b8d83dc02ab
--   Toad         1ce698b2-20f4-48cd-9167-91eeda1a94e2
--
-- 2024-2025 (Sanrio Era)
--   Badtz-maru   6abc6328-a4b6-426e-88cb-055843f21891
--   Keroppi      bceaf3de-6bf6-4d60-b59a-a102c00e5a9f
--   Kuromi       2a37280e-1cd2-40bf-96eb-5908e4ff6622
-- ============================================================


-- =============================================================================
-- PART A: READY TO RUN (house confirmed from title puns)
-- Fix dates, then run these.
-- =============================================================================

-- ---- Bowser (2025-2026) ----

-- EVENT: Bowser Wigs Out
-- Note: this image was present in a prior DB state and then removed — include only if intentional
-- TODO: fix date
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'a4a6542d-a7c8-422e-a5c1-c4581b614f60', -- Bowser
  2025, 2026,
  'Bowser Wigs Out',
  'bowser-wigs-out',
  '2025-01-01', -- TODO: fix date
  '/images/house-events/fb733949-bowser-wigs-out.webp',
  '/images/house-events/fb733949-bowser-wigs-out_thumb.webp',
  false
);

-- EVENT: Bowser Takes on Studying
-- TODO: fix date
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'a4a6542d-a7c8-422e-a5c1-c4581b614f60', -- Bowser
  2025, 2026,
  'Bowser Takes on Studying',
  'bowser-takes-on-studying',
  '2025-01-01', -- TODO: fix date
  '/images/house-events/72820b73-bowser-takes-on-studying.webp',
  '/images/house-events/72820b73-bowser-takes-on-studying_thumb.webp',
  false
);

-- EVENT: Inferno Bash
-- House: Bowser assumed — fire/inferno theme. Change house_profile_id if wrong.
-- TODO: fix date
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'a4a6542d-a7c8-422e-a5c1-c4581b614f60', -- Bowser (assumed — correct if wrong)
  2025, 2026,
  'Inferno Bash',
  'inferno-bash',
  '2025-01-01', -- TODO: fix date
  '/images/house-events/55807130-inferno-bash.webp',
  '/images/house-events/55807130-inferno-bash_thumb.webp',
  false
);

-- ---- Donkey Kong (2025-2026) ----

-- EVENT: Donkey Kong-raoke
-- TODO: fix date
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  '40205755-ccda-488a-a073-4b8d83dc02ab', -- Donkey Kong
  2025, 2026,
  'Donkey Kong-raoke',
  'donkey-kong-raoke',
  '2025-01-01', -- TODO: fix date
  '/images/house-events/a380be8d-donkey-kong-raoke.webp',
  '/images/house-events/a380be8d-donkey-kong-raoke_thumb.webp',
  false
);

-- ---- Boo (2025-2026) ----

-- EVENT: Boo-ffet Housegiving Potluck
-- TODO: fix date
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  '449e9b37-cbe3-4470-95ec-55ae7218ddd9', -- Boo
  2025, 2026,
  'Boo-ffet Housegiving Potluck',
  'boo-ffet-housegiving-potluck',
  '2025-11-20', -- TODO: fix date (likely Thanksgiving week)
  '/images/house-events/140dbcd5-boo-ffet-housegiving-potluck.webp',
  '/images/house-events/140dbcd5-boo-ffet-housegiving-potluck_thumb.webp',
  false
);

-- EVENT: Hitting the Boo-ks
-- TODO: fix date
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  '449e9b37-cbe3-4470-95ec-55ae7218ddd9', -- Boo
  2025, 2026,
  'Hitting the Boo-ks',
  'hitting-the-boo-ks',
  '2025-01-01', -- TODO: fix date
  '/images/house-events/34c22bff-hitting-the-boo-ks.webp',
  '/images/house-events/34c22bff-hitting-the-boo-ks_thumb.webp',
  false
);

-- EVENT: Boo House Takes Over OC
-- TODO: fix date
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  '449e9b37-cbe3-4470-95ec-55ae7218ddd9', -- Boo
  2025, 2026,
  'Boo House Takes Over OC',
  'boo-house-takes-over-oc',
  '2025-01-01', -- TODO: fix date
  '/images/house-events/525910b8-boo-house-takes-over-oc.webp',
  '/images/house-events/525910b8-boo-house-takes-over-oc_thumb.webp',
  false
);

-- ---- Badtz-maru (2024-2025) ----

-- EVENT: Badtzmaru Dayger
-- TODO: fix date
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  '6abc6328-a4b6-426e-88cb-055843f21891', -- Badtz-maru
  2024, 2025,
  'Badtzmaru Dayger',
  'badtzmaru-dayger',
  '2024-01-01', -- TODO: fix date
  '/images/house-events/79b21e56-badtzmaru-dayger.webp',
  '/images/house-events/79b21e56-badtzmaru-dayger_thumb.webp',
  false
);

-- EVENT: Baddie Badtz-Maru Karaoke
-- TODO: fix date
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  '6abc6328-a4b6-426e-88cb-055843f21891', -- Badtz-maru
  2024, 2025,
  'Baddie Badtz-Maru Karaoke',
  'baddie-badtz-maru-karaoke',
  '2024-01-01', -- TODO: fix date
  '/images/house-events/ce542eab-baddie-badtz-maru-karaoke.webp',
  '/images/house-events/ce542eab-baddie-badtz-maru-karaoke_thumb.webp',
  false
);


-- =============================================================================
-- PART B: NEEDS HOUSE ASSIGNED FIRST (all commented out — safe to run whole file)
-- For each event below:
--   1. Replace PLACEHOLDER_HOUSE_ID with the correct UUID from the reference table
--   2. Fix the date
--   3. Uncomment the INSERT block
-- =============================================================================

-- ---- BxB Field Day (collab — year and houses unknown) ----

-- EVENT: BxB Field Day
-- TODO: (1) replace PLACEHOLDER_HOUSE_ID with the primary house
--       (2) fix academic_year_start/end
--       (3) fix date
--       (4) after inserting, add rows to house_event_houses (template at bottom)
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house is primary?
  2025, 2026,             -- TODO: confirm year
  'BxB Field Day',
  'bxb-field-day',
  '2025-01-01',           -- TODO: fix date
  '/images/house-events/00906a4c-bxb-field-day.webp',
  '/images/house-events/00906a4c-bxb-field-day_thumb.webp',
  false
);
*/

-- ---- Generic unknowns — year most likely 2025-2026 ----

-- EVENT: Thanksgiving Dinner Party
-- TODO: replace PLACEHOLDER_HOUSE_ID, fix date (likely late Nov)
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house?
  2025, 2026,
  'Thanksgiving Dinner Party',
  'thanksgiving-dinner-party',
  '2025-11-20',           -- TODO: fix date
  '/images/house-events/8152040d-thanksgiving-dinner-party.webp',
  '/images/house-events/8152040d-thanksgiving-dinner-party_thumb.webp',
  false
);
*/

-- EVENT: Valentine's Mixer
-- TODO: replace PLACEHOLDER_HOUSE_ID, fix date (likely Feb)
-- Note: if this was Feb 2025, use academic_year_start=2024
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house?
  2025, 2026,
  'Valentine''s Mixer',
  'valentine-s-mixer',
  '2026-02-14',           -- TODO: fix date
  '/images/house-events/7dabcfe4-valentine-s-mixer.webp',
  '/images/house-events/7dabcfe4-valentine-s-mixer_thumb.webp',
  false
);
*/

-- EVENT: Valentine's Party
-- TODO: replace PLACEHOLDER_HOUSE_ID, fix date
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house?
  2025, 2026,             -- TODO: confirm year
  'Valentine''s Party',
  'valentine-s-party',
  '2026-02-14',           -- TODO: fix date
  '/images/house-events/a1d40df3-valentine-s-party.webp',
  '/images/house-events/a1d40df3-valentine-s-party_thumb.webp',
  false
);
*/

-- EVENT: President's Day BBQ
-- TODO: replace PLACEHOLDER_HOUSE_ID, fix date (Presidents Day weekend)
-- Note: if this was Feb 2025, use academic_year_start=2024
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house?
  2025, 2026,
  'President''s Day BBQ',
  'president-s-day-bbq',
  '2026-02-16',           -- TODO: fix date
  '/images/house-events/9498ed4e-president-s-day-bbq.webp',
  '/images/house-events/9498ed4e-president-s-day-bbq_thumb.webp',
  false
);
*/

-- EVENT: Mocktail Night
-- TODO: replace PLACEHOLDER_HOUSE_ID, fix date
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house?
  2025, 2026,
  'Mocktail Night',
  'mocktail-night',
  '2025-01-01',           -- TODO: fix date
  '/images/house-events/82cec7cb-mocktail-night.webp',
  '/images/house-events/82cec7cb-mocktail-night_thumb.webp',
  false
);
*/

-- EVENT: Karaoke Night
-- TODO: replace PLACEHOLDER_HOUSE_ID, fix date
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house?
  2025, 2026,
  'Karaoke Night',
  'karaoke-night',
  '2025-01-01',           -- TODO: fix date
  '/images/house-events/505b637c-karaoke-night.webp',
  '/images/house-events/505b637c-karaoke-night_thumb.webp',
  false
);
*/

-- EVENT: Pho Night
-- TODO: replace PLACEHOLDER_HOUSE_ID, fix date
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house?
  2025, 2026,
  'Pho Night',
  'pho-night',
  '2025-01-01',           -- TODO: fix date
  '/images/house-events/e76d9f69-pho-night.webp',
  '/images/house-events/e76d9f69-pho-night_thumb.webp',
  false
);
*/

-- EVENT: Grill N Chill
-- TODO: replace PLACEHOLDER_HOUSE_ID, fix date
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house?
  2025, 2026,
  'Grill N Chill',
  'grill-n-chill',
  '2025-01-01',           -- TODO: fix date
  '/images/house-events/e8392f2d-grill-n-chill.webp',
  '/images/house-events/e8392f2d-grill-n-chill_thumb.webp',
  false
);
*/

-- EVENT: Burgers and Brushes
-- TODO: replace PLACEHOLDER_HOUSE_ID, fix date
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house?
  2025, 2026,
  'Burgers and Brushes',
  'burgers-and-brushes',
  '2025-01-01',           -- TODO: fix date
  '/images/house-events/292fdf95-burgers-and-brushes.webp',
  '/images/house-events/292fdf95-burgers-and-brushes_thumb.webp',
  false
);
*/

-- EVENT: Annie's Canyon Hike
-- TODO: replace PLACEHOLDER_HOUSE_ID, fix date
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house?
  2025, 2026,
  'Annie''s Canyon Hike',
  'annie-s-canyon-hike',
  '2025-01-01',           -- TODO: fix date
  '/images/house-events/9f314ced-annie-s-canyon-hike.webp',
  '/images/house-events/9f314ced-annie-s-canyon-hike_thumb.webp',
  false
);
*/

-- EVENT: Dressed for the Wrong Party
-- TODO: replace PLACEHOLDER_HOUSE_ID, fix date
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house?
  2025, 2026,
  'Dressed for the Wrong Party',
  'dressed-for-the-wrong-party',
  '2025-01-01',           -- TODO: fix date
  '/images/house-events/93c3d066-dressed-for-the-wrong-party.webp',
  '/images/house-events/93c3d066-dressed-for-the-wrong-party_thumb.webp',
  false
);
*/

-- EVENT: Gone Wild
-- TODO: replace PLACEHOLDER_HOUSE_ID, fix date
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house?
  2025, 2026,
  'Gone Wild',
  'gone-wild',
  '2025-01-01',           -- TODO: fix date
  '/images/house-events/db2cf7db-gone-wild.webp',
  '/images/house-events/db2cf7db-gone-wild_thumb.webp',
  false
);
*/

-- EVENT: Party Like It's 2016
-- TODO: replace PLACEHOLDER_HOUSE_ID, fix date
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house?
  2025, 2026,
  'Party Like It''s 2016',
  'party-like-it-s-2016',
  '2025-01-01',           -- TODO: fix date
  '/images/house-events/02406030-party-like-it-s-2016.webp',
  '/images/house-events/02406030-party-like-it-s-2016_thumb.webp',
  false
);
*/

-- ---- End-of-year beach events ----

-- EVENT: Beach Bash
-- TODO: replace PLACEHOLDER_HOUSE_ID, fix date (likely spring)
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house?
  2025, 2026,
  'Beach Bash',
  'beach-bash',
  '2026-05-01',           -- TODO: fix date (spring?)
  '/images/house-events/9958a54d-beach-bash.webp',
  '/images/house-events/9958a54d-beach-bash_thumb.webp',
  false
);
*/

-- EVENT: Backyard Beach Bash
-- TODO: replace PLACEHOLDER_HOUSE_ID, fix date (likely spring)
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house?
  2025, 2026,
  'Backyard Beach Bash',
  'backyard-beach-bash',
  '2026-05-01',           -- TODO: fix date (spring?)
  '/images/house-events/a3dfd9ab-backyard-beach-bash.webp',
  '/images/house-events/a3dfd9ab-backyard-beach-bash_thumb.webp',
  false
);
*/

-- EVENT: Sunset Send-Off Beach Bash
-- "Send-Off" = likely end-of-year (May/June)
-- TODO: replace PLACEHOLDER_HOUSE_ID, fix date
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house?
  2025, 2026,
  'Sunset Send-Off Beach Bash',
  'sunset-send-off-beach-bash',
  '2026-05-01',           -- TODO: fix date (likely May/June)
  '/images/house-events/55296894-sunset-send-off-beach-bash.webp',
  '/images/house-events/55296894-sunset-send-off-beach-bash_thumb.webp',
  false
);
*/

-- ---- Potluck-style events ----

-- EVENT: Housegiving Potluck
-- Different image from Boo's "Boo-ffet Housegiving Potluck" — belongs to a different house
-- TODO: replace PLACEHOLDER_HOUSE_ID, fix date (likely Thanksgiving week)
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house? (not Boo)
  2025, 2026,
  'Housegiving Potluck',
  'housegiving-potluck',
  '2025-11-20',           -- TODO: fix date
  '/images/house-events/8bc93110-housegiving-potluck.webp',
  '/images/house-events/8bc93110-housegiving-potluck_thumb.webp',
  false
);
*/

-- EVENT: Potluck and Friends
-- TODO: replace PLACEHOLDER_HOUSE_ID, fix date
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house?
  2025, 2026,
  'Potluck and Friends',
  'potluck-and-friends',
  '2025-01-01',           -- TODO: fix date
  '/images/house-events/bf7405de-potluck-and-friends.webp',
  '/images/house-events/bf7405de-potluck-and-friends_thumb.webp',
  false
);
*/

-- ---- Pool parties × 3 ----
-- These 3 pool parties likely belong to one house each.
-- If they are from 2024-2025 (3 Sanrio houses): assign one to each of
--   Badtz-maru (6abc6328), Keroppi (bceaf3de), Kuromi (2a37280e).
-- If 2025-2026, assign to 3 of the 4 Mario houses.
-- TODO for each: replace PLACEHOLDER_HOUSE_ID, fix year, fix date

-- EVENT: Pool Party (1 of 3) — image: 9142ffdd-pool-party.webp
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house?
  2025, 2026,             -- TODO: correct year
  'Pool Party',
  'pool-party',
  '2025-05-01',           -- TODO: fix date (spring)
  '/images/house-events/9142ffdd-pool-party.webp',
  '/images/house-events/9142ffdd-pool-party_thumb.webp',
  false
);
*/

-- EVENT: Pool Party (2 of 3) — image: efcd8d34-pool-party.webp
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house?
  2025, 2026,             -- TODO: correct year
  'Pool Party',
  'pool-party',
  '2025-05-01',           -- TODO: fix date
  '/images/house-events/efcd8d34-pool-party.webp',
  '/images/house-events/efcd8d34-pool-party_thumb.webp',
  false
);
*/

-- EVENT: Pool Party (3 of 3) — image: f25ce80b-pool-party.webp
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house?
  2025, 2026,             -- TODO: correct year
  'Pool Party',
  'pool-party',
  '2025-05-01',           -- TODO: fix date
  '/images/house-events/f25ce80b-pool-party.webp',
  '/images/house-events/f25ce80b-pool-party_thumb.webp',
  false
);
*/

-- ---- Historical (was removed from prior DB state) ----

-- EVENT: House-giving Potluck (historical) — image: fcfd7e5f-house-giving-potluck.webp
-- Uncomment only if you want this re-added.
/*
INSERT INTO house_events (house_profile_id, academic_year_start, academic_year_end, title, slug, event_date, image_url, image_thumbnail_url, is_published)
VALUES (
  'PLACEHOLDER_HOUSE_ID', -- TODO: which house?
  2025, 2026,
  'House-giving Potluck',
  'house-giving-potluck',
  '2025-11-20',
  '/images/house-events/fcfd7e5f-house-giving-potluck.webp',
  '/images/house-events/fcfd7e5f-house-giving-potluck_thumb.webp',
  false
);
*/


-- =============================================================================
-- COLLAB: house_event_houses associations
-- After inserting collab events above, run this to link them to multiple houses.
-- Replace the slug/year filter and the house UUID array with real values.
-- =============================================================================

-- BxB Field Day collab:
/*
INSERT INTO house_event_houses (house_event_id, house_page_asset_id)
SELECT he.id, unnest(ARRAY[
  'HOUSE_UUID_1', -- e.g. '449e9b37-cbe3-4470-95ec-55ae7218ddd9' for Boo
  'HOUSE_UUID_2'  -- e.g. 'a4a6542d-a7c8-422e-a5c1-c4581b614f60' for Bowser
]::uuid[])
FROM house_events he
WHERE he.slug = 'bxb-field-day'
  AND he.academic_year_start = 2025
LIMIT 1;
*/

-- =============================================================================
-- SUMMARY
-- =============================================================================
-- PART A (ready to run after fixing dates):
--   Bowser (2025-2026):     Bowser Wigs Out, Bowser Takes on Studying, Inferno Bash
--   Donkey Kong (2025-2026): Donkey Kong-raoke
--   Boo (2025-2026):        Boo-ffet Housegiving Potluck, Hitting the Boo-ks, Boo House Takes Over OC
--   Badtz-maru (2024-2025): Badtzmaru Dayger, Baddie Badtz-Maru Karaoke
--   Total: 9 events
--
-- PART B (needs house_profile_id filled in):
--   22 events still need house assignment + dates
--   See PLACEHOLDER_HOUSE_ID comments throughout
-- =============================================================================
