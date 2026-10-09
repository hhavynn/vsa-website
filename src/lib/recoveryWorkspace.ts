// Bulk reconciliation for historical attendance recovery. Admins stage
// decisions per import row, review them together, and apply them through the
// existing single-row writer (admin_recover_import_row), one transaction per
// row. Pure: nothing here talks to Supabase or picks a member.
//
// Safety rules enforced here before anything is sent (the database checks
// them again; this is not the safety boundary):
// - a staged decision carries the history entry it was staged against, so a
//   finding someone else changed is blocked, never applied blind;
// - the exact request (with a fixed request id) is frozen at staging, so a
//   retry after a lost response replays instead of writing twice;
// - one member is credited at most once per event, and rows that look like the
//   same person can never be sent to different members in one batch;
// - a new member's email must be unused, on file and within the batch;
// - an "already recorded" restore, which cannot be reopened, needs its own
//   acknowledgement.
import {
  DismissReason,
  MemberSnapshot,
  NewMemberInput,
  RecoveryActionRecord,
  RecoveryFinding,
  allowedActions,
  emailConflictMemberId,
  memberName,
  newRequestId,
  validatePlan,
} from './attendanceRecovery';
import { foldName, normEmail, similarMembers } from './recoveryTriage';
import type { RecoverRequest, RecoverResult } from '../data/repos/attendanceRecovery';

// ─── Staged decisions ───────────────────────────────────────────────────────

export type StagedKind = 'restore' | 'create_member' | 'reassign' | 'dismiss' | 'needs_info';

interface StagedBase {
  rowId: string;
  eventId: string | null;
  /** The latest history entry when staged; kept fixed for retries. */
  expectedPreviousActionId: string | null;
  requestId: string;
  stagedAt: number;
  /** 'bulk' decisions were staged for several rows at once and get stricter review. */
  origin: 'row' | 'bulk';
  /** The exact RPC payload, frozen at staging; retries resend it unchanged. */
  payload: RecoverRequest;
  /** `at`: when the attempt that produced this issue finished (ms). */
  issue?: { status: 'conflict' | 'failed' | 'unknown'; message: string; at?: number };
}

export type StagedDecision = StagedBase & (
  | { kind: 'restore'; memberId: string; memberCheck: string }
  | { kind: 'create_member'; newMember: NewMemberInput }
  | { kind: 'reassign'; memberId: string; memberCheck: string; fromMemberId: string; note: string }
  | { kind: 'dismiss'; reason: DismissReason; note: string }
  | { kind: 'needs_info'; note: string }
);

export type StageInput =
  | { kind: 'restore'; member: MemberSnapshot }
  | { kind: 'create_member'; newMember: NewMemberInput }
  | { kind: 'reassign'; member: MemberSnapshot; note: string }
  | { kind: 'dismiss'; reason: DismissReason; note: string }
  | { kind: 'needs_info'; note: string };

export const KIND_LABELS: Record<StagedKind, string> = {
  restore: 'Match existing member',
  create_member: 'Create separate member',
  reassign: 'Credit correct member',
  dismiss: 'Dismiss',
  needs_info: 'Needs more information',
};

