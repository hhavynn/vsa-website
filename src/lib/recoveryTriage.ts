// Triage for the recovery reconciliation workspace: which members could be the
// person on each import row, how hard the row is to decide, and what the
// evidence suggests. Pure and read-only.
//
// Rules: a suggestion to credit an existing member needs an authoritative
// identifier (the row's email equals the member's stored email). Similar names
// only ever produce "compare these", never a recommendation. Nothing here
// stages or applies anything; the admin decides every row.
import {
  DismissReason,
  MemberSnapshot,
  RecoveryFinding,
  RecoveryFindingRecord,
  allowedActions,
  memberName,
  rowCreditsMember,
} from './attendanceRecovery';
import { HistoricalKind } from './importHistoryAudit';

// ─── Normalization ──────────────────────────────────────────────────────────

/**
 * Lower-case letters and single spaces, diacritics folded. The SQL findings
 * function deletes non-ASCII letters ("Nguyễn" → "nguyn"); this keeps them as
 * their base letter ("nguyen"), so accented and plain spellings compare equal.
 */
export function foldName(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const isEmail = (value: string | null | undefined) => EMAIL.test(normEmail(value));

/** The last word of a sheet name, used to batch-look-up members by surname. */
export function lastNameToken(name: string | null | undefined): string | null {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}

/**
 * Edit distance where a swap of two adjacent letters counts as one edit
 * ("ngyuen" → "nguyen"), capped at `max + 1` (cheap early exit).
 */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let beforePrevious: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        current[j] = Math.min(current[j], beforePrevious[j - 2] + 1);
      }
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > max) return max + 1;
    beforePrevious = previous;
    previous = current;
  }
  return previous[b.length];
}

/**
 * Members whose name could be this person's: equal after folding, one edit
 * apart, first and last swapped, or the same surname with a first name that
 * is equal, a prefix (nickname) or one edit apart. Deliberately broad: it only
 * ever blocks or warns, never matches.
 */
export function similarMembers(firstName: string, lastName: string, roster: readonly MemberSnapshot[]): MemberSnapshot[] {
  const first = foldName(firstName);
  const last = foldName(lastName);
  const full = `${first} ${last}`.trim();
  if (!full) return [];
  return roster.filter((member) => {
    const mFirst = foldName(member.first_name);
    const mLast = foldName(member.last_name);
    const mFull = `${mFirst} ${mLast}`.trim();
    if (!mFull) return false;
    if (mFull === full || editDistance(mFull, full, 1) <= 1) return true;
    if (mFirst === last && mLast === first) return true;
    if (mLast === last && mLast) {
      if (!first || !mFirst) return true;
      return mFirst === first || mFirst.startsWith(first) || first.startsWith(mFirst) || editDistance(mFirst, first, 1) <= 1;
    }
    return false;
  });
}

// ─── Member lookup and candidates ───────────────────────────────────────────

export interface MemberLookup {
  byId: ReadonlyMap<string, MemberSnapshot>;
  /** Folded full name → members. */
  byName: ReadonlyMap<string, MemberSnapshot[]>;
  /** Lower-cased email → members. */
  byEmail: ReadonlyMap<string, MemberSnapshot[]>;
  /** Members with attendance for the scoped event; null while not loaded. */
  attendedIds: ReadonlySet<string> | null;
  /** Every batched lookup has loaded; until then no row is called straightforward. */
  ready: boolean;
}

export const EMPTY_LOOKUP: MemberLookup = { byId: new Map(), byName: new Map(), byEmail: new Map(), attendedIds: null, ready: false };

export function buildLookup(members: readonly MemberSnapshot[], attendedIds: ReadonlySet<string> | null, ready: boolean): MemberLookup {
  const byId = new Map<string, MemberSnapshot>();
  const byName = new Map<string, MemberSnapshot[]>();
  const byEmail = new Map<string, MemberSnapshot[]>();
  members.forEach((member) => {
    if (byId.has(member.id)) return;
    byId.set(member.id, member);
    const name = foldName(memberName(member));
    if (name) byName.set(name, [...(byName.get(name) ?? []), member]);
    const email = normEmail(member.email);
    if (email) byEmail.set(email, [...(byEmail.get(email) ?? []), member]);
  });
  return { byId, byName, byEmail, attendedIds, ready };
}

