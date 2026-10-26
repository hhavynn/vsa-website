// From parsed CSV records to normalized attendance rows, before any identity
// matching. URL and local-file imports both come through here.
import { normalizeEmail } from './memberMatching';
import { normalizeYearInput, OFFICIAL_YEARS } from './yearNormalizer';
import { displayName, foldName, PersonName, personNameFromFull, personNameFromParts } from './personName';

export interface AttendanceColumnMapping {
  useFullName: boolean;
  fullName: string;
  firstName: string;
  lastName: string;
  college: string;
  year: string;
  email: string;
  /** A second email question (e.g. Google's collected address plus "UCSD email"). */
  secondaryEmail: string;
}

export const EMPTY_ATTENDANCE_MAPPING: AttendanceColumnMapping = {
  useFullName: false,
  fullName: '',
  firstName: '',
  lastName: '',
  college: '',
  year: '',
  email: '',
  secondaryEmail: '',
};

// Questions that mention a name but are not the attendee's own name. Fragments
// match inside words; the short ones must be whole words, so "Family Name" is
// still a surname while "ACE fam name" is not.
const NOT_ATTENDEE_NAME = [
  'nick', 'preferred', 'parent', 'guardian', 'emergency', 'user', 'file', 'event', 'team', 'house',
  'college', 'school', 'company', 'partner', 'friend', 'refer',
  'instagram', 'discord', 'major', 'pronoun', 'email',
];
const NOT_ATTENDEE_NAME_WORDS = ['pet', 'fam', 'fams', 'big', 'little', 'ace'];

function words(header: string): string[] {
  return foldName(header).split(' ').filter(Boolean);
}

function mentionsAny(header: string, fragments: string[]): boolean {
  const folded = foldName(header);
  return fragments.some((fragment) => folded.includes(fragment));
}

function notAttendeeName(header: string): boolean {
  const w = words(header);
  return mentionsAny(header, NOT_ATTENDEE_NAME) || w.some((word) => NOT_ATTENDEE_NAME_WORDS.includes(word));
}

function scoreFirstName(header: string): number {
  const w = words(header);
  const folded = w.join(' ');
  if (w.includes('last') || notAttendeeName(header)) return 0;
  if (/^(first|given)( name)?$|^firstname$/.test(folded)) return 3;
  if (/\b(first|given) name\b|\bfirstname\b/.test(folded)) return 2;
  return 0;
}

function scoreLastName(header: string): number {
  const w = words(header);
  const folded = w.join(' ');
  if (w.includes('first') || notAttendeeName(header)) return 0;
  if (/^(last|family|sur)( ?name)?$|^lastname$/.test(folded)) return 3;
  if (/\b(last|family) name\b|\bsurname\b|\blastname\b/.test(folded)) return 2;
  return 0;
}

function scoreFullName(header: string): number {
  const w = words(header);
  const folded = w.join(' ');
  if (!w.includes('name') || notAttendeeName(header)) return 0;
  if (/^(full )?name$/.test(folded)) return 4;
  if (/\bfull name\b|\byour name\b|\bstudent name\b|\bname first (and )?last\b/.test(folded)) return 3;
  // "First name" / "Last name" alone belong to the two-column mapping.
  if (scoreFirstName(header) || scoreLastName(header)) return 0;
  return 1;
}

function scoreEmail(header: string): number {
  const folded = words(header).join(' ');
  if (/\be ?mail\b|\bgmail\b/.test(folded)) return /^e ?mail( address)?$/.test(folded) ? 3 : 2;
  return 0;
}

function scoreCollege(header: string): number {
  const folded = words(header).join(' ');
  if (!/\bcollege\b/.test(folded)) return 0;
  return /^(ucsd |residential )?college$/.test(folded) ? 3 : 2;
}

function scoreYear(header: string): number {
  const w = words(header);
  const folded = w.join(' ');
  if (mentionsAny(header, ['graduat', 'birth', 'how many', 'timestamp', 'college'])) return 0;
  if (/^(year|standing|class standing|year in school)$/.test(folded)) return 3;
  if (w.includes('year') || w.includes('standing')) return 2;
  return 0;
}

