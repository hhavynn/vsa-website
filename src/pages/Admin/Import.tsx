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
import toast, { Toaster } from 'react-hot-toast';
import { useQueryClient } from 'react-query';
import { parseCsvTable } from '../../lib/csvParse';
import {
  AttendanceColumnMapping,
  EMPTY_ATTENDANCE_MAPPING,
  attendanceMappingProblem,
  buildAttendanceRows,
  detectAttendanceColumns,
} from '../../lib/attendanceCsv';
import {
  AttendanceImportResult,
  ImportProblemKind,
  RosterMember,
  memberIdentityRepository,
} from '../../data/repos/memberIdentity';
import { PageTitle } from '../../components/common/PageTitle';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ImportAuditPanel } from '../../components/features/admin/ImportAuditPanel';
import { HistoricalRecoveryPanel } from '../../components/features/admin/HistoricalRecoveryPanel';
import { asJson, decisionFromRowStatus, importJobsRepository } from '../../data/repos/importJobs';
import { ImportJobStatus } from '../../types/database';
import { AttendanceRowDecision, EvidenceList, MemberIdentity } from '../../components/features/admin/AttendanceRowDecision';
import {
  DecisionContext,
  DecisionRow,
  EffectiveStatus,
  RowDecision,
  hasImportableName,
  planAttendanceImport,
  planTotals,
  rememberEmailByDefault,
  resolveRow,
  rowNeedsAdmin,
  summarizeAttendanceImport,
  toImportRequest,
} from '../../lib/attendanceImportDecisions';
import { IdentityAlias, IdentityReason, resolveAttendanceIdentities } from '../../lib/identityResolution';
import { identityLabel } from '../../lib/attendanceImportLabels';
import { normalizeEmail } from '../../lib/memberMatching';
import type { YearObservation } from '../../lib/yearStanding';

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

type Member = RosterMember;
type SortMode = 'default' | 'review-first' | 'review-last';

type RowResult = DecisionRow<Member> & { selected: boolean };

/** Everything the preview matched against, read completely or not at all. */
interface IdentitySnapshotState {
  members: Member[];
  aliases: IdentityAlias[];
  observations: YearObservation[];
  attendedMemberIds: Set<string>;
  eventAcademicYear: number | null;
}

interface ImportOutcome {
  totalRows: number;
  validRows: number;
  creditedMembers: number;
  attendanceInserted: number;
  attendanceAlreadyPresent: number;
  createdMembers: number;
  emailsWithheld: number;
  aliasesAdded: number;
  yearsAdvanced: number;
  profileFills: number;
  alreadyRecorded: number;
  duplicatesSkipped: number;
  skipped: number;
  unresolved: number;
  invalid: number;
}

const MISSING_TERM_IMPORT_MESSAGE = 'This event has no academic term assigned. Assign a term in Admin Events before importing attendance.';

const EMPTY_SNAPSHOT: IdentitySnapshotState = {
  members: [], aliases: [], observations: [], attendedMemberIds: new Set(), eventAcademicYear: null,
};

const PROBLEM_TEXT: Record<ImportProblemKind, string> = {
  event_missing: 'The event no longer exists.',
  event_has_no_term: 'The event no longer has an academic term.',
  event_changed: 'The event\'s points or academic term changed after this preview.',
  member_missing: 'A matched member was deleted or merged after this preview.',
  member_changed: 'A matched member\'s name, college or email was edited after this preview.',
  email_owned_by_other: 'An email in this import now belongs to a different member.',
  email_held_by_other: 'Another member now has an email this import would use.',
  possible_duplicate_created: 'A member with the same name appeared after this preview (perhaps from another import), so a new member may be a duplicate or a name match may no longer be unique.',
  already_applied: 'An earlier attempt of this import was already applied. Check Recent Imports before importing again.',
};

