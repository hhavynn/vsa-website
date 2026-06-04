/**
 * Public-safe static fallback content for key areas of the site.
 * Used only when Supabase is temporarily unavailable — never as admin source of truth.
 */

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

// ── House — 2025-2026 ────────────────────────────────────────────────────────

export interface FallbackHouseStanding {
  name: string;
  emoji: string;
  points: number;
  accentColor: string;
}

export const FALLBACK_HOUSE_STANDINGS_2025_2026: FallbackHouseStanding[] = [
  { name: 'Bowser', emoji: '🐢', points: 247, accentColor: '#e84393' },
  { name: 'Donkey Kong', emoji: '🦍', points: 215, accentColor: '#f97316' },
  { name: 'Toad', emoji: '🍄', points: 158, accentColor: '#8b5cf6' },
  { name: 'Boo', emoji: '👻', points: 125, accentColor: '#06b6d4' },
];

export const FALLBACK_HOUSE_MESSAGE =
  'Live House data is temporarily unavailable. These are the public 2025-2026 House totals.';

// ── House Archive ────────────────────────────────────────────────────────────

export interface FallbackLegacyYear {
  academicYear: string;
  theme: string;
  houses: string[];
  verified: boolean;
}

export const FALLBACK_LEGACY_HOUSE_YEARS: FallbackLegacyYear[] = [
  {
    academicYear: '2024-2025',
    theme: 'Sanrio',
    houses: ['Badtz-maru', 'Keroppi', 'Kuromi'],
    verified: true,
  },
  {
    academicYear: '2023-2024',
    theme: 'Drinks',
    houses: ['Ca Phe Sua Da', 'Banana Milk', 'Matcha', 'Yakult'],
    verified: true,
  },
  {
    academicYear: '2022-2023',
    theme: 'Pokémon',
    houses: ['Squirtle', 'Pikachu', 'Bulbasaur', 'Charmander'],
    verified: true,
  },
  {
    academicYear: '2021-2022',
    theme: 'Mythological Creatures',
    houses: ['Phoenix', 'Unicorn', 'Dragon', 'Tortoise'],
    verified: true,
  },
  {
    academicYear: '2019-2020',
    theme: 'Fashion Brands',
    houses: ['Gucci', 'Comme des Garçons', 'Supreme', 'Yves Saint Laurent'],
    verified: true,
  },
  {
    academicYear: '2018-2019',
    theme: 'Superheroes / Villains',
    houses: ['Flash', 'Iron', 'Loki', 'Light'],
    verified: true,
  },
];

// ── Cabinet ──────────────────────────────────────────────────────────────────

export const FALLBACK_CABINET = {
  message:
    'Cabinet info is temporarily unavailable. Check official VSA channels for current contacts.',
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
    name: 'ACE',
    description:
      'Academic Community and Excellence — study sessions, workshops, and academic support within VSA.',
    slug: 'ace',
  },
  {
    name: 'Intern Program',
    description:
      'A hands-on program for members who want to get involved in running VSA events and operations.',
    slug: 'internship',
  },
  {
    name: 'VCN',
    description:
      "Vietnamese Culture Night — VSA's annual cultural performance showcasing Vietnamese history, traditions, and music.",
    slug: 'vcn',
  },
  {
    name: 'WNC',
    description:
      "Wild N' Culture — an intercollegiate cultural showcase competition hosted annually by VSA at UCSD.",
    slug: 'wild-n-culture',
  },
  {
    name: 'Externals',
    description:
      'Events hosted by other VSAs in the UVSA network that VSA at UCSD members can attend and compete in.',
    slug: 'uvsa-network',
  },
];

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
    "Vietnamese Culture Night (VCN) is VSA at UCSD's annual cultural performance featuring traditional Vietnamese dances, music, and a story celebrating Vietnamese heritage. It is one of VSA's biggest events of the year.",
} as const;

export const FALLBACK_WNC = {
  description:
    "Wild N' Culture (WNC) is an intercollegiate cultural showcase competition hosted by VSA at UCSD each year. Schools from across the UVSA network compete in dance, music, and performance.",
} as const;

// ── Points / Leaderboard ─────────────────────────────────────────────────────

export const FALLBACK_POINTS = {
  message:
    'Points lookup is temporarily unavailable while our live database is down. Check back later or contact VSA if you need help.',
} as const;

export const FALLBACK_LEADERBOARD = {
  message:
    'Individual points lookup is temporarily unavailable.',
  houseMessage:
    'Live House data is temporarily unavailable. These are the public 2025-2026 House totals.',
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
