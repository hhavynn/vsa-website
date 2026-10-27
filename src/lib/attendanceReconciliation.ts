// Second-pass identity decisions for reconciling attendance that was imported
// under older, name-only matching (and events that were never imported).
//
// The importer's resolver (identityResolution.ts) is deliberately cautious: a
// different school address, a missing college or a one-letter spelling slip
// sends a row to an admin. For a bulk reconciliation most of those rows have an
// obvious answer once the evidence is weighed together, so this module decides
// them with a short, fixed list of rules and records which rule decided.
//
//   email_owner        a row address belongs to exactly one member and nothing
//                      about the name, college or standing contradicts it
//   same_submission    one row lists addresses held by two member records: the
//                      records are one person (reported for an admin to merge)
//   unique_candidate   exactly one member has this name and nothing contradicts
//                      them; a bare name with nothing to contradict counts
//   preserved_credit   among several credible members, the one whose existing
//                      credit was recorded from this very row keeps it
//   different_person   every same-name member is contradicted: a hard conflict
//                      is two different school logins, another college, an
//                      implausible standing, or that member already attending
//                      through another row of this file
//   repeat_submission  the member is already claimed by an earlier row
//
// Anything else stays pending for an admin. Nothing here writes to the database.
import type {
  CandidateAssessment,
  IdentityIndex,
  IdentityMember,
  IdentityResult,
} from './identityResolution';
import { isSchoolEmail } from './memberMatching';
import { compareNames, NameRelation, PersonName } from './personName';

export type ReconcileRule =
  | 'email_owner'
  | 'same_submission'
  | 'unique_candidate'
  | 'preserved_credit'
  | 'different_person'
  | 'repeat_submission'
  | 'new_person'
  | 'pending';

export type ReconcileDecision =
  | { kind: 'match'; memberId: string; rememberEmail: boolean; rule: ReconcileRule; note: string; mergeMemberIds: string[] }
  | { kind: 'new'; rule: ReconcileRule; note: string }
  | { kind: 'skip'; rule: ReconcileRule; note: string }
  | { kind: 'pending'; rule: ReconcileRule; note: string };

/** A source row that already produced an attendance credit for this event. */
export interface CreditProvenance {
  name: PersonName;
  emails: string[];
}

export interface ReconcileContext<M extends IdentityMember> {
  index: IdentityIndex<M>;
  /** Every resolved row of the file being reconciled. */
  rows: readonly IdentityResult<M>[];
  /** member id → source rows recorded as having credited them at this event. */
  provenance: ReadonlyMap<string, readonly CreditProvenance[]>;
}

/** identityResolution keeps this many candidates per review row (its MAX_CANDIDATES). */
const RESOLVER_CANDIDATE_LIMIT = 5;

// Typed school domains that are one slip away from ucsd.edu.
const SCHOOL_DOMAIN_TYPOS = /^ucsd\.(edy|edi|rdu|ed|eud|ude|edu\.|net|org|com)$/;

/** Fixes a mistyped school domain so the address can be compared; others are unchanged. */
export function canonicalEmail(email: string): string {
  const [local, domain] = email.trim().toLowerCase().split('@');
  if (!local || !domain) return email.trim().toLowerCase();
  return SCHOOL_DOMAIN_TYPOS.test(domain) ? `${local}@ucsd.edu` : `${local}@${domain}`;
}

/** The legacy account name (letters then three digits: abc123), as opposed to a name-based alias (a8lastname). */
export function isSchoolLogin(email: string): boolean {
  return /^[a-z]{2,6}\d{3,4}@ucsd\.edu$/.test(email);
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = next;
    }
  }
  return row[b.length];
}

export type SchoolEmailRelation =
  /** One side has no school address. */
  | 'none'
  | 'same'
  /** Differ by one character (a likely typo). */
  | 'typo'
  /** A login on one side and a name-based alias on the other: one student often has both. */
  | 'mixed'
  /** Both name-based aliases and different. Weak evidence of two people. */
  | 'alias_distinct'
  /** Both logins and different. One student has one login. */
  | 'login_distinct';