/** Short fingerprint of the identity fields an admin confirmed (FNV-1a); detects edits without storing PII. */
export function memberCheck(member: MemberSnapshot): string {
  const text = [member.first_name, member.last_name, member.email, member.college, member.year]
    .map((value) => (value ?? '').trim().toLowerCase())
    .join('|');
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Why this input cannot be staged for this finding, or null. */
export function stagingError(finding: RecoveryFinding, input: StageInput): string | null {
  if (!allowedActions(finding).includes(input.kind)) return 'That action is not available for this finding.';
  switch (input.kind) {
    case 'reassign':
      if (!finding.record.attendance_member_id) return 'This row does not credit anyone.';
      if (input.member.id === finding.record.attendance_member_id) return 'Choose a different member from the one currently credited.';
      return null;
    case 'create_member':
      return validatePlan({ action: 'create_member', newMember: input.newMember });
    case 'dismiss':
      return validatePlan({ action: 'dismiss', reason: input.reason, note: input.note });
    case 'needs_info':
      return validatePlan({ action: 'needs_info', note: input.note });
    default:
      return null;
  }
}

function trimMember(input: NewMemberInput): NewMemberInput {
  return {
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    email: input.email.trim().toLowerCase(),
    college: input.college.trim(),
    year: input.year.trim(),
  };
}

type Unfrozen = StagedDecision extends infer D ? (D extends StagedDecision ? Omit<D, 'payload'> : never) : never;

function buildRequest(decision: Unfrozen): RecoverRequest {
  return {
    requestId: decision.requestId,
    rowId: decision.rowId,
    action: decision.kind,
    expectedPreviousActionId: decision.expectedPreviousActionId,
    memberId: decision.kind === 'restore' || decision.kind === 'reassign' ? decision.memberId : null,
    fromMemberId: decision.kind === 'reassign' ? decision.fromMemberId : null,
    newMember: decision.kind === 'create_member' ? decision.newMember : null,
    reasonCode: decision.kind === 'dismiss' ? decision.reason : null,
    note: 'note' in decision && decision.note ? decision.note : null,
  };
}

/** Builds the decision and freezes its request. Any change is a new decision with a new request id. */
export function stageDecision(
  finding: RecoveryFinding,
  input: StageInput,
  options: { origin?: 'row' | 'bulk'; now?: number } = {},
): StagedDecision {
  const base = {
    rowId: finding.record.row_id,
    eventId: finding.record.event_id,
    expectedPreviousActionId: finding.latestAction?.id ?? null,
    requestId: newRequestId(),
    stagedAt: options.now ?? Date.now(),
    origin: options.origin ?? 'row',
  };
  let decision: Unfrozen;
  switch (input.kind) {
    case 'restore':
      decision = { ...base, kind: 'restore', memberId: input.member.id, memberCheck: memberCheck(input.member) };
      break;
    case 'reassign':
      decision = {
        ...base, kind: 'reassign', memberId: input.member.id, memberCheck: memberCheck(input.member),
        fromMemberId: finding.record.attendance_member_id as string, note: input.note.trim(),
      };
      break;
    case 'create_member':
      decision = { ...base, kind: 'create_member', newMember: trimMember(input.newMember) };
      break;
    case 'dismiss':
      decision = { ...base, kind: 'dismiss', reason: input.reason, note: input.note.trim() };
      break;
    default:
      decision = { ...base, kind: 'needs_info', note: input.note.trim() };
  }
  return { ...decision, payload: buildRequest(decision) } as StagedDecision;
}

/**
 * Accepts a member's current identity details for a restore/reassign whose
 * member changed since staging. Explicit admin action; produces a new request.
 */
export function reconfirmMember(decision: StagedDecision, member: MemberSnapshot): StagedDecision {
  if (decision.kind !== 'restore' && decision.kind !== 'reassign') return decision;
  const next = { ...decision, memberCheck: memberCheck(member), requestId: newRequestId(), issue: undefined };
  const { payload: _payload, ...unfrozen } = next;
  return { ...next, payload: buildRequest(unfrozen as Unfrozen) };
}

/** The member a decision credits, if any. */
export function creditedMemberId(decision: StagedDecision): string | null {
  return decision.kind === 'restore' || decision.kind === 'reassign' ? decision.memberId : null;
}

/** Exactly what is sent: the payload frozen at staging, so a retry is byte-identical. */
export function toRecoverRequest(decision: StagedDecision): RecoverRequest {
  return decision.payload;
}

/** A row whose last attempt got no answer is read-only until a retry or refresh resolves it. */
export function isLocked(decision: StagedDecision | undefined): boolean {
  return decision?.issue?.status === 'unknown';
}

// ─── Batch review ───────────────────────────────────────────────────────────

export type ReviewGroup = 'credit' | 'already_recorded' | 'create' | 'investigate' | 'dismiss' | 'needs_info' | 'blocked';

export const GROUP_LABELS: Record<ReviewGroup, string> = {
  credit: 'Existing members receiving missing attendance',
  already_recorded: 'Already-recorded attendance (no points)',
  create: 'New members to be created',
  investigate: 'Incorrect matches: correct member credited, original kept for investigation',
  dismiss: 'Dismissed findings',
  needs_info: 'Needs more information',
  blocked: 'Cannot be safely applied',
};

export const GROUP_ORDER: ReviewGroup[] = ['blocked', 'credit', 'already_recorded', 'create', 'investigate', 'dismiss', 'needs_info'];

export const ALREADY_RECORDED_ACK =
  'This member already has attendance for the event, so nothing is added. The finding becomes "recovered" for this member, which cannot be reopened while that attendance exists and also settles same-email rows for the event. If this row is a duplicate, dismiss it as a legitimate duplicate instead.';

export interface ReviewContext {
  /** Freshly loaded findings by row id. */
  findings: ReadonlyMap<string, RecoveryFinding>;
  /** Freshly loaded members by id (targets and originals). */
  members: ReadonlyMap<string, MemberSnapshot>;
  /** event id → members who currently have attendance for it (targets and originals). */
  attendance: ReadonlyMap<string, ReadonlySet<string>>;
  /** event id → current point value. */
  eventPoints: ReadonlyMap<string, number>;
  /** lower-cased email → member holding it, for new-member emails. */
  emailHolders: ReadonlyMap<string, MemberSnapshot>;
  /** The full roster, loaded when the batch creates members, for the similar-name check. */
  roster?: readonly MemberSnapshot[];
}

export interface ReviewItem {
  decision: StagedDecision;
  finding: RecoveryFinding | null;
  group: ReviewGroup;
  blockers: string[];
  warnings: string[];
  /** The target member's identity changed since staging; the admin may re-confirm. */
  needsReconfirm: boolean;
  /** Already-recorded restores apply only after a per-row acknowledgement. */
  requiresAck: boolean;
  member: MemberSnapshot | null;
  from: MemberSnapshot | null;
  /** Existing members whose name could be the new member's. */
  similar: MemberSnapshot[];
  /** Expected points: the server reads the event's points at apply time. */
  points: number;
}

const attended = (ctx: ReviewContext, eventId: string | null, memberId: string) =>
  !!eventId && !!ctx.attendance.get(eventId)?.has(memberId);

const writes = (kind: StagedKind) => kind === 'restore' || kind === 'create_member' || kind === 'reassign';

/** Where a write decision sends the person: an existing member, or a brand-new one. */
function targetKey(decision: StagedDecision): string | null {
  if (decision.kind === 'create_member') return `new:${decision.rowId}`;
  const id = creditedMemberId(decision);
  return id ? `member:${id}` : null;
}

function reviewOne(decision: StagedDecision, ctx: ReviewContext): ReviewItem {
  const finding = ctx.findings.get(decision.rowId) ?? null;
  const blockers: string[] = [];
  const warnings: string[] = [];
  let needsReconfirm = false;
  let similar: MemberSnapshot[] = [];
  const targetId = creditedMemberId(decision);
  const member = targetId ? ctx.members.get(targetId) ?? null : null;
  const from = decision.kind === 'reassign' ? ctx.members.get(decision.fromMemberId) ?? null : null;
  const eventId = finding?.record.event_id ?? decision.eventId;

  const { payload, ...unfrozen } = decision;
  if (JSON.stringify(payload) !== JSON.stringify(buildRequest(unfrozen as Unfrozen))) {
    blockers.push('This staged decision does not match the request it would send. Clear it and stage it again.');
  }
  if (!finding) blockers.push('This row is no longer in the findings.');
  else if ((finding.latestAction?.id ?? null) !== decision.expectedPreviousActionId) {
    blockers.push('Changed since you staged it (another admin or tab acted on it). Review it again.');
  } else if (!allowedActions(finding).includes(decision.kind)) {
    blockers.push(`This action is no longer allowed: the finding is ${finding.status.replace('_', ' ')}.`);
  }
  if (writes(decision.kind) && (!eventId || !ctx.eventPoints.has(eventId))) blockers.push('The event for this row no longer exists.');
  if (targetId && !member) blockers.push('The chosen member no longer exists.');
  if (member && (decision.kind === 'restore' || decision.kind === 'reassign') && memberCheck(member) !== decision.memberCheck) {
    needsReconfirm = true;
    blockers.push("The member's name, email, college or year changed since you staged this. Re-confirm the identity.");
  }
  if (decision.kind === 'reassign') {
    if (finding && finding.record.attendance_member_id !== decision.fromMemberId) {
      blockers.push('This row no longer credits the member you reviewed.');
    } else if (!attended(ctx, eventId, decision.fromMemberId)) {
      blockers.push('The original member no longer has this attendance, so this is not a wrong match any more.');
    }
  }
  if (decision.kind === 'create_member') {
    const invalid = validatePlan({ action: 'create_member', newMember: decision.newMember });
    if (invalid) blockers.push(invalid);
    const holder = decision.newMember.email ? ctx.emailHolders.get(decision.newMember.email) : undefined;
    if (holder) blockers.push(`${memberName(holder)} already has this email. Match that member, or create without an email.`);
    if (ctx.roster) {
      similar = similarMembers(decision.newMember.first_name, decision.newMember.last_name, ctx.roster);
      if (similar.length > 0) {
        const names = similar.slice(0, 3).map(memberName).join(', ');
        if (decision.origin === 'bulk') blockers.push(`Similar members exist (${names}). Decide this row individually.`);
        else warnings.push(`Similar members exist (${names}). You confirmed this is a different person.`);
      }
    }
  }
  if (decision.kind === 'dismiss' || decision.kind === 'needs_info') {
    const invalid = validatePlan(decision.kind === 'dismiss'
      ? { action: 'dismiss', reason: decision.reason, note: decision.note }
      : { action: 'needs_info', note: decision.note });
    if (invalid) blockers.push(invalid);
  }
  if (decision.issue?.status === 'unknown') warnings.push('The last attempt got no answer. Applying again replays it safely.');

  const alreadyHas = !!targetId && attended(ctx, eventId, targetId);
  const points = writes(decision.kind) && !alreadyHas && eventId ? ctx.eventPoints.get(eventId) ?? 0 : 0;
  const group: ReviewGroup = decision.kind === 'restore' ? (alreadyHas ? 'already_recorded' : 'credit')
    : decision.kind === 'create_member' ? 'create'
    : decision.kind === 'reassign' ? 'investigate'
    : decision.kind;
  if (decision.kind === 'reassign' && alreadyHas) warnings.push('The correct member already has this attendance, so nothing is added; the original is still flagged.');
  return {
    decision, finding, group, blockers, warnings, needsReconfirm,
    requiresAck: group === 'already_recorded', member, from, similar, points,
  };
}

function blockGroups(items: readonly ReviewItem[], keyOf: (item: ReviewItem) => string[], check: (group: ReviewItem[]) => string | null) {
  const groups = new Map<string, ReviewItem[]>();
  items.forEach((item) => keyOf(item).forEach((key) => groups.set(key, [...(groups.get(key) ?? []), item])));
  groups.forEach((group) => {
    if (group.length < 2) return;
    const message = check(group);
    if (message) group.forEach((item) => { if (!item.blockers.includes(message)) item.blockers.push(message); });
  });
}

const sheetRows = (group: readonly ReviewItem[]) => group.map((item) => item.finding?.sheetRow ?? '?').join(', ');
const eventOf = (item: ReviewItem) => item.finding?.record.event_id ?? item.decision.eventId ?? '';
const csvEmail = (item: ReviewItem) => normEmail(item.finding?.record.csv_email);

export function buildBatchReview(decisions: readonly StagedDecision[], ctx: ReviewContext): ReviewItem[] {
  const items = decisions.map((decision) => reviewOne(decision, ctx));
  const writing = items.filter((item) => writes(item.decision.kind));

  // One member, one event, one credit.
  blockGroups(writing, (item) => {
    const id = creditedMemberId(item.decision);
    return id && eventOf(item) ? [`${id}|${eventOf(item)}`] : [];
  }, (group) => `Sheet rows ${sheetRows(group)} would all credit the same member for this event. Keep one; dismiss the others as duplicates.`);

  // Rows that look like one person (same email, or same name without
  // contradicting emails) at one event must go to one place.
  const distinctTargets = (group: ReviewItem[]) => new Set(group.map((item) => targetKey(item.decision))).size > 1;
  blockGroups(writing, (item) => (csvEmail(item) ? [`${eventOf(item)}|e:${csvEmail(item)}`] : []),
    (group) => (distinctTargets(group) ? `Sheet rows ${sheetRows(group)} share an email but are staged to different members.` : null));
  blockGroups(writing, (item) => {
    const name = foldName(item.finding?.record.display_name);
    return name ? [`${eventOf(item)}|n:${name}`] : [];
  }, (group) => {
    const emails = new Set(group.map(csvEmail).filter(Boolean));
    const contradict = emails.size > 1;
    return !contradict && distinctTargets(group) ? `Sheet rows ${sheetRows(group)} have the same name but are staged to different members.` : null;
  });

  // Across events: one email is one person, so it cannot be "new" in one row
  // and an existing member (or a different new member) in another.
  blockGroups(writing, (item) => {
    const emails = new Set([csvEmail(item), item.decision.kind === 'create_member' ? item.decision.newMember.email : ''].filter(Boolean));
    return Array.from(emails).map((email) => `e:${email}`);
  }, (group) => {
    const creates = group.filter((item) => item.decision.kind === 'create_member').length;
    const members = new Set(group.map((item) => creditedMemberId(item.decision)).filter(Boolean));
    if (creates > 1) return 'Another staged new member has this email. Create the person once, then match the other rows to them.';
    if (creates === 1 && members.size > 0) return 'This email is staged as a new member in one row and as an existing member in another.';
    if (members.size > 1) return 'This email is staged to different existing members in different rows.';
    return null;
  });
  // One new member per name in a batch (emails are covered above).
  blockGroups(writing.filter((item) => item.decision.kind === 'create_member'), (item) =>
    (item.decision.kind === 'create_member'
      ? [`n:${foldName(`${item.decision.newMember.first_name} ${item.decision.newMember.last_name}`)}`]
      : []),
  () => 'Another staged new member has the same name. Create the person once, then match the other rows to them.');

  // Near-identical new members ("Tony Nguyen" / "Tony Ngyuen") in one batch.
  const creates = writing.filter((item) => item.decision.kind === 'create_member');
  const asMember = (item: ReviewItem): MemberSnapshot => {
    const nm = (item.decision as Extract<StagedDecision, { kind: 'create_member' }>).newMember;
    return { id: item.decision.rowId, first_name: nm.first_name, last_name: nm.last_name, email: nm.email || null, college: null, year: null, points: 0, events_attended: 0 };
  };
  creates.forEach((item) => {
    const self = asMember(item);
    const fullName = foldName(`${self.first_name} ${self.last_name}`);
    const near = similarMembers(self.first_name, self.last_name, creates.filter((other) => other !== item).map(asMember))
      .filter((other) => foldName(`${other.first_name} ${other.last_name}`) !== fullName);
    if (near.length === 0) return;
    const message = `Similar to another staged new member (${near.slice(0, 3).map(memberName).join(', ')}). Create the person once.`;
    if (item.decision.origin === 'bulk') item.blockers.push(message);
    else item.warnings.push(`${message} You confirmed these are different people.`);
  });

  return items.map((item) => (item.blockers.length > 0 ? { ...item, group: 'blocked' as const } : item));
}

export interface MemberTotal {
  member: MemberSnapshot;
  pointsBefore: number;
  pointsAfter: number;
  eventsBefore: number;
  eventsAfter: number;
}

export interface LedgerSummary {
  attendanceAdded: number;
  pointsAdded: number;
  membersCreated: number;
  alreadyRecorded: number;
  originalsFlagged: number;
  dismissed: number;
  onHold: number;
  blocked: number;
  excluded: number;
  /** Always zero: recovery never deletes attendance. */
  attendanceRemoved: 0;
  /** Existing members whose cached totals change, summed across every event in the batch. */
  memberTotals: MemberTotal[];
}

/** Items that will actually be sent: not blocked, not excluded, acknowledged where required. */
export function applicableItems(items: readonly ReviewItem[], excluded: ReadonlySet<string>, acknowledged: ReadonlySet<string>): ReviewItem[] {
  return items.filter((item) =>
    item.group !== 'blocked'
    && !excluded.has(item.decision.rowId)
    && (!item.requiresAck || acknowledged.has(item.decision.rowId)));
}

/** Exact ledger effects of what will be sent. */
export function summarizeLedger(items: readonly ReviewItem[], excluded: ReadonlySet<string> = new Set(), acknowledged: ReadonlySet<string> = new Set()): LedgerSummary {
  const sending = applicableItems(items, excluded, acknowledged);
  const totals = new Map<string, MemberTotal>();
  const summary: LedgerSummary = {
    attendanceAdded: 0, pointsAdded: 0, membersCreated: 0, alreadyRecorded: 0, originalsFlagged: 0,
    dismissed: 0, onHold: 0, blocked: items.filter((item) => item.group === 'blocked').length,
    excluded: items.length - sending.length - items.filter((item) => item.group === 'blocked').length,
    attendanceRemoved: 0, memberTotals: [],
  };
  sending.forEach((item) => {
    if (item.group === 'already_recorded') summary.alreadyRecorded += 1;
    if (item.group === 'create') summary.membersCreated += 1;
    if (item.group === 'investigate') summary.originalsFlagged += 1;
    if (item.group === 'dismiss') summary.dismissed += 1;
    if (item.group === 'needs_info') summary.onHold += 1;
    const adds = item.group === 'credit' || item.group === 'create' || (item.group === 'investigate' && item.points > 0);
    if (!adds) return;
    summary.attendanceAdded += 1;
    summary.pointsAdded += item.points;
    if (item.member) {
      const entry = totals.get(item.member.id) ?? {
        member: item.member, pointsBefore: item.member.points, pointsAfter: item.member.points,
        eventsBefore: item.member.events_attended, eventsAfter: item.member.events_attended,
      };
      entry.pointsAfter += item.points;
      entry.eventsAfter += 1;
      totals.set(item.member.id, entry);
    }
  });
  summary.memberTotals = Array.from(totals.values()).sort((a, b) => memberName(a.member).localeCompare(memberName(b.member)));
  return summary;
}

/** One line per database change for an item. */
export function describeItem(item: ReviewItem, eventName: string): string[] {
  const pts = (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`;
  const history = 'Recovery history and Admin activity entries are appended.';
  const { decision } = item;
  switch (decision.kind) {
    case 'restore':
      return item.group === 'already_recorded'
        ? [`No attendance added: ${item.member ? memberName(item.member) : 'the member'} already has ${eventName}.`, history]
        : [`Add attendance: ${item.member ? memberName(item.member) : 'the member'} × ${eventName}, ${pts(item.points)} (expected).`, history];
    case 'create_member':
      return [
        `Create member ${`${decision.newMember.first_name} ${decision.newMember.last_name}`.trim()}${decision.newMember.email ? ` <${decision.newMember.email}>` : ', no email'}.`,
        `Add attendance: the new member × ${eventName}, ${pts(item.points)} (expected).`,
        history,
      ];
    case 'reassign':
      return [
        `Keep ${item.from ? memberName(item.from) : 'the original member'}'s attendance and flag it for investigation. Nothing is removed.`,
        item.points > 0
          ? `Add attendance: ${item.member ? memberName(item.member) : 'the member'} × ${eventName}, ${pts(item.points)} (expected).`
          : `${item.member ? memberName(item.member) : 'The member'} already has ${eventName}; nothing added.`,
        history,
      ];
    case 'dismiss':
      return [`Dismiss (${decision.reason.replace(/_/g, ' ')})${decision.note ? `: “${decision.note}”` : ''}. No attendance or member changes.`, history];
    default:
      return [`Put on hold: “${decision.note}”. No attendance or member changes.`, history];
  }
}

