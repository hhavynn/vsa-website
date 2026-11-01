/**
 * The pure ACE Big-capacity calculation shared by #646 and #663.
 *
 * This module never approves a mutual request, changes an ACE pairing, creates
 * an orphan, or writes a family-tree node. Callers must supply reviewed,
 * cycle-scoped pairing identities and a verified capacity. Application form
 * suggestions are NOT automatically an approved number of seats.
 */
export type CapacityInterpretation = 'total' | 'additional' | null;

export interface CapacitySuggestion {
  /** Only an unqualified single integer can be used as a suggestion. */
  suggested: number | null;
  min: number | null;
  max: number | null;
  conditional: boolean;
  raw: string | null;
}

const CAPACITY_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
};

function capacityNumber(token: string): number | null {
  const n = /^\d+$/.test(token) ? Number(token) : CAPACITY_WORDS[token.toLowerCase()];
  return Number.isInteger(n) && n >= 0 && n <= 20 ? n : null;
}

/** Extracts possible answers without treating conditions or ranges as approval. */
export function parseCapacitySuggestion(text: string | null): CapacitySuggestion {
  const raw = text?.trim() || null;
  if (!raw) return { suggested: null, min: null, max: null, conditional: false, raw: null };

  const token = '(zero|one|two|three|four|five|six|\\d{1,2})';
  const pattern = new RegExp(
    '^(?:(about|around|maybe|up to)\\s+)?' + token +
    '(?:\\s*(?:-|–|—|to|or)\\s*' + token + ')?(.*)$',
    'i',
  );
  const match = pattern.exec(raw);
  if (!match) return { suggested: null, min: null, max: null, conditional: true, raw };
  const first = capacityNumber(match[2]);
  const second = match[3] ? capacityNumber(match[3]) : null;
  if (first === null || (match[3] && second === null) || (second !== null && second < first)) {
    return { suggested: null, min: null, max: null, conditional: true, raw };
  }
  const isRange = second !== null;
  const isApproximate = !!match[1];
  const conditional = isRange || isApproximate || match[4].trim().length > 0;
  return {
    suggested: conditional ? null : first,
    min: match[1]?.toLowerCase() === 'up to' ? 0 : first,
    max: second ?? first,
    conditional,
    raw,
  };
}

export interface HybridCapacityInput {
  /** Explicit reviewed maximum for this cycle, not a raw form response. */
  capacityMax: number | null;
  capacityReviewed: boolean;
  /** Explicit choice of whether capacityMax counts guaranteed Littles. */
  interpretation: CapacityInterpretation;
  /** Distinct canonical Little participant IDs; never names or email strings. */
  guaranteedLittleIds: readonly string[];
  confirmedLittleIds: readonly string[];
  tentativeLittleIds: readonly string[];
  /** Unapproved, resolved mutual claims. Display only: do not use seats. */
  provisionalLittleIds: readonly string[];
  /** Withdrawn/declined Littles are excluded from current-cycle counts. */
  withdrawnLittleIds?: ReadonlySet<string>;
  /** Historical family-tree children; a separate display counter only. */
  historicalChildren: number;
  /** Never silently discard existing pairings when the Big withdraws. */
  bigWithdrawn?: boolean;
}

export interface HybridCapacityRow {
  guaranteed: number;
  confirmed: number;
  tentative: number;
  provisional: number;
  totalIncoming: number;
  historical: number;
  ceiling: number;
  unreserved: number;
  remaining: number | null;
  state: 'open' | 'full' | 'over';
  needsCapacity: boolean;
  needsInterpretation: boolean;
  needsReview: boolean;
  ceilingIfTotal: number | null;
  unreservedIfTotal: number | null;
  ceilingIfAdditional: number | null;
  unreservedIfAdditional: number | null;
}

/**
 * One seat belongs to one canonical Little, even when the Little submitted
 * both mutual and regular forms. Approved guarantees take precedence, followed
 * by confirmed, tentative, then unresolved/provisional claims.
 *
 * This does not alter pairing records or decide who should be matched.
 */
export function computeHybridBigCapacity(input: HybridCapacityInput): HybridCapacityRow {
  const { capacityMax, capacityReviewed, interpretation, historicalChildren } = input;
  if (capacityMax !== null && (!Number.isInteger(capacityMax) || capacityMax < 0 || capacityMax > 20)) {
    throw new Error('Reviewed ACE capacity must be an integer between 0 and 20.');
  }
  if (!Number.isInteger(historicalChildren) || historicalChildren < 0) {
    throw new Error('Historical children must be a nonnegative integer.');
  }
  if (interpretation !== null && interpretation !== 'total' && interpretation !== 'additional') {
    throw new Error('ACE capacity interpretation must be total, additional, or unset.');
  }

  const seen = new Set<string>();
  const count = (ids: readonly string[]): number => {
    let n = 0;
    for (const id of ids) {
      if (!id.trim()) throw new Error('A capacity participant needs a stable canonical ID.');
      if (input.withdrawnLittleIds?.has(id) || seen.has(id)) continue;
      seen.add(id);
      n++;
    }
    return n;
  };
  const guaranteed = count(input.guaranteedLittleIds);
  const confirmed = count(input.confirmedLittleIds);
  const tentative = count(input.tentativeLittleIds);
  const provisional = count(input.provisionalLittleIds);
  const needsCapacity = !capacityReviewed || capacityMax === null;
  const needsInterpretation = !needsCapacity && guaranteed > 0 && interpretation === null;
  const ceilingIfTotal = needsInterpretation ? capacityMax : null;
  const unreservedIfTotal = needsInterpretation ? (capacityMax as number) - guaranteed : null;
  const ceilingIfAdditional = needsInterpretation ? (capacityMax as number) + guaranteed : null;
  const unreservedIfAdditional = needsInterpretation ? capacityMax : null;

  // No reviewed capacity means guaranteed Littles remain protected, but no
  // additional seats are authorized. A missing interpretation remains Unknown.
  const ceiling = needsCapacity ? guaranteed
    : interpretation === 'additional' && guaranteed > 0
      ? (capacityMax as number) + guaranteed
      : capacityMax as number;
  const unreserved = needsCapacity ? 0 : ceiling - guaranteed;
  const remaining = needsInterpretation ? null : unreserved - confirmed - tentative;
  const state = remaining === null ? 'open' : remaining < 0 ? 'over'
    : remaining === 0 ? 'full' : 'open';
  return {
    guaranteed, confirmed, tentative, provisional, totalIncoming: guaranteed + confirmed,
    historical: historicalChildren, ceiling, unreserved, remaining, state,
    needsCapacity, needsInterpretation,
    needsReview: needsCapacity || needsInterpretation || !!input.bigWithdrawn || state === 'over',
    ceilingIfTotal, unreservedIfTotal, ceilingIfAdditional, unreservedIfAdditional,
  };
}
