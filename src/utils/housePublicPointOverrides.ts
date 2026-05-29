/**
 * officialPublicHousePoints2025_2026
 * 
 * These are the House Chair's official public 2025-2026 totals.
 * They override public display only and do not change calculated/admin values.
 * 
 * Official totals for 2025-2026:
 * - Bowser: 247
 * - Donkey Kong: 215
 * - Toad: 158
 * - Boo: 125
 */
const PUBLIC_OVERRIDES_2025_2026: Record<string, number> = {
  'bowser': 247,
  'donkey-kong': 215,
  'toad': 158,
  'boo': 125,
};

interface GetPublicHousePointsOptions {
  houseKey?: string | null;
  houseName?: string | null;
  academicYearStart?: number | null;
  calculatedPoints: number;
}

/**
 * Returns the public-facing point total for a house.
 * Currently only applies overrides to the 2025-2026 academic year (start year 2025).
 */
export function getPublicHousePoints({
  houseKey,
  houseName,
  academicYearStart,
  calculatedPoints,
}: GetPublicHousePointsOptions): number {
  // Only override if year is 2025 (representing 2025-2026)
  if (academicYearStart !== 2025) {
    return calculatedPoints;
  }

  const key = (houseKey || houseName || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

  if (key in PUBLIC_OVERRIDES_2025_2026) {
    return PUBLIC_OVERRIDES_2025_2026[key];
  }

  return calculatedPoints;
}

/**
 * Returns whether a public display override is active for a given year.
 */
export function isHousePointOverrideActive(academicYearStart?: number | null): boolean {
  return academicYearStart === 2025;
}
