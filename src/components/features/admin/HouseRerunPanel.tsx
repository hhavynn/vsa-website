// Protected domain — House membership. "Rerun sorting with eligible
// applicants" (#657): rebuilds the whole timestamp-priority placement from the
// saved application snapshot for the current eligible cohort, previews the
// change against the source draft (#659) and saves it as a NEW private draft.
// The source draft is never modified. Nothing here writes house_memberships;
// the new draft still goes through Lock and an explicit Reveal, both gated by
// the database on payment eligibility (#660).
import { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { houseAssignmentsRepository } from '../../../data/repos/houseAssignments';
import { housePaymentsRepository } from '../../../data/repos/housePayments';
import { logAdminActivity } from '../../../data/repos/adminActivity';
import { ACTIVITY_ACTIONS } from '../../../lib/adminActivity';
import { formatYearSpan } from '../../../lib/operationalStatus';
import {
  HouseAssignmentBatch,
  HouseAssignmentDraft,
  HouseProfileLite,
  houseLabel,
  isOverridden,
  readCapacityConfig,
} from '../../../lib/houseAssignmentDraft';
import {
  AllocationError,
  Placement,
  PlacementHouse,
  allocateHouseApplicants,
  firstChoiceDemand,
  suggestCapacities,
  validateCapacities,
} from '../../../lib/housePlacement';
import {
  EligibilityMode,
  RerunMemberLink,
  applicantSetFingerprint,
  compareDrafts,
  cutoffState,
  exclusionReason,
  finalSortBlockers,
  isEligible,
  paymentCounts,
  rerunApplicants,
  rerunDraftInsert,
  rerunMemberLink,
} from '../../../lib/housePayments';
import { HouseDraftComparison } from './HouseDraftComparison';
import { HousePlacementCapacityEditor, parseCapacityInput } from './HousePlacementCapacityEditor';

export interface HouseRerunPanelProps {
  batch: HouseAssignmentBatch;
  drafts: HouseAssignmentDraft[];
  profiles: HouseProfileLite[];
  userId: string | null;
  onSaved: (batchId: string) => void;
  onClose: () => void;
}

type OverrideDecision = 'discard' | 'reapply';

interface Generated {
  key: string;
  placements: Placement[];
  capacities: Record<string, number>;
  version: number;
  mode: EligibilityMode;
  fingerprint: string;
}

const labelCls = 'mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted';

export function HouseRerunPanel({ batch, drafts, profiles, userId, onSaved, onClose }: HouseRerunPanelProps) {
  const cycleId = batch.payment_cycle_id as string;
  const cycleQuery = useQuery({
    queryKey: ['admin', 'house-payment-cycle', cycleId],
    queryFn: () => housePaymentsRepository.getCycle(cycleId),
    retry: false,
    staleTime: 0,
  });
  const applicantsQuery = useQuery({
    queryKey: ['admin', 'house-applicants', cycleId],
    queryFn: () => housePaymentsRepository.listApplicants(cycleId),
    retry: false,
    staleTime: 0,
  });
  const cycle = cycleQuery.data ?? null;
  const applicants = useMemo(() => applicantsQuery.data ?? [], [applicantsQuery.data]);

  const counts = useMemo(() => paymentCounts(applicants), [applicants]);
  const cutoff = useMemo(() => (cycle ? cutoffState(cycle, Date.now()) : null), [cycle]);
  const finalBlockers = useMemo(() => (cutoff ? finalSortBlockers(cutoff, counts) : []), [cutoff, counts]);
  const [modeChoice, setModeChoice] = useState<EligibilityMode | null>(null);
  const mode: EligibilityMode = finalBlockers.length > 0 ? 'provisional' : modeChoice ?? 'final';

  const houses = useMemo<PlacementHouse[]>(
    () => profiles.filter((profile) => profile.is_active).map((profile, index) => ({ id: profile.id, label: houseLabel(profile), displayOrder: index })),
    [profiles],
  );
  const labelOf = useMemo(() => new Map(houses.map((house) => [house.id, house.label])), [houses]);
  const houseName = (id: string | null) => (id ? labelOf.get(id) ?? 'Unknown House' : 'No House');

  const eligible = useMemo(() => applicants.filter((applicant) => isEligible(applicant, mode)), [applicants, mode]);
  const people = useMemo(() => rerunApplicants(eligible), [eligible]);
  const demand = useMemo(() => firstChoiceDemand(houses, people), [houses, people]);
  const suggested = useMemo(() => suggestCapacities(houses, people.length, demand), [houses, people.length, demand]);
  const [capacityInput, setCapacityInput] = useState<Record<string, string> | null>(null);
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
  const capacityErrors = useMemo(() => (capacities ? validateCapacities(houses, capacities, people.length) : []), [capacities, houses, people.length]);
  const oldCapacities = useMemo(() => readCapacityConfig(batch.capacity_config), [batch.capacity_config]);

  const overridden = useMemo(() => drafts.filter((row) => isOverridden(row)), [drafts]);
  const [decisions, setDecisions] = useState<Record<string, OverrideDecision>>({});
  const undecided = overridden.filter((row) => !decisions[row.id]).length;

  const [generated, setGenerated] = useState<Generated | null>(null);
  const [errors, setErrors] = useState<AllocationError[]>([]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const inputKey = `${mode}|${cycle?.status_version}|${JSON.stringify(capacities)}|${people.map((person) => person.id).join(',')}`;
  const current = generated && generated.key === inputKey ? generated : null;

  const sourceByApplicant = useMemo(() => new Map(drafts.filter((row) => row.applicant_id).map((row) => [row.applicant_id as string, row])), [drafts]);
  const links = useMemo(
    () => new Map<string, RerunMemberLink>(eligible.map((applicant) => [applicant.id, rerunMemberLink(applicant, sourceByApplicant.get(applicant.id))])),
    [eligible, sourceByApplicant],
  );
  const comparison = useMemo(() => (current
    ? compareDrafts({
        houses,
        before: { rows: drafts, capacities: oldCapacities },
        after: { placements: current.placements, capacities: current.capacities },
        applicants,
        linkByApplicant: links,
        mode: current.mode,
      })
    : null), [current, houses, drafts, oldCapacities, applicants, links]);

  function generate() {
    if (!capacities || !cycle) return;
    const result = allocateHouseApplicants({ houses, capacities, applicants: people });
    if (!result.ok) {
      setGenerated(null);
      setErrors(result.errors);
      toast.error('The rerun could not place everyone. See the details below.');
      return;
    }
    setErrors([]);
    setGenerated({
      key: inputKey,
      placements: result.placements,
      capacities,
      version: cycle.status_version,
      mode,
      fingerprint: applicantSetFingerprint(people, capacities),
    });
  }

  async function save() {
    if (!current || !cycle || savingRef.current || undecided > 0) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const fresh = await housePaymentsRepository.getCycle(cycleId);
      if (fresh.status_version !== current.version) {
        setGenerated(null);
        await Promise.all([cycleQuery.refetch({ cancelRefetch: false }), applicantsQuery.refetch({ cancelRefetch: false })]);
        toast.error('Payments changed since this preview. Review and generate again; nothing was saved.');
        return;
      }
      const applicantById = new Map(applicants.map((applicant) => [applicant.id, applicant]));
      const rows = current.placements.map((placement) => {
        const applicant = applicantById.get(placement.applicantId);
        if (!applicant) throw new Error('An applicant disappeared from the roster; reload and generate again.');
        const source = sourceByApplicant.get(applicant.id);
        const note = source && isOverridden(source) && decisions[source.id] === 'reapply'
          ? `Original draft had a manual override (${houseName(source.generated_house_profile_id)} → ${houseName(source.house_profile_id)}${source.override_reason ? `: ${source.override_reason}` : ''}); re-apply it here if still approved.`
          : null;
        return rerunDraftInsert(placement, applicant, links.get(applicant.id) ?? rerunMemberLink(applicant, source), note);
      });
      const excludedApplicants = applicants
        .filter((applicant) => !isEligible(applicant, current.mode))
        .sort((a, b) => a.source_row_number - b.source_row_number)
        .map((applicant) => ({
          source_row_number: applicant.source_row_number,
          name: applicant.source_name,
          reason: exclusionReason(applicant, current.mode) ?? 'Not eligible.',
        }));
      const summary = { ...paymentCounts(applicants), included: rows.length, excluded: excludedApplicants.length } as unknown as Record<string, number>;
      const saved = await houseAssignmentsRepository.createBatch({
        academicYearStart: batch.academic_year_start,
        effectiveStartDate: batch.effective_start_date,
        sourceLabel: `${current.mode === 'final' ? 'Post-payment rerun' : 'Provisional rerun'} of ${batch.source_label ? `“${batch.source_label}”` : 'the original draft'}`,
        userId,
        rows,
        placement: {
          capacityConfig: current.capacities,
          excludedApplicants,
          payment: {
            cycleId,
            eligibilityMode: current.mode,
            snapshotVersion: current.version,
            generationReason: 'post_payment_rerun',
            revisedFromBatchId: batch.id,
            fingerprint: current.fingerprint,
            summary,
          },
        },
      });
      logAdminActivity({
        action: ACTIVITY_ACTIONS.houseImportAdded,
        entityType: 'house_assignment_batch',
        entityId: saved.id,
        academicYearStart: batch.academic_year_start,
        summary: `Saved a ${current.mode === 'final' ? 'payment-cleared' : 'provisional'} House rerun for ${formatYearSpan(batch.academic_year_start)} (${rows.length} placed, ${excludedApplicants.length} excluded) from an earlier draft, which is unchanged`,
      });
      toast.success(`Saved a new private draft with ${rows.length} applicants. The original draft is unchanged.`);
      onSaved(saved.id);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error && err.message ? err.message : 'Failed to save the rerun.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (cycleQuery.isLoading || applicantsQuery.isLoading) {
    return <p className="text-xs text-text-muted" role="status">Loading the payment roster…</p>;
  }
  if (cycleQuery.isError || applicantsQuery.isError || !cycle) {
    return (
      <div role="alert" className="rounded border border-red-300 p-3 text-xs text-red-700 dark:border-red-800 dark:text-red-300">
        The payment roster could not be read, so a rerun cannot be generated. Nothing was changed. Refresh and try again.
      </div>
    );
  }

  return (
    <section className="scrapbook-paper space-y-5 p-5 border-[var(--color-border)] bg-surface" aria-label="Rerun sorting with eligible applicants">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg font-bold text-text-primary">Rerun sorting with eligible applicants</h3>
          <p className="mt-1 text-xs text-text-secondary">
            Places the whole eligible cohort again from scratch, in original submission order. Freed spots go to whoever reaches them first by that order, so other people&rsquo;s Houses may change. This draft stays exactly as it is; the result is saved as a new private draft.
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded border bg-transparent px-3 py-1.5 text-xs font-semibold hover:bg-[var(--color-surface2)] border-[var(--color-border)] text-text-secondary">
          Close
        </button>
      </div>

      <fieldset>
        <legend className={labelCls}>Cohort</legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          <label className={`flex cursor-pointer items-start gap-2 rounded border p-3 text-xs ${mode === 'final' ? 'border-[var(--brand)]' : 'border-[var(--color-border)]'} ${finalBlockers.length > 0 ? 'cursor-not-allowed opacity-60' : ''}`}>
            <input type="radio" name="rerun-mode" checked={mode === 'final'} disabled={finalBlockers.length > 0} onChange={() => setModeChoice('final')} className="mt-0.5" />
            <span>
              <span className="block font-semibold text-text-primary">Final: payment-cleared ({counts.finalEligible})</span>
              <span className="text-text-secondary">Only Paid and authorized Waived applicants. The only kind of draft that can be locked and revealed.</span>
            </span>
          </label>
          <label className={`flex cursor-pointer items-start gap-2 rounded border p-3 text-xs ${mode === 'provisional' ? 'border-[var(--brand)]' : 'border-[var(--color-border)]'}`}>
            <input type="radio" name="rerun-mode" checked={mode === 'provisional'} onChange={() => setModeChoice('provisional')} className="mt-0.5" />
            <span>
              <span className="block font-semibold text-text-primary">Provisional preview ({counts.provisionalEligible})</span>
              <span className="text-text-secondary">Everyone not confirmed Unpaid, including Pending and Unverified. For planning only; it can never be locked.</span>
            </span>
          </label>
        </div>
        {finalBlockers.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-amber-800 dark:text-amber-300" aria-label="Why a final sort is not available">
            {finalBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
          </ul>
        )}
        <p className="mt-2 text-xs text-text-muted">
          Roster: {counts.total} applicants · {counts.paid} paid · {counts.waived} waived · {counts.unpaid} unpaid · {counts.unresolved} unverified or pending · {counts.withdrawn} withdrawn. Payment version {cycle.status_version}.
        </p>
      </fieldset>

      {houses.length > 0 && (
        <div className="space-y-2">
          {oldCapacities && (
            <p className="text-xs text-text-secondary">
              Original capacities: {houses.map((house) => `${house.label} ${oldCapacities[house.id] ?? '—'}`).join(' · ')}. Suggested capacities below fit the {people.length} eligible applicants by first-choice demand.
            </p>
          )}
          <HousePlacementCapacityEditor
            houses={houses}
            demand={demand}
            suggested={suggested}
            values={capacityValues}
            edited={capacityInput !== null}
            applicantCount={people.length}
            onChange={(houseId, value) => setCapacityInput({ ...capacityValues, [houseId]: value })}
            onReset={() => setCapacityInput(null)}
            disabled={saving}
          />
        </div>
      )}

      {overridden.length > 0 && (
        <fieldset className="rounded border p-3 border-amber-300 dark:border-amber-800">
          <legend className="px-1 text-xs font-semibold text-text-primary">Manual overrides in the original ({overridden.length}) need a decision</legend>
          <p className="text-xs text-text-secondary">A rerun never carries a manual move over silently. Discard it, or keep a note on the new row so it can be re-applied there with the override tool after review.</p>
          <ul className="mt-2 space-y-2">
            {overridden.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-text-primary">
                  {row.source_name}: {houseName(row.generated_house_profile_id)} → {houseName(row.house_profile_id)}
                  {row.override_reason ? <span className="text-text-muted"> ({row.override_reason})</span> : null}
                </span>
                <span className="flex gap-3">
                  {(['discard', 'reapply'] as const).map((choice) => (
                    <label key={choice} className="flex items-center gap-1">
                      <input type="radio" name={`override-${row.id}`} checked={decisions[row.id] === choice} onChange={() => setDecisions((prev) => ({ ...prev, [row.id]: choice }))} />
                      {choice === 'discard' ? 'Discard' : 'Note to re-apply'}
                    </label>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={generate}
          disabled={!capacities || capacityErrors.length > 0 || people.length === 0 || saving}
          className="vsa-btn-primary px-6 py-3 text-xs disabled:opacity-50"
        >
          Generate rerun preview
        </button>
        <p className="text-xs text-text-muted">
          {people.length === 0 ? 'Nobody is eligible in this cohort.' : capacityErrors[0]?.message ?? 'Previewing changes nothing. Saving creates a new draft only.'}
        </p>
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded border border-red-300 p-3 text-xs text-red-700 dark:border-red-800 dark:text-red-300">
          {errors.slice(0, 10).map((error, index) => <li key={`${error.code}-${index}`}>{error.message}</li>)}
        </ul>
      )}
      {generated && !current && (
        <p className="text-xs text-amber-700 dark:text-amber-400" role="status">The cohort, payment version or capacities changed after the last preview. Generate again.</p>
      )}

      {current && comparison && (
        <>
          <HouseDraftComparison
            comparison={comparison}
            houseLabel={houseName}
            beforeLabel={batch.source_label ? `“${batch.source_label}”` : 'Original draft'}
            afterLabel={current.mode === 'final' ? 'Post-payment rerun' : 'Provisional rerun'}
            academicYearStart={batch.academic_year_start}
          />
          <div className="flex flex-col gap-3 rounded border p-4 sm:flex-row sm:items-center sm:justify-between border-[var(--color-border)] bg-surface2">
            <p className="text-xs text-text-secondary">
              {current.mode === 'final'
                ? `Saves a payment-cleared draft at payment version ${current.version}. If any payment changes before Lock or Reveal, the database marks it stale and refuses both.`
                : 'Saves a provisional draft for planning. It cannot be locked or revealed.'}
              {' '}No House membership changes.
            </p>
            <button type="button" onClick={save} disabled={saving || undecided > 0} className="vsa-btn-primary px-6 py-3 text-xs disabled:opacity-50">
              {saving ? 'Saving…' : undecided > 0 ? `Decide ${undecided} override${undecided === 1 ? '' : 's'} first` : 'Save as new draft'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
