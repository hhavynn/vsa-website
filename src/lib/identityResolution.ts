// Identity resolution for attendance imports: which existing member (if any)
// each CSV row is.
//
// A member is one permanent members.id. Email, name, college and standing are
// evidence about which member a row is; none of them is the identity itself.
// The resolver is deterministic and explains itself: every verdict carries the
// evidence behind it, in words an admin can check.
//
// Automatic (no admin needed):
//   known_email               a row address confirmed for exactly one member,
//                             with a compatible name
//   name_college_year         the only member with this exact name, same
//                             college, compatible standing for the event's year
//   name_college              the same without a usable standing
//   unique_name               the only member with this exact name, with nothing
//                             on file to contradict it (no other email, college
//                             or standing)
//   middle_name_college_year  the only member whose first and last name match
//                             with a middle name added or left out, same
//                             college, compatible standing, no other email
// Review (an admin decides):
//   two or more credible members, any contradiction (another college, an
//   implausible standing, another school address, an address that belongs to
//   someone else), or only a similar name.
// New: nobody credible.
//
// Spelling closeness only orders suggestions. It never decides anything.
import { normalizeCollegeForMatch, normalizeEmail, isSchoolEmail } from './memberMatching';
import type { AttendanceSourceRow } from './attendanceCsv';
import { compareNames, NameRelation, PersonName, personNameFromParts } from './personName';
import { assessYearEvidence, YearEvidence, YearObservation } from './yearStanding';

export interface IdentityMember {
  id: string;
  first_name: string;
  last_name: string;
  college: string | null;
  year: string | null;
  email: string | null;
  points?: number;
  events_attended?: number;
}

export interface IdentityAlias {
  member_id: string;
  email: string;
}

export interface IdentitySnapshot<M extends IdentityMember = IdentityMember> {
  members: readonly M[];
  aliases: readonly IdentityAlias[];
  observations: readonly YearObservation[];
  /** Members who already have attendance for the selected event. */
  attendedMemberIds: ReadonlySet<string>;
  /** Start year of the event's academic term. */
  eventAcademicYear: number | null;
}

export type IdentityStatus = 'match' | 'new' | 'already' | 'review' | 'duplicate';

export type IdentityReason =
  | 'known_email'
  | 'name_college_year'
  | 'name_college'
  | 'unique_name'
  | 'middle_name_college_year'
  | 'email_name_conflict'
  | 'email_shared_by_members'
  | 'multiple_candidates'
  | 'identity_conflict'
  | 'similar_name'
  | 'new_member'
  | 'duplicate_row'
  | 'same_member_as_row'
  | 'same_person_as_new_row'
  | 'member_claimed_by_earlier_row'
  | 'email_reused_in_file';

export type AliasMethod = 'unique_name_college_year' | 'admin_confirmed' | 'same_submission';

export interface AliasPlan {
  email: string;
  method: AliasMethod;
}

export type EvidenceTone = 'support' | 'against' | 'neutral';

export interface EvidenceNote {
  tone: EvidenceTone;
  text: string;
}

export type CollegeEvidence = 'match' | 'conflict' | 'unknown';
export type EmailEvidence =
  /** A row address is confirmed for this member. */
  | 'same'
  /** Both have addresses and none overlap; one of the pair is personal. */
  | 'different'
  /** Both have a school address and they differ: one student rarely has two. */
  | 'different_school'
  /** No address on one side. */
  | 'none';

export interface CandidateAssessment<M extends IdentityMember = IdentityMember> {
  member: M;
  name: NameRelation;
  college: CollegeEvidence;
  year: YearEvidence;
  email: EmailEvidence;
  /** Ordering only (higher first); not a probability. */
  rank: number;
  notes: EvidenceNote[];
}

export interface IdentityResult<M extends IdentityMember = IdentityMember> extends AttendanceSourceRow {
  status: IdentityStatus;
  reason: IdentityReason;
  /** One-line explanation for the admin. */
  note: string;
  evidence: EvidenceNote[];
  /** The member credited automatically, or null. Review rows never preselect one. */
  matchedMember: M | null;
  /** Review options, best first. Empty for automatic and new rows. */
  candidates: CandidateAssessment<M>[];
  candidateMemberIds: string[];
  canForceMatch: boolean;
  canMarkNew: boolean;
  /** The first row this one repeats (same submission, member or new person). */
  duplicateOf: string | null;
  /** Addresses this row confirms when it is credited as resolved. */
  aliasPlan: AliasPlan[];
  /** Members who already hold one of the row's addresses. */
  emailHolderIds: string[];
  /** Every member with exactly this (folded) name in the preview; the import refuses if another appears. */
  sameNameIds: string[];
}

