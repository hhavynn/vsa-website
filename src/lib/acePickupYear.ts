// The academic year an ACE member was picked up as a Little — not when they
// later became a Big. UCSD academic years start in Fall: FA23 is 2023–24, and
// WI24/SP24 belong to that same year.
//
// Parsing never guesses. Anything it cannot place exactly (legacy, blank,
// malformed, a bare calendar year, an ambiguous two-digit century) comes back
// as unknown/needs-review instead of a made-up year.

export type PickupSeason = 'FA' | 'WI' | 'SP';

/** Inclusive bounds; mirrors the ace_family_members CHECK constraints. */
export const MIN_PICKUP_ACADEMIC_YEAR = 1960;
export const MAX_PICKUP_ACADEMIC_YEAR = 2100;

/**
 * Two-digit years up to this value read as 20xx (00 → 2000, 69 → 2069).
 * Above it, the century is ambiguous (FA98 could be 1998) and needs review
 * unless the caller states the century.
 */
export const TWO_DIGIT_2000S_MAX = 69;

export type PickupParseIssue =
  | 'malformed'
  | 'unsupported_season'
  | 'ambiguous_century'
  | 'calendar_year_only'
  | 'non_consecutive_years'
  | 'out_of_range';

export type ParsedPickup =
  /** Exact term, e.g. FA23 → 2023–24. */
  | { kind: 'term'; term: string; season: PickupSeason; academicYearStart: number }
  /** Academic year known, season not (e.g. a "2021–22" workbook row). */
  | { kind: 'academic_year'; academicYearStart: number }
  /** Nothing to place: blank or the reconstructed files' `legacy` marker. */
  | { kind: 'unknown'; reason: 'empty' | 'legacy' }
  /** Something was written but cannot be placed without a human. */
  | { kind: 'needs_review'; issue: PickupParseIssue; raw: string };

export interface ParsePickupOptions {
  /**
   * The century the source is known to use. Only set this when the source
   * itself establishes it (e.g. a sheet titled 1998–99); it resolves
   * two-digit years above TWO_DIGIT_2000S_MAX.
   */
  century?: 1900 | 2000;
}

const SEASON_WORDS: Record<string, PickupSeason | 'SU'> = {
  FA: 'FA',
  FALL: 'FA',
  WI: 'WI',
  WINTER: 'WI',
  SP: 'SP',
  SPRING: 'SP',
  SU: 'SU',
  SUMMER: 'SU',
};

function inRange(year: number): boolean {
  return year >= MIN_PICKUP_ACADEMIC_YEAR && year <= MAX_PICKUP_ACADEMIC_YEAR;
}

function expandTwoDigit(yy: number, options: ParsePickupOptions): number | null {
  if (options.century) return options.century + yy;
  return yy <= TWO_DIGIT_2000S_MAX ? 2000 + yy : null;
}

/** FA uses its own calendar year; WI and SP belong to the year that began the previous Fall. */
export function academicYearStartForSeason(season: PickupSeason, calendarYear: number): number {
  return season === 'FA' ? calendarYear : calendarYear - 1;
}

/** 2023 → "2023–24" (2099 → "2099–00"). */
export function formatPickupAcademicYear(academicYearStart: number): string {
  return `${academicYearStart}–${String((academicYearStart + 1) % 100).padStart(2, '0')}`;
}

/** The canonical stored term, e.g. ('SP', 2023) → "SP24". */
export function pickupTermCode(season: PickupSeason, academicYearStart: number): string {
  const calendarYear = season === 'FA' ? academicYearStart : academicYearStart + 1;
  return `${season}${String(calendarYear % 100).padStart(2, '0')}`;
}

/**
 * True when `term` is a canonical code that belongs to `academicYearStart`.
 * Mirrors the database CHECK, which uses the four-digit year to settle the
 * term's century.
 */
export function isTermConsistentWithYear(term: string, academicYearStart: number): boolean {
  const match = /^(FA|WI|SP)(\d{2})$/.exec(term);
  if (!match || !inRange(academicYearStart)) return false;
  return pickupTermCode(match[1] as PickupSeason, academicYearStart) === term;
}

function termResult(season: PickupSeason | 'SU', calendarYear: number, raw: string): ParsedPickup {
  if (season === 'SU') return { kind: 'needs_review', issue: 'unsupported_season', raw };
  const academicYearStart = academicYearStartForSeason(season, calendarYear);
  if (!inRange(academicYearStart)) return { kind: 'needs_review', issue: 'out_of_range', raw };
  return {
    kind: 'term',
    term: pickupTermCode(season, academicYearStart),
    season,
    academicYearStart,
  };
}

/**
 * Parses one historical pickup value. Accepted shapes (case/space-insensitive):
 *   FA23 · fa 23 · FA2023 · Fall 2023 · Spring '24      → exact term
 *   2021-22 · 2021–22 · 2021-2022 · 21-22                → academic year only
 *   legacy · blank                                       → unknown
 * Everything else, including a bare "2021" (which academic year?), needs review.
 */
