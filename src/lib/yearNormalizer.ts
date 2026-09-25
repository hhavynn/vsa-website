export const OFFICIAL_YEARS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  '5th Year',
  '1st Year Transfer',
  '2nd Year Transfer'
];

export function normalizeYearInput(input: string | null | undefined): string {
  if (!input) return '';
  const s = input.toLowerCase().trim();
  
  const isTransfer = s.includes('transfer');
  
  if (isTransfer) {
    if (/(1|first|1st)/.test(s)) return '1st Year Transfer';
    if (/(2|second|2nd|soph)/.test(s)) return '2nd Year Transfer';
    return '1st Year Transfer'; // Fallback
  }
  
  if (/(1|first|1st|fresh)/.test(s)) return '1st Year';
  if (/(2|second|2nd|soph)/.test(s)) return '2nd Year';
  if (/(3|third|3rd|junior)/.test(s)) return '3rd Year';
  if (/(4|fourth|4th|senior)/.test(s)) return '4th Year';
  if (/(5|fifth|5th)/.test(s)) return '5th Year';
  
  // Return the original input trimmed if it does not match
  return input.trim();
}

/**
 * Ordinal standing for an official year value, or null when the value is not
 * one of `OFFICIAL_YEARS`.
 *
 * `OFFICIAL_YEARS` is ordered for display, not for comparison — the transfer
 * entries are appended after '5th Year' — so array index is not a usable rank.
 * Transfer years share the scale with their non-transfer equivalents, which
 * makes '2nd Year Transfer' -> '3rd Year' read as an advance rather than an
 * incomparable jump between tracks.
 */
export function getYearRank(value: string | null | undefined): number | null {
  if (!value) return null;
  const ranks: Record<string, number> = {
    '1st Year': 1,
    '1st Year Transfer': 1,
    '2nd Year': 2,
    '2nd Year Transfer': 2,
    '3rd Year': 3,
    '4th Year': 4,
    '5th Year': 5,
  };
  return ranks[value.trim()] ?? null;
}