const MAX_CANDIDATES = 5;

const RELATION_ORDER: Record<NameRelation, number> = {
  exact: 6,
  middle_omitted: 5,
  first_name_prefix: 4,
  reordered: 3,
  similar: 2,
  different: 0,
};

interface PreparedMember<M extends IdentityMember> {
  member: M;
  name: PersonName;
  college: string;
  emails: Set<string>;
  observations: YearObservation[];
}

export interface IdentityIndex<M extends IdentityMember> {
  byId: Map<string, PreparedMember<M>>;
  byToken: Map<string, PreparedMember<M>[]>;
  /** Folded full-name key → members with exactly that name. */
  byKey: Map<string, PreparedMember<M>[]>;
  /** Address → every member holding it (alias or primary email). */
  emailHolders: Map<string, Set<string>>;
}

/** Normalizes the whole roster once; per-row work is then index lookups. */
export function buildIdentityIndex<M extends IdentityMember>(snapshot: IdentitySnapshot<M>): IdentityIndex<M> {
  const byId = new Map<string, PreparedMember<M>>();
  const byToken = new Map<string, PreparedMember<M>[]>();
  const byKey = new Map<string, PreparedMember<M>[]>();
  const emailHolders = new Map<string, Set<string>>();
  const observationsByMember = new Map<string, YearObservation[]>();
  snapshot.observations.forEach((o) => {
    const list = observationsByMember.get(o.member_id);
    if (list) list.push(o);
    else observationsByMember.set(o.member_id, [o]);
  });

  const hold = (email: string, memberId: string) => {
    if (!email) return;
    const set = emailHolders.get(email);
    if (set) set.add(memberId);
    else emailHolders.set(email, new Set([memberId]));
  };

  snapshot.members.forEach((member) => {
    const prepared: PreparedMember<M> = {
      member,
      name: personNameFromParts(member.first_name, member.last_name),
      college: normalizeCollegeForMatch(member.college),
      emails: new Set(),
      observations: observationsByMember.get(member.id) ?? [],
    };
    const primary = normalizeEmail(member.email);
    if (primary) prepared.emails.add(primary);
    byId.set(member.id, prepared);
    hold(primary, member.id);
    if (prepared.name.key) byKey.set(prepared.name.key, [...(byKey.get(prepared.name.key) ?? []), prepared]);
    new Set(prepared.name.core).forEach((token) => {
      const list = byToken.get(token);
      if (list) list.push(prepared);
      else byToken.set(token, [prepared]);
    });
  });

  snapshot.aliases.forEach((alias) => {
    const prepared = byId.get(alias.member_id);
    const email = normalizeEmail(alias.email);
    if (!prepared || !email) return;
    prepared.emails.add(email);
    hold(email, alias.member_id);
  });

  return { byId, byToken, byKey, emailHolders };
}

function emailEvidence(rowEmails: readonly string[], memberEmails: ReadonlySet<string>): EmailEvidence {
  if (rowEmails.length === 0 || memberEmails.size === 0) return 'none';
  if (rowEmails.some((email) => memberEmails.has(email))) return 'same';
  const rowSchool = rowEmails.some(isSchoolEmail);
  const memberSchool = Array.from(memberEmails).some(isSchoolEmail);
  return rowSchool && memberSchool ? 'different_school' : 'different';
}

function collegeEvidence(rowCollege: string, memberCollege: string): CollegeEvidence {
  if (!rowCollege || !memberCollege) return 'unknown';
  return rowCollege === memberCollege ? 'match' : 'conflict';
}

const NAME_TEXT: Record<NameRelation, string> = {
  exact: 'Same name',
  middle_omitted: 'Same first and last name; a middle name is added or left out',
  first_name_prefix: 'Shortened first name (for example Alex / Alexander); not proof',
  reordered: 'Same names in a different order',
  similar: 'Similar name only',
  different: 'Different name',
};

