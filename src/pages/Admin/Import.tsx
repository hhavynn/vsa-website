// Account-free attendance and points use the member ledger.
// Architecture and import rules: docs/leaderboard-system.md.
// Protected domain — attendance import. This page writes to member_event_attendance
// and creates member rows; changes here directly affect points and event history for
// real members. Do not modify import logic unless explicitly requested.
// Authority: AGENTS.md § "Things to never do"; vsa-change-control § 1 (Forbidden tier).
import { useEffect, useMemo, useRef, useState } from 'react';
import { ImportReviewPanel } from '../../components/features/admin/ops';
import { reviewAttendanceRows } from '../../lib/adminImportReview';
import { supabase } from '../../lib/supabase';
import { runBulkWrites } from '../../lib/bulkWrites';
import toast, { Toaster } from 'react-hot-toast';
import { useQueryClient } from 'react-query';
import { normalizeYearInput, OFFICIAL_YEARS } from '../../lib/yearNormalizer';
import { PageTitle } from '../../components/common/PageTitle';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ImportAuditPanel } from '../../components/features/admin/ImportAuditPanel';
import { HistoricalRecoveryPanel } from '../../components/features/admin/HistoricalRecoveryPanel';
import { asJson, decisionFromRowStatus, importJobsRepository } from '../../data/repos/importJobs';
import { ImportJobStatus } from '../../types/database';
import { AttendanceRowDecision, MemberIdentity } from '../../components/features/admin/AttendanceRowDecision';
import {
  DecisionContext,
  EffectiveStatus,
  RowDecision,
  hasImportableName,
  planAttendanceWrites,
  resolveRow,
  summarizeAttendanceImport,
} from '../../lib/attendanceImportDecisions';
import {
  AttendanceMatchMethod,
  AttendanceMatchReason,
  AttendanceMatchResult,
  buildMemberLookupMaps,
  getSafeAttendanceMemberEnrichment,
  planAttendanceMemberEnrichments,
  matchAttendanceImportRows,
} from '../../lib/memberMatching';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Event {
  id: string;
  name: string;
  date: string;
  points: number;
  academic_term_id: string | null;
}

interface AcademicTerm {
  id: string;
  label: string;
  academic_year_start: number;
  academic_year_end: number;
}

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  college: string | null;
  year: string | null;
  points: number;
  events_attended: number;
  email: string | null;
  needs_review?: boolean;
}

type RowStatus = 'match' | 'new' | 'already' | 'review' | 'duplicate';
type SortMode = 'default' | 'review-first' | 'review-last';

interface RowResult extends Omit<AttendanceMatchResult, 'matchedMember' | 'status' | 'method' | 'reason'> {
  /** Best suggested existing member, or null. A suggestion is not a decision. */
  matchedMember: Member | null;
  status: RowStatus;
  method: AttendanceMatchMethod;
  reason: AttendanceMatchReason;
  selected: boolean;
  /** The admin's explicit choice for this row; null leaves the matcher's verdict as is. */
  decision: RowDecision | null;
}

interface ImportOutcome {
  totalRows: number;
  validRows: number;
  creditedMembers: number;
  attendanceInserted: number;
  attendanceAlreadyPresent: number;
  createdMembers: number;
  emailsWithheld: number;
  enrichedProfiles: number;
  alreadyRecorded: number;
  duplicatesSkipped: number;
  skipped: number;
  unresolved: number;
  invalid: number;
}

const MISSING_TERM_IMPORT_MESSAGE = 'This event has no academic term assigned. Assign a term in Admin Events before importing attendance.';

function getAcademicYearLabel(term: AcademicTerm | undefined): string {
  if (!term) return 'its assigned academic year';
  return `${term.academic_year_start}–${term.academic_year_end}`;
}

function canMarkAsNew(row: RowResult, status: EffectiveStatus): boolean {
  return row.canMarkNew && hasImportableName(row) && (row.status === 'review' || row.status === 'match' || row.status === 'already') && status !== 'duplicate';
}

function canSkipRow(row: RowResult): boolean {
  return hasImportableName(row) && (row.status === 'review' || row.status === 'match' || row.status === 'new');
}

function getActionLabel(status: EffectiveStatus, row: RowResult): string {
  if (status === 'match') return row.status === 'review' ? 'Matched (you chose)' : 'Update';
  if (status === 'new') return row.status === 'new' ? 'Create' : 'Create New';
  if (status === 'review') return 'Needs decision';
  if (status === 'skipped') return 'Skipped';
  if (status === 'invalid') return 'Invalid';
  return 'Skip';
}

function getSortPriority(status: EffectiveStatus, row: RowResult, sortMode: SortMode): number {
  const reviewFirstOrder: Record<EffectiveStatus, number> = {
    review: 0, match: 1, new: 2, skipped: 3, invalid: 3, duplicate: 4, already: 5,
  };
  const reviewLastOrder: Record<EffectiveStatus, number> = {
    already: 0, duplicate: 1, skipped: 2, invalid: 2, new: 3, match: 4, review: 5,
  };

  if (sortMode === 'review-first') return reviewFirstOrder[status];
  if (sortMode === 'review-last') return reviewLastOrder[status];
  return row.originalIndex;
}

// ─── Name helpers ─────────────────────────────────────────────────────────────

/** Capitalize the first letter of every word, lowercase the rest.
 *  "john doe" → "John Doe", "MARY LOU" → "Mary Lou" */
function capitalizeName(s: string): string {
  return s.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/**
 * Normalise a raw name string for matching purposes:
 *  - "Lynna, On"        → "Lynna On"      (comma stripped, order kept)
 *  - "Kevin J. Nguyen"  → "Kevin Nguyen"  (middle initial with period)
 *  - "Kevin J Nguyen"   → "Kevin Nguyen"  (single-letter middle word)
 * Returns a capitalised string. Does NOT mutate the display name.
 */
function cleanName(raw: string): string {
  let s = raw.trim();
  // Strip ALL commas — treat as typos/separators, never as Last/First markers
  s = s.replace(/,/g, ' ');
  // Remove middle initials followed by a period: "J." or "J. "
  s = s.replace(/\b[A-Za-z]\.\s*/g, '');
  // Remove lone single-letter middle words between two multi-letter words
  s = s.replace(/(\b\w{2,})\s+\b[A-Za-z]\b\s+(\w{2,}\b)/g, '$1 $2');
  return capitalizeName(s.replace(/\s+/g, ' ').trim());
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function parseCSV(raw: string): Record<string, string>[] {
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitRow(lines[0]);
  return lines.slice(1).map(line => {
    const vals = splitRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim()] = (vals[i] ?? '').trim(); });
    return row;
  });
}

