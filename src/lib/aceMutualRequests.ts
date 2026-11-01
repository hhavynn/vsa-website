// Mutual Big/Little request check for the ACE chair. Takes the pasted "ACE
// Mutual Request" Google Form responses and works out which pairs asked for
// each other. Pure: no storage, no network. Only the name, preferred name,
// fam, UCSD email, role and request columns are read; every contact column
// (phone, socials, the collected "Email Address") is ignored.
import type { AceNodeRef, DraftSeed, ImportResolution } from './aceAssignments';
import { parseDelimitedPaste } from './delimitedPaste';
import type { MemberOption } from './memberLinkMatching';
import { normalizeMemberName } from './memberLinkMatching';
import { pluralize } from './operationalStatus';
import type { ImportReviewRow } from './adminImportReview';

export type MutualRole = 'big' | 'little';

export interface MutualRespondent {
  /** Stable key: the UCSD email, else the normalized name, else the row. */
  id: string;
  /** Row of the latest submission in the paste (header is row 1). */
  line: number;
  /** Used only to link a member while importing; never shown or stored. */
  email: string | null;
  name: string;
  preferredName: string | null;
  fam: string | null;
  role: MutualRole | null;
  /** The answer to "Who are you Mutually Requesting?", as written. */
  requestText: string;
  /** Names pulled out of requestText, filler removed. */
  requested: string[];
  submissions: number;
  /** Every role this person answered with, across all their submissions. */
  rolesSeen: MutualRole[];
}

