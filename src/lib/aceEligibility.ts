// Pre-sort ACE eligibility: does each Little and each Big in a draft or locked
// cycle meet the attendance minimums the ACE Chair saved for that cycle? Pure:
// no reads, no writes, no points math. Reuses #791's rules: an event only
// counts once its import is verified (isAceEventAttendanceVerified), only
// completed and dated events can count, and incomplete evidence makes a result
// Unknown rather than a confident "short".
import type { AceAssignmentDraft } from '../types';
import type { ReadinessEvent } from '../data/repos/attendanceReadiness';
import type { AceNodeRef } from './aceAssignments';
import { isAceEventAttendanceVerified } from './aceParticipationReview';
import { pluralize } from './operationalStatus';

/** UI pre-fill only. The Chair saves the real numbers per cycle. */
export const DEFAULT_LITTLE_MIN_EVENTS = 4;
export const DEFAULT_BIG_MIN_EVENTS = 3;
export const MAX_QUALIFYING_EVENTS = 100;

export interface AceEligibilityPolicy {
  littleMin: number;
  bigMin: number;
  eventIds: readonly string[];
}

export type AceEligibilityRole = 'little' | 'big';
export type AceEligibilityStatus = 'meets' | 'short' | 'unknown' | 'needs-identity-review';
export const ELIGIBILITY_STATUSES: readonly AceEligibilityStatus[] = ['short', 'unknown', 'needs-identity-review', 'meets'];

export const ELIGIBILITY_STATUS_LABEL: Record<AceEligibilityStatus, string> = {
  meets: 'Meets',
  short: 'Short',
  unknown: 'Unknown',
  'needs-identity-review': 'Needs identity review',
};

export interface AceEligibilityRow {
  key: string;
  role: AceEligibilityRole;
  name: string;
  memberId: string | null;
  status: AceEligibilityStatus;
  /** Verified qualifying events attended. */
  attended: number;
  required: number;
  /** How many more are needed; set only when the person is short. */
  remaining: number | null;
  /** Credits at qualifying events whose import is not verified yet. */
  pendingAttended: number;
  reason: string;
  /** The drafts this row comes from: the Little's own, or every Little a Big takes. */
  draftIds: string[];
}

export interface RejectedEvent {
  id: string;
  name: string | null;
  reason: string;
}

export interface AceEligibilityResult {
  littles: AceEligibilityRow[];
  bigs: AceEligibilityRow[];
  counts: Record<AceEligibilityRole, Record<AceEligibilityStatus, number>>;
  verifiedEventIds: string[];
  unverifiedEventIds: string[];
  /** Saved events that cannot count: not in the year any more, future, undated or unpublished. */
  rejectedEvents: RejectedEvent[];
}

export type EligibilityDraft = Pick<AceAssignmentDraft, 'id' | 'little_name' | 'little_member_id' | 'big_ace_member_id'>;
export type EligibilityNode = Pick<AceNodeRef, 'id' | 'name' | 'memberId'>;

export interface AceEligibilityInput {
  drafts: readonly EligibilityDraft[];
  nodes: readonly EligibilityNode[];
  policy: AceEligibilityPolicy;
  /** The cycle year's events from admin_event_attendance_readiness. */
  events: readonly ReadinessEvent[];
  /** member id → qualifying event ids with a credit. */
  attendance: ReadonlyMap<string, ReadonlySet<string>>;
  now: Date;
}

export function isValidMinimum(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 20;
}

/** Why an event cannot qualify, or null when it can: completed, dated and published. */
export function qualifyingEventProblem(
  event: Pick<ReadinessEvent, 'date' | 'is_published'>,
  now: Date,
): string | null {
  if (!event.is_published) return 'Not published';
  if (!event.date) return 'Has no date';
  // Invalid event dates cannot provide proof that the event happened.
  // Date.parse() returns NaN for malformed inputs; NaN > now is false, which
  // previously let a broken date pass as a completed qualifying event.
  const eventTime = Date.parse(event.date);
  if (!Number.isFinite(eventTime)) return 'Has an invalid date';
  if (eventTime > now.getTime()) return 'Has not happened yet';
  return null;
}

/** The saved policy, or null until the Chair has saved both minimums. */
export function savedPolicy(
  cycle: { little_min_events?: number | null; big_min_events?: number | null },
  eventIds: readonly string[] | null | undefined,
): AceEligibilityPolicy | null {
  if (!isValidMinimum(cycle.little_min_events) || !isValidMinimum(cycle.big_min_events) || !eventIds) return null;
  return { littleMin: cycle.little_min_events, bigMin: cycle.big_min_events, eventIds };
}

/** The saved events that can count, split by whether their import is verified. */
export function classifyPolicyEvents(
  eventIds: readonly string[],
  events: readonly ReadinessEvent[],
  now: Date,
): Pick<AceEligibilityResult, 'verifiedEventIds' | 'unverifiedEventIds' | 'rejectedEvents'> {
  const byId = new Map(events.map((event) => [event.id, event]));
  const verifiedEventIds: string[] = [];
  const unverifiedEventIds: string[] = [];
  const rejectedEvents: RejectedEvent[] = [];
  for (const id of Array.from(new Set(eventIds))) {
    const event = byId.get(id);
    if (!event) {
      rejectedEvents.push({ id, name: null, reason: "No longer one of this academic year's events" });
      continue;
    }
    const problem = qualifyingEventProblem(event, now);
    if (problem) rejectedEvents.push({ id, name: event.name, reason: problem });
    else if (isAceEventAttendanceVerified(event, now)) verifiedEventIds.push(id);
    else unverifiedEventIds.push(id);
  }
  return { verifiedEventIds, unverifiedEventIds, rejectedEvents };
}