export function schoolEmailRelation(rowEmails: readonly string[], memberEmails: readonly string[]): SchoolEmailRelation {
  const a = rowEmails.filter(isSchoolEmail);
  const b = memberEmails.filter(isSchoolEmail);
  if (a.length === 0 || b.length === 0) return 'none';
  if (a.some((email) => b.includes(email))) return 'same';
  let worst: SchoolEmailRelation = 'mixed';
  let sawTypo = false;
  for (const x of a) {
    for (const y of b) {
      const [xl, yl] = [x.split('@')[0], y.split('@')[0]];
      // The digits on a login tell same-initial students apart (abc032 and abc036 are two
      // people), so logins never count as one-character typos of each other.
      if (!(isSchoolLogin(x) && isSchoolLogin(y)) && levenshtein(xl, yl) <= 1) { sawTypo = true; continue; }

      if (isSchoolLogin(x) && isSchoolLogin(y)) return 'login_distinct';
      if (!isSchoolLogin(x) && !isSchoolLogin(y)) worst = 'alias_distinct';
    }
  }
  return sawTypo && worst === 'mixed' ? 'typo' : worst;
}

const STRONG: ReadonlySet<NameRelation> = new Set<NameRelation>(['exact', 'middle_omitted']);

function lastToken(name: PersonName): string {
  return name.core[name.core.length - 1] ?? '';
}

/** Names that can be the same person even when spelled quite differently (a nickname and a full first name on one address). */
function namesPlausiblyOne(a: PersonName, b: PersonName): boolean {
  const { relation } = compareNames(a, b);
  if (relation !== 'different') return true;
  const [la, lb] = [lastToken(a), lastToken(b)];
  const [fa, fb] = [a.core[0] ?? '', b.core[0] ?? ''];
  const close = (x: string, y: string) => x !== '' && y !== '' && (x === y || (Math.min(x.length, y.length) >= 4 && levenshtein(x, y) <= 1));
  return close(la, lb) || close(fa, fb) || (fa !== '' && fb !== '' && (fa.startsWith(fb) || fb.startsWith(fa)));
}

interface Evidence<M extends IdentityMember> {
  candidate: CandidateAssessment<M>;
  /** Contradictions that make this a different person. */
  hard: string[];
  /** The part of `hard` that comes from addresses (a profile field alone can be a slip). */
  addressHard: boolean;
  /** Weak contradictions (two name-based school aliases). */
  soft: string[];
  emails: string[];
  /** A near-identical school login (same digits) that nothing contradicts but college and class year do not confirm. */
  nearLogin: boolean;
}

/** The class number in "2nd Year Transfer" (2), or null. */
function classLevel(label: string | null | undefined): number | null {
  const found = /(\d)(?:st|nd|rd|th)/i.exec(label ?? '');
  return found ? Number(found[1]) : null;
}