// ─── Execution ──────────────────────────────────────────────────────────────

export type ApplyStatus = 'applied' | 'replayed' | 'conflict' | 'failed' | 'unknown';

export interface ApplyItemResult {
  rowId: string;
  status: ApplyStatus;
  result?: RecoverResult;
  message: string;
}

/** Hard cap per batch; each item is one request. */
export const MAX_BATCH = 200;

const CONFLICT_HINTS = new Set(['stale_finding', 'finding_closed', 'row_already_credited', 'original_missing', 'original_still_credited']);
/** Codes after which the transaction certainly rolled back (or the request was never sent). */
const ROLLED_BACK = new Set(['P0001', '42501', '23505', '23503', '23502', '22P02', '57014', 'PGRST301', 'PGRST302', 'over_request_rate_limit']);

/**
 * `conflict`: refused because state moved; never retried automatically.
 * `failed`: refused for another reason, or never sent; nothing written.
 * `unknown`: no answer (network, 5xx); it may have committed, so the same
 * request id and payload are kept and a retry replays instead of writing twice.
 */
export function classifyApplyError(error: unknown): { status: ApplyStatus; message: string } {
  const record = error && typeof error === 'object' ? (error as { hint?: unknown; code?: unknown; message?: unknown }) : {};
  const message = typeof record.message === 'string' && record.message ? record.message : 'The change was not applied.';
  if (emailConflictMemberId(error)) return { status: 'conflict', message };
  if (typeof record.hint === 'string' && CONFLICT_HINTS.has(record.hint)) return { status: 'conflict', message };
  if (typeof record.code === 'string' && ROLLED_BACK.has(record.code)) {
    if (record.code === '57014') return { status: 'failed', message: 'The database timed out, so nothing was written. Applying again is safe.' };
    if (record.code === 'over_request_rate_limit') return { status: 'failed', message: 'Paused by the request limiter, so this was not sent. Apply again in a minute.' };
    if (record.code === '42501') return { status: 'failed', message: "You don't have permission to do that." };
    return { status: 'failed', message };
  }
  return { status: 'unknown', message: "No answer from the server. It may have been applied; applying again is safe and won't write twice." };
}