export type CandidateSource = 'audit' | 'matched' | 'same_name' | 'email';

export interface Candidate {
  member: MemberSnapshot;
  sources: CandidateSource[];
  /** The row's email equals this member's stored email: the only identity-strong signal. */
  emailMatches: boolean;
  /** Both have an email and they differ. */
  emailDiffers: boolean;
  collegeDiffers: boolean;
  yearDiffers: boolean;
  /** Has attendance for this row's event; null while unknown. */
  attended: boolean | null;
  /** Another candidate has the identical name: only email, college or year can tell them apart. */
  sharesName: boolean;
}

const differs = (a: string | null | undefined, b: string | null | undefined) =>
  !!(a ?? '').trim() && !!(b ?? '').trim() && (a ?? '').trim().toLowerCase() !== (b ?? '').trim().toLowerCase();

/**
 * Everyone who could be the person on this row: audit candidates, the matched
 * member, same-name members and the member holding the row's email. The member
 * the row currently credits is left out (that is the "original" in a wrong-match
 * review), unless the credit no longer exists.
 */
export function candidatesFor(finding: RecoveryFinding, lookup: MemberLookup): Candidate[] {
  const { record } = finding;
  const credited = rowCreditsMember(record) ? record.attendance_member_id : null;
  const sources = new Map<string, Set<CandidateSource>>();
  const add = (id: string | null | undefined, source: CandidateSource) => {
    if (!id || id === credited || !lookup.byId.has(id)) return;
    sources.set(id, (sources.get(id) ?? new Set<CandidateSource>()).add(source));
  };
  (record.candidate_member_ids ?? []).forEach((id) => add(id, 'audit'));
  add(record.matched_member_id, 'matched');
  if (!credited) add(record.attendance_member_id, 'matched');
  const name = foldName(record.display_name);
  if (name) (lookup.byName.get(name) ?? []).forEach((member) => add(member.id, 'same_name'));
  const email = normEmail(record.csv_email);
  if (email) (lookup.byEmail.get(email) ?? []).forEach((member) => add(member.id, 'email'));

  return rankCandidates(Array.from(sources.entries()).map(([id, set]) =>
    describeCandidate(lookup.byId.get(id) as MemberSnapshot, record, lookup.attendedIds, Array.from(set))));
}

/** How a member compares with the row: the evidence an admin needs to tell similar people apart. */
export function describeCandidate(
  member: MemberSnapshot,
  record: Pick<RecoveryFinding['record'], 'csv_email' | 'csv_college' | 'csv_year'>,
  attendedIds: ReadonlySet<string> | null,
  sources: CandidateSource[] = [],
): Candidate {
  const email = normEmail(record.csv_email);
  return {
    member,
    sources,
    emailMatches: !!email && normEmail(member.email) === email,
    emailDiffers: !!email && !!normEmail(member.email) && normEmail(member.email) !== email,
    collegeDiffers: differs(record.csv_college, member.college),
    yearDiffers: differs(record.csv_year, member.year),
    attended: attendedIds ? attendedIds.has(member.id) : null,
    sharesName: false,
  };
}

/** Marks identical names and orders strongest evidence first. */
export function rankCandidates(list: Candidate[]): Candidate[] {
  const nameCounts = new Map<string, number>();
  list.forEach((c) => { const n = foldName(memberName(c.member)); nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1); });
  list.forEach((c) => { c.sharesName = (nameCounts.get(foldName(memberName(c.member))) ?? 0) > 1; });
  return list.sort((a, b) =>
    Number(b.emailMatches) - Number(a.emailMatches)
    || Number(a.emailDiffers) - Number(b.emailDiffers)
    || memberName(a.member).localeCompare(memberName(b.member)));
}

// ─── Triage ─────────────────────────────────────────────────────────────────

export type TriageTier = 'resolved' | 'straightforward' | 'ambiguous' | 'incorrect_attribution' | 'insufficient';

export const TIER_LABELS: Record<TriageTier, string> = {
  resolved: 'Safe or already resolved',
  straightforward: 'Straightforward, confirm',
  ambiguous: 'Ambiguous identity',
  incorrect_attribution: 'Possible incorrect original match',
  insufficient: 'Insufficient evidence',
};

