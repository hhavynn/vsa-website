// Pure decision logic for the attendance import preview.
//
// Matching proposes; an admin decides. A row's decision is one of:
//   match  - credit a specific existing member (chosen explicitly)
//   new    - confirm this is a different person and create a member
//   skip   - leave the row out of this import
// Nothing here writes to the database, and no unresolved row is ever turned
// into a match or a new member on the admin's behalf. planAttendanceImport
// turns the decisions into the exact request admin_apply_attendance_import
// receives, so the preview summary and the write are the same plan.
import { normalizeEmail } from './memberMatching';
import type {
  AliasPlan,
  IdentityMember,
  IdentityResult,
  IdentityStatus,
} from './identityResolution';
import { planYearAdvance, YearObservation } from './yearStanding';
import { OFFICIAL_YEARS } from './yearNormalizer';

export type RowDecision =
  | { kind: 'match'; memberId: string; /** Also remember the row's new email for this member (default yes). */ rememberEmail?: boolean }
  | { kind: 'new' }
  | { kind: 'skip' };

export type EffectiveStatus = IdentityStatus | 'skipped' | 'invalid';

export type DecisionRow<M extends IdentityMember = IdentityMember> = IdentityResult<M> & {
  decision: RowDecision | null;
};

export interface ResolvedRow<M extends IdentityMember> {
  status: EffectiveStatus;
  /** The member who will receive attendance when status is 'match' or 'already'. */
  member: M | null;
  /** The admin chose this member themselves. */
  adminConfirmed: boolean;
}

export interface DecisionContext<M extends IdentityMember> {
  membersById: ReadonlyMap<string, M>;
  /** Members who already have attendance for the selected event. */
  alreadyMemberIds: ReadonlySet<string>;
  /** Every row, for resolving repeats against the row they repeat. */
  rowsById: ReadonlyMap<string, DecisionRow<M>>;
}

export function hasImportableName(row: Pick<IdentityResult, 'displayName'>): boolean {
  return row.displayName.trim().length > 0;
}

function credits(status: EffectiveStatus): boolean {
  return status === 'match' || status === 'already' || status === 'new';
}

/**
 * A repeat row stands only while the row it repeats is imported (and, for a
 * repeat of a member, still credits that member). Otherwise it comes back as a
 * row to decide, so skipping the first row never silently drops the person.
 */
export function duplicateInEffect<M extends IdentityMember>(row: DecisionRow<M>, ctx: DecisionContext<M>): boolean {
  if (row.status !== 'duplicate' || !row.duplicateOf || row.decision) return false;
  const primary = ctx.rowsById.get(row.duplicateOf);
  if (!primary) return false;
  const resolved = resolveRow(primary, ctx);
  if (!credits(resolved.status)) return false;
  if (row.matchedMember) return resolved.member?.id === row.matchedMember.id;
  return true;
}

/**
 * Whether an admin's Match Existing also remembers the row's new email unless
 * they untick it: only when the chosen member's name matches outright (or with
 * a middle name added or left out). For a similar or shortened name it is opt-in.
 */
export function rememberEmailByDefault(row: Pick<IdentityResult, 'candidates'>, memberId: string): boolean {
  const relation = row.candidates.find((c) => c.member.id === memberId)?.name;
  return relation === 'exact' || relation === 'middle_omitted';
}

function chosenCandidate<M extends IdentityMember>(row: DecisionRow<M>, ctx: DecisionContext<M>): M | null {
  if (row.decision?.kind !== 'match') return null;
  const { memberId } = row.decision;
  if (!row.candidateMemberIds.includes(memberId)) return null;
  return ctx.membersById.get(memberId) ?? null;
}

/** Whether the row is waiting on an admin (matcher review, or a repeat whose first row is not imported). */
export function rowNeedsAdmin<M extends IdentityMember>(row: DecisionRow<M>, ctx: DecisionContext<M>): boolean {
  if (!hasImportableName(row)) return false;
  if (row.status === 'review') return true;
  return row.status === 'duplicate' && !duplicateInEffect({ ...row, decision: null }, ctx);
}

