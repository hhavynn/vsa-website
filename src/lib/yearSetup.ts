// Pure logic for the New Year Setup wizard: detect what already exists for a
// target academic year, build a preview plan BEFORE any write, execute only the
// missing pieces through an injected gateway, and plan the (separate) next-year
// application reset. Nothing here touches the database.
//
// Invariants this module owns (each is covered by yearSetup.test.ts):
//   - Never duplicate an existing record; re-running reports what exists.
//   - Never activate a term or a cabinet year.
//   - Never copy House assignments or reveal House profiles.
//   - Never invent an application URL or enable a window.
import {
  AcademicQuarter,
  getAcademicTermCode,
  getAcademicTermDateRange,
  getAcademicTermDisplayOrder,
} from './academicTerms';
import { getApplicationStatus, applicationKeyLabel, combineLocalDateTime } from './applicationLinks';
import { PreflightLine, PreflightSeverity, formatYearSpan, pluralize } from './operationalStatus';
import type { ApplicationKey, ApplicationStatus } from '../types';

export const SETUP_QUARTERS: readonly AcademicQuarter[] = ['fall', 'winter', 'spring', 'summer'];

const QUARTER_LABEL: Record<AcademicQuarter, string> = {
  fall: 'Fall',
  winter: 'Winter',
  spring: 'Spring',
  summer: 'Summer',
};

// ─── Snapshot (what already exists) ──────────────────────────────────────────

export interface SnapshotTerm { id: string; code: string; academic_year_start: number; quarter: string; is_active: boolean }
export interface SnapshotCabinetYear { id: string; slug: string; label: string; start_year: number; is_active: boolean }
export interface SnapshotRosterCycle { id: string; cabinet_year_id: string; status: string }
export interface SnapshotAceCycle { id: string; academic_year_start: number; status: string }
export interface SnapshotInternCycle { id: string; academic_year_start: number; cabinet_year_id: string; status: string }
export interface SnapshotHouseBatch { id: string; status: string }
export interface SnapshotApplication {
  id: string;
  application_key: ApplicationKey;
  open_at: string;
  due_at: string;
  is_enabled: boolean;
}

export interface YearSetupSnapshot {
  terms: SnapshotTerm[];
  cabinetYears: SnapshotCabinetYear[];
  rosterCycles: SnapshotRosterCycle[];
  aceCycles: SnapshotAceCycle[];
  internCycles: SnapshotInternCycle[];
  /** House profiles (house_page_assets rows) that exist for the target year. */
  houseProfileCount: number;
  houseBatches: SnapshotHouseBatch[];
  applications: SnapshotApplication[];
}

export const EMPTY_SNAPSHOT: YearSetupSnapshot = {
  terms: [],
  cabinetYears: [],
  rosterCycles: [],
  aceCycles: [],
  internCycles: [],
  houseProfileCount: 0,
  houseBatches: [],
  applications: [],
};

// ─── Options (what the admin chose) ──────────────────────────────────────────

export interface TermInput {
  quarter: AcademicQuarter;
  include: boolean;
  code: string;
  label: string;
  starts_on: string;
  ends_on: string;
  display_order: number;
  academic_year_start: number;
  academic_year_end: number;
}

export function defaultTermInputs(startYear: number): TermInput[] {
  return SETUP_QUARTERS.map((quarter) => {
    const calendarYear = quarter === 'fall' ? startYear : startYear + 1;
    const range = getAcademicTermDateRange(quarter, calendarYear);
    return {
      quarter,
      // Summer is optional: off until the admin asks for it.
      include: quarter !== 'summer',
      code: getAcademicTermCode(quarter, calendarYear),
      label: `${QUARTER_LABEL[quarter]} ${calendarYear}`,
      starts_on: range.startsOn,
      ends_on: range.endsOn,
      display_order: getAcademicTermDisplayOrder(quarter, startYear),
      academic_year_start: startYear,
      academic_year_end: startYear + 1,
    };
  });
}

export interface YearSetupOptions {
  terms: TermInput[];
  createCabinetYear: boolean;
  createRosterDraft: boolean;
  /** Cabinet year whose position structure seeds the draft; null starts empty. */
  rosterSourceCabinetYearId: string | null;
  createAceCycle: boolean;
  createInternCycle: boolean;
  /** Only honored when House profiles already exist for the year. */
  createEmptyHouseBatch: boolean;
  houseEffectiveStartDate: string;
}

