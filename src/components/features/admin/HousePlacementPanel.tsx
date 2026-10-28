// Protected domain — House membership. The primary House import ("Import House
// Applications", Google Forms auto placement): upload -> validate -> fix
// problems -> capacities -> generate -> save a private draft. Generating is pure and local; saving creates one draft batch
// through houseAssignmentsRepository and never writes house_memberships. Lock
// and reveal stay in HouseDraftEditor. The uploaded file is read in memory
// only; no email or extra form answer is stored or logged.
import { ChangeEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from 'react-query';
import { houseAssignmentsRepository } from '../../../data/repos/houseAssignments';
import { houseParentsRepository } from '../../../data/repos/houseParents';
import { PAYMENTS_UNAVAILABLE, housePaymentsRepository } from '../../../data/repos/housePayments';
import { memberIdentityRepository } from '../../../data/repos/memberIdentity';
import { logAdminActivity } from '../../../data/repos/adminActivity';
import { ACTIVITY_ACTIONS } from '../../../lib/adminActivity';
import { formatYearSpan } from '../../../lib/operationalStatus';
import { formatAcademicYear } from '../../../lib/academicTerms';
import { draftInsertFromPlacement } from '../../../lib/houseAssignmentDraft';
import type { HouseImportMember } from '../../../lib/houseAssignmentImport';
import {
  AllocationError,
  allocateHouseApplicants,
  firstChoiceDemand,
  suggestCapacities,
  validateCapacities,
} from '../../../lib/housePlacement';
import {
  ColumnOverrides,
  EMPTY_PLACEMENT_EDITS,
  PlacementColumnRole,
  PlacementEdits,
  PlacementParseResult,
  buildPlacementMemberIndex,
  buildPlacementReview,
  formatFormTime,
  matchApplicantToMember,
  parsePlacementCsv,
  placementApplicants,
} from '../../../lib/housePlacementImport';
import {
  APPLICATION_KEY_LABEL,
  HouseApplicationKey,
  applicantKey,
  applicantSetFingerprint,
} from '../../../lib/housePayments';
import { HousePageAsset } from '../../../types';
import { HousePlacementCapacityEditor, parseCapacityInput } from './HousePlacementCapacityEditor';
import { HousePlacementResults, PlacementPreviewRow } from './HousePlacementResults';
import { HousePlacementReviewPanel } from './HousePlacementReviewPanel';

/** 0 = nothing loaded, 1 = validating/fixing, 2 = placements generated. */
export type PlacementStage = 0 | 1 | 2;

export interface HousePlacementPanelProps {
  selectedYear: number | null;
  effectiveStartDate: string;
  houseProfiles: HousePageAsset[];
  loadingProfiles: boolean;
  members: HouseImportMember[];
  loadingMembers: boolean;
  userId: string | null;
  sourceLabel: string;
  onStageChange: (stage: PlacementStage) => void;
  onSaved: (batchId: string, rows: number, issues: number) => Promise<void> | void;
  /** Year, start date and label fields, shown above the upload. */
  setup?: ReactNode;
  /** Shown beside the upload card, e.g. the saved drafts list. */
  aside?: ReactNode;
}

interface Generated {
  key: string;
  rows: PlacementPreviewRow[];
  rankCounts: number[];
  capacities: Record<string, number>;
}

const fieldCls =
  'w-full rounded border bg-[var(--color-surface2)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]';
const labelCls = 'mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.1em]';
const ROLE_LABEL: Record<PlacementColumnRole, string> = { timestamp: 'Timestamp column', name: 'Name column', email: 'Email column' };

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded border px-3 py-2 border-[var(--color-border)] bg-surface2">
      <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">{label}</dt>
      <dd className={`mt-0.5 font-serif text-xl font-bold ${tone ?? 'text-text-primary'}`}>{value}</dd>
    </div>
  );
}