export function resolveRow<M extends IdentityMember>(row: DecisionRow<M>, ctx: DecisionContext<M>): ResolvedRow<M> {
  const none = { member: null, adminConfirmed: false };
  if (!hasImportableName(row)) return { status: 'invalid', ...none };
  const decidable = row.status !== 'duplicate' || rowNeedsAdmin(row, ctx);
  if (!decidable) return { status: 'duplicate', ...none };

  const { decision } = row;
  if (decision?.kind === 'skip' && row.status !== 'already') return { status: 'skipped', ...none };
  if (decision?.kind === 'new' && (row.canMarkNew || row.status === 'duplicate')) return { status: 'new', ...none };

  const chosen = chosenCandidate(row, ctx);
  if (chosen) {
    return { status: ctx.alreadyMemberIds.has(chosen.id) ? 'already' : 'match', member: chosen, adminConfirmed: true };
  }

  if (row.status === 'review' || row.status === 'duplicate') return { status: 'review', ...none };
  return { status: row.status, member: row.matchedMember, adminConfirmed: false };
}

export interface AttendanceImportSummary {
  /** Rows with a usable name. */
  validRows: number;
  /** Distinct existing members who will receive attendance. */
  existingMembers: number;
  /** ...of which the matcher identified on its own. */
  autoMatched: number;
  /** ...of which an admin chose. */
  adminConfirmed: number;
  newMembers: number;
  alreadyRecorded: number;
  /** Repeat rows in the file, including rows resolving to a member another row already covers. */
  duplicatesSkipped: number;
  unresolved: number;
  skipped: number;
  /** Rows with no name; never imported. */
  invalid: number;
}

export function summarizeAttendanceImport<M extends IdentityMember>(
  rows: readonly DecisionRow<M>[],
  ctx: DecisionContext<M>,
): AttendanceImportSummary {
  const summary: AttendanceImportSummary = {
    validRows: 0, existingMembers: 0, autoMatched: 0, adminConfirmed: 0, newMembers: 0,
    alreadyRecorded: 0, duplicatesSkipped: 0, unresolved: 0, skipped: 0, invalid: 0,
  };
  const credited = new Set<string>();

  for (const row of rows) {
    const { status, member, adminConfirmed } = resolveRow(row, ctx);
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
        if (adminConfirmed) summary.adminConfirmed += 1;
        else summary.autoMatched += 1;
      }
    } else if (status === 'new') summary.newMembers += 1;
    else if (status === 'already') summary.alreadyRecorded += 1;
    else if (status === 'duplicate') summary.duplicatesSkipped += 1;
    else if (status === 'review') summary.unresolved += 1;
    else if (status === 'skipped') summary.skipped += 1;
  }
  return summary;
}

// ── Write plan ────────────────────────────────────────────────────────────────

export interface PlannedCredit<R, M extends IdentityMember> {
  row: R;
  member: M;
  adminConfirmed: boolean;
  /** Attendance already exists; only profile and identity updates apply. */
  alreadyAttended: boolean;
  fill: { college?: string; email?: string };
  year: { from: string | null; to: string } | null;
  aliases: AliasPlan[];
  observedYear: string | null;
  /** Automatic matches: every same-name member the preview saw (the import refuses if another appears). */
  knownSameNameIds: string[] | null;
  /** Known-email matches: the addresses that identified the member, rechecked before writing. */
  evidenceEmails: string[];
}

export interface PlannedCreate<R> {
  row: R;
  first_name: string;
  last_name: string;
  college: string | null;
  year: string | null;
  email: string | null;
  /** The row's email was left off because a member already holds it. */
  emailWithheld: boolean;
  aliases: AliasPlan[];
  observedYear: string | null;
  knownSameNameIds: string[];
}

