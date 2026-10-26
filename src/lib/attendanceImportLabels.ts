// What the import preview calls each row. Classifications, not percentages:
// the resolver's verdicts are rules an admin can check, not probabilities.
import type { EffectiveStatus, ResolvedRow } from './attendanceImportDecisions';
import type { IdentityMember, IdentityReason, IdentityResult } from './identityResolution';

export type LabelTone = 'green' | 'blue' | 'amber' | 'gray' | 'red';

const AUTOMATIC: Partial<Record<IdentityReason, string>> = {
  known_email: 'Matched by known email',
  name_college_year: 'Matched by name + college + year',
  name_college: 'Matched by name + college',
  unique_name: 'Matched by unique exact name',
  middle_name_college_year: 'Matched by first/last name + college + year',
};

const REVIEW: Partial<Record<IdentityReason, string>> = {
  email_name_conflict: 'Needs review: email belongs to someone else',
  email_shared_by_members: 'Needs review: email on several members',
  multiple_candidates: 'Needs review: multiple candidates',
  identity_conflict: 'Needs review: possible identity conflict',
  similar_name: 'Needs review: similar name only',
  member_claimed_by_earlier_row: 'Needs review: possible duplicate',
  email_reused_in_file: 'Needs review: email reused in this file',
};

export function identityLabel<M extends IdentityMember>(
  row: Pick<IdentityResult<M>, 'status' | 'reason'>,
  resolved: Pick<ResolvedRow<M>, 'status' | 'adminConfirmed'>,
): { label: string; tone: LabelTone } {
  const status: EffectiveStatus = resolved.status;
  if (status === 'invalid') return { label: 'Invalid: no name', tone: 'red' };
  if (status === 'skipped') return { label: 'Skipped', tone: 'gray' };
  if (status === 'duplicate') return { label: 'Duplicate source row', tone: 'gray' };
  if (status === 'already') {
    return { label: resolved.adminConfirmed ? 'Already attended (you chose)' : 'Already attended', tone: 'gray' };
  }
  if (status === 'match') {
    if (resolved.adminConfirmed) return { label: 'Matched (you chose)', tone: 'green' };
    return { label: AUTOMATIC[row.reason] ?? 'Matched', tone: 'green' };
  }
  if (status === 'new') {
    return { label: row.status === 'new' ? 'Create new member' : 'Create new member (you chose)', tone: 'blue' };
  }
  if (row.status === 'duplicate') return { label: 'Needs review: repeats a row that is not imported', tone: 'amber' };
  return { label: REVIEW[row.reason] ?? 'Needs review', tone: 'amber' };
}
