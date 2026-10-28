/**
 * Public-safe static fallback content for key areas of the site.
 * Used only when Supabase is temporarily unavailable — never as admin source of truth.
 *
 * Public-bundle warning: CRA compiles everything under src/ into the client bundle.
 * This file is readable by anyone who opens browser dev tools. Never add private,
 * admin-only, or sensitive data here. Authority: AGENTS.md § "Things to never do"
 * (don't expose private member data, emails, check-in codes, or admin notes publicly).
 *
 * Maintenance rule (#272): keep this copy evergreen. A fallback message must never
 * hardcode an academic year, a quarter, a calendar date, or an event/deadline it
 * cannot guarantee. When a year is genuinely needed — a past House year's published
 * standings — derive its label from src/lib/academicTerms.ts instead of typing digits.
 * Reviewed 2026-10-26.
 */

import { formatAcademicYear } from '../lib/academicTerms';
import { LEGACY_HOUSE_ARCHIVE } from '../data/legacyHouseArchive';

export const FALLBACK_LINKS = {
  instagram: 'https://www.instagram.com/vsaatucsd/',
  linktree: 'https://linktr.ee/vsaatucsd',
} as const;

// ── Events ──────────────────────────────────────────────────────────────────

export const FALLBACK_EVENTS = {
  title: 'Events temporarily unavailable',
  message:
    "Our live event list is having trouble loading. Check VSA's Instagram or Linktree for the latest event updates, and come back soon.",
  eventTypes: [
    'General Body Meetings (GBMs)',
    'Socials',
    'Cultural events',
    'Fundraisers',
    'Retreats',
    'House events',
    'Externals',
    'Banquet',
  ],
} as const;

// ── House ────────────────────────────────────────────────────────────────────

export interface FallbackHouseStanding {
  name: string;
  emoji: string;
  points: number;
  accentColor: string;
}

/**
 * Academic-year start of the House year whose published totals are mirrored below.
 * Uses the same start-year key as src/lib/academicTerms.ts, so the label is derived
 * rather than typed.
 */
export const FALLBACK_HOUSE_STANDINGS_YEAR_START = 2025;

/**
 * Published House standings for a completed House year, used when the live standings
 * query fails. The points are the House Chair's official public totals — the same
 * figures src/utils/housePublicPointOverrides.ts serves — and the accent colours are
 * the canonical house colours from src/constants/houses.ts.
 * src/config/publicFallbackContent.test.ts pins both against those sources so the
 * fallback can never drift into contradicting the live site.
 */
export const FALLBACK_HOUSE_STANDINGS: FallbackHouseStanding[] = [
  { name: 'Bowser', emoji: '🐢', points: 247, accentColor: '#f97316' },
  { name: 'Donkey Kong', emoji: '🦍', points: 215, accentColor: '#eab308' },
  { name: 'Toad', emoji: '🍄', points: 158, accentColor: '#ef4444' },
  { name: 'Boo', emoji: '👻', points: 125, accentColor: '#94a3b8' },
];

/**
 * The mirrored standings for the requested academic year, or null when that year
 * has no published snapshot (never invent a total for a year still in progress).
 */
export function getFallbackHouseStandings(
  academicYearStart: number | null | undefined
): FallbackHouseStanding[] | null {
  if (academicYearStart !== FALLBACK_HOUSE_STANDINGS_YEAR_START) return null;
  return FALLBACK_HOUSE_STANDINGS;
}

/** Academic-year label of the mirrored standings, derived from the shared utility. */
export function getFallbackHouseStandingsLabel(): string {
  return formatAcademicYear(FALLBACK_HOUSE_STANDINGS_YEAR_START);
}

/** Shown above the mirrored standings so nobody reads them as live results. */
export function getFallbackHouseStandingsNotice(): string {
  return `Showing the published totals from the ${getFallbackHouseStandingsLabel()} House year. Live House standings are temporarily unavailable.`;
}