export const TIER_ORDER: Record<TriageTier, number> = {
  straightforward: 0, resolved: 1, ambiguous: 2, insufficient: 3, incorrect_attribution: 4,
};

export interface Recommendation {
  kind: 'restore' | 'create_member' | 'dismiss';
  memberId?: string;
  reason?: DismissReason;
  label: string;
}

export interface Triage {
  tier: TriageTier;
  explanation: string;
  recommendation: Recommendation | null;
}

export type InsightFlag = 'email_conflict' | 'already_attended' | 'duplicate' | 'identical_names' | 'credit_removed' | 'dismissed_but_missing';

export const FLAG_LABELS: Record<InsightFlag, string> = {
  email_conflict: 'Email conflict',
  already_attended: 'A candidate already attended',
  duplicate: 'Possible duplicate row',
  identical_names: 'Identical names',
  credit_removed: 'Recorded credit was removed',
  dismissed_but_missing: 'Dismissed, but attendance looks missing',
};

export interface RowInsight {
  finding: RecoveryFinding;
  candidates: Candidate[];
  triage: Triage;
  flags: InsightFlag[];
}

const DUPLICATE_KINDS: ReadonlySet<HistoricalKind> = new Set<HistoricalKind>([
  'duplicate_name_only', 'skipped_without_attendance', 'candidate_already_attended', 'duplicate_row',
]);

export function triage(finding: RecoveryFinding, candidates: readonly Candidate[], lookup: MemberLookup): Triage {
  const { record, classification, status, latestAction } = finding;
  if (status === 'recovered') return { tier: 'resolved', explanation: 'Recovered. Attendance changes go through Admin Members.', recommendation: null };
  if (status === 'dismissed') {
    return { tier: 'resolved', explanation: `Dismissed${latestAction?.reason_code ? ` (${latestAction.reason_code.replace(/_/g, ' ')})` : ''}.`, recommendation: null };
  }
  if (status === 'investigating') {
    return {
      tier: 'incorrect_attribution',
      explanation: 'The correct member was credited and the original credit is kept for investigation. Resolve it in Full review.',
      recommendation: null,
    };
  }
  if (classification.category === 'possible_incorrect_match') {
    return { tier: 'incorrect_attribution', explanation: classification.reason, recommendation: null };
  }
  if (status === 'needs_info') {
    return { tier: 'insufficient', explanation: latestAction?.note ? `On hold: “${latestAction.note}”` : classification.reason, recommendation: null };
  }
  if (classification.kind === 'invalid_row' || classification.kind === 'missing_audit_metadata') {
    return { tier: 'insufficient', explanation: classification.reason, recommendation: null };
  }

  const byEmail = candidates.filter((c) => c.emailMatches);
  if (byEmail.length > 1) {
    return { tier: 'ambiguous', explanation: `${byEmail.length} members share this row's email. Only one can be this person.`, recommendation: null };
  }
  if (byEmail.length === 1 && lookup.ready) {
    const [match] = byEmail;
    if (match.attended) {
      return {
        tier: 'resolved',
        explanation: `${memberName(match.member)}, who has this email on file, already has attendance for this event.`,
        recommendation: { kind: 'dismiss', reason: 'legitimate_duplicate', label: 'Dismiss as legitimate duplicate' },
      };
    }
    return {
      tier: 'straightforward',
      explanation: `The row's email matches ${memberName(match.member)}'s email on file.${candidates.length > 1 ? ` ${candidates.length - 1} other similar member${candidates.length > 2 ? 's' : ''} also listed.` : ''}`,
      recommendation: { kind: 'restore', memberId: match.member.id, label: `Match ${memberName(match.member)}` },
    };
  }
  if (candidates.length > 0) {
    const identical = candidates.some((c) => c.sharesName);
    return {
      tier: 'ambiguous',
      explanation: `${candidates.length} similarly named member${candidates.length === 1 ? '' : 's'}${identical ? ', some with identical names' : ''}. A name alone does not prove identity; compare email, college and year.`,
      recommendation: null,
    };
  }
  if (!lookup.ready) return { tier: 'ambiguous', explanation: 'Loading member details…', recommendation: null };
  const noOne = record.exact_name_members === 0 && !record.email_in_members && !record.resolved_elsewhere
    && !record.candidate_attended && record.duplicate_twin_attended == null;
  if (noOne && allowedActions(finding).includes('create_member')) {
    return {
      tier: 'straightforward',
      explanation: 'No member has this email or this name, and no similar member attended. Likely a new person.',
      recommendation: { kind: 'create_member', label: 'Create separate member' },
    };
  }
  return { tier: 'insufficient', explanation: classification.reason, recommendation: null };
}