export function parsePickupValue(
  input: string | null | undefined,
  options: ParsePickupOptions = {},
): ParsedPickup {
  const raw = (input ?? '').trim();
  if (raw === '') return { kind: 'unknown', reason: 'empty' };
  if (raw.toLowerCase() === 'legacy') return { kind: 'unknown', reason: 'legacy' };

  const compact = raw.toUpperCase().replace(/[\s'’.]+/g, ' ').trim();

  const term = /^([A-Z]+) ?(\d{2}|\d{4})$/.exec(compact);
  if (term) {
    const season = SEASON_WORDS[term[1]];
    if (!season) return { kind: 'needs_review', issue: 'malformed', raw };
    const digits = term[2];
    const calendarYear = digits.length === 4 ? Number(digits) : expandTwoDigit(Number(digits), options);
    if (calendarYear === null) return { kind: 'needs_review', issue: 'ambiguous_century', raw };
    return termResult(season, calendarYear, raw);
  }

  const span = /^(\d{2}|\d{4}) ?[-–—/] ?(\d{2}|\d{4})$/.exec(compact);
  if (span) {
    const [first, second] = [span[1], span[2]];
    let start: number | null;
    if (first.length === 4) {
      start = Number(first);
    } else {
      start = expandTwoDigit(Number(first), options);
      if (start === null) return { kind: 'needs_review', issue: 'ambiguous_century', raw };
    }
    const endMatches =
      second.length === 4 ? Number(second) === start + 1 : Number(second) === (start + 1) % 100;
    if (!endMatches) return { kind: 'needs_review', issue: 'non_consecutive_years', raw };
    if (!inRange(start)) return { kind: 'needs_review', issue: 'out_of_range', raw };
    return { kind: 'academic_year', academicYearStart: start };
  }

  if (/^\d{4}$/.test(compact)) return { kind: 'needs_review', issue: 'calendar_year_only', raw };
  return { kind: 'needs_review', issue: 'malformed', raw };
}

/** Year + optional term, or null when the parse placed nothing. */
export function pickupCandidateOf(
  parsed: ParsedPickup,
): { academicYearStart: number; term: string | null } | null {
  if (parsed.kind === 'term') return { academicYearStart: parsed.academicYearStart, term: parsed.term };
  if (parsed.kind === 'academic_year') return { academicYearStart: parsed.academicYearStart, term: null };
  return null;
}

// ─── Approved pickup year on a live node ─────────────────────────────────────

/**
 * What a reader may show. `verified` comes only from the approved columns on
 * ace_family_members (or the public view); there is no "suspected" state here
 * because unreviewed candidates never leave the admin-only evidence table.
 */
export type AcePickupYear =
  | { status: 'unknown' }
  | { status: 'verified'; academicYearStart: number; term: string | null };

/** Compare approved years, and terms only when both are known. */
export function comparePickup(a: AcePickupYear | undefined, b: AcePickupYear | undefined): -1 | 0 | 1 | null {
  if (!a || !b || a.status !== 'verified' || b.status !== 'verified') return null;
  if (a.academicYearStart !== b.academicYearStart) {
    return a.academicYearStart < b.academicYearStart ? -1 : 1;
  }
  if (!a.term || !b.term) return null;
  const seasons: Record<string, number> = { FA: 0, WI: 1, SP: 2 };
  const x = seasons[a.term.slice(0, 2)];
  const y = seasons[b.term.slice(0, 2)];
  if (x === undefined || y === undefined) return null;
  return x < y ? -1 : x > y ? 1 : 0;
}

export interface PickupYearColumns {
  pickup_academic_year_start?: number | null;
  pickup_term?: string | null;
}

/**
 * Reads the approved columns defensively: a row from before the migration (no
 * columns), a null year, or a value that fails the database's own invariants
 * all read as unknown rather than as some other year.
 */
export function pickupYearOf(row: PickupYearColumns): AcePickupYear {
  const year = row.pickup_academic_year_start;
  if (typeof year !== 'number' || !Number.isInteger(year) || !inRange(year)) {
    return { status: 'unknown' };
  }
  const term = row.pickup_term ?? null;
  if (term !== null && !isTermConsistentWithYear(term, year)) return { status: 'unknown' };
  return { status: 'verified', academicYearStart: year, term };
}

/** Short tree label: the exact term when known, else the academic year. */
export function formatPickupLabel(pickup: AcePickupYear): string | null {
  if (pickup.status !== 'verified') return null;
  return pickup.term ?? formatPickupAcademicYear(pickup.academicYearStart);
}


/** Compact rail label: 2023–24 → 23–24 (2099–00 remains 99–00). */
export function formatPickupAcademicYearShort(year: number): string {
  return String(year % 100).padStart(2, '0') + '–' +
    String((year + 1) % 100).padStart(2, '0');
}

/** Public-safe, human-readable pickup description; never source confidence. */
export function describePickup(pickup: AcePickupYear): string {
  if (pickup.status !== 'verified') return 'Pickup year unverified';
  const year = formatPickupAcademicYear(pickup.academicYearStart);
  if (!pickup.term) return 'Picked up: ' + year + ' (term unknown)';
  const season = pickup.term.slice(0, 2);
  const seasonName = season === 'FA' ? 'Fall' : season === 'WI' ? 'Winter' : 'Spring';
  const calendarYear = pickup.academicYearStart + (season === 'FA' ? 0 : 1);
  return 'Picked up: ' + seasonName + ' ' + calendarYear + ' · ' + year;
}
