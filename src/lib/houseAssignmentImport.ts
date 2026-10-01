// Parses and member-matches a pasted/CSV House sorting sheet. This is the
// parser Admin -> Houses has always used, moved out of the page so the draft
// workflow and its tests can share it. It reads and matches only: nothing here
// writes to the database.
import { HOUSE_LABELS, HouseName, normalizeHouse } from '../constants/houses';
import { HousePageAsset } from '../types';
import {
  cleanNameForImport,
  detectColumn,
  displayNameFromHouseCell,
  nameSimilarity,
  normalizeEmail,
  parseCSV,
} from './memberMatching';

export interface HouseImportMember {
  id: string;
  first_name: string;
  last_name: string;
  college: string | null;
  year: string | null;
  house: string | null;
  email: string | null;
  points: number;
  events_attended: number;
}

export type SheetFormat = 'wide' | 'long';
export type RowStatus = 'match' | 'review' | 'unmatched' | 'invalid';

export interface ParsedHouseRow {
  rowId: string;
  sourceIndex: number;
  name: string;
  email: string;
  /** House text as it appeared in the sheet (normalized when recognizable). */
  house: string | null;
  year: string;
  college: string;
  status: RowStatus;
  score: number;
  method: 'email' | 'name' | 'none';
  matchedMember: HouseImportMember | null;
  selectedMemberId: string;
  note: string;
  houseProfile: HousePageAsset | null;
  /** Ordered House choices, first choice first. Empty when the sheet has none. */
  preferences: string[];
}

export function normalizeHouseLookup(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .replace(/^house\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function profileMapByName(profiles: HousePageAsset[]) {
  const map = new Map<string, HousePageAsset>();
  profiles.forEach((profile) => {
    [
      profile.house,
      profile.house_key,
      profile.display_name,
      HOUSE_LABELS[profile.house as HouseName],
    ].filter(Boolean).forEach((value) => map.set(normalizeHouseLookup(value), profile));
  });
  return map;
}

export function parseTable(raw: string): Record<string, string>[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const firstLine = trimmed.split(/\r?\n/)[0] ?? '';
  if (!firstLine.includes('\t')) return parseCSV(trimmed);

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headers = lines[0].split('\t').map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = line.split('\t');
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] ?? '').trim();
    });
    return row;
  });
}

export function getMemberName(member: Pick<HouseImportMember, 'first_name' | 'last_name'>) {
  return `${member.first_name} ${member.last_name}`.trim();
}

function collegeKey(value: string | null | undefined) {
  const v = (value ?? '').toLowerCase();
  if (/revelle/.test(v)) return 'revelle';
  if (/muir/.test(v)) return 'muir';
  if (/marshall|thurgood/.test(v)) return 'marshall';
  if (/warren/.test(v)) return 'warren';
  if (/eleanor|erc|roosevelt/.test(v)) return 'erc';
  if (/sixth|6th/.test(v)) return 'sixth';
  if (/seventh|7th/.test(v)) return 'seventh';
  if (/eighth|8th/.test(v)) return 'eighth';
  return v.trim();
}

function buildLongName(row: Record<string, string>, fullNameCol: string, firstNameCol: string, lastNameCol: string) {
  if (fullNameCol) return cleanNameForImport(row[fullNameCol] ?? '');
  const first = row[firstNameCol] ?? '';
  const last = row[lastNameCol] ?? '';
  return cleanNameForImport(`${first} ${last}`);
}

const ORDINAL_RANKS: Record<string, number> = {
  first: 1, '1st': 1, '1': 1,
  second: 2, '2nd': 2, '2': 2,
  third: 3, '3rd': 3, '3': 3,
  fourth: 4, '4th': 4, '4': 4,
};

/**
 * Finds "first choice", "second choice", "preference 1", "choice 2", "3rd pref"
 * style headers. Returns them ordered by rank.
 */
