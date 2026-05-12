import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { PageTitle } from '../../components/common/PageTitle';
import { academicTermsRepository } from '../../data/repos/academicTerms';
import { cabinetYearsRepository } from '../../data/repos/cabinetYears';
import { useAcademicTerms } from '../../hooks/useAcademicTerms';
import { useCabinetYears } from '../../hooks/useCabinetYears';
import {
  AcademicQuarter,
  formatAcademicYear,
  getAcademicTermCode,
  getAcademicTermDateRange,
  getAcademicTermDisplayOrder,
  getAcademicTermMeta,
} from '../../lib/academicTerms';
import { AcademicTerm, CabinetYear } from '../../types';

const inputCls = 'mt-1 block w-full rounded border px-3 py-2 text-sm focus:outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600/20 font-sans';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-[0.07em]';
const fieldStyle = {
  borderColor: 'var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
};

type TermForm = {
  id?: string;
  quarter: AcademicQuarter;
  calendarYear: number;
  code: string;
  label: string;
  academic_year_start: number;
  academic_year_end: number;
  starts_on: string;
  ends_on: string;
  display_order: number;
};

type CabinetYearForm = {
  id?: string;
  label: string;
  slug: string;
  start_year: number;
  end_year: number;
  theme_name: string;
  display_order: number;
};

const QUARTERS: Array<{ value: AcademicQuarter; label: string }> = [
  { value: 'fall', label: 'Fall' },
  { value: 'winter', label: 'Winter' },
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
];

function academicYearStartFor(quarter: AcademicQuarter, calendarYear: number) {
  return quarter === 'fall' ? calendarYear : calendarYear - 1;
}

function buildTermForm(quarter: AcademicQuarter, calendarYear: number, existing?: Partial<AcademicTerm>): TermForm {
  const academicYearStart = existing?.academic_year_start ?? academicYearStartFor(quarter, calendarYear);
  const academicYearEnd = existing?.academic_year_end ?? academicYearStart + 1;
  const range = getAcademicTermDateRange(quarter, calendarYear);

  return {
    id: existing?.id,
    quarter,
    calendarYear,
    code: existing?.code ?? getAcademicTermCode(quarter, calendarYear),
    label: existing?.label ?? `${QUARTERS.find((item) => item.value === quarter)?.label ?? 'Term'} ${calendarYear}`,
    academic_year_start: academicYearStart,
    academic_year_end: academicYearEnd,
    starts_on: existing?.starts_on ?? range.startsOn,
    ends_on: existing?.ends_on ?? range.endsOn,
    display_order: existing?.display_order ?? getAcademicTermDisplayOrder(quarter, academicYearStart),
  };
}

function emptyTermForm() {
  const now = new Date();
  const meta = getAcademicTermMeta(now);
  return buildTermForm(meta?.quarter ?? 'fall', meta?.calendarYear ?? now.getFullYear());
}

function termToForm(term: AcademicTerm): TermForm {
  const yearFromCode = Number(`20${term.code.slice(-2)}`);
  const calendarYear = Number.isFinite(yearFromCode) ? yearFromCode : term.academic_year_start;
  return buildTermForm(term.quarter, calendarYear, term);
}

function buildCabinetYearForm(startYear: number, existing?: Partial<CabinetYear>): CabinetYearForm {
  const endYear = existing?.end_year ?? startYear + 1;
  return {
    id: existing?.id,
    label: existing?.label ?? `${startYear}-${endYear} Cabinet`,
    slug: existing?.slug ?? `${startYear}-${endYear}`,
    start_year: existing?.start_year ?? startYear,
    end_year: endYear,
    theme_name: existing?.theme_name ?? '',
    display_order: existing?.display_order ?? startYear,
  };
}

function emptyCabinetYearForm() {
  return buildCabinetYearForm(new Date().getFullYear());
}

function cabinetYearToForm(year: CabinetYear): CabinetYearForm {
  return buildCabinetYearForm(year.start_year, year);
}

