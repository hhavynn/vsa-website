/**
 * Reads the pasted "ACE Fall Application" responses into in-memory profiles
 * the ACE chair can see while sorting, and runs advisory compatibility checks
 * on Big/Little pairs.
 *
 * Privacy: nothing here is persisted. Only whitelisted columns are read; every
 * other column (contact details, birthday, hometown, allergies, sizes, gifts,
 * major, events attended…) is ignored. The email is used only to match a
 * linked member and is never displayed. Checks and suggestions are advice;
 * they never block Lock or Publish.
 */
import type { AceAssignmentDraft } from '../types';
import type { AceNodeRef, BigLoad } from './aceAssignments';
import { dropMiddleInitials, ucsdEmail } from './aceAssignments';
import { parseDelimitedPaste } from './delimitedPaste';
import { normalizeMemberName } from './memberLinkMatching';

export type ApplicantRole = 'big' | 'little';

export interface ProfileAnswer {
  label: string;
  value: string;
}

export interface ApplicationYear {
  text: string;
  /** 1 for "1st", 2 for "2nd Year Transfer"; null when unreadable. */
  value: number | null;
  transfer: boolean;
}

export interface ApplicationProfile {
  id: string;
  role: ApplicantRole;
  /** Preferred first name + last name when given. */
  displayName: string;
  fullName: string;
  /** Normalized names this person may appear under in drafts or on the tree. */
  nameKeys: string[];
  /** Normalized first and preferred names, for do-not-pair matching. */
  firstNames: string[];
  /** Matching only. Never displayed, logged, or saved. */
  email: string | null;

  year: ApplicationYear | null;
  college: string | null;
  pronouns: string | null;
  genderIdentity: string | null;
  activity: string | null;
  scales: {
    introExtro: number | null;
    routine: number | null;
    workEthic: number | null;
    /** 1–5 */
    indoorOutdoor: number | null;
  };
  morningNight: string | null;
  fridayNight: string | null;
  favorites: ProfileAnswer[];
  personality: ProfileAnswer[];
  doNotPair: string | null;

  lookingFor: string | null;
  genderPreference: string | null;
  yearPreference: string | null;
  hours: string | null;
  okWithPartaking: string | null;
  partakingDetails: string | null;
  intendsToPartake: string | null;
  wantedActivity: string | null;
  otherPreferences: string | null;

  /** Bigs only. */
  family: string | null;
  capacity: number | null;
  capacityText: string | null;
  /** Littles only. */
  sibling: string | null;
}

export interface ParsedApplicationProfiles {
  profiles: ApplicationProfile[];
  bigCount: number;
  littleCount: number;
  repeatsReplaced: number;
  /** Rows with no name or no Big/Little answer. */
  skipped: number;
  warnings: string[];
}

// ─── Headers ─────────────────────────────────────────────────────────────────

type SingleField =
  | 'name'
  | 'preferred'
  | 'email'
  | 'role'
  | 'year'
  | 'college'
  | 'pronouns'
  | 'genderIdentity'
  | 'activity'
  | 'introExtro'
  | 'routine'
  | 'workEthic'
  | 'indoorOutdoor'
  | 'morningNight'
  | 'fridayNight'
  | 'doNotPair'
  | 'family'
  | 'lookingFor'
  | 'capacity'
  | 'genderPreference'
  | 'yearPreference'
  | 'hours'
  | 'okWithPartaking'
  | 'partakingDetails'
  | 'intendsToPartake'
  | 'wantedActivity'
  | 'otherPreferences'
  | 'sibling';

type ListField = 'favorites' | 'personality';

