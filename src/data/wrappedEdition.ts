// The VSA Wrapped edition currently shown at /#wrapped (#263).
//
// Wrapped is per-year editorial content, so the nav label follows the edition
// that is actually published, not today's date: in September the newest
// Wrapped is still last year's, and a date-derived label would point freshmen
// at a recap that doesn't exist yet. The recap card (WrappedRecapCard), the
// WRAPPED_2026 config and the nav/footer labels all read this one value, so the
// label always matches the edition that renders. When the next recap ships,
// replace the card's copy and update this value in the same change.
export const CURRENT_WRAPPED_YEAR_LABEL = '2025–2026';

/** "2025–2026" → "Wrapped '25–'26" */
export function wrappedNavLabel(yearLabel: string = CURRENT_WRAPPED_YEAR_LABEL): string {
  const [start, end] = yearLabel.split(/[–-]/).map((year) => year.trim().slice(-2));
  return end ? `Wrapped '${start}–'${end}` : `Wrapped ${yearLabel}`;
}