export function insightFor(finding: RecoveryFinding, lookup: MemberLookup): RowInsight {
  const candidates = candidatesFor(finding, lookup);
  const { record, classification, status } = finding;
  const flags: InsightFlag[] = [];
  if (record.email_conflict || candidates.some((c) => c.emailDiffers && c.sources.includes('matched'))) flags.push('email_conflict');
  if (record.candidate_attended || record.email_member_attended || candidates.some((c) => c.attended)) flags.push('already_attended');
  if (DUPLICATE_KINDS.has(classification.kind) || record.duplicate_twin_attended) flags.push('duplicate');
  if (candidates.some((c) => c.sharesName) || record.exact_name_members > 1) flags.push('identical_names');
  if (record.recovered_credit_present === false || record.original_credit_present === false) flags.push('credit_removed');
  if (status === 'dismissed' && classification.category === 'confirmed_missing') flags.push('dismissed_but_missing');
  return { finding, candidates, triage: triage(finding, candidates, lookup), flags };
}

// ─── Filters, sort, counts ──────────────────────────────────────────────────

export type StatusFilter = 'actionable' | 'unresolved' | 'staged' | 'needs_info' | 'investigate' | 'recovered' | 'dismissed' | 'all';
export type LensFilter = '' | 'email_conflict' | 'already_attended' | 'duplicates' | 'incorrect_match';
export type SortKey = 'easiest' | 'risk' | 'source' | 'confidence' | 'name';

export interface WorkspaceFilters {
  importJobId: string;
  search: string;
  kind: HistoricalKind | '';
  status: StatusFilter;
  tier: TriageTier | '';
  lens: LensFilter;
}

export const DEFAULT_FILTERS: WorkspaceFilters = { importJobId: '', search: '', kind: '', status: 'actionable', tier: '', lens: '' };

export const STATUS_LABELS: Record<StatusFilter, string> = {
  actionable: 'Needs a decision',
  unresolved: 'Unresolved',
  staged: 'Staged',
  needs_info: 'Needs more information',
  investigate: 'Under investigation',
  recovered: 'Recovered',
  dismissed: 'Dismissed',
  all: 'All statuses',
};

export const LENS_LABELS: Record<Exclude<LensFilter, ''>, string> = {
  email_conflict: 'Email conflicts',
  already_attended: 'Already attended',
  duplicates: 'Duplicates',
  incorrect_match: 'Possible incorrect matches',
};

function matchesStatus(insight: RowInsight, status: StatusFilter, staged: boolean): boolean {
  const { bucket } = insight.finding;
  switch (status) {
    case 'actionable': return bucket === 'unresolved' || bucket === 'needs_info' || bucket === 'investigate';
    case 'staged': return staged;
    case 'unresolved': case 'needs_info': case 'recovered': case 'dismissed': return bucket === status;
    case 'investigate': return bucket === 'investigate';
    default: return true;
  }
}

function matchesSearch(insight: RowInsight, term: string): boolean {
  if (!term) return true;
  const folded = foldName(term);
  const lower = term.trim().toLowerCase();
  const { record } = insight.finding;
  const hay = (text: string | null | undefined) => (folded && foldName(text).includes(folded)) || (lower && (text ?? '').toLowerCase().includes(lower));
  return !!(hay(record.display_name) || hay(record.csv_email)
    || insight.candidates.some((c) => hay(memberName(c.member)) || hay(c.member.email)));
}

