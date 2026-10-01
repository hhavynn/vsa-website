// Pure logic for the House assignment draft workflow: counts, preflight, and
// balance suggestions. Nothing here reads or writes the database, and nothing
// here ever reassigns anyone — suggestions are data the admin must accept.
import type { Database, Json } from '../types/database';
import { MemberYearMembership, planMembershipChange } from './houseMembershipIntervals';
import type { ParsedHouseRow } from './houseAssignmentImport';

export type HouseAssignmentBatch = Database['public']['Tables']['house_assignment_batches']['Row'];
export type HouseAssignmentDraft = Database['public']['Tables']['house_assignment_drafts']['Row'];
export type HouseAssignmentDraftInsert = Database['public']['Tables']['house_assignment_drafts']['Insert'];
export type HouseBatchStatus = 'draft' | 'locked' | 'published' | 'archived';
export type DraftMatchStatus = 'match' | 'review' | 'unmatched' | 'invalid' | 'manual';

export interface HouseProfileLite {
  id: string;
  house_key: string;
  display_name: string;
  is_active: boolean;
}

/** A row is only ever written to house_memberships when its match is confirmed. */
const PUBLISHABLE_STATUSES: ReadonlySet<string> = new Set(['match', 'manual']);
/** Statuses that name a (possibly unconfirmed) canonical member. */
const MEMBER_BEARING_STATUSES: ReadonlySet<string> = new Set(['match', 'manual', 'review']);

