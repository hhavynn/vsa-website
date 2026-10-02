// The quick filters each admin work queue offers. A page only gets the filters
// that make sense for its domain; counts come from adminFilters.countByFilter.
// Pure predicates over the same rows the pages already hold.
import type { AceFamilyMember, AceAssignmentDraft } from '../types';
import type { AceLinkReviewItem } from './aceMemberLinks';
import type { AssignmentIssue, LittleLinkReviewItem } from './aceAssignments';
import type { HouseAssignmentDraft, HouseProfileLite } from './houseAssignmentDraft';
import { readPreferences } from './houseAssignmentDraft';
import type { CabinetRosterDraft } from './cabinetRoster';
import type { InternCohortDraft } from './internCohort';
import { QuickFilter, allFilter } from './adminFilters';

// ─── ACE assignment drafts ───────────────────────────────────────────────────

export interface AceDraftFacts {
  draft: AceAssignmentDraft;
  /** Present only for Littles that are not linked to a member yet. */
  review?: LittleLinkReviewItem;
  issues: readonly AssignmentIssue[];
  reviewed: boolean;
}

export const ACE_DRAFT_FILTER_KEYS = ['all', 'needs_review', 'unlinked', 'possible_match', 'no_match', 'unassigned', 'duplicates'] as const;

export const ACE_DRAFT_FILTERS: ReadonlyArray<QuickFilter<AceDraftFacts>> = [
  allFilter(),
  { key: 'needs_review', label: 'Needs Review', hint: 'Has an issue you have not marked reviewed.', predicate: (row) => row.issues.length > 0 && !row.reviewed },
  { key: 'unlinked', label: 'Unlinked', hint: 'Not linked to a member record.', predicate: (row) => !row.draft.little_member_id },
  { key: 'possible_match', label: 'Possible match', hint: 'A member has this exact name, or several do.', predicate: (row) => !!row.review && row.review.status !== 'none' },
  { key: 'no_match', label: 'No match', hint: 'No member has this exact name.', predicate: (row) => row.review?.status === 'none' },
  { key: 'unassigned', label: 'Unassigned Little', hint: 'Has no Big yet.', predicate: (row) => !row.draft.big_ace_member_id },
  { key: 'duplicates', label: 'Duplicates', predicate: (row) => row.issues.some((issue) => issue.code === 'duplicate_little' || issue.code === 'duplicate_member') },
];

// ─── ACE tree nodes (family editor) ──────────────────────────────────────────

export interface AceNodeFacts {
  node: AceFamilyMember;
  review?: AceLinkReviewItem;
}

export const ACE_NODE_FILTER_KEYS = ['all', 'unlinked', 'possible_match', 'no_match'] as const;

export const ACE_NODE_FILTERS: ReadonlyArray<QuickFilter<AceNodeFacts>> = [
  allFilter(),
  { key: 'unlinked', label: 'Unlinked', predicate: (row) => !row.node.member_id },
  { key: 'possible_match', label: 'Possible match', predicate: (row) => !!row.review && row.review.status !== 'none' },
  { key: 'no_match', label: 'No match', predicate: (row) => row.review?.status === 'none' },
];

// ─── House draft rows ────────────────────────────────────────────────────────

export interface HouseRowFacts {
  row: HouseAssignmentDraft;
  /** Same member on several rows, or in conflicting Houses. */
  duplicate: boolean;
  /** The assigned House profile, if any resolves. */
  profile: HouseProfileLite | null;
  /** Resolves a preference's text to a House profile id. */
  resolveHouseId: (text: string) => string | null;
  reviewed: boolean;
}

export function isUnassignedHouseRow(row: HouseAssignmentDraft): boolean {
  return !row.house_profile_id && !row.source_house;
}

/** Assigned to a House that is not among the House choices the member listed. */
export function hasPreferenceConflict(facts: Pick<HouseRowFacts, 'row' | 'resolveHouseId'>): boolean {
  const { row, resolveHouseId } = facts;
  if (!row.house_profile_id) return false;
  const preferred = readPreferences(row.preferences)
    .map((text) => resolveHouseId(text))
    .filter((id): id is string => !!id);
  return preferred.length > 0 && !preferred.includes(row.house_profile_id);
}

export function houseNeedsAttention(facts: HouseRowFacts): boolean {
  const { row, duplicate, profile } = facts;
  return (
    isUnassignedHouseRow(row) ||
    row.match_status === 'review' ||
    !row.member_id ||
    duplicate ||
    (!!row.house_profile_id && !profile?.is_active)
  );
}