export interface AttendanceImportPlan<R, M extends IdentityMember> {
  /** One entry per distinct existing member receiving attendance, or with updates if already credited. */
  credits: PlannedCredit<R, M>[];
  creates: PlannedCreate<R>[];
  /** Rows whose address was meant for two people in this file; it is remembered for neither. */
  aliasConflictRowIds: string[];
}

export interface PlanContext {
  /** Every address an existing member holds (aliases and primary emails), normalized. */
  heldEmails: ReadonlySet<string>;
  observations: readonly YearObservation[];
  eventAcademicYear: number | null;
}

function observedYear(row: Pick<IdentityResult, 'csvYear' | 'invalidYear'>): string | null {
  return row.csvYear && !row.invalidYear && OFFICIAL_YEARS.includes(row.csvYear) ? row.csvYear : null;
}

const dedupeAliases = (aliases: AliasPlan[]) => aliases.filter((a, i) => aliases.findIndex((b) => b.email === a.email) === i);

/**
 * What an import would write. Built from the preview's snapshot; the database
 * function rechecks every assumption here before writing anything.
 */
export function planAttendanceImport<M extends IdentityMember, R extends DecisionRow<M>>(
  rows: readonly R[],
  ctx: DecisionContext<M>,
  planCtx: PlanContext,
): AttendanceImportPlan<R, M> {
  const plan: AttendanceImportPlan<R, M> = { credits: [], creates: [], aliasConflictRowIds: [] };
  const creditByMember = new Map<string, PlannedCredit<R, M>>();
  const createByRow = new Map<string, PlannedCreate<R>>();
  const observationsByMember = new Map<string, YearObservation[]>();
  planCtx.observations.forEach((o) => observationsByMember.set(o.member_id, [...(observationsByMember.get(o.member_id) ?? []), o]));
  const unheld = (emails: readonly string[]) => emails.map(normalizeEmail).filter((e) => e && !planCtx.heldEmails.has(e));

  for (const row of rows) {
    const resolved = resolveRow(row, ctx);
    if ((resolved.status === 'match' || resolved.status === 'already') && resolved.member) {
      const member = resolved.member;
      const existing = creditByMember.get(member.id);
      if (existing) {
        // Attendance is credited once, but a later row an admin matched to the
        // same member still confirms its own addresses.
        const remembers = resolved.adminConfirmed && row.decision?.kind === 'match'
          && (row.decision.rememberEmail ?? rememberEmailByDefault(row, member.id));
        if (remembers) existing.aliases.push(...unheld(row.emails).map((email) => ({ email, method: 'admin_confirmed' as const })));
        continue;
      }
      const automatic = !resolved.adminConfirmed;
      const remember = resolved.adminConfirmed && row.decision?.kind === 'match'
        && (row.decision.rememberEmail ?? rememberEmailByDefault(row, member.id));
      const aliases: AliasPlan[] = automatic
        ? row.aliasPlan.filter((a) => !planCtx.heldEmails.has(a.email))
        : remember ? unheld(row.emails).map((email) => ({ email, method: 'admin_confirmed' as const })) : [];
      const fill: PlannedCredit<R, M>['fill'] = {};
      if (automatic && !member.college && row.csvCollege) fill.college = row.csvCollege;
      // A filled contact email becomes an alias through the database trigger, so
      // it needs the same confirmation as one: name + college + year.
      const confirmed = aliases.find((a) => a.method === 'unique_name_college_year');
      if (automatic && !normalizeEmail(member.email) && confirmed) fill.email = confirmed.email;
      const to = planYearAdvance(member.year, row.csvYear, row.invalidYear, observationsByMember.get(member.id) ?? [], planCtx.eventAcademicYear);
      const credit: PlannedCredit<R, M> = {
        row,
        member,
        adminConfirmed: resolved.adminConfirmed,
        alreadyAttended: resolved.status === 'already',
        fill,
        year: to ? { from: member.year, to } : null,
        aliases,
        observedYear: observedYear(row),
        knownSameNameIds: automatic ? row.sameNameIds : null,
        evidenceEmails: automatic && row.reason === 'known_email'
          ? row.emails.map(normalizeEmail).filter((e) => planCtx.heldEmails.has(e))
          : [],
      };
      creditByMember.set(member.id, credit);
      plan.credits.push(credit);
    } else if (resolved.status === 'new') {
      const [primary, ...others] = row.emails.map(normalizeEmail).filter(Boolean);
      const emailWithheld = !!primary && planCtx.heldEmails.has(primary);
      const create: PlannedCreate<R> = {
        row,
        first_name: row.firstName || row.displayName.split(/\s+/)[0] || '',
        last_name: row.lastName || '—',
        college: row.csvCollege || null,
        year: row.csvYear || null,
        email: primary && !emailWithheld ? primary : null,
        emailWithheld,
        aliases: unheld(others).map((email) => ({ email, method: 'same_submission' as const })),
        observedYear: observedYear(row),
        knownSameNameIds: row.sameNameIds,
      };
      createByRow.set(row.rowId, create);
      plan.creates.push(create);
    }
  }

  // Repeats in effect pass their addresses to the row they repeat.
  for (const row of rows) {
    if (!duplicateInEffect(row, ctx)) continue;
    const fresh = row.aliasPlan.filter((a) => !planCtx.heldEmails.has(a.email));
    if (fresh.length === 0) continue;
    const primary = ctx.rowsById.get(row.duplicateOf!);
    const credit = row.matchedMember ? creditByMember.get(row.matchedMember.id) : undefined;
    const create = primary ? createByRow.get(primary.rowId) : undefined;
    // A repeat of an admin's choice confirms nothing on its own.
    if (credit && !credit.adminConfirmed) credit.aliases.push(...fresh);
    else if (!row.matchedMember && primary) {
      const primaryCredit = primary.matchedMember ? creditByMember.get(primary.matchedMember.id) : undefined;
      const target = create ?? (primaryCredit && !primaryCredit.adminConfirmed ? primaryCredit : undefined);
      target?.aliases.push(...fresh.map((a) => ({ email: a.email, method: 'same_submission' as const })));
    }
  }

  // One address, one person: an address planned for two targets is dropped from both.
  const targetsByEmail = new Map<string, Set<string>>();
  const note = (email: string | null | undefined, target: string) => {
    if (email) targetsByEmail.set(email, (targetsByEmail.get(email) ?? new Set<string>()).add(target));
  };
  plan.credits.forEach((c) => {
    note(c.fill.email, c.member.id);
    c.aliases.forEach((a) => note(a.email, c.member.id));
  });
  plan.creates.forEach((c) => {
    note(c.email, `new:${c.row.rowId}`);
    c.aliases.forEach((a) => note(a.email, `new:${c.row.rowId}`));
  });
  const contested = new Set(Array.from(targetsByEmail).filter(([, targets]) => targets.size > 1).map(([email]) => email));
  const conflictRows = new Set<string>();
  const uncontested = (rowId: string) => (a: AliasPlan) => {
    if (!contested.has(a.email)) return true;
    conflictRows.add(rowId);
    return false;
  };
  plan.credits.forEach((c) => {
    c.aliases = dedupeAliases(c.aliases.filter(uncontested(c.row.rowId)).filter((a) => a.email !== c.fill.email));
    if (c.fill.email && contested.has(c.fill.email)) {
      delete c.fill.email;
      conflictRows.add(c.row.rowId);
    }
  });
  plan.creates.forEach((c) => {
    if (c.email && contested.has(c.email)) {
      c.email = null;
      c.emailWithheld = true;
      conflictRows.add(c.row.rowId);
    }
    c.aliases = dedupeAliases(c.aliases.filter(uncontested(c.row.rowId)).filter((a) => a.email !== c.email));
  });
  plan.aliasConflictRowIds = Array.from(conflictRows);

  // Already-credited members with nothing to update are left out of the request.
  // (A recorded standing alone is not worth an import of its own.)
  plan.credits = plan.credits.filter((c) => !c.alreadyAttended || c.aliases.length > 0 || !!c.year || !!c.fill.college || !!c.fill.email);
  return plan;
}