export function defaultSetupOptions(startYear: number, rosterSourceCabinetYearId: string | null = null): YearSetupOptions {
  const fall = defaultTermInputs(startYear)[0];
  return {
    terms: defaultTermInputs(startYear),
    createCabinetYear: true,
    createRosterDraft: true,
    rosterSourceCabinetYearId,
    createAceCycle: true,
    createInternCycle: true,
    createEmptyHouseBatch: false,
    houseEffectiveStartDate: fall.starts_on,
  };
}

// ─── Plan ────────────────────────────────────────────────────────────────────

export type PlanAction = 'create' | 'exists' | 'skip' | 'blocked';

export interface PlanItem {
  action: PlanAction;
  /** Id of the record that already exists, when action is 'exists'. */
  existingId?: string;
  detail: string;
}

export interface TermPlanItem extends PlanItem {
  input: TermInput;
}

export interface HousePlan extends PlanItem {
  profilesExist: boolean;
  batchExists: boolean;
  /** The reveal itself is never part of setup; this stays true unless profiles exist. */
  revealConfigured: boolean;
}

export interface YearSetupPlan {
  startYear: number;
  yearLabel: string;
  /** Where the target year already appears, for the "never duplicate" check. */
  foundIn: string[];
  terms: TermPlanItem[];
  cabinetYear: PlanItem & { slug: string; label: string };
  rosterDraft: PlanItem;
  aceCycle: PlanItem;
  internCycle: PlanItem;
  houses: HousePlan;
  /** Number of records Create Setup would write. */
  writeCount: number;
}

function findCabinetYear(snapshot: YearSetupSnapshot, startYear: number) {
  const slug = `${startYear}-${startYear + 1}`;
  return snapshot.cabinetYears.find((year) => year.slug === slug || year.start_year === startYear) ?? null;
}

const LIVE = (status: string) => status !== 'archived';

