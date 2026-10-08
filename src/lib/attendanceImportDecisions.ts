// Pure decision logic for the attendance import preview.
//
// Matching proposes; an admin decides. A row's decision is one of:
//   match  - credit a specific existing member (chosen explicitly)
//   new    - confirm this is a different person and create a member
//   skip   - leave the row out of this import
// Nothing here writes to the database, and no unresolved row is ever turned
// into a match or a new member on the admin's behalf.
import {
  AttendanceImportMember,
  AttendanceMatchResult,
  AttendanceImportStatus,
  normalizeEmail,
} from './memberMatching';

export type RowDecision =
  | { kind: 'match'; memberId: string }
  | { kind: 'new' }
  | { kind: 'skip' };

export type EffectiveStatus = AttendanceImportStatus | 'skipped' | 'invalid';

export interface DecisionRow<M extends AttendanceImportMember = AttendanceImportMember>
  extends Omit<AttendanceMatchResult, 'matchedMember'> {
  matchedMember: M | null;
  decision: RowDecision | null;
}

export interface ResolvedRow<M extends AttendanceImportMember> {
  status: EffectiveStatus;
  /** The member who will receive attendance when status is 'match' or 'already'. */
  member: M | null;
}

export interface DecisionContext<M extends AttendanceImportMember> {
  membersById: ReadonlyMap<string, M>;
  /** Members who already have attendance for the selected event. */
  alreadyMemberIds: ReadonlySet<string>;
}

export function hasImportableName(row: Pick<AttendanceMatchResult, 'displayName'>): boolean {
  return row.displayName.trim().length > 0;
}

/** Which member the admin chose, if the choice is one this row actually offers. */
function chosenCandidate<M extends AttendanceImportMember>(
  row: DecisionRow<M>,
  ctx: DecisionContext<M>,
): M | null {
  if (row.decision?.kind !== 'match' || row.status !== 'review' || !row.canForceMatch) return null;
  const { memberId } = row.decision;
  if (!row.candidateMemberIds.includes(memberId)) return null;
  return ctx.membersById.get(memberId) ?? null;
}

export function resolveRow<M extends AttendanceImportMember>(
  row: DecisionRow<M>,
  ctx: DecisionContext<M>,
): ResolvedRow<M> {
  if (!hasImportableName(row)) return { status: 'invalid', member: null };
  if (row.status === 'duplicate') return { status: 'duplicate', member: null };

  const { decision } = row;
  if (decision?.kind === 'skip' && row.status !== 'already') return { status: 'skipped', member: null };
  if (decision?.kind === 'new' && row.canMarkNew) return { status: 'new', member: null };

  const chosen = chosenCandidate(row, ctx);
  if (chosen) {
    return { status: ctx.alreadyMemberIds.has(chosen.id) ? 'already' : 'match', member: chosen };
  }

  if (row.status === 'review') return { status: 'review', member: null };
  return { status: row.status, member: row.matchedMember };
}

export interface AttendanceImportSummary {
  /** Rows with a usable name. */
  validRows: number;
  /** Distinct existing members who will receive attendance. */
  existingMembers: number;
  newMembers: number;
  alreadyRecorded: number;
  /** Repeat rows in the file, including rows resolving to a member another row already covers. */
  duplicatesSkipped: number;
  unresolved: number;
  skipped: number;
  /** Rows with no name; never imported. */
  invalid: number;
}

export function summarizeAttendanceImport<M extends AttendanceImportMember>(
  rows: readonly DecisionRow<M>[],
  ctx: DecisionContext<M>,
): AttendanceImportSummary {
  const summary: AttendanceImportSummary = {
    validRows: 0,
    existingMembers: 0,
    newMembers: 0,
    alreadyRecorded: 0,
    duplicatesSkipped: 0,
    unresolved: 0,
    skipped: 0,
    invalid: 0,
  };
  const credited = new Set<string>();

  for (const row of rows) {
    const { status, member } = resolveRow(row, ctx);
    if (status === 'invalid') {
      summary.invalid += 1;
      continue;
    }
    summary.validRows += 1;
    if (status === 'match' && member) {
      if (credited.has(member.id)) summary.duplicatesSkipped += 1;
      else {
        credited.add(member.id);
        summary.existingMembers += 1;
      }
    } else if (status === 'new') summary.newMembers += 1;
    else if (status === 'already') summary.alreadyRecorded += 1;
    else if (status === 'duplicate') summary.duplicatesSkipped += 1;
    else if (status === 'review') summary.unresolved += 1;
    else if (status === 'skipped') summary.skipped += 1;
  }
  return summary;
}

export interface PlannedNewMember<R> {
  row: R;
  first_name: string;
  last_name: string;
  college: string | null;
  year: string | null;
  email: string | null;
  /** The CSV email was left off because another member (or earlier new row) already has it. */
  emailWithheld: boolean;
}

export interface AttendanceWritePlan<R, M extends AttendanceImportMember> {
  /** One entry per distinct existing member receiving attendance. */
  updates: { row: R; member: M }[];
  creates: PlannedNewMember<R>[];
}

/**
 * What an import would write, from the latest member list. A new member never
 * takes an email another member already holds; it is created without one so the
 * admin can resolve the duplicate on the Members page.
 */
export function planAttendanceWrites<M extends AttendanceImportMember, R extends DecisionRow<M>>(
  rows: readonly R[],
  ctx: DecisionContext<M>,
  latestMembers: readonly AttendanceImportMember[],
): AttendanceWritePlan<R, M> {
  const takenEmails = new Set(latestMembers.map((m) => normalizeEmail(m.email)).filter(Boolean));
  const credited = new Set<string>();
  const plan: AttendanceWritePlan<R, M> = { updates: [], creates: [] };

  for (const row of rows) {
    const { status, member } = resolveRow(row, ctx);
    if (status === 'match' && member) {
      if (credited.has(member.id)) continue;
      credited.add(member.id);
      plan.updates.push({ row, member });
    } else if (status === 'new') {
      const parts = row.displayName.trim().split(/\s+/);
      const email = normalizeEmail(row.csvEmail);
      const emailWithheld = !!email && takenEmails.has(email);
      if (email) takenEmails.add(email);
      plan.creates.push({
        row,
        first_name: parts[0] ?? '',
        last_name: parts.slice(1).join(' ') || '—',
        college: row.csvCollege || null,
        year: row.csvYear || null,
        email: email && !emailWithheld ? email : null,
        emailWithheld,
      });
    }
  }
  return plan;
}

/** Whether a new member's CSV email is already on file, so the admin can be told before confirming. */
export function emailHeldByOthers(
  csvEmail: string,
  members: readonly AttendanceImportMember[],
): AttendanceImportMember[] {
  const email = normalizeEmail(csvEmail);
  if (!email) return [];
  return members.filter((m) => normalizeEmail(m.email) === email);
}