/**
 * A staged row whose request id is already in the history committed earlier
 * (its response was lost). Check this before staleness: it is applied, not stale.
 */
export function committedRowIds(
  staged: readonly StagedDecision[],
  actions: ReadonlyArray<Pick<RecoveryActionRecord, 'request_id' | 'import_job_row_id'>>,
): Set<string> {
  const committed = new Set(actions.map((action) => `${action.request_id}|${action.import_job_row_id}`));
  return new Set(staged.filter((d) => committed.has(`${d.requestId}|${d.rowId}`)).map((d) => d.rowId));
}

/**
 * Applies decisions with bounded concurrency. Decisions crediting the same
 * member run in one lane, one after another, so a batch never queues on its
 * own member lock. Never throws; every row gets a result.
 */
export async function applyBatch(
  decisions: readonly StagedDecision[],
  recover: (request: RecoverRequest) => Promise<RecoverResult>,
  options: { concurrency?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<ApplyItemResult[]> {
  const lanes = new Map<string, StagedDecision[]>();
  decisions.slice(0, MAX_BATCH).forEach((decision) => {
    const key = creditedMemberId(decision) ?? `row:${decision.rowId}`;
    lanes.set(key, [...(lanes.get(key) ?? []), decision]);
  });
  const queue = Array.from(lanes.values());
  const total = queue.reduce((sum, lane) => sum + lane.length, 0);
  const results: ApplyItemResult[] = [];
  let done = 0;
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 2, 3));

  const worker = async () => {
    for (let lane = queue.shift(); lane; lane = queue.shift()) {
      for (const decision of lane) {
        try {
          const result = await recover(toRecoverRequest(decision));
          results.push({ rowId: decision.rowId, status: result.replayed ? 'replayed' : 'applied', result, message: '' });
        } catch (error) {
          results.push({ rowId: decision.rowId, ...classifyApplyError(error) });
        }
        done += 1;
        options.onProgress?.(done, total);
      }
    }
  };
  options.onProgress?.(0, total);
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  return results;
}

