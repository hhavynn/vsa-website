// Rules for the shared admin confirmation dialog. Pure so the typed-phrase
// check is testable without a DOM.
//
// Two tiers, deliberately:
//   standard — a quick Cancel / Confirm that names the item and what happens.
//   typed    — the admin must type the item's name. Reserve this for genuinely
//              severe, hard-to-reverse actions (cabinet records, fam/event
//              deletes that cascade, year-wide resets, bulk deletes). Using it
//              everywhere trains people to click through, so ordinary deletes
//              stay standard.

/** Case, spacing, and surrounding whitespace never make a correct name "wrong". */
export function normalizeConfirmPhrase(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function confirmPhraseMatches(input: string, phrase: string): boolean {
  const expected = normalizeConfirmPhrase(phrase);
  return expected.length > 0 && normalizeConfirmPhrase(input) === expected;
}

/** Counts at or above this need the typed tier even for an otherwise-standard bulk delete. */
export const BULK_DELETE_TYPED_THRESHOLD = 5;

/** The phrase to type for a bulk action: short, unambiguous, and count-bearing. */
export function bulkConfirmPhrase(count: number, noun: string, nounPlural = `${noun}s`): string {
  return `${count} ${count === 1 ? noun : nounPlural}`;
}

/** Message shown when a confirmed action fails; never leaks raw error objects. */
export function confirmErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Nothing was changed.';
}
