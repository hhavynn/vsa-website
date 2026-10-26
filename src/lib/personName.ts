// Name evidence for identity resolution (attendance import, Merge Suggestions).
//
// Names are evidence, never identity. This module only says how two names
// relate; identityResolution.ts decides what that relation is worth. The
// relations are deliberately coarse and explainable: an admin must be able to
// read "middle name omitted" and agree or disagree.
//
// ACE / Cabinet / photo links use memberLinkMatching.normalizeMemberName, which
// is stricter on purpose (a wrong link shows one person's photo on another).
// House and intern imports keep memberMatching's normalizer. Do not route them
// through here without their own tests.

/**
 * Case, accents and spacing never distinguish two people. "Nguyễn  Văn" and
 * "NGUYEN VAN" fold to the same text; "Đặng" folds to "dang". Apostrophes join
 * ("O'Brien" → "obrien"); other punctuation and hyphens separate words.
 */
export function foldName(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  const folded = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  // Scripts outside Latin fold to nothing above; keep them comparable as typed.
  return folded || raw.toLowerCase().replace(/\s+/g, ' ');
}

export function nameTokens(value: string | null | undefined): string[] {
  const folded = foldName(value);
  return folded ? folded.split(' ') : [];
}

export interface PersonName {
  /** Every folded token, in written order. */
  tokens: string[];
  /** Tokens without single-letter middle initials ("Kevin J. Nguyen" → kevin nguyen). */
  core: string[];
  /** core joined by spaces; equal keys mean the same written name. */
  key: string;
  /** Given-name tokens when the source kept first and last apart. */
  given: string[] | null;
  /** Family-name tokens when the source kept first and last apart. */
  family: string[] | null;
}

function withoutMiddleInitials(tokens: string[]): string[] {
  if (tokens.length <= 2) return tokens;
  return tokens.filter((token, index) => index === 0 || index === tokens.length - 1 || token.length > 1);
}

/** From a single full-name cell. */
export function personNameFromFull(full: string | null | undefined): PersonName {
  const tokens = nameTokens(full);
  const core = withoutMiddleInitials(tokens);
  return { tokens, core, key: core.join(' '), given: null, family: null };
}

/** From separate first and last values (member rows, two-column CSVs). */
export function personNameFromParts(first: string | null | undefined, last: string | null | undefined): PersonName {
  const given = nameTokens(first);
  const family = nameTokens(last);
  const tokens = [...given, ...family];
  const core = withoutMiddleInitials(tokens);
  return { tokens, core, key: core.join(' '), given, family };
}

export type NameRelation =
  /** Same name once case, accents, spacing and middle initials are ignored. */
  | 'exact'
  /** Same first and last name; one side adds middle name(s) the other leaves out. */
  | 'middle_omitted'
  /** Same last name; one first name is the start of the other (Alex / Alexander). */
  | 'first_name_prefix'
  /** Same words in a different order (family name first vs. last). */
  | 'reordered'
  /** Close spelling or partially shared words. A lead for an admin, never proof. */
  | 'similar'
  | 'different';

export interface NameComparison {
  relation: NameRelation;
  /**
   * 0-100 spelling closeness of the two keys, for ordering suggestions only.
   * It is a heuristic, not a probability that two records are one person.
   */
  closeness: number;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = a[i - 1] === b[j - 1]
        ? previous[j - 1]
        : 1 + Math.min(previous[j], current[j - 1], previous[j - 1]);
    }
    previous = current;
  }
  return previous[b.length];
}

export function spellingCloseness(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 100;
  return Math.max(0, Math.round((1 - levenshtein(a, b) / Math.max(a.length, b.length)) * 100));
}

/** True when `shorter` appears in `longer` in order, keeping both ends aligned. */
function isAnchoredSubsequence(shorter: string[], longer: string[]): boolean {
  if (shorter.length < 2 || shorter.length >= longer.length) return false;
  if (shorter[0] !== longer[0] || shorter[shorter.length - 1] !== longer[longer.length - 1]) return false;
  let j = 1;
  for (let i = 1; i < shorter.length - 1; i += 1) {
    while (j < longer.length - 1 && longer[j] !== shorter[i]) j += 1;
    if (j >= longer.length - 1) return false;
    j += 1;
  }
  return true;
}

function sameMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((token, index) => token === sortedB[index]);
}

const SIMILAR_CLOSENESS = 85;
const MIN_PREFIX_LENGTH = 3;

/**
 * How two names relate. Nicknames are not expanded (no "Bill" → "William"
 * table) and sounds are not compared: "An" and "Anh" are different Vietnamese
 * names that only look close.
 */
export function compareNames(a: PersonName, b: PersonName): NameComparison {
  const closeness = spellingCloseness(a.key, b.key);
  if (!a.key || !b.key) return { relation: 'different', closeness: 0 };
  if (a.key === b.key) return { relation: 'exact', closeness: 100 };

  const [shorter, longer] = a.core.length <= b.core.length ? [a.core, b.core] : [b.core, a.core];
  if (isAnchoredSubsequence(shorter, longer)) return { relation: 'middle_omitted', closeness };

  if (sameMultiset(a.core, b.core)) return { relation: 'reordered', closeness };

  const lastA = a.core[a.core.length - 1];
  const lastB = b.core[b.core.length - 1];
  const firstA = a.core[0];
  const firstB = b.core[0];
  if (a.core.length >= 2 && b.core.length >= 2 && lastA === lastB && firstA !== firstB) {
    const [short, long] = firstA.length <= firstB.length ? [firstA, firstB] : [firstB, firstA];
    if (short.length >= MIN_PREFIX_LENGTH && long.startsWith(short)) return { relation: 'first_name_prefix', closeness };
  }

  // Same first and last name with different middle names: possibly a typo,
  // possibly two people. Worth showing, never worth trusting.
  if (a.core.length >= 2 && b.core.length >= 2 && lastA === lastB && firstA === firstB) return { relation: 'similar', closeness };
  if (closeness >= SIMILAR_CLOSENESS) return { relation: 'similar', closeness };
  // A family-name-first form ("Nguyen Van An") against a two-part name ("An
  // Nguyen") shares every word of the shorter name.
  if (shorter.length >= 2 && shorter.every((token) => longer.includes(token))) return { relation: 'similar', closeness };
  return { relation: 'different', closeness };
}

/** Relations strong enough to put a member on an admin's candidate list. */
export function isCandidateRelation(relation: NameRelation): boolean {
  return relation !== 'different';
}

/** Capitalized display form that keeps accents ("nguyễn văn an" → "Nguyễn Văn An"). */
export function displayName(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase())
    .join(' ');
}