export interface PlanTotals {
  /** Existing members receiving new attendance. */
  creditedMembers: number;
  aliasesToAdd: number;
  yearAdvances: number;
  profileFills: number;
  emailsWithheld: number;
  aliasConflicts: number;
}

export function planTotals<R, M extends IdentityMember>(plan: AttendanceImportPlan<R, M>): PlanTotals {
  return {
    creditedMembers: plan.credits.filter((c) => !c.alreadyAttended).length,
    aliasesToAdd: plan.credits.reduce((n, c) => n + c.aliases.length + (c.fill.email ? 1 : 0), 0)
      + plan.creates.reduce((n, c) => n + c.aliases.length + (c.email ? 1 : 0), 0),
    yearAdvances: plan.credits.filter((c) => c.year).length,
    profileFills: plan.credits.filter((c) => c.fill.college || c.fill.email).length,
    emailsWithheld: plan.creates.filter((c) => c.emailWithheld).length,
    aliasConflicts: plan.aliasConflictRowIds.length,
  };
}

export interface ImportRequestMeta {
  requestId: string;
  eventId: string;
  expectedPoints: number | null;
  expectedTermId: string;
}

export interface AttendanceImportRequest {
  request_id: string;
  event_id: string;
  expected_points: number | null;
  expected_term_id: string;
  credits: Array<{
    row_key: string;
    member_id: string;
    expected: { first_name: string; last_name: string; college: string | null; email: string | null };
    fill?: { college?: string; email?: string };
    year?: { from: string | null; to: string };
    aliases?: AliasPlan[];
    observed_year?: string;
    known_same_name_ids?: string[];
    evidence_emails?: string[];
  }>;
  creates: Array<{
    row_key: string;
    first_name: string;
    last_name: string;
    college: string | null;
    year: string | null;
    email: string | null;
    known_same_name_ids: string[];
    aliases?: AliasPlan[];
    observed_year?: string;
  }>;
}

