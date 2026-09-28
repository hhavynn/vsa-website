// The VSA Wrapped edition currently shown at /#wrapped (#263).
//
// Wrapped is per-year editorial content, so the nav label follows the edition
// that is actually published, not today's date: in September the newest
// Wrapped is still last year's, and a date-derived label would point freshmen
// at a recap that doesn't exist yet. Update this when the next edition's recap
// replaces WrappedRecapCard; the nav and footer labels follow it. (The card's
// own copy is edition-specific and stays with that edition.)
export const CURRENT_WRAPPED_YEAR_LABEL = '2025–2026';

/** "2025–2026" → "Wrapped '25–'26" */
export function wrappedNavLabel(yearLabel: string = CURRENT_WRAPPED_YEAR_LABEL): string {
  const [start, end] = yearLabel.split(/[–-]/).map((year) => year.trim().slice(-2));
  return end ? `Wrapped '${start}–'${end}` : `Wrapped ${yearLabel}`;
}
