/**
 * Public identity for events hosted by UVSA SoCal (the Union of Vietnamese
 * Student Associations of Southern California) rather than by one of the 13
 * schools. UVSA SoCal is not a `uvsa_schools` row, so its identity lives here
 * instead of being scattered across components.
 *
 * Public-safe values only. The Instagram handle (@uvsasocal) is the one already
 * credited in the VCN archive seed data.
 */
export const UVSA_SOCAL = {
  name: 'UVSA Southern California',
  shortName: 'UVSA SoCal',
  /** Initials-mark label; no logo asset is stored for UVSA SoCal yet. */
  markLabel: 'UVSA',
  instagramUrl: 'https://www.instagram.com/uvsasocal/',
  linktreeUrl: null as string | null,
  websiteUrl: null as string | null,
} as const;