export function readPreferences(value: Json | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export function houseLabel(profile: HouseProfileLite) {
  return profile.display_name || profile.house_key;
}

export function draftInsertFromParsed(parsed: ParsedHouseRow, sourceOrder: number): Omit<HouseAssignmentDraftInsert, 'batch_id'> {
  const hasMember = parsed.selectedMemberId && (parsed.status === 'match' || parsed.status === 'review');
  return {
    source_name: parsed.name,
    source_house: parsed.house,
    member_id: hasMember ? parsed.selectedMemberId : null,
    house_profile_id: parsed.houseProfile?.id ?? null,
    match_status: parsed.status,
    match_method: parsed.method === 'none' ? null : parsed.method,
    match_score: parsed.method === 'none' ? null : parsed.score,
    preferences: parsed.preferences.length > 0 ? parsed.preferences : null,
    notes: parsed.note || null,
    source_order: sourceOrder,
  };
}

function validProfileIds(profiles: HouseProfileLite[]) {
  return new Set(profiles.filter((profile) => profile.is_active).map((profile) => profile.id));
}

/** Member confirmed and House resolved: this row will become a membership. */
export function isPublishableRow(row: HouseAssignmentDraft, profiles: HouseProfileLite[]) {
  return !!row.member_id
    && !!row.house_profile_id
    && PUBLISHABLE_STATUSES.has(row.match_status)
    && validProfileIds(profiles).has(row.house_profile_id);
}

/** Publishable rows with each canonical member kept once (the first occurrence). */
export function publishableRows(rows: HouseAssignmentDraft[], profiles: HouseProfileLite[]) {
  const seen = new Set<string>();
  return rows
    .filter((row) => isPublishableRow(row, profiles))
    .sort((a, b) => a.source_order - b.source_order)
    .filter((row) => {
      if (seen.has(row.member_id as string)) return false;
      seen.add(row.member_id as string);
      return true;
    });
}

export interface HouseCountEntry {
  profileId: string;
  label: string;
  count: number;
}

export interface HouseCounts {
  perHouse: HouseCountEntry[];
  /** Rows with no House at all. */
  unassigned: number;
  /** Rows with a House but no confirmed canonical member yet. */
  needsMember: number;
  total: number;
}

export function computeHouseCounts(rows: HouseAssignmentDraft[], profiles: HouseProfileLite[]): HouseCounts {
  const active = profiles.filter((profile) => profile.is_active);
  const counts = new Map<string, number>(active.map((profile) => [profile.id, 0]));
  publishableRows(rows, profiles).forEach((row) => {
    counts.set(row.house_profile_id as string, (counts.get(row.house_profile_id as string) ?? 0) + 1);
  });

  const valid = validProfileIds(profiles);
  let unassigned = 0;
  let needsMember = 0;
  rows.forEach((row) => {
    const hasHouse = !!row.house_profile_id && valid.has(row.house_profile_id);
    if (!hasHouse && !row.source_house && !row.house_profile_id) {
      unassigned += 1;
    } else if (hasHouse && !isPublishableRow(row, profiles)) {
      needsMember += 1;
    }
  });

  return {
    perHouse: active.map((profile) => ({ profileId: profile.id, label: houseLabel(profile), count: counts.get(profile.id) ?? 0 })),
    unassigned,
    needsMember,
    total: rows.length,
  };
}

export interface PreflightIssue {
  code:
    | 'conflicting_house'
    | 'invalid_house'
    | 'interval'
    | 'unassigned'
    | 'duplicate_member'
    | 'ambiguous_match'
    | 'unmatched'
    | 'imbalance'
    | 'empty';
  message: string;
  /** Row ids involved, so the UI can jump to them. */
  rowIds: string[];
}

export interface PreflightResult {
  applicants: number;
  assigned: number;
  blockers: PreflightIssue[];
  warnings: PreflightIssue[];
  canLock: boolean;
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

export function buildPreflight(
  rows: HouseAssignmentDraft[],
  profiles: HouseProfileLite[],
  options: {
    effectiveStartDate: string;
    /** Memberships that already exist for this academic year, by member id. */
    existingMemberships: Map<string, MemberYearMembership[]>;
    memberNames?: Map<string, string>;
  },
): PreflightResult {
  const blockers: PreflightIssue[] = [];
  const warnings: PreflightIssue[] = [];
  const valid = validProfileIds(profiles);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const nameOf = (row: HouseAssignmentDraft) =>
    (row.member_id && options.memberNames?.get(row.member_id)) || row.source_name || 'Unknown member';

  const memberRows = rows.filter((row) => row.member_id && MEMBER_BEARING_STATUSES.has(row.match_status));
  const byMember = new Map<string, HouseAssignmentDraft[]>();
  memberRows.forEach((row) => {
    byMember.set(row.member_id as string, [...(byMember.get(row.member_id as string) ?? []), row]);
  });

  // Hard blocker: one canonical member in more than one House.
  const duplicateSameHouse: HouseAssignmentDraft[][] = [];
  byMember.forEach((list) => {
    if (list.length < 2) return;
    const houses = new Set(list.map((row) => row.house_profile_id ?? ''));
    houses.delete('');
    if (houses.size > 1) {
      const houseNames = Array.from(houses).map((id) => {
        const profile = profileById.get(id);
        return profile ? houseLabel(profile) : 'Unknown';
      });
      blockers.push({
        code: 'conflicting_house',
        message: `${nameOf(list[0])} is assigned to multiple Houses (${houseNames.join(', ')}).`,
        rowIds: list.map((row) => row.id),
      });
    } else {
      duplicateSameHouse.push(list);
    }
  });

  // Hard blocker: a House that does not resolve to an active profile for the year.
  const invalidHouse = rows.filter((row) => {
    if (row.house_profile_id) return !valid.has(row.house_profile_id);
    return !!row.source_house;
  });
  if (invalidHouse.length > 0) {
    blockers.push({
      code: 'invalid_house',
      message: `${plural(invalidHouse.length, 'row')} point at a House with no active profile for this year (${Array.from(new Set(invalidHouse.map((row) => row.source_house ?? 'removed profile'))).join(', ')}).`,
      rowIds: invalidHouse.map((row) => row.id),
    });
  }

  // Hard blocker: placement that would violate House membership intervals.
  publishableRows(rows, profiles).forEach((row) => {
    const plan = planMembershipChange(
      options.existingMemberships.get(row.member_id as string) ?? [],
      options.effectiveStartDate,
      row.house_profile_id as string,
    );
    if (plan.kind === 'conflict' || plan.kind === 'overlap') {
      blockers.push({
        code: 'interval',
        message: `${nameOf(row)}: ${plan.message}`,
        rowIds: [row.id],
      });
    }
  });

  if (rows.length === 0) {
    blockers.push({ code: 'empty', message: 'This draft has no rows.', rowIds: [] });
  }

  const unassigned = rows.filter((row) => !row.house_profile_id && !row.source_house);
  if (unassigned.length > 0) {
    warnings.push({ code: 'unassigned', message: `${plural(unassigned.length, 'row')} unassigned (no House).`, rowIds: unassigned.map((row) => row.id) });
  }
  if (duplicateSameHouse.length > 0) {
    warnings.push({
      code: 'duplicate_member',
      message: `${plural(duplicateSameHouse.length, 'duplicate member')} listed more than once in the same House (published once).`,
      rowIds: duplicateSameHouse.flat().map((row) => row.id),
    });
  }
  const ambiguous = rows.filter((row) => row.match_status === 'review');
  if (ambiguous.length > 0) {
    warnings.push({
      code: 'ambiguous_match',
      message: `${plural(ambiguous.length, 'ambiguous member match', 'ambiguous member matches')} (skipped at publish until confirmed).`,
      rowIds: ambiguous.map((row) => row.id),
    });
  }
  const unmatched = rows.filter((row) => !row.member_id && (row.match_status === 'unmatched' || row.match_status === 'invalid'));
  if (unmatched.length > 0) {
    warnings.push({
      code: 'unmatched',
      message: `${plural(unmatched.length, 'row')} with no member match (skipped at publish).`,
      rowIds: unmatched.map((row) => row.id),
    });
  }

  const counts = computeHouseCounts(rows, profiles).perHouse;
  if (counts.length >= 2) {
    const largest = counts.reduce((a, b) => (b.count > a.count ? b : a));
    const smallest = counts.reduce((a, b) => (b.count < a.count ? b : a));
    if (largest.count - smallest.count > 1) {
      warnings.push({
        code: 'imbalance',
        message: `${largest.label} has ${largest.count - smallest.count} more members than ${smallest.label}.`,
        rowIds: [],
      });
    }
  }

  return {
    applicants: rows.length,
    assigned: publishableRows(rows, profiles).length,
    blockers,
    warnings,
    canLock: blockers.length === 0,
  };
}

export interface BalanceSuggestion {
  rowId: string;
  name: string;
  kind: 'assign' | 'move';
  fromProfileId: string | null;
  toProfileId: string;
  reason: string;
}

export interface BalanceReport {
  counts: HouseCounts;
  /** Largest vs smallest House, or null when there is nothing to compare. */
  imbalance: { largest: HouseCountEntry; smallest: HouseCountEntry; gap: number } | null;
  /** Rows with no House, whether or not a suggestion exists for them. */
  unassigned: HouseAssignmentDraft[];
  hasPreferences: boolean;
  suggestions: BalanceSuggestion[];
}

function ordinal(rank: number) {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return `${rank}th`;
}

function firstName(row: HouseAssignmentDraft, memberNames?: Map<string, string>) {
  const full = (row.member_id && memberNames?.get(row.member_id)) || row.source_name || 'them';
  return full.split(/\s+/)[0] || 'them';
}

/**
 * Suggests House changes that follow members' own stated preferences. It never
 * invents a wish: without preference data it only reports imbalance and who is
 * unassigned. The caller applies a suggestion only when an admin accepts it.
 */
export function suggestBalancing(
  rows: HouseAssignmentDraft[],
  profiles: HouseProfileLite[],
  memberNames?: Map<string, string>,
  houseLookup: (text: string) => string | null = () => null,
): BalanceReport {
  const counts = computeHouseCounts(rows, profiles);
  const active = profiles.filter((profile) => profile.is_active);
  const labelById = new Map(active.map((profile) => [profile.id, houseLabel(profile)]));
  const unassigned = rows.filter((row) => !row.house_profile_id && !row.source_house);

  const imbalance = counts.perHouse.length >= 2
    ? (() => {
        const largest = counts.perHouse.reduce((a, b) => (b.count > a.count ? b : a));
        const smallest = counts.perHouse.reduce((a, b) => (b.count < a.count ? b : a));
        return largest.count - smallest.count > 0 ? { largest, smallest, gap: largest.count - smallest.count } : null;
      })()
    : null;

  const prefIds = (row: HouseAssignmentDraft) =>
    readPreferences(row.preferences)
      .map((text) => houseLookup(text))
      .filter((id): id is string => !!id && labelById.has(id));

  const hasPreferences = rows.some((row) => prefIds(row).length > 0);
  const report: BalanceReport = { counts, imbalance, unassigned, hasPreferences, suggestions: [] };
  if (!hasPreferences || active.length < 2) return report;

  const working = new Map(counts.perHouse.map((entry) => [entry.profileId, entry.count]));
  const placed = publishableRows(rows, profiles);
  const unassignedWithPrefs = unassigned.filter((row) => prefIds(row).length > 0);
  const target = Math.ceil((placed.length + unassignedWithPrefs.length) / active.length);
  const smallestId = () => Array.from(working.entries()).reduce((a, b) => (b[1] < a[1] ? b : a))[0];

  // Unassigned members with preferences: highest-ranked choice with room, else
  // their least-full choice.
  unassignedWithPrefs.sort((a, b) => a.source_order - b.source_order).forEach((row) => {
    const choices = prefIds(row);
    const withRoom = choices.findIndex((id) => (working.get(id) ?? 0) < target);
    const index = withRoom >= 0
      ? withRoom
      : choices.reduce((best, id, i) => ((working.get(id) ?? 0) < (working.get(choices[best]) ?? 0) ? i : best), 0);
    const toProfileId = choices[index];
    const reasons: string[] = [];
    if (smallestId() === toProfileId) reasons.push(`${labelById.get(toProfileId)} is smallest`);
    reasons.push(`${labelById.get(toProfileId)} was ${firstName(row, memberNames)}'s ${ordinal(index + 1)} choice`);
    report.suggestions.push({
      rowId: row.id,
      name: (row.member_id && memberNames?.get(row.member_id)) || row.source_name,
      kind: 'assign',
      fromProfileId: null,
      toProfileId,
      reason: reasons.join(' + '),
    });
    working.set(toProfileId, (working.get(toProfileId) ?? 0) + 1);
  });

  // Rebalance: move people toward a smaller House only when they listed it and
  // it ranks above where they are now.
  const moved = new Set<string>();
  for (let guard = 0; guard < 500; guard += 1) {
    const ordered = Array.from(working.entries()).sort((a, b) => b[1] - a[1]);
    type Candidate = { row: HouseAssignmentDraft; toId: string; rank: number; toCount: number };
    let best = null as Candidate | null;
    for (const [fromId, fromCount] of ordered) {
      for (const row of placed) {
        if (row.house_profile_id !== fromId || moved.has(row.id)) continue;
        const choices = prefIds(row);
        const currentRank = choices.indexOf(fromId);
        for (let rankIndex = 0; rankIndex < choices.length; rankIndex += 1) {
          const toId = choices[rankIndex];
          if (toId === fromId) continue;
          if (currentRank !== -1 && rankIndex >= currentRank) continue;
          const toCount = working.get(toId) ?? 0;
          if (fromCount - toCount < 2) continue;
          if (!best || rankIndex < best.rank || (rankIndex === best.rank && toCount < best.toCount)) {
            best = { row, toId, rank: rankIndex, toCount };
          }
        }
      }
      if (best) break;
    }
    if (!best) break;
    const chosen = best as Candidate;
    const fromId = chosen.row.house_profile_id as string;
    report.suggestions.push({
      rowId: chosen.row.id,
      name: (chosen.row.member_id && memberNames?.get(chosen.row.member_id)) || chosen.row.source_name,
      kind: 'move',
      fromProfileId: fromId,
      toProfileId: chosen.toId,
      reason: `${labelById.get(chosen.toId)} is smaller than ${labelById.get(fromId)} (${chosen.toCount} vs ${working.get(fromId)}) + ${labelById.get(chosen.toId)} was ${firstName(chosen.row, memberNames)}'s ${ordinal(chosen.rank + 1)} choice`,
    });
    working.set(fromId, (working.get(fromId) ?? 0) - 1);
    working.set(chosen.toId, (working.get(chosen.toId) ?? 0) + 1);
    moved.add(chosen.row.id);
  }

  return report;
}
