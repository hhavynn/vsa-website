// Protected domain — House membership. The read-only "Ready to Reveal" check
// (#635) with member-link coverage (#621). Pure: it only summarizes what the
// caller already read. The database still enforces the payment gate (#660)
// and the publish preflight; this decides whether the Reveal button may be
// pressed and explains exactly why not. Unknown (a failed read) never passes.
import type { ApplicationLink } from '../types';
import type { HouseAssignmentBatch, HouseAssignmentDraft, HouseProfileLite, PreflightResult } from './houseAssignmentDraft';

export type ReadinessState = 'complete' | 'needs_review' | 'blocked' | 'unknown';

export interface ReadinessItem {
  id: string;
  label: string;
  state: ReadinessState;
  detail: string;
}

export interface RevealReadiness {
  items: ReadinessItem[];
  overall: ReadinessState;
  /** Reveal may be pressed: nothing blocked and nothing unknown. */
  canReveal: boolean;
}

/** `undefined` = still loading or the read failed; the item is then Unknown. */
export interface RevealReadinessInput {
  batch: Pick<HouseAssignmentBatch, 'academic_year_start' | 'status' | 'assignment_method' | 'effective_start_date'>;
  drafts: ReadonlyArray<Pick<HouseAssignmentDraft, 'member_id' | 'match_status' | 'house_profile_id'>>;
  profiles: readonly HouseProfileLite[];
  preflight: Pick<PreflightResult, 'blockers' | 'warnings'>;
  /** Server payment blockers; null when the batch is not payment-gated. */
  paymentBlockers: string[] | null | undefined;
  activeTermYear: number | null | undefined;
  /** House profile id → linked House Parent count. */
  parentCounts: ReadonlyMap<string, number> | undefined;
  applicationLinks: readonly ApplicationLink[] | undefined;
  nowMs: number;
}

