export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function isSchoolEmail(value: string | null | undefined): boolean {
  const email = normalizeEmail(value);
  const domain = email.split('@')[1] ?? '';
  return domain === 'ucsd.edu' || domain.endsWith('.ucsd.edu');
}

export function capitalizeName(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeNameForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function displayNameFromHouseCell(value: string): string {
  let next = value.trim();
  if (!next) return '';

  next = next
    .replace(/\s+[-\u2013\u2014]\s+.*$/u, '')
    .replace(/\([^)]*(first|second|third|fourth)[^)]*\)/giu, '')
    .replace(/\(\s*\d{4}-\d{1,2}-\d{1,2}[^)]*\)/gu, '')
    .replace(/\(\s*(mon|tue|wed|thu|fri|sat|sun)[^)]*\)/giu, '')
    .replace(/\(\s*\d{1,2}\/\d{1,2}\/\d{2,4}[^)]*\)/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  next = next.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  return capitalizeName(next);
}

export function cleanNameForImport(value: string): string {
  return capitalizeName(
    value
      .trim()
      .replace(/,/g, ' ')
      .replace(/\b[A-Za-z]\.\s*/g, '')
      .replace(/(\b\w{2,})\s+\b[A-Za-z]\b\s+(\w{2,}\b)/g, '$1 $2')
      .replace(/\s+/g, ' ')
  );
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

export function nameSimilarity(a: string, b: string): number {
  const na = normalizeNameForMatch(a);
  const nb = normalizeNameForMatch(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  return Math.max(0, Math.round((1 - levenshtein(na, nb) / Math.max(na.length, nb.length)) * 100));
}

export function parseCSV(raw: string): Record<string, string>[] {
  const lines = raw.trim().split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = splitCSVRow(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = splitCSVRow(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] ?? '').trim();
    });
    return row;
  });
}

export function splitCSVRow(line: string): string[] {
  const output: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      output.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  output.push(current);
  return output;
}

export function detectColumn(headers: string[], hints: string[]): string {
  const loweredHints = hints.map((hint) => hint.toLowerCase());
  return headers.find((header) => loweredHints.some((hint) => header.toLowerCase().includes(hint))) ?? '';
}

export interface AttendanceImportMember {
  id: string;
  first_name: string;
  last_name: string;
  college: string | null;
  year: string | null;
  email: string | null;
}

export interface AttendanceImportRowInput {
  rowId: string;
  originalIndex: number;
  csvRow: Record<string, string>;
  displayName: string;
  matchName: string;
  csvCollege: string;
  csvYear: string;
  csvEmail: string;
  invalidYear: boolean;
}

export type AttendanceImportStatus = 'match' | 'new' | 'already' | 'review' | 'duplicate';
export type AttendanceMatchMethod = 'email' | 'exact_name' | 'fuzzy_name' | 'new' | 'none';
export type AttendanceMatchReason =
  | 'exact_email_match'
  | 'duplicate_email_conflict'
  | 'email_name_conflict'
  | 'exact_name_match'
  | 'fuzzy_name_match'
  | 'ambiguous_match'
  | 'new_member_created'
  | 'duplicate_row'
  | 'already_imported'
  | 'skipped_unresolved_review';

export interface AttendanceMatchResult extends AttendanceImportRowInput {
  matchedMember: AttendanceImportMember | null;
  status: AttendanceImportStatus;
  score: number;
  nameScore: number;
  collegeMatch: boolean;
  yearMatch: boolean;
  method: AttendanceMatchMethod;
  reason: AttendanceMatchReason;
  note: string;
  candidateMemberIds: string[];
  emailIsSchoolEmail: boolean;
  emailAlreadyUsed: boolean;
  canForceMatch: boolean;
  canMarkNew: boolean;
  duplicateRowOf: string | null;
}

export interface AttendanceMemberLookupMaps {
  byEmail: Map<string, AttendanceImportMember[]>;
  byName: Map<string, AttendanceImportMember[]>;
}

type SeenRow = {
  rowId: string;
  normalizedName: string;
};

const NAME_CONFLICT_THRESHOLD = 50;
const STRONG_OTHER_NAME_THRESHOLD = 90;
const EXACT_NAME_SCORE = 100;
const FUZZY_AUTO_THRESHOLD = 92;
const FUZZY_REVIEW_THRESHOLD = 80;
const FUZZY_MIN_GAP = 8;

