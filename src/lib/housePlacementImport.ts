// Protected domain — House membership. Strict parser for a Google Forms House
// application export, feeding timestamp-priority placement (housePlacement.ts).
// Unlike the legacy long-sheet importer it never repairs a ranking: repeated,
// missing, unknown or multi-select choices are reported so an admin fixes them.
// Only name, email (transient: dedupe + member matching, never persisted),
// submission time, ranked choices and the sheet row are read; every other form
// answer is ignored. Pure: nothing here reads or writes the database.
import { parseCsvTable } from './csvParse';
import { normalizeHouseLookup } from './houseAssignmentImport';
import type { HouseImportMember } from './houseAssignmentImport';
import { normalizeEmail } from './memberMatching';
import { buildMemberNameIndex, findExactMemberMatch, normalizeMemberName, toMemberOption } from './memberLinkMatching';
import type { MemberNameIndex } from './memberLinkMatching';
import { PlacementApplicant, PlacementHouse, comparePriority } from './housePlacement';

/** The Google Sheet behind the House form records wall-clock time in this zone. */
export const FORM_TIME_ZONE = 'America/Los_Angeles';

export interface PlacementProfile {
  id: string;
  house_key: string;
  display_name: string;
  is_active: boolean;
  display_order?: number | null;
}

// ─── Columns ─────────────────────────────────────────────────────────────────

export type PlacementColumnRole = 'timestamp' | 'name' | 'email';

export interface PlacementColumns {
  timestamp: string | null;
  name: string | null;
  email: string | null;
  /** Rank columns, first choice first. */
  ranks: string[];
}

export type ColumnOverrides = Partial<Record<PlacementColumnRole, string | null>> & { ranks?: string[] };

export interface ColumnIssue {
  code: 'missing_column' | 'ambiguous_column' | 'duplicate_rank' | 'rank_gap' | 'duplicate_header' | 'unknown_override';
  severity: 'error' | 'warning';
  message: string;
}

export interface ColumnDetection {
  columns: PlacementColumns;
  /** Every header that looked like each role, so the admin can choose. */
  candidates: Record<PlacementColumnRole, string[]>;
  issues: ColumnIssue[];
}