/** Specific, anchored patterns on the normalized header (letters and digits only). */
const FIELD_PATTERNS: ReadonlyArray<[RegExp, SingleField]> = [
  [/^namefirst/, 'name'],
  [/^preferredname/, 'preferred'],
  [/^ucsdemail/, 'email'],
  [/applyingtobe.*big.*little/, 'role'],
  [/^year$/, 'year'],
  [/^college$/, 'college'],
  [/^pronouns/, 'pronouns'],
  [/^genderidentity/, 'genderIdentity'],
  [/^howactiveareyouinvsa/, 'activity'],
  [/introvert.*extrovert|extrovert.*introvert/, 'introExtro'],
  [/predictable.*routine|routine.*spontane/, 'routine'],
  [/workethic/, 'workEthic'],
  [/indoors?.*outdoors?person/, 'indoorOutdoor'],
  [/morning.*night.*person/, 'morningNight'],
  [/stay.*home.*go.*out|fridaynight/, 'fridayNight'],
  [/dontwanttobepaired|notwanttobepaired|dontwanttobepared/, 'doNotPair'],
  [/^ifyoucurrentlyhave.*family/, 'family'],
  [/^whatareyoulookingforina/, 'lookingFor'],
  [/^howmanylittles/, 'capacity'],
  [/^genderpreference/, 'genderPreference'],
  [/^areyouokaywithhavinga(little|big).*sameyear/, 'yearPreference'],
  [/^howmanyhours/, 'hours'],
  [/^areyouokaywithyour.*partak/, 'okWithPartaking'],
  [/^doyouintendtopartake/, 'intendsToPartake'],
  [/^howactivedoyouwant/, 'wantedActivity'],
  [/^anypreferencesfor(little|big)/, 'otherPreferences'],
  [/^doyouwanttohaveasib/, 'sibling'],
];

/** Never read, even when a broad pattern below would otherwise match. */
const NEVER_READ =
  /phone|emailaddress|facebook|instagram|picture|photo|dateofbirth|birthday|hometown|allerg|campus|accesstoacar|caraccess|haveacar|pants|shirt|hoodie|size|gift|wish|major|minor|eventsattended|attended/;

const LIST_PATTERNS: ReadonlyArray<[RegExp, ListField]> = [
  [/hobb|music|artist|songs?|favoritetv|tvshow|movie|anime|kdrama/, 'favorites'],
  [/personality|mbti|enneagram|lovelanguage/, 'personality'],
];

interface Column {
  index: number;
  /** Google Sheets added " 2" to make a repeated (Little-section) header unique. */
  suffixed: boolean;
  label: string;
}

function headerParts(header: string): { key: string; suffixed: boolean; label: string } {
  const trimmed = header.replace(/\s+/g, ' ').trim();
  const suffixed = /\s2$/.test(trimmed);
  const label = (suffixed ? trimmed.slice(0, -2) : trimmed).trim();
  return { key: label.toLowerCase().replace(/[^a-z0-9]/g, ''), suffixed, label };
}

interface ColumnMap {
  single: Map<SingleField, Column[]>;
  lists: Map<ListField, Map<string, Column[]>>;
}

function mapColumns(headers: readonly string[]): ColumnMap {
  const single = new Map<SingleField, Column[]>();
  const lists = new Map<ListField, Map<string, Column[]>>();
  const parts = headers.map(headerParts);
  parts.forEach(({ key, suffixed, label }, index) => {
    if (!key) return;
    const column = { index, suffixed, label };
    const field = FIELD_PATTERNS.find(([pattern]) => pattern.test(key))?.[1];
    if (field) {
      single.set(field, [...(single.get(field) ?? []), column]);
      // The free-text follow-up right after "okay with … partaking".
      const next = parts[index + 1];
      if (field === 'okWithPartaking' && next && /elaborat|explain|ifnot|ifno/.test(next.key) && !NEVER_READ.test(next.key)) {
        single.set('partakingDetails', [
          ...(single.get('partakingDetails') ?? []),
          { index: index + 1, suffixed: next.suffixed, label: next.label },
        ]);
      }
      return;
    }
    if (NEVER_READ.test(key)) return;
    const list = LIST_PATTERNS.find(([pattern]) => pattern.test(key))?.[1];
    if (!list) return;
    const byKey = lists.get(list) ?? new Map<string, Column[]>();
    byKey.set(key, [...(byKey.get(key) ?? []), column]);
    lists.set(list, byKey);
  });
  return { single, lists };
}

/** Bigs answer the plain headers, Littles the " 2" ones; fall back to any answered copy. */
function pick(columns: readonly Column[] | undefined, cells: readonly string[], role: ApplicantRole | null): Column | null {
  if (!columns || columns.length === 0) return null;
  const preferSuffixed = role === 'little';
  const ordered = [...columns].sort((a, b) => Number(b.suffixed === preferSuffixed) - Number(a.suffixed === preferSuffixed));
  return ordered.find((column) => squash(cells[column.index])) ?? null;
}

