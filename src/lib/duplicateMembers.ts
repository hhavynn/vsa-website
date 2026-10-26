// Likely duplicate member records for Admin → Merge Suggestions.
//
// Uses the same name folding and evidence as the attendance importer, so the
// two never disagree about who looks like whom. Suggestions only: merging is
// always an admin's confirmed action, and a pair an admin ignored stays hidden.
// Pairs come from indexes (shared address, same folded name, same first + last
// name), not from comparing every member with every other.
import { normalizeCollegeForMatch, normalizeEmail } from './memberMatching';
import { compareNames, personNameFromParts, PersonName } from './personName';
import { assessYearEvidence, YearObservation } from './yearStanding';
import type { EvidenceNote, IdentityAlias, IdentityMember } from './identityResolution';

export interface DuplicateCandidateMember extends IdentityMember {
  created_at: string;
  points: number;
  events_attended: number;
}

export type DuplicateReason =
  | 'shared_email'
  | 'same_name_college'
  | 'middle_name_college'
  | 'same_name';

export interface DuplicatePair<M extends DuplicateCandidateMember = DuplicateCandidateMember> {
  /** Older record; keeps its id. */
  target: M;
  /** Newer record; merged into the target. */
  source: M;
  reason: DuplicateReason;
  evidence: EvidenceNote[];
  /** Higher first. Ordering only. */
  strength: number;
}

export const DUPLICATE_REASON_LABEL: Record<DuplicateReason, string> = {
  shared_email: 'Same email on file',
  same_name_college: 'Same name and college',
  middle_name_college: 'Same first and last name and college (middle name differs)',
  same_name: 'Same name',
};

interface Prepared<M> {
  member: M;
  name: PersonName;
  college: string;
  emails: Set<string>;
  observations: YearObservation[];
}

/** Standing of both members compared in the later member's latest observed year. */
function yearNote(a: Prepared<DuplicateCandidateMember>, b: Prepared<DuplicateCandidateMember>): EvidenceNote | null {
  const latest = [...b.observations].sort((x, y) => y.academic_year_start - x.academic_year_start)[0];
  if (!latest) return null;
  const fit = assessYearEvidence(latest.year_label, a.member, a.observations, latest.academic_year_start);
  if (fit === 'compatible') return { tone: 'support', text: 'Recorded years line up over time' };
  if (fit === 'implausible') return { tone: 'against', text: 'Recorded years do not line up' };
  return null;
}

export function findDuplicateMembers<M extends DuplicateCandidateMember>(
  members: readonly M[],
  aliases: readonly IdentityAlias[],
  observations: readonly YearObservation[],
  excludedPairs: ReadonlySet<string>,
): DuplicatePair<M>[] {
  const byId = new Map<string, Prepared<M>>();
  const byEmail = new Map<string, string[]>();
  const byName = new Map<string, string[]>();
  const byFirstLast = new Map<string, string[]>();
  const push = (map: Map<string, string[]>, key: string, id: string) => {
    if (!key) return;
    const list = map.get(key);
    if (list) {
      if (!list.includes(id)) list.push(id);
    } else map.set(key, [id]);
  };

  const observationsByMember = new Map<string, YearObservation[]>();
  observations.forEach((o) => observationsByMember.set(o.member_id, [...(observationsByMember.get(o.member_id) ?? []), o]));

  members.forEach((member) => {
    const prepared: Prepared<M> = {
      member,
      name: personNameFromParts(member.first_name, member.last_name),
      college: normalizeCollegeForMatch(member.college),
      emails: new Set([normalizeEmail(member.email)].filter(Boolean)),
      observations: observationsByMember.get(member.id) ?? [],
    };
    byId.set(member.id, prepared);
    push(byName, prepared.name.key, member.id);
    const core = prepared.name.core;
    if (core.length >= 2) push(byFirstLast, `${core[0]} ${core[core.length - 1]}`, member.id);
  });
  aliases.forEach((alias) => byId.get(alias.member_id)?.emails.add(normalizeEmail(alias.email)));
  byId.forEach((prepared) => prepared.emails.forEach((email) => push(byEmail, email, prepared.member.id)));

  const pairs = new Map<string, DuplicatePair<M>>();
  const consider = (aId: string, bId: string) => {
    if (aId === bId) return;
    const pairKey = aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`;
    if (pairs.has(pairKey) || excludedPairs.has(`${aId}-${bId}`) || excludedPairs.has(`${bId}-${aId}`)) return;
    const a = byId.get(aId)!;
    const b = byId.get(bId)!;
    const [older, newer] = a.member.created_at <= b.member.created_at ? [a, b] : [b, a];

    const sharedEmail = Array.from(a.emails).some((email) => b.emails.has(email));
    const { relation } = compareNames(a.name, b.name);
    const sameCollege = !!a.college && a.college === b.college;
    const otherCollege = !!a.college && !!b.college && a.college !== b.college;

    let reason: DuplicateReason | null = null;
    if (sharedEmail) reason = 'shared_email';
    else if (relation === 'exact' && sameCollege) reason = 'same_name_college';
    else if (relation === 'middle_omitted' && sameCollege) reason = 'middle_name_college';
    else if (relation === 'exact') reason = 'same_name';
    if (!reason) return;

    const evidence: EvidenceNote[] = [];
    if (sharedEmail) evidence.push({ tone: 'support', text: 'An email address is on both records' });
    if (relation === 'exact') evidence.push({ tone: 'support', text: 'Same name (accents, case and middle initials ignored)' });
    if (relation === 'middle_omitted') evidence.push({ tone: 'neutral', text: 'Same first and last name; one has a middle name' });
    if (!sharedEmail && relation !== 'exact' && relation !== 'middle_omitted') evidence.push({ tone: 'against', text: 'The names differ' });
    if (sameCollege) evidence.push({ tone: 'support', text: 'Same college' });
    if (otherCollege) evidence.push({ tone: 'against', text: 'Different colleges' });
    const years = yearNote(older, newer);
    if (years) evidence.push(years);

    const strength = { shared_email: 400, same_name_college: 300, middle_name_college: 200, same_name: 100 }[reason]
      + evidence.reduce((n, note) => n + (note.tone === 'support' ? 10 : note.tone === 'against' ? -10 : 0), 0);
    pairs.set(pairKey, { target: older.member, source: newer.member, reason, evidence, strength });
  };

  const pairsWithin = (map: Map<string, string[]>) => map.forEach((ids) => {
    for (let i = 0; i < ids.length; i += 1) for (let j = i + 1; j < ids.length; j += 1) consider(ids[i], ids[j]);
  });
  pairsWithin(byEmail);
  pairsWithin(byName);
  pairsWithin(byFirstLast);

  return Array.from(pairs.values()).sort((x, y) => y.strength - x.strength || x.target.created_at.localeCompare(y.target.created_at));
}