function getAcademicYearLabel(term: AcademicTerm | undefined): string {
  if (!term) return 'its assigned academic year';
  return `${term.academic_year_start}–${term.academic_year_end}`;
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

/** The audit's match_method, kept in the vocabulary importHistoryAudit.ts reads. */
function auditMethod(row: RowResult): 'email' | 'exact_name' | 'fuzzy_name' | 'new' | 'none' {
  const byReason: Partial<Record<IdentityReason, 'email' | 'exact_name' | 'fuzzy_name'>> = {
    known_email: 'email',
    name_college_year: 'exact_name',
    name_college: 'exact_name',
    unique_name: 'exact_name',
    middle_name_college_year: 'fuzzy_name',
  };
  if (row.status === 'new') return 'new';
  return byReason[row.reason] ?? (row.candidates.length > 0 ? 'fuzzy_name' : 'none');
}

// ─── Source helpers ───────────────────────────────────────────────────────────

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

function newRequestId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.floor(Math.random() * 16);
      return (c === 'x' ? r : (r % 4) + 8).toString(16);
    });
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
  const [mapping, setMapping] = useState<AttendanceColumnMapping>(EMPTY_ATTENDANCE_MAPPING);
  const [duplicateHeaders, setDuplicateHeaders] = useState<string[]>([]);
  // Matching could not run (mapping problem or an incomplete read). Blocks the import.
  const [matchError, setMatchError] = useState('');
  // The database refused a stale preview; nothing was written. Re-run matching to continue.
  const [staleProblems, setStaleProblems] = useState<{ kind: ImportProblemKind; rowLabel: string | null }[]>([]);

  // Preview
  const [rows, setRows] = useState<RowResult[]>([]);
  const [cachedParsed, setCachedParsed] = useState<Record<string, string>[]>([]);
  const [snapshot, setSnapshot] = useState<IdentitySnapshotState>(EMPTY_SNAPSHOT);
  const [importing, setImporting] = useState(false);
  const [ackPartial, setAckPartial] = useState(false);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  // Reused when a confirmation's response was lost, so the retry replays instead of writing twice.
  const requestIdRef = useRef<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('default');

  useEffect(() => {
    async function loadData() {
      const [{ data: eventsData, error: eventsError }, { data: termsData, error: termsError }] = await Promise.all([
        supabase.from('events').select('id, name, date, points, academic_term_id').order('date', { ascending: false }),
        supabase.from('academic_terms').select('id, label, academic_year_start, academic_year_end'),
      ]);
      if (eventsError || termsError) {
        setConfigError('Could not load events and academic terms. Reload the page before importing.');
      }
      setEvents((eventsData ?? []) as Event[]);
      const termMap: Record<string, AcademicTerm> = {};
      (termsData ?? []).forEach((t: AcademicTerm) => { termMap[t.id] = t; });
      setTerms(termMap);
    }
    loadData();
  }, []);

  function setColumn<K extends keyof AttendanceColumnMapping>(key: K, value: AttendanceColumnMapping[K]) {
    setMapping(current => ({ ...current, [key]: value }));
  }

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
      const table = parseCsvTable(raw);
      // A quote that never closes swallows every later line into one cell; never import that reading.
      if (table.unterminatedQuote) {
        throw new Error(`a quotation mark opened on line ${table.unterminatedQuoteLine} is never closed, so the rows after it would be read as one cell. Fix or re-export the file and try again.`);
      }
      if (!table.rows.length) throw new Error('No data rows found in CSV.');

      const detected = detectAttendanceColumns(table.headers);
      setCsvHeaders(table.headers);
      setDuplicateHeaders(table.duplicateHeaders);
      setCachedParsed(table.rows);
      setMapping(detected);

      await runMatching(table.rows, detected, selectedEventId);
      setStep('preview');
    } catch (err: unknown) {
      setConfigError(`Failed to load CSV: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setFetchingCsv(false);
    }
  }

  // ── Matching engine ───────────────────────────────────────────────────────────
  async function runMatching(parsed: Record<string, string>[], columns: AttendanceColumnMapping, eventId: string) {
    setAckPartial(false);
    setMatchError('');
    setStaleProblems([]);
    requestIdRef.current = null;

    const event = events.find(e => e.id === eventId);
    const eventAcademicYear = event?.academic_term_id ? terms[event.academic_term_id]?.academic_year_start ?? null : null;
    const problem = attendanceMappingProblem(columns, Object.keys(parsed[0] ?? {}));
    let next: IdentitySnapshotState;
    try {
      if (problem) throw new Error(problem);
      // Every read is complete or throws: an unread member or address must never look unknown.
      const [members, attendedMemberIds, aliases, observations] = await Promise.all([
        memberIdentityRepository.loadRoster(),
        memberIdentityRepository.loadEventAttendeeIds(eventId),
        memberIdentityRepository.loadIdentityEmails(),
        memberIdentityRepository.loadYearObservations(),
      ]);
      next = { members, aliases, observations, attendedMemberIds, eventAcademicYear };
    } catch (err: unknown) {
      setMatchError(describeError(err));
      setRows([]);
      setSnapshot(EMPTY_SNAPSHOT);
      return;
    }

    const results = resolveAttendanceIdentities(buildAttendanceRows(parsed, columns), next)
      .map((result): RowResult => ({ ...result, selected: false, decision: null }));
    setSnapshot(next);
    setRows(results);
    setSortMode('default');
  }

  async function handleRematch() {
    setFetchingCsv(true);
    try {
      await runMatching(cachedParsed, mapping, selectedEventId);
    } finally {
      setFetchingCsv(false);
    }
  }

  // ── Derived plan ──────────────────────────────────────────────────────────────
  const membersById = useMemo(() => new Map(snapshot.members.map(m => [m.id, m])), [snapshot.members]);
  const heldEmails = useMemo(() => {
    const held = new Set(snapshot.aliases.map(a => normalizeEmail(a.email)));
    snapshot.members.forEach(m => { const e = normalizeEmail(m.email); if (e) held.add(e); });
    return held;
  }, [snapshot]);
  const emailHoldersByEmail = useMemo(() => {
    const holders = new Map<string, Member[]>();
    const add = (email: string, member: Member | undefined) => {
      if (!email || !member) return;
      const list = holders.get(email) ?? [];
      if (!list.includes(member)) holders.set(email, [...list, member]);
    };
    snapshot.members.forEach(m => add(normalizeEmail(m.email), m));
    snapshot.aliases.forEach(a => add(normalizeEmail(a.email), membersById.get(a.member_id)));
    return holders;
  }, [snapshot, membersById]);
  const rowsById = useMemo(() => new Map(rows.map(r => [r.rowId, r])), [rows]);
  const decisionContext: DecisionContext<Member> = useMemo(
    () => ({ membersById, alreadyMemberIds: snapshot.attendedMemberIds, rowsById }),
    [membersById, snapshot.attendedMemberIds, rowsById],
  );
  const plan = useMemo(
    () => planAttendanceImport(rows, decisionContext, {
      heldEmails, observations: snapshot.observations, eventAcademicYear: snapshot.eventAcademicYear,
    }),
    [rows, decisionContext, heldEmails, snapshot.observations, snapshot.eventAcademicYear],
  );
  const totals = useMemo(() => planTotals(plan), [plan]);
  const summary = useMemo(() => summarizeAttendanceImport(rows, decisionContext), [rows, decisionContext]);
  const resolved = (row: RowResult) => resolveRow(row, decisionContext);

  // ── Confirm import ────────────────────────────────────────────────────────────
  async function handleImport() {
    if (matchError || staleProblems.length) {
      toast.error('Re-run matching before importing.');
      return;
    }
    if (summary.unresolved > 0 && !ackPartial) {
      toast.error('Acknowledge the unresolved rows, or resolve them, before importing.');
      return;
    }
    if (plan.credits.length + plan.creates.length === 0) {
      toast.error(summary.unresolved || summary.duplicatesSkipped || summary.skipped ? 'No rows to import.' : 'Nothing to import.');
      return;
    }
    const event = events.find(e => e.id === selectedEventId);
    if (!event?.academic_term_id) {
      toast.error(MISSING_TERM_IMPORT_MESSAGE);
      return;
    }

    setImporting(true);
    requestIdRef.current = requestIdRef.current ?? newRequestId();
    try {
      const result = await memberIdentityRepository.applyAttendanceImport(toImportRequest(plan, {
        requestId: requestIdRef.current,
        eventId: selectedEventId,
        expectedPoints: event.points ?? null,
        expectedTermId: event.academic_term_id,
      }));

      if (!result.ok) {
        // Nothing was written. The next attempt is a new request against fresh data.
        requestIdRef.current = null;
        setStaleProblems(result.problems.map(p => ({
          kind: p.kind,
          rowLabel: p.row_key ? (rowsById.get(p.row_key)?.displayName || null) : null,
        })));
        toast.error('Nothing was imported: the data changed after this preview. Re-run matching and review again.', { duration: 10000 });
        return;
      }

      requestIdRef.current = null;
      const auditSaved = await recordImportAudit('completed', event.points ?? 1, result);
      setOutcome({
        totalRows: rows.length,
        validRows: summary.validRows,
        creditedMembers: totals.creditedMembers,
        attendanceInserted: result.attendance_inserted,
        attendanceAlreadyPresent: result.attendance_already_present.length,
        createdMembers: result.created.length,
        emailsWithheld: totals.emailsWithheld,
        aliasesAdded: result.aliases_added,
        yearsAdvanced: result.years_advanced,
        profileFills: result.profile_fills,
        alreadyRecorded: summary.alreadyRecorded,
        duplicatesSkipped: summary.duplicatesSkipped,
        skipped: summary.skipped,
        unresolved: summary.unresolved,
        invalid: summary.invalid,
      });
      const notImported = summary.unresolved + summary.skipped + summary.duplicatesSkipped;
      toast.success(
        `Done! Recorded ${result.attendance_inserted} attendance${result.attendance_inserted !== 1 ? ' records' : ' record'}, created ${result.created.length} new member${result.created.length !== 1 ? 's' : ''}`
          + `${notImported ? `, not imported: ${notImported} row${notImported !== 1 ? 's' : ''}` : ''}${result.replayed ? ' (already applied)' : ''}.`,
      );
      if (!auditSaved) toast.error('The import was applied, but its audit record could not be saved.', { duration: 10000 });
      if (result.years_skipped.length) {
        toast.error(`${result.years_skipped.length} year update${result.years_skipped.length !== 1 ? 's were' : ' was'} skipped because the member's year changed after this preview.`, { duration: 10000 });
      }
      queryClient.invalidateQueries();
      setStep('done');
    } catch (err: unknown) {
      const errorMessage = describeError(err);
      if (/already used for a different import/i.test(errorMessage)) {
        // An earlier attempt committed, and the decisions changed since. Never send it again.
        requestIdRef.current = null;
        setStaleProblems([{ kind: 'already_applied', rowLabel: null }]);
        toast.error('An earlier attempt of this import was already applied. Check Recent Imports, then re-run matching before importing anything else.', { duration: 12000 });
        return;
      }
      // The response may have been lost after the database committed; retrying
      // sends the same request id, which returns the first result instead of writing again.
      await recordImportAudit('failed', event.points ?? 1, null, errorMessage);
      toast.error(`Import failed: ${errorMessage} If it actually finished, retrying returns that result instead of writing again.`, { duration: 10000 });
    } finally {
      setImporting(false);
    }
  }

  /** Returns false when the audit record could not be saved. */
  async function recordImportAudit(
    status: ImportJobStatus,
    points: number,
    result: Extract<AttendanceImportResult, { ok: true }> | null,
    errorMessage?: string,
  ): Promise<boolean> {
    if (!selectedEventId || rows.length === 0) return true;

    try {
      const { data: authData } = await supabase.auth.getUser();
      const createdByRow = new Map((result?.created ?? []).map(c => [c.row_key, c.member_id]));
      const alreadyPresent = new Set(result?.attendance_already_present ?? []);
      const creditByRow = new Map(plan.credits.map(c => [c.row.rowId, c]));
      const createByRow = new Map(plan.creates.map(c => [c.row.rowId, c]));
      const rowInserts = rows.map(row => {
        const resolvedRow = resolved(row);
        const effectiveStatus = resolvedRow.status;
        const credit = creditByRow.get(row.rowId);
        const create = createByRow.get(row.rowId);
        const createdMemberId = createdByRow.get(row.rowId) ?? null;
        const attendanceMemberId = credit && !credit.alreadyAttended ? credit.member.id : create ? createdMemberId : null;
        const finalReason =
          effectiveStatus === 'review' ? 'skipped_unresolved_review'
            : effectiveStatus === 'skipped' ? 'skipped_by_admin'
              : effectiveStatus === 'invalid' ? 'invalid_row_no_name'
                : effectiveStatus === 'match' && !credit ? 'duplicate_member_in_file'
                  : row.reason;

        return {
          source_row_index: row.originalIndex,
          raw_row: asJson(row.csvRow),
          display_name: row.displayName || null,
          csv_email: row.csvEmail || null,
          csv_college: row.csvCollege || null,
          csv_year: row.csvYear || null,
          matched_member_id: resolvedRow.member?.id ?? null,
          created_member_id: createdMemberId,
          event_id: selectedEventId,
          attendance_member_id: attendanceMemberId,
          points_earned: status === 'completed' && attendanceMemberId && !alreadyPresent.has(row.rowId) ? points : null,
          decision: decisionFromRowStatus(effectiveStatus),
          status: 'recorded' as const,
          score: null,
          match_details: asJson({
            original_status: row.status,
            effective_status: effectiveStatus,
            manual_decision: row.decision,
            suggested_member_id: row.matchedMember?.id ?? row.candidates[0]?.member.id ?? null,
            email_withheld: !!create?.emailWithheld,
            match_reason: row.reason,
            final_reason: finalReason,
            match_method: auditMethod(row),
            note: row.note,
            match_name: row.name.key,
            evidence: row.evidence.map(e => `${e.tone}: ${e.text}`),
            candidate_member_ids: row.candidateMemberIds,
            candidate_evidence: row.candidates.map(c => ({
              member_id: c.member.id, name: c.name, college: c.college, year: c.year, email: c.email,
            })),
            can_force_match: row.canForceMatch,
            can_mark_new: row.canMarkNew,
            invalid_year: row.invalidYear,
            duplicate_row_of: row.duplicateOf,
            aliases_planned: (credit?.aliases.length ?? 0) + (create?.aliases.length ?? 0) + (credit?.fill.email ? 1 : 0),
            year_advance: credit?.year ?? null,
            import_request_id: result?.request_id ?? null,
          }),
          error_message: null,
        };
      });
      const countOf = (...statuses: EffectiveStatus[]) => rows.filter(row => statuses.includes(resolved(row).status)).length;

      await importJobsRepository.createJob({
        event_id: selectedEventId,
        source_url: csvSource === 'file' ? null : csvUrl.trim() || null,
        source_type: csvSource === 'file' ? 'manual' : getImportSourceType(csvUrl),
        total_rows: rows.length,
        matched_rows: plan.credits.filter(c => !c.alreadyAttended).length,
        created_members: result?.created.length ?? 0,
        created_attendance_count: result?.attendance_inserted ?? 0,
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
  const displayedRows = useMemo(() => [...rows].sort((a, b) => {
    const priorityDiff = getSortPriority(resolveRow(a, decisionContext).status, a, sortMode) - getSortPriority(resolveRow(b, decisionContext).status, b, sortMode);
    return priorityDiff !== 0 ? priorityDiff : a.originalIndex - b.originalIndex;
  }), [rows, decisionContext, sortMode]);
  const selectedRows = rows.filter(r => r.selected);
  const allRowsSelected = rows.length > 0 && rows.every(r => r.selected);
  const yearAdvanceRows = useMemo(() => new Set(plan.credits.filter(c => c.year).map(c => c.row.rowId)), [plan]);
  const aliasRows = useMemo(() => new Map([
    ...plan.credits.map(c => [c.row.rowId, c.aliases.length + (c.fill.email ? 1 : 0)] as const),
    ...plan.creates.map(c => [c.row.rowId, c.aliases.length] as const),
  ]), [plan]);
  const conflictRows = useMemo(() => new Set(plan.aliasConflictRowIds), [plan]);
  // A changed unresolved count is a different decision to acknowledge.
  useEffect(() => { setAckPartial(false); }, [summary.unresolved]);
  const selectedEvent = events.find(e => e.id === selectedEventId);
  const selectedTerm = selectedEvent?.academic_term_id ? terms[selectedEvent.academic_term_id] : undefined;
  const selectedEventMissingTerm = !!selectedEvent && !selectedEvent.academic_term_id;
  const writes = plan.credits.filter(c => !c.alreadyAttended).length + plan.creates.length;

  function applyDecisionToSelected(kind: 'new' | 'skip' | 'clear') {
    setRows(current => current.map(row => {
      if (!row.selected) return row;
      if (kind === 'clear') return { ...row, decision: null };
      const status = resolveRow(row, decisionContext).status;
      if (kind === 'new') return canMarkAsNew(row, status) ? { ...row, decision: { kind: 'new' } } : row;
      return canSkipRow(row, status) ? { ...row, decision: { kind: 'skip' } } : row;
    }));
  }

  function canMarkAsNew(row: RowResult, status: EffectiveStatus): boolean {
    if (!hasImportableName(row) || status === 'duplicate' || status === 'invalid') return false;
    return row.canMarkNew || rowNeedsAdmin(row, decisionContext);
  }

  function canSkipRow(row: RowResult, status: EffectiveStatus): boolean {
    return hasImportableName(row) && status !== 'already' && status !== 'duplicate' && status !== 'invalid';
  }

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
                      <input type="checkbox" checked={mapping.useFullName} onChange={e => setColumn('useFullName', e.target.checked)} className="rounded" />
                      Use single "full name" column
                    </label>
                  </div>
                  {mapping.useFullName
                    ? <ColSelect label="Full name" value={mapping.fullName} onChange={v => setColumn('fullName', v)} headers={csvHeaders} />
                    : <><ColSelect label="First name" value={mapping.firstName} onChange={v => setColumn('firstName', v)} headers={csvHeaders} />
                        <ColSelect label="Last name" value={mapping.lastName} onChange={v => setColumn('lastName', v)} headers={csvHeaders} /></>}
                  <ColSelect label="College" value={mapping.college} onChange={v => setColumn('college', v)} headers={csvHeaders} />
                  <ColSelect label="Year" value={mapping.year} onChange={v => setColumn('year', v)} headers={csvHeaders} />
                  <ColSelect label="Email" value={mapping.email} onChange={v => setColumn('email', v)} headers={csvHeaders} />
                  <ColSelect label="Second email (optional)" value={mapping.secondaryEmail} onChange={v => setColumn('secondaryEmail', v)} headers={csvHeaders} />
                </div>
                {duplicateHeaders.length > 0 && (
                  <p className="mt-3 text-xs text-[var(--color-text3)]">
                    This file repeats the column{duplicateHeaders.length !== 1 ? 's' : ''} {duplicateHeaders.map(h => `"${h}"`).join(', ')}. Later copies are listed as "(2)", "(3)"; check the mapping uses the right one.
                  </p>
                )}
                <button onClick={handleRematch} disabled={fetchingCsv}
                  className="mt-3 text-xs text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50">
                  {fetchingCsv ? 'Re-matching…' : '↻ Re-run matching with these columns'}
                </button>
              </div>

              {matchError && (
                <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                  <p className="font-medium">Matching did not run, so nothing can be imported.</p>
                  <p className="mt-1">{matchError}</p>
                  <p className="mt-1 text-xs">Fix the column mapping or retry with ↻ Re-run matching. An incomplete member list is never used, because it would turn existing members into new duplicates.</p>
                </div>
              )}

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
                  <SummaryStat label="Matched automatically" value={summary.autoMatched} tone="green" />
                  <SummaryStat label="Matched by you" value={summary.adminConfirmed} tone="green" />
                  <SummaryStat label="New members being created" value={summary.newMembers} tone="blue" />
                  <SummaryStat label="Already recorded" value={summary.alreadyRecorded} />
                  <SummaryStat label="Duplicate rows skipped" value={summary.duplicatesSkipped} />
                  <SummaryStat label="Unresolved identity matches" value={summary.unresolved} tone={summary.unresolved > 0 ? 'amber' : undefined} />
                  <SummaryStat label="Skipped by you" value={summary.skipped} />
                  {summary.invalid > 0 && <SummaryStat label="Rows without a name" value={summary.invalid} tone="red" />}
                  <SummaryStat label="Profiles whose year will advance" value={totals.yearAdvances} />
                  <SummaryStat label="Email aliases to be added" value={totals.aliasesToAdd} />
                  {totals.aliasConflicts > 0 && <SummaryStat label="Email conflicts (not remembered)" value={totals.aliasConflicts} tone="amber" />}
                  {totals.emailsWithheld > 0 && <SummaryStat label="New members without their email" value={totals.emailsWithheld} tone="amber" />}
                </dl>
                <p className="mt-3 text-xs text-[var(--color-text3)]">
                  These counts are the exact write plan. Before writing, the database checks it again; if a member, email or the event changed since this preview, nothing is written and you are asked to re-run matching.
                </p>
              </section>

              {staleProblems.length > 0 && (
                <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                  <p className="font-medium">Nothing was imported. The data changed after this preview:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {staleProblems.map((p, i) => (
                      <li key={`${p.kind}-${i}`}>{PROBLEM_TEXT[p.kind]}{p.rowLabel ? ` (${p.rowLabel})` : ''}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs">Re-run matching to review the rows against the current data. Your decisions are cleared because the candidates may have changed.</p>
                </div>
              )}

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
                          Classification
                          <span className="text-[10px] normal-case">
                            {sortMode === 'review-first' ? 'Review first' : sortMode === 'review-last' ? 'Review last' : 'Default'}
                          </span>
                        </button>
                      </th>
                      {['CSV Name', 'CSV College', 'CSV Year', 'Member', 'Evidence'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text3)] uppercase tracking-label whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-[var(--color-surface)] divide-y divide-zinc-100 dark:divide-zinc-800">
                    {displayedRows.map((row) => {
                      const resolvedRow = resolved(row);
                      const effectiveStatus = resolvedRow.status;
                      const { label, tone } = identityLabel(row, resolvedRow);
                      const needsAdmin = rowNeedsAdmin(row, decisionContext);
                      const emailHolders = Array.from(new Set(row.emails.flatMap(e => emailHoldersByEmail.get(e) ?? [])));
                      const freshEmails = row.emails.filter(e => !heldEmails.has(e));
                      const remembered = aliasRows.get(row.rowId) ?? 0;

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
                        <td className="px-4 py-2.5 align-top">
                          <ActionBadge color={tone} label={label} />
                          <div className="mt-0.5 text-[10px] text-[var(--color-text3)]">Row {row.originalIndex + 2}</div>
                        </td>
                        <td className="px-4 py-2.5 font-medium text-[var(--color-text)] align-top">
                          <div>{row.displayName || <span className="text-[var(--color-text3)] italic">—</span>}</div>
                          {row.emails.map(email => (
                            <div key={email} className="text-[10px] text-[var(--color-text3)] mt-0.5">{email}</div>
                          ))}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--color-text3)] text-xs align-top">{row.csvCollege || '—'}</td>
                        <td className="px-4 py-2.5 text-[var(--color-text3)] text-xs align-top">
                          {row.csvYear || '—'}
                          {row.invalidYear && (
                            <span className="ml-1 text-[10px] text-red-500 font-medium" title="Unrecognized year format">!</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300 align-top">
                          {(effectiveStatus === 'match' || effectiveStatus === 'already') && resolvedRow.member && !resolvedRow.adminConfirmed && (
                            <MemberIdentity member={resolvedRow.member} />
                          )}
                          {effectiveStatus === 'duplicate' && (
                            <span className="text-zinc-500 dark:text-zinc-400 text-xs italic">{row.note}</span>
                          )}
                          {effectiveStatus === 'invalid' && (
                            <span className="text-red-500 text-xs italic">No name — cannot be imported.</span>
                          )}
                          {effectiveStatus !== 'duplicate' && effectiveStatus !== 'invalid' && (
                            <div className="mt-1">
                              <AttendanceRowDecision
                                rowLabel={row.displayName || `row ${row.originalIndex + 2}`}
                                status={effectiveStatus}
                                needsDecision={needsAdmin}
                                decision={row.decision}
                                note={needsAdmin && row.status === 'duplicate' ? `${row.note} That row is not being imported, so decide this one.` : row.note}
                                csvEmail={row.csvEmail}
                                freshEmails={freshEmails}
                                rememberByDefault={row.decision?.kind === 'match' ? rememberEmailByDefault(row, row.decision.memberId) : false}
                                canMatch={row.canForceMatch}
                                canCreateNew={canMarkAsNew(row, effectiveStatus)}
                                canSkip={canSkipRow(row, effectiveStatus)}
                                candidates={row.candidates}
                                suggestOnly={row.status === 'new'}
                                emailHolders={emailHolders}
                                onDecide={decision => setRowDecision(row.rowId, decision)}
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 align-top text-xs">
                          {effectiveStatus === 'match' && !resolvedRow.adminConfirmed && row.evidence.length > 0 && (
                            <EvidenceList notes={row.evidence} />
                          )}
                          {yearAdvanceRows.has(row.rowId) && (
                            <div className="mt-1 text-[11px] text-violet-600 dark:text-violet-400">Year will advance to {row.csvYear}</div>
                          )}
                          {remembered > 0 && (
                            <div className="mt-1 text-[11px] text-violet-600 dark:text-violet-400">
                              {remembered} email{remembered !== 1 ? 's' : ''} will be remembered for this member
                            </div>
                          )}
                          {conflictRows.has(row.rowId) && (
                            <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">Email also used by another person in this file; it will not be remembered.</div>
                          )}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-[var(--color-text3)] dark:text-[var(--color-text3)]">
                Automatic matches need one member supported by a known email, or by an exact name with nothing on file against it (the same college and a fitting year when the email differs). Shared names, similar names and any contradiction wait for your decision; spelling similarity only orders the suggestions.
              </p>

              <div className="flex items-center gap-3 pt-2">
                <button onClick={handleImport}
                  disabled={importing || !!matchError || staleProblems.length > 0 || selectedEventMissingTerm || writes === 0 || (summary.unresolved > 0 && !ackPartial)}
                  className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40
                    text-white font-medium px-5 py-2.5 rounded text-sm transition-colors">
                  {importing
                    ? <><Spinner />Importing…</>
                    : <><CheckIcon />Import ({summary.existingMembers} update{summary.existingMembers !== 1 ? 's' : ''} + {summary.newMembers} new)</>}
                </button>
                <button onClick={() => { setStep('configure'); setRows([]); setSnapshot(EMPTY_SNAPSHOT); requestIdRef.current = null; setStaleProblems([]); setAckPartial(false); }}
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
                    <SummaryStat label="Email aliases added" value={outcome.aliasesAdded} />
                    <SummaryStat label="Years advanced" value={outcome.yearsAdvanced} />
                    <SummaryStat label="Profiles filled" value={outcome.profileFills} />
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
                onClick={() => { setStep('configure'); setRows([]); setCsvUrl(''); setCsvFile(null); setSelectedEventId(''); setCachedParsed([]); setOutcome(null); setSnapshot(EMPTY_SNAPSHOT); requestIdRef.current = null; }}
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
    red:   'text-red-700 dark:text-red-400',
  };
  const dot: Record<string, string> = {
    green: 'bg-green-500', blue: 'bg-blue-500', gray: 'bg-gray-400', amber: 'bg-amber-500', red: 'bg-red-500',
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
