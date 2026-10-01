import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useQueryClient } from 'react-query';
import { PageTitle } from '../../components/common/PageTitle';
import { PreflightSummary } from '../../components/features/admin/ops';
import { yearSetupRepository } from '../../data/repos/yearSetup';
import { useAuth } from '../../hooks/useAuth';
import { useCabinetYears } from '../../hooks/useCabinetYears';
import { APPLICATION_STATUS_LABELS } from '../../lib/applicationLinks';
import { formatYearSpan, pluralize } from '../../lib/operationalStatus';
import {
  EMPTY_SNAPSHOT,
  PlanAction,
  TermInput,
  YearSetupOptions,
  YearSetupReport,
  YearSetupSnapshot,
  buildSetupSummary,
  buildYearSetupPlan,
  defaultSetupOptions,
  planApplicationReset,
} from '../../lib/yearSetup';

const fieldCls =
  'w-full rounded border bg-[var(--color-surface2)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] disabled:opacity-60';
const labelCls = 'mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.1em]';

const ACTION_LABEL: Record<PlanAction, string> = {
  create: 'Will create',
  exists: 'Already exists',
  skip: 'Not included',
  blocked: 'Blocked',
};

function ActionPill({ action }: { action: PlanAction }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 font-sans text-[11px] font-semibold border-[var(--color-border)] bg-surface2 text-text-primary"
      data-action={action}
    >
      {ACTION_LABEL[action]}
    </span>
  );
}

function Step({ number, title, children, aside }: { number: number; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="scrapbook-paper p-5 border-[var(--color-border)] bg-surface" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-lg font-bold text-text-primary">
          <span className="mr-2 font-mono text-xs text-text-muted">{number}</span>
          {title}
        </h3>
        {aside}
      </div>
      <div className="mt-3 space-y-3 text-sm text-text-secondary">{children}</div>
    </section>
  );
}

function Check({ id, checked, onChange, disabled, children }: { id: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; children: ReactNode }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer select-none items-start gap-2 text-sm text-text-primary">
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 cursor-pointer rounded border-[var(--color-border)] bg-transparent text-[var(--brand)] focus:ring-[var(--brand)]" />
      <span>{children}</span>
    </label>
  );
}