/** The JSON body for admin_apply_attendance_import. */
export function toImportRequest<M extends IdentityMember>(
  plan: AttendanceImportPlan<{ rowId: string }, M>,
  meta: ImportRequestMeta,
): AttendanceImportRequest {
  return {
    request_id: meta.requestId,
    event_id: meta.eventId,
    expected_points: meta.expectedPoints,
    expected_term_id: meta.expectedTermId,
    credits: plan.credits.map((c) => ({
      row_key: c.row.rowId,
      member_id: c.member.id,
      expected: { first_name: c.member.first_name, last_name: c.member.last_name, college: c.member.college, email: c.member.email },
      ...(c.fill.college || c.fill.email ? { fill: { ...c.fill } } : {}),
      ...(c.year ? { year: c.year } : {}),
      ...(c.aliases.length ? { aliases: c.aliases } : {}),
      ...(c.observedYear ? { observed_year: c.observedYear } : {}),
      ...(c.knownSameNameIds ? { known_same_name_ids: c.knownSameNameIds } : {}),
      ...(c.evidenceEmails.length ? { evidence_emails: c.evidenceEmails } : {}),
    })),
    creates: plan.creates.map((c) => ({
      row_key: c.row.rowId,
      first_name: c.first_name,
      last_name: c.last_name,
      college: c.college,
      year: c.year,
      email: c.email,
      known_same_name_ids: c.knownSameNameIds,
      ...(c.aliases.length ? { aliases: c.aliases } : {}),
      ...(c.observedYear ? { observed_year: c.observedYear } : {}),
    })),
  };
}