function assessCandidate<M extends IdentityMember>(
  row: IdentityResult<M>,
  candidate: CandidateAssessment<M>,
  ctx: ReconcileContext<M>,
): Evidence<M> {
  const prepared = ctx.index.byId.get(candidate.member.id);
  const emails = prepared ? Array.from(prepared.emails) : [];
  const hard: string[] = [];
  const soft: string[] = [];
  if (candidate.college === 'conflict') hard.push('another college is on file');
  if (candidate.year === 'implausible') hard.push('standing does not fit');
  const relation = schoolEmailRelation(row.emails, emails);
  // A login with the same digits and different letters (abc068 / abxyz068, xyn004 / xym004) can
  // be one student's typo, or two students with the same name: same-name students get
  // similar logins. It counts as one login only when college AND class year both agree. With
  // either missing it goes to an admin; with either different it is someone else. A middle
  // initial never matters (the name still compares as exact); a full middle name does.
  const digits = (login: string) => login.split('@')[0].replace(/^[a-z]+/, '');
  const letters = (login: string) => login.split('@')[0].replace(/\d+$/, '');
  const [rowClass, memberClass] = [classLevel(row.csvYear), classLevel(candidate.member.year)];
  const classDiffers = rowClass !== null && memberClass !== null && rowClass !== memberClass;
  const sameDigits = relation === 'login_distinct' && candidate.name === 'exact'
    && candidate.college !== 'conflict' && candidate.year !== 'implausible' && !classDiffers
    && row.emails.filter(isSchoolLogin).every((x) => emails.filter(isSchoolLogin).some((y) =>
      digits(x) === digits(y) && (candidate.college === 'match' || levenshtein(letters(x), letters(y)) <= 1)));
  const confirmedTypo = sameDigits && candidate.college === 'match' && rowClass !== null && rowClass === memberClass;
  const nearLogin = sameDigits && !confirmedTypo;
  if (relation === 'login_distinct' && !confirmedTypo && !nearLogin) hard.push('a different school login is on file');
  if (relation === 'alias_distinct') soft.push('a different school alias is on file');
  // A near-identical address does not outweigh another college: that is someone else.
  if (relation === 'typo' && candidate.college === 'conflict') soft.push('a similar but different school address is on file');
  // The member is already in this file through a row with their own address, so
  // this row (with a different one) is somebody else.
  const own = emails.filter(isSchoolEmail);
  const elsewhere = own.length > 0 && ctx.rows.some((other) =>
    other.rowId !== row.rowId
    && other.duplicateOf !== row.rowId && row.duplicateOf !== other.rowId
    && other.emails.some((email) => own.includes(email))
    && !row.emails.some((email) => other.emails.includes(email)));
  if (elsewhere) hard.push('already attending through another row of this file');
  const addressHard = hard.some((reason) => reason.includes('login') || reason.includes('another row'));
  return { candidate, hard, soft, emails, addressHard, nearLogin };
}

/** Why a row cannot be this member (empty when nothing contradicts them). */
export function hardContradictions<M extends IdentityMember>(
  row: IdentityResult<M>,
  memberId: string,
  ctx: ReconcileContext<M>,
): string[] {
  const candidate = row.candidates.find((c) => c.member.id === memberId);
  return candidate ? assessCandidate(row, candidate, ctx).hard : [];
}

function wasCreditedFromRow<M extends IdentityMember>(
  row: IdentityResult<M>,
  memberId: string,
  ctx: ReconcileContext<M>,
): boolean {
  return (ctx.provenance.get(memberId) ?? []).some((source) =>
    source.emails.some((email) => row.emails.includes(email))
    || (source.emails.length === 0 && source.name.key === row.name.key));
}

function match(memberId: string, rule: ReconcileRule, note: string, rememberEmail = false, mergeMemberIds: string[] = []): ReconcileDecision {
  return { kind: 'match', memberId, rule, note, rememberEmail, mergeMemberIds };
}

/** A misspelled name (two letters swapped) with the same college and standing and no address to contradict it. */
function nearNameMatch<M extends IdentityMember>(row: IdentityResult<M>, ctx: ReconcileContext<M>): ReconcileDecision | null {
  const near = row.candidates.filter((c) => c.name === 'similar' && c.college === 'match' && c.year === 'compatible');
  if (near.length !== 1 || row.emails.some(isSchoolEmail)) return null;
  const [only] = near;
  const { relation, closeness } = compareNames(row.name, ctx.index.byId.get(only.member.id)!.name);
  if (relation !== 'similar' || closeness < 85) return null;
  if (assessCandidate(row, only, ctx).hard.length > 0) return null;
  return match(only.member.id, 'unique_candidate', 'A one-letter spelling slip with the same college and standing, and no address to contradict it.', false);
}

/**
 * The decision for a row the resolver left to an admin, or null when the
 * resolver's own verdict already stands (automatic match, already recorded,
 * new member, or a repeat in effect).
 */