/** Applied rows leave staging; the rest stay, marked, with their request id and payload kept. */
export function reconcileStaging(staged: readonly StagedDecision[], results: readonly ApplyItemResult[], now = Date.now()): StagedDecision[] {
  const byRow = new Map(results.map((result) => [result.rowId, result]));
  return staged.flatMap((decision) => {
    const result = byRow.get(decision.rowId);
    if (!result) return [decision];
    if (result.status === 'applied' || result.status === 'replayed') return [];
    return [{ ...decision, issue: { status: result.status as 'conflict' | 'failed' | 'unknown', message: result.message, at: now } }];
  });
}

/**
 * Longer than the database statement timeout (8 s) plus lock waits, with a wide
 * margin: until then a request with no answer may still be running.
 */
export const UNKNOWN_GRACE_MS = 2 * 60 * 1000;

/**
 * Rows whose last attempt got no answer, whose request id is not in the fresh
 * history, and whose attempt is old enough that it can no longer be running:
 * it never committed, so they may be edited again. Younger ones stay locked;
 * applying them again resends the same request, which replays if it landed.
 */
export function unlockableUnknown(staged: readonly StagedDecision[], committed: ReadonlySet<string>, now = Date.now()): Set<string> {
  return new Set(staged
    .filter((d) => d.issue?.status === 'unknown' && !committed.has(d.rowId) && now - (d.issue.at ?? 0) >= UNKNOWN_GRACE_MS)
    .map((d) => d.rowId));
}