export const HOUSE_ROW_FILTER_KEYS = ['all', 'needs_review', 'unassigned', 'ambiguous', 'unmatched', 'duplicates', 'preference_conflict'] as const;

export const HOUSE_ROW_FILTERS: ReadonlyArray<QuickFilter<HouseRowFacts>> = [
  allFilter(),
  { key: 'needs_review', label: 'Needs Review', predicate: (facts) => houseNeedsAttention(facts) && !facts.reviewed },
  { key: 'unassigned', label: 'Unassigned', predicate: (facts) => isUnassignedHouseRow(facts.row) },
  { key: 'ambiguous', label: 'Ambiguous member', hint: 'The member match is a possible match, not confirmed.', predicate: (facts) => facts.row.match_status === 'review' },
  { key: 'unmatched', label: 'No member', predicate: (facts) => !facts.row.member_id },
  { key: 'duplicates', label: 'Duplicates', predicate: (facts) => facts.duplicate },
  { key: 'preference_conflict', label: 'Preference conflict', hint: 'Assigned to a House that is not one of their choices.', predicate: hasPreferenceConflict },
];

/** The "By House" filter: rows currently assigned to one House. */
export function houseRowIsIn(facts: Pick<HouseRowFacts, 'row'>, profileId: string): boolean {
  return facts.row.house_profile_id === profileId;
}

// ─── Cabinet roster drafts ───────────────────────────────────────────────────

export interface RosterRowFacts {
  draft: CabinetRosterDraft;
  hasPhoto: boolean;
  reviewed: boolean;
}

const isFilled = (draft: CabinetRosterDraft) => !!draft.name?.trim();

export const ROSTER_FILTER_KEYS = ['all', 'needs_review', 'unfilled', 'unlinked', 'missing_photo'] as const;

export const ROSTER_FILTERS: ReadonlyArray<QuickFilter<RosterRowFacts>> = [
  allFilter(),
  { key: 'needs_review', label: 'Needs Review', predicate: (row) => (!isFilled(row.draft) || !row.draft.member_id) && !row.reviewed },
  { key: 'unfilled', label: 'Unfilled position', predicate: (row) => !isFilled(row.draft) },
  { key: 'unlinked', label: 'Unlinked', predicate: (row) => isFilled(row.draft) && !row.draft.member_id },
  { key: 'missing_photo', label: 'Missing photo', hint: 'Linked, but no approved photo yet. Not required to publish.', predicate: (row) => !!row.draft.member_id && !row.hasPhoto },
];

// ─── Intern cohort drafts ────────────────────────────────────────────────────

export interface InternRowFacts {
  draft: InternCohortDraft;
  duplicate: boolean;
  reviewed: boolean;
}

export const hasMissingProfileInfo = (draft: InternCohortDraft) => !draft.role_or_track?.trim() || !draft.caption?.trim();

export const INTERN_FILTER_KEYS = ['all', 'needs_review', 'unlinked', 'missing_mentor', 'missing_info'] as const;

export const INTERN_FILTERS: ReadonlyArray<QuickFilter<InternRowFacts>> = [
  allFilter(),
  { key: 'needs_review', label: 'Needs Review', predicate: (row) => (!row.draft.member_id || row.duplicate) && !row.reviewed },
  { key: 'unlinked', label: 'Unlinked', predicate: (row) => !row.draft.member_id },
  { key: 'missing_mentor', label: 'Missing mentor', predicate: (row) => !row.draft.mentor_cabinet_member_id },
  { key: 'missing_info', label: 'Missing profile info', hint: 'No track or no caption yet.', predicate: (row) => hasMissingProfileInfo(row.draft) },
];

// ─── Members ─────────────────────────────────────────────────────────────────

export interface MemberRowFacts {
  id: string;
  needs_review: boolean | null;
  current_house: string | null;
  hasPhoto: boolean;
  events_attended: number;
}

export const MEMBER_FILTER_KEYS = ['all', 'needs_review', 'no_house', 'missing_photo', 'no_attendance'] as const;

export const MEMBER_FILTERS: ReadonlyArray<QuickFilter<MemberRowFacts>> = [
  allFilter(),
  { key: 'needs_review', label: 'Needs Review', predicate: (member) => !!member.needs_review },
  { key: 'no_house', label: 'No House', predicate: (member) => !member.current_house },
  { key: 'missing_photo', label: 'Missing Photo', predicate: (member) => !member.hasPhoto },
  { key: 'no_attendance', label: 'No attendance', predicate: (member) => member.events_attended === 0 },
];
