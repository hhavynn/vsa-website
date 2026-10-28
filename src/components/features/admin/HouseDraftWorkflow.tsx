// Protected domain — House membership. Entry point for the House assignment
// workflow. The default, primary path is "Import House Applications"
// (HousePlacementPanel): upload the Google Form responses CSV and generate a
// first-come, first-served placement draft. The older wide/long sheet importers
// stay available, collapsed under "Historical / Advanced Import", for
// re-importing a sort that was already decided by hand; they never run the
// timestamp-priority placement. Every path saves a private draft batch and
// never writes to house_memberships. Review, lock, and reveal live in
// HouseDraftEditor for every batch, automatic or manual.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { houseAssignmentsRepository, HouseBatchSnapshot } from '../../../data/repos/houseAssignments';
import { logAdminActivity } from '../../../data/repos/adminActivity';
import { useAuth } from '../../../hooks/useAuth';
import { useOperatingYear } from '../../../hooks/useOperatingYear';
import { useUnsavedChangesGuard } from '../../../hooks/useUnsavedChangesGuard';
import { ACTIVITY_ACTIONS } from '../../../lib/adminActivity';
import { findSameMemberTwice, findSameNameTwice } from '../../../lib/adminConflicts';
import { reviewHouseRows, summarizeImport } from '../../../lib/adminImportReview';
import { NextStep, nextStepFor } from '../../../lib/adminNextSteps';
import { describeYearContext } from '../../../lib/adminYearContext';
import { formatYearSpan } from '../../../lib/operationalStatus';
import { formatAcademicYear } from '../../../lib/academicTerms';
import { batchLineageLabel } from '../../../lib/housePayments';
import {
  HouseAssignmentBatch,
  draftInsertFromParsed,
} from '../../../lib/houseAssignmentDraft';
import {
  HouseImportMember,
  ParsedHouseRow,
  SheetFormat,
  buildEmailMap,
  parseLongRows,
  parseWideRows,
  profileMapByName,
} from '../../../lib/houseAssignmentImport';
import { HousePageAsset } from '../../../types';
import { HouseDraftEditor } from './HouseDraftEditor';
import { HousePlacementPanel, PlacementStage } from './HousePlacementPanel';
import { EmptyState, ImportReviewPanel, PossibleDuplicates, YearContextBadge } from './ops';

interface YearOption {
  start: number;
  label: string;
  isActive: boolean;
}

interface HouseDraftWorkflowProps {
  selectedYear: number | null;
  onYearChange: (year: number) => void;
  yearOptions: YearOption[];
  effectiveStartDate: string;
  onEffectiveStartDateChange: (value: string) => void;
  houseProfiles: HousePageAsset[];
  loadingProfiles: boolean;
  members: HouseImportMember[];
  loadingMembers: boolean;
  /** Reload members after a reveal refreshed the legacy members.house cache. */
  onMembershipsPublished: () => void;
}

const STEPS = ['Import', 'Match', 'Save draft', 'Review', 'Preflight', 'Lock', 'Reveal'] as const;
const PREVIEW_LIMIT = 50;

const fieldCls =
  'w-full rounded border bg-[var(--color-surface2)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]';
const labelCls = 'mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.1em]';

function statusLabel(status: string) {
  if (status === 'published') return 'Revealed';
  if (status === 'locked') return 'Locked';
  return 'Draft';
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap gap-2 px-4 pt-4 sm:px-6 lg:px-8" aria-label="House assignment steps">
      {STEPS.map((step, index) => (
        <li
          key={step}
          aria-current={index === current ? 'step' : undefined}
          className="rounded border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em]"
          style={{
            borderColor: 'var(--color-border)',
            background: index === current ? 'var(--color-surface2)' : 'transparent',
            color: index <= current ? 'var(--color-text)' : 'var(--color-text3)',
          }}
        >
          {index + 1}. {step}
        </li>
      ))}
    </ol>
  );
}