export const FALLBACK_HOUSE_MESSAGE =
  'Live House standings are temporarily unavailable. Published standings from past House years are still available in the House archive.';

// ── House Archive ────────────────────────────────────────────────────────────

export interface FallbackLegacyYear {
  academicYear: string;
  theme: string;
  houses: string[];
  verified: boolean;
}

/**
 * House years for the archive fallback, derived from the canonical archive
 * (src/data/legacyHouseArchive.ts) instead of a second copy of the House history.
 */
export const FALLBACK_LEGACY_HOUSE_YEARS: FallbackLegacyYear[] = LEGACY_HOUSE_ARCHIVE.map(
  (entry) => ({
    academicYear: entry.academicYear,
    theme: entry.theme,
    houses: entry.houses,
    verified: entry.status !== 'unconfirmed',
  })
);

// ── Cabinet ──────────────────────────────────────────────────────────────────

export const FALLBACK_CABINET = {
  message:
    "Cabinet info is temporarily unavailable. Check VSA's Instagram or Linktree for the current cabinet.",
} as const;

// ── Gallery ──────────────────────────────────────────────────────────────────

export const FALLBACK_GALLERY = {
  message:
    "Gallery albums are temporarily unavailable. Check VSA's Instagram for recent photos.",
} as const;

// ── Get Involved ─────────────────────────────────────────────────────────────

export interface FallbackProgram {
  name: string;
  description: string;
  slug: string;
}

export const FALLBACK_GET_INVOLVED_PROGRAMS: FallbackProgram[] = [
  {
    name: 'House',
    description:
      'A year-long community competition inside VSA. Get sorted into a House, meet your crew, and earn points together throughout the year.',
    slug: 'house',
  },
  {
    name: 'Anh Chi Em (ACE)',
    description:
      'VSA’s Big/Little program: members are paired with an older sibling, an “Anh” or “Chị”, who shows them the ropes and helps them find their place in the org.',
    slug: 'ace',
  },
  {
    name: 'Intern Program',
    description:
      'A hands-on program for members who want to get involved in running VSA events and operations.',
    slug: 'intern-program',
  },
  {
    name: 'VCN',
    description:
      'Vietnamese Culture Night — VSA’s annual culture show, where students perform Vietnamese dance, theatre, and storytelling on stage and behind the scenes.',
    slug: 'vcn',
  },
  {
    name: 'WNC',
    description:
      "Wild N' Culture — VSA's annual intercollegiate comedy competition, inspired by Wild 'N Out and rooted in Vietnamese and Asian American culture.",
    slug: 'wild-n-culture',
  },
  {
    name: 'Externals',
    description:
      'Events hosted by other VSAs in the UVSA network that VSA at UCSD members can attend and compete in.',
    slug: 'uvsa-network',
  },
];

// ── Applications / Interest Forms ────────────────────────────────────────────

export const FALLBACK_APPLICATIONS = {
  message:
    'Applications are temporarily unavailable. Please check Instagram or Linktree for current forms.',
} as const;

// ── UVSA Network ─────────────────────────────────────────────────────────────

export const FALLBACK_UVSA_NETWORK = {
  message:
    'External event info is temporarily unavailable. Check official VSA channels for current ride forms and deadlines.',
  description:
    'UVSA (United Vietnamese Student Associations) connects Vietnamese student organizations across Southern California. VSA at UCSD participates in intercollegiate events like WNC, externals, and tournaments.',
} as const;

// ── VCN / WNC ────────────────────────────────────────────────────────────────

export const FALLBACK_VCN = {
  description:
    "Vietnamese Culture Night (VCN) is VSA at UCSD's annual culture show: a narrative stage production and dance performances that celebrate Vietnamese culture, built and performed by students.",
} as const;

export const FALLBACK_WNC = {
  description:
    "Wild N' Culture (WNC) is VSA at UCSD's annual intercollegiate comedy competition, inspired by Wild 'N Out and rooted in Vietnamese and Asian American culture. Schools face off in live improv-style games and roast battles.",
} as const;