export function buildYearSetupPlan(
  startYear: number,
  snapshot: YearSetupSnapshot,
  options: YearSetupOptions,
): YearSetupPlan {
  const foundIn: string[] = [];
  const yearTerms = snapshot.terms.filter((term) => term.academic_year_start === startYear);
  if (yearTerms.length > 0) foundIn.push(`${pluralize(yearTerms.length, 'academic term')} (${yearTerms.map((term) => term.code).join(', ')})`);

  const cabinetYear = findCabinetYear(snapshot, startYear);
  if (cabinetYear) foundIn.push(`Cabinet year ${cabinetYear.label}`);

  const rosterCycle = cabinetYear
    ? snapshot.rosterCycles.find((cycle) => cycle.cabinet_year_id === cabinetYear.id && LIVE(cycle.status)) ?? null
    : null;
  if (rosterCycle) foundIn.push(`Cabinet roster (${rosterCycle.status})`);

  const aceCycle = snapshot.aceCycles.find((cycle) => cycle.academic_year_start === startYear && LIVE(cycle.status)) ?? null;
  if (aceCycle) foundIn.push(`ACE assignment cycle (${aceCycle.status})`);

  const internCycle = snapshot.internCycles.find((cycle) => cycle.academic_year_start === startYear && LIVE(cycle.status)) ?? null;
  if (internCycle) foundIn.push(`Intern cohort (${internCycle.status})`);

  if (snapshot.houseProfileCount > 0) foundIn.push(`${pluralize(snapshot.houseProfileCount, 'House profile')}`);
  const houseBatch = snapshot.houseBatches.find((batch) => LIVE(batch.status)) ?? null;
  if (houseBatch) foundIn.push(`House assignment batch (${houseBatch.status})`);

  const terms: TermPlanItem[] = options.terms.map((input) => {
    const existing = snapshot.terms.find(
      (term) => term.code === input.code || (term.academic_year_start === startYear && term.quarter === input.quarter),
    );
    if (existing) return { input, action: 'exists', existingId: existing.id, detail: `${input.label} already exists.` };
    if (!input.include) return { input, action: 'skip', detail: `${input.label} not included.` };
    return { input, action: 'create', detail: `${input.label} will be created (inactive).` };
  });

  const slug = `${startYear}-${startYear + 1}`;
  const cabinetYearPlan: YearSetupPlan['cabinetYear'] = cabinetYear
    ? { action: 'exists', existingId: cabinetYear.id, slug, label: cabinetYear.label, detail: `${cabinetYear.label} already exists${cabinetYear.is_active ? ' and is active' : ''}.` }
    : options.createCabinetYear
      ? { action: 'create', slug, label: `${slug} Cabinet`, detail: `${slug} Cabinet will be created (inactive).` }
      : { action: 'skip', slug, label: `${slug} Cabinet`, detail: 'Cabinet year not included.' };

  const cabinetYearAvailable = cabinetYearPlan.action === 'exists' || cabinetYearPlan.action === 'create';

  const rosterDraft: PlanItem = rosterCycle
    ? { action: 'exists', existingId: rosterCycle.id, detail: `A Cabinet roster already exists (${rosterCycle.status}).` }
    : !options.createRosterDraft
      ? { action: 'skip', detail: 'Cabinet roster draft not included.' }
      : !cabinetYearAvailable
        ? { action: 'blocked', detail: 'Needs a Cabinet year first.' }
        : { action: 'create', detail: options.rosterSourceCabinetYearId ? 'Cabinet draft will be created from last year’s positions (no people).' : 'An empty Cabinet draft will be created.' };

  const ace: PlanItem = aceCycle
    ? { action: 'exists', existingId: aceCycle.id, detail: `An ACE assignment cycle already exists (${aceCycle.status}).` }
    : options.createAceCycle
      ? { action: 'create', detail: 'An ACE assignment cycle will be created. Past Big/Little assignments are not copied.' }
      : { action: 'skip', detail: 'ACE assignment cycle not included.' };

  const intern: PlanItem = internCycle
    ? { action: 'exists', existingId: internCycle.id, detail: `An Intern cohort already exists (${internCycle.status}).` }
    : !options.createInternCycle
      ? { action: 'skip', detail: 'Intern cohort not included.' }
      : !cabinetYearAvailable
        ? { action: 'blocked', detail: 'Needs a Cabinet year first.' }
        : { action: 'create', detail: 'An Intern cohort cycle will be created.' };

  const profilesExist = snapshot.houseProfileCount > 0;
  const houses: HousePlan = {
    profilesExist,
    batchExists: !!houseBatch,
    revealConfigured: profilesExist,
    ...(houseBatch
      ? { action: 'exists' as const, existingId: houseBatch.id, detail: `A House assignment batch already exists (${houseBatch.status}).` }
      : profilesExist && options.createEmptyHouseBatch
        ? { action: 'create' as const, detail: 'An empty House assignment batch will be created. Nothing is assigned or revealed.' }
        : profilesExist
          ? { action: 'skip' as const, detail: 'House profiles exist. Create an empty assignment batch if you want one.' }
          : { action: 'skip' as const, detail: 'House reveal intentionally not configured. Nothing is copied or revealed.' }),
  };

  const writeCount =
    terms.filter((item) => item.action === 'create').length +
    [cabinetYearPlan, rosterDraft, ace, intern, houses].filter((item) => item.action === 'create').length;

  return {
    startYear,
    yearLabel: formatYearSpan(startYear),
    foundIn,
    terms,
    cabinetYear: cabinetYearPlan,
    rosterDraft,
    aceCycle: ace,
    internCycle: intern,
    houses,
    writeCount,
  };
}

// ─── Execution ───────────────────────────────────────────────────────────────

export interface YearSetupGateway {
  /** Must create the term inactive. */
  createTerm(input: TermInput): Promise<{ id: string }>;
  /** Must create the cabinet year inactive. */
  createCabinetYear(input: { slug: string; label: string; startYear: number }): Promise<{ id: string }>;
  createRosterDraft(input: { cabinetYearId: string; sourceCabinetYearId: string | null }): Promise<{ created: boolean; positionsCopied: number }>;
  createAceCycle(startYear: number): Promise<{ id: string }>;
  createInternCycle(input: { startYear: number; cabinetYearId: string }): Promise<{ id: string }>;
  createEmptyHouseBatch(input: { startYear: number; effectiveStartDate: string }): Promise<{ id: string }>;
}

export type StepOutcome = 'created' | 'existing' | 'skipped' | 'failed';

export interface StepResult {
  key: string;
  label: string;
  outcome: StepOutcome;
  detail: string;
}

export interface YearSetupReport {
  steps: StepResult[];
  created: number;
  existing: number;
  failed: number;
}

function message(error: unknown) {
  return error instanceof Error && error.message ? error.message : 'Unexpected error';
}

/**
 * Executes only the plan's 'create' items, in dependency order. A failed step
 * is reported and its dependents are skipped; earlier writes are kept (each is
 * independently safe to re-run). Never activates anything.
 */
