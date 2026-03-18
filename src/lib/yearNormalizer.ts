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