export function HousePlacementPanel({
  selectedYear,
  effectiveStartDate,
  houseProfiles,
  loadingProfiles,
  members,
  loadingMembers,
  userId,
  sourceLabel,
  onStageChange,
  onSaved,
  setup,
  aside,
}: HousePlacementPanelProps) {
  const [fileName, setFileName] = useState('');
  const [rawText, setRawText] = useState('');
  const [overrides, setOverrides] = useState<ColumnOverrides>({});
  const [parse, setParse] = useState<PlacementParseResult | null>(null);
  const [parseVersion, setParseVersion] = useState(0);
  const [edits, setEdits] = useState<PlacementEdits>(EMPTY_PLACEMENT_EDITS);
  const [capacityInput, setCapacityInput] = useState<Record<string, string> | null>(null);
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [generateErrors, setGenerateErrors] = useState<AllocationError[]>([]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [paymentCycleChoice, setPaymentCycleChoice] = useState('');

  const activeProfiles = useMemo(() => houseProfiles.filter((profile) => profile.is_active), [houseProfiles]);
  // House Parents let "Pinky Pie (Ingyin & Martin)" resolve to Pinkie Pie. Without
  // them (e.g. before the House Parent migration) labels still resolve by name.
  const { data: parents = [] } = useQuery({
    queryKey: ['admin', 'house-parents', selectedYear],
    queryFn: () => houseParentsRepository.listForYear(selectedYear as number),
    enabled: selectedYear !== null,
    retry: false,
  });
  // Confirmed alternate emails (member_identity_emails) widen email matching.
  // If they can't be read, matching falls back to each member's main email.
  // Generate waits for this query, and the alias list is part of the preview
  // key, so a preview (and the draft saved from it) never uses a partial list.
  const { data: aliases = [], isError: aliasesFailed, isLoading: loadingAliases } = useQuery({
    queryKey: ['admin', 'member-identity-emails'],
    queryFn: () => memberIdentityRepository.loadIdentityEmails(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  // A year with a payment roster gates Lock and Reveal on payment (#660), so a
  // placement saved there must belong to a roster. Before the payment
  // migration exists, saving works exactly as it did.
  const cyclesQuery = useQuery({
    queryKey: ['admin', 'house-payment-cycles', selectedYear],
    queryFn: () => housePaymentsRepository.listCycles(selectedYear as number),
    enabled: selectedYear !== null,
    retry: false,
  });
  const paymentsUnavailable = cyclesQuery.error instanceof Error && cyclesQuery.error.message === PAYMENTS_UNAVAILABLE;
  const cycles = useMemo(() => cyclesQuery.data ?? [], [cyclesQuery.data]);
  // Always an explicit choice: registering a Winter CSV into the Fall roster cannot be undone.
  const paymentCycleId = cycles.some((cycle) => cycle.id === paymentCycleChoice) ? paymentCycleChoice : '';
  const cyclesBlocked = cyclesQuery.isLoading || (cyclesQuery.isError && !paymentsUnavailable) || (cycles.length > 0 && !paymentCycleId);
  const aliasKey = useMemo(() => aliases.map((alias) => `${alias.member_id}:${alias.email}`).sort().join(','), [aliases]);
  const memberNameById = useMemo(() => new Map(members.map((member) => [member.id, `${member.first_name} ${member.last_name}`.trim()])), [members]);
  const memberName = useCallback((memberId: string) => memberNameById.get(memberId) ?? null, [memberNameById]);
  const placementProfiles = useMemo(
    () => houseProfiles.map((profile) => ({
      ...profile,
      parentNames: parents.filter((parent) => parent.house_profile_id === profile.id).map((parent) => parent.display_name),
    })),
    [houseProfiles, parents],
  );
  const review = useMemo(
    () => (parse?.ok ? buildPlacementReview(parse.rows, placementProfiles, edits) : null),
    [parse, placementProfiles, edits],
  );
  const applicants = useMemo(() => (review ? placementApplicants(review) : []), [review]);
  const houses = useMemo(() => review?.houses ?? [], [review]);
  const demand = useMemo(() => firstChoiceDemand(houses, applicants), [houses, applicants]);
  const suggested = useMemo(() => suggestCapacities(houses, applicants.length, demand), [houses, applicants.length, demand]);
  const capacityValues = useMemo(
    () => capacityInput ?? Object.fromEntries(houses.map((house) => [house.id, String(suggested[house.id] ?? 0)])),
    [capacityInput, houses, suggested],
  );
  const capacities = useMemo(() => {
    const parsed: Record<string, number> = {};
    for (const house of houses) {
      const value = parseCapacityInput(capacityValues[house.id]);
      if (value === null) return null;
      parsed[house.id] = value;
    }
    return parsed;
  }, [houses, capacityValues]);
  const capacityErrors = useMemo(
    () => (capacities ? validateCapacities(houses, capacities, applicants.length) : []),
    [capacities, houses, applicants.length],
  );
  const inputKey = `${parseVersion}|${JSON.stringify(edits)}|${JSON.stringify(capacities)}|${houses.map((house) => house.id).join(',')}|${parents.map((parent) => `${parent.house_profile_id}:${parent.display_name}`).join(',')}|${selectedYear}|${aliasesFailed ? 'aliases-failed' : aliasKey}`;
  const current = generated && generated.key === inputKey ? generated : null;
  const stage: PlacementStage = current ? 2 : rawText ? 1 : 0;
  useEffect(() => { onStageChange(stage); }, [stage, onStageChange]);

  // A new year or new House profiles invalidate everything derived from them.
  useEffect(() => {
    setGenerated(null);
    setCapacityInput(null);
  }, [selectedYear, houseProfiles]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await readFileText(file);
      setFileName(file.name);
      setRawText(text);
      setParse(null);
      setOverrides({});
      setEdits(EMPTY_PLACEMENT_EDITS);
      setCapacityInput(null);
      setGenerated(null);
      setGenerateErrors([]);
    } catch (err) {
      console.error(err);
      toast.error('Could not read that file.');
    }
  }

  function validate(nextOverrides: ColumnOverrides = overrides) {
    const result = parsePlacementCsv(rawText, nextOverrides);
    setParse(result);
    setParseVersion((version) => version + 1);
    setEdits(EMPTY_PLACEMENT_EDITS);
    setCapacityInput(null);
    setGenerated(null);
    setGenerateErrors([]);
    if (!result.ok) toast.error('The file could not be used. See the details below.');
  }

  function setOverride(role: PlacementColumnRole, value: string) {
    setOverrides((current) => ({ ...current, [role]: value || null }));
  }

  function setRankOverride(index: number, value: string) {
    setOverrides((current) => {
      const ranks = [...(current.ranks ?? parse?.detection?.columns.ranks ?? [])];
      ranks[index] = value;
      return { ...current, ranks: ranks.filter(Boolean) };
    });
  }

  function handleGenerate() {
    if (!review || !capacities) return;
    const result = allocateHouseApplicants({ houses, capacities, applicants });
    if (!result.ok) {
      setGenerated(null);
      setGenerateErrors(result.errors);
      toast.error('Placement could not be generated. See the details below.');
      return;
    }
    setGenerateErrors([]);
    const index = buildPlacementMemberIndex(members, aliases);
    const byId = new Map(review.applicants.map((row) => [row.id, row]));
    const labelOf = new Map(houses.map((house) => [house.id, house.label]));
    const rows = result.placements.map((placement): PlacementPreviewRow => {
      const source = byId.get(placement.applicantId);
      const preferenceIds = applicants.find((item) => item.id === placement.applicantId)?.preferences ?? [];
      return {
        id: placement.applicantId,
        priority: placement.priority,
        name: placement.name,
        sourceRow: source?.sourceRow ?? 0,
        submitted: formatFormTime(source?.submittedAtIso),
        submittedIso: source?.submittedAtIso ?? null,
        preferences: preferenceIds.map((id) => labelOf.get(id) ?? id),
        houseId: placement.houseId,
        houseLabel: labelOf.get(placement.houseId) ?? placement.houseId,
        achievedRank: placement.achievedRank,
        explanation: placement.explanation,
        corrected: !!source?.corrected,
        match: matchApplicantToMember({ name: placement.name, email: source?.email || null }, index),
      };
    });
    setGenerated({ key: inputKey, rows, rankCounts: result.rankCounts, capacities });
  }

  async function handleSave() {
    if (!current || !review || !selectedYear || !effectiveStartDate || savingRef.current || cyclesBlocked) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const byId = new Map(review.applicants.map((row) => [row.id, row]));
      const preferenceById = new Map(applicants.map((item) => [item.id, [...item.preferences]]));
      // The minimal snapshot a payment rerun needs (#657): name, original
      // time, sheet row, ranking, member link. No email or other answers.
      let applicantIds: Map<string, string> | null = null;
      let paymentVersion = 0;
      if (paymentCycleId) {
        applicantIds = await housePaymentsRepository.registerApplicants(paymentCycleId, current.rows.map((row) => {
          const source = byId.get(row.id);
          if (!source?.submittedAtIso) throw new Error(`Row ${row.id} lost its submission time; validate again.`);
          return {
            applicant_key: applicantKey(source.submittedAtIso, source.sourceRow),
            source_name: row.name,
            submission_timestamp: source.submittedAtIso,
            source_row_number: source.sourceRow,
            preferences: preferenceById.get(row.id) ?? [],
            member_id: row.match.memberId,
            match_status: row.match.memberId ? row.match.status : 'unmatched',
            match_method: row.match.memberId ? row.match.method : null,
          };
        }), 'placement_import');
        paymentVersion = (await housePaymentsRepository.getCycle(paymentCycleId)).status_version;
      }
      const rows = current.rows.map((row) => {
        const source = byId.get(row.id);
        if (!source?.submittedAtIso) throw new Error(`Row ${row.id} lost its submission time; validate again.`);
        const applicantId = applicantIds?.get(applicantKey(source.submittedAtIso, source.sourceRow)) ?? null;
        if (applicantIds && !applicantId) throw new Error(`Row ${source.sourceRow} was not saved to the payment roster; nothing was saved.`);
        return { ...(applicantId ? { applicant_id: applicantId } : {}), ...draftInsertFromPlacement({
          name: row.name,
          submittedAtIso: source.submittedAtIso,
          sourceRow: source.sourceRow,
          priority: row.priority,
          preferences: preferenceById.get(row.id) ?? [],
          houseId: row.houseId,
          explanation: row.explanation,
          corrected: row.corrected,
          match: row.match,
        }) };
      });
      // Repeat submissions are recorded too, so the saved draft shows which sheet rows were not placed and why.
      const excludedApplicants = review.applicants
        .filter((row) => row.status === 'excluded' || row.status === 'duplicate')
        .sort((a, b) => a.sourceRow - b.sourceRow)
        .map((row) => ({
          source_row_number: row.sourceRow,
          name: row.name,
          reason: row.status === 'excluded'
            ? row.exclusionReason ?? ''
            : `Repeat submission; kept the earlier row ${byId.get(row.duplicateOf ?? '')?.sourceRow ?? '?'}${row.duplicateDiffers ? ' (this one ranked Houses differently)' : ''}.`,
        }));
      const batch = await houseAssignmentsRepository.createBatch({
        academicYearStart: selectedYear,
        effectiveStartDate,
        sourceLabel: sourceLabel.trim() || `Auto placement${fileName ? ` · ${fileName}` : ''}`,
        userId,
        rows,
        placement: {
          capacityConfig: current.capacities,
          excludedApplicants,
          ...(paymentCycleId
            ? {
                payment: {
                  cycleId: paymentCycleId,
                  eligibilityMode: 'provisional' as const,
                  snapshotVersion: paymentVersion,
                  generationReason: 'initial' as const,
                  revisedFromBatchId: null,
                  fingerprint: applicantSetFingerprint(applicants, current.capacities),
                  summary: { included: rows.length, excluded: excludedApplicants.length },
                },
              }
            : {}),
        },
      });
      const issues = current.rows.filter((row) => row.match.status !== 'match').length;
      logAdminActivity({
        action: ACTIVITY_ACTIONS.houseImportAdded,
        entityType: 'house_assignment_batch',
        entityId: batch.id,
        academicYearStart: selectedYear,
        summary: `Saved an automatic House placement draft for ${formatYearSpan(selectedYear)} (${rows.length} applicants, ${current.rankCounts[0] ?? 0} in their 1st choice, ${review.counts.excluded} excluded, ${review.counts.duplicates} repeat submissions ignored)`,
      });
      toast.success(`Saved a private placement draft with ${rows.length} applicants. No House memberships changed.`);
      setRawText('');
      setFileName('');
      setParse(null);
      setEdits(EMPTY_PLACEMENT_EDITS);
      setCapacityInput(null);
      setGenerated(null);
      await onSaved(batch.id, rows.length, issues);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error && err.message ? err.message : 'Failed to save the placement draft.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const noHouses = !loadingProfiles && activeProfiles.length === 0;
  const detection = parse?.detection ?? null;
  const showMapping = !!detection && (!parse?.ok || Object.keys(overrides).length > 0);
  const rankSlots = Math.max(activeProfiles.length, detection?.columns.ranks.length ?? 0, 1);
  const canGenerate = !!review?.ready && !!capacities && capacityErrors.length === 0 && !loadingMembers && !loadingAliases;

  return (
    <div className="space-y-6 px-4 pb-8 sm:px-6 lg:px-8">
      <div className={aside ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]' : undefined}>
        <section className="scrapbook-paper p-6 border-[var(--color-border)] bg-surface" aria-label="Import House Applications">
          <h2 className="font-serif text-xl font-bold text-text-primary">Import House Applications</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            Upload the Google Form responses. Applicants are placed first-come, first-served: in submission order, each takes their highest-ranked House with room. No lottery, scoring, or AI. The result is a private draft until you lock and reveal it.
          </p>
          <p className="mt-1 text-xs text-text-muted">
            In the responses sheet, use File → Download → Comma-separated values (.csv). The file stays in this browser and the sheet never needs to be public; only names, rankings, submission times and sheet rows are saved with the draft.
          </p>
          {setup && <div className="mt-5">{setup}</div>}

          {noHouses ? (
            <div role="alert" className="mt-4 rounded border p-3 text-sm border-[var(--color-border)] bg-surface2 text-text-primary">
              <p className="font-semibold">No active Houses for {selectedYear ? formatAcademicYear(selectedYear) : 'this year'}.</p>
              <p className="mt-1 text-xs text-text-secondary">
                Create this year&rsquo;s House profiles in the Profiles &amp; Images tab first. Placement never uses another year&rsquo;s Houses.
              </p>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <label htmlFor="placement-file" className={`${labelCls} text-text-muted`}>Form responses CSV</label>
                <input
                  id="placement-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFile}
                  disabled={saving}
                  className="block w-full text-xs text-text-secondary"
                />
                {fileName && <p className="mt-1 text-xs text-text-muted">Loaded {fileName}</p>}
              </div>
              <button
                type="button"
                onClick={() => validate()}
                disabled={!rawText || saving || loadingProfiles || !selectedYear || !effectiveStartDate}
                className="vsa-btn-primary px-6 py-2.5 text-xs disabled:opacity-50"
              >
                Validate Applications
              </button>
            </div>
          )}

          {parse && !parse.ok && (
            <div role="alert" className="mt-4 rounded border border-red-300 p-3 text-sm text-red-700 dark:border-red-800 dark:text-red-300">
              {parse.error}
            </div>
          )}
          {parse?.ok && parse.warnings.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-amber-700 dark:text-amber-400">
              {parse.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          )}
          {aliasesFailed && (
            <p className="mt-3 text-xs text-text-muted">
              Confirmed alternate member emails could not be loaded, so member matching uses each member&rsquo;s main email only.
            </p>
          )}

          {showMapping && detection && parse && (
            <div className="mt-4 rounded border p-3 border-[var(--color-border)]">
              <p className="text-xs font-semibold text-text-primary">Choose the columns to use</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                {(Object.keys(ROLE_LABEL) as PlacementColumnRole[]).map((role) => (
                  <div key={role}>
                    <label htmlFor={`placement-col-${role}`} className={`${labelCls} text-text-muted`}>{ROLE_LABEL[role]}</label>
                    <select
                      id={`placement-col-${role}`}
                      value={(overrides[role] ?? detection.columns[role]) || ''}
                      onChange={(event) => setOverride(role, event.target.value)}
                      className={`${fieldCls} border-[var(--color-border)]`}
                    >
                      <option value="">{role === 'email' ? 'No email column' : 'Choose…'}</option>
                      {parse.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                    </select>
                  </div>
                ))}
                {Array.from({ length: rankSlots }, (_, index) => (
                  <div key={`rank-${index}`}>
                    <label htmlFor={`placement-rank-${index}`} className={`${labelCls} text-text-muted`}>Choice #{index + 1} column</label>
                    <select
                      id={`placement-rank-${index}`}
                      value={(overrides.ranks ?? detection.columns.ranks)[index] ?? ''}
                      onChange={(event) => setRankOverride(index, event.target.value)}
                      className={`${fieldCls} border-[var(--color-border)]`}
                    >
                      <option value="">Not used</option>
                      {parse.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => validate(overrides)}
                className="mt-3 rounded border bg-transparent px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-surface2)] border-[var(--color-border)] text-text-primary"
              >
                Validate with these columns
              </button>
            </div>
          )}

          {review && (
            <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" aria-label="Submission counts">
              <Stat label="Submissions" value={review.counts.submissions} />
              <Stat label="Unique applicants" value={review.counts.unique} />
              <Stat label="Repeat submissions" value={review.counts.duplicates} />
              <Stat label="Need a fix" value={review.counts.invalid} tone={review.counts.invalid > 0 ? 'text-red-600 dark:text-red-400' : undefined} />
              <Stat label="Missing time" value={review.counts.missingTimestamps} />
              <Stat label="Excluded" value={review.counts.excluded} />
              <Stat label="Valid" value={review.counts.valid} tone="text-emerald-700 dark:text-emerald-400" />
            </dl>
          )}
        </section>
        {aside}
      </div>

      {review && (
        <HousePlacementReviewPanel review={review} edits={edits} onEditsChange={setEdits} disabled={saving} />
      )}

      {review && houses.length > 0 && (
        <HousePlacementCapacityEditor
          houses={houses}
          demand={demand}
          suggested={suggested}
          values={capacityValues}
          edited={capacityInput !== null}
          applicantCount={applicants.length}
          onChange={(houseId, value) => setCapacityInput({ ...capacityValues, [houseId]: value })}
          onReset={() => setCapacityInput(null)}
          disabled={saving}
        />
      )}

      {review && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button type="button" onClick={handleGenerate} disabled={!canGenerate || saving} className="vsa-btn-primary px-6 py-3 text-xs disabled:opacity-50">
            Generate Placements
          </button>
          <p className="text-xs text-text-muted">
            {!review.ready
              ? 'Fix or exclude every flagged submission first.'
              : capacityErrors.length > 0
                ? capacityErrors[0].message
                : loadingMembers
                  ? 'Loading the member directory…'
                  : loadingAliases
                    ? 'Loading confirmed member emails…'
                    : 'Generating only previews the result. Nothing is saved until you save the draft.'}
          </p>
        </div>
      )}

      {generateErrors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded border border-red-300 p-3 text-xs text-red-700 dark:border-red-800 dark:text-red-300">
          {generateErrors.slice(0, 10).map((error, index) => <li key={`${error.code}-${index}`}>{error.message}</li>)}
        </ul>
      )}

      {generated && !current && (
        <p className="text-xs text-amber-700 dark:text-amber-400">The inputs changed after the last preview. Generate again to see the current result.</p>
      )}

      {current && (
        <>
          <HousePlacementResults
            rows={current.rows}
            houses={houses}
            capacities={current.capacities}
            rankCounts={current.rankCounts}
            academicYearStart={selectedYear ?? new Date().getFullYear()}
            memberName={memberName}
          />
          <div className="scrapbook-paper flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between border-[var(--color-border)] bg-surface">
            <div className="space-y-2">
              <p className="text-xs text-text-secondary">
                Saving creates one private draft for {selectedYear ? formatAcademicYear(selectedYear) : 'this year'}. No House membership changes and nothing is revealed. Unmatched members must be linked in the draft before it can be locked.
              </p>
              {cycles.length > 0 ? (
                <div>
                  <label htmlFor="placement-payment-cycle" className={`${labelCls} text-text-muted`}>Payment roster</label>
                  <select
                    id="placement-payment-cycle"
                    value={paymentCycleId}
                    onChange={(event) => setPaymentCycleChoice(event.target.value)}
                    disabled={saving}
                    className={`${fieldCls} border-[var(--color-border)] sm:max-w-xs`}
                  >
                    <option value="">Choose…</option>
                    {cycles.map((cycle) => (
                      <option key={cycle.id} value={cycle.id}>{APPLICATION_KEY_LABEL[cycle.application_key as HouseApplicationKey] ?? cycle.application_key}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-text-muted">
                    This first sort is provisional: it includes everyone, paid or not, and can never be locked. After the payment cutoff, open the draft and rerun with payment-cleared applicants.
                  </p>
                </div>
              ) : cyclesQuery.isError && !paymentsUnavailable ? (
                <p role="alert" className="text-xs text-red-700 dark:text-red-300">The payment rosters could not be loaded, so this draft cannot be saved yet. Refresh and try again.</p>
              ) : !cyclesQuery.isLoading && !paymentsUnavailable ? (
                <p className="text-xs text-text-muted">No payment roster exists for this year, so payment eligibility will not be checked. If House fees apply, create the roster in the Payments tab before saving.</p>
              ) : null}
            </div>
            <button type="button" onClick={handleSave} disabled={saving || !selectedYear || !effectiveStartDate || cyclesBlocked} className="vsa-btn-primary px-6 py-3 text-xs disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Private Placement Draft'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