export async function runYearSetup(
  plan: YearSetupPlan,
  options: YearSetupOptions,
  gateway: YearSetupGateway,
): Promise<YearSetupReport> {
  const steps: StepResult[] = [];
  const record = (key: string, label: string, outcome: StepOutcome, detail: string) => {
    steps.push({ key, label, outcome, detail });
  };

  for (const term of plan.terms) {
    const key = `term:${term.input.code}`;
    if (term.action === 'exists') record(key, term.input.label, 'existing', term.detail);
    else if (term.action !== 'create') record(key, term.input.label, 'skipped', term.detail);
    else {
      try {
        await gateway.createTerm(term.input);
        record(key, term.input.label, 'created', 'Created inactive.');
      } catch (error) {
        record(key, term.input.label, 'failed', message(error));
      }
    }
  }

  let cabinetYearId: string | null = plan.cabinetYear.existingId ?? null;
  const cabinetLabel = `Cabinet year ${plan.cabinetYear.label}`;
  if (plan.cabinetYear.action === 'exists') {
    record('cabinetYear', cabinetLabel, 'existing', plan.cabinetYear.detail);
  } else if (plan.cabinetYear.action === 'create') {
    try {
      cabinetYearId = (await gateway.createCabinetYear({ slug: plan.cabinetYear.slug, label: plan.cabinetYear.label, startYear: plan.startYear })).id;
      record('cabinetYear', cabinetLabel, 'created', 'Created inactive.');
    } catch (error) {
      record('cabinetYear', cabinetLabel, 'failed', message(error));
    }
  } else {
    record('cabinetYear', cabinetLabel, 'skipped', plan.cabinetYear.detail);
  }

  const dependent = async (
    key: string,
    label: string,
    item: PlanItem,
    run: (cabinetYearId: string) => Promise<string>,
  ) => {
    if (item.action === 'exists') return record(key, label, 'existing', item.detail);
    if (item.action !== 'create') return record(key, label, 'skipped', item.detail);
    if (!cabinetYearId) return record(key, label, 'skipped', 'The Cabinet year is not available.');
    try {
      record(key, label, 'created', await run(cabinetYearId));
    } catch (error) {
      record(key, label, 'failed', message(error));
    }
  };

  await dependent('rosterDraft', 'Cabinet roster draft', plan.rosterDraft, async (yearId) => {
    const result = await gateway.createRosterDraft({ cabinetYearId: yearId, sourceCabinetYearId: options.rosterSourceCabinetYearId });
    return result.created ? `Draft created with ${pluralize(result.positionsCopied, 'position')}. No people copied.` : 'A roster already existed.';
  });

  if (plan.aceCycle.action === 'exists') record('ace', 'ACE assignment cycle', 'existing', plan.aceCycle.detail);
  else if (plan.aceCycle.action !== 'create') record('ace', 'ACE assignment cycle', 'skipped', plan.aceCycle.detail);
  else {
    try {
      await gateway.createAceCycle(plan.startYear);
      record('ace', 'ACE assignment cycle', 'created', 'Created as a draft.');
    } catch (error) {
      record('ace', 'ACE assignment cycle', 'failed', message(error));
    }
  }

  await dependent('interns', 'Intern cohort', plan.internCycle, async (yearId) => {
    await gateway.createInternCycle({ startYear: plan.startYear, cabinetYearId: yearId });
    return 'Created as a draft.';
  });

  if (plan.houses.action === 'exists') record('houses', 'House assignment batch', 'existing', plan.houses.detail);
  else if (plan.houses.action !== 'create') record('houses', 'House assignment batch', 'skipped', plan.houses.detail);
  else {
    try {
      await gateway.createEmptyHouseBatch({ startYear: plan.startYear, effectiveStartDate: options.houseEffectiveStartDate });
      record('houses', 'House assignment batch', 'created', 'Created empty. Nothing assigned.');
    } catch (error) {
      record('houses', 'House assignment batch', 'failed', message(error));
    }
  }

  return {
    steps,
    created: steps.filter((step) => step.outcome === 'created').length,
    existing: steps.filter((step) => step.outcome === 'existing').length,
    failed: steps.filter((step) => step.outcome === 'failed').length,
  };
}

// ─── Summary ─────────────────────────────────────────────────────────────────

