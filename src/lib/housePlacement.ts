// Protected domain — House membership. Timestamp-priority House allocation
// ("serial dictatorship"): applicants are processed once, earliest submission
// first, and each takes their highest-ranked House that still has room. An
// earlier applicant is never displaced to improve anyone else's result, there
// is no randomness or scoring, and the same input always gives the same output.
// Pure: nothing here reads or writes the database. Placements only become House
// memberships through the existing draft -> lock -> reveal workflow.

export interface PlacementHouse {
  id: string;
  label: string;
  displayOrder: number;
}

export interface PlacementApplicant {
  /** Stable unique identifier (the final tie-breaker). */
  id: string;
  name: string;
  /** Normalized email, used only to detect repeat submissions. */
  email: string | null;
  /** Submission instant in epoch milliseconds. */
  submittedAtMs: number;
  /** 1-based row in the source sheet. */
  sourceRow: number;
  /** House ids, first choice first. */
  preferences: readonly string[];
}

export type Capacities = Readonly<Record<string, number>>;

export type AllocationErrorCode =
  | 'no_houses'
  | 'duplicate_house'
  | 'invalid_capacity'
  | 'missing_capacity'
  | 'unknown_capacity_house'
  | 'capacity_mismatch'
  | 'duplicate_applicant_id'
  | 'invalid_timestamp'
  | 'invalid_source_row'
  | 'no_preferences'
  | 'unknown_house'
  | 'duplicate_preference'
  | 'too_many_preferences'
  | 'unplaceable';

export interface AllocationError {
  code: AllocationErrorCode;
  message: string;
  applicantId?: string;
  houseId?: string;
}

export interface DuplicateApplicant {
  applicantId: string;
  keptApplicantId: string;
  /** The later submission ranked Houses differently from the one that was kept. */
  preferencesDiffer: boolean;
}

export interface Placement {
  applicantId: string;
  name: string;
  /** 1-based position in line. */
  priority: number;
  houseId: string;
  /** 1 = first choice. */
  achievedRank: number;
  /** Houses this applicant ranked higher that were already full when they were processed. */
  fullAhead: string[];
  /** Spots left in the assigned House after this placement. */
  remainingAfter: number;
  explanation: string;
}

export type AllocationResult =
  | {
      ok: true;
      placements: Placement[];
      houseCounts: Record<string, number>;
      /** rankCounts[0] = placed in first choice, rankCounts[1] = second, … */
      rankCounts: number[];
      duplicates: DuplicateApplicant[];
    }
  | {
      ok: false;
      errors: AllocationError[];
      /** Placements made before an applicant could not be placed; empty when the input was invalid. */
      placements: Placement[];
      duplicates: DuplicateApplicant[];
    };

export interface AllocationInput {
  houses: readonly PlacementHouse[];
  capacities: Capacities;
  applicants: readonly PlacementApplicant[];
}

export function ordinal(rank: number) {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  if (rank % 10 === 1) return `${rank}st`;
  if (rank % 10 === 2) return `${rank}nd`;
  if (rank % 10 === 3) return `${rank}rd`;
  return `${rank}th`;
}