export default function AdminYearSetup() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const { cabinetYears, loading: loadingYears, refreshCabinetYears } = useCabinetYears();

  const defaultStartYear = useMemo(() => {
    const active = cabinetYears.find((year) => year.is_active);
    const base = active?.start_year ?? Math.max(0, ...cabinetYears.map((year) => year.start_year));
    return base > 0 ? base + 1 : new Date().getFullYear();
  }, [cabinetYears]);

  const [startYear, setStartYear] = useState<number | null>(null);
  const targetYear = startYear ?? defaultStartYear;
  const [snapshot, setSnapshot] = useState<YearSetupSnapshot>(EMPTY_SNAPSHOT);
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [options, setOptions] = useState<YearSetupOptions | null>(null);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<YearSetupReport | null>(null);
  const [selectedApps, setSelectedApps] = useState<Record<string, boolean>>({});
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [resetting, setResetting] = useState(false);

  const sourceDefault = useMemo(() => {
    const previous = cabinetYears
      .filter((year) => year.start_year < targetYear)
      .sort((a, b) => b.start_year - a.start_year)[0];
    return previous?.id ?? null;
  }, [cabinetYears, targetYear]);

  const loadSnapshot = useCallback(async (year: number) => {
    setLoadFailed(false);
    try {
      const next = await yearSetupRepository.loadSnapshot(year);
      setSnapshot(next);
      setLoadedFor(year);
      return next;
    } catch (err) {
      console.error(err);
      setLoadFailed(true);
      toast.error('Failed to look up the new year.');
      return null;
    }
  }, []);

  useEffect(() => {
    if (loadingYears) return;
    setReport(null);
    setResetConfirmed(false);
    setOptions(defaultSetupOptions(targetYear, sourceDefault));
    loadSnapshot(targetYear).then((next) => {
      if (!next) return;
      const reset = planApplicationReset(next.applications);
      setSelectedApps(Object.fromEntries(reset.rows.map((row) => [row.id, row.selectedByDefault])));
    });
  }, [targetYear, sourceDefault, loadingYears, loadSnapshot]);

  const ready = options !== null && loadedFor === targetYear;
  const plan = useMemo(() => (options ? buildYearSetupPlan(targetYear, snapshot, options) : null), [targetYear, snapshot, options]);
  const resetPlan = useMemo(() => planApplicationReset(snapshot.applications), [snapshot.applications]);
  const summary = useMemo(() => (plan ? buildSetupSummary(plan, resetPlan) : []), [plan, resetPlan]);

  function patchOptions(patch: Partial<YearSetupOptions>) {
    setOptions((current) => (current ? { ...current, ...patch } : current));
  }
  function patchTerm(index: number, patch: Partial<TermInput>) {
    setOptions((current) => current && { ...current, terms: current.terms.map((term, i) => (i === index ? { ...term, ...patch } : term)) });
  }

  async function createSetup() {
    if (!options || !plan) return;
    setRunning(true);
    try {
      const result = await yearSetupRepository.runSetup(targetYear, options, userId);
      setReport(result.report);
      await loadSnapshot(targetYear);
      await refreshCabinetYears();
      queryClient.invalidateQueries('cabinet-years');
      if (result.report.failed > 0) toast.error(`${pluralize(result.report.failed, 'step')} failed. Review the report below; safe to run again.`);
      else toast.success(result.report.created > 0 ? `Setup complete: ${result.report.created} created, ${result.report.existing} already existed.` : 'Everything already existed. Nothing was changed.');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error && err.message ? err.message : 'Setup failed. Nothing was activated; it is safe to run again.');
    } finally {
      setRunning(false);
    }
  }

  async function resetApplications() {
    const chosen = resetPlan.rows.filter((row) => selectedApps[row.id]);
    if (chosen.length === 0) return;
    setResetting(true);
    try {
      const result = await yearSetupRepository.resetApplications(chosen, targetYear);
      await loadSnapshot(targetYear);
      setResetConfirmed(false);
      if (result.failed.length > 0) toast.error(`${result.failed.length} window${result.failed.length === 1 ? '' : 's'} could not be updated.`);
      else toast.success(`Updated ${pluralize(result.updated, 'application window')}. Add real dates and links in Applications before opening any.`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to reset applications.');
    } finally {
      setResetting(false);
    }
  }

  const yearLabel = formatYearSpan(targetYear);
  const writeCount = plan?.writeCount ?? 0;
  const selectedCount = resetPlan.rows.filter((row) => selectedApps[row.id] && (row.willDisable || row.willReplaceTiming)).length;

  return (
    <>
      <PageTitle title="New Year Setup" />
      <Toaster position="top-right" />

      <div className="border-b px-6 py-6 sm:px-8 sm:py-8 border-[var(--color-border)] bg-surface">
        <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl text-text-primary">Start {yearLabel}</h1>
        <p className="mt-2 max-w-3xl font-sans text-sm leading-relaxed text-text-secondary">
          Review what already exists for the new school year, then create only what is missing. Nothing is written until you press Create Setup. Terms and the Cabinet year are created inactive, past assignments are never copied, and no House is revealed.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="setup-year" className={`${labelCls} text-text-muted`}>School year starting</label>
            <select id="setup-year" className={`${fieldCls} w-auto border-[var(--color-border)]`} value={targetYear} onChange={(event) => setStartYear(Number(event.target.value))}>
              {[defaultStartYear - 1, defaultStartYear, defaultStartYear + 1].map((year) => (
                <option key={year} value={year}>{formatYearSpan(year)}</option>
              ))}
            </select>
          </div>
          <Link to="/admin/years" className="rounded border px-2 py-1 text-xs font-semibold text-[var(--brand)] hover:bg-[var(--color-surface2)] border-[var(--color-border)]">Years &amp; Terms</Link>
          <Link to="/admin/cabinet/rollover" className="rounded border px-2 py-1 text-xs font-semibold text-[var(--brand)] hover:bg-[var(--color-surface2)] border-[var(--color-border)]">Cabinet Rollover</Link>
        </div>
      </div>

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {loadFailed && (
          <p className="rounded border px-4 py-3 text-sm text-red-600 dark:text-red-400 border-[var(--color-border)]">
            Could not look up the new year, so nothing can be previewed. Refresh and try again.
          </p>
        )}
        {!ready || !plan || !options ? (
          !loadFailed && <p className="py-10 text-center text-sm text-text-muted">Looking up {yearLabel}…</p>
        ) : (
          <>
            <Step number={1} title="Academic year">
              {plan.foundIn.length === 0 ? (
                <p>{yearLabel} was not found anywhere yet. Nothing will be duplicated.</p>
              ) : (
                <>
                  <p>{yearLabel} already exists in {plan.foundIn.length === 1 ? 'one place' : `${plan.foundIn.length} places`}. Setup only fills in what is missing.</p>
                  <ul className="list-disc space-y-1 pl-5 text-xs">{plan.foundIn.map((place) => <li key={place}>{place}</li>)}</ul>
                </>
              )}
            </Step>

            <Step number={2} title="Academic terms">
              <p className="text-xs">Created inactive. Activate a term from Years &amp; Terms when its quarter begins; setup never does. Dates are editable.</p>
              <ul className="space-y-3">
                {plan.terms.map((term, index) => {
                  const locked = term.action === 'exists';
                  return (
                    <li key={term.input.code} className="rounded border p-3 border-[var(--color-border)]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Check id={`term-${term.input.code}`} checked={term.input.include || locked} disabled={locked} onChange={(value) => patchTerm(index, { include: value })}>
                          <span className="font-semibold">{term.input.label}</span>
                          <span className="ml-2 font-mono text-[11px] text-text-muted">{term.input.code}{term.input.quarter === 'summer' ? ' · optional' : ''}</span>
                        </Check>
                        <ActionPill action={term.action} />
                      </div>
                      {!locked && (
                        <div className="mt-2 grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className={`${labelCls} text-text-muted`} htmlFor={`term-start-${term.input.code}`}>Starts</label>
                            <input id={`term-start-${term.input.code}`} type="date" className={`${fieldCls} border-[var(--color-border)]`} value={term.input.starts_on} onChange={(event) => patchTerm(index, { starts_on: event.target.value })} />
                          </div>
                          <div>
                            <label className={`${labelCls} text-text-muted`} htmlFor={`term-end-${term.input.code}`}>Ends</label>
                            <input id={`term-end-${term.input.code}`} type="date" className={`${fieldCls} border-[var(--color-border)]`} value={term.input.ends_on} onChange={(event) => patchTerm(index, { ends_on: event.target.value })} />
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Step>

            <Step number={3} title="Cabinet year" aside={<ActionPill action={plan.cabinetYear.action} />}>
              <p>{plan.cabinetYear.detail}</p>
              {plan.cabinetYear.action !== 'exists' && (
                <Check id="opt-cabinet-year" checked={options.createCabinetYear} onChange={(value) => patchOptions({ createCabinetYear: value })}>
                  Create the inactive {plan.cabinetYear.label} year
                </Check>
              )}
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs">Cabinet Rollover draft: {plan.rosterDraft.detail}</p>
                <ActionPill action={plan.rosterDraft.action} />
              </div>
              {plan.rosterDraft.action !== 'exists' && (
                <>
                  <Check id="opt-roster" checked={options.createRosterDraft} onChange={(value) => patchOptions({ createRosterDraft: value })}>
                    Create Cabinet Rollover Draft
                  </Check>
                  {options.createRosterDraft && (
                    <div>
                      <label htmlFor="opt-roster-source" className={`${labelCls} text-text-muted`}>Copy position structure from</label>
                      <select id="opt-roster-source" className={`${fieldCls} border-[var(--color-border)]`} value={options.rosterSourceCabinetYearId ?? ''} onChange={(event) => patchOptions({ rosterSourceCabinetYearId: event.target.value || null })}>
                        <option value="">Start empty</option>
                        {cabinetYears.map((year) => <option key={year.id} value={year.id}>{year.label}</option>)}
                      </select>
                      <p className="mt-1 text-[11px] text-text-muted">Role, board, and order only. No names, links, photos, or bios.</p>
                    </div>
                  )}
                </>
              )}
            </Step>

            <Step number={4} title="ACE" aside={<ActionPill action={plan.aceCycle.action} />}>
              <p>{plan.aceCycle.detail}</p>
              {plan.aceCycle.action !== 'exists' && (
                <Check id="opt-ace" checked={options.createAceCycle} onChange={(value) => patchOptions({ createAceCycle: value })}>
                  Create ACE assignment cycle
                </Check>
              )}
            </Step>

            <Step number={5} title="Interns" aside={<ActionPill action={plan.internCycle.action} />}>
              <p>{plan.internCycle.detail}</p>
              {plan.internCycle.action !== 'exists' && (
                <Check id="opt-interns" checked={options.createInternCycle} onChange={(value) => patchOptions({ createInternCycle: value })}>
                  Create Intern cohort cycle
                </Check>
              )}
            </Step>

            <Step number={6} title="Houses" aside={<ActionPill action={plan.houses.action} />}>
              <p>{plan.houses.detail}</p>
              <p className="text-xs">Previous-year House assignments are never copied, and House profiles and themes stay absent until leadership announces them.</p>
              {plan.houses.profilesExist && !plan.houses.batchExists && (
                <>
                  <Check id="opt-house-batch" checked={options.createEmptyHouseBatch} onChange={(value) => patchOptions({ createEmptyHouseBatch: value })}>
                    Create empty House assignment batch
                  </Check>
                  {options.createEmptyHouseBatch && (
                    <div>
                      <label htmlFor="opt-house-date" className={`${labelCls} text-text-muted`}>Effective start date</label>
                      <input id="opt-house-date" type="date" className={`${fieldCls} w-auto border-[var(--color-border)]`} value={options.houseEffectiveStartDate} onChange={(event) => patchOptions({ houseEffectiveStartDate: event.target.value })} />
                    </div>
                  )}
                </>
              )}
              <Link to="/admin/houses" className="text-xs font-semibold text-[var(--brand)] hover:underline">Open Houses →</Link>
            </Step>

            <Step number={7} title="Applications">
              <p className="text-xs">Reset is a separate action and is not part of Create Setup. It disables the windows you pick and replaces past timing with a disabled placeholder. It never opens a window and never touches a link. Add real dates and URLs in Applications.</p>
              {resetPlan.rows.length === 0 ? (
                <p>No application windows exist yet.</p>
              ) : (
                <ul className="space-y-2">
                  {resetPlan.rows.map((row) => {
                    const changes = row.willDisable || row.willReplaceTiming;
                    return (
                      <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 border-[var(--color-border)]">
                        <Check id={`app-${row.id}`} checked={!!selectedApps[row.id] && changes} disabled={!changes} onChange={(value) => setSelectedApps((current) => ({ ...current, [row.id]: value }))}>
                          <span className="font-semibold">{row.label}</span>
                          <span className="ml-2 text-[11px] text-text-muted">
                            {APPLICATION_STATUS_LABELS[row.status]}
                            {row.openNow ? ' · open now, leave alone unless you mean to close it' : ''}
                            {!changes ? ' · already disabled' : ''}
                            {row.willReplaceTiming ? ' · past timing will be replaced' : ''}
                          </span>
                        </Check>
                      </li>
                    );
                  })}
                </ul>
              )}
              {resetPlan.pending.length > 0 && (
                <>
                  <Check id="app-reset-confirm" checked={resetConfirmed} onChange={setResetConfirmed}>
                    I confirm: disable the selected application windows.
                  </Check>
                  <button type="button" className="vsa-btn-primary px-5 py-2 text-xs disabled:opacity-50" disabled={resetting || !resetConfirmed || selectedCount === 0} onClick={resetApplications}>
                    {resetting ? 'Resetting…' : `Reset ${pluralize(selectedCount, 'application window')}`}
                  </button>
                </>
              )}
              <Link to="/admin/applications" className="block text-xs font-semibold text-[var(--brand)] hover:underline">Open Applications →</Link>
            </Step>

            <PreflightSummary title={`${yearLabel} Setup`} lines={summary} />

            {report && (
              <section className="scrapbook-paper p-5 border-[var(--color-border)] bg-surface" aria-label="Setup report">
                <h3 className="font-serif text-lg font-bold text-text-primary">Setup report</h3>
                <ul className="mt-3 space-y-1 text-xs" data-testid="setup-report">
                  {report.steps.map((step) => (
                    <li key={step.key} className={step.outcome === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-text-secondary'}>
                      {step.outcome === 'created' ? '＋' : step.outcome === 'existing' ? '✓' : step.outcome === 'failed' ? '✕' : '○'} {step.label}: {step.detail}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="vsa-btn-primary px-6 py-2.5 text-sm disabled:opacity-50" disabled={running || writeCount === 0} onClick={createSetup}>
                {running ? 'Creating…' : 'Create Setup'}
              </button>
              <p className="text-xs text-text-muted">
                {writeCount === 0 ? 'Nothing left to create for this year.' : `${pluralize(writeCount, 'record')} will be created. Existing records are never duplicated.`}
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