export function filterInsights(insights: readonly RowInsight[], filters: WorkspaceFilters, stagedIds: ReadonlySet<string>): RowInsight[] {
  return insights.filter((insight) => {
    const { record, classification } = insight.finding;
    if (filters.importJobId && record.import_job_id !== filters.importJobId) return false;
    if (filters.kind && classification.kind !== filters.kind) return false;
    if (filters.tier && insight.triage.tier !== filters.tier) return false;
    if (!matchesStatus(insight, filters.status, stagedIds.has(record.row_id))) return false;
    if (filters.lens === 'email_conflict' && !insight.flags.includes('email_conflict')) return false;
    if (filters.lens === 'already_attended' && !insight.flags.includes('already_attended')) return false;
    if (filters.lens === 'duplicates' && !insight.flags.includes('duplicate') && !insight.flags.includes('identical_names')) return false;
    if (filters.lens === 'incorrect_match' && insight.triage.tier !== 'incorrect_attribution') return false;
    return matchesSearch(insight, filters.search);
  });
}

const PRIORITY = { high: 0, medium: 1, low: 2 } as const;
const bySource = (a: RowInsight, b: RowInsight) =>
  a.finding.record.job_created_at.localeCompare(b.finding.record.job_created_at)
  || a.finding.record.source_row_index - b.finding.record.source_row_index;

export function sortInsights(insights: readonly RowInsight[], key: SortKey): RowInsight[] {
  const list = [...insights];
  switch (key) {
    case 'easiest':
      return list.sort((a, b) => TIER_ORDER[a.triage.tier] - TIER_ORDER[b.triage.tier] || bySource(a, b));
    case 'risk':
      return list.sort((a, b) => PRIORITY[a.finding.classification.priority] - PRIORITY[b.finding.classification.priority] || bySource(a, b));
    case 'confidence':
      return list.sort((a, b) => (b.finding.record.name_score ?? -1) - (a.finding.record.name_score ?? -1) || bySource(a, b));
    case 'name':
      // Same-name rows sit together, which groups likely duplicates.
      return list.sort((a, b) => foldName(a.finding.record.display_name).localeCompare(foldName(b.finding.record.display_name)) || bySource(a, b));
    default:
      return list.sort(bySource);
  }
}

export interface ScopeCounts {
  total: number;
  unresolved: number;
  staged: number;
  recovered: number;
  dismissed: number;
  needsInfo: number;
  investigate: number;
  ambiguous: number;
}

export function countScope(insights: readonly RowInsight[], stagedIds: ReadonlySet<string>): ScopeCounts {
  const counts: ScopeCounts = { total: 0, unresolved: 0, staged: 0, recovered: 0, dismissed: 0, needsInfo: 0, investigate: 0, ambiguous: 0 };
  insights.forEach((insight) => {
    const { bucket, record } = insight.finding;
    counts.total += 1;
    if (stagedIds.has(record.row_id)) counts.staged += 1;
    if (bucket === 'unresolved') counts.unresolved += 1;
    if (bucket === 'recovered') counts.recovered += 1;
    if (bucket === 'dismissed') counts.dismissed += 1;
    if (bucket === 'needs_info') counts.needsInfo += 1;
    if (bucket === 'investigate') counts.investigate += 1;
    if (insight.triage.tier === 'ambiguous' && (bucket === 'unresolved' || bucket === 'needs_info')) counts.ambiguous += 1;
  });
  return counts;
}

/** Groups findings whose event was deleted (import rows keep `event_id = null`). */
export const NO_EVENT_ID = 'no-event';

/** The event a finding is reviewed under; eventless findings share one group. */
export const eventKeyOf = (finding: RecoveryFinding): string => finding.record.event_id ?? NO_EVENT_ID;

export interface EventProgress {
  eventId: string;
  name: string;
  date: string | null;
  total: number;
  done: number;
  open: number;
  staged: number;
}

/** Per-event completion. Done = recovered or dismissed. Events with open work first, then newest. */
export function eventProgress(findings: readonly RecoveryFinding[], stagedIds: ReadonlySet<string>): EventProgress[] {
  const map = new Map<string, EventProgress>();
  findings.forEach((finding) => {
    const { record } = finding;
    const key = eventKeyOf(finding);
    const entry = map.get(key) ?? {
      eventId: key,
      name: record.event_id ? record.event_name ?? 'Event' : 'Findings whose event was deleted',
      date: record.event_id ? record.event_date : null,
      total: 0, done: 0, open: 0, staged: 0,
    };
    entry.total += 1;
    if (finding.bucket === 'recovered' || finding.bucket === 'dismissed') entry.done += 1;
    else entry.open += 1;
    if (stagedIds.has(record.row_id)) entry.staged += 1;
    map.set(key, entry);
  });
  return Array.from(map.values()).sort((a, b) =>
    Number(b.open > 0) - Number(a.open > 0) || (b.date ?? '').localeCompare(a.date ?? '') || a.name.localeCompare(b.name));
}