/** The "2027–28 Setup" checklist: ✓ ready, ○ will be created / intentionally off. */
export function buildSetupSummary(plan: YearSetupPlan, applications: ApplicationResetPlan | null): PreflightLine[] {
  const state = (item: PlanItem, ready: string, pending: string, off: string): { severity: PreflightSeverity; message: string } =>
    item.action === 'exists'
      ? { severity: 'ok', message: ready }
      : item.action === 'create'
        ? { severity: 'info', message: pending }
        : { severity: 'info', message: off };

  const termsCovered = plan.terms.filter((term) => term.action === 'exists' || term.action === 'create');
  const termsReady = termsCovered.length > 0 && termsCovered.every((term) => term.action === 'exists');
  const termNames = plan.terms.filter((term) => term.input.include || term.action === 'exists').map((term) => QUARTER_LABEL[term.input.quarter]).join('/');

  const lines: PreflightLine[] = [
    termsCovered.length === 0
      ? { id: 'terms', severity: 'info', message: 'Academic terms not included' }
      : { id: 'terms', severity: termsReady ? 'ok' : 'info', message: termsReady ? `${termNames} terms ready` : `${termNames} terms will be prepared (inactive)` },
    { id: 'cabinetYear', ...state(plan.cabinetYear, 'Cabinet year ready', 'Cabinet year will be created (inactive)', 'Cabinet year not included') },
    { id: 'rosterDraft', ...state(plan.rosterDraft, 'Cabinet draft created', 'Cabinet draft will be created', plan.rosterDraft.detail) },
    { id: 'ace', ...state(plan.aceCycle, 'ACE assignment cycle ready', 'ACE assignment cycle will be created', 'ACE assignment cycle not included') },
    { id: 'interns', ...state(plan.internCycle, 'Intern cohort ready', 'Intern cohort will be created', plan.internCycle.detail) },
    plan.houses.batchExists
      ? { id: 'houses', severity: 'ok', message: 'House assignment batch ready' }
      : plan.houses.action === 'create'
        ? { id: 'houses', severity: 'info', message: 'Empty House assignment batch will be created' }
        : { id: 'houses', severity: 'info', message: plan.houses.profilesExist ? 'House assignment batch not created yet' : 'House reveal intentionally not configured' },
  ];

  if (applications) {
    lines.push(
      applications.pending.length === 0
        ? { id: 'applications', severity: 'ok', message: 'Applications disabled' }
        : { id: 'applications', severity: 'info', message: `${pluralize(applications.pending.length, 'application window')} still to disable or refresh (separate step)` },
    );
  }
  return lines;
}

// ─── Application reset (a separate, explicit action) ─────────────────────────

export interface ApplicationResetRow {
  id: string;
  key: ApplicationKey;
  label: string;
  status: ApplicationStatus;
  /** The window is open right now; resetting it is the admin's explicit call. */
  openNow: boolean;
  willDisable: boolean;
  willReplaceTiming: boolean;
  /** Pre-checked in the UI. Open windows start unchecked. */
  selectedByDefault: boolean;
}

export interface ApplicationResetPlan {
  rows: ApplicationResetRow[];
  /** Rows that a reset would still change. */
  pending: ApplicationResetRow[];
}

export function planApplicationReset(
  links: readonly SnapshotApplication[],
  now: Date = new Date(),
): ApplicationResetPlan {
  const rows = links.map((link): ApplicationResetRow => {
    const status = getApplicationStatus(link.open_at, link.due_at, link.is_enabled, now);
    const outdated = new Date(link.due_at).getTime() < now.getTime();
    const openNow = status === 'open';
    return {
      id: link.id,
      key: link.application_key,
      label: applicationKeyLabel(link.application_key),
      status,
      openNow,
      willDisable: link.is_enabled,
      willReplaceTiming: outdated,
      selectedByDefault: !openNow,
    };
  });
  return { rows, pending: rows.filter((row) => row.willDisable || row.willReplaceTiming) };
}

export interface ApplicationResetPatch {
  is_enabled?: false;
  open_at?: string;
  due_at?: string;
}

/**
 * The only fields a reset may touch. It never sets is_enabled to true, never
 * touches target_url (no URL is ever invented or carried into a public
 * window), and replaces outdated timing with a disabled placeholder window the
 * admin must replace with real dates before enabling.
 */
export function applicationResetPatch(row: ApplicationResetRow, targetStartYear: number): ApplicationResetPatch | null {
  const patch: ApplicationResetPatch = {};
  if (row.willDisable) patch.is_enabled = false;
  if (row.willReplaceTiming) {
    const open = combineLocalDateTime(`${targetStartYear}-09-01`, '00:00', '00:00');
    const due = combineLocalDateTime(`${targetStartYear}-09-01`, '23:59', '23:59');
    if (open && due) {
      patch.open_at = open;
      patch.due_at = due;
    }
  }
  return Object.keys(patch).length > 0 ? patch : null;
}
