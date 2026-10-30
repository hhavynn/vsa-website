// One preflight presentation for ACE, House, Cabinet, and Intern readiness.
// Each domain keeps its own rules (and its own blockers: lock/publish still
// enforce them). This module only reshapes the result into the same issue card:
// severity, short explanation, affected count, and a direct fix action — and
// the "Ready to Publish / Not Ready" verdict on top.
//
// It never promotes a warning to a blocker: readiness depends only on the
// blockers the domain itself reported.
import type { AssignmentPreflight, AssignmentIssue } from './aceAssignments';
import type { PreflightResult, PreflightIssue as HouseIssue } from './houseAssignmentDraft';
import type { RosterPreflight, RosterIssue } from './cabinetRoster';
import type { InternPreflight, InternPreflightIssue } from './internCohort';
import { pluralize } from './operationalStatus';

export type IssueLevel = 'blocker' | 'warning' | 'info';

export interface IssueFix {
  label: string;
  /** Quick-filter key on the same page; selecting it jumps to the affected rows. */
  filter?: string;
  /** Another admin page that fixes it. */
  to?: string;
}

export interface UnifiedIssue {
  id: string;
  level: IssueLevel;
  /** Short statement, e.g. "5 Littles are unassigned". */
  title: string;
  /** One sentence on why it matters or what to do. */
  detail?: string;
  /** Affected records (0 when the issue is not about specific rows). */
  count: number;
  fix?: IssueFix;
}

export interface Readiness {
  ready: boolean;
  blockers: number;
  warnings: number;
  infos: number;
  headline: string;
  /** "0 blockers · 3 warnings" */
  subline: string;
  issues: UnifiedIssue[];
}

const LEVEL_ORDER: Record<IssueLevel, number> = { blocker: 0, warning: 1, info: 2 };

export function buildReadiness(issues: readonly UnifiedIssue[], labels: { ready?: string; notReady?: string } = {}): Readiness {
  const sorted = [...issues].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  const blockers = sorted.filter((issue) => issue.level === 'blocker').length;
  const warnings = sorted.filter((issue) => issue.level === 'warning').length;
  const infos = sorted.filter((issue) => issue.level === 'info').length;
  const ready = blockers === 0;
  return {
    ready,
    blockers,
    warnings,
    infos,
    headline: ready ? labels.ready ?? 'Ready to Publish' : labels.notReady ?? 'Not Ready',
    subline: `${pluralize(blockers, 'blocker')} · ${pluralize(warnings, 'warning')}`,
    issues: sorted,
  };
}

// ─── ACE ─────────────────────────────────────────────────────────────────────

const ACE_ISSUE: Record<AssignmentIssue['code'], { detail: string; fix: IssueFix }> = {
  unassigned: { detail: 'These records must have a Big before publishing.', fix: { label: 'Review Unassigned', filter: 'unassigned' } },
  missing_big: { detail: 'Pick a Big that is still on the ACE tree.', fix: { label: 'Review', filter: 'needs_review' } },
  duplicate_little: { detail: 'A Little can only be added once.', fix: { label: 'Compare Duplicates', filter: 'duplicates' } },
  duplicate_member: { detail: 'One member cannot be two Littles.', fix: { label: 'Compare Duplicates', filter: 'duplicates' } },
  already_published: { detail: 'These already created a node on the ACE tree.', fix: { label: 'Review', filter: 'needs_review' } },
  already_on_tree: { detail: 'They are already under that Big on the live tree.', fix: { label: 'Review', filter: 'needs_review' } },
  ambiguous_match: { detail: 'Several members share the name. Choose the right one by hand.', fix: { label: 'Review Possible Matches', filter: 'possible_match' } },
  unlinked_suggestion: { detail: 'A member has this exact name. Linking is optional.', fix: { label: 'Review Possible Matches', filter: 'possible_match' } },
  no_member_record: { detail: 'Fine for people with no member record; link later if one exists.', fix: { label: 'Review No Match', filter: 'no_match' } },
  member_on_other_node: { detail: 'This member already appears elsewhere on the ACE tree.', fix: { label: 'Review', filter: 'needs_review' } },
};

export function aceIssues(preflight: AssignmentPreflight): UnifiedIssue[] {
  return preflight.issues.map((issue) => ({
    id: `ace:${issue.code}`,
    level: issue.severity,
    title: issue.message,
    detail: ACE_ISSUE[issue.code]?.detail,
    count: issue.draftIds.length,
    fix: ACE_ISSUE[issue.code]?.fix,
  }));
}

// ─── Houses ──────────────────────────────────────────────────────────────────