function best(headers: string[], score: (header: string) => number, taken: Set<string>): string {
  let winner = '';
  let winnerScore = 0;
  for (const header of headers) {
    if (taken.has(header)) continue;
    const value = score(header);
    if (value > winnerScore) {
      winner = header;
      winnerScore = value;
    }
  }
  if (winner) taken.add(winner);
  return winner;
}

/**
 * A starting mapping for common Google Forms / Sheets headers. The admin can
 * change every column before matching; nothing here is final.
 */
export function detectAttendanceColumns(headers: string[]): AttendanceColumnMapping {
  const taken = new Set<string>();
  const email = best(headers, scoreEmail, taken);
  const secondaryEmail = best(headers, scoreEmail, taken);
  const firstName = best(headers, scoreFirstName, taken);
  const lastName = best(headers, scoreLastName, taken);
  const fullName = best(headers, scoreFullName, taken);
  const college = best(headers, scoreCollege, taken);
  const year = best(headers, scoreYear, taken);
  return {
    useFullName: !!fullName && !(firstName && lastName),
    fullName,
    firstName,
    lastName,
    college,
    year,
    email,
    secondaryEmail,
  };
}

/** Why the mapping cannot produce named rows, or null when it can. */
export function attendanceMappingProblem(mapping: AttendanceColumnMapping, headers: readonly string[]): string | null {
  const known = new Set(headers);
  const missing = (column: string) => !!column && !known.has(column);
  if ([mapping.fullName, mapping.firstName, mapping.lastName, mapping.college, mapping.year, mapping.email, mapping.secondaryEmail].some(missing)) {
    return 'A mapped column is not in this file. Choose the columns again.';
  }
  if (mapping.useFullName ? !mapping.fullName : !mapping.firstName && !mapping.lastName) {
    return 'No name column is mapped. Choose a full-name column, or first and last name columns, before matching.';
  }
  return null;
}

export interface AttendanceSourceRow {
  rowId: string;
  /** 0-based data row; spreadsheet row is originalIndex + 2. */
  originalIndex: number;
  csvRow: Record<string, string>;
  /** As written (accents kept), capitalized. */
  displayName: string;
  /** Given / family split for new members. */
  firstName: string;
  lastName: string;
  name: PersonName;
  csvCollege: string;
  /** Official year label when recognized, otherwise the text as written. */
  csvYear: string;
  invalidYear: boolean;
  /** Primary email, normalized; '' when none. */
  csvEmail: string;
  /** Every distinct email on the row, primary first. */
  emails: string[];
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function buildAttendanceRows(
  parsed: readonly Record<string, string>[],
  mapping: AttendanceColumnMapping,
): AttendanceSourceRow[] {
  return parsed.map((row, index) => {
    const cell = (column: string) => (column ? (row[column] ?? '').trim() : '');
    let firstName: string;
    let lastName: string;
    let name: PersonName;
    if (mapping.useFullName) {
      const full = displayName(cell(mapping.fullName).replace(/,/g, ' '));
      const parts = full.split(/\s+/).filter(Boolean);
      firstName = parts[0] ?? '';
      lastName = parts.slice(1).join(' ');
      name = personNameFromFull(full);
    } else {
      firstName = displayName(cell(mapping.firstName));
      lastName = displayName(cell(mapping.lastName));
      name = personNameFromParts(firstName, lastName);
    }
    const display = [firstName, lastName].filter(Boolean).join(' ');
    const rawYear = cell(mapping.year);
    const csvYear = normalizeYearInput(rawYear);
    const emails = Array.from(new Set(
      [cell(mapping.email), cell(mapping.secondaryEmail)].map(normalizeEmail).filter(looksLikeEmail),
    ));

    return {
      rowId: `row-${index}`,
      originalIndex: index,
      csvRow: row,
      displayName: display,
      firstName,
      lastName,
      name,
      csvCollege: cell(mapping.college),
      csvYear,
      invalidYear: csvYear !== '' && !OFFICIAL_YEARS.includes(csvYear),
      csvEmail: emails[0] ?? '',
      emails,
    };
  });
}