function updateNewCabinetYearStartYear(current: CabinetYearForm, startYear: number): CabinetYearForm {
  if (current.id) {
    return {
      ...current,
      start_year: startYear,
    };
  }

  return buildCabinetYearForm(startYear);
}

function Header() {
  return (
    <div className="border-b" style={{ padding: '20px 28px 16px', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <h1 className="font-sans text-base font-semibold tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>
        Years & Terms
      </h1>
      <p className="mt-0.5 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
        Keep event archives and cabinet archives organized without changing code.
      </p>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded border px-5 py-8 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)' }}>
      {children}
    </div>
  );
}

export default function AdminYearsTerms() {
  const {
    terms,
    loading: termsLoading,
    error: termsError,
    refreshTerms,
  } = useAcademicTerms();
  const {
    cabinetYears,
    loading: yearsLoading,
    error: yearsError,
    refreshCabinetYears,
  } = useCabinetYears();
  const [termForm, setTermForm] = useState<TermForm>(() => emptyTermForm());
  const [cabinetYearForm, setCabinetYearForm] = useState<CabinetYearForm>(() => emptyCabinetYearForm());
  const [savingTerm, setSavingTerm] = useState(false);
  const [savingCabinetYear, setSavingCabinetYear] = useState(false);
  const [settingActiveId, setSettingActiveId] = useState<string | null>(null);

  const activeTerm = useMemo(() => terms.find((term) => term.is_active), [terms]);
  const activeCabinetYear = useMemo(() => cabinetYears.find((year) => year.is_active), [cabinetYears]);

  useEffect(() => {
    if (!termForm.id) {
      setTermForm((current) => buildTermForm(current.quarter, current.calendarYear));
    }
  }, [termForm.quarter, termForm.calendarYear, termForm.id]);

  function resetTermForm() {
    setTermForm(emptyTermForm());
  }

  function resetCabinetYearForm() {
    setCabinetYearForm(emptyCabinetYearForm());
  }

  async function handleTermSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      setSavingTerm(true);
      const payload = {
        code: termForm.code.trim().toUpperCase(),
        label: termForm.label.trim(),
        academic_year_start: Number(termForm.academic_year_start),
        academic_year_end: Number(termForm.academic_year_end),
        quarter: termForm.quarter,
        starts_on: termForm.starts_on || null,
        ends_on: termForm.ends_on || null,
        is_active: terms.find((term) => term.id === termForm.id)?.is_active ?? false,
        display_order: Number(termForm.display_order),
      };

      if (termForm.id) {
        await academicTermsRepository.updateTerm(termForm.id, payload);
        toast.success('Academic term updated');
      } else {
        await academicTermsRepository.createTerm(payload);
        toast.success('Academic term created');
      }
      resetTermForm();
      refreshTerms();
    } catch (error) {
      console.error(error);
      toast.error(termForm.id ? 'Failed to update academic term' : 'Failed to create academic term');
    } finally {
      setSavingTerm(false);
    }
  }

  async function handleCabinetYearSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      setSavingCabinetYear(true);
      const payload = {
        label: cabinetYearForm.label.trim(),
        slug: cabinetYearForm.slug.trim(),
        start_year: Number(cabinetYearForm.start_year),
        end_year: Number(cabinetYearForm.end_year),
        theme_name: cabinetYearForm.theme_name.trim() || null,
        is_active: cabinetYears.find((year) => year.id === cabinetYearForm.id)?.is_active ?? false,
        display_order: Number(cabinetYearForm.display_order),
      };

      if (cabinetYearForm.id) {
        await cabinetYearsRepository.updateYear(cabinetYearForm.id, payload);
        toast.success('Cabinet year updated');
      } else {
        await cabinetYearsRepository.createYear(payload);
        toast.success('Cabinet year created');
      }
      resetCabinetYearForm();
      refreshCabinetYears();
    } catch (error) {
      console.error(error);
      toast.error(cabinetYearForm.id ? 'Failed to update cabinet year' : 'Failed to create cabinet year');
    } finally {
      setSavingCabinetYear(false);
    }
  }

  async function setActiveTerm(id: string) {
    try {
      setSettingActiveId(id);
      await academicTermsRepository.setActiveTerm(id);
      toast.success('Active academic term updated');
      refreshTerms();
    } catch (error) {
      console.error(error);
      toast.error('Failed to set active academic term');
    } finally {
      setSettingActiveId(null);
    }
  }

  async function setActiveCabinetYear(id: string) {
    try {
      setSettingActiveId(id);
      await cabinetYearsRepository.setActiveYear(id);
      toast.success('Active cabinet year updated');
      refreshCabinetYears();
    } catch (error) {
      console.error(error);
      toast.error('Failed to set active cabinet year');
    } finally {
      setSettingActiveId(null);
    }
  }

  return (
    <>
      <PageTitle title="Years & Terms" />
      <Header />

      <div className="space-y-6" style={{ padding: '24px 28px' }}>
        <div className="rounded-md border p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <h2 className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            How active/current works
          </h2>
          <p className="mt-2 max-w-3xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
            The active academic term labels current event planning. The active cabinet year is the default public cabinet.
            Older rows stay available for archive browsing. Only one row in each section should be active.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-md border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                Academic Terms
              </h2>
              <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
                Used by events for term assignment and public archive filtering.
              </p>
            </div>

            <form onSubmit={handleTermSubmit} className="space-y-4 border-b p-5" style={{ borderColor: 'var(--color-border)' }}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Quarter</label>
                  <select
                    value={termForm.quarter}
                    onChange={(event) => setTermForm({ ...termForm, quarter: event.target.value as AcademicQuarter })}
                    className={inputCls}
                    style={fieldStyle}
                  >
                    {QUARTERS.map((quarter) => (
                      <option key={quarter.value} value={quarter.value}>{quarter.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Calendar Year</label>
                  <input
                    type="number"
                    value={termForm.calendarYear}
                    onChange={(event) => setTermForm({ ...termForm, calendarYear: Number(event.target.value) })}
                    className={inputCls}
                    style={fieldStyle}
                  />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Code</label>
                  <input value={termForm.code} onChange={(event) => setTermForm({ ...termForm, code: event.target.value })} className={inputCls} style={fieldStyle} required />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Label</label>
                  <input value={termForm.label} onChange={(event) => setTermForm({ ...termForm, label: event.target.value })} className={inputCls} style={fieldStyle} required />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Starts On</label>
                  <input type="date" value={termForm.starts_on} onChange={(event) => setTermForm({ ...termForm, starts_on: event.target.value })} className={inputCls} style={fieldStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Ends On</label>
                  <input type="date" value={termForm.ends_on} onChange={(event) => setTermForm({ ...termForm, ends_on: event.target.value })} className={inputCls} style={fieldStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Academic Year</label>
                  <input value={formatAcademicYear(termForm.academic_year_start)} className={inputCls} style={fieldStyle} disabled />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Display Order</label>
                  <input type="number" value={termForm.display_order} onChange={(event) => setTermForm({ ...termForm, display_order: Number(event.target.value) })} className={inputCls} style={fieldStyle} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={savingTerm} className="rounded px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: 'var(--color-text)', color: 'var(--color-bg)' }}>
                  {savingTerm ? 'Saving...' : termForm.id ? 'Save Term' : 'Create Term'}
                </button>
                {termForm.id && (
                  <button type="button" onClick={resetTermForm} className="rounded border px-4 py-2 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>

            <div className="p-5">
              {termsLoading ? (
                <EmptyState>Loading academic terms...</EmptyState>
              ) : termsError ? (
                <EmptyState>Academic terms could not be loaded.</EmptyState>
              ) : terms.length === 0 ? (
                <EmptyState>No academic terms yet. Create Fall, Winter, Spring, and Summer rows as needed.</EmptyState>
              ) : (
                <div className="space-y-2">
                  {terms.map((term) => (
                    <div key={term.id} className="rounded border p-3" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>{term.label}</p>
                            <span className="font-mono text-[10px] uppercase" style={{ color: 'var(--color-text3)' }}>{term.code}</span>
                            {term.is_active && <span className="rounded bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">Active</span>}
                          </div>
                          <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
                            {term.starts_on ?? 'No start'} to {term.ends_on ?? 'No end'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setTermForm(termToForm(term))} className="rounded border px-3 py-1.5 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
                            Edit
                          </button>
                          {!term.is_active && (
                            <button type="button" onClick={() => setActiveTerm(term.id)} disabled={settingActiveId === term.id} className="rounded border px-3 py-1.5 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                              {settingActiveId === term.id ? 'Setting...' : 'Make Active'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {activeTerm && (
                <p className="mt-4 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
                  Current event planning term: {activeTerm.label}.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-md border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                Cabinet Years
              </h2>
              <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
                Used by cabinet members and the public cabinet archive.
              </p>
            </div>

            <form onSubmit={handleCabinetYearSubmit} className="space-y-4 border-b p-5" style={{ borderColor: 'var(--color-border)' }}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Start Year</label>
                  <input
                    type="number"
                    value={cabinetYearForm.start_year}
                    onChange={(event) => setCabinetYearForm(updateNewCabinetYearStartYear(cabinetYearForm, Number(event.target.value)))}
                    className={inputCls}
                    style={fieldStyle}
                  />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-text3)' }}>End Year</label>
                  <input type="number" value={cabinetYearForm.end_year} onChange={(event) => setCabinetYearForm({ ...cabinetYearForm, end_year: Number(event.target.value) })} className={inputCls} style={fieldStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Label</label>
                  <input value={cabinetYearForm.label} onChange={(event) => setCabinetYearForm({ ...cabinetYearForm, label: event.target.value })} className={inputCls} style={fieldStyle} required />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Slug</label>
                  <input value={cabinetYearForm.slug} onChange={(event) => setCabinetYearForm({ ...cabinetYearForm, slug: event.target.value })} className={inputCls} style={fieldStyle} required />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Theme Name</label>
                  <input value={cabinetYearForm.theme_name} onChange={(event) => setCabinetYearForm({ ...cabinetYearForm, theme_name: event.target.value })} className={inputCls} style={fieldStyle} placeholder="Optional cabinet theme" />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Display Order</label>
                  <input type="number" value={cabinetYearForm.display_order} onChange={(event) => setCabinetYearForm({ ...cabinetYearForm, display_order: Number(event.target.value) })} className={inputCls} style={fieldStyle} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={savingCabinetYear} className="rounded px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: 'var(--color-text)', color: 'var(--color-bg)' }}>
                  {savingCabinetYear ? 'Saving...' : cabinetYearForm.id ? 'Save Cabinet Year' : 'Create Cabinet Year'}
                </button>
                {cabinetYearForm.id && (
                  <button type="button" onClick={resetCabinetYearForm} className="rounded border px-4 py-2 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>

            <div className="p-5">
              {yearsLoading ? (
                <EmptyState>Loading cabinet years...</EmptyState>
              ) : yearsError ? (
                <EmptyState>Cabinet years could not be loaded.</EmptyState>
              ) : cabinetYears.length === 0 ? (
                <EmptyState>No cabinet years yet. Create one before assigning cabinet members.</EmptyState>
              ) : (
                <div className="space-y-2">
                  {cabinetYears.map((year) => (
                    <div key={year.id} className="rounded border p-3" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>{year.label}</p>
                            <span className="font-mono text-[10px] uppercase" style={{ color: 'var(--color-text3)' }}>{year.slug}</span>
                            {year.is_active && <span className="rounded bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">Active</span>}
                          </div>
                          <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
                            {year.theme_name || 'No theme name set'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setCabinetYearForm(cabinetYearToForm(year))} className="rounded border px-3 py-1.5 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
                            Edit
                          </button>
                          {!year.is_active && (
                            <button type="button" onClick={() => setActiveCabinetYear(year.id)} disabled={settingActiveId === year.id} className="rounded border px-3 py-1.5 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                              {settingActiveId === year.id ? 'Setting...' : 'Make Active'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {activeCabinetYear && (
                <p className="mt-4 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
                  Public cabinet default: {activeCabinetYear.label}.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