function describeCandidate(
  relation: NameRelation,
  college: CollegeEvidence,
  year: YearEvidence,
  email: EmailEvidence,
  memberCollege: string | null,
): EvidenceNote[] {
  const notes: EvidenceNote[] = [];
  notes.push({ tone: relation === 'exact' || relation === 'middle_omitted' ? 'support' : 'neutral', text: NAME_TEXT[relation] });
  if (email === 'same') notes.push({ tone: 'support', text: 'Email confirmed for this member' });
  if (email === 'different') notes.push({ tone: 'neutral', text: 'Different email (personal vs. school addresses are common)' });
  if (email === 'different_school') notes.push({ tone: 'against', text: 'Different school (@ucsd.edu) email' });
  if (college === 'match') notes.push({ tone: 'support', text: 'Same college' });
  if (college === 'conflict') notes.push({ tone: 'against', text: `Different college on file${memberCollege ? ` (${memberCollege})` : ''}` });
  if (year === 'compatible') notes.push({ tone: 'support', text: 'Standing fits this event\'s academic year' });
  if (year === 'uncertain') notes.push({ tone: 'neutral', text: 'Standing is off from what was recorded' });
  if (year === 'implausible') notes.push({ tone: 'against', text: 'Standing does not fit this member for this year' });
  return notes;
}

function assess<M extends IdentityMember>(
  row: AttendanceSourceRow,
  prepared: PreparedMember<M>,
  eventYear: number | null,
): CandidateAssessment<M> {
  const { relation, closeness } = compareNames(row.name, prepared.name);
  const college = collegeEvidence(normalizeCollegeForMatch(row.csvCollege), prepared.college);
  const year = assessYearEvidence(row.csvYear, prepared.member, prepared.observations, eventYear);
  const email = emailEvidence(row.emails, prepared.emails);
  const rank = RELATION_ORDER[relation] * 1000
    + (email === 'same' ? 400 : email === 'different_school' ? -300 : 0)
    + (college === 'match' ? 200 : college === 'conflict' ? -200 : 0)
    + (year === 'compatible' ? 100 : year === 'implausible' ? -100 : 0)
    + closeness;
  return {
    member: prepared.member,
    name: relation,
    college,
    year,
    email,
    rank,
    notes: describeCandidate(relation, college, year, email, prepared.member.college),
  };
}

// A name word shared by more members than this (a common surname) only blocks
// together with a second shared word or the same start of the first name.
const COMMON_TOKEN_BLOCK = 60;

/** Members whose name could relate to the row's (blocking, not matching). */
function nameCandidates<M extends IdentityMember>(row: AttendanceSourceRow, index: IdentityIndex<M>): PreparedMember<M>[] {
  const seen = new Map<string, PreparedMember<M>>();
  const rowTokens = new Set(row.name.core);
  const firstStart = (row.name.core[0] ?? '').slice(0, 2);
  row.name.core.forEach((token) => {
    const block = index.byToken.get(token) ?? [];
    if (block.length <= COMMON_TOKEN_BLOCK) {
      block.forEach((prepared) => seen.set(prepared.member.id, prepared));
      return;
    }
    block.forEach((prepared) => {
      if (seen.has(prepared.member.id)) return;
      const shared = prepared.name.core.filter((t) => rowTokens.has(t)).length;
      const startsAlike = prepared.name.core.some((t) => t.slice(0, 2) === firstStart);
      if (shared >= 2 || startsAlike) seen.set(prepared.member.id, prepared);
    });
  });
  return Array.from(seen.values());
}

function contradictions(candidate: CandidateAssessment): string[] {
  const found: string[] = [];
  if (candidate.college === 'conflict') found.push('the college on file is different');
  if (candidate.year === 'implausible') found.push('the standing does not fit this member for this year');
  if (candidate.email === 'different_school') found.push('a different school email is on file');
  return found;
}

type Verdict<M extends IdentityMember> = Pick<
  IdentityResult<M>,
  'status' | 'reason' | 'note' | 'evidence' | 'matchedMember' | 'candidates' | 'canForceMatch' | 'canMarkNew' | 'aliasPlan'
>;

function review<M extends IdentityMember>(
  reason: IdentityReason,
  note: string,
  candidates: CandidateAssessment<M>[],
  evidence: EvidenceNote[] = [],
): Verdict<M> {
  const sorted = [...candidates].sort((a, b) => b.rank - a.rank).slice(0, MAX_CANDIDATES);
  return {
    status: 'review',
    reason,
    note,
    evidence,
    matchedMember: null,
    candidates: sorted,
    canForceMatch: sorted.length > 0,
    canMarkNew: true,
    aliasPlan: [],
  };
}

function automatic<M extends IdentityMember>(
  reason: IdentityReason,
  note: string,
  candidate: CandidateAssessment<M>,
  aliasPlan: AliasPlan[],
): Verdict<M> {
  return {
    status: 'match',
    reason,
    note,
    evidence: candidate.notes,
    matchedMember: candidate.member,
    candidates: [],
    canForceMatch: false,
    canMarkNew: true,
    aliasPlan,
  };
}