const HOUSE_ISSUE: Partial<Record<HouseIssue['code'], { detail: string; fix?: IssueFix }>> = {
  conflicting_house: { detail: 'A member can only be in one House.', fix: { label: 'Compare Duplicates', filter: 'duplicates' } },
  invalid_house: { detail: 'The House has no active profile for this year.', fix: { label: 'Review', filter: 'needs_review' } },
  interval: { detail: 'The dated membership would overlap an existing one.', fix: { label: 'Review', filter: 'needs_review' } },
  unassigned: { detail: 'These rows have no House yet.', fix: { label: 'Review Unassigned', filter: 'unassigned' } },
  duplicate_member: { detail: 'The same member is on more than one row.', fix: { label: 'Compare Duplicates', filter: 'duplicates' } },
  ambiguous_match: { detail: 'Confirm the member match before publishing.', fix: { label: 'Review Ambiguous', filter: 'ambiguous' } },
  unmatched: { detail: 'Choose a member for these rows before revealing.', fix: { label: 'Review Unmatched', filter: 'unmatched' } },
  imbalance: { detail: 'Use the Balance helper; nothing moves until you accept it.' },
  empty: { detail: 'Import or add people first.' },
  placement_unmatched: { detail: 'Automatic placement reveals everyone or no one: link each applicant to a member.', fix: { label: 'Review Unmatched', filter: 'needs_review' } },
  placement_duplicate_member: { detail: 'Two applicants are linked to the same member record.', fix: { label: 'Compare Duplicates', filter: 'duplicates' } },
  placement_missing_house: { detail: 'Every applicant needs a House from this year.', fix: { label: 'Review Unassigned', filter: 'unassigned' } },
  capacity_config: { detail: 'Delete this draft and generate the placement again.' },
  capacity_exceeded: { detail: 'Undo or swap an override so the House fits its capacity.' },
  capacity_mismatch: { detail: 'Every spot must be filled exactly as allocated.' },
  placement_preferences: { detail: 'Ranked choices are needed to explain each placement. Regenerate from the form export.' },
  priority_metadata: { detail: 'Submission time and sheet row set the order. Regenerate from the form export.' },
  override_reason: { detail: 'Use Override on the row and record why it moved.' },
  priority_override: { detail: 'Allowed with a documented reason, but it departs from first-come, first-served.' },
  manual_override: { detail: 'Shown as manual overrides, not automatic results.' },
  payment_gate: { detail: 'Checked by the database: Lock and Reveal refuse until it passes. Use Rerun sorting with eligible applicants.' },
};

export function houseIssues(preflight: Pick<PreflightResult, 'blockers' | 'warnings'>): UnifiedIssue[] {
  const toIssue = (level: IssueLevel) => (issue: HouseIssue, index: number): UnifiedIssue => ({
    id: `house:${issue.code}:${index}`,
    level,
    title: issue.message,
    detail: HOUSE_ISSUE[issue.code]?.detail,
    count: issue.rowIds.length,
    fix: HOUSE_ISSUE[issue.code]?.fix,
  });
  return [...preflight.blockers.map(toIssue('blocker')), ...preflight.warnings.map(toIssue('warning'))];
}

// ─── Cabinet ─────────────────────────────────────────────────────────────────

const ROSTER_ISSUE: Record<RosterIssue['code'], { detail: string; fix?: IssueFix }> = {
  empty: { detail: 'Start from last year’s positions.' },
  empty_slot: { detail: 'Fill every position, or remove ones you will not use.', fix: { label: 'Review Unfilled', filter: 'unfilled' } },
  duplicate_member: { detail: 'One member cannot hold the same slot twice.', fix: { label: 'Review', filter: 'needs_review' } },
  unresolved_links: { detail: 'Linking shows the member’s approved photo. Not required to publish.', fix: { label: 'Review Unlinked', filter: 'unlinked' } },
  missing_photos: { detail: 'A photo is not required to publish.', fix: { label: 'Review Missing Photos', filter: 'missing_photo' } },
  duplicate_name: { detail: 'The same name on two positions without a shared link.', fix: { label: 'Review', filter: 'needs_review' } },
  duplicate_role: { detail: 'Looks like a duplicate position by mistake.', fix: { label: 'Review', filter: 'needs_review' } },
};

export function cabinetIssues(preflight: Pick<RosterPreflight, 'blockers' | 'warnings'>): UnifiedIssue[] {
  const toIssue = (level: IssueLevel) => (issue: RosterIssue): UnifiedIssue => ({
    id: `cabinet:${issue.code}`,
    level,
    title: issue.message,
    detail: ROSTER_ISSUE[issue.code]?.detail,
    count: issue.draftIds.length,
    fix: ROSTER_ISSUE[issue.code]?.fix,
  });
  return [...preflight.blockers.map(toIssue('blocker')), ...preflight.warnings.map(toIssue('warning'))];
}

// ─── Interns ─────────────────────────────────────────────────────────────────

const INTERN_ISSUE: Record<InternPreflightIssue['code'], { detail: string; fix?: IssueFix }> = {
  empty: { detail: 'Paste the accepted names to start the cohort.' },
  duplicate_member: { detail: 'One member cannot be two interns.', fix: { label: 'Review', filter: 'needs_review' } },
  unlinked: { detail: 'Linking shows an approved photo. Not required to publish.', fix: { label: 'Review Unlinked', filter: 'unlinked' } },
  duplicate_name: { detail: 'Check these are two different people.', fix: { label: 'Review', filter: 'needs_review' } },
};

export function internIssues(preflight: Pick<InternPreflight, 'blockers' | 'warnings'>): UnifiedIssue[] {
  const toIssue = (level: IssueLevel) => (issue: InternPreflightIssue): UnifiedIssue => ({
    id: `intern:${issue.code}`,
    level,
    title: issue.message,
    detail: INTERN_ISSUE[issue.code]?.detail,
    count: issue.draftIds.length,
    fix: INTERN_ISSUE[issue.code]?.fix,
  });
  return [...preflight.blockers.map(toIssue('blocker')), ...preflight.warnings.map(toIssue('warning'))];
}