/** The next event with open findings after `current`, wrapping around; null when everything is done. */
export function nextUnfinishedEvent(progress: readonly EventProgress[], current: string | null): string | null {
  const others = progress.filter((p) => p.open > 0 && p.eventId !== current);
  if (others.length === 0) return null;
  const index = progress.findIndex((p) => p.eventId === current);
  const after = progress.slice(index + 1).find((p) => p.open > 0);
  return (after ?? others[0]).eventId;
}

// ─── Bulk eligibility ───────────────────────────────────────────────────────

export type BulkKind = 'needs_info' | 'dismiss' | 'create_member';

export interface BulkEligibility {
  eligible: RowInsight[];
  skipped: Array<{ insight: RowInsight; reason: string }>;
  warnings: string[];
}

/**
 * Ledger evidence that this person is already credited for the event. The
 * matched member's own attendance does not count when that member is the one
 * this row credits: that is the credit under suspicion, not independent evidence.
 */
export function hasDuplicateEvidence(record: RecoveryFindingRecord): boolean {
  const matchedIsCredited = !!record.attendance_member_id && record.matched_member_id === record.attendance_member_id;
  return (record.matched_member_attended && !matchedIsCredited) || record.email_member_attended || record.resolved_elsewhere;
}

/**
 * Which selected rows a homogeneous bulk action may stage. Bulk never matches
 * anyone to an existing member. Bulk create is limited to rows with no
 * possible existing identity at all (guardian review F1).
 */
export function bulkEligibility(kind: BulkKind, selected: readonly RowInsight[], options: { reason?: DismissReason } = {}): BulkEligibility {
  const eligible: RowInsight[] = [];
  const skipped: BulkEligibility['skipped'] = [];
  const seenIdentity = new Set<string>();
  selected.forEach((insight) => {
    const { record, status } = insight.finding;
    const allowed = allowedActions(insight.finding);
    const skip = (reason: string) => skipped.push({ insight, reason });
    if (kind === 'needs_info') {
      if (!allowed.includes('needs_info')) return skip(`Finding is ${status.replace('_', ' ')}.`);
      if (status === 'needs_info') return skip('Already on hold.');
      return void eligible.push(insight);
    }
    if (kind === 'dismiss') {
      if (!allowed.includes('dismiss')) return skip(`Finding is ${status.replace('_', ' ')}.`);
      if (rowCreditsMember(record)) return skip('This row credits a member who may be the wrong person; dismiss it individually with evidence.');
      if (options.reason === 'legitimate_duplicate' && !hasDuplicateEvidence(record)) {
        return skip('No ledger evidence that this person is already credited. Review it on its own.');
      }
      return void eligible.push(insight);
    }
    if (!allowed.includes('create_member')) return skip('A new member cannot be created for this row.');
    if (!isEmail(record.csv_email)) return skip('No email on the row; create it individually.');
    if (record.candidate_count > 0 || record.exact_name_members > 0 || insight.candidates.length > 0) return skip('Similar members exist; decide it individually.');
    if (record.email_in_members || record.resolved_elsewhere || record.candidate_attended || record.duplicate_twin_attended != null || record.attendance_exists === true) {
      return skip('Evidence suggests this person may already be a member.');
    }
    const email = `e:${normEmail(record.csv_email)}`;
    const name = `n:${foldName(record.display_name)}`;
    if (seenIdentity.has(email) || seenIdentity.has(name)) return skip('Another selected row looks like the same person; stage one of them.');
    seenIdentity.add(email);
    seenIdentity.add(name);
    return void eligible.push(insight);
  });
  const warnings: string[] = [];
  const high = eligible.filter((insight) => insight.finding.classification.priority === 'high').length;
  if (kind === 'dismiss' && high > 0) {
    warnings.push(`${high} high-priority row${high === 1 ? '' : 's'} included: attendance may really be missing.`);
  }
  return { eligible, skipped, warnings };
}