const HOUSE_KEYS = new Set(['house_fall', 'house_winter', 'house_spring']);
const LINKED = new Set(['match', 'manual']);

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export function buildRevealReadiness(input: RevealReadinessInput): RevealReadiness {
  const year = input.batch.academic_year_start;
  const yearLabel = `${year}-${year + 1}`;
  const items: ReadinessItem[] = [];

  if (input.activeTermYear === undefined) {
    items.push({ id: 'term', label: 'Academic year', state: 'unknown', detail: 'The active academic term could not be read.' });
  } else if (input.activeTermYear === null) {
    items.push({ id: 'term', label: 'Academic year', state: 'needs_review', detail: `No academic term is active. Activate the ${yearLabel} term in Years & Terms so public pages treat ${yearLabel} as current.` });
  } else if (input.activeTermYear !== year) {
    items.push({ id: 'term', label: 'Academic year', state: 'needs_review', detail: `The active term is ${input.activeTermYear}-${input.activeTermYear + 1}, not ${yearLabel}. Public pages will not treat these Houses as current until it is.` });
  } else {
    items.push({ id: 'term', label: 'Academic year', state: 'complete', detail: `${yearLabel} is the active academic year.` });
  }

  const active = input.profiles.filter((profile) => profile.is_active);
  const usedProfiles = new Set(input.drafts.map((row) => row.house_profile_id).filter((id): id is string => !!id));
  // Only rows the Reveal would actually write: linked to a confirmed member.
  const assignedToInactive = input.drafts.filter((row) => row.member_id && LINKED.has(row.match_status)
    && row.house_profile_id && !active.some((profile) => profile.id === row.house_profile_id)).length;
  if (active.length === 0 || assignedToInactive > 0) {
    items.push({
      id: 'profiles',
      label: 'House profiles',
      state: 'blocked',
      detail: active.length === 0
        ? `No active House profiles for ${yearLabel}. Publish them in Profiles & Images first.`
        : `${plural(assignedToInactive, 'row')} assigned to a House that is not active for ${yearLabel}.`,
    });
  } else if (input.parentCounts === undefined) {
    items.push({ id: 'profiles', label: 'House profiles', state: 'unknown', detail: `${plural(active.length, 'active House')}. House Parent links could not be read.` });
  } else {
    const withoutParents = active.filter((profile) => usedProfiles.has(profile.id) && !(input.parentCounts?.get(profile.id) ?? 0));
    items.push(withoutParents.length > 0
      ? { id: 'profiles', label: 'House profiles', state: 'needs_review', detail: `${withoutParents.map((profile) => profile.display_name).join(', ')} ${withoutParents.length === 1 ? 'has' : 'have'} no House Parents linked. They are optional, but public House pages will show none.` }
      : { id: 'profiles', label: 'House profiles', state: 'complete', detail: `${plural(active.length, 'active House')}, each with House Parents.` });
  }

  const linked = input.drafts.filter((row) => row.member_id && LINKED.has(row.match_status)).length;
  const review = input.drafts.filter((row) => row.match_status === 'review').length;
  const unmatched = input.drafts.length - linked - review;
  const autoBatch = input.batch.assignment_method === 'timestamp_ranked';
  items.push({
    id: 'members',
    label: 'Member links',
    state: input.drafts.length === 0 ? 'blocked' : review + unmatched === 0 ? 'complete' : autoBatch ? 'blocked' : 'needs_review',
    detail: input.drafts.length === 0
      ? 'The draft has no rows.'
      : `${linked} of ${input.drafts.length} linked to a confirmed member${review ? `, ${review} need review` : ''}${unmatched ? `, ${unmatched} unmatched` : ''}.${!autoBatch && review + unmatched > 0 ? ' Unlinked rows are skipped at Reveal.' : ''}`,
  });

  items.push(input.preflight.blockers.length > 0
    ? { id: 'preflight', label: 'Assignment preflight', state: 'blocked', detail: input.preflight.blockers.map((issue) => issue.message).join(' ') }
    : input.preflight.warnings.length > 0
      ? { id: 'preflight', label: 'Assignment preflight', state: 'needs_review', detail: input.preflight.warnings.map((issue) => issue.message).join(' ') }
      : { id: 'preflight', label: 'Assignment preflight', state: 'complete', detail: 'No blockers or warnings.' });

  if (input.paymentBlockers === undefined) {
    items.push({ id: 'payment', label: 'Payment eligibility', state: 'unknown', detail: 'Payment eligibility could not be checked.' });
  } else if (input.paymentBlockers === null) {
    items.push(autoBatch
      ? { id: 'payment', label: 'Payment eligibility', state: 'needs_review', detail: 'The payment check is not available in this database (migration 20261028050216 missing), so payment could not be verified.' }
      : { id: 'payment', label: 'Payment eligibility', state: 'complete', detail: 'Manual imports are not payment-gated.' });
  } else {
    items.push(input.paymentBlockers.length > 0
      ? { id: 'payment', label: 'Payment eligibility', state: 'blocked', detail: input.paymentBlockers.join(' ') }
      : { id: 'payment', label: 'Payment eligibility', state: 'complete', detail: 'Every included applicant is Paid or Waived at the current payment version.' });
  }

  if (input.applicationLinks === undefined) {
    items.push({ id: 'applications', label: 'House applications', state: 'unknown', detail: 'Application windows could not be read.' });
  } else {
    const open = input.applicationLinks.filter((link) => HOUSE_KEYS.has(link.application_key) && link.is_enabled
      && Date.parse(link.open_at) <= input.nowMs && Date.parse(link.due_at) > input.nowMs);
    items.push(open.length > 0
      ? { id: 'applications', label: 'House applications', state: 'needs_review', detail: `${open.map((link) => link.title).join(', ')} ${open.length === 1 ? 'is' : 'are'} still open. Revealing before applications close means late applicants are not placed.` }
      : { id: 'applications', label: 'House applications', state: 'complete', detail: 'No House application window is open.' });
  }

  const rank: Record<ReadinessState, number> = { complete: 0, needs_review: 1, unknown: 2, blocked: 3 };
  const overall = items.reduce<ReadinessState>((worst, item) => (rank[item.state] > rank[worst] ? item.state : worst), 'complete');
  return { items, overall, canReveal: overall === 'complete' || overall === 'needs_review' };
}

export const READINESS_LABEL: Record<ReadinessState, string> = {
  complete: 'Complete',
  needs_review: 'Needs review',
  blocked: 'Blocked',
  unknown: 'Unknown',
};