function evaluate(
  memberId: string,
  required: number,
  attendance: AceEligibilityInput['attendance'],
  verified: ReadonlySet<string>,
  unverified: ReadonlySet<string>,
): Pick<AceEligibilityRow, 'status' | 'attended' | 'remaining' | 'pendingAttended' | 'reason'> {
  const credited = Array.from(attendance.get(memberId) ?? []);
  const attended = credited.filter((id) => verified.has(id)).length;
  const pendingAttended = credited.filter((id) => unverified.has(id)).length;
  if (attended >= required) {
    return { status: 'meets', attended, remaining: null, pendingAttended, reason: `${attended} of ${required} verified qualifying events` };
  }
  if (unverified.size > 0 && attended + unverified.size >= required) {
    // Only verified events count, so meeting the bar on them is safe to claim;
    // falling short is not while the unverified events could still close the gap.
    return {
      status: 'unknown',
      attended,
      remaining: null,
      pendingAttended,
      reason: `${attended} of ${required} verified; ${pluralize(unverified.size, 'selected event')} still ${unverified.size === 1 ? 'has' : 'have'} incomplete import evidence`,
    };
  }
  const remaining = required - attended;
  const caveat = unverified.size > 0 ? ', even if every unverified event counted' : '';
  return { status: 'short', attended, remaining, pendingAttended, reason: `${attended} of ${required}: ${remaining} more needed${caveat}` };
}

function emptyCounts(): Record<AceEligibilityStatus, number> {
  return { meets: 0, short: 0, unknown: 0, 'needs-identity-review': 0 };
}

/**
 * Littles come from little_member_id; Bigs from their ACE node's member link,
 * counted once however many Littles they take. A person with no canonical
 * member link needs identity review: they are never reported as short.
 */
export function computeAceEligibility(input: AceEligibilityInput): AceEligibilityResult {
  const { drafts, nodes, policy, events, attendance, now } = input;
  if (!isValidMinimum(policy.littleMin) || !isValidMinimum(policy.bigMin)) {
    throw new Error('A saved ACE eligibility policy with minimums from 1 to 20 is required');
  }
  const classified = classifyPolicyEvents(policy.eventIds, events, now);
  const verified = new Set(classified.verifiedEventIds);
  const unverified = new Set(classified.unverifiedEventIds);

  const littles: AceEligibilityRow[] = drafts.map((draft) => {
    const base = { key: `little:${draft.id}`, role: 'little' as const, name: draft.little_name, memberId: draft.little_member_id, required: policy.littleMin, draftIds: [draft.id] };
    if (!draft.little_member_id) {
      return { ...base, status: 'needs-identity-review', attended: 0, remaining: null, pendingAttended: 0, reason: 'No linked member record: link one to check attendance' };
    }
    return { ...base, ...evaluate(draft.little_member_id, policy.littleMin, attendance, verified, unverified) };
  });

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const bigGroups = new Map<string, { node: EligibilityNode | null; nodeId: string; draftIds: string[] }>();
  for (const draft of drafts) {
    if (!draft.big_ace_member_id) continue;
    const node = nodesById.get(draft.big_ace_member_id) ?? null;
    const key = node?.memberId ? `member:${node.memberId}` : `node:${draft.big_ace_member_id}`;
    const group = bigGroups.get(key) ?? { node, nodeId: draft.big_ace_member_id, draftIds: [] };
    group.draftIds.push(draft.id);
    bigGroups.set(key, group);
  }
  const bigs: AceEligibilityRow[] = Array.from(bigGroups, ([key, group]) => {
    const memberId = group.node?.memberId ?? null;
    const base = { key: `big:${key}`, role: 'big' as const, name: group.node?.name ?? 'Big no longer on the ACE tree', memberId, required: policy.bigMin, draftIds: group.draftIds };
    if (!memberId) {
      return {
        ...base,
        status: 'needs-identity-review',
        attended: 0,
        remaining: null,
        pendingAttended: 0,
        reason: group.node ? 'ACE node has no linked member record: link it in Families to check attendance' : 'Pick a Big who is still on the ACE tree',
      };
    }
    return { ...base, ...evaluate(memberId, policy.bigMin, attendance, verified, unverified) };
  });

  const byName = (a: AceEligibilityRow, b: AceEligibilityRow) => a.name.localeCompare(b.name);
  littles.sort(byName);
  bigs.sort(byName);
  const counts = { little: emptyCounts(), big: emptyCounts() };
  for (const row of [...littles, ...bigs]) counts[row.role][row.status] += 1;
  return { littles, bigs, counts, ...classified };
}

/** Minimums that no one can meet because too few qualifying events count. */
export function unreachableMinimums(
  policy: Pick<AceEligibilityPolicy, 'littleMin' | 'bigMin'>,
  countableEvents: number,
): AceEligibilityRole[] {
  const roles: AceEligibilityRole[] = [];
  if (countableEvents < policy.littleMin) roles.push('little');
  if (countableEvents < policy.bigMin) roles.push('big');
  return roles;
}

/** Every canonical member the check needs attendance for. */
export function eligibilityMemberIds(drafts: readonly EligibilityDraft[], nodes: readonly EligibilityNode[]): string[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const ids = new Set<string>();
  for (const draft of drafts) {
    if (draft.little_member_id) ids.add(draft.little_member_id);
    const bigMember = draft.big_ace_member_id ? nodesById.get(draft.big_ace_member_id)?.memberId : null;
    if (bigMember) ids.add(bigMember);
  }
  return Array.from(ids).sort();
}