export interface ParsedMutualRequests {
  respondents: MutualRespondent[];
  repeatsReplaced: number;
  warnings: string[];
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

type MutualColumn = 'timestamp' | 'name' | 'preferred' | 'fam' | 'ucsd email' | 'role' | 'request';

const COLUMN_PATTERNS: ReadonlyArray<[RegExp, MutualColumn]> = [
  [/^timestamp$/, 'timestamp'],
  [/^name(first)?/, 'name'],
  [/^preferredname/, 'preferred'],
  [/^fam/, 'fam'],
  [/^ucsdemail/, 'ucsd email'],
  [/^areyoumutuallyrequesting/, 'role'],
  [/^whoareyoumutuallyrequesting/, 'request'],
];

function headerKey(header: string): string {
  return header.toLowerCase().replace(/[^a-z]/g, '');
}

function squash(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** "Big" means they want a Big, so they are a Little. */
function roleFromAnswer(answer: string): MutualRole | null {
  const value = answer.toLowerCase();
  const wantsBig = /\bbig/.test(value);
  const wantsLittle = /\blittle|\blil\b/.test(value);
  if (wantsBig === wantsLittle) return null;
  return wantsBig ? 'little' : 'big';
}

function ucsdEmailKey(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!email) return null;
  return /^[a-z0-9._-]+$/.test(email) ? `${email}@ucsd.edu` : email;
}

function isLetter(char: string): boolean {
  return char.toLowerCase() !== char.toUpperCase();
}

/** Keeps letters, spaces, apostrophes and hyphens; emoji and digits go. */
function lettersOnly(value: string): string {
  return Array.from(value)
    .map((char) => (isLetter(char) || char === "'" || char === '’' || char === '-' ? char : ' '))
    .join('')
    .replace(/[’]/g, "'")
    .replace(/(^|\s)['-]+|['-]+(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCaseIfFlat(name: string): string {
  if (name !== name.toLowerCase() && name !== name.toUpperCase()) return name;
  return name.toLowerCase().replace(/(^|[\s'-])([^\s'-])/g, (_, lead: string, char: string) => lead + char.toUpperCase());
}

/** "Diego, L, Nguyen" or "gwen h. tran 🌸" → "Diego Nguyen", "Gwen Tran". */
export function cleanPersonName(raw: string): string {
  const parts = lettersOnly(raw.replace(/[,.]/g, ' ')).split(' ').filter(Boolean);
  const kept = parts.length > 2 ? [parts[0], ...parts.slice(1, -1).filter((part) => part.length > 1), parts[parts.length - 1]] : parts;
  return titleCaseIfFlat(kept.join(' '));
}

// Filler is removed as whole phrases, never as lone words that can also be
// names ("My", "An", "To" are all real Vietnamese names).
const ROLE_WORD = '(?:big|little|lil)s?';
const FILLER_PATTERNS: readonly RegExp[] = [
  /\b(?:this is )?(?:my )?(?:first|second|third|\d+(?:st|nd|rd|th)) (?:time|submission)\b.*$/gi,
  /\bfill(?:ing|ed)? (?:out )?(?:the |this )?form\b.*$/gi,
  new RegExp(`\\b(?:i ?'?m|i am)(?: (?:a|the))? ${ROLE_WORD}\\b`, 'gi'),
  new RegExp(`\\b(?:to be|as|for|is|are|be|will be|would be)? ?my ${ROLE_WORD}\\b(?: (?:is|are|will be|would be)\\b)?`, 'gi'),
  new RegExp(`\\b(?:i ?'?m |i am |i'?d like |i )?(?:mutually )?(?:requesting|request(?:ed)?|want|choosing|choose|picking)(?: (?:a|my|for|as) ${ROLE_WORD}\\b)?`, 'gi'),
  new RegExp(`\\bmutual(?:ly)?(?: request(?:ing)?)?(?: ${ROLE_WORD}\\b)?`, 'gi'),
  new RegExp(`^(?:${ROLE_WORD}) ?:`, 'gi'),
  /\b(?:please|thank you|thanks|ty)\b/gi,
];
const LONE_FILLER = new Set(['big', 'bigs', 'little', 'littles', 'lil', 'and', 'or', 'i', 'im', "i'm", 'me', 'is', 'are', 'be', 'a', 'the', 'both', 'of', 'them']);

/** A segment left with only filler words is dropped. */
function stripFiller(segment: string): string {
  let text = segment.replace(/’/g, "'");
  for (const pattern of FILLER_PATTERNS) text = text.replace(pattern, ' ');
  const cleaned = lettersOnly(text);
  const words = cleaned.split(' ').filter(Boolean);
  if (words.every((word) => LONE_FILLER.has(word.toLowerCase()))) return '';
  return cleaned;
}

/**
 * "Im a little, requesting Jane Doe to be my big (2nd time)" → ["Jane Doe"].
 * Names may be separated by commas, &, /, +, ;, line breaks, or "and".
 */
export function splitRequestedNames(text: string): string[] {
  const withoutAsides = text.replace(/\([^)]*\)?|\[[^\]]*\]?/g, ' ');
  const names: string[] = [];
  const seen = new Set<string>();
  for (const segment of withoutAsides.split(/\s*(?:[,&/;+\n]|\band\b|\bor\b)\s*/i)) {
    const name = cleanPersonName(stripFiller(segment));
    const key = normalizeMemberName(name);
    if (name && !seen.has(key)) {
      seen.add(key);
      names.push(name);
    }
  }
  return names;
}

interface RawSubmission {
  line: number;
  order: number;
  time: number | null;
  key: string;
  email: string | null;
  name: string;
  preferredName: string | null;
  fam: string | null;
  role: MutualRole | null;
  requestText: string;
}

function isLater(next: RawSubmission, current: RawSubmission): boolean {
  if (next.time !== null && current.time !== null && next.time !== current.time) return next.time > current.time;
  return next.order > current.order;
}

/** Parses the pasted responses and keeps each person's latest submission. */
export function parseMutualRequests(text: string): ParsedMutualRequests {
  const records = parseDelimitedPaste(text);
  const result: ParsedMutualRequests = { respondents: [], repeatsReplaced: 0, warnings: [] };
  if (records.length === 0) return result;

  const columnIndex = new Map<MutualColumn, number>();
  records[0].forEach((header, index) => {
    const key = headerKey(header);
    const column = COLUMN_PATTERNS.find(([pattern]) => pattern.test(key))?.[1];
    if (column && !columnIndex.has(column)) columnIndex.set(column, index);
  });
  const missing = (['name', 'role', 'request'] as const).filter((column) => !columnIndex.has(column));
  if (missing.length > 0) {
    result.warnings.push(
      'Paste the responses with their header row. Needed: "Name", "Are you mutually requesting a Big or a Little?" and "Who are you Mutually Requesting?".',
    );
    return result;
  }

  const submissions: RawSubmission[] = [];
  let blank = 0;
  records.slice(1).forEach((cells, offset) => {
    const cell = (column: MutualColumn) => {
      const index = columnIndex.get(column);
      return index === undefined ? '' : squash(cells[index]);
    };
    const name = cleanPersonName(cell('name'));
    if (!name) {
      blank += 1;
      return;
    }
    const email = ucsdEmailKey(cell('ucsd email'));
    const parsedTime = Date.parse(cell('timestamp'));
    submissions.push({
      line: offset + 2,
      order: offset,
      time: Number.isNaN(parsedTime) ? null : parsedTime,
      // A name alone is not a submission identity. Never collapse two
      // email-less rows as a single person just because the names agree.
      key: email ?? `name:${normalizeMemberName(name)}:row:${offset + 2}`,
      email,
      name,
      preferredName: cleanPersonName(cell('preferred')) || null,
      fam: cell('fam') || null,
      role: roleFromAnswer(cell('role')),
      requestText: (cells[columnIndex.get('request') ?? -1] ?? '').trim(),
    });
  });

  const missingEmailByName = new Map<string, number>();
  for (const submission of submissions) {
    if (submission.email) continue;
    const key = normalizeMemberName(submission.name);
    missingEmailByName.set(key, (missingEmailByName.get(key) ?? 0) + 1);
  }
  const duplicateEmailLess = Array.from(missingEmailByName.values()).filter((count) => count > 1).length;
  if (duplicateEmailLess > 0) {
    result.warnings.push(
      `${pluralize(duplicateEmailLess, 'name')} appear on multiple submissions without a UCSD email. Kept separate for chair identity review; do not assume these are repeat responses.`,
    );
  }

  const byKey = new Map<string, RawSubmission[]>();
  for (const submission of submissions) byKey.set(submission.key, [...(byKey.get(submission.key) ?? []), submission]);

  let unknownRole = 0;
  for (const group of Array.from(byKey.values())) {
    const latest = group.reduce((current, next) => (isLater(next, current) ? next : current));
    result.repeatsReplaced += group.length - 1;
    const rolesSeen = Array.from(new Set(group.flatMap((submission) => (submission.role ? [submission.role] : []))));
    if (!latest.role) unknownRole += 1;
    result.respondents.push({
      id: latest.key,
      line: latest.line,
      email: latest.email,
      name: latest.name,
      preferredName: latest.preferredName,
      // A Little's "Fam" answer is filler ("Im a little").
      fam: latest.role === 'big' ? latest.fam : null,
      role: latest.role,
      requestText: latest.requestText,
      requested: splitRequestedNames(latest.requestText),
      submissions: group.length,
      rolesSeen,
    });
  }
  result.respondents.sort((a, b) => a.line - b.line);

  if (blank > 0) result.warnings.push(`${pluralize(blank, 'row')} without a name skipped.`);
  if (result.repeatsReplaced > 0) {
    result.warnings.push(`${pluralize(result.repeatsReplaced, 'earlier submission')} replaced by the same person's latest one.`);
  }
  if (unknownRole > 0) {
    result.warnings.push(`${pluralize(unknownRole, 'person', 'people')} did not say Big or Little, so their requests are matched against everyone.`);
  }
  return result;
}

// ─── Matching ────────────────────────────────────────────────────────────────

export type MatchMethod = 'full_name' | 'first_last' | 'preferred_last' | 'first_only' | 'fuzzy';

export type NameResolution =
  | { kind: 'exact'; method: Exclude<MatchMethod, 'fuzzy'>; target: MutualRespondent }
  | { kind: 'possible'; method: 'fuzzy'; target: MutualRespondent; distance: number }
  | { kind: 'ambiguous'; candidates: MutualRespondent[] }
  | { kind: 'none' };

function tokens(name: string | null): string[] {
  return normalizeMemberName(name).split(/[\s-]+/).filter(Boolean);
}

/** Every way a respondent can be written, normalized. */
interface NameKeys {
  full: string;
  first: string;
  last: string;
  firstLast: string;
  preferredFirst: string | null;
  preferredLast: string | null;
}

function keysFor(respondent: MutualRespondent): NameKeys {
  const parts = tokens(respondent.name);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const preferred = tokens(respondent.preferredName);
  const preferredFirst = preferred[0] && preferred[0] !== first ? preferred[0] : null;
  return {
    full: parts.join(' '),
    first,
    last,
    firstLast: last ? `${first} ${last}` : first,
    preferredFirst,
    preferredLast: preferredFirst && last ? `${preferredFirst} ${last}` : null,
  };
}

export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

/** One typo for a short name, two for a long one; none below four letters. */
function allowedDistance(length: number): number {
  if (length >= 10) return 2;
  if (length >= 4) return 1;
  return 0;
}

/**
 * Resolves a requested name against the candidates (the opposite role), in
 * order: full name, first + last, preferred + last, unique first name, then a
 * fuzzy "possible" match the chair must confirm. A tie at any step stops as
 * ambiguous rather than guessing.
 */
export function resolveRequestedName(requested: string, candidates: readonly MutualRespondent[]): NameResolution {
  const parts = tokens(requested);
  if (parts.length === 0) return { kind: 'none' };
  const keyed = candidates.map((candidate) => ({ candidate, keys: keysFor(candidate) }));
  const full = parts.join(' ');
  const firstLast = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : null;

  const steps: Array<[Exclude<MatchMethod, 'fuzzy'>, (keys: NameKeys) => boolean]> = [
    ['full_name', (keys) => keys.full === full],
    ['first_last', (keys) => firstLast !== null && keys.firstLast === firstLast],
    ['preferred_last', (keys) => firstLast !== null && keys.preferredLast === firstLast],
    ['first_only', (keys) => parts.length === 1 && (keys.first === full || keys.preferredFirst === full)],
  ];
  for (const [method, test] of steps) {
    const hits = keyed.filter(({ keys }) => test(keys)).map(({ candidate }) => candidate);
    if (hits.length === 1) return { kind: 'exact', method, target: hits[0] };
    if (hits.length > 1) return { kind: 'ambiguous', candidates: hits };
  }

  const wanted = firstLast ?? full;
  const limit = allowedDistance(wanted.replace(/\s/g, '').length);
  if (limit === 0) return { kind: 'none' };
  let best = Infinity;
  let bestHits: MutualRespondent[] = [];
  for (const { candidate, keys } of keyed) {
    const forms = firstLast ? [keys.firstLast, keys.preferredLast] : [keys.first, keys.preferredFirst];
    const distance = Math.min(...forms.filter((form): form is string => !!form && form.includes(' ') === !!firstLast).map((form) => editDistance(wanted, form)));
    if (distance > limit) continue;
    if (distance < best) {
      best = distance;
      bestHits = [candidate];
    } else if (distance === best) {
      bestHits.push(candidate);
    }
  }
  if (bestHits.length === 1) return { kind: 'possible', method: 'fuzzy', target: bestHits[0], distance: best };
  if (bestHits.length > 1) return { kind: 'ambiguous', candidates: bestHits };
  return { kind: 'none' };
}

// ─── Classification ──────────────────────────────────────────────────────────

export type PossibleDecision = 'accepted' | 'rejected';
/**
 * Keyed by possibleMatchKey. A missing key means not decided yet. The key
 * names the candidate too, so a decision never carries over to someone else
 * after the paste changes.
 */
export type PossibleDecisions = ReadonlyMap<string, PossibleDecision>;

export function possibleMatchKey(requesterId: string, requested: string, candidateId: string): string {
  return `${requesterId}→${normalizeMemberName(requested)}→${candidateId}`;
}

export interface MutualPair {
  big: MutualRespondent;
  little: MutualRespondent;
  /** True when either side was a fuzzy match the chair accepted. */
  confirmedByChair: boolean;
}

export interface OneSidedRequest {
  from: MutualRespondent;
  to: MutualRespondent;
  requested: string;
}

export interface UnresolvedRequest {
  from: MutualRespondent;
  requested: string;
  reason: string;
}

export interface PossibleMatch {
  key: string;
  from: MutualRespondent;
  requested: string;
  candidate: MutualRespondent;
  decision: PossibleDecision | 'pending';
}

export interface MutualConflict {
  kind: 'multiple_bigs' | 'both_roles' | 'duplicate_name';
  person: MutualRespondent;
  /** For multiple_bigs: the Bigs this Little matched with. */
  others: MutualRespondent[];
  message: string;
}

export interface MutualRequestCheck {
  respondents: MutualRespondent[];
  pairs: MutualPair[];
  oneSided: OneSidedRequest[];
  unresolved: UnresolvedRequest[];
  possible: PossibleMatch[];
  conflicts: MutualConflict[];
}

function opposite(role: MutualRole | null): MutualRole | null {
  if (role === 'big') return 'little';
  if (role === 'little') return 'big';
  return null;
}

/**
 * A pair is mutual only when both people requested each other, through an
 * exact match or a fuzzy match the chair accepted. A Little matched with more
 * than one Big, or anyone who answered as both roles, is a conflict and is
 * kept out of the confirmed pairs until the paste is fixed.
 */
export function classifyMutualRequests(
  respondents: readonly MutualRespondent[],
  decisions: PossibleDecisions = new Map(),
): MutualRequestCheck {
  const check: MutualRequestCheck = { respondents: [...respondents], pairs: [], oneSided: [], unresolved: [], possible: [], conflicts: [] };
  // edges.get(a) holds who a requested, with whether a fuzzy accept was needed.
  const edges = new Map<string, Map<string, { requested: string; byChair: boolean }>>();

  for (const from of respondents) {
    const wanted = opposite(from.role);
    const candidates = respondents.filter((other) => other.id !== from.id && (wanted === null || other.role === wanted || other.role === null));
    const out = new Map<string, { requested: string; byChair: boolean }>();
    edges.set(from.id, out);
    for (const requested of from.requested) {
      const resolution = resolveRequestedName(requested, candidates);
      if (resolution.kind === 'exact') {
        if (!out.has(resolution.target.id)) out.set(resolution.target.id, { requested, byChair: false });
        continue;
      }
      if (resolution.kind === 'possible') {
        const key = possibleMatchKey(from.id, requested, resolution.target.id);
        const decision = decisions.get(key) ?? 'pending';
        check.possible.push({ key, from, requested, candidate: resolution.target, decision });
        if (decision === 'accepted' && !out.has(resolution.target.id)) out.set(resolution.target.id, { requested, byChair: true });
        if (decision === 'rejected') check.unresolved.push({ from, requested, reason: `Not ${resolution.target.name} (rejected by the chair).` });
        continue;
      }
      if (resolution.kind === 'ambiguous') {
        check.unresolved.push({
          from,
          requested,
          reason: `Could be ${resolution.candidates.map((candidate) => candidate.name).join(' or ')}. Ask which one.`,
        });
        continue;
      }
      const sameRole = respondents.some(
        (other) => other.id !== from.id && other.role === from.role && from.role !== null && resolveRequestedName(requested, [other]).kind === 'exact',
      );
      check.unresolved.push({
        from,
        requested,
        reason: sameRole
          ? `Matches someone who also answered as a ${from.role === 'big' ? 'Big' : 'Little'}.`
          : `Nobody in the form matches this name.`,
      });
    }
  }

  const byId = new Map(respondents.map((respondent) => [respondent.id, respondent]));
  const mutual: MutualPair[] = [];
  for (const from of respondents) {
    for (const [toId, edge] of Array.from(edges.get(from.id) ?? [])) {
      const to = byId.get(toId);
      if (!to) continue;
      const back = edges.get(toId)?.get(from.id);
      if (!back) {
        check.oneSided.push({ from, to, requested: edge.requested });
        continue;
      }
      if (from.role === null && to.role === null) {
        if (from.line < to.line) check.unresolved.push({ from, requested: edge.requested, reason: `Requested each other, but neither said Big or Little.` });
        continue;
      }
      // Count each mutual pair once, from the Big's side.
      const big = from.role === 'big' || to.role === 'little' ? from : to;
      const little = big === from ? to : from;
      if (from !== big) continue;
      mutual.push({ big, little, confirmedByChair: edge.byChair || back.byChair });
    }
  }

  const conflicted = new Set<string>();
  for (const respondent of respondents) {
    if (respondent.rolesSeen.length > 1) {
      conflicted.add(respondent.id);
      check.conflicts.push({
        kind: 'both_roles',
        person: respondent,
        others: [],
        message: `Answered as both a Big and a Little across ${respondent.submissions} submissions. The latest says ${respondent.role === 'big' ? 'Big' : 'Little'}; remove the wrong row and paste again.`,
      });
    }
  }
  // One displayed name may refer to several different people. Even with
  // separate emails, that name is not sufficient proof of who is meant.
  // Prevent all affected respondents from producing "confirmed" pairs until
  // the chair resolves the canonical identity outside this paste-only preview.
  const respondentsByName = new Map<string, MutualRespondent[]>();
  for (const respondent of respondents) {
    const nameKey = normalizeMemberName(respondent.name);
    respondentsByName.set(nameKey, [...(respondentsByName.get(nameKey) ?? []), respondent]);
  }
  for (const group of respondentsByName.values()) {
    if (group.length < 2) continue;
    for (const person of group) conflicted.add(person.id);
    check.conflicts.push({
      kind: 'duplicate_name',
      person: group[0],
      others: group.slice(1),
      message: `${group.length} responses share the name ${group[0].name} but have distinct/unverified identities. Resolve the name and source submission identities manually before accepting a pairing.`,
    });
  }

  const bigsByLittle = new Map<string, MutualPair[]>();
  for (const pair of mutual) bigsByLittle.set(pair.little.id, [...(bigsByLittle.get(pair.little.id) ?? []), pair]);
  for (const group of Array.from(bigsByLittle.values())) {
    if (group.length < 2) continue;
    conflicted.add(group[0].little.id);
    check.conflicts.push({
      kind: 'multiple_bigs',
      person: group[0].little,
      others: group.map((pair) => pair.big),
      message: `Mutually matched with ${group.length} Bigs: ${group.map((pair) => pair.big.name).join(', ')}. Pick one by hand.`,
    });
  }
  check.pairs = mutual.filter((pair) => !conflicted.has(pair.big.id) && !conflicted.has(pair.little.id));
  return check;
}

// ─── Into the draft ──────────────────────────────────────────────────────────

export interface MutualImportPlan {
  resolution: ImportResolution;
  /** Littles left out because they are already in the draft. */
  alreadyInDraft: number;
}

/**
 * Turns confirmed pairs into draft rows for the existing import path. The
 * Little links to a member only by a unique UCSD email match. The Big is
 * assigned only when exactly one tree node has their name; otherwise the
 * request is kept in notes. No email is carried forward.
 */
export function planMutualImport(
  pairs: readonly MutualPair[],
  options: {
    nodes: readonly AceNodeRef[];
    membersByEmail: ReadonlyMap<string, readonly MemberOption[]>;
    existingNames: readonly string[];
  },
): MutualImportPlan {
  const existing = new Set(options.existingNames.map((name) => normalizeMemberName(name)));
  const nodesByName = new Map<string, AceNodeRef[]>();
  for (const node of options.nodes) {
    const key = normalizeMemberName(node.name);
    nodesByName.set(key, [...(nodesByName.get(key) ?? []), node]);
  }

  let alreadyInDraft = 0;
  let emailLinked = 0;
  let bigMatched = 0;
  let bigUnresolved = 0;
  const seeds: DraftSeed[] = [];
  for (const { big, little } of pairs) {
    const littleKey = normalizeMemberName(little.name);
    if (existing.has(littleKey)) {
      alreadyInDraft += 1;
      continue;
    }
    existing.add(littleKey);

    const emailMatches = little.email ? options.membersByEmail.get(little.email) ?? [] : [];
    const memberId = emailMatches.length === 1 ? emailMatches[0].id : null;
    if (memberId) emailLinked += 1;

    const keys = keysFor(big);
    const forms = Array.from(new Set([keys.full, keys.firstLast, keys.preferredLast].filter((form): form is string => !!form)));
    const nodeIds = new Set(forms.flatMap((form) => (nodesByName.get(form) ?? []).map((node) => node.id)));
    let bigId: string | null = null;
    let notes: string | null = null;
    if (nodeIds.size === 1) {
      bigId = Array.from(nodeIds)[0];
      bigMatched += 1;
    } else {
      bigUnresolved += 1;
      notes = `Mutual Big: ${big.name} (${nodeIds.size === 0 ? 'not on tree' : 'several on tree'})`;
    }
    seeds.push({ little_name: little.name, little_member_id: memberId, big_ace_member_id: bigId, notes });
  }
  return { resolution: { seeds, emailLinked, bigMatched, bigUnresolved }, alreadyInDraft };
}

/**
 * Follow-up rows for the chair, in the shared import-review shape so the
 * existing problem-row CSV export can write them. Names and request text
 * only; no contact fields.
 */
export function followUpReviewRows(check: MutualRequestCheck): ImportReviewRow[] {
  const roleLabel = (role: MutualRole | null) => (role === 'big' ? 'Big' : role === 'little' ? 'Little' : 'Unknown');
  const oneSided = check.oneSided.map((item): ImportReviewRow => ({
    index: item.from.line,
    label: item.from.name,
    category: 'needs_review',
    reason: `Asked for ${item.to.name}, who did not ask for them${item.to.requested.length > 0 ? ` (asked for ${item.to.requested.join(', ')})` : ''}.`,
    raw: { Role: roleLabel(item.from.role), Requested: item.requested, 'Request text': item.from.requestText },
  }));
  const unresolved = check.unresolved.map((item): ImportReviewRow => ({
    index: item.from.line,
    label: item.from.name,
    category: 'unmatched',
    reason: item.reason,
    raw: { Role: roleLabel(item.from.role), Requested: item.requested, 'Request text': item.from.requestText },
  }));
  const conflicts = check.conflicts.map((item): ImportReviewRow => ({
    index: item.person.line,
    label: item.person.name,
    category: 'needs_review',
    reason: item.message,
    raw: {
      Role: roleLabel(item.person.role),
      Requested: item.person.requested.join(', '),
      'Request text': item.person.requestText,
    },
  }));
  return [...oneSided, ...unresolved, ...conflicts].sort((a, b) => a.index - b.index);
}