export interface ApplySummary {
  applied: number;
  replayed: number;
  conflict: number;
  failed: number;
  unknown: number;
  pointsAwarded: number;
  membersCreated: number;
}

export function summarizeResults(results: readonly ApplyItemResult[]): ApplySummary {
  const summary: ApplySummary = { applied: 0, replayed: 0, conflict: 0, failed: 0, unknown: 0, pointsAwarded: 0, membersCreated: 0 };
  results.forEach((item) => {
    summary[item.status] += 1;
    if (item.status === 'applied' && item.result) {
      summary.pointsAwarded += item.result.points_awarded;
      if (item.result.created_member) summary.membersCreated += 1;
    }
  });
  return summary;
}

/** "Applied 9 of 12. 2 conflicts, 1 unknown." — never a bare "Done". */
export function resultHeadline(summary: ApplySummary): string {
  const total = summary.applied + summary.replayed + summary.conflict + summary.failed + summary.unknown;
  const ok = summary.applied + summary.replayed;
  const problems = [
    summary.conflict && `${summary.conflict} conflict${summary.conflict === 1 ? '' : 's'}`,
    summary.failed && `${summary.failed} failed`,
    summary.unknown && `${summary.unknown} with no answer`,
  ].filter(Boolean).join(', ');
  if (total === 0) return 'Nothing was applied.';
  if (ok === total) return `Applied all ${total} change${total === 1 ? '' : 's'}.`;
  if (ok === 0) return `None of the ${total} changes were applied: ${problems}.`;
  return `Applied ${ok} of ${total} changes. ${problems}; those rows stay staged.`;
}

// ─── Cached-total drift (read-only check) ───────────────────────────────────

export interface TotalDrift {
  member: MemberSnapshot;
  ledgerPoints: number;
  ledgerEvents: number;
}

/**
 * Members whose cached totals disagree with their attendance rows. A writer
 * outside recovery committing at the same moment can leave the cached total
 * stale (the ledger stays correct). Reported only; nothing writes totals.
 */
export function findTotalDrift(
  members: readonly MemberSnapshot[],
  attendance: ReadonlyArray<{ member_id: string; points_earned: number }>,
): TotalDrift[] {
  const sums = new Map<string, { points: number; events: number }>();
  attendance.forEach((row) => {
    const entry = sums.get(row.member_id) ?? { points: 0, events: 0 };
    entry.points += row.points_earned ?? 0;
    entry.events += 1;
    sums.set(row.member_id, entry);
  });
  return members
    .map((member) => ({ member, ledgerPoints: sums.get(member.id)?.points ?? 0, ledgerEvents: sums.get(member.id)?.events ?? 0 }))
    .filter((d) => d.ledgerPoints !== d.member.points || d.ledgerEvents !== d.member.events_attended);
}