export function normalizeCollegeForMatch(value: string | null | undefined): string {
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

export function normalizeYearForMatch(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function getMemberFullName(member: AttendanceImportMember): string {
  return `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim();
}

export function buildMemberLookupMaps(members: AttendanceImportMember[]): AttendanceMemberLookupMaps {
  const byEmail = new Map<string, AttendanceImportMember[]>();
  const byName = new Map<string, AttendanceImportMember[]>();

  for (const member of members) {
    const email = normalizeEmail(member.email);
    if (email) byEmail.set(email, [...(byEmail.get(email) ?? []), member]);

    const name = normalizeNameForMatch(getMemberFullName(member));
    if (name) byName.set(name, [...(byName.get(name) ?? []), member]);
  }

  return { byEmail, byName };
}

function contextMatches(row: AttendanceImportRowInput, member: AttendanceImportMember) {
  const collegeMatch = !!(
    row.csvCollege &&
    member.college &&
    normalizeCollegeForMatch(row.csvCollege) === normalizeCollegeForMatch(member.college)
  );
  const yearMatch = !!(
    row.csvYear &&
    member.year &&
    normalizeYearForMatch(row.csvYear) === normalizeYearForMatch(member.year)
  );

  return { collegeMatch, yearMatch };
}

function contextScore(row: AttendanceImportRowInput, member: AttendanceImportMember): number {
  const { collegeMatch, yearMatch } = contextMatches(row, member);
  return (collegeMatch ? 5 : 0) + (yearMatch ? 5 : 0);
}

function candidateScore(row: AttendanceImportRowInput, member: AttendanceImportMember) {
  const memberName = cleanNameForImport(getMemberFullName(member));
  const nameScoreValue = nameSimilarity(row.matchName, memberName);
  const context = contextMatches(row, member);
  return {
    member,
    score: Math.min(100, nameScoreValue + contextScore(row, member)),
    nameScore: nameScoreValue,
    collegeMatch: context.collegeMatch,
    yearMatch: context.yearMatch,
  };
}

function reviewResult(
  row: AttendanceImportRowInput,
  reason: AttendanceMatchReason,
  note: string,
  candidates: ReturnType<typeof candidateScore>[],
  options: { canForceMatch?: boolean; canMarkNew?: boolean; emailAlreadyUsed?: boolean } = {},
): AttendanceMatchResult {
  const best = candidates[0] ?? null;
  return {
    ...row,
    matchedMember: best?.member ?? null,
    status: 'review',
    score: best?.score ?? 0,
    nameScore: best?.nameScore ?? 0,
    collegeMatch: best?.collegeMatch ?? false,
    yearMatch: best?.yearMatch ?? false,
    method: best ? 'fuzzy_name' : 'none',
    reason,
    note,
    candidateMemberIds: candidates.map((candidate) => candidate.member.id),
    emailIsSchoolEmail: isSchoolEmail(row.csvEmail),
    emailAlreadyUsed: options.emailAlreadyUsed ?? false,
    canForceMatch: options.canForceMatch ?? !!best,
    canMarkNew: options.canMarkNew ?? false,
    duplicateRowOf: null,
  };
}

function duplicateResult(
  row: AttendanceImportRowInput,
  note: string,
  duplicateRowOf: string,
): AttendanceMatchResult {
  return {
    ...row,
    matchedMember: null,
    status: 'duplicate',
    score: 0,
    nameScore: 0,
    collegeMatch: false,
    yearMatch: false,
    method: 'none',
    reason: 'duplicate_row',
    note,
    candidateMemberIds: [],
    emailIsSchoolEmail: isSchoolEmail(row.csvEmail),
    emailAlreadyUsed: false,
    canForceMatch: false,
    canMarkNew: false,
    duplicateRowOf,
  };
}

function safeResult(
  row: AttendanceImportRowInput,
  member: AttendanceImportMember | null,
  status: AttendanceImportStatus,
  method: AttendanceMatchMethod,
  reason: AttendanceMatchReason,
  score: number,
  nameScoreValue: number,
  note: string,
): AttendanceMatchResult {
  const context = member ? contextMatches(row, member) : { collegeMatch: false, yearMatch: false };
  return {
    ...row,
    matchedMember: member,
    status,
    score,
    nameScore: nameScoreValue,
    collegeMatch: context.collegeMatch,
    yearMatch: context.yearMatch,
    method,
    reason,
    note,
    candidateMemberIds: member ? [member.id] : [],
    emailIsSchoolEmail: isSchoolEmail(row.csvEmail),
    emailAlreadyUsed: !!(row.csvEmail && member?.email && normalizeEmail(row.csvEmail) === normalizeEmail(member.email)),
    canForceMatch: false,
    canMarkNew: status === 'match' && !row.csvEmail,
    duplicateRowOf: null,
  };
}

function findBestNameCandidates(row: AttendanceImportRowInput, members: AttendanceImportMember[]) {
  return members
    .map((member) => candidateScore(row, member))
    .filter((candidate) => candidate.nameScore >= FUZZY_REVIEW_THRESHOLD)
    .sort((a, b) => b.score - a.score || b.nameScore - a.nameScore);
}

function hasAmbiguousTopCandidate(candidates: ReturnType<typeof candidateScore>[]): boolean {
  if (candidates.length < 2) return false;
  return candidates[0].score - candidates[1].score < FUZZY_MIN_GAP;
}

function matchSingleRow(
  row: AttendanceImportRowInput,
  members: AttendanceImportMember[],
  maps: AttendanceMemberLookupMaps,
  alreadyImportedMemberIds: Set<string>,
): AttendanceMatchResult {
  const normalizedEmail = normalizeEmail(row.csvEmail);
  const normalizedName = normalizeNameForMatch(row.matchName || row.displayName);

  if (normalizedEmail) {
    const emailMatches = maps.byEmail.get(normalizedEmail) ?? [];
    if (emailMatches.length > 1) {
      const candidates = emailMatches.map((member) => candidateScore(row, member));
      return reviewResult(
        row,
        'duplicate_email_conflict',
        'This email is already attached to multiple members. Resolve the duplicate member records before importing this row.',
        candidates,
        { canForceMatch: false, canMarkNew: false, emailAlreadyUsed: true },
      );
    }

    if (emailMatches.length === 1) {
      const emailMember = emailMatches[0];
      const emailCandidate = candidateScore(row, emailMember);
      const otherNameCandidates = findBestNameCandidates(row, members.filter((member) => member.id !== emailMember.id));
      const strongOtherName = otherNameCandidates[0]?.score >= STRONG_OTHER_NAME_THRESHOLD;
      const clearNameConflict = normalizedName && emailCandidate.nameScore < NAME_CONFLICT_THRESHOLD;

      if (clearNameConflict || strongOtherName) {
        return reviewResult(
          row,
          'email_name_conflict',
          'The email matches an existing member, but the row name conflicts with that member. Review before awarding points.',
          [emailCandidate, ...otherNameCandidates].slice(0, 3),
          { canForceMatch: true, canMarkNew: false, emailAlreadyUsed: true },
        );
      }

      const status: AttendanceImportStatus = alreadyImportedMemberIds.has(emailMember.id) ? 'already' : 'match';
      return safeResult(
        row,
        emailMember,
        status,
        'email',
        status === 'already' ? 'already_imported' : 'exact_email_match',
        100,
        emailCandidate.nameScore,
        status === 'already' ? 'This member already has attendance for this event.' : 'Matched by unique normalized email.',
      );
    }
  }

  if (normalizedName) {
    const exactNameMatches = maps.byName.get(normalizedName) ?? [];
    if (exactNameMatches.length === 1) {
      const member = exactNameMatches[0];
      const status: AttendanceImportStatus = alreadyImportedMemberIds.has(member.id) ? 'already' : 'match';
      return safeResult(
        row,
        member,
        status,
        'exact_name',
        status === 'already' ? 'already_imported' : 'exact_name_match',
        EXACT_NAME_SCORE,
        EXACT_NAME_SCORE,
        status === 'already' ? 'This member already has attendance for this event.' : 'Matched by unique exact normalized name.',
      );
    }

    if (exactNameMatches.length > 1) {
      const candidates = exactNameMatches.map((member) => candidateScore(row, member));
      return reviewResult(
        row,
        'ambiguous_match',
        'Multiple members share this exact normalized name. Review before awarding points.',
        candidates,
        { canForceMatch: true, canMarkNew: false },
      );
    }
  }

  const fuzzyCandidates = findBestNameCandidates(row, members);
  const best = fuzzyCandidates[0];

  if (best) {
    const ambiguous = hasAmbiguousTopCandidate(fuzzyCandidates);
    const hasContextSupport = best.collegeMatch || best.yearMatch;
    if (!ambiguous && best.score >= FUZZY_AUTO_THRESHOLD && hasContextSupport) {
      const status: AttendanceImportStatus = alreadyImportedMemberIds.has(best.member.id) ? 'already' : 'match';
      return safeResult(
        row,
        best.member,
        status,
        'fuzzy_name',
        status === 'already' ? 'already_imported' : 'fuzzy_name_match',
        best.score,
        best.nameScore,
        status === 'already' ? 'This member already has attendance for this event.' : 'Matched by conservative fuzzy name scoring.',
      );
    }

    return reviewResult(
      row,
      'ambiguous_match',
      ambiguous
        ? 'Multiple members are close name matches. Review before awarding points.'
        : 'The best name match is not confident enough to import automatically.',
      fuzzyCandidates.slice(0, 3),
      { canForceMatch: true, canMarkNew: !normalizedEmail },
    );
  }

  return safeResult(
    row,
    null,
    'new',
    'new',
    'new_member_created',
    0,
    0,
    'No safe existing member match found. This row can create a new member.',
  );
}

export function matchAttendanceImportRows(
  rows: AttendanceImportRowInput[],
  members: AttendanceImportMember[],
  alreadyImportedMemberIds: Set<string>,
): AttendanceMatchResult[] {
  const maps = buildMemberLookupMaps(members);
  const seenEmails = new Map<string, SeenRow>();
  const seenNoEmailKeys = new Map<string, SeenRow>();

  return rows.map((row) => {
    const normalizedEmail = normalizeEmail(row.csvEmail);
    const normalizedName = normalizeNameForMatch(row.matchName || row.displayName);

    if (normalizedEmail) {
      const previous = seenEmails.get(normalizedEmail);
      if (previous) {
        if (previous.normalizedName === normalizedName) {
          return duplicateResult(row, 'Duplicate CSV row with the same email and name. Skipping this later row.', previous.rowId);
        }
        return reviewResult(
          row,
          'duplicate_email_conflict',
          'Another CSV row already used this email with a different name. Review before importing.',
          [],
          { canForceMatch: false, canMarkNew: false, emailAlreadyUsed: true },
        );
      }
      seenEmails.set(normalizedEmail, { rowId: row.rowId, normalizedName });
    } else if (normalizedName) {
      const noEmailKey = [
        normalizedName,
        normalizeCollegeForMatch(row.csvCollege),
        normalizeYearForMatch(row.csvYear),
      ].join('|');
      const previous = seenNoEmailKeys.get(noEmailKey);
      if (previous) {
        return duplicateResult(row, 'Duplicate CSV row with the same name, college, and year. Skipping this later row.', previous.rowId);
      }
      seenNoEmailKeys.set(noEmailKey, { rowId: row.rowId, normalizedName });
    }

    return matchSingleRow(row, members, maps, alreadyImportedMemberIds);
  });
}

export function getSafeAttendanceMemberEnrichment(
  row: AttendanceMatchResult,
  members: AttendanceImportMember[],
): Partial<Pick<AttendanceImportMember, 'college' | 'year' | 'email'>> {
  const member = row.matchedMember;
  if (!member || row.status !== 'match') return {};

  const updates: Partial<Pick<AttendanceImportMember, 'college' | 'year' | 'email'>> = {};
  const safeHighConfidenceMatch = row.method === 'email' || row.method === 'exact_name' || (row.method === 'fuzzy_name' && row.score >= FUZZY_AUTO_THRESHOLD);

  if (!member.email && row.csvEmail) {
    const email = normalizeEmail(row.csvEmail);
    const emailUsedByAnotherMember = members.some((candidate) => (
      candidate.id !== member.id && normalizeEmail(candidate.email) === email
    ));
    const canAttachEmail = row.method === 'email' || (row.method === 'exact_name' && !emailUsedByAnotherMember);
    if (canAttachEmail) updates.email = email;
  }

  if (safeHighConfidenceMatch) {
    if (!member.college && row.csvCollege) updates.college = row.csvCollege;
    if (!member.year && row.csvYear && !row.invalidYear) updates.year = row.csvYear;
  }

  return updates;
}