function joinLabels(labels: string[]) {
  if (labels.length <= 1) return labels.join('');
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

/** Earlier submission first; same instant → earlier sheet row; then id. */
export function comparePriority(
  a: Pick<PlacementApplicant, 'submittedAtMs' | 'sourceRow' | 'id'>,
  b: Pick<PlacementApplicant, 'submittedAtMs' | 'sourceRow' | 'id'>,
) {
  if (a.submittedAtMs !== b.submittedAtMs) return a.submittedAtMs - b.submittedAtMs;
  if (a.sourceRow !== b.sourceRow) return a.sourceRow - b.sourceRow;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

function compareHouseOrder(a: PlacementHouse, b: PlacementHouse) {
  if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

function samePreferences(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * Keeps the earliest submission for each email. Applicants without an email are
 * never merged: identity without an email is a human decision.
 */
export function dedupeApplicants(applicants: readonly PlacementApplicant[]): {
  kept: PlacementApplicant[];
  duplicates: DuplicateApplicant[];
} {
  const ordered = [...applicants].sort(comparePriority);
  const keptByEmail = new Map<string, PlacementApplicant>();
  const kept: PlacementApplicant[] = [];
  const duplicates: DuplicateApplicant[] = [];
  for (const applicant of ordered) {
    const email = applicant.email?.trim().toLowerCase() || null;
    const earlier = email ? keptByEmail.get(email) : undefined;
    if (earlier) {
      duplicates.push({
        applicantId: applicant.id,
        keptApplicantId: earlier.id,
        preferencesDiffer: !samePreferences(earlier.preferences, applicant.preferences),
      });
      continue;
    }
    if (email) keptByEmail.set(email, applicant);
    kept.push(applicant);
  }
  return { kept, duplicates };
}

/** Valid first-choice selections per House. */
export function firstChoiceDemand(
  houses: readonly PlacementHouse[],
  applicants: ReadonlyArray<Pick<PlacementApplicant, 'preferences'>>,
): Record<string, number> {
  const demand: Record<string, number> = {};
  houses.forEach((house) => { demand[house.id] = 0; });
  applicants.forEach((applicant) => {
    const first = applicant.preferences[0];
    if (first && first in demand) demand[first] += 1;
  });
  return demand;
}

/**
 * Equal split: every House gets floor(N / H); the N % H extra spots go one each
 * to the Houses with the most first-choice demand (ties: display order, then id).
 */
export function suggestCapacities(
  houses: readonly PlacementHouse[],
  applicantCount: number,
  demand: Readonly<Record<string, number>>,
): Record<string, number> {
  const capacities: Record<string, number> = {};
  if (houses.length === 0) return capacities;
  const count = Math.max(0, Math.floor(applicantCount));
  const base = Math.floor(count / houses.length);
  const remainder = count % houses.length;
  houses.forEach((house) => { capacities[house.id] = base; });
  [...houses]
    .sort((a, b) => (demand[b.id] ?? 0) - (demand[a.id] ?? 0) || compareHouseOrder(a, b))
    .slice(0, remainder)
    .forEach((house) => { capacities[house.id] += 1; });
  return capacities;
}

export function totalCapacity(houses: readonly PlacementHouse[], capacities: Capacities) {
  return houses.reduce((sum, house) => sum + (capacities[house.id] ?? 0), 0);
}

export function validateCapacities(
  houses: readonly PlacementHouse[],
  capacities: Capacities,
  applicantCount: number,
): AllocationError[] {
  const errors: AllocationError[] = [];
  if (houses.length === 0) {
    errors.push({ code: 'no_houses', message: 'There are no participating Houses.' });
    return errors;
  }
  const seen = new Set<string>();
  houses.forEach((house) => {
    if (seen.has(house.id)) {
      errors.push({ code: 'duplicate_house', houseId: house.id, message: `${house.label} is listed more than once.` });
    }
    seen.add(house.id);
    const value = capacities[house.id];
    if (value === undefined) {
      errors.push({ code: 'missing_capacity', houseId: house.id, message: `${house.label} has no capacity.` });
    } else if (!Number.isInteger(value) || value < 0) {
      errors.push({ code: 'invalid_capacity', houseId: house.id, message: `${house.label} capacity must be a whole number of 0 or more.` });
    }
  });
  Object.keys(capacities).forEach((id) => {
    if (!seen.has(id)) errors.push({ code: 'unknown_capacity_house', houseId: id, message: 'A capacity is set for a House that is not participating.' });
  });
  if (errors.length === 0) {
    const total = totalCapacity(houses, capacities);
    if (total !== applicantCount) {
      errors.push({
        code: 'capacity_mismatch',
        message: `Capacities add up to ${total} but there ${applicantCount === 1 ? 'is' : 'are'} ${applicantCount} applicant${applicantCount === 1 ? '' : 's'}. They must be equal.`,
      });
    }
  }
  return errors;
}

function validateApplicants(applicants: readonly PlacementApplicant[], houseIds: ReadonlySet<string>, houseCount: number) {
  const errors: AllocationError[] = [];
  const ids = new Set<string>();
  applicants.forEach((applicant) => {
    const who = applicant.name || applicant.id;
    if (ids.has(applicant.id)) {
      errors.push({ code: 'duplicate_applicant_id', applicantId: applicant.id, message: `Applicant id ${applicant.id} is used twice.` });
    }
    ids.add(applicant.id);
    if (!Number.isFinite(applicant.submittedAtMs)) {
      errors.push({ code: 'invalid_timestamp', applicantId: applicant.id, message: `${who} has no valid submission time.` });
    }
    if (!Number.isInteger(applicant.sourceRow) || applicant.sourceRow < 1) {
      errors.push({ code: 'invalid_source_row', applicantId: applicant.id, message: `${who} has no valid source row.` });
    }
    if (applicant.preferences.length === 0) {
      errors.push({ code: 'no_preferences', applicantId: applicant.id, message: `${who} ranked no Houses.` });
    }
    if (applicant.preferences.length > houseCount) {
      errors.push({ code: 'too_many_preferences', applicantId: applicant.id, message: `${who} ranked more Houses than are participating.` });
    }
    const seen = new Set<string>();
    applicant.preferences.forEach((houseId) => {
      if (!houseIds.has(houseId)) {
        errors.push({ code: 'unknown_house', applicantId: applicant.id, houseId, message: `${who} ranked a House that is not participating.` });
      } else if (seen.has(houseId)) {
        errors.push({ code: 'duplicate_preference', applicantId: applicant.id, houseId, message: `${who} ranked the same House twice.` });
      }
      seen.add(houseId);
    });
  });
  return errors;
}

export function allocateHouseApplicants(input: AllocationInput): AllocationResult {
  const houseById = new Map(input.houses.map((house) => [house.id, house]));
  const applicantErrors = validateApplicants(input.applicants, new Set(houseById.keys()), input.houses.length);
  const { kept, duplicates } = dedupeApplicants(input.applicants);
  const errors = [...validateCapacities(input.houses, input.capacities, kept.length), ...applicantErrors];
  if (errors.length > 0) return { ok: false, errors, placements: [], duplicates };

  const assigned: Record<string, number> = {};
  input.houses.forEach((house) => { assigned[house.id] = 0; });
  const rankCounts = input.houses.map(() => 0);
  const placements: Placement[] = [];
  const unplaceable: AllocationError[] = [];

  kept.forEach((applicant, index) => {
    const fullAhead: string[] = [];
    const houseId = applicant.preferences.find((id) => {
      if (assigned[id] < input.capacities[id]) return true;
      fullAhead.push(id);
      return false;
    });
    if (!houseId) {
      unplaceable.push({
        code: 'unplaceable',
        applicantId: applicant.id,
        message: `${applicant.name || applicant.id} could not be placed: every House they ranked was full.`,
      });
      return;
    }
    assigned[houseId] += 1;
    const achievedRank = applicant.preferences.indexOf(houseId) + 1;
    rankCounts[achievedRank - 1] += 1;
    const label = houseById.get(houseId)?.label ?? houseId;
    const fullLabels = fullAhead.map((id) => houseById.get(id)?.label ?? id);
    placements.push({
      applicantId: applicant.id,
      name: applicant.name,
      priority: index + 1,
      houseId,
      achievedRank,
      fullAhead,
      remainingAfter: input.capacities[houseId] - assigned[houseId],
      explanation: achievedRank === 1
        ? `Assigned to ${label} (1st choice).`
        : `Assigned to ${label} (${ordinal(achievedRank)} choice). ${joinLabels(fullLabels)} ${fullLabels.length === 1 ? 'was' : 'were'} full when this applicant was processed.`,
    });
  });

  if (unplaceable.length > 0) return { ok: false, errors: unplaceable, placements, duplicates };
  return { ok: true, placements, houseCounts: assigned, rankCounts, duplicates };
}

export interface PriorityViolation {
  /** The earlier applicant who wanted the House. */
  applicantId: string;
  /** A later applicant who holds it. */
  laterApplicantId: string;
  houseId: string;
}

/**
 * Finds earlier applicants who ranked a House above their own while a later
 * applicant holds a spot in it — exactly what timestamp priority forbids. A
 * pure allocator result has none; a manual override may introduce some.
 * `ordered` must already be in priority order.
 */
export function findPriorityViolations(
  ordered: ReadonlyArray<{ id: string; preferences: readonly string[]; houseId: string | null }>,
): PriorityViolation[] {
  const violations: PriorityViolation[] = [];
  const heldByLater = new Map<string, string>();
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const applicant = ordered[index];
    const ownRank = applicant.houseId ? applicant.preferences.indexOf(applicant.houseId) : -1;
    const better = ownRank === -1 ? applicant.preferences : applicant.preferences.slice(0, ownRank);
    better.forEach((houseId) => {
      const later = heldByLater.get(houseId);
      if (later) violations.push({ applicantId: applicant.id, laterApplicantId: later, houseId });
    });
    if (applicant.houseId) heldByLater.set(applicant.houseId, applicant.id);
  }
  return violations.reverse();
}