function splitRow(line: string): string[] {
  const out: string[] = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function detectCol(headers: string[], hints: string[]): string {
  const h = hints.map(x => x.toLowerCase());
  return headers.find(c => h.some(hint => c.toLowerCase().includes(hint))) ?? '';
}

/** Supabase errors are sometimes plain `{ message }` objects rather than Error instances. */
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') return err.message;
  return String(err);
}

function toCSVUrl(raw: string): string {
  const url = raw.trim();
  if (url.includes('docs.google.com/spreadsheets') && !url.includes('output=csv') && !url.includes('format=csv')) {
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv`;
  }
  return url;
}

function getImportSourceType(raw: string): 'google_sheets_csv' | 'csv_url' | 'unknown' {
  const url = raw.trim();
  if (!url) return 'unknown';
  if (url.includes('docs.google.com/spreadsheets')) return 'google_sheets_csv';
  return 'csv_url';
}

// ─── Component ────────────────────────────────────────────────────────────────

type Step = 'configure' | 'preview' | 'done';

export default function AdminImport() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('configure');

  // Configure
  const [events, setEvents] = useState<Event[]>([]);
  const [terms, setTerms]   = useState<Record<string, AcademicTerm>>({});
  const [selectedEventId, setSelectedEventId] = useState('');
  const [csvUrl, setCsvUrl] = useState('');
  const [csvSource, setCsvSource] = useState<'url' | 'file'>('url');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [fetchingCsv, setFetchingCsv] = useState(false);
  const [configError, setConfigError] = useState('');

  // Column mapping
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [firstNameCol, setFirstNameCol] = useState('');
  const [lastNameCol, setLastNameCol] = useState('');
  const [fullNameCol, setFullNameCol] = useState('');
  const [useFullName, setUseFullName] = useState(false);
  const [collegeCol, setCollegeCol] = useState('');
  const [yearCol, setYearCol] = useState('');
  const [emailCol, setEmailCol] = useState('');

  // Preview
  const [rows, setRows] = useState<RowResult[]>([]);
  const [cachedParsed, setCachedParsed] = useState<Record<string, string>[]>([]);
  const [matchedMembersSnapshot, setMatchedMembersSnapshot] = useState<Member[]>([]);
  const [importing, setImporting] = useState(false);
  const [alreadyMemberIds, setAlreadyMemberIds] = useState<Set<string>>(new Set());
  const [ackPartial, setAckPartial] = useState(false);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  // Members created by an attempt that then failed. A retry reuses them instead of creating duplicates.
  const createdByRowIdRef = useRef<Record<string, string>>({});
  const withheldEmailRowIdsRef = useRef<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('default');

  useEffect(() => {
    async function loadData() {
      const { data: eventsData } = await supabase
        .from('events')
        .select('id, name, date, points, academic_term_id')
        .order('date', { ascending: false });
      setEvents((eventsData ?? []) as Event[]);

      const { data: termsData } = await supabase
        .from('academic_terms')
        .select('id, label, academic_year_start, academic_year_end');
      const termMap: Record<string, AcademicTerm> = {};
      (termsData ?? []).forEach((t: AcademicTerm) => { termMap[t.id] = t; });
      setTerms(termMap);
    }
    loadData();
  }, []);

  function updateRow(rowId: string, updater: (row: RowResult) => RowResult) {
    setRows(current => current.map(row => (row.rowId === rowId ? updater(row) : row)));
  }

  function toggleRowSelection(rowId: string) {
    updateRow(rowId, row => ({ ...row, selected: !row.selected }));
  }

  function toggleSelectAllRows() {
    setRows(current => {
      const shouldSelectAll = current.some(row => !row.selected);
      return current.map(row => ({ ...row, selected: shouldSelectAll }));
    });
  }

  function setRowDecision(rowId: string, decision: RowDecision | null) {
    updateRow(rowId, row => ({ ...row, decision }));
  }

  function applyDecisionToSelected(kind: 'new' | 'skip' | 'clear') {
    setRows(current => current.map(row => {
      if (!row.selected) return row;
      if (kind === 'clear') return { ...row, decision: null };
      if (kind === 'new') return canMarkAsNew(row, row.status) ? { ...row, decision: { kind: 'new' } } : row;
      return canSkipRow(row) ? { ...row, decision: { kind: 'skip' } } : row;
    }));
  }

  function toggleActionSort() {
    setSortMode(current => {
      if (current === 'default') return 'review-first';
      if (current === 'review-first') return 'review-last';
      return 'default';
    });
  }

  // ── Fetch CSV ────────────────────────────────────────────────────────────────
  async function handleFetchCsv() {
    setConfigError('');
    if (!selectedEventId) { setConfigError('Select an event.'); return; }
    if (csvSource === 'url' && !csvUrl.trim()) { setConfigError('Paste a CSV URL.'); return; }
    if (csvSource === 'file' && !csvFile) { setConfigError('Choose a .csv file.'); return; }
    if (csvSource === 'file' && !csvFile?.name.toLowerCase().endsWith('.csv')) {
      setConfigError('Choose a .csv file. Export spreadsheets as CSV first.'); return;
    }
    const event = events.find(e => e.id === selectedEventId);
    if (!event?.academic_term_id) {
      setConfigError(MISSING_TERM_IMPORT_MESSAGE);
      return;
    }

    setFetchingCsv(true);
    try {
      let raw: string;
      if (csvSource === 'file' && csvFile) {
        raw = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ''));
          reader.onerror = () => reject(new Error('Could not read the selected file. Try selecting it again.'));
          reader.onabort = () => reject(new Error('File reading was cancelled.'));
          reader.readAsText(csvFile);
        });
      } else {
        const res = await fetch(toCSVUrl(csvUrl));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        raw = await res.text();
      }
      const parsed = parseCSV(raw);
      if (!parsed.length) throw new Error('No data rows found in CSV.');

      const headers = Object.keys(parsed[0]);
      setCsvHeaders(headers);
      setCachedParsed(parsed);

      const dFirst   = detectCol(headers, ['first name', 'first', 'given name', 'firstname']);
      const dLast    = detectCol(headers, ['last name', 'last', 'family', 'lastname', 'surname']);
      const dFull    = detectCol(headers, ['full name', 'name', 'your name', 'student name', 'what is your name']);
      const dCollege = detectCol(headers, ['college', 'ucsd college', 'residential college']);
      const dYear    = detectCol(headers, ['year', 'student year', 'year in school', 'academic year', 'standing']);
      const dEmail   = detectCol(headers, ['email', 'email address', 'e-mail', 'contact email', 'gmail']);
      const useFull  = !!dFull;

      setFirstNameCol(dFirst); setLastNameCol(dLast); setFullNameCol(dFull);
      setUseFullName(useFull); setCollegeCol(dCollege); setYearCol(dYear); setEmailCol(dEmail);

      await runMatching(parsed, dFirst, dLast, dFull, useFull, dCollege, dYear, dEmail, selectedEventId);
      setStep('preview');
    } catch (err: unknown) {
      setConfigError(`Failed to load CSV: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setFetchingCsv(false);
    }
  }

  // ── Matching engine ───────────────────────────────────────────────────────────
  async function runMatching(
    parsed: Record<string, string>[],
    fCol: string, lCol: string, fullCol: string, useFull: boolean,
    cCol: string, yCol: string, eCol: string, eventId: string,
  ) {
    // Load all existing members
    const { data: membersData } = await supabase
      .from('members')
      .select('id, first_name, last_name, college, year, points, events_attended, email');
    const allMembers = (membersData ?? []) as Member[];

    // Load which members already have attendance for this event
    const { data: existingAtt } = await supabase
      .from('member_event_attendance')
      .select('member_id')
      .eq('event_id', eventId);
    const alreadySet = new Set((existingAtt ?? []).map((r: { member_id: string }) => r.member_id));
    setAlreadyMemberIds(alreadySet);
    setAckPartial(false);
    createdByRowIdRef.current = {};
    withheldEmailRowIdsRef.current = new Set();

    const matchInputs = parsed.map((row, index) => {
      // Build display name (capitalised, shown in table)
      let displayName = '';
      if (useFull) {
        displayName = capitalizeName(fullCol ? row[fullCol] : '');
      } else {
        const fn = capitalizeName(fCol ? row[fCol] : '');
        const ln = capitalizeName(lCol ? row[lCol] : '');
        displayName = [fn, ln].filter(Boolean).join(' ');
      }

      // Build match name (cleaned: no middle initials, comma-reversed)
      const matchName = cleanName(displayName);

      const csvCollege    = (cCol ? row[cCol] : '').trim();
      const csvYear       = normalizeYearInput(yCol ? row[yCol] : '');
      const csvEmail      = (eCol ? row[eCol] : '').trim().toLowerCase();
      const invalidYear = csvYear !== '' && !OFFICIAL_YEARS.includes(csvYear);

      return {
        rowId: `${index}-${displayName}-${csvEmail}`,
        originalIndex: index,
        csvRow: row, displayName, matchName, csvCollege, csvYear, csvEmail,
        invalidYear,
      };
    });

    const results = matchAttendanceImportRows(matchInputs, allMembers, alreadySet).map((result) => ({
      ...result,
      matchedMember: result.matchedMember as Member | null,
      selected: false,
      decision: null,
    })) as RowResult[];

    setMatchedMembersSnapshot(allMembers);
    setRows(results);
    setSortMode('default');
  }

  async function handleRematch() {
    setFetchingCsv(true);
    try {
      await runMatching(cachedParsed, firstNameCol, lastNameCol, fullNameCol, useFullName, collegeCol, yearCol, emailCol, selectedEventId);
    } finally {
      setFetchingCsv(false);
    }
  }

  // ── Confirm import ────────────────────────────────────────────────────────────
  async function handleImport() {
    if (summary.unresolved > 0 && !ackPartial) {
      toast.error('Acknowledge the unresolved rows, or resolve them, before importing.');
      return;
    }
    if (!summary.existingMembers && !summary.newMembers) {
      toast.error(summary.unresolved || summary.duplicatesSkipped || summary.skipped ? 'No rows to import.' : 'Nothing to import.');
      return;
    }

    setImporting(true);
    let importPoints = selectedEvent?.points ?? 0;
    const createdMemberIdsByRowId: Record<string, string> = { ...createdByRowIdRef.current };
    const withheldEmailRowIds = new Set<string>(withheldEmailRowIdsRef.current);
    let createdAttendanceCount = 0;

    try {
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, name, date, points, academic_term_id')
        .eq('id', selectedEventId)
        .single();

      if (eventError) throw eventError;
      if (!event?.academic_term_id) throw new Error(MISSING_TERM_IMPORT_MESSAGE);

      const pts = event.points ?? 1;
      importPoints = pts;

      const { data: latestMembersData, error: latestMembersError } = await supabase
        .from('members')
        .select('id, first_name, last_name, college, year, points, events_attended, email');
      if (latestMembersError) throw latestMembersError;
      const latestMembers = (latestMembersData ?? matchedMembersSnapshot) as Member[];

      // Plan from the latest member list so a new member never takes an email that has since been claimed.
      const plan = planAttendanceWrites(rows, decisionContext, latestMembers);

      // 1. Create new member rows (points/events_attended computed by DB trigger).
      //    Rows created by an earlier failed attempt are reused, never created twice.
      const pendingCreates = plan.creates.filter(c => !createdMemberIdsByRowId[c.row.rowId]);
      if (pendingCreates.length) {
        const { data: inserted, error } = await supabase
          .from('members')
          .insert(pendingCreates.map(c => ({
            first_name: c.first_name,
            last_name: c.last_name,
            college: c.college,
            year: c.year,
            email: c.email,
            needs_review: false,
          })))
          .select('id');
        if (error) throw error;
        const insertedIds = (inserted ?? []).map((m: { id: string }) => m.id);
        if (insertedIds.length !== pendingCreates.length) {
          throw new Error('Created members could not be matched back to their rows. Check Admin → Members before retrying.');
        }
        pendingCreates.forEach((c, index) => {
          createdMemberIdsByRowId[c.row.rowId] = insertedIds[index];
          createdByRowIdRef.current[c.row.rowId] = insertedIds[index];
          if (c.emailWithheld) {
            withheldEmailRowIds.add(c.row.rowId);
            withheldEmailRowIdsRef.current.add(c.row.rowId);
          }
        });
      }

      // 2. Insert attendance records — DB trigger recalculates member points automatically.
      //    Existing member/event pairs are ignored, so repeating an import never doubles points.
      const attendanceRows = [
        ...plan.updates.map(u => ({ member_id: u.member.id, event_id: selectedEventId, points_earned: pts })),
        ...plan.creates.map(c => ({ member_id: createdMemberIdsByRowId[c.row.rowId], event_id: selectedEventId, points_earned: pts })),
      ];

      if (attendanceRows.length) {
        const { data: insertedAttendance, error } = await supabase
          .from('member_event_attendance')
          .upsert(attendanceRows, { onConflict: 'member_id,event_id', ignoreDuplicates: true })
          .select('member_id,event_id');
        if (error) throw error;
        createdAttendanceCount = insertedAttendance?.length ?? 0;
      }

      // 3. Fill missing profile fields on matched members, and advance year
      //    when the CSV reports a higher standing than the one on record.
      //    One write per member, computed from the record refetched above.
      //    A suggestion that an admin did not confirm never reaches this step.
      const toEnrich = planAttendanceMemberEnrichments(
        plan.updates.map(({ row, member }) => ({
          ...row,
          matchedMember: member,
          adminConfirmed: row.status === 'review',
        })),
        latestMembers,
      );
      // An email a new member in this import now holds is never also attached to a matched member.
      const emailsOfNewMembers = new Set(plan.creates.map(c => c.email).filter(Boolean));
      toEnrich.forEach(({ updates }) => {
        if (updates.email && emailsOfNewMembers.has(updates.email)) delete updates.email;
      });
      const enrichPlans = toEnrich.filter(({ updates }) => Object.keys(updates).length > 0);
      let enrichedCount = 0;
      await runBulkWrites(async () => {
        for (const { memberId, updates } of enrichPlans) {
          const { error } = await supabase
            .from('members')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', memberId);
          if (!error) {
            enrichedCount += 1;
            continue;
          }
          console.error('Import: failed to update member profile', error);
          // Paused by the request guard / rate limited: every remaining update would fail too.
          if (error.code === 'over_request_rate_limit') break;
        }
      });
      // Attendance is already recorded. Only updates confirmed written count as enriched;
      // failed or skipped ones are reported below, never announced as success.
      const enrichFailedCount = enrichPlans.length - enrichedCount;

      const auditSaved = await recordImportAudit({
        status: 'completed',
        points: pts,
        createdMemberIdsByRowId,
        withheldEmailRowIds,
        createdAttendanceCount,
        enrichedMembersCount: enrichedCount,
      });
      createdByRowIdRef.current = {};
      withheldEmailRowIdsRef.current = new Set();
      setOutcome({
        totalRows: rows.length,
        validRows: summary.validRows,
        creditedMembers: plan.updates.length,
        attendanceInserted: createdAttendanceCount,
        attendanceAlreadyPresent: Math.max(0, attendanceRows.length - createdAttendanceCount),
        createdMembers: plan.creates.length,
        emailsWithheld: plan.creates.filter(c => withheldEmailRowIds.has(c.row.rowId)).length,
        enrichedProfiles: enrichedCount,
        alreadyRecorded: summary.alreadyRecorded,
        duplicatesSkipped: summary.duplicatesSkipped,
        skipped: summary.skipped,
        unresolved: summary.unresolved,
        invalid: summary.invalid,
      });
      const notImported = summary.unresolved + summary.skipped + summary.duplicatesSkipped;
      const enrichMsg = enrichedCount ? `, enriched ${enrichedCount} profile${enrichedCount !== 1 ? 's' : ''}` : '';
      const notImportedMsg = notImported ? `, not imported: ${notImported} row${notImported !== 1 ? 's' : ''}` : '';
      toast.success(`Done! Updated ${plan.updates.length} member${plan.updates.length !== 1 ? 's' : ''}, created ${plan.creates.length} new${enrichMsg}${notImportedMsg}.`);
      if (!auditSaved) {
        toast.error('The import was applied, but its audit record could not be saved.', { duration: 10000 });
      }
      if (enrichFailedCount > 0) {
        toast.error(
          `${enrichFailedCount} profile update${enrichFailedCount !== 1 ? 's' : ''} did not save. Attendance and points were recorded. Check those members' year, college and email in Admin → Members.`,
          { duration: 10000 },
        );
      }
      setStep('done');
    } catch (err: unknown) {
      const errorMessage = describeError(err);
      await recordImportAudit({
        status: 'failed',
        points: importPoints,
        createdMemberIdsByRowId,
        withheldEmailRowIds,
        createdAttendanceCount,
        enrichedMembersCount: 0,
        errorMessage,
      });
      const kept = Object.keys(createdByRowIdRef.current).length;
      toast.error(
        `Import failed: ${errorMessage}${kept ? ` ${kept} new member${kept !== 1 ? 's were' : ' was'} already created; retrying reuses ${kept !== 1 ? 'them' : 'it'} without duplicating.` : ''}`,
        { duration: 10000 },
      );
    } finally {
      setImporting(false);
    }
  }

  /** Returns false when the audit record could not be saved. */
  async function recordImportAudit({
    status,
    points,
    createdMemberIdsByRowId,
    withheldEmailRowIds,
    createdAttendanceCount,
    enrichedMembersCount,
    errorMessage,
  }: {
    status: ImportJobStatus;
    points: number;
    createdMemberIdsByRowId: Record<string, string>;
    withheldEmailRowIds: ReadonlySet<string>;
    createdAttendanceCount: number;
    enrichedMembersCount: number;
    errorMessage?: string;
  }): Promise<boolean> {
    if (!selectedEventId || rows.length === 0) return true;

    try {
      const { data: authData } = await supabase.auth.getUser();
      const resolvedRows = rows.map(row => ({ row, resolved: resolveRow(row, decisionContext) }));
      // Rows that resolve to a member another row already credits write nothing of their own.
      const crediting = new Set(planAttendanceWrites(rows, decisionContext, matchedMembersSnapshot).updates.map(u => u.row.rowId));
      const rowInserts = resolvedRows.map(({ row, resolved }) => {
        const effectiveStatus = resolved.status;
        const createdMemberId = effectiveStatus === 'new' ? createdMemberIdsByRowId[row.rowId] ?? null : null;
        const attendanceMemberId =
          effectiveStatus === 'match' && crediting.has(row.rowId)
            ? resolved.member?.id ?? null
            : effectiveStatus === 'new'
              ? createdMemberId
              : null;
        const finalReason =
          effectiveStatus === 'review' ? 'skipped_unresolved_review'
            : effectiveStatus === 'skipped' ? 'skipped_by_admin'
              : effectiveStatus === 'invalid' ? 'invalid_row_no_name'
                : effectiveStatus === 'match' && !crediting.has(row.rowId) ? 'duplicate_member_in_file'
                  : row.reason;

        return {
          source_row_index: row.originalIndex,
          raw_row: asJson(row.csvRow),
          display_name: row.displayName || null,
          csv_email: row.csvEmail || null,
          csv_college: row.csvCollege || null,
          csv_year: row.csvYear || null,
          matched_member_id: resolved.member?.id ?? null,
          created_member_id: createdMemberId,
          event_id: selectedEventId,
          attendance_member_id: attendanceMemberId,
          points_earned: status === 'completed' && attendanceMemberId && (effectiveStatus === 'match' || effectiveStatus === 'new') ? points : null,
          decision: decisionFromRowStatus(effectiveStatus),
          status: 'recorded' as const,
          score: row.score || null,
          match_details: asJson({
            original_status: row.status,
            effective_status: effectiveStatus,
            manual_decision: row.decision,
            suggested_member_id: row.matchedMember?.id ?? null,
            email_withheld: withheldEmailRowIds.has(row.rowId),
            match_reason: row.reason,
            final_reason: finalReason,
            match_method: row.method,
            note: row.note,
            match_name: row.matchName,
            name_score: row.nameScore,
            college_match: row.collegeMatch,
            year_match: row.yearMatch,
            invalid_year: row.invalidYear,
            email_is_school_email: row.emailIsSchoolEmail,
            email_already_used: row.emailAlreadyUsed,
            can_force_match: row.canForceMatch,
            can_mark_new: row.canMarkNew,
            candidate_member_ids: row.candidateMemberIds,
            duplicate_row_of: row.duplicateRowOf,
            enriched_members_count: enrichedMembersCount,
          }),
          error_message: null,
        };
      });
      const countOf = (...statuses: EffectiveStatus[]) =>
        resolvedRows.filter(({ resolved }) => statuses.includes(resolved.status)).length;

      await importJobsRepository.createJob({
        event_id: selectedEventId,
        source_url: csvSource === 'file' ? null : csvUrl.trim() || null,
        source_type: csvSource === 'file' ? 'manual' : getImportSourceType(csvUrl),
        total_rows: rows.length,
        matched_rows: resolvedRows.filter(({ row, resolved }) => resolved.status === 'match' && crediting.has(row.rowId)).length,
        created_members: Object.keys(createdMemberIdsByRowId).length,
        created_attendance_count: createdAttendanceCount,
        skipped_duplicate_rows: countOf('already', 'duplicate'),
        review_rows: countOf('review', 'skipped', 'invalid'),
        error_count: errorMessage ? rows.length : 0,
        error_message: errorMessage ?? null,
        created_by: authData.user?.id ?? null,
        completed_at: new Date().toISOString(),
        status,
        rows: rowInserts,
      });
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] });
      return true;
    } catch (auditError) {
      console.warn('Import audit logging failed', auditError);
      return false;
    }
  }

  // ── Counts ────────────────────────────────────────────────────────────────────
  const membersById = useMemo(() => new Map(matchedMembersSnapshot.map(m => [m.id, m])), [matchedMembersSnapshot]);
  const membersByEmail = useMemo(() => buildMemberLookupMaps(matchedMembersSnapshot).byEmail, [matchedMembersSnapshot]);
  const decisionContext: DecisionContext<Member> = useMemo(
    () => ({ membersById, alreadyMemberIds }),
    [membersById, alreadyMemberIds],
  );
  const resolved = (row: RowResult) => resolveRow(row, decisionContext);
  const displayedRows = [...rows].sort((a, b) => {
    const priorityDiff = getSortPriority(resolved(a).status, a, sortMode) - getSortPriority(resolved(b).status, b, sortMode);
    return priorityDiff !== 0 ? priorityDiff : a.originalIndex - b.originalIndex;
  });
  const selectedRows = rows.filter(r => r.selected);
  const allRowsSelected = rows.length > 0 && rows.every(r => r.selected);
  const summary = summarizeAttendanceImport(rows, decisionContext);
  const extras = {
    invalidYear: rows.filter(r => r.invalidYear).length,
    enrich: rows.filter(r => {
      const { status, member } = resolved(r);
      return status === 'match' && !!member && Object.keys(getSafeAttendanceMemberEnrichment({ ...r, matchedMember: member }, matchedMembersSnapshot, { adminConfirmed: r.status === 'review' })).length > 0;
    }).length,
  };
  const totalNewMembers = summary.newMembers;
  // A changed unresolved count is a different decision to acknowledge.
  useEffect(() => { setAckPartial(false); }, [summary.unresolved]);
  const selectedEvent = events.find(e => e.id === selectedEventId);
  const selectedTerm = selectedEvent?.academic_term_id ? terms[selectedEvent.academic_term_id] : undefined;
  const selectedEventMissingTerm = !!selectedEvent && !selectedEvent.academic_term_id;

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Import Attendance" />
      <Toaster position="top-right" />

      <div className="border-b" style={{ padding: '20px 28px 16px', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>Import Attendance</h1>
        <p className="font-sans text-xs mt-0.5" style={{ color: 'var(--color-text2)' }}>
          Match CSV attendance rows to members before applying points.
        </p>
      </div>

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="border rounded-md p-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="mb-8">
            <h2 className="font-sans font-semibold text-base tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>Sheet Setup</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text2)' }}>
              Upload a local CSV or paste a Google Sheets CSV link. Safe matched and new rows import after preview; unresolved review rows are skipped until resolved.
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-8">
            {(['configure', 'preview', 'done'] as Step[]).map((s, i) => {
              const past = (s === 'configure' && (step === 'preview' || step === 'done')) ||
                           (s === 'preview' && step === 'done');
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                    ${step === s ? 'bg-brand-600 text-white' : past ? 'bg-emerald-500 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-[var(--color-text3)]'}`}>
                    {past ? '✓' : i + 1}
                  </div>
                  <span className={`text-sm font-medium capitalize
                    ${step === s ? 'text-brand-600 dark:text-brand-400' : 'text-[var(--color-text3)] dark:text-[var(--color-text3)]'}`}>
                    {s === 'configure' ? 'Configure' : s === 'preview' ? 'Preview' : 'Done'}
                  </span>
                  {i < 2 && <div className="w-8 h-px bg-zinc-200 dark:bg-zinc-700 mx-1" />}
                </div>
              );
            })}
          </div>

          {/* ── Step 1 ── */}
          {step === 'configure' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <label htmlFor="import-event" className="block text-xs font-medium text-[var(--color-text3)] uppercase tracking-label mb-1.5">Event *</label>
                <select id="import-event" disabled={fetchingCsv} value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}
                  className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900
                    text-[var(--color-text)] px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500">
                  <option value="">— Select an event —</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} — {new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ({ev.points} pts) {ev.academic_term_id ? `[${terms[ev.academic_term_id]?.label || '...'}]` : '[No academic term]'}
                    </option>
                  ))}
                </select>
                {selectedEvent?.academic_term_id && (
                  <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    This import will count toward {getAcademicYearLabel(selectedTerm)}
                    {selectedTerm ? ` (${selectedTerm.label}).` : '.'}
                  </p>
                )}
                {selectedEventMissingTerm && (
                  <div className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                    Import blocked: this event has no academic term assigned. Assign a term in Admin Events before importing attendance.
                  </div>
                )}
              </div>

              <fieldset disabled={fetchingCsv} className="space-y-3 text-sm text-text-primary">
                <legend className="mb-2 font-medium">CSV source</legend>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="csv-source" checked={csvSource === 'url'} onChange={() => { setCsvSource('url'); setConfigError(''); }} />
                    Google Sheets / CSV URL
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="csv-source" checked={csvSource === 'file'} onChange={() => { setCsvSource('file'); setConfigError(''); }} />
                    Local CSV file
                  </label>
                </div>
                {csvSource === 'file' ? (
                  <div key="file">
                    <label htmlFor="attendance-csv" className="mb-1.5 block font-medium">CSV file</label>
                    <Input id="attendance-csv" type="file" accept=".csv,text/csv" onChange={e => { setCsvFile(e.target.files?.[0] ?? null); setConfigError(''); }} />
                    {csvFile && <p className="mt-2 break-all text-xs text-text-secondary">Selected: {csvFile.name}</p>}
                    <p className="mt-2 text-xs text-text-secondary">Google Form exports use the same column mapping and review as URL imports.</p>
                  </div>
                ) : (
                  <div key="url">
                    <label htmlFor="attendance-csv-url" className="mb-1.5 block font-medium">Google Sheets CSV URL *</label>
                    <Input id="attendance-csv-url" type="url" value={csvUrl} onChange={e => setCsvUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." />
                    <p className="mt-2 text-xs text-text-secondary">
                      File → Share → Publish to web → CSV. Or paste the edit URL — we convert it automatically.
                    </p>
                  </div>
                )}
              </fieldset>

              {configError && (
                <div role="alert" className="rounded border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
                  {configError}
                </div>
              )}

              <Button onClick={handleFetchCsv} loading={fetchingCsv} disabled={selectedEventMissingTerm}>
                {fetchingCsv ? 'Loading…' : csvSource === 'file' ? 'Load & Preview' : 'Fetch & Preview'}
              </Button>
            </div>
          )}

          {/* ── Step 2 ── */}
          {step === 'preview' && (
            <div className="space-y-6">
              {/* Column mapping */}
              <div className="bg-zinc-50 dark:bg-zinc-900/60 rounded-md p-5 border border-[var(--color-border)]">
                <h2 className="text-xs font-semibold text-[var(--color-text3)] uppercase tracking-label mb-4">Column Mapping</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="col-span-2 sm:col-span-1 flex items-end">
                    <label className="flex items-center gap-1.5 text-xs text-[var(--color-text3)] cursor-pointer select-none">
                      <input type="checkbox" checked={useFullName} onChange={e => setUseFullName(e.target.checked)} className="rounded" />
                      Use single "full name" column
                    </label>
                  </div>
                  {useFullName
                    ? <ColSelect label="Full name"  value={fullNameCol}  onChange={setFullNameCol}  headers={csvHeaders} />
                    : <><ColSelect label="First name" value={firstNameCol} onChange={setFirstNameCol} headers={csvHeaders} />
                        <ColSelect label="Last name"  value={lastNameCol}  onChange={setLastNameCol}  headers={csvHeaders} /></>}
                  <ColSelect label="College" value={collegeCol} onChange={setCollegeCol} headers={csvHeaders} />
                  <ColSelect label="Year"    value={yearCol}    onChange={setYearCol}    headers={csvHeaders} />
                  <ColSelect label="Email"   value={emailCol}   onChange={setEmailCol}   headers={csvHeaders} />
                </div>
                <button onClick={handleRematch} disabled={fetchingCsv}
                  className="mt-3 text-xs text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50">
                  {fetchingCsv ? 'Re-matching…' : '↻ Re-run matching with these columns'}
                </button>
              </div>

              <ImportReviewPanel
                rows={reviewAttendanceRows(rows.map(r => ({
                  originalIndex: r.originalIndex,
                  displayName: r.displayName,
                  effectiveStatus: resolved(r).status,
                  reason: r.reason,
                  note: r.note,
                  invalidYear: r.invalidYear,
                  candidateCount: r.candidateMemberIds.length,
                  csvYear: r.csvYear,
                  csvRow: r.csvRow,
                })))}
                hasInput
                filename="attendance-import-problem-rows"
              />

              {/* Summary */}
              <section aria-label="Import summary" className="rounded-md border border-[var(--color-border)] p-4">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-label text-[var(--color-text3)]">Before you confirm</h2>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <SummaryStat label="Valid source rows" value={summary.validRows} />
                  <SummaryStat label="Existing members receiving attendance" value={summary.existingMembers} tone="green" />
                  <SummaryStat label="New members being created" value={summary.newMembers} tone="blue" />
                  <SummaryStat label="Already recorded" value={summary.alreadyRecorded} />
                  <SummaryStat label="Duplicate rows skipped" value={summary.duplicatesSkipped} />
                  <SummaryStat label="Unresolved identity matches" value={summary.unresolved} tone={summary.unresolved > 0 ? 'amber' : undefined} />
                  <SummaryStat label="Skipped by you" value={summary.skipped} />
                  {summary.invalid > 0 && <SummaryStat label="Rows without a name" value={summary.invalid} tone="red" />}
                </dl>
                <div className="mt-3 flex flex-wrap gap-3">
                  {extras.invalidYear > 0 && (
                    <SummaryBadge color="red" count={extras.invalidYear} label="year unrecognized, review manually" plural="years unrecognized, review manually" />
                  )}
                  {extras.enrich > 0 && (
                    <SummaryBadge color="purple" count={extras.enrich} label="profile will be enriched" plural="profiles will be enriched" />
                  )}
                </div>
              </section>

              {summary.unresolved > 0 && (
                <div role="alert" className="rounded-md border border-amber-400 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
                  <p className="font-medium">
                    {summary.unresolved} row{summary.unresolved !== 1 ? 's' : ''} still need{summary.unresolved === 1 ? 's' : ''} a decision. Choose Match Existing, Create New Member, or Skip for each.
                  </p>
                  <label className="mt-2 flex items-start gap-2">
                    <input type="checkbox" checked={ackPartial} onChange={e => setAckPartial(e.target.checked)} className="mt-0.5 rounded" />
                    <span>
                      I understand {summary.unresolved} unresolved row{summary.unresolved !== 1 ? 's' : ''} will not be imported and no attendance or points will be recorded for them. They stay in the import audit so I can re-import the sheet later.
                    </span>
                  </label>
                </div>
              )}

              <div className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] bg-zinc-50 dark:bg-zinc-900/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-zinc-600 dark:text-zinc-300">
                  {selectedRows.length === 0
                    ? 'Select rows to apply a decision to several at once. Matching an existing member is always chosen row by row.'
                    : `${selectedRows.length} row${selectedRows.length !== 1 ? 's' : ''} selected.`}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => applyDecisionToSelected('new')}
                    disabled={selectedRows.length === 0}
                    className="inline-flex items-center gap-2 rounded border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm font-medium text-[var(--color-text2)] transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Create New for Selected
                  </button>
                  <button
                    onClick={() => applyDecisionToSelected('skip')}
                    disabled={selectedRows.length === 0}
                    className="inline-flex items-center gap-2 rounded border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm font-medium text-[var(--color-text2)] transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Skip Selected
                  </button>
                  <button
                    onClick={() => applyDecisionToSelected('clear')}
                    disabled={selectedRows.length === 0}
                    className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-[var(--color-text3)] transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Undo Selected
                  </button>
                </div>
              </div>

              {selectedEvent && (
                <div className="space-y-1">
                  <p className="text-sm text-[var(--color-text3)]">
                    Each matched or new member gets <strong className="text-[var(--color-text2)]">{selectedEvent.points} pt{selectedEvent.points !== 1 ? 's' : ''}</strong> for <strong className="text-[var(--color-text2)]">{selectedEvent.name}</strong>.
                  </p>
                  {selectedEvent.academic_term_id && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      This import will count toward {getAcademicYearLabel(selectedTerm)}
                      {selectedTerm ? ` (${selectedTerm.label}).` : '.'}
                    </p>
                  )}
                  {selectedEventMissingTerm && (
                    <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                      Import blocked: this event has no academic term assigned. Assign a term in Admin Events before importing attendance.
                    </div>
                  )}
                </div>
              )}

              {/* Preview table */}
              <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900/60">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text3)] uppercase tracking-label whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={allRowsSelected}
                          onChange={toggleSelectAllRows}
                          className="rounded"
                          aria-label="Select all rows"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text3)] uppercase tracking-label whitespace-nowrap">
                        <button type="button" onClick={toggleActionSort} className="inline-flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-200">
                          Action
                          <span className="text-[10px] normal-case">
                            {sortMode === 'review-first' ? 'Review first' : sortMode === 'review-last' ? 'Review last' : 'Default'}
                          </span>
                        </button>
                      </th>
                      {['CSV Name', 'CSV College', 'CSV Year', 'Matched Member', 'Confidence'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text3)] uppercase tracking-label whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-[var(--color-surface)] divide-y divide-zinc-100 dark:divide-zinc-800">
                    {displayedRows.map((row) => {
                      const { status: effectiveStatus, member: resolvedMember } = resolved(row);
                      const candidates = row.candidateMemberIds
                        .map(id => membersById.get(id))
                        .filter((m): m is Member => !!m);
                      const emailHolders = row.csvEmail ? (membersByEmail.get(row.csvEmail) ?? []) : [];
                      const enrich = effectiveStatus === 'match' && !!resolvedMember && Object.keys(
                        getSafeAttendanceMemberEnrichment({ ...row, matchedMember: resolvedMember }, matchedMembersSnapshot, { adminConfirmed: row.status === 'review' }),
                      ).length > 0;

                      return (
                      <tr key={row.rowId} className={
                        effectiveStatus === 'match' ? 'bg-green-50/40 dark:bg-green-900/10' :
                        effectiveStatus === 'new'   ? 'bg-blue-50/40 dark:bg-blue-900/10' :
                        effectiveStatus === 'review'? 'bg-amber-50/60 dark:bg-amber-900/10' :
                                                      'bg-zinc-50/60 dark:bg-zinc-900/20'
                      }>
                        <td className="px-4 py-2.5 whitespace-nowrap align-top">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={() => toggleRowSelection(row.rowId)}
                            className="rounded"
                            aria-label={`Select ${row.displayName || 'row'}`}
                          />
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap align-top">
                          <ActionBadge
                            color={effectiveStatus === 'match' ? 'green' : effectiveStatus === 'new' ? 'blue' : effectiveStatus === 'review' ? 'amber' : 'gray'}
                            label={effectiveStatus === 'duplicate' ? 'Duplicate' : effectiveStatus === 'already' ? 'Skip' : getActionLabel(effectiveStatus, row)}
                          />
                          {enrich && (
                            <span className="ml-1 text-[10px] text-purple-500 dark:text-purple-400" title="Missing profile fields will be filled, and year advanced, during import">✉</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-[var(--color-text)] align-top">
                          <div>{row.displayName || <span className="text-[var(--color-text3)] italic">—</span>}</div>
                          {row.matchName !== row.displayName && (
                            <div className="text-[10px] text-[var(--color-text3)] mt-0.5">matched as: {row.matchName}</div>
                          )}
                          {row.csvEmail && <div className="text-[10px] text-[var(--color-text3)] mt-0.5">{row.csvEmail}</div>}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--color-text3)] text-xs align-top">{row.csvCollege || '—'}</td>
                        <td className="px-4 py-2.5 text-[var(--color-text3)] text-xs align-top">
                          {row.csvYear || '—'}
                          {row.invalidYear && (
                            <span className="ml-1 text-[10px] text-red-500 font-medium" title="Unrecognized year format">!</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300 align-top">
                          {(row.status === 'match' || row.status === 'already') && row.matchedMember && (
                            <div className={row.decision?.kind === 'new' ? 'line-through opacity-60' : undefined}>
                              <MemberIdentity member={row.matchedMember} />
                              {row.status === 'already' && <div className="text-[10px] text-[var(--color-text3)]">Attendance already recorded for this event.</div>}
                              {enrich && <div className="text-[10px] text-violet-500 dark:text-violet-400 mt-0.5">Profile fields will be filled or year advanced during import</div>}
                            </div>
                          )}
                          {row.status === 'new' && !row.decision && (
                            <span className="text-blue-500 dark:text-blue-400 text-xs italic">new member</span>
                          )}
                          {row.status === 'duplicate' && (
                            <span className="text-zinc-500 dark:text-zinc-400 text-xs italic">{row.note}</span>
                          )}
                          {effectiveStatus === 'invalid' && (
                            <span className="text-red-500 text-xs italic">No name — cannot be imported.</span>
                          )}
                          {row.status !== 'duplicate' && effectiveStatus !== 'invalid' && (
                            <div className="mt-1">
                              <AttendanceRowDecision
                                rowLabel={row.displayName || `row ${row.originalIndex + 2}`}
                                status={effectiveStatus}
                                rowStatus={row.status}
                                decision={row.decision}
                                note={row.note}
                                csvEmail={row.csvEmail}
                                canMatch={row.canForceMatch}
                                canCreateNew={canMarkAsNew(row, effectiveStatus)}
                                candidates={candidates}
                                emailHolders={emailHolders}
                                onDecide={decision => setRowDecision(row.rowId, decision)}
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap align-top">
                          {(row.status === 'match' || row.status === 'review') ? (
                            <span className={`text-xs font-mono font-semibold ${
                              row.status === 'review' ? 'text-amber-600 dark:text-amber-400' :
                              row.method === 'email' || row.method === 'exact_name' ? 'text-emerald-600 dark:text-emerald-400' :
                                                           'text-yellow-600 dark:text-yellow-400'
                            }`}>{row.score}%</span>
                          ) : row.status === 'new' ? (
                            <span className="text-xs text-[var(--color-text3)]">—</span>
                          ) : row.status === 'duplicate' ? (
                            <span className="text-xs text-[var(--color-text3)]">duplicate row</span>
                          ) : (
                            <span className="text-xs text-[var(--color-text3)]">already done</span>
                          )}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-[var(--color-text3)] dark:text-[var(--color-text3)]">
                Email is checked first. Near-name matches, conflicting emails and shared names always wait for your decision; nothing is matched or created for them automatically.
              </p>

              <div className="flex items-center gap-3 pt-2">
                <button onClick={handleImport}
                  disabled={importing || selectedEventMissingTerm || (summary.existingMembers + totalNewMembers) === 0 || (summary.unresolved > 0 && !ackPartial)}
                  className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40
                    text-white font-medium px-5 py-2.5 rounded text-sm transition-colors">
                  {importing
                    ? <><Spinner />Importing…</>
                    : <><CheckIcon />Import ({summary.existingMembers} update{summary.existingMembers !== 1 ? 's' : ''} + {totalNewMembers} new)</>}
                </button>
                <button onClick={() => { setStep('configure'); setRows([]); createdByRowIdRef.current = {}; withheldEmailRowIdsRef.current = new Set(); setAckPartial(false); }}
                  className="text-sm text-[var(--color-text3)] hover:text-zinc-700 dark:hover:text-zinc-200 px-3 py-2.5">
                  ← Back
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3 ── */}
          {step === 'done' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckIcon className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-base font-semibold text-[var(--color-text)] mb-2">Import complete!</h2>
              <p className="text-[var(--color-text3)] text-sm mb-6">Points and new members have been added to the leaderboard.</p>
              {outcome && (
                <section aria-label="Final import summary" className="mx-auto mb-8 max-w-2xl rounded-md border border-[var(--color-border)] p-4 text-left">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-label text-[var(--color-text3)]">What was written</h3>
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <SummaryStat label="Existing members credited" value={outcome.creditedMembers} tone="green" />
                    <SummaryStat label="New members created" value={outcome.createdMembers} tone="blue" />
                    <SummaryStat label="Attendance records added" value={outcome.attendanceInserted} />
                    <SummaryStat label="Attendance already present" value={outcome.attendanceAlreadyPresent} />
                    <SummaryStat label="Profiles enriched" value={outcome.enrichedProfiles} />
                    <SummaryStat label="New members without email" value={outcome.emailsWithheld} />
                  </dl>
                  <h3 className="mb-3 mt-5 text-xs font-semibold uppercase tracking-label text-[var(--color-text3)]">What was not written</h3>
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <SummaryStat label="Skipped by you" value={outcome.skipped} />
                    <SummaryStat label="Unresolved, not imported" value={outcome.unresolved} tone={outcome.unresolved > 0 ? 'amber' : undefined} />
                    <SummaryStat label="Already recorded before" value={outcome.alreadyRecorded} />
                    <SummaryStat label="Duplicate rows" value={outcome.duplicatesSkipped} />
                    {outcome.invalid > 0 && <SummaryStat label="Rows without a name" value={outcome.invalid} tone="red" />}
                  </dl>
                  {(outcome.skipped > 0 || outcome.unresolved > 0) && (
                    <p className="mt-4 text-xs text-[var(--color-text3)]">
                      Skipped and unresolved rows are saved in Recent Imports below. Import the same sheet again to resolve them; people already credited are recognized and not counted twice.
                    </p>
                  )}
                </section>
              )}
              <button
                onClick={() => { setStep('configure'); setRows([]); setCsvUrl(''); setCsvFile(null); setSelectedEventId(''); setCachedParsed([]); setOutcome(null); createdByRowIdRef.current = {}; withheldEmailRowIdsRef.current = new Set(); }}
                className="bg-brand-600 hover:bg-brand-700 text-white font-medium px-5 py-2.5 rounded text-sm transition-colors">
                Import another sheet
              </button>
            </div>
          )}
        </div>
        <ImportAuditPanel />
        <HistoricalRecoveryPanel />
      </div>
    </div>
  );
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function ColSelect({ label, value, onChange, headers }: { label: string; value: string; onChange: (v: string) => void; headers: string[] }) {
  return (
    <div>
      <label className="block text-xs text-[var(--color-text3)] mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900
          text-[var(--color-text)] text-xs px-2 py-1.5 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500">
        <option value="">(none)</option>
        {headers.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
    </div>
  );
}

function SummaryBadge({ color, count, label, plural }: { color: string; count: number; label: string; plural: string }) {
  const cls: Record<string, string> = {
    green:  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    blue:   'bg-blue-100  dark:bg-blue-900/30  text-blue-700  dark:text-blue-300',
    red:    'bg-red-100   dark:bg-red-900/30   text-red-700   dark:text-red-300',
    gray:   'bg-gray-100  dark:bg-gray-700      text-gray-500  dark:text-gray-400',
    amber:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  };
  const dot: Record<string, string> = {
    green: 'bg-green-500', blue: 'bg-blue-500', red: 'bg-red-500', gray: 'bg-gray-400',
    amber: 'bg-amber-500', purple: 'bg-purple-500',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full font-medium ${cls[color]}`}>
      <span className={`w-2 h-2 rounded-full inline-block ${dot[color]}`} />
      {count} {count === 1 ? label : plural}
    </span>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'blue' | 'amber' | 'red' }) {
  const color = {
    green: 'text-green-700 dark:text-green-300',
    blue: 'text-blue-700 dark:text-blue-300',
    amber: 'text-amber-700 dark:text-amber-300',
    red: 'text-red-700 dark:text-red-300',
  };
  return (
    <div data-testid="summary-stat">
      <dt className="text-xs text-[var(--color-text3)]">{label}</dt>
      <dd className={`text-xl font-semibold ${tone ? color[tone] : 'text-[var(--color-text)]'}`}>{value}</dd>
    </div>
  );
}

function ActionBadge({ color, label }: { color: string; label: string }) {
  const cls: Record<string, string> = {
    green: 'text-green-700 dark:text-green-400',
    blue:  'text-blue-700  dark:text-blue-400',
    gray:  'text-gray-500  dark:text-gray-400',
    amber: 'text-amber-700 dark:text-amber-400',
  };
  const dot: Record<string, string> = {
    green: 'bg-green-500', blue: 'bg-blue-500', gray: 'bg-gray-400', amber: 'bg-amber-500',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls[color]}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${dot[color]}`} />
      {label}
    </span>
  );
}

function Spinner() {
  return <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>;
}

function CheckIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
}