// ── Points / Leaderboard ─────────────────────────────────────────────────────

export const FALLBACK_POINTS = {
  message:
    'Points lookup is temporarily unavailable while our live database is down. Check back later or contact VSA if you need help.',
} as const;

export const FALLBACK_LEADERBOARD = {
  message: 'Individual points lookup is temporarily unavailable.',
  houseMessage: FALLBACK_HOUSE_MESSAGE,
} as const;

// ── Feedback ─────────────────────────────────────────────────────────────────

export const FALLBACK_FEEDBACK = {
  message:
    'Feedback form may be unavailable right now. Please reach out through official VSA channels.',
} as const;

// ── Ask VSA ──────────────────────────────────────────────────────────────────

export const FALLBACK_ASK_VSA = {
  message:
    'Ask VSA is temporarily unavailable. Please check the website pages, Instagram, or Linktree.',
} as const;

// ── Cabinet Roles ────────────────────────────────────────────────────────────

export const FALLBACK_CABINET_ROLES = [
  {
    role_slug: 'president',
    role_name: 'President',
    board_group: 'Executive Board',
    short_description: 'The face and primary leader of the organization, responsible for guiding cabinet vision, overseeing all board members, and ensuring VSA meets its cultural, social, and academic goals.',
    responsibilities: [
      'Oversee and manage the entire Executive and General Board.',
      'Facilitate cabinet and general body meetings.',
      'Serve as the primary liaison to UCSD CSI and the university.',
      'Manage crisis resolution and high-level organizational strategy.'
    ],
    works_with: ['Entire Cabinet', 'UCSD CSI', 'UVSA', 'Alumni'],
    best_fit_for: ['Visionary leaders', 'Strong communicators', 'Experienced board members'],
    display_order: 1
  },
  {
    role_slug: 'ivp',
    role_name: 'Internal Vice President',
    board_group: 'Executive Board',
    short_description: 'The operational backbone of cabinet, focusing on internal member retention, the intern program, and supporting the President.',
    responsibilities: [
      'Manage the VSA Intern Program and guide new leaders.',
      'Oversee internal cabinet relations and resolve conflicts.',
      'Step in for the President when they are unavailable.',
      'Monitor general member retention and engagement.'
    ],
    works_with: ['President', 'Interns', 'Cabinet'],
    best_fit_for: ['Empathetic listeners', 'Mentors', 'Organizers'],
    display_order: 2
  },
  {
    role_slug: 'evp',
    role_name: 'External Vice President',
    board_group: 'Executive Board',
    short_description: 'The bridge between UCSD VSA and the broader UVSA Southern California network.',
    responsibilities: [
      'Represent UCSD at Intercollegiate Council (ICC) meetings.',
      'Coordinate rides and logistics for members attending external events.',
      'Communicate external opportunities to UCSD members.',
      'Maintain relationships with other university VSAs.'
    ],
    works_with: ['President', 'UVSA SoCal', 'External VSAs'],
    best_fit_for: ['Social butterflies', 'Networkers', 'Drivers/Logisticians'],
    aliases: ['Intercollegiate Council', 'ICC', 'External Vice President / ICC'],
    display_order: 3
  },
  {
    role_slug: 'treasurer',
    role_name: 'Treasurer',
    board_group: 'Executive Board',
    short_description: 'The financial controller responsible for budgeting, reimbursements, and funding.',
    responsibilities: [
      'Manage the VSA AS and off-campus bank accounts.',
      'Process reimbursements for cabinet purchases.',
      'Apply for AS funding for major events and VCN.',
      'Keep detailed ledgers of all income and expenses.'
    ],
    works_with: ['Fundraising Chair', 'President', 'Events Chair', 'VCN Directors'],
    best_fit_for: ['Organized detail-oriented people', 'Spreadsheet lovers'],
    display_order: 4
  },
  {
    role_slug: 'secretary',
    role_name: 'Secretary',
    board_group: 'Executive Board',
    short_description: 'The organizational anchor, managing points, attendance, newsletters, and records.',
    responsibilities: [
      'Take minutes during cabinet meetings.',
      'Track member attendance and update the points leaderboard.',
      'Write and send the VSA newsletter.',
      'Book rooms for GBMs and events.'
    ],
    works_with: ['President', 'Media Director', 'Events Chair'],
    best_fit_for: ['Highly organized individuals', 'Writers', 'Punctual people'],
    display_order: 5
  },
  {
    role_slug: 'vcn-director',
    role_name: 'VCN Director',
    board_group: 'Culture & External',
    short_description: 'The creative and operational lead for Vietnamese Culture Night, managing the entire production.',
    responsibilities: [
      'Write and direct the VCN script/play.',
      'Cast actors and coordinate acting rehearsals.',
      'Oversee the VCN Executive Producer and committee leads.',
      'Ensure the cultural integrity and vision of the show.'
    ],
    works_with: ['VCN Exec Producer', 'Cast', 'Dance Coordinators', 'Cabinet'],
    best_fit_for: ['Creative visionaries', 'Theater lovers', 'Strong managers'],
    aliases: ['VCN Director & Executive Producer', 'Vietnamese Culture Night Director', 'VCN Chair'],
    display_order: 6
  },
  {
    role_slug: 'vcn-exec-producer',
    role_name: 'VCN Executive Producer',
    board_group: 'Culture & External',
    short_description: 'The logistical counterpart to the Director, handling VCN funding, room bookings, and backstage operations.',
    responsibilities: [
      'Manage the VCN budget and AS funding applications.',
      'Book rehearsal spaces for cast and dance teams.',
      'Coordinate backstage logistics, props, and stage ninjas.',
      'Handle ticketing and front-of-house operations on show day.'
    ],
    works_with: ['VCN Director', 'Treasurer', 'Stage Managers', 'CSI'],
    best_fit_for: ['Organized problem-solvers', 'Logistics planners', 'Calm under pressure'],
    display_order: 7
  },
  {
    role_slug: 'events-chair',
    role_name: 'Events Chair',
    board_group: 'Programming & Member Experience',
    short_description: 'The primary planners of VSA\'s social calendar, creating spaces for members to bond.',
    responsibilities: [
      'Plan and lead logistics for larger social events and retreats.',
      'Coordinate with cabinet for event execution, including GBMs and socials.',
      'Plan and organize the annual winter retreat.',
      'Work with Media Chairs to promote VSA social events when relevant.'
    ],
    works_with: ['Secretary', 'Treasurer', 'PR Chair', 'Media Chairs'],
    best_fit_for: ['Outgoing planners', 'Creative hosts', 'Energetic speakers'],
    display_order: 8
  },
  {
    role_slug: 'ace-chair',
    role_name: 'ACE Chair',
    board_group: 'Programming & Member Experience',
    short_description: 'The leaders of the ACE (Anh Chị Em) family and mentorship program, fostering a supportive community for general members.',
    responsibilities: [
      'Coordinate Big/Little pairings and family assignments.',
      'Organize ACE-specific events, reveals, and family competitions.',
      'Support family heads and organize family bonding events.',
      'Foster a welcoming environment for new members.'
    ],
    works_with: ['IVP', 'General Members', 'Family Heads'],
    best_fit_for: ['Mentors', 'Community builders', 'Approachable individuals'],
    aliases: ['Anh Chi Em Chair', 'ACE (Anh Chi Em) Chair'],
    display_order: 9
  },
  {
    role_slug: 'media-director',
    role_name: 'Media Director',
    board_group: 'Media & Storytelling',
    short_description: 'The creative lead for VSA\'s brand, designing graphics, merch, and marketing materials.',
    responsibilities: [
      'Design graphics for Facebook, Instagram, and newsletters.',
      'Create VSA merchandise (shirts, stickers, etc.).',
      'Maintain the VSA brand identity and aesthetics.',
      'Manage the media team or interns.'
    ],
    works_with: ['PR Chair', 'Events Chair', 'Secretary'],
    best_fit_for: ['Artists', 'Designers', 'Visual communicators'],
    display_order: 10
  },
  {
    role_slug: 'pr-chair',
    role_name: 'Public Relations Chair',
    board_group: 'Media & Storytelling',
    short_description: 'A newer role focused on video storytelling, event recaps, trailers, TikToks, and public-facing event content.',
    responsibilities: [
      'Film and edit video content for VSA social media (TikTok, Reels).',
      'Create hype videos, event trailers, and recap videos.',
      'Manage social media engagement strategies.',
      'Work with Media to ensure consistent branding.'
    ],
    works_with: ['Media Director', 'Historian', 'Events Chair'],
    best_fit_for: ['Videographers', 'Social media savvy', 'Storytellers'],
    aliases: ['PR Chair', 'Public Relations / Media Chair'],
    display_order: 11
  },
  {
    role_slug: 'historian',
    role_name: 'Historian',
    board_group: 'Media & Storytelling',
    short_description: 'The documentarian of VSA, capturing memories through photography.',
    responsibilities: [
      'Photograph all VSA events, GBMs, and socials.',
      'Edit and upload photo albums in a timely manner.',
      'Manage the end-of-year banquet slideshow/video.',
      'Maintain the VSA camera equipment and photo archives.'
    ],
    works_with: ['PR Chair', 'Media Director', 'Events Chair'],
    best_fit_for: ['Photographers', 'Observers', 'Memory keepers'],
    display_order: 12
  },
  {
    role_slug: 'fundraising-chair',
    role_name: 'Fundraising Chair',
    board_group: 'Finance & Operations',
    short_description: 'The driving force behind VSA\'s independent revenue through food sales, sponsorships, and events.',
    responsibilities: [
      'Plan and execute food fundraisers on Library Walk.',
      'Organize restaurant fundraisers (e.g., boba/food nights).',
      'Seek out sponsorships or grants for VSA.',
      'Work with Treasurer to manage fundraiser profits.'
    ],
    works_with: ['Treasurer', 'Events Chair'],
    best_fit_for: ['Hustlers', 'Foodies', 'Sales-oriented people'],
    display_order: 13
  },
  {
    role_slug: 'cpc',
    role_name: 'Cultural Philanthropy Chair',
    board_group: 'Culture & External',
    short_description: 'The advocate for community service, cultural awareness, and philanthropic outreach within VSA.',
    responsibilities: [
      'Plan volunteering events and community service opportunities for members.',
      'Promote cultural awareness and historical education within the general body.',
      'Connect with local San Diego Vietnamese cultural organizations, community groups, and charters to build exposure, outreach, and partnership opportunities for VSA.',
      'Organize fundraising campaigns and events for philanthropic causes.'
    ],
    works_with: ['CRC', 'Fundraising Chair', 'EVP'],
    best_fit_for: ['Volunteers', 'Advocates', 'Community-minded people'],
    aliases: ['Culture & Philanthropy Chair', 'CPC'],
    display_order: 14
  },
  {
    role_slug: 'crc',
    role_name: 'Community Relations Chair',
    board_group: 'Culture & External',
    short_description: 'The primary coordinator for the House System and cabinet liaison for San Diego community involvement.',
    responsibilities: [
      'Serves as the main cabinet point person for the House System, coordinating house engagement, communication, and house-related planning across VSA.',
      'Support House Heads and Parents in planning house events, tracking standings, and fostering house spirit.',
      'Connect VSA members with external San Diego community events and local cultural activities.',
      'Coordinate inter-house competitions and joint activities to maintain general member engagement.'
    ],
    works_with: ['CPC', 'EVP', 'President', 'House Heads', 'ACE Chair'],
    best_fit_for: ['Organizers', 'Community builders', 'House system enthusiasts'],
    display_order: 15
  }
];
