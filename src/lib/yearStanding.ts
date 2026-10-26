// Academic standing as identity evidence and as a profile field.
//
// A standing is only meaningful together with WHEN it was reported: "2nd Year"
// in 2025-26 and "3rd Year" in 2026-27 describe the same student. Matching
// compares a row's standing with what the member reported in some academic
// year, shifted by the years in between. It never promotes anyone because time
// passed, and it never rewinds a profile from an older event's form.
import { getYearRank } from './yearNormalizer';

export interface YearObservation {
  member_id: string;
  academic_year_start: number;
  year_label: string;
  /** 'profile_estimate' was dated from attendance by the migration, so it is looser. */
  source: 'profile_estimate' | 'attendance_import';
}

export type YearKind =
  | { kind: 'undergrad'; rank: number; transfer: boolean }
  | { kind: 'post' }
  | { kind: 'unknown' };

const LEGACY_LABELS: Record<string, number> = { freshman: 1, sophomore: 2, junior: 3, senior: 4 };

/** Official labels, legacy labels (Senior…), and alumni / graduate wording. */
export function classifyYear(label: string | null | undefined): YearKind {
  const value = (label ?? '').trim();
  if (!value) return { kind: 'unknown' };
  const rank = getYearRank(value) ?? LEGACY_LABELS[value.toLowerCase()] ?? null;
  if (rank !== null) return { kind: 'undergrad', rank, transfer: /transfer/i.test(value) };
  if (/\b(alum|alumni|alumna|alumnus|graduated|grad student|graduate student|masters?|ph\.?d|post ?bac)/i.test(value)) {
    return { kind: 'post' };
  }
  return { kind: 'unknown' };
}

export type YearEvidence =
  /** Consistent with the member's recorded standing for this event's year. */
  | 'compatible'
  /** Neither supports nor contradicts (missing, unranked, far apart in time, alumni wording). */
  | 'unknown'
  /** Off by more than students normally drift, but not enough to call it a contradiction. */
  | 'uncertain'
  /** Clearly a different stage of school than this member was in that year. */
  | 'implausible';

const MAX_UNDERGRAD_RANK = 5;

/** The observation to compare against: nearest in time, import observations before estimates. */
function referenceObservation(observations: readonly YearObservation[], eventYear: number): YearObservation | null {
  let best: YearObservation | null = null;
  let bestScore = Infinity;
  for (const observation of observations) {
    if (classifyYear(observation.year_label).kind !== 'undergrad') continue;
    const score = Math.abs(eventYear - observation.academic_year_start) * 2 + (observation.source === 'profile_estimate' ? 1 : 0);
    if (score < bestScore) {
      best = observation;
      bestScore = score;
    }
  }
  return best;
}

/**
 * How a row's standing fits a member. `eventYear` is the start year of the
 * event's academic term (2026 for 2026-27). Without dated observations the
 * profile year is compared as if current, which can only ever weaken a match
 * (never "implausible").
 */
export function assessYearEvidence(
  rowYear: string,
  member: { year: string | null },
  observations: readonly YearObservation[],
  eventYear: number | null,
): YearEvidence {
  const row = classifyYear(rowYear);
  if (row.kind === 'unknown') return 'unknown';

  const reference = eventYear !== null ? referenceObservation(observations, eventYear) : null;
  if (!reference || eventYear === null) {
    const stored = classifyYear(member.year);
    if (stored.kind !== 'undergrad' || row.kind !== 'undergrad') return 'unknown';
    return Math.abs(row.rank - stored.rank) <= 1 ? 'compatible' : 'uncertain';
  }

  const observed = classifyYear(reference.year_label);
  if (observed.kind !== 'undergrad') return 'unknown';
  const expected = observed.rank + (eventYear - reference.academic_year_start);
  const tolerance = (reference.source === 'profile_estimate' ? 2 : 1)
    + (observed.transfer || (row.kind === 'undergrad' && row.transfer) ? 1 : 0);

  if (row.kind === 'post') return expected >= 4 ? 'compatible' : 'uncertain';
  if (expected < 1) return 'uncertain';
  if (expected > MAX_UNDERGRAD_RANK) {
    if (row.rank >= 4) return 'compatible';
    return row.rank <= 2 ? 'implausible' : 'uncertain';
  }
  const gap = Math.abs(row.rank - expected);
  if (gap <= tolerance) return 'compatible';
  return gap <= tolerance + 1 ? 'uncertain' : 'implausible';
}

/**
 * The year to write on a matched member's profile, or null to leave it.
 *
 * Only forward, only from an official label, and never from an event older
 * than the member's most recent observation: a backfill of last year's sign-in
 * sheet must not overwrite this year's standing. Equal or lower ranks stay a
 * deliberate admin edit.
 */
export function planYearAdvance(
  storedYear: string | null | undefined,
  rowYear: string,
  invalidYear: boolean,
  observations: readonly YearObservation[],
  eventYear: number | null,
): string | null {
  if (!rowYear || invalidYear) return null;
  const row = classifyYear(rowYear);
  if (row.kind !== 'undergrad') return null;

  const latestObserved = observations.reduce<number | null>(
    (latest, o) => (latest === null || o.academic_year_start > latest ? o.academic_year_start : latest),
    null,
  );
  if (eventYear !== null && latestObserved !== null && eventYear < latestObserved) return null;

  const stored = (storedYear ?? '').trim();
  if (!stored) return rowYear;
  if (stored === rowYear) return null;
  // A stored value that cannot be ranked is preserved: overwriting it could
  // silently downgrade the member (#408 review).
  const storedKind = classifyYear(stored);
  if (storedKind.kind !== 'undergrad') return null;
  return row.rank > storedKind.rank ? rowYear : null;
}
