import { useEffect, useId, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import type { AceFamilyMember } from '../../../types';
import { aceFamiliesRepository, type AcePickupEvidenceRow, type AcePickupCorrectionSourceKind } from '../../../data/repos/aceFamilies';
import { DatabaseError, toUserMessage } from '../../../data/errors';
import { acePickupYearSchema, type AcePickupYearFormData } from '../../../schemas';
import {
  formatPickupAcademicYear, formatPickupLabel, parsePickupValue,
  pickupTermCode, pickupYearOf, type PickupSeason,
} from '../../../lib/acePickupYear';
import { pickupChangeWarnings, type YearFlag } from '../../../lib/aceYearReview';

type Pickup = { academicYearStart: number | null; term: string | null };
type Confirmation = { next: Pickup; sourceKind: AcePickupCorrectionSourceKind; evidenceId: string | null };

const sourceLabels: Record<AcePickupCorrectionSourceKind, string> = {
  official_pairing: 'Official pairing',
  workbook_year_row: 'Reviewed workbook row',
  import_json: 'Reconstructed JSON',
  admin_entry: 'Reviewed admin entry',
};
const flagLabels: Record<YearFlag, string> = {
  missing_year: 'Pickup year remains unknown',
  pending_evidence: 'Pending source evidence',
  evidence_conflict: 'Conflicting dated evidence',
  child_before_big: 'Little dated before Big',
  same_term_as_big: 'Big and Little dated to the same term',
  suspicious_gap: 'Six or more academic years between Big and Little',
  duplicate_identity: 'Verify duplicate identity',
};
const fieldClass = 'mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 font-sans text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600';
const labelClass = 'block font-sans text-xs font-semibold text-[var(--color-text2)]';

function approvedOf(member: AceFamilyMember): Pickup {
  return {
    academicYearStart: member.pickup_academic_year_start ?? null,
    term: member.pickup_term ?? null,
  };
}
function asForm(member: AceFamilyMember): AcePickupYearFormData {
  const year = member.pickup_academic_year_start;
  return {
    year: year == null ? '' : formatPickupAcademicYear(year),
    season: member.pickup_term?.slice(0, 2) as PickupSeason | '' || '',
    sourceKind: 'admin_entry',
  };
}
function describe(year: Pickup): string {
  if (year.academicYearStart === null) return 'Unknown';
  if (!year.term) return formatPickupAcademicYear(year.academicYearStart) + ' (term unknown)';
  return formatPickupLabel({ status: 'verified', academicYearStart: year.academicYearStart, term: year.term })
    + ' · ' + formatPickupAcademicYear(year.academicYearStart);
}
function same(a: Pickup, b: Pickup): boolean {
  return a.academicYearStart === b.academicYearStart && a.term === b.term;
}
function approvedEvidenceSource(source: string): source is AcePickupCorrectionSourceKind {
  return Object.prototype.hasOwnProperty.call(sourceLabels, source);
}

/**
 * Explicit per-node correction; never part of MemberRow's generic Save.
 * Uses only the audited compare-and-swap RPC; no fallback to setPickupYear.
 */
export function AcePickupYearEditor({
  member, familyName, big, littles, familyYears, evidence, ready, onSaved, onConflict,
}: {
  member: AceFamilyMember;
  familyName: string;
  big: AceFamilyMember | null;
  littles: readonly AceFamilyMember[];
  familyYears: readonly number[];
  evidence: readonly AcePickupEvidenceRow[];
  ready: boolean;
  onSaved: () => Promise<void>;
  onConflict: () => Promise<void>;
}) {
  const uid = useId();
  const [expanded, setExpanded] = useState(false);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const {
    register, handleSubmit, setValue, reset, watch, formState: { errors },
  } = useForm<AcePickupYearFormData>({ resolver: zodResolver(acePickupYearSchema), defaultValues: asForm(member) });

  useEffect(() => {
    const approvedYear = member.pickup_academic_year_start;
    const storedTerm = member.pickup_term;
    reset({
      year: approvedYear == null ? '' : formatPickupAcademicYear(approvedYear),
      season: (storedTerm?.slice(0, 2) as PickupSeason | '') || '',
      sourceKind: 'admin_entry',
    });
    setEvidenceId(null);
    setConfirm(null);
  }, [member.id, member.pickup_academic_year_start, member.pickup_term, reset]);

  const year = watch('year');
  const season = watch('season');
  const sourceKind = watch('sourceKind');
  const parsed = parsePickupValue(year);
  const next: Pickup | null = parsed.kind === 'academic_year'
    ? {
        academicYearStart: parsed.academicYearStart,
        term: season ? pickupTermCode(season, parsed.academicYearStart) : null,
      }
    : null;
  const current = approvedOf(member);
  const selectedEvidence = evidence.find(e => e.id === evidenceId) ?? null;
  const consistentEvidence = selectedEvidence
    ? next?.academicYearStart === selectedEvidence.candidate_academic_year_start
      && next?.term === selectedEvidence.candidate_term
      && sourceKind === selectedEvidence.source_kind
    : true;
  const warnings = next ? pickupChangeWarnings(member, {
    pickup_academic_year_start: next.academicYearStart,
    pickup_term: next.term,
  }, big, littles) : [];
  // A pending candidate can still require approval when its value matches the approved node.
  const approvingPendingEvidence = selectedEvidence?.review_status === 'pending' && consistentEvidence;
  const eligible = ready && !!next && consistentEvidence && (!same(next, current) || approvingPendingEvidence);

  const queueConfirmation = (data: AcePickupYearFormData) => {
    const parsedYear = parsePickupValue(data.year);
    if (parsedYear.kind !== 'academic_year') return;
    const candidate = {
      academicYearStart: parsedYear.academicYearStart,
      term: data.season ? pickupTermCode(data.season, parsedYear.academicYearStart) : null,
    };
    if (!eligible) return;
    setError(null);
    setConfirm({
      next: candidate, sourceKind: data.sourceKind,
      evidenceId: selectedEvidence && consistentEvidence ? selectedEvidence.id : null,
    });
  };

  const selectEvidenceCandidate = (row: AcePickupEvidenceRow) => {
    if (!approvedEvidenceSource(row.source_kind) || row.candidate_academic_year_start == null) return;
    const canonicalTerm = row.candidate_term;
    const seasonValue = canonicalTerm ? canonicalTerm.slice(0, 2) : '';
    if (seasonValue !== '' && seasonValue !== 'FA' && seasonValue !== 'WI' && seasonValue !== 'SP') return;
    setValue('year', formatPickupAcademicYear(row.candidate_academic_year_start), { shouldValidate: true });
    setValue('season', seasonValue as PickupSeason | '', { shouldValidate: true });
    setValue('sourceKind', row.source_kind, { shouldValidate: true });
    setEvidenceId(row.id);
    setSuccess(null);
    setError(null);
  };

  const applyCorrection = async () => {
    if (!confirm) return;
    let changed = false;
    try {
      const result = await aceFamiliesRepository.correctPickupYear({
        nodeId: member.id, expected: current, next: confirm.next,
        sourceKind: confirm.sourceKind, evidenceId: confirm.evidenceId,
      });
      changed = result.changed;
    } catch (err) {
      const message = toUserMessage(err, 'Unable to save pickup year. Review the source and try again.');
      setError(message);
      if (err instanceof DatabaseError && err.code === 'P0001') {
        try { await onConflict(); } catch { /* Conflict still requires a manual refresh; never retry a stale write. */ }
      }
      throw new Error(message);
    }
    setError(null);
    setSuccess(changed
      ? 'Pickup year saved and audited. Only this node was changed.'
      : 'Evidence approval recorded. The approved pickup year is unchanged.');
    setConfirm(null);
    try {
      await onSaved();
    } catch {
      setError('The correction was saved, but the family view could not refresh. Reload before editing again.');
    }
  };

  const unknown = () => {
    if (!ready || current.academicYearStart === null) return;
    setError(null);
    setConfirm({ next: { academicYearStart: null, term: null }, sourceKind, evidenceId: null });
  };

  const pending = evidence.filter(row => row.review_status === 'pending');
  const superseded = evidence.filter(row => row.review_status === 'superseded');
  const yearStatus = formatPickupLabel(pickupYearOf(member)) ?? 'Unknown';
  return (
    <div className="mt-3 border-t border-[var(--color-border)] pt-3">
      <button type="button" className="vsa-btn-secondary min-h-11 text-xs" aria-expanded={expanded}
        aria-controls={uid + '-editor'} onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Hide pickup-year review' : 'Review pickup year'} · {yearStatus}
      </button>
      {expanded && (
        <div id={uid + '-editor'} className="mt-3 space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-3 sm:p-4">
          <div>
            <h4 className="font-serif text-base font-semibold text-[var(--color-text)]">
              Pickup-year correction: {member.name}
            </h4>
            <p className="mt-1 text-xs text-[var(--color-text2)]">
              Fam: {familyName} · Node: {member.id} · Current approved: {describe(current)}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text2)]">
              Big: {big ? big.name + ' (' + describe(approvedOf(big)) + ')' : 'No recorded Big'}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text2)]">
              Littles: {littles.length ? littles.map(child => child.name + ' (' + describe(approvedOf(child)) + ')').join('; ') : 'None recorded'}
            </p>
          </div>
          {!ready ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              Private year evidence is unavailable or still loading. Corrections are disabled until the family review is ready.
            </p>
          ) : (
            <>
              <form onSubmit={handleSubmit(queueConfirmation)} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={uid + '-year'} className={labelClass}>Pickup academic year</label>
                    <input id={uid + '-year'} type="text" list={uid + '-years'} placeholder="2023–24"
                      autoComplete="off" className={fieldClass} aria-invalid={!!errors.year}
                      aria-describedby={errors.year ? uid + '-year-error' : undefined}
                      {...register('year', { onChange: () => { setEvidenceId(null); setSuccess(null); } })} />
                    <datalist id={uid + '-years'}>
                      {familyYears.map(y => <option key={y} value={formatPickupAcademicYear(y)} />)}
                    </datalist>
                    {errors.year && <p id={uid + '-year-error'} role="alert" className="mt-1 text-xs text-red-600">{errors.year.message}</p>}
                  </div>
                  <div>
                    <label htmlFor={uid + '-season'} className={labelClass}>Exact pickup term (optional)</label>
                    <select id={uid + '-season'} className={fieldClass} {...register('season', {
                      onChange: () => { setEvidenceId(null); setSuccess(null); },
                    })}>
                      <option value="">Unknown term · year only</option>
                      <option value="FA">Fall</option>
                      <option value="WI">Winter</option>
                      <option value="SP">Spring</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor={uid + '-source'} className={labelClass}>Evidence/source category</label>
                  <select id={uid + '-source'} className={fieldClass} {...register('sourceKind', {
                    onChange: () => { setEvidenceId(null); setSuccess(null); },
                  })}>
                    {(Object.keys(sourceLabels) as AcePickupCorrectionSourceKind[]).map(kind =>
                      <option key={kind} value={kind}>{sourceLabels[kind]}</option>)}
                  </select>
                </div>
                <p role="status" className="text-xs text-[var(--color-text2)]">
                  Preview: {describe(current)} → {next ? describe(next) : 'Enter a complete academic year'}.
                  Big, Littles, family, photos, member link and publication do not change.
                </p>
                {warnings.length > 0 && <ul aria-label="Pickup-year warnings" className="list-disc space-y-1 pl-5 text-xs text-amber-700 dark:text-amber-300">
                  {warnings.map(flag => <li key={flag}>{flagLabels[flag]}</li>)}
                </ul>}
                {!consistentEvidence && <p role="alert" className="text-xs text-red-600">Selected evidence no longer matches this proposed year/term. Choose the source again or use a reviewed admin entry.</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="vsa-btn-primary min-h-11 text-sm" disabled={!eligible}>Review and save year</button>
                  <button type="button" className="vsa-btn-secondary min-h-11 text-sm" disabled={current.academicYearStart === null}
                    onClick={unknown}>Set to Unknown…</button>
                  <button type="button" className="vsa-btn-secondary min-h-11 text-sm"
                    onClick={() => { reset(asForm(member)); setEvidenceId(null); setError(null); setSuccess(null); }}>Discard draft</button>
                </div>
              </form>
              <div className="border-t border-[var(--color-border)] pt-3">
                <h5 className="text-sm font-semibold text-[var(--color-text)]">Private source evidence ({evidence.length})</h5>
                <p className="mt-1 text-xs text-[var(--color-text2)]">
                  Candidates are not verified pickup years. Approving one requires the audited Save confirmation.
                </p>
                {pending.length === 0 ? <p className="mt-2 text-xs text-[var(--color-text2)]">No pending dated evidence for this node.</p> :
                  <ul className="mt-2 space-y-2">
                    {pending.map(row => <li key={row.id} className="rounded border border-[var(--color-border)] p-2 text-xs text-[var(--color-text2)]">
                      {sourceLabels[approvedEvidenceSource(row.source_kind) ? row.source_kind : 'admin_entry']}
                      {' · '}{row.candidate_academic_year_start == null ? 'Unplaced source' : describe({
                        academicYearStart: row.candidate_academic_year_start, term: row.candidate_term,
                      })} · Pending
                      {row.candidate_academic_year_start !== null && approvedEvidenceSource(row.source_kind) &&
                        <button type="button" className="vsa-btn-secondary ml-2 min-h-11 text-xs" onClick={() => selectEvidenceCandidate(row)}>
                          Use candidate
                        </button>}
                    </li>)}
                  </ul>}
                {superseded.length > 0 && <p className="mt-2 text-xs text-[var(--color-text2)]">
                  {superseded.length} earlier source approval(s) superseded; history is retained, not deleted.
                </p>}
              </div>
            </>
          )}
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {success && <p role="status" className="text-sm text-[var(--color-text)]">{success}</p>}
        </div>
      )}
      <ConfirmDialog open={confirm !== null} title={confirm?.next.academicYearStart === null ? 'Set pickup year to Unknown?' : 'Confirm pickup-year correction'}
        description={`Change ${member.name} in ${familyName}: ${describe(current)} → ${confirm ? describe(confirm.next) : ''}. This is audited and affects only this ACE node.`}
        consequences={['The Big, Littles, family, member identity, photo and publication state remain unchanged.', 'If another admin changed the approved value, this operation is rejected; refresh and review the latest value.']}
        confirmLabel={confirm?.next.academicYearStart === null ? 'Confirm Unknown' : 'Confirm audited correction'}
        danger={confirm?.next.academicYearStart === null} onConfirm={applyCorrection} onClose={() => setConfirm(null)} />
    </div>
  );
}