function squash(value: string | undefined): string {
  return (value ?? '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Value parsing ───────────────────────────────────────────────────────────

const WORD_NUMBERS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const ORDINAL_WORDS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6 };

export function parseScale(value: string | null, max: number): number | null {
  const match = value?.match(/\d+(\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return n >= 1 && n <= max ? n : null;
}

export function parseYear(value: string | null): ApplicationYear | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  const digit = lower.match(/\d+/);
  const word = Object.keys(ORDINAL_WORDS).find((w) => new RegExp(`\\b${w}\\b`).test(lower));
  return {
    text: value,
    value: digit ? Number(digit[0]) : word ? ORDINAL_WORDS[word] : null,
    transfer: /transfer/.test(lower),
  };
}

/** "2", "3 but if any of my prefs dont want me then only 2", "two" → the leading number. */
export function parseCapacity(value: string | null): number | null {
  if (!value) return null;
  const match = value.trim().toLowerCase().match(/^(?:about |around |maybe |up to )?(\d+|zero|one|two|three|four|five|six)\b/);
  if (!match) return null;
  return /^\d+$/.test(match[1]) ? Number(match[1]) : WORD_NUMBERS[match[1]];
}

// ─── Names ───────────────────────────────────────────────────────────────────

function nameTokens(value: string): string[] {
  return normalizeMemberName(value)
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/[\s]+/)
    .filter(Boolean);
}

function buildNames(rawName: string, preferred: string) {
  const full = dropMiddleInitials(rawName.replace(/,/g, ' ')).replace(/\s+/g, ' ').trim();
  const parts = full.split(' ').filter(Boolean);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const preferredParts = preferred.split(/\s+/).filter(Boolean);
  const preferredFirst = preferredParts[0] ?? '';

  const keys = new Set<string>();
  const add = (value: string) => {
    const key = normalizeMemberName(value);
    if (key.includes(' ')) keys.add(key);
  };
  add(full);
  add(rawName.replace(/,/g, ' '));
  add(`${first} ${last}`);
  if (preferredFirst) add(`${preferredFirst} ${last}`);
  if (preferredParts.length > 1) add(preferred);

  const displayName = preferredFirst && preferredParts.length === 1 && last ? `${preferredFirst} ${last}` : preferredParts.length > 1 ? preferred : full;
  const firstNames = Array.from(new Set([first, preferredFirst].map((n) => normalizeMemberName(n)).filter((n) => n.length >= 2)));
  return { fullName: full, displayName, nameKeys: Array.from(keys), firstNames };
}

function roleFromAnswer(answer: string): ApplicantRole | null {
  const value = answer.toLowerCase();
  if (/little|\bem\b/.test(value)) return 'little';
  if (/big|anh|chi/.test(value)) return 'big';
  return null;
}

// ─── Parse ───────────────────────────────────────────────────────────────────

/**
 * Parses the pasted ACE application responses. Only whitelisted columns are
 * read. A repeat submission from the same UCSD email keeps the latest.
 */
export function parseApplicationProfiles(text: string): ParsedApplicationProfiles {
  const result: ParsedApplicationProfiles = { profiles: [], bigCount: 0, littleCount: 0, repeatsReplaced: 0, skipped: 0, warnings: [] };
  const records = parseDelimitedPaste(text);
  if (records.length === 0) return result;

  const columns = mapColumns(records[0]);
  if (!columns.single.has('name') || !columns.single.has('role')) {
    result.warnings.push('This does not look like the ACE application responses. Copy the whole sheet, including the header row.');
    return result;
  }

  const parsed: ApplicationProfile[] = [];
  records.slice(1).forEach((cells, offset) => {
    const plain = (field: SingleField) => {
      const column = pick(columns.single.get(field), cells, null);
      return column ? squash(cells[column.index]) : '';
    };
    const rawName = plain('name').replace(/\s+/g, ' ');
    const role = roleFromAnswer(plain('role'));
    if (!rawName || !role) {
      result.skipped += 1;
      return;
    }
    const get = (field: SingleField): string | null => {
      const column = pick(columns.single.get(field), cells, role);
      return column ? squash(cells[column.index]) || null : null;
    };
    const list = (field: ListField): ProfileAnswer[] =>
      Array.from(columns.lists.get(field)?.values() ?? []).flatMap((group) => {
        const column = pick(group, cells, role);
        return column ? [{ label: column.label, value: squash(cells[column.index]) }] : [];
      });

    const names = buildNames(rawName, (get('preferred') ?? '').replace(/\s+/g, ' '));
    const email = get('email');
    const capacityText = role === 'big' ? get('capacity') : null;
    parsed.push({
      id: `application-${offset + 2}`,
      role,
      ...names,
      email: email ? ucsdEmail(email.replace(/\s+/g, '')).toLowerCase() : null,
      year: parseYear(get('year')),
      college: get('college'),
      pronouns: get('pronouns'),
      genderIdentity: get('genderIdentity'),
      activity: get('activity'),
      scales: {
        introExtro: parseScale(get('introExtro'), 10),
        routine: parseScale(get('routine'), 10),
        workEthic: parseScale(get('workEthic'), 10),
        indoorOutdoor: parseScale(get('indoorOutdoor'), 5),
      },
      morningNight: get('morningNight'),
      fridayNight: get('fridayNight'),
      favorites: list('favorites'),
      personality: list('personality'),
      doNotPair: get('doNotPair'),
      lookingFor: get('lookingFor'),
      genderPreference: get('genderPreference'),
      yearPreference: get('yearPreference'),
      hours: get('hours'),
      okWithPartaking: get('okWithPartaking'),
      partakingDetails: get('partakingDetails'),
      intendsToPartake: get('intendsToPartake'),
      wantedActivity: get('wantedActivity'),
      otherPreferences: get('otherPreferences'),
      family: role === 'big' ? get('family') : null,
      capacity: parseCapacity(capacityText),
      capacityText,
      sibling: role === 'little' ? get('sibling') : null,
    });
  });

  // Responses are in submission order, so the last one per email is the latest.
  const seen = new Set<string>();
  for (let i = parsed.length - 1; i >= 0; i -= 1) {
    const { email } = parsed[i];
    if (email && seen.has(email)) {
      result.repeatsReplaced += 1;
      continue;
    }
    if (email) seen.add(email);
    result.profiles.unshift(parsed[i]);
  }
  result.bigCount = result.profiles.filter((p) => p.role === 'big').length;
  result.littleCount = result.profiles.length - result.bigCount;
  if (result.skipped > 0) {
    result.warnings.push(`${result.skipped} ${result.skipped === 1 ? 'row has' : 'rows have'} no name or no Big/Little answer and ${result.skipped === 1 ? 'was' : 'were'} skipped.`);
  }
  return result;
}

// ─── Matching ────────────────────────────────────────────────────────────────

function uniqueMatches<T>(
  targets: readonly T[],
  profiles: readonly ApplicationProfile[],
  keysOf: (target: T) => string[],
  taken: Set<string>,
  claimedProfiles: Set<string>,
  idOf: (target: T) => string,
  out: Map<string, ApplicationProfile>,
) {
  const byKey = new Map<string, ApplicationProfile[]>();
  for (const profile of profiles) {
    if (claimedProfiles.has(profile.id)) continue;
    for (const key of profile.nameKeys) byKey.set(key, [...(byKey.get(key) ?? []), profile]);
  }
  const wanted = new Map<string, number>();
  const proposals: Array<[string, ApplicationProfile]> = [];
  for (const target of targets) {
    const id = idOf(target);
    if (taken.has(id)) continue;
    const candidates = new Set(keysOf(target).flatMap((key) => byKey.get(key) ?? []));
    if (candidates.size !== 1) continue;
    const [profile] = Array.from(candidates);
    proposals.push([id, profile]);
    wanted.set(profile.id, (wanted.get(profile.id) ?? 0) + 1);
  }
  for (const [id, profile] of proposals) {
    if ((wanted.get(profile.id) ?? 0) !== 1) continue;
    out.set(id, profile);
    taken.add(id);
    claimedProfiles.add(profile.id);
  }
}

/**
 * Attaches Little profiles to draft rows: first by the linked member's email,
 * then by normalized name (which includes preferred + last name). Only
 * one-to-one matches attach; anything ambiguous is left for the chair.
 */
export function matchProfilesToDrafts(
  profiles: readonly ApplicationProfile[],
  drafts: readonly AceAssignmentDraft[],
  memberIdsByEmail: ReadonlyMap<string, readonly string[]> = new Map(),
): Map<string, ApplicationProfile> {
  const littles = profiles.filter((p) => p.role === 'little');
  const out = new Map<string, ApplicationProfile>();
  const taken = new Set<string>();
  const claimed = new Set<string>();

  const draftsByMember = new Map<string, AceAssignmentDraft[]>();
  for (const draft of drafts) {
    if (draft.little_member_id) draftsByMember.set(draft.little_member_id, [...(draftsByMember.get(draft.little_member_id) ?? []), draft]);
  }
  for (const profile of littles) {
    const memberIds = profile.email ? memberIdsByEmail.get(profile.email) ?? [] : [];
    if (memberIds.length !== 1) continue;
    const matches = draftsByMember.get(memberIds[0]) ?? [];
    if (matches.length !== 1 || taken.has(matches[0].id)) continue;
    out.set(matches[0].id, profile);
    taken.add(matches[0].id);
    claimed.add(profile.id);
  }

  uniqueMatches(drafts, littles, (d) => [normalizeMemberName(d.little_name)], taken, claimed, (d) => d.id, out);
  return out;
}

/** Attaches Big profiles to ACE tree nodes by normalized name; one-to-one only. */
export function matchProfilesToNodes(
  profiles: readonly ApplicationProfile[],
  nodes: readonly AceNodeRef[],
): Map<string, ApplicationProfile> {
  const out = new Map<string, ApplicationProfile>();
  uniqueMatches(nodes, profiles.filter((p) => p.role === 'big'), (n) => [normalizeMemberName(n.name)], new Set(), new Set(), (n) => n.id, out);
  return out;
}

export function unmatchedProfiles(
  profiles: readonly ApplicationProfile[],
  ...matches: ReadonlyArray<ReadonlyMap<string, ApplicationProfile>>
): ApplicationProfile[] {
  const used = new Set(matches.flatMap((map) => Array.from(map.values(), (p) => p.id)));
  return profiles.filter((profile) => !used.has(profile.id));
}

// ─── Answer classification ───────────────────────────────────────────────────

type Gender = 'male' | 'female' | 'nonbinary';

const GENDER_WORDS: ReadonlyArray<[RegExp, Gender]> = [
  [/\b(female|woman|women|girls?|feminine|fem)\b/, 'female'],
  [/\b(male|man|men|boys?|guys?|masculine|masc)\b/, 'male'],
  [/\b(non ?-?binary|nb|enby|genderqueer|genderfluid)\b/, 'nonbinary'],
];

function gendersIn(value: string): Set<Gender> {
  const lower = value.toLowerCase();
  return new Set(GENDER_WORDS.filter(([pattern]) => pattern.test(lower)).map(([, gender]) => gender));
}

export function genderOf(identity: string | null): Gender | null {
  if (!identity) return null;
  const found = gendersIn(identity);
  return found.size === 1 ? Array.from(found)[0] : null;
}

/** null means no preference (or one that can't be read). */
export function genderPreferenceOf(answer: string | null, ownIdentity: string | null): Set<Gender> | null {
  if (!answer) return null;
  const lower = answer.toLowerCase();
  if (/no pref|doesn'?t matter|does not matter|don'?t care|\bidc\b|\bany\b|either|\bnone\b|\bn\/?a\b|^no\b|open/.test(lower)) return null;
  if (/same/.test(lower)) {
    const own = genderOf(ownIdentity);
    return own ? new Set([own]) : null;
  }
  const found = gendersIn(lower);
  return found.size > 0 ? found : null;
}

export type YesNo = 'yes' | 'no' | 'maybe';

export function yesNoOf(answer: string | null): YesNo | null {
  if (!answer) return null;
  const lower = answer.toLowerCase().trim();
  if (/\b(don'?t|do not) mind\b/.test(lower)) return 'yes';
  if (/^(maybe|not sure|unsure|idk|it depends|depends|possibly|sometimes|occasionally|rarely|socially)\b/.test(lower)) return 'maybe';
  if (/^(no|nope|nah|never|not|i'?m not|i am not|i do not|i don'?t|i wouldn'?t)\b/.test(lower)) return 'no';
  if (/^(yes|yeah|yep|ya|sure|ok|okay|of course|definitely|i'?m (ok|okay|fine)|i am (ok|okay|fine)|i do|i will)\b/.test(lower)) return 'yes';
  if (/maybe|sometimes|occasionally|depends|rarely|socially|possibly|not sure|idk/.test(lower)) return 'maybe';
  return null;
}

/**
 * "Are you okay with a Little the same year as you or older?" (Bigs) and "…a
 * Big the same year or younger than you?" (Littles).
 * any: fine either way · same: same year is fine, the other direction is not ·
 * strict: the Big must be older.
 */
export type YearPreference = 'any' | 'same' | 'strict';

export function yearPreferenceOf(answer: string | null): YearPreference | null {
  if (!answer) return null;
  const lower = answer.toLowerCase();
  if (/same year/.test(lower) && /(only|\bnot\b|n't|\bno\b)[^.]*\b(older|younger)\b|\bonly\b/.test(lower)) return 'same';
  if (/^(yes|yeah|yep|sure|ok|okay|i'?m (ok|okay|fine)|i am (ok|okay|fine)|i don'?t mind|doesn'?t matter|no pref)/.test(lower)) return 'any';
  if (/^(no|nope|nah|not)\b/.test(lower)) return 'strict';
  return null;
}

/** A free-text "don't pair me with" answer that names nobody. */
const NONE_WORDS = new Set(
  'n a na no nope nah none nobody noone one not really that i know of at all the moment thanks thank you dont think so idk nothing yet comes to mind im good lol haha currently anyone as far am aware there is isnt'.split(' '),
);

export function isNoneAnswer(answer: string | null): boolean {
  const tokens = (answer ?? '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  return tokens.every((token) => NONE_WORDS.has(token));
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** First names that are also everyday words ("an", "my") only count as part of a full name. */
const COMMON_WORDS = new Set('a an and as at be but do he hi i in is it me my no not of oh ok on or she so the to us we yes'.split(' '));

export interface PersonRef {
  /** Normalized full names. */
  nameKeys: readonly string[];
  /** Normalized first names. */
  firstNames: readonly string[];
}

export function personRefFromName(name: string): PersonRef {
  const tokens = nameTokens(name);
  return { nameKeys: tokens.length > 1 ? [tokens.join(' ')] : [], firstNames: tokens[0] && tokens[0].length >= 2 ? [tokens[0]] : [] };
}

/** 'full' when the answer names them; 'first' when only a first name (or a one-letter typo of it) appears. */
export function namesPerson(answer: string | null, person: PersonRef): 'full' | 'first' | null {
  if (!answer || isNoneAnswer(answer)) return null;
  const tokens = nameTokens(answer);
  const text = ` ${tokens.join(' ')} `;
  if (person.nameKeys.some((key) => text.includes(` ${key} `))) return 'full';
  const hit = person.firstNames.some((first) => !COMMON_WORDS.has(first) && tokens.some((token) => token === first || (first.length >= 5 && editDistanceAtMostOne(token, first))));
  return hit ? 'first' : null;
}

// ─── Advisory pair checks ────────────────────────────────────────────────────

export type PairWarningCode = 'do_not_pair' | 'gender' | 'year' | 'substance' | 'capacity';

export interface PairWarning {
  code: PairWarningCode;
  message: string;
}

export interface PairSide {
  profile: ApplicationProfile | null;
  /** The draft or tree name, used when there is no profile. */
  name: string;
}

function refOf(side: PairSide): PersonRef {
  return side.profile ?? personRefFromName(side.name);
}

function label(side: PairSide): string {
  return side.profile?.displayName ?? side.name;
}

const GENDER_LABEL: Record<Gender, string> = { male: 'male', female: 'female', nonbinary: 'nonbinary' };

function listGenders(set: Set<Gender>): string {
  return Array.from(set, (g) => GENDER_LABEL[g]).join(' or ');
}

/** Number of Littles this Big picks up in this cycle, against what they said they'd take. */
export function capacityWarning(big: PairSide, load: BigLoad | null): PairWarning | null {
  const capacity = big.profile?.capacity;
  if (capacity == null || !load || load.incoming <= capacity) return null;
  return {
    code: 'capacity',
    message: `${label(big)} has ${load.incoming} Littles in this draft but planned on ${capacity} (“${big.profile?.capacityText}”).`,
  };
}

/**
 * Advisory checks for one Big/Little pair, with plain-English reasons. These
 * never block Lock or Publish; they only point the chair at answers to re-read.
 */
export function checkPair(big: PairSide, little: PairSide, load: BigLoad | null = null): PairWarning[] {
  const warnings: PairWarning[] = [];
  const b = big.profile;
  const l = little.profile;

  for (const [from, to] of [
    [big, little],
    [little, big],
  ] as const) {
    const answer = from.profile?.doNotPair ?? null;
    const hit = namesPerson(answer, refOf(to));
    if (hit) {
      warnings.push({
        code: 'do_not_pair',
        message:
          hit === 'full'
            ? `${label(from)} asked not to be paired with ${label(to)}: “${answer}”.`
            : `${label(from)}'s do-not-pair answer mentions ${label(to)}'s first name: “${answer}”. Check whether it means them.`,
      });
    }
  }

  if (b && l) {
    const bigWants = genderPreferenceOf(b.genderPreference, b.genderIdentity);
    const littleGender = genderOf(l.genderIdentity);
    if (bigWants && littleGender && !bigWants.has(littleGender)) {
      warnings.push({
        code: 'gender',
        message: `${b.displayName} prefers a ${listGenders(bigWants)} Little (“${b.genderPreference}”), but ${l.displayName}'s gender identity is “${l.genderIdentity}”.`,
      });
    }
    const littleWants = genderPreferenceOf(l.genderPreference, l.genderIdentity);
    const bigGender = genderOf(b.genderIdentity);
    if (littleWants && bigGender && !littleWants.has(bigGender)) {
      warnings.push({
        code: 'gender',
        message: `${l.displayName} prefers a ${listGenders(littleWants)} Big (“${l.genderPreference}”), but ${b.displayName}'s gender identity is “${b.genderIdentity}”.`,
      });
    }

    const bigYear = b.year?.value ?? null;
    const littleYear = l.year?.value ?? null;
    if (bigYear != null && littleYear != null) {
      const bigPref = yearPreferenceOf(b.yearPreference);
      if ((bigPref === 'strict' && littleYear >= bigYear) || (bigPref === 'same' && littleYear > bigYear)) {
        warnings.push({
          code: 'year',
          message: `${b.displayName} (${b.year?.text}) wants a younger Little (“${b.yearPreference}”), but ${l.displayName} is ${l.year?.text}.`,
        });
      }
      const littlePref = yearPreferenceOf(l.yearPreference);
      if ((littlePref === 'strict' && bigYear <= littleYear) || (littlePref === 'same' && bigYear < littleYear)) {
        warnings.push({
          code: 'year',
          message: `${l.displayName} (${l.year?.text}) does not want a younger Big (“${l.yearPreference}”), but ${b.displayName} is ${b.year?.text}.`,
        });
      }
    }

    for (const [okSide, doer, otherRole] of [
      [b, l, 'Little'],
      [l, b, 'Big'],
    ] as const) {
      const intends = yesNoOf(doer.intendsToPartake);
      if (yesNoOf(okSide.okWithPartaking) === 'no' && (intends === 'yes' || intends === 'maybe')) {
        warnings.push({
          code: 'substance',
          message: `${okSide.displayName} is not okay with their ${otherRole} partaking (“${okSide.okWithPartaking}”), but ${doer.displayName} ${intends === 'yes' ? 'intends to' : 'might'} (“${doer.intendsToPartake}”).`,
        });
      }
    }
  }

  const capacity = capacityWarning(big, load);
  if (capacity) warnings.push(capacity);
  return warnings;
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

type Activity = number | 'any';

/** "Very active" → 1, "Somewhat" → 0.6, "Not very" → 0.25, "4" on 1–5 → 0.75. */
export function activityLevel(answer: string | null): Activity | null {
  if (!answer) return null;
  const lower = answer.toLowerCase();
  if (/no pref|doesn'?t matter|don'?t care|\bidc\b|\bany\b|whatever|up to them/.test(lower)) return 'any';
  const n = lower.match(/\d+/);
  if (n) {
    const value = Number(n[0]);
    if (value >= 1 && value <= 5) return (value - 1) / 4;
    if (value >= 1 && value <= 10) return (value - 1) / 9;
  }
  if (/not very|not really|not active|a little|slightly|rarely|barely|inactive/.test(lower)) return 0.25;
  if (/somewhat|moderate|fairly|kind of|kinda|medium|average|decent|semi|in between|balanced/.test(lower)) return 0.6;
  if (/very|extremely|super|really|highly|active/.test(lower)) return 1;
  return null;
}

type Leaning = 'a' | 'b' | 'both';

const HOME = /home|stay/;
const OUT = /go(ing)? out|\bout\b/;

function leaning(answer: string | null, a: RegExp, b: RegExp): Leaning | null {
  if (!answer) return null;
  const lower = answer.toLowerCase();
  const isA = a.test(lower);
  const isB = b.test(lower);
  if ((isA && isB) || /both|either|depends|in between|mix/.test(lower)) return 'both';
  if (isA) return 'a';
  if (isB) return 'b';
  return null;
}

export interface BigCandidate {
  nodeId: string;
  name: string;
  profile: ApplicationProfile;
  load: BigLoad;
}

export interface BigSuggestion {
  nodeId: string;
  name: string;
  /** 0–100, higher is a closer fit. A suggestion only. */
  score: number;
  reasons: string[];
}

interface Component {
  value: number;
  reason: string | null;
}

function scaleComponent(name: string, a: number | null, b: number | null, span: number): Component | null {
  if (a == null || b == null) return null;
  const value = 1 - Math.abs(a - b) / span;
  return { value, reason: value >= 0.75 ? `Similar ${name} (${a} and ${b})` : null };
}

function leaningComponent(text: string, a: Leaning | null, b: Leaning | null): Component | null {
  if (!a || !b) return null;
  if (a === b) return { value: 1, reason: text };
  return { value: a === 'both' || b === 'both' ? 0.5 : 0, reason: null };
}

function activityComponent(reason: string, wanted: Activity | null, actual: Activity | null): Component | null {
  if (wanted == null) return null;
  if (wanted === 'any') return { value: 1, reason: null };
  if (actual == null || actual === 'any') return null;
  const value = 1 - Math.abs(wanted - actual);
  return { value, reason: value >= 0.75 ? reason : null };
}

/**
 * Ranks Bigs for an unassigned Little. Explainable on purpose: the average of
 * how close their scale answers are, whether their routines line up, and
 * whether each side's wished-for VSA activity matches the other's. Bigs with
 * any advisory conflict, or already at their planned number of Littles, are
 * left out.
 */
export function suggestBigs(little: PairSide & { profile: ApplicationProfile }, bigs: readonly BigCandidate[], limit = 3): BigSuggestion[] {
  const l = little.profile;
  const suggestions: BigSuggestion[] = [];
  for (const candidate of bigs) {
    const b = candidate.profile;
    if (b.capacity != null && candidate.load.incoming >= b.capacity) continue;
    if (checkPair({ profile: b, name: candidate.name }, little).length > 0) continue;

    const components = [
      scaleComponent('introvert/extrovert', l.scales.introExtro, b.scales.introExtro, 9),
      scaleComponent('routine vs. spontaneity', l.scales.routine, b.scales.routine, 9),
      scaleComponent('work ethic', l.scales.workEthic, b.scales.workEthic, 9),
      scaleComponent('indoor/outdoor', l.scales.indoorOutdoor, b.scales.indoorOutdoor, 4),
      leaningComponent('Same morning/night answer', leaning(l.morningNight, /morning/, /night/), leaning(b.morningNight, /morning/, /night/)),
      leaningComponent('Same Friday-night answer', leaning(l.fridayNight, HOME, OUT), leaning(b.fridayNight, HOME, OUT)),
      activityComponent('Big is as active as the Little wants', activityLevel(l.wantedActivity), activityLevel(b.activity)),
      activityComponent('Little is as active as the Big wants', activityLevel(b.wantedActivity), activityLevel(l.activity)),
      // Conflicting preferences were excluded above, so a stated, checkable one is met.
      genderPreferenceOf(l.genderPreference, l.genderIdentity) && genderOf(b.genderIdentity) ? { value: 1, reason: 'Fits the Little’s gender preference' } : null,
      genderPreferenceOf(b.genderPreference, b.genderIdentity) && genderOf(l.genderIdentity) ? { value: 1, reason: 'Fits the Big’s gender preference' } : null,
    ].filter((c): c is Component => c !== null);
    if (components.length === 0) continue;

    const score = Math.round((components.reduce((sum, c) => sum + c.value, 0) / components.length) * 100);
    const reasons = components
      .filter((c) => c.reason)
      .sort((x, y) => y.value - x.value)
      .slice(0, 3)
      .map((c) => c.reason as string);
    suggestions.push({ nodeId: candidate.nodeId, name: candidate.name, score, reasons });
  }
  return suggestions.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit);
}