/** Row addresses nobody holds yet. */
function unknownEmails<M extends IdentityMember>(row: AttendanceSourceRow, index: IdentityIndex<M>): string[] {
  return row.emails.filter((email) => !index.emailHolders.has(email));
}

function resolveAgainstRoster<M extends IdentityMember>(
  row: AttendanceSourceRow,
  index: IdentityIndex<M>,
  eventYear: number | null,
): Verdict<M> {
  // Tier 1: a confirmed address. Resolved before any name search: only the
  // owner and members with exactly this name matter here.
  const owners = new Set<string>();
  row.emails.forEach((email) => index.emailHolders.get(email)?.forEach((id) => owners.add(id)));
  if (owners.size > 0) {
    const exactByKey = (index.byKey.get(row.name.key) ?? []).map((prepared) => assess(row, prepared, eventYear));
    const ownerCandidates = Array.from(owners).map((id) => assess(row, index.byId.get(id)!, eventYear));
    if (owners.size > 1) {
      return review(
        'email_shared_by_members',
        'This email is on file for more than one member. Choose the right member (and consider merging the duplicates), or create a new member.',
        [...ownerCandidates, ...exactByKey.filter((c) => !owners.has(c.member.id))],
      );
    }
    const owner = ownerCandidates[0];
    const strongName = owner.name === 'exact' || owner.name === 'middle_omitted';
    // A shortened or reordered name can be the same person; a merely similar one
    // (An / Anh) sharing an address is more often a sibling on a family email.
    const closeName = owner.name === 'first_name_prefix' || owner.name === 'reordered';
    const exactElsewhere = exactByKey.filter((c) => c.member.id !== owner.member.id);
    const ownerEmails = Array.from(index.byId.get(owner.member.id)!.emails);
    if (owner.year !== 'implausible'
        && (strongName || (closeName && owner.college !== 'conflict' && exactElsewhere.length === 0))) {
      // A second school address that differs from the owner's is not theirs to keep.
      const aliases = unknownEmails(row, index)
        .filter((email) => !hardEmailConflict(ownerEmails, [email]))
        .map((email): AliasPlan => ({ email, method: 'same_submission' }));
      return automatic('known_email', 'Matched by a known email.', owner, aliases);
    }
    return review(
      'email_name_conflict',
      'The email belongs to an existing member, but the name on this row points to someone else. Review before awarding points.',
      [owner, ...exactElsewhere],
    );
  }

  const assessed = nameCandidates(row, index).map((prepared) => assess(row, prepared, eventYear));
  const credible = assessed.filter((candidate) => candidate.name !== 'different');
  const exact = credible.filter((candidate) => candidate.name === 'exact');

  // Tiers 2-3: an exact name.
  const middle = credible.filter((candidate) => candidate.name === 'middle_omitted');
  if (exact.length > 1 || (exact.length === 1 && middle.length > 0)) {
    return review(
      'multiple_candidates',
      'More than one member has this name. Choose the right one, or create a new member.',
      [...exact, ...middle],
    );
  }
  if (exact.length === 1) {
    const candidate = exact[0];
    const against = contradictions(candidate);
    if (against.length > 0) {
      return review(
        'identity_conflict',
        `The name matches ${candidate.member.first_name} ${candidate.member.last_name}, but ${against.join(' and ')}. This may be a different person.`,
        [candidate, ...credible.filter((c) => c !== candidate)],
      );
    }
    const collegeMatch = candidate.college === 'match';
    const yearFits = candidate.year === 'compatible';
    if (candidate.email === 'different' && !collegeMatch) {
      return review(
        'identity_conflict',
        `The name matches ${candidate.member.first_name} ${candidate.member.last_name}, but the email on file is different and no college confirms it is the same person.`,
        [candidate, ...credible.filter((c) => c !== candidate)],
      );
    }
    // Only the strongest name evidence confirms an address; weaker tiers credit the
    // member but remember nothing (a wrong alias would win every later import).
    const aliases: AliasPlan[] = collegeMatch && yearFits
      ? unknownEmails(row, index).map((email) => ({ email, method: 'unique_name_college_year' }))
      : [];
    if (collegeMatch && yearFits) return automatic('name_college_year', 'Matched by name, college and standing.', candidate, aliases);
    if (collegeMatch) return automatic('name_college', 'Matched by name and college.', candidate, aliases);
    return automatic('unique_name', 'Matched by the only member with this name.', candidate, aliases);
  }

  // Tier 4: one member with the middle name added or left out.
  if (middle.length === 1) {
    const candidate = middle[0];
    const blockers = credible.filter((c) => c !== candidate && RELATION_ORDER[c.name] >= RELATION_ORDER.reordered);
    if (candidate.college === 'match' && candidate.year === 'compatible' && candidate.email === 'none' && blockers.length === 0) {
      return automatic('middle_name_college_year', 'Matched by first and last name, college and standing (middle name differs).', candidate, []);
    }
    return review(
      'similar_name',
      'Only a partial name match (a middle name differs). Confirm it is the same person, or create a new member.',
      credible,
    );
  }
  if (middle.length > 1) {
    return review('multiple_candidates', 'Several members share this first and last name. Choose the right one, or create a new member.', middle);
  }

  // Similar names only.
  if (credible.length > 0) {
    // Close spellings of common Vietnamese names (An / Anh) are usually
    // different people; when every look-alike is contradicted, create.
    const allContradicted = credible.every((c) => contradictions(c).length > 0);
    if (!allContradicted) {
      return review('similar_name', 'Only a similar name. Confirm it is the same person, or create a new member.', credible);
    }
  }

  return {
    status: 'new',
    reason: 'new_member',
    note: credible.length > 0
      ? 'Similar names exist, but their college or school email differs. A new member will be created.'
      : 'No existing member matches. A new member will be created.',
    evidence: [],
    matchedMember: null,
    candidates: [...credible].sort((a, b) => b.rank - a.rank).slice(0, MAX_CANDIDATES),
    canForceMatch: credible.length > 0,
    canMarkNew: false,
    aliasPlan: [],
  };
}