export function detectPreferenceColumns(headers: string[]): string[] {
  const ranked: Array<{ header: string; rank: number }> = [];
  headers.forEach((header) => {
    const text = header.toLowerCase().replace(/\s+/g, ' ').trim();
    const ordinalFirst = text.match(/^(?:house\s+)?(first|second|third|fourth|1st|2nd|3rd|4th|1|2|3|4)\s*(?:house\s+)?(?:choice|preference|pref)$/);
    const numberLast = text.match(/^(?:house\s+)?(?:choice|preference|pref)\s*#?\s*(1|2|3|4)$/);
    const rank = ordinalFirst ? ORDINAL_RANKS[ordinalFirst[1]] : numberLast ? Number(numberLast[1]) : null;
    if (rank) ranked.push({ header, rank });
  });
  return ranked.sort((a, b) => a.rank - b.rank).map((item) => item.header);
}

function resolvePreferences(
  csvRow: Record<string, string>,
  preferenceColumns: string[],
  houseProfilesByName: Map<string, HousePageAsset>,
): string[] {
  const choices: string[] = [];
  preferenceColumns.forEach((column) => {
    const raw = (csvRow[column] ?? '').trim();
    if (!raw) return;
    const profile = houseProfilesByName.get(normalizeHouseLookup(raw));
    const choice = profile?.house_key ?? raw;
    if (!choices.some((existing) => normalizeHouseLookup(existing) === normalizeHouseLookup(choice))) {
      choices.push(choice);
    }
  });
  return choices;
}

type UnmatchedRow = Omit<
  ParsedHouseRow,
  'status' | 'score' | 'method' | 'matchedMember' | 'selectedMemberId' | 'note' | 'houseProfile'
>;

function houseNote(row: UnmatchedRow, houseProfile: HousePageAsset | null) {
  if (!row.house) return 'No House assigned yet.';
  if (!houseProfile) return `House "${row.house}" has no profile for this academic year.`;
  return '';
}

function withHouseNote(note: string, extra: string) {
  return extra ? `${note} ${extra}` : note;
}

export function matchRow(
  row: UnmatchedRow,
  members: HouseImportMember[],
  emailMap: Map<string, HouseImportMember>,
  houseProfilesByName: Map<string, HousePageAsset>,
  useContext: boolean,
): ParsedHouseRow {
  const houseProfile = row.house ? houseProfilesByName.get(normalizeHouseLookup(row.house)) ?? null : null;
  const extra = houseNote(row, houseProfile);

  if (!row.name && !row.email) {
    return {
      ...row,
      houseProfile,
      status: 'invalid',
      score: 0,
      method: 'none',
      matchedMember: null,
      selectedMemberId: '',
      note: withHouseNote('Name or email is required.', extra),
    };
  }

  if (row.email) {
    const emailMatch = emailMap.get(row.email);
    if (emailMatch) {
      return {
        ...row,
        houseProfile,
        status: 'match',
        score: 100,
        method: 'email',
        matchedMember: emailMatch,
        selectedMemberId: emailMatch.id,
        note: withHouseNote('Matched by normalized email.', extra),
      };
    }
  }

  let best: HouseImportMember | null = null;
  let bestScore = 0;

  for (const member of members) {
    const memberName = cleanNameForImport(getMemberName(member));
    let score = nameSimilarity(row.name, memberName);

    if (useContext && row.college && member.college && collegeKey(row.college) === collegeKey(member.college)) {
      score += 8;
    }
    if (useContext && row.year && member.year && row.year.toLowerCase() === member.year.toLowerCase()) {
      score += 8;
    }

    score = Math.min(score, 100);
    if (score > bestScore) {
      bestScore = score;
      best = member;
    }
  }

  if (best && bestScore >= 86) {
    return {
      ...row,
      houseProfile,
      status: 'match',
      score: bestScore,
      method: 'name',
      matchedMember: best,
      selectedMemberId: best.id,
      note: withHouseNote('Matched by name.', extra),
    };
  }

  if (best && bestScore >= 70) {
    return {
      ...row,
      houseProfile,
      status: 'review',
      score: bestScore,
      method: 'name',
      matchedMember: best,
      selectedMemberId: best.id,
      note: withHouseNote('Possible name match. Review before publishing.', extra),
    };
  }

  return {
    ...row,
    houseProfile,
    status: 'unmatched',
    score: bestScore,
    method: 'none',
    matchedMember: best,
    selectedMemberId: '',
    note: withHouseNote(best ? 'Best name match was too weak.' : 'No possible match found.', extra),
  };
}

export function parseWideRows(
  raw: string,
  members: HouseImportMember[],
  emailMap: Map<string, HouseImportMember>,
  houseProfilesByName: Map<string, HousePageAsset>,
): ParsedHouseRow[] {
  const table = parseTable(raw);
  if (table.length === 0) return [];

  const headers = Object.keys(table[0]);
  const rows: ParsedHouseRow[] = [];

  table.forEach((csvRow, rowIndex) => {
    headers.forEach((header) => {
      const house = normalizeHouse(header);
      const dynamicHouse = house ?? (houseProfilesByName.has(normalizeHouseLookup(header)) ? header.trim() : null);
      if (!dynamicHouse) return;

      const rawCell = csvRow[header] ?? '';
      const name = displayNameFromHouseCell(rawCell);
      if (!name) return;

      rows.push(matchRow({
        rowId: `${rowIndex}-${header}-${name}`,
        sourceIndex: rowIndex + 1,
        name,
        email: '',
        house: dynamicHouse,
        year: '',
        college: '',
        preferences: [],
      }, members, emailMap, houseProfilesByName, false));
    });
  });

  return rows;
}

export function parseLongRows(
  raw: string,
  members: HouseImportMember[],
  emailMap: Map<string, HouseImportMember>,
  houseProfilesByName: Map<string, HousePageAsset>,
): ParsedHouseRow[] {
  const table = parseTable(raw);
  if (table.length === 0) return [];

  const allHeaders = Object.keys(table[0]);
  // Preference headers such as "First choice house" would otherwise be picked up
  // by the loose name/house column detection below.
  const preferenceColumns = detectPreferenceColumns(allHeaders);
  const headers = allHeaders.filter((header) => !preferenceColumns.includes(header));

  const fullNameCol = detectColumn(headers, ['full name', 'name', 'student name']);
  const firstNameCol = detectColumn(headers, ['first name', 'first', 'given name']);
  const lastNameCol = detectColumn(headers, ['last name', 'last', 'family', 'surname']);
  const emailCol = detectColumn(headers, ['email', 'school email', 'ucsd email']);
  const houseCol = detectColumn(headers, ['house']);
  const yearCol = detectColumn(headers, ['year', 'class standing', 'standing']);
  const collegeCol = detectColumn(headers, ['college', 'ucsd college']);

  return table.map((csvRow, rowIndex) => {
    const name = buildLongName(csvRow, fullNameCol, firstNameCol, lastNameCol);
    const email = normalizeEmail(emailCol ? csvRow[emailCol] : '');
    const rawHouse = houseCol ? (csvRow[houseCol] ?? '').trim() : '';
    const house = normalizeHouse(rawHouse) ?? (rawHouse ? rawHouse : null);
    const year = yearCol ? (csvRow[yearCol] ?? '').trim() : '';
    const college = collegeCol ? (csvRow[collegeCol] ?? '').trim() : '';

    return matchRow({
      rowId: `${rowIndex}-${email || name}`,
      sourceIndex: rowIndex + 1,
      name,
      email,
      house,
      year,
      college,
      preferences: resolvePreferences(csvRow, preferenceColumns, houseProfilesByName),
    }, members, emailMap, houseProfilesByName, true);
  });
}

export function buildEmailMap(members: HouseImportMember[]) {
  const map = new Map<string, HouseImportMember>();
  members.forEach((member) => {
    const email = normalizeEmail(member.email);
    if (email && !map.has(email)) map.set(email, member);
  });
  return map;
}