export function HouseDraftWorkflow({
  selectedYear,
  onYearChange,
  yearOptions,
  effectiveStartDate,
  onEffectiveStartDateChange,
  houseProfiles,
  loadingProfiles,
  members,
  loadingMembers,
  onMembershipsPublished,
}: HouseDraftWorkflowProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [batches, setBatches] = useState<HouseAssignmentBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [editor, setEditor] = useState<HouseBatchSnapshot | null>(null);
  const [opening, setOpening] = useState(false);

  // Only the collapsed historical importer uses a sheet format; there is no
  // legacy default anywhere else.
  const [legacyFormat, setLegacyFormat] = useState<SheetFormat>('wide');
  const [placementStage, setPlacementStage] = useState<PlacementStage>(0);
  const [csvUrl, setCsvUrl] = useState('');
  const [fetchingCsv, setFetchingCsv] = useState(false);
  const [rawInput, setRawInput] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [rows, setRows] = useState<ParsedHouseRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [editorNextStep, setEditorNextStep] = useState<NextStep | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [highlightRowId, setHighlightRowId] = useState<string | null>(null);
  const operatingYear = useOperatingYear();
  // An uploaded CSV or a pasted sheet that has not been saved as a draft yet is unsaved work.
  useUnsavedChangesGuard((rawInput.trim().length > 0 || placementStage > 0) && !editor, saving);

  const emailMap = useMemo(() => buildEmailMap(members), [members]);
  const houseProfilesByName = useMemo(() => profileMapByName(houseProfiles), [houseProfiles]);

  const loadBatches = useCallback(async () => {
    if (!selectedYear) {
      setBatches([]);
      return;
    }
    setLoadingBatches(true);
    try {
      setBatches(await houseAssignmentsRepository.listBatches(selectedYear));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load saved drafts.');
    } finally {
      setLoadingBatches(false);
    }
  }, [selectedYear]);

  useEffect(() => { loadBatches(); }, [loadBatches]);
  // Switching year closes the editor, unless it is already showing a batch from that year
  // (a Quick Search link switches the year and opens the batch together).
  useEffect(() => {
    setEditor((current) => (current && current.batch.academic_year_start === selectedYear ? current : null));
    setRows([]);
  }, [selectedYear]);

  const summary = useMemo(() => rows.reduce(
    (acc, row) => {
      acc[row.status] += 1;
      if (!row.houseProfile) acc.noHouse += 1;
      return acc;
    },
    { match: 0, review: 0, unmatched: 0, invalid: 0, noHouse: 0 },
  ), [rows]);

  const reviewRows = useMemo(() => reviewHouseRows(rows), [rows]);
  const importDuplicates = useMemo(() => {
    const usable = rows.filter((row) => row.matchedMember && (row.status === 'match' || row.status === 'review'));
    const identities = usable.map((row) => ({ id: row.rowId, label: row.name, memberId: row.matchedMember?.id ?? null }));
    const sameMember = findSameMemberTwice(identities, 'same_member_twice', 'row');
    const flagged = new Set(sameMember.flatMap((group) => group.items.map((item) => item.id)));
    const sameName = findSameNameTwice(rows.filter((row) => !flagged.has(row.rowId)).map((row) => ({ id: row.rowId, label: row.name })), 'near_identical_rows', 'row');
    return [...sameMember, ...sameName];
  }, [rows]);

  const currentStep = editor
    ? (editor.batch.status === 'draft' ? 3 : editor.batch.status === 'locked' ? 6 : 7)
    : rows.length > 0 ? 2 : rawInput.trim() ? 1 : placementStage;

  function handleParse() {
    try {
      const parsed = legacyFormat === 'wide'
        ? parseWideRows(rawInput, members, emailMap, houseProfilesByName)
        : parseLongRows(rawInput, members, emailMap, houseProfilesByName);
      setRows(parsed);
      if (parsed.length === 0) toast.error('No assignment rows were parsed.');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error && err.message ? `Failed to parse house assignment sheet. ${err.message}` : 'Failed to parse house assignment sheet.');
    }
  }

  async function handleFetchCsv() {
    if (!csvUrl.trim()) {
      toast.error('Enter a CSV URL first.');
      return;
    }
    setFetchingCsv(true);
    try {
      const response = await fetch(csvUrl.trim());
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setRawInput(await response.text());
      toast.success('CSV loaded.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to load CSV URL. Make sure it is publicly accessible.');
    } finally {
      setFetchingCsv(false);
    }
  }

  async function openBatch(batchId: string) {
    setOpening(true);
    try {
      setEditor(await houseAssignmentsRepository.loadSnapshot(batchId, new Map(members.map((m) => [m.id, `${m.first_name} ${m.last_name}`.trim()]))));
    } catch (err) {
      console.error(err);
      toast.error('Failed to open the draft.');
    } finally {
      setOpening(false);
    }
  }

  // Quick Search deep link: ?batch=<id>&row=<id> opens that batch and highlights the row.
  const batchParam = searchParams.get('batch');
  const rowParam = searchParams.get('row');
  const appliedBatch = useRef<string | null>(null);
  useEffect(() => {
    if (!batchParam || loadingMembers || !selectedYear || appliedBatch.current === batchParam) return;
    appliedBatch.current = batchParam;
    setOpening(true);
    houseAssignmentsRepository
      .loadSnapshot(batchParam, new Map(members.map((m) => [m.id, `${m.first_name} ${m.last_name}`.trim()])))
      .then((snapshot) => {
        if (snapshot.batch.academic_year_start !== selectedYear) onYearChange(snapshot.batch.academic_year_start);
        setHighlightRowId(rowParam);
        setEditor(snapshot);
      })
      .catch((err) => {
        console.error(err);
        toast.error('Could not open that House draft.');
      })
      .finally(() => {
        setOpening(false);
        setSearchParams((current) => {
          const next = new URLSearchParams(current);
          next.delete('batch');
          next.delete('row');
          return next;
        }, { replace: true });
      });
    // The loader reads members only to label rows; it must not re-run when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchParam, rowParam, loadingMembers, selectedYear]);

  async function handlePlacementSaved(batchId: string, count: number, issues: number) {
    setEditorNextStep(nextStepFor({ type: 'house_imported', count, issues }));
    await loadBatches();
    await openBatch(batchId);
  }

  async function handleSaveDraft() {
    if (!selectedYear || !effectiveStartDate || rows.length === 0) return;
    setSaving(true);
    try {
      const batch = await houseAssignmentsRepository.createBatch({
        academicYearStart: selectedYear,
        effectiveStartDate,
        sourceLabel: sourceLabel.trim() || (csvUrl.trim() ? 'CSV URL' : 'Pasted sheet'),
        userId,
        rows: rows.map((row, index) => draftInsertFromParsed(row, index)),
      });
      toast.success(`Saved draft with ${rows.length} rows. Nothing is public.`);
      const problems = summarizeImport(reviewRows).problems;
      logAdminActivity({
        action: ACTIVITY_ACTIONS.houseImportAdded,
        entityType: 'house_assignment_batch',
        entityId: batch.id,
        academicYearStart: selectedYear,
        summary: `Saved a House assignment draft for ${formatYearSpan(selectedYear)} (${rows.length} rows)`,
      });
      setEditorNextStep(nextStepFor({ type: 'house_imported', count: rows.length, issues: problems }));
      setRows([]);
      setRawInput('');
      await loadBatches();
      await openBatch(batch.id);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error && err.message ? err.message : 'Failed to save the draft.');
    } finally {
      setSaving(false);
    }
  }

  if (editor) {
    return (
      <>
        <Stepper current={currentStep} />
        <HouseDraftEditor
          key={editor.batch.id}
          batch={editor.batch}
          initialDrafts={editor.drafts}
          profiles={editor.profiles}
          existingMemberships={editor.existingMemberships}
          members={members}
          userId={userId}
          onBack={() => { setEditor(null); setEditorNextStep(null); }}
          onBatchChanged={loadBatches}
          onPublished={onMembershipsPublished}
          initialNextStep={editorNextStep}
          highlightRowId={highlightRowId}
          onOpenBatch={(batchId) => { loadBatches(); openBatch(batchId); }}
        />
      </>
    );
  }

  const setup = (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="draft-year" className={`${labelCls} text-text-muted`}>Academic Year</label>
          <select
            id="draft-year"
            value={selectedYear ?? ''}
            onChange={(event) => onYearChange(Number(event.target.value))}
            className={`${fieldCls} border-[var(--color-border)]`}
          >
            {yearOptions.map((year) => (
              <option key={year.start} value={year.start}>{`${year.label}${year.isActive ? ' (Active)' : ''}`}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="draft-effective" className={`${labelCls} text-text-muted`}>Effective Start Date</label>
          <input
            id="draft-effective"
            type="date"
            value={effectiveStartDate}
            onChange={(event) => { onEffectiveStartDateChange(event.target.value); setRows([]); }}
            className={`${fieldCls} border-[var(--color-border)]`}
          />
        </div>
      </div>
      <p className="rounded border p-3 text-xs border-[var(--color-border)] bg-surface2 text-text-secondary">
        {loadingProfiles ? 'Loading house profiles...' : `${houseProfiles.length} house profile${houseProfiles.length !== 1 ? 's' : ''} found for ${selectedYear ? formatAcademicYear(selectedYear) : 'the selected year'}. Create profiles in Profiles & Images before importing.`}
        {' '}Memberships start on the effective date. Earlier event attendance keeps individual points but does not earn house points.
      </p>
      <div>
        <label htmlFor="draft-label" className={`${labelCls} text-text-muted`}>Draft label (optional)</label>
        <input
          id="draft-label"
          type="text"
          value={sourceLabel}
          onChange={(event) => setSourceLabel(event.target.value)}
          placeholder="e.g. Fall House placement, round 1"
          className={`${fieldCls} border-[var(--color-border)]`}
        />
      </div>
    </div>
  );

  const savedDrafts = (
    <section className="scrapbook-paper overflow-hidden border-[var(--color-border)] bg-surface" aria-label="Saved drafts">
      <div className="border-b px-5 py-4 border-[var(--color-border)]">
        <h2 className="font-serif text-xl font-bold text-text-primary">Saved drafts</h2>
        <p className="mt-1 font-sans text-xs text-text-muted">
          {selectedYear ? formatAcademicYear(selectedYear) : 'Choose a year'} · private to admins · choose another year above to open its drafts
        </p>
      </div>
      {loadingBatches ? (
        <p className="px-5 py-8 text-center text-sm text-text-muted">Loading drafts…</p>
      ) : batches.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title={`No House assignment draft yet${selectedYear ? ` for ${formatYearSpan(selectedYear)}` : ''}.`}
            description="Upload the House Applications CSV, validate it, generate the placement, then save it as a private draft."
            action={{ label: 'Import House Applications', onClick: () => document.getElementById('placement-file')?.focus() }}
          />
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {batches.map((batch) => (
            <li key={batch.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary">{batch.source_label || 'Untitled draft'}</p>
                <p className="text-xs text-text-muted">
                  {batch.assignment_method === 'timestamp_ranked' ? 'Automatic placement' : 'Manual import'} · {statusLabel(batch.status)} · effective {batch.effective_start_date} · saved {new Date(batch.created_at).toLocaleDateString()}
                </p>
                {batchLineageLabel(batch) && (
                  <p className="text-xs font-semibold text-text-secondary">
                    {batchLineageLabel(batch)}
                    {batch.revised_from_batch_id ? ` · from “${batches.find((other) => other.id === batch.revised_from_batch_id)?.source_label || 'an earlier draft'}”` : ''}
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={opening}
                onClick={() => openBatch(batch.id)}
                aria-label={`Open ${batch.source_label || 'Untitled draft'}`}
                className="rounded border bg-transparent px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-surface2)] disabled:opacity-50 border-[var(--color-border)] text-text-primary"
              >
                Open
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <>
      <Stepper current={currentStep} />
      {selectedYear && (
        <div className="px-4 pt-4 sm:px-6 lg:px-8">
          <YearContextBadge context={describeYearContext(selectedYear, operatingYear)} />
        </div>
      )}
      <div className="pt-4 sm:pt-6 lg:pt-8">
        <HousePlacementPanel
          selectedYear={selectedYear}
          effectiveStartDate={effectiveStartDate}
          houseProfiles={houseProfiles}
          loadingProfiles={loadingProfiles}
          members={members}
          loadingMembers={loadingMembers}
          userId={userId}
          sourceLabel={sourceLabel}
          onStageChange={setPlacementStage}
          onSaved={handlePlacementSaved}
          setup={setup}
          aside={savedDrafts}
        />
      </div>

      <div className="space-y-6 px-4 pb-8 sm:px-6 lg:px-8">
        <details className="scrapbook-paper border-[var(--color-border)] bg-surface" data-testid="legacy-import">
          <summary className="cursor-pointer px-6 py-4 font-serif text-base font-bold text-text-primary">
            Historical / Advanced Import
          </summary>
          <div className="space-y-4 border-t px-6 pb-6 pt-4 border-[var(--color-border)]">
            <div role="note" className="rounded border p-3 text-xs border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-semibold">These formats do not use timestamp-priority placement.</p>
              <p className="mt-1">
                Use them only to re-import a sort that was already decided by hand, such as an earlier year&rsquo;s sheet or a manual correction. They import each person&rsquo;s House as written, with no capacities, no first-come, first-served order and no automatic placement checks. For House Applications, use Import House Applications above.
              </p>
              <p className="mt-1">Uses the academic year, effective date and draft label above.</p>
            </div>

            <div>
              <label htmlFor="draft-format" className={`${labelCls} text-text-muted`}>Historical sheet format</label>
              <select
                id="draft-format"
                value={legacyFormat}
                onChange={(event) => { setLegacyFormat(event.target.value as SheetFormat); setRows([]); }}
                className={`${fieldCls} border-[var(--color-border)]`}
              >
                <option value="wide">Wide House sorting sheet (one column per House)</option>
                <option value="long">Long CSV with name/email/house (+ optional choices)</option>
              </select>
            </div>

            <div>
              <label htmlFor="draft-csv-url" className={`${labelCls} text-text-muted`}>Public CSV URL (historical sheets only)</label>
              <div className="flex gap-2">
                <input
                  id="draft-csv-url"
                  type="url"
                  value={csvUrl}
                  onChange={(event) => setCsvUrl(event.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/.../pub?output=csv"
                  className={`${fieldCls} min-w-0 flex-1 text-xs border-[var(--color-border)]`}
                />
                <button
                  type="button"
                  onClick={handleFetchCsv}
                  disabled={fetchingCsv || !csvUrl.trim()}
                  className="rounded border px-3 py-2 text-xs font-semibold disabled:opacity-50 border-[var(--color-border)] text-text-secondary"
                >
                  {fetchingCsv ? 'Loading...' : 'Load'}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="draft-paste" className={`${labelCls} text-text-muted`}>CSV or Pasted Sheet</label>
              <textarea
                id="draft-paste"
                value={rawInput}
                onChange={(event) => setRawInput(event.target.value)}
                rows={10}
                placeholder={legacyFormat === 'wide'
                  ? 'House A,House B\nApplicant One (first),Applicant Two (second)'
                  : 'name,email,house\nApplicant One,applicant.one@example.edu,House A'}
                className={`${fieldCls} font-mono text-xs border-[var(--color-border)]`}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleParse}
                disabled={loadingMembers || loadingProfiles || !rawInput.trim() || !selectedYear || !effectiveStartDate}
                className="vsa-btn-primary flex-1 py-3 text-xs disabled:opacity-50"
              >
                Preview Matches
              </button>
              <button
                type="button"
                onClick={() => { setRawInput(''); setRows([]); }}
                className="rounded border bg-transparent px-5 py-3 text-xs font-semibold transition-colors hover:bg-[var(--color-surface2)] border-[var(--color-border)] text-text-secondary"
              >
                Clear
              </button>
            </div>

            {rows.length > 0 && <ImportReviewPanel rows={reviewRows} hasInput filename="house-import-problem-rows" />}
            <PossibleDuplicates duplicates={importDuplicates} />
            {rows.length > 0 && (
              <div className="overflow-hidden rounded border border-[var(--color-border)]">
                <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between border-[var(--color-border)]">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-text-primary">Match preview</h3>
                    <p className="mt-1 font-sans text-xs text-text-muted">
                      {rows.length} rows · {summary.match} matched · {summary.review} to review · {summary.unmatched + summary.invalid} unmatched · {summary.noHouse} without a House profile
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={saving}
                    className="vsa-btn-primary w-full py-2.5 text-xs disabled:opacity-50 sm:w-auto sm:px-6"
                  >
                    {saving ? 'Saving…' : `Save as draft (${rows.length})`}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b bg-surface2 border-[var(--color-border)]">
                        {['Sheet entry', 'House', 'Match', 'Member'].map((heading) => (
                          <th key={heading} className="px-4 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {rows.slice(0, PREVIEW_LIMIT).map((row) => (
                        <tr key={row.rowId}>
                          <td className="px-4 py-2 text-[13px] text-text-primary">{row.name || '-'}</td>
                          <td className="px-4 py-2 text-xs text-text-secondary">{row.houseProfile?.display_name ?? row.house ?? 'Unassigned'}</td>
                          <td className="px-4 py-2 font-mono text-[11px] uppercase text-text-secondary">{row.status}</td>
                          <td className="px-4 py-2 text-xs text-text-secondary">
                            {row.matchedMember && row.status !== 'unmatched' ? `${row.matchedMember.first_name} ${row.matchedMember.last_name}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > PREVIEW_LIMIT && (
                  <p className="px-5 py-3 text-xs text-text-muted">
                    Showing the first {PREVIEW_LIMIT} of {rows.length}. Every row is editable after you save the draft.
                  </p>
                )}
              </div>
            )}
          </div>
        </details>
      </div>
    </>
  );
}