interface SeenRow {
  /** The existing member the row resolved to automatically, once known. */
  memberId?: string;
  rowId: string;
  name: PersonName;
  college: string;
  year: string;
  emails: string[];
}

function hardEmailConflict(a: readonly string[], b: readonly string[]): boolean {
  const schoolA = a.filter(isSchoolEmail);
  const schoolB = b.filter(isSchoolEmail);
  return schoolA.length > 0 && schoolB.length > 0 && !schoolA.some((email) => schoolB.includes(email));
}

function namesCompatible(a: PersonName, b: PersonName): boolean {
  const { relation } = compareNames(a, b);
  return relation === 'exact' || relation === 'middle_omitted';
}

/**
 * Resolves every row. Rows are processed in file order, so a later row that
 * repeats an earlier one (the same submission, the same member, or the same new
 * person) points back at the first and writes nothing of its own.
 */
export function resolveAttendanceIdentities<M extends IdentityMember>(
  rows: readonly AttendanceSourceRow[],
  snapshot: IdentitySnapshot<M>,
): IdentityResult<M>[] {
  const index = buildIdentityIndex(snapshot);
  const eventYear = snapshot.eventAcademicYear;
  const firstRowByEmail = new Map<string, SeenRow>();
  const firstRowByNoEmailKey = new Map<string, string>();
  const claimed = new Map<string, SeenRow>();
  const pendingNew: SeenRow[] = [];

  return rows.map((row): IdentityResult<M> => {
    const emailHolderIds = Array.from(new Set(row.emails.flatMap((email) => Array.from(index.emailHolders.get(email) ?? []))));
    const base = {
      ...row,
      candidateMemberIds: [] as string[],
      duplicateOf: null as string | null,
      emailHolderIds,
      sameNameIds: (index.byKey.get(row.name.key) ?? []).map((prepared) => prepared.member.id),
    };
    const finish = (verdict: Verdict<M>, duplicateOf: string | null = null): IdentityResult<M> => ({
      ...base,
      ...verdict,
      duplicateOf,
      candidateMemberIds: verdict.candidates.map((c) => c.member.id),
    });
    // A repeat keeps its own candidate, in case the row it repeats is skipped.
    const duplicate = (reason: IdentityReason, note: string, of: string, member: M | null, aliasPlan: AliasPlan[] = []) =>
      finish({
        status: 'duplicate', reason, note, evidence: [], matchedMember: member,
        candidates: member ? [assess(row, index.byId.get(member.id)!, eventYear)] : [],
        canForceMatch: !!member, canMarkNew: true, aliasPlan,
      }, of);

    if (!row.displayName.trim()) {
      return finish({ status: 'review', reason: 'new_member', note: 'This row has no name.', evidence: [], matchedMember: null,
        candidates: [], canForceMatch: false, canMarkNew: false, aliasPlan: [] });
    }

    const seen: SeenRow = {
      rowId: row.rowId,
      name: row.name,
      college: normalizeCollegeForMatch(row.csvCollege),
      year: row.csvYear,
      emails: row.emails,
    };

    // The same address earlier in the file.
    const earlier = row.emails.map((email) => firstRowByEmail.get(email)).find(Boolean);
    if (earlier) {
      if (namesCompatible(earlier.name, row.name)) {
        // A repeat confirms an extra address only as a single row would: never one
        // that contradicts a school address of that row or of the member it matched.
        const known = [...earlier.emails, ...(earlier.memberId ? Array.from(index.byId.get(earlier.memberId)?.emails ?? []) : [])];
        return duplicate('duplicate_row', `Repeats row ${rowNumber(earlier.rowId)} (same email and name).`, earlier.rowId, null,
          row.emails.filter((email) => !earlier.emails.includes(email) && !index.emailHolders.has(email) && !hardEmailConflict(known, [email]))
            .map((email) => ({ email, method: 'same_submission' as const })));
      }
      const verdict = resolveAgainstRoster(row, index, eventYear);
      return finish(review(
        'email_reused_in_file',
        `Row ${rowNumber(earlier.rowId)} used this email with a different name. Review before importing.`,
        verdict.candidates.length ? verdict.candidates : verdict.matchedMember ? [assess(row, index.byId.get(verdict.matchedMember.id)!, eventYear)] : [],
      ));
    }
    row.emails.forEach((email) => firstRowByEmail.set(email, seen));
    if (row.emails.length === 0) {
      const key = [row.name.key, seen.college, row.csvYear].join('|');
      const first = firstRowByNoEmailKey.get(key);
      if (first) return duplicate('duplicate_row', `Repeats row ${rowNumber(first)} (same name, college and year).`, first, null);
      firstRowByNoEmailKey.set(key, row.rowId);
    }

    const verdict = resolveAgainstRoster(row, index, eventYear);

    if (verdict.status === 'match' && verdict.matchedMember) {
      const member = verdict.matchedMember;
      const previous = claimed.get(member.id);
      const attended = snapshot.attendedMemberIds.has(member.id);
      if (previous) {
        // Two rows are one person only when the second is identified by an
        // address or by name + college + year; a bare name could be someone else.
        const confident = verdict.reason === 'known_email' || verdict.reason === 'name_college_year';
        if (!confident || hardEmailConflict(previous.emails, row.emails)) {
          return finish(review(
            'member_claimed_by_earlier_row',
            `Row ${rowNumber(previous.rowId)} already matched ${member.first_name} ${member.last_name}, and nothing here confirms this row is the same person. Skip this row if it repeats, or create a new member if it is someone else.`,
            [assess(row, index.byId.get(member.id)!, eventYear)],
          ));
        }
        return duplicate('same_member_as_row', `Same member as row ${rowNumber(previous.rowId)}; attendance is recorded once.`,
          previous.rowId, member, verdict.aliasPlan);
      }
      claimed.set(member.id, seen);
      seen.memberId = member.id;
      return finish(attended ? { ...verdict, status: 'already', note: `${verdict.note} Attendance is already recorded for this event.` } : verdict);
    }

    if (verdict.status === 'new') {
      const twin = pendingNew.find((other) => {
        if (compareNames(other.name, row.name).relation !== 'exact') return false;
        if (other.college && seen.college && other.college !== seen.college) return false;
        if (other.year && row.csvYear && other.year !== row.csvYear) return false;
        if (other.emails.length === 0 || row.emails.length === 0) return true;
        // Two different addresses are one person only as a personal + school pair
        // with the same college and year on both rows.
        const schoolPair = other.emails.some(isSchoolEmail) !== row.emails.some(isSchoolEmail);
        return schoolPair && !!other.college && other.college === seen.college && !!other.year && other.year === row.csvYear;
      });
      if (twin) {
        return duplicate('same_person_as_new_row', `Same new person as row ${rowNumber(twin.rowId)}; one member is created.`, twin.rowId, null,
          row.emails.filter((email) => !index.emailHolders.has(email)).map((email) => ({ email, method: 'same_submission' as const })));
      }
      pendingNew.push(seen);
    }
    return finish(verdict);
  });
}

function rowNumber(rowId: string): number {
  return Number(rowId.replace('row-', '')) + 2;
}
