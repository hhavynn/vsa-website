// VSA Wrapped 2025–2026 — curated editorial content.
//
// Everything in this file is community-recap copy written/approved by cabinet,
// NOT derived from private data. Dynamic aggregate stats (event counts, House
// standings, gallery counts) are fetched separately in src/pages/Wrapped.tsx;
// when those queries are unavailable the page falls back to the copy here so
// we never show fake precision.
//
// Future version (admin generator, deliberately not built in this MVP):
//   - admin selects an academic year
//   - admin picks approved events/photos
//   - system computes aggregate stats from public-safe views
//   - admin edits fun awards/copy, then previews + publishes
// Keeping this config file per-year (wrapped2027.ts, …) keeps that path easy.

export interface WrappedAward {
  emoji: string;
  title: string;
  winner: string;
  blurb: string;
}

export interface WrappedSignatureEvent {
  emoji: string;
  name: string;
  blurb: string;
}

export const WRAPPED_2026 = {
  yearLabel: '2025–2026',
  academicYearStart: 2025,
  // Date-only window used for aggregate event counts.
  windowStart: '2025-07-01',
  windowEnd: '2026-06-30',

  hero: {
    tagline: 'One year. Four houses. A whole lot of pho-nomenal memories.',
    scrollCta: 'Scroll the year',
  },

  // Fallback copy when live aggregates are unavailable — intentionally vague,
  // never fake numbers.
  fallbacks: {
    events: 'A full year of GBMs, socials, and traditions',
    photos: 'Albums and albums of memories',
    points: 'Thousands of House points earned together',
  },

  signatureEvents: [
    {
      emoji: '🎭',
      name: 'VCN',
      blurb:
        'Months of practices, one unforgettable night. Dancers, actors, and crew told our story on stage.',
    },
    {
      emoji: '🏕️',
      name: 'Winter Retreat',
      blurb: 'Cabin energy, late-night talks, and the bonding that carried us through the year.',
    },
    {
      emoji: '🥧',
      name: 'Pie-a-Cast',
      blurb: 'Library Walk got messy for a good cause. VCN cast faces were harmed in the making.',
    },
    {
      emoji: '✨',
      name: 'Afterglow Banquet',
      blurb: 'A night of memories — dressed up, teary-eyed, and celebrating everything we built.',
    },
  ] satisfies WrappedSignatureEvent[],

  vcn: {
    fallbackTitle: 'VCN brought the community together',
    fallbackBlurb:
      'Vietnamese Culture Night filled the theater with family, food, and pride — the biggest stage of our year.',
  },

  wnc: {
    title: "Wild n' Culture",
    blurb:
      "Teams battled through culture-filled chaos — Wild n' Culture stayed the loudest, proudest night of quarter.",
  },

  cabinet: {
    fallbackTheme: 'Afterglow',
    thankYou:
      'To every member, intern, House captain, performer, photographer, and friend who showed up: this year was you. Thank you for making it what it was.',
  },

  vibe: {
    title: 'Year Vibe',
    value: 'Golden-hour chaos',
    blurb:
      'Equal parts wholesome and unhinged — potlucks that ran long, buses that left late, and memories that stuck.',
  },

  awards: [
    {
      emoji: '🌪️',
      title: 'Most Chaotic Event',
      winner: 'Pie-a-Cast',
      blurb: 'Whipped cream everywhere. No survivors on Library Walk.',
    },
    {
      emoji: '📈',
      title: 'Biggest Comeback',
      winner: 'Spring quarter House race',
      blurb: 'The standings flipped in the final weeks and nobody was ready.',
    },
    {
      emoji: '🌱',
      title: 'New Tradition Started',
      winner: 'House family dinners',
      blurb: 'What started as a one-off potluck became the thing everyone waited for.',
    },
    {
      emoji: '📸',
      title: 'Most Scrapbook-Worthy Moment',
      winner: 'Banquet golden hour',
      blurb: 'One sunset, four hundred photos. The camera rolls tell the story.',
    },
  ] satisfies WrappedAward[],

  closing: {
    heading: 'Ready for next year?',
    blurb: 'New events, a fresh House race, and more memories to make. See you in fall.',
    instagramUrl: 'https://instagram.com/vsaatucsd',
  },
} as const;

export type Wrapped2026Config = typeof WRAPPED_2026;