function headerKey(header: string) {
  return header.toLowerCase().replace(/[[\]_:?*#.]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** "Name (First, Middle Initial, Last)" → "name". */
function headerBase(header: string) {
  return headerKey(header).replace(/\s*\([^()]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

const ROLE_HEADERS: Record<PlacementColumnRole, string[]> = {
  timestamp: ['timestamp', 'submitted at', 'submission time', 'submitted', 'time submitted'],
  name: ['name', 'full name', 'your name', 'student name', 'applicant name'],
  email: ['email', 'email address', 'ucsd email', 'school email', 'e-mail', 'e-mail address'],
};

const ORDINALS: Record<string, number> = {
  first: 1, '1st': 1, '1': 1,
  second: 2, '2nd': 2, '2': 2,
  third: 3, '3rd': 3, '3': 3,
  // "Forth" is how the 2026 form spells it.
  fourth: 4, forth: 4, '4th': 4, '4': 4,
  fifth: 5, '5th': 5, '5': 5,
  sixth: 6, '6th': 6, '6': 6,
};
const ORD = '(first|second|third|fourth|forth|fifth|sixth|1st|2nd|3rd|4th|5th|6th|[1-6])';
const WORD = '(?:choice|preference|pref)';
const RANK_PATTERNS = [
  // "House Rank [First Choice ]", "rank first choice", "house ranking 1"
  new RegExp(`^(?:house )?(?:rank|ranking) ${ORD}(?: ${WORD})?$`),
  // "First choice", "1st choice house", "first house choice"
  new RegExp(`^${ORD} (?:house )?${WORD}(?: house)?$`),
  // "House choice 1", "preference 2"
  new RegExp(`^(?:house )?${WORD} ?${ORD}$`),
];

export function rankOfHeader(header: string): number | null {
  const key = headerKey(header);
  for (const pattern of RANK_PATTERNS) {
    const match = key.match(pattern);
    if (match) return ORDINALS[match[1]] ?? null;
  }
  return null;
}

export function detectPlacementColumns(headers: string[], overrides: ColumnOverrides = {}): ColumnDetection {
  const issues: ColumnIssue[] = [];
  const candidates = {} as Record<PlacementColumnRole, string[]>;
  const columns: PlacementColumns = { timestamp: null, name: null, email: null, ranks: [] };
  const flagged = new Set<PlacementColumnRole | 'ranks'>();

  (Object.keys(ROLE_HEADERS) as PlacementColumnRole[]).forEach((role) => {
    candidates[role] = headers.filter((header) => ROLE_HEADERS[role].includes(headerBase(header)));
    const override = overrides[role];
    if (override !== undefined) {
      if (override && !headers.includes(override)) {
        flagged.add(role);
        issues.push({ code: 'unknown_override', severity: 'error', message: `Column "${override}" is not in this file.` });
      } else {
        columns[role] = override;
      }
      return;
    }
    if (candidates[role].length === 1) {
      columns[role] = candidates[role][0];
    } else if (candidates[role].length > 1) {
      flagged.add(role);
      issues.push({
        code: 'ambiguous_column',
        severity: 'error',
        message: `More than one column could be the ${role} (${candidates[role].map((header) => `"${header}"`).join(', ')}). Choose one.`,
      });
    }
  });

  if (overrides.ranks) {
    const unknown = overrides.ranks.filter((header) => !headers.includes(header));
    if (unknown.length > 0) {
      flagged.add('ranks');
      issues.push({ code: 'unknown_override', severity: 'error', message: `Rank column${unknown.length === 1 ? '' : 's'} not in this file: ${unknown.join(', ')}.` });
    } else {
      columns.ranks = overrides.ranks;
    }
  } else {
    const byRank = new Map<number, string[]>();
    headers.forEach((header) => {
      const rank = rankOfHeader(header);
      if (rank) byRank.set(rank, [...(byRank.get(rank) ?? []), header]);
    });
    const ranks = Array.from(byRank.keys()).sort((a, b) => a - b);
    ranks.forEach((rank, index) => {
      const list = byRank.get(rank) as string[];
      if (list.length > 1) {
        flagged.add('ranks');
        issues.push({ code: 'duplicate_rank', severity: 'error', message: `More than one column is the ${rank === 1 ? 'first' : `#${rank}`} choice (${list.map((header) => `"${header}"`).join(', ')}).` });
      }
      if (rank !== index + 1) {
        flagged.add('ranks');
        issues.push({ code: 'rank_gap', severity: 'error', message: `Rank columns skip a choice: found choice #${rank} without choice #${index + 1}.` });
      }
    });
    if (!flagged.has('ranks')) {
      columns.ranks = ranks.map((rank) => (byRank.get(rank) as string[])[0]);
    }
  }

  if (!columns.timestamp && !flagged.has('timestamp')) {
    issues.push({ code: 'missing_column', severity: 'error', message: 'No Timestamp column was found. Export the Form responses sheet, which starts with a Timestamp column.' });
  }
  if (!columns.name && !flagged.has('name')) {
    issues.push({ code: 'missing_column', severity: 'error', message: 'No Name column was found.' });
  }
  if (!columns.email && !flagged.has('email')) {
    issues.push({ code: 'missing_column', severity: 'warning', message: 'No Email column was found. Repeat submissions cannot be detected, so every applicant needs an identity check.' });
  }
  if (columns.ranks.length === 0 && !flagged.has('ranks')) {
    issues.push({ code: 'missing_column', severity: 'error', message: 'No House ranking columns were found (e.g. "House Rank [First Choice]").' });
  }
  return { columns, candidates, issues };
}

// ─── Timestamps ──────────────────────────────────────────────────────────────

export type ParsedTimestamp =
  | { kind: 'missing' }
  | { kind: 'invalid'; reason: string }
  | {
      kind: 'ok';
      ms: number;
      /** UTC ISO instant, as stored in submission_timestamp. */
      iso: string;
      /** Wall-clock time in FORM_TIME_ZONE, "YYYY-MM-DD HH:MM:SS". */
      local: string;
      /** The wall-clock time happened twice (daylight-saving rollback); `ms`/`iso` are the first occurrence. */
      ambiguous: boolean;
      /** The second occurrence when ambiguous, else null. */
      laterMs: number | null;
    };

type WallClock = [number, number, number, number, number, number];

let zoneFormatter: Intl.DateTimeFormat | null = null;
function wallClockAt(ms: number): WallClock {
  zoneFormatter ??= new Intl.DateTimeFormat('en-US', {
    timeZone: FORM_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  const parts = zoneFormatter.formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? NaN);
  return [get('year'), get('month'), get('day'), get('hour') % 24, get('minute'), get('second')];
}

function wallClockUtc(clock: WallClock) {
  return Date.UTC(clock[0], clock[1] - 1, clock[2], clock[3], clock[4], clock[5]);
}

const HOUR = 3_600_000;

function zonedToInstant(clock: WallClock): { ms: number; laterMs: number | null } | null {
  const naive = wallClockUtc(clock);
  const offsets = new Set([naive - 14 * HOUR, naive + 14 * HOUR].map((probe) => wallClockUtc(wallClockAt(probe)) - probe));
  const matches = Array.from(offsets)
    .map((offset) => naive - offset)
    .filter((ms) => wallClockUtc(wallClockAt(ms)) === naive)
    .sort((a, b) => a - b);
  if (matches.length === 0) return null;
  return { ms: matches[0], laterMs: matches.length > 1 ? matches[matches.length - 1] : null };
}

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Parses an explicit Google Forms timestamp ("10/21/2026 20:59:50", M/D/YYYY,
 * optional AM/PM) or ISO-style "2026-10-21 20:59:50" in FORM_TIME_ZONE. Never
 * falls back to locale-dependent `new Date(string)`.
 */
export function parseFormTimestamp(raw: string | null | undefined): ParsedTimestamp {
  const text = (raw ?? '').trim();
  if (!text) return { kind: 'missing' };

  let year: number;
  let month: number;
  let day: number;
  let hour: number;
  let minute: number;
  let second: number;
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp][Mm]))?$/);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (us) {
    [month, day, year, hour, minute] = [Number(us[1]), Number(us[2]), Number(us[3]), Number(us[4]), Number(us[5])];
    second = us[6] ? Number(us[6]) : 0;
    const meridiem = us[7]?.toLowerCase();
    if (meridiem) {
      if (hour < 1 || hour > 12) return { kind: 'invalid', reason: `"${text}" has an hour outside 1–12 for AM/PM.` };
      hour = (hour % 12) + (meridiem === 'pm' ? 12 : 0);
    }
  } else if (iso) {
    [year, month, day, hour, minute] = [Number(iso[1]), Number(iso[2]), Number(iso[3]), Number(iso[4]), Number(iso[5])];
    second = iso[6] ? Number(iso[6]) : 0;
  } else {
    return { kind: 'invalid', reason: `"${text}" is not a recognized timestamp. Expected M/D/YYYY HH:MM:SS as Google Forms exports it.` };
  }

  if (month < 1 || month > 12) return { kind: 'invalid', reason: `"${text}" has month ${month}; expected M/D/YYYY.` };
  if (hour > 23 || minute > 59 || second > 59) return { kind: 'invalid', reason: `"${text}" has an impossible time.` };
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) {
    return { kind: 'invalid', reason: `"${text}" is not a real date.` };
  }
  const instant = zonedToInstant([year, month, day, hour, minute, second]);
  if (!instant) return { kind: 'invalid', reason: `"${text}" does not exist in ${FORM_TIME_ZONE} (daylight-saving gap).` };
  return {
    kind: 'ok',
    ms: instant.ms,
    iso: new Date(instant.ms).toISOString(),
    local: `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`,
    ambiguous: instant.laterMs !== null,
    laterMs: instant.laterMs,
  };
}

/** Formats a stored instant back into the form's wall-clock time. */
export function formatFormTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '—';
  const [y, m, d, h, mi, s] = wallClockAt(ms);
  return `${m}/${d}/${y} ${pad(h)}:${pad(mi)}:${pad(s)}`;
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

export interface PlacementSourceRow {
  /** Stable id for this submission: "row-<sheet row>". */
  id: string;
  sourceRow: number;
  name: string;
  /** Normalized; transient only. */
  email: string;
  rawTimestamp: string;
  timestamp: ParsedTimestamp;
  /** Raw text of each rank column, first choice first. */
  rawChoices: string[];
}

export type PlacementParseResult =
  | { ok: true; headers: string[]; detection: ColumnDetection; rows: PlacementSourceRow[]; warnings: string[] }
  | { ok: false; error: string; headers: string[]; detection: ColumnDetection | null };

export function parsePlacementCsv(raw: string, overrides: ColumnOverrides = {}): PlacementParseResult {
  if (!raw.trim()) {
    return { ok: false, error: 'The file is empty. Export the Form responses sheet as CSV and upload it again.', headers: [], detection: null };
  }
  const table = parseCsvTable(raw);
  if (table.unterminatedQuote) {
    return {
      ok: false,
      error: `The CSV is malformed: a quoted cell opened on line ${table.unterminatedQuoteLine} never closes. Re-export it from Google Sheets (File → Download → CSV).`,
      headers: table.headers,
      detection: null,
    };
  }
  const detection = detectPlacementColumns(table.headers, overrides);
  if (table.duplicateHeaders.length > 0) {
    detection.issues.push({
      code: 'duplicate_header',
      severity: 'warning',
      message: `Repeated column headers: ${table.duplicateHeaders.map((header) => `"${header}"`).join(', ')}. Later copies are numbered, e.g. "${table.duplicateHeaders[0]} (2)".`,
    });
  }
  const errors = detection.issues.filter((issue) => issue.severity === 'error');
  if (errors.length > 0) {
    return { ok: false, error: errors.map((issue) => issue.message).join(' '), headers: table.headers, detection };
  }
  if (table.rows.length === 0) {
    return { ok: false, error: 'The CSV has a header row but no submissions.', headers: table.headers, detection };
  }

  const { columns } = detection;
  const rows = table.rows.map((record, index): PlacementSourceRow => {
    const sourceRow = table.rowNumbers[index];
    const rawTimestamp = columns.timestamp ? record[columns.timestamp] ?? '' : '';
    return {
      id: `row-${sourceRow}`,
      sourceRow,
      name: (columns.name ? record[columns.name] ?? '' : '').replace(/\s+/g, ' ').trim(),
      email: normalizeEmail(columns.email ? record[columns.email] : ''),
      rawTimestamp,
      timestamp: parseFormTimestamp(rawTimestamp),
      rawChoices: columns.ranks.map((header) => (record[header] ?? '').trim()),
    };
  });
  return { ok: true, headers: table.headers, detection, rows, warnings: detection.issues.map((issue) => issue.message) };
}

// ─── House labels ────────────────────────────────────────────────────────────

export type HouseLabelResolution =
  | { kind: 'resolved'; profileId: string }
  | { kind: 'inactive'; profileId: string }
  | { kind: 'ambiguous'; profileIds: string[] }
  | { kind: 'unknown' };

function lookupLabel(key: string, profiles: readonly PlacementProfile[]) {
  if (!key) return [];
  return profiles.filter((profile) =>
    normalizeHouseLookup(profile.house_key) === key || normalizeHouseLookup(profile.display_name) === key);
}

function fromMatches(matches: PlacementProfile[]): HouseLabelResolution | null {
  if (matches.length === 0) return null;
  const active = matches.filter((profile) => profile.is_active);
  if (active.length === 1) return { kind: 'resolved', profileId: active[0].id };
  if (active.length > 1) return { kind: 'ambiguous', profileIds: active.map((profile) => profile.id) };
  if (matches.length === 1) return { kind: 'inactive', profileId: matches[0].id };
  return { kind: 'ambiguous', profileIds: matches.map((profile) => profile.id) };
}

/**
 * Resolves one form option to a selected-year House profile: an admin mapping,
 * then House key / display name, then the name with a trailing parenthetical
 * ("Rarity (Kirsten & Jonas)" → "Rarity") stripped. Never picks between two
 * candidates.
 */
export function resolveHouseLabel(
  text: string,
  profiles: readonly PlacementProfile[],
  mappings: Readonly<Record<string, string>> = {},
): HouseLabelResolution {
  const key = normalizeHouseLookup(text);
  const mapped = mappings[key];
  if (mapped) {
    const profile = profiles.find((item) => item.id === mapped);
    if (profile) return profile.is_active ? { kind: 'resolved', profileId: profile.id } : { kind: 'inactive', profileId: profile.id };
  }
  const direct = fromMatches(lookupLabel(key, profiles));
  if (direct) return direct;
  const stripped = text.trim().match(/^(.*\S)\s*\([^()]*\)$/);
  if (stripped) {
    const base = fromMatches(lookupLabel(normalizeHouseLookup(stripped[1]), profiles));
    if (base) return base;
  }
  return { kind: 'unknown' };
}

// ─── Review ──────────────────────────────────────────────────────────────────

export type ApplicantIssueCode =
  | 'missing_name'
  | 'missing_email'
  | 'missing_timestamp'
  | 'invalid_timestamp'
  | 'ambiguous_timestamp'
  | 'missing_choice'
  | 'repeated_choice'
  | 'multiple_in_field'
  | 'ambiguous_first_choice'
  | 'unknown_house'
  | 'ambiguous_house'
  | 'inactive_house'
  | 'too_few_choices'
  | 'too_many_choices';

export interface ApplicantIssue {
  code: ApplicantIssueCode;
  /** Warnings are shown but never block placement. */
  severity: 'error' | 'warning';
  message: string;
  /** 1-based rank the issue is about, when it is about one. */
  rank?: number;
}

export type ApplicantStatus = 'valid' | 'invalid' | 'duplicate' | 'excluded';

export interface ReviewedApplicant extends PlacementSourceRow {
  /** Submission instant after any rollback-hour choice; null when it has no place in line yet. */
  submittedAtMs: number | null;
  submittedAtIso: string | null;
  /** Resolved House profile id per rank (after any admin correction); null when unresolved. */
  choiceIds: Array<string | null>;
  corrected: boolean;
  issues: ApplicantIssue[];
  status: ApplicantStatus;
  /** For a repeat submission: the id of the earlier one that was kept. */
  duplicateOf: string | null;
  duplicateDiffers: boolean;
  exclusionReason: string | null;
}

export interface UnresolvedLabel {
  label: string;
  key: string;
  count: number;
  kind: 'unknown' | 'ambiguous' | 'inactive';
  candidateIds: string[];
}

export interface PlacementEdits {
  /** Normalized form option → House profile id. */
  houseMappings: Record<string, string>;
  /** Row id → House profile id per rank, set by an admin. */
  corrections: Record<string, Array<string | null>>;
  /** Row id → documented reason for leaving the applicant out. */
  exclusions: Record<string, string>;
  /** Rows without an email an admin confirmed are not repeat submissions. */
  confirmedIdentities: Record<string, boolean>;
  /**
   * For a time in the repeated daylight-saving hour: which occurrence it was
   * ("first" = PDT, "second" = PST). The CSV cannot say, so an admin decides.
   */
  rollbackChoices: Record<string, 'first' | 'second'>;
}

export const EMPTY_PLACEMENT_EDITS: PlacementEdits = { houseMappings: {}, corrections: {}, exclusions: {}, confirmedIdentities: {}, rollbackChoices: {} };

export interface PlacementReviewCounts {
  submissions: number;
  unique: number;
  duplicates: number;
  invalid: number;
  missingTimestamps: number;
  excluded: number;
  valid: number;
}

export interface PlacementReview {
  applicants: ReviewedApplicant[];
  houses: PlacementHouse[];
  requiredRanks: number;
  unresolvedLabels: UnresolvedLabel[];
  counts: PlacementReviewCounts;
  /** Every included applicant is valid and there is at least one. */
  ready: boolean;
}

function splitMulti(text: string) {
  return text.split(/\s*[;,]\s*/).map((part) => part.trim()).filter(Boolean);
}

interface ChoiceEvaluation {
  ids: Array<string | null>;
  issues: ApplicantIssue[];
  labels: Array<{ label: string; resolution: HouseLabelResolution }>;
}

function evaluateRawChoices(
  rawChoices: string[],
  profiles: readonly PlacementProfile[],
  mappings: Readonly<Record<string, string>>,
  requiredRanks: number,
  activeCount: number,
): ChoiceEvaluation {
  const ids: Array<string | null> = [];
  const issues: ApplicantIssue[] = [];
  const labels: ChoiceEvaluation['labels'] = [];
  const nameOf = (id: string) => profiles.find((profile) => profile.id === id)?.display_name ?? 'that House';

  rawChoices.forEach((text, index) => {
    const rank = index + 1;
    if (rank > requiredRanks) {
      if (text && rank > activeCount) {
        issues.push({ code: 'too_many_choices', severity: 'error', rank, message: `Choice #${rank} is filled in, but only ${activeCount} Houses are participating.` });
      }
      return;
    }
    if (!text) {
      ids.push(null);
      issues.push({ code: 'missing_choice', severity: 'error', rank, message: `Choice #${rank} is blank.` });
      return;
    }
    const whole = resolveHouseLabel(text, profiles, mappings);
    if (whole.kind === 'unknown') {
      const parts = splitMulti(text);
      if (parts.length > 1 && parts.filter((part) => resolveHouseLabel(part, profiles, mappings).kind !== 'unknown').length > 1) {
        ids.push(null);
        issues.push({
          code: rank === 1 ? 'ambiguous_first_choice' : 'multiple_in_field',
          severity: 'error',
          rank,
          message: `Choice #${rank} names more than one House ("${text}").`,
        });
        return;
      }
    }
    labels.push({ label: text, resolution: whole });
    if (whole.kind === 'resolved') {
      ids.push(whole.profileId);
    } else {
      ids.push(null);
      if (whole.kind === 'unknown') issues.push({ code: 'unknown_house', severity: 'error', rank, message: `Choice #${rank} "${text}" is not a House for this year. Map it below or correct the ranking.` });
      if (whole.kind === 'ambiguous') issues.push({ code: 'ambiguous_house', severity: 'error', rank, message: `Choice #${rank} "${text}" could be more than one House.` });
      if (whole.kind === 'inactive') issues.push({ code: 'inactive_house', severity: 'error', rank, message: `Choice #${rank} ${nameOf(whole.profileId)} is not an active House.` });
    }
  });
  return { ids, issues, labels };
}

function rankingIssues(ids: Array<string | null>, requiredRanks: number, profiles: readonly PlacementProfile[]): ApplicantIssue[] {
  const issues: ApplicantIssue[] = [];
  const nameOf = (id: string) => profiles.find((profile) => profile.id === id)?.display_name ?? 'A House';
  const seen = new Map<string, number>();
  ids.forEach((id, index) => {
    if (!id) return;
    const first = seen.get(id);
    if (first !== undefined) {
      issues.push({ code: 'repeated_choice', severity: 'error', rank: index + 1, message: `${nameOf(id)} is ranked #${first + 1} and #${index + 1}.` });
    } else {
      seen.set(id, index);
    }
  });
  if (seen.size < requiredRanks && ids.every((id) => id !== null)) {
    issues.push({ code: 'too_few_choices', severity: 'error', message: `Only ${seen.size} different House${seen.size === 1 ? '' : 's'} ranked; ${requiredRanks} are required.` });
  }
  return issues;
}

/**
 * Validates every submission against the selected year's Houses and applies
 * the admin's corrections, mappings, exclusions and identity confirmations.
 * Re-run after every edit; it never mutates its inputs.
 */
export function buildPlacementReview(
  rows: readonly PlacementSourceRow[],
  profiles: readonly PlacementProfile[],
  edits: PlacementEdits = EMPTY_PLACEMENT_EDITS,
): PlacementReview {
  const active = profiles.filter((profile) => profile.is_active);
  const houses: PlacementHouse[] = active.map((profile, index) => ({
    id: profile.id,
    label: profile.display_name || profile.house_key,
    displayOrder: profile.display_order ?? index,
  }));
  const rankColumns = rows.reduce((max, row) => Math.max(max, row.rawChoices.length), 0);
  const requiredRanks = Math.min(active.length, rankColumns);
  const labelTally = new Map<string, UnresolvedLabel>();

  const evaluated = rows.map((row): ReviewedApplicant => {
    const issues: ApplicantIssue[] = [];
    if (!row.name) issues.push({ code: 'missing_name', severity: 'error', message: 'Name is blank.' });
    if (!row.email && !edits.confirmedIdentities[row.id]) {
      issues.push({ code: 'missing_email', severity: 'error', message: 'Email is blank, so a repeat submission cannot be ruled out. Confirm this is a separate applicant.' });
    }
    if (row.timestamp.kind === 'missing') issues.push({ code: 'missing_timestamp', severity: 'error', message: 'Timestamp is blank, so this submission has no place in line.' });
    if (row.timestamp.kind === 'invalid') issues.push({ code: 'invalid_timestamp', severity: 'error', message: row.timestamp.reason });
    let submittedAtMs: number | null = row.timestamp.kind === 'ok' ? row.timestamp.ms : null;
    const rollback = edits.rollbackChoices[row.id];
    if (row.timestamp.kind === 'ok' && row.timestamp.ambiguous) {
      if (rollback === 'second' && row.timestamp.laterMs !== null) submittedAtMs = row.timestamp.laterMs;
      if (!rollback) {
        issues.push({
          code: 'ambiguous_timestamp',
          severity: 'error',
          message: 'This time happened twice (clocks fell back). Choose whether it was the first (PDT) or second (PST) occurrence; the sheet row order around it shows which.',
        });
      }
    }

    const raw = evaluateRawChoices(row.rawChoices, profiles, edits.houseMappings, requiredRanks, active.length);
    const correction = edits.corrections[row.id];
    let choiceIds: Array<string | null>;
    if (correction) {
      choiceIds = Array.from({ length: requiredRanks }, (_, index) => correction[index] ?? null);
      choiceIds.forEach((id, index) => {
        if (!id) issues.push({ code: 'missing_choice', severity: 'error', rank: index + 1, message: `Choice #${index + 1} is not set.` });
        else if (!active.some((profile) => profile.id === id)) issues.push({ code: 'inactive_house', severity: 'error', rank: index + 1, message: `Choice #${index + 1} is not an active House.` });
      });
    } else {
      choiceIds = raw.ids;
      issues.push(...raw.issues);
      raw.labels.forEach(({ label, resolution }) => {
        if (resolution.kind === 'resolved') return;
        const key = normalizeHouseLookup(label);
        const entry = labelTally.get(key) ?? {
          label,
          key,
          count: 0,
          kind: resolution.kind,
          candidateIds: resolution.kind === 'ambiguous' ? resolution.profileIds : resolution.kind === 'inactive' ? [resolution.profileId] : [],
        };
        entry.count += 1;
        labelTally.set(key, entry);
      });
    }
    issues.push(...rankingIssues(choiceIds, requiredRanks, profiles));

    return {
      ...row,
      submittedAtMs,
      submittedAtIso: submittedAtMs === null ? null : new Date(submittedAtMs).toISOString(),
      choiceIds,
      corrected: !!correction,
      issues,
      status: 'valid',
      duplicateOf: null,
      duplicateDiffers: false,
      exclusionReason: edits.exclusions[row.id]?.trim() || null,
    };
  });

  // Repeat submissions: the earliest included one for each email is kept.
  const sortKey = (row: ReviewedApplicant) => ({
    id: row.id,
    sourceRow: row.sourceRow,
    submittedAtMs: row.submittedAtMs ?? Number.POSITIVE_INFINITY,
  });
  const keptByEmail = new Map<string, ReviewedApplicant>();
  [...evaluated]
    .filter((row) => !row.exclusionReason && row.email)
    .sort((a, b) => comparePriority(sortKey(a), sortKey(b)))
    .forEach((row) => {
      const kept = keptByEmail.get(row.email);
      if (!kept) {
        keptByEmail.set(row.email, row);
        return;
      }
      row.duplicateOf = kept.id;
      row.duplicateDiffers = row.rawChoices.map(normalizeHouseLookup).join('|') !== kept.rawChoices.map(normalizeHouseLookup).join('|');
    });

  evaluated.forEach((row) => {
    if (row.exclusionReason) row.status = 'excluded';
    else if (row.duplicateOf) row.status = 'duplicate';
    else if (row.issues.some((issue) => issue.severity === 'error')) row.status = 'invalid';
    else row.status = 'valid';
  });

  const counts: PlacementReviewCounts = {
    submissions: evaluated.length,
    unique: evaluated.filter((row) => row.status !== 'duplicate').length,
    duplicates: evaluated.filter((row) => row.status === 'duplicate').length,
    invalid: evaluated.filter((row) => row.status === 'invalid').length,
    missingTimestamps: evaluated.filter((row) => row.timestamp.kind !== 'ok').length,
    excluded: evaluated.filter((row) => row.status === 'excluded').length,
    valid: evaluated.filter((row) => row.status === 'valid').length,
  };

  return {
    applicants: evaluated,
    houses,
    requiredRanks,
    unresolvedLabels: Array.from(labelTally.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    counts,
    ready: counts.invalid === 0 && counts.valid > 0 && houses.length > 0,
  };
}

/** The included, valid applicants in the allocator's shape. */
export function placementApplicants(review: PlacementReview): PlacementApplicant[] {
  return review.applicants
    .filter((row) => row.status === 'valid' && row.submittedAtMs !== null)
    .map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email || null,
      submittedAtMs: row.submittedAtMs ?? Number.NaN,
      sourceRow: row.sourceRow,
      preferences: row.choiceIds.filter((id): id is string => !!id),
    }));
}

// ─── Member matching ─────────────────────────────────────────────────────────

export interface ApplicantMemberMatch {
  status: 'match' | 'review' | 'unmatched';
  memberId: string | null;
  method: 'email' | 'name' | null;
  note: string;
}

export interface PlacementMemberIndex {
  byEmail: ReadonlyMap<string, HouseImportMember[]>;
  byName: MemberNameIndex;
  byLooseName: MemberNameIndex;
  emailById: ReadonlyMap<string, string>;
}

/** "Ai E. Phan" → "ai phan": drops single-letter middle initials. */
function looseName(name: string) {
  const tokens = normalizeMemberName(name).split(' ').filter(Boolean);
  if (tokens.length <= 2) return tokens.join(' ');
  return [tokens[0], ...tokens.slice(1, -1).filter((token) => token.replace(/\.$/, '').length > 1), tokens[tokens.length - 1]].join(' ');
}

export function buildPlacementMemberIndex(members: readonly HouseImportMember[]): PlacementMemberIndex {
  const byEmail = new Map<string, HouseImportMember[]>();
  const emailById = new Map<string, string>();
  members.forEach((member) => {
    const email = normalizeEmail(member.email);
    if (!email) return;
    emailById.set(member.id, email);
    byEmail.set(email, [...(byEmail.get(email) ?? []), member]);
  });
  const options = members.map((member) => toMemberOption(member));
  const loose = options.map((option) => ({ ...option, fullName: looseName(option.fullName) }));
  return { byEmail, byName: buildMemberNameIndex(options), byLooseName: buildMemberNameIndex(loose), emailById };
}

/**
 * Exact email, then exact unique name, then a unique name ignoring middle
 * initials (review only). Never fuzzy, never picks between candidates, never
 * creates a member. Matching does not affect anyone's place in line.
 */
export function matchApplicantToMember(applicant: { name: string; email: string | null }, index: PlacementMemberIndex): ApplicantMemberMatch {
  const email = normalizeEmail(applicant.email);
  if (email) {
    const byEmail = index.byEmail.get(email) ?? [];
    if (byEmail.length === 1) return { status: 'match', memberId: byEmail[0].id, method: 'email', note: 'Matched by email.' };
    if (byEmail.length > 1) {
      return { status: 'review', memberId: null, method: null, note: `${byEmail.length} member records share this email. Choose one.` };
    }
  }
  const exact = findExactMemberMatch(applicant.name, index.byName);
  if (exact.kind === 'unique') {
    const memberEmail = index.emailById.get(exact.member.id);
    if (email && memberEmail && memberEmail !== email) {
      return { status: 'review', memberId: exact.member.id, method: 'name', note: 'Same name, but the member record has a different email. Confirm.' };
    }
    return { status: 'match', memberId: exact.member.id, method: 'name', note: 'Matched by exact name.' };
  }
  if (exact.kind === 'ambiguous') {
    return { status: 'review', memberId: null, method: null, note: `${exact.members.length} members share this name. Choose one.` };
  }
  const loose = findExactMemberMatch(looseName(applicant.name), index.byLooseName);
  if (loose.kind === 'unique') {
    return { status: 'review', memberId: loose.member.id, method: 'name', note: 'Same name apart from a middle initial. Confirm.' };
  }
  return { status: 'unmatched', memberId: null, method: null, note: 'No member record found. Link one before revealing.' };
}