export function reconcileRow<M extends IdentityMember>(
  row: IdentityResult<M>,
  ctx: ReconcileContext<M>,
): ReconcileDecision | null {
  if (!row.displayName.trim()) return null;
  if (row.status === 'match' || row.status === 'already' || row.status === 'duplicate') return null;
  if (row.status === 'new') return nearNameMatch(row, ctx);

  // ── The row repeats a member an earlier row already claimed. ────────────────
  if (row.reason === 'member_claimed_by_earlier_row' && row.candidates.length === 1) {
    const only = row.candidates[0];
    const prepared = ctx.index.byId.get(only.member.id);
    const holds = !!prepared && row.emails.some((email) => prepared.emails.has(email));
    if (STRONG.has(only.name) && (holds || row.emails.length === 0)) {
      return { kind: 'skip', rule: 'repeat_submission', note: `Same person as ${only.member.first_name} ${only.member.last_name}; already counted by an earlier row.` };
    }
  }

  // ── Email owner(s). ─────────────────────────────────────────────────────────
  const owners = new Set<string>();
  row.emails.forEach((email) => ctx.index.emailHolders.get(email)?.forEach((id) => owners.add(id)));
  if (owners.size > 1) {
    // One submission lists addresses held by different records: one person, two records.
    // That needs a submission that links separate addresses. An address two members
    // share (a family inbox) says nothing about whether they are the same person.
    const records = Array.from(owners).map((id) => row.candidates.find((c) => c.member.id === id)).filter(Boolean) as CandidateAssessment<M>[];
    const linksSeparateAddresses = row.emails.length >= 2
      && row.emails.every((email) => (ctx.index.emailHolders.get(email)?.size ?? 0) <= 1)
      && Array.from(owners).every((id) => row.emails.some((email) => ctx.index.emailHolders.get(email)?.has(id)));
    const compatible = records.length === owners.size && records.every((c) => namesPlausiblyOne(row.name, ctx.index.byId.get(c.member.id)!.name)
      && c.year !== 'implausible' && c.college !== 'conflict');
    // The records may still be two people if their own school logins differ.
    const logins = new Set(records.flatMap((c) => Array.from(ctx.index.byId.get(c.member.id)!.emails)).filter(isSchoolLogin));
    if (linksSeparateAddresses && compatible && logins.size <= 1) {
      const keep = [...records].sort((a, b) => (b.member.points ?? 0) - (a.member.points ?? 0))[0];
      return match(keep.member.id, 'same_submission',
        `One row lists addresses held by ${records.length} records; they are one person.`, false,
        records.filter((c) => c !== keep).map((c) => c.member.id));
    }
    return { kind: 'pending', rule: 'pending', note: 'The row lists an address shared by several members, or addresses held by members whose records disagree.' };
  }
  if (owners.size === 1) {
    const [ownerId] = Array.from(owners);
    const candidate = row.candidates.find((c) => c.member.id === ownerId);
    const prepared = ctx.index.byId.get(ownerId);
    if (candidate && prepared) {
      const named = namesPlausiblyOne(row.name, prepared.name);
      const ok = named && candidate.college !== 'conflict' && candidate.year !== 'implausible';
      const holdsSchool = row.emails.some((email) => isSchoolEmail(email) && prepared.emails.has(email));
      if (ok && (holdsSchool || STRONG.has(candidate.name) || candidate.name === 'first_name_prefix' || candidate.name === 'similar')) {
        return match(ownerId, 'email_owner', 'The row\'s email belongs to this member and nothing contradicts the match.', false);
      }
    }
    return { kind: 'pending', rule: 'pending', note: 'The email belongs to a member whose name, college or standing disagrees with this row.' };
  }

  // ── Name candidates. ────────────────────────────────────────────────────────
  // The resolver keeps only its best few candidates. When the list is full, members that
  // would change the answer may be missing, so neither a match nor a new member is safe.
  if (row.candidates.length >= RESOLVER_CANDIDATE_LIMIT) {
    return { kind: 'pending', rule: 'pending', note: 'Too many members share this name to rule any of them out.' };
  }
  const strong = row.candidates.filter((c) => STRONG.has(c.name) || (c.name === 'first_name_prefix' && c.college === 'match'));
  const assessed = strong.map((c) => assessCandidate(row, c, ctx));
  const eligible = assessed.filter((e) => e.hard.length === 0 && !e.nearLogin);
  const pool = eligible.filter((e) => e.soft.length === 0);
  // A soft contradiction plus a profile mismatch is a firm one.
  assessed.forEach((e) => { if (e.hard.length === 0 && e.soft.length > 0 && e.candidate.college === 'conflict') e.hard.push('another college is on file'); });

  const pick = (list: Evidence<M>[]): ReconcileDecision | null => {
    if (list.length === 1) {
      const only = list[0];
      const relation = schoolEmailRelation(row.emails, only.emails);
      const strongEvidence = only.candidate.college === 'match' && only.candidate.year === 'compatible'
        && only.candidate.name === 'exact' && row.emails.some(isSchoolEmail)
        && (relation === 'mixed' || relation === 'none');
      return match(only.candidate.member.id, 'unique_candidate',
        'The only member with this name; nothing on file contradicts them.', strongEvidence);
    }
    if (list.length > 1) {
      const preserved = list.filter((e) => wasCreditedFromRow(row, e.candidate.member.id, ctx));
      if (preserved.length === 1) {
        return match(preserved[0].candidate.member.id, 'preserved_credit',
          'Several members share this name; the credit already recorded from this row is kept.', false);
      }
      const byCollege = list.filter((e) => e.candidate.college === 'match');
      if (byCollege.length === 1) {
        return match(byCollege[0].candidate.member.id, 'unique_candidate',
          'Several members share this name; only one is in this college.', false);
      }
    }
    return null;
  };

  const decided = pick(pool) ?? (pool.length === 0 ? pick(eligible) : null);
  if (decided) return decided;

  // Same name, a near-identical school login, and college or class year not there to confirm it.
  if (assessed.some((e) => e.nearLogin && e.hard.length === 0)) {
    return { kind: 'pending', rule: 'pending', note: 'Near-identical school login on a member with the same name. Same person only if college and class year agree; they are not both on file.' };
  }

  if (eligible.length > 1) {
    return { kind: 'pending', rule: 'pending', note: 'Several members share this name and nothing separates them.' };
  }

  // Every same-name member is contradicted: this is someone else, provided the
  // contradiction is firm (an address, or two profile fields). A college or
  // standing alone can be a slip on the form, so an admin decides those.
  if (assessed.length > 0 && eligible.length === 0) {
    const reasons = Array.from(new Set(assessed.flatMap((e) => e.hard))).join('; ');
    const firm = (e: Evidence<M>) => e.addressHard || e.hard.length + e.soft.length + (e.candidate.name === 'exact' ? 0 : 1) >= 2;
    if (assessed.every(firm)) {
      return { kind: 'new', rule: 'different_person', note: `Same name, but ${reasons}.` };
    }
    return { kind: 'pending', rule: 'pending', note: `Same name, but ${reasons}; only the college or standing differs, which can be a slip on the form.` };
  }

  // A shortened or misspelled name: accept only when college, standing and
  // address all agree and the existing credit came from this very row.
  const near = row.candidates.filter((c) => c.name === 'similar' || c.name === 'reordered');
  if (near.length === 1) {
    const evidence = assessCandidate(row, near[0], ctx);
    const prepared = ctx.index.byId.get(near[0].member.id);
    const addressOk = !prepared || prepared.emails.size === 0 || row.emails.length === 0;
    if (evidence.hard.length === 0 && near[0].college !== 'conflict' && near[0].year !== 'implausible' && addressOk
        && wasCreditedFromRow(row, near[0].member.id, ctx)) {
      return match(near[0].member.id, 'preserved_credit', 'Same college and standing, no address to contradict, and this row already credited them.', false);
    }
  }
  const spelled = row.candidates.filter((c) => c.name === 'similar'
    && compareNames(row.name, ctx.index.byId.get(c.member.id)!.name).closeness >= 90);
  if (spelled.length === 1 && row.candidates.length === 1) {
    const evidence = assessCandidate(row, spelled[0], ctx);
    if (evidence.hard.length === 0 && evidence.soft.length === 0 && spelled[0].year !== 'uncertain') {
      return match(spelled[0].member.id, 'unique_candidate', 'A one-letter spelling slip of the only similar name; nothing on file contradicts it.', false);
    }
  }
  if (row.candidates.length > 0) {
    return { kind: 'pending', rule: 'pending', note: 'Only a similar name; an admin should confirm.' };
  }
  return { kind: 'new', rule: 'new_person', note: 'No existing member is a credible match.' };
}
