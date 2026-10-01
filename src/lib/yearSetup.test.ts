/**
 * New Year Setup rules: detect what exists, preview before writing, create only
 * what is missing, and never activate a term or Cabinet year, copy House
 * assignments, or invent an application URL.
 */
import {
  EMPTY_SNAPSHOT,
  YearSetupGateway,
  YearSetupSnapshot,
  applicationResetPatch,
  buildSetupSummary,
  buildYearSetupPlan,
  defaultSetupOptions,
  defaultTermInputs,
  planApplicationReset,
  runYearSetup,
} from './yearSetup';

const NOW = new Date('2026-10-02T12:00:00-07:00');

function fakeGateway() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const record = <T>(method: string, result: T) => async (...args: unknown[]) => {
    calls.push({ method, args });
    return result;
  };
  const gateway: YearSetupGateway = {
    createTerm: record('createTerm', { id: 't-new' }) as YearSetupGateway['createTerm'],
    createCabinetYear: record('createCabinetYear', { id: 'cy-new' }) as YearSetupGateway['createCabinetYear'],
    createRosterDraft: record('createRosterDraft', { created: true, positionsCopied: 19 }) as YearSetupGateway['createRosterDraft'],
    createAceCycle: record('createAceCycle', { id: 'ace-new' }) as YearSetupGateway['createAceCycle'],
    createInternCycle: record('createInternCycle', { id: 'intern-new' }) as YearSetupGateway['createInternCycle'],
    createEmptyHouseBatch: record('createEmptyHouseBatch', { id: 'hb-new' }) as YearSetupGateway['createEmptyHouseBatch'],
  };
  return { gateway, calls, methods: () => calls.map((call) => call.method) };
}

const existing2026: YearSetupSnapshot = {
  ...EMPTY_SNAPSHOT,
  terms: [{ id: 't-fa26', code: 'FA26', academic_year_start: 2026, quarter: 'fall', is_active: true }],
  cabinetYears: [{ id: 'cy-2026', slug: '2026-2027', label: '2026-2027 Cabinet', start_year: 2026, is_active: true }],
};

describe('default terms', () => {
  it('prepares Fall 2027, Winter 2028, Spring 2028 and an optional Summer 2028', () => {
    const terms = defaultTermInputs(2027);
    expect(terms.map((t) => [t.label, t.code, t.include])).toEqual([
      ['Fall 2027', 'FA27', true],
      ['Winter 2028', 'WI28', true],
      ['Spring 2028', 'SP28', true],
      ['Summer 2028', 'SU28', false],
    ]);
    terms.forEach((t) => {
      expect(t.academic_year_start).toBe(2027);
      expect(t.academic_year_end).toBe(2028);
    });
  });
});

describe('detecting what already exists', () => {
  it('reports a brand new year as found nowhere and plans every missing piece', () => {
    const plan = buildYearSetupPlan(2027, existing2026, defaultSetupOptions(2027, 'cy-2026'));
    expect(plan.foundIn).toEqual([]);
    expect(plan.terms.map((t) => t.action)).toEqual(['create', 'create', 'create', 'skip']);
    expect(plan.cabinetYear.action).toBe('create');
    expect(plan.rosterDraft.action).toBe('create');
    expect(plan.aceCycle.action).toBe('create');
    expect(plan.internCycle.action).toBe('create');
    expect(plan.writeCount).toBe(7);
  });

  it('detects rows that exist anywhere and never plans to duplicate them', () => {
    const snapshot: YearSetupSnapshot = {
      ...existing2026,
      terms: [
        ...existing2026.terms,
        { id: 't-fa27', code: 'FA27', academic_year_start: 2027, quarter: 'fall', is_active: false },
        { id: 't-wi28', code: 'WI28', academic_year_start: 2027, quarter: 'winter', is_active: false },
      ],
      cabinetYears: [
        ...existing2026.cabinetYears,
        { id: 'cy-2027', slug: '2027-2028', label: '2027-2028 Cabinet', start_year: 2027, is_active: false },
      ],
      rosterCycles: [{ id: 'rc-1', cabinet_year_id: 'cy-2027', status: 'draft' }],
      aceCycles: [{ id: 'ace-1', academic_year_start: 2027, status: 'draft' }],
      internCycles: [{ id: 'ic-1', academic_year_start: 2027, cabinet_year_id: 'cy-2027', status: 'locked' }],
      houseProfileCount: 4,
      houseBatches: [{ id: 'hb-1', status: 'draft' }],
    };
    const plan = buildYearSetupPlan(2027, snapshot, defaultSetupOptions(2027, 'cy-2026'));

    expect(plan.terms.map((t) => t.action)).toEqual(['exists', 'exists', 'create', 'skip']);
    expect(plan.cabinetYear.action).toBe('exists');
    expect(plan.rosterDraft.action).toBe('exists');
    expect(plan.aceCycle.action).toBe('exists');
    expect(plan.internCycle.action).toBe('exists');
    expect(plan.houses.action).toBe('exists');
    expect(plan.writeCount).toBe(1);
    expect(plan.foundIn).toEqual(expect.arrayContaining([
      expect.stringContaining('2 academic terms'),
      expect.stringContaining('Cabinet year 2027-2028 Cabinet'),
      expect.stringContaining('Cabinet roster (draft)'),
      expect.stringContaining('ACE assignment cycle (draft)'),
      expect.stringContaining('Intern cohort (locked)'),
      expect.stringContaining('4 House profiles'),
      expect.stringContaining('House assignment batch (draft)'),
    ]));
  });

  it('treats an archived cycle as free, matching the unique-live-cycle indexes', () => {
    const snapshot: YearSetupSnapshot = { ...existing2026, aceCycles: [{ id: 'old', academic_year_start: 2027, status: 'archived' }] };
    expect(buildYearSetupPlan(2027, snapshot, defaultSetupOptions(2027)).aceCycle.action).toBe('create');
  });

  it('finds an existing term by quarter even when its code differs', () => {
    const snapshot: YearSetupSnapshot = { ...EMPTY_SNAPSHOT, terms: [{ id: 'x', code: 'FALL27', academic_year_start: 2027, quarter: 'fall', is_active: false }] };
    expect(buildYearSetupPlan(2027, snapshot, defaultSetupOptions(2027)).terms[0].action).toBe('exists');
  });

  it('blocks the roster draft and intern cohort when there is no Cabinet year to hang them on', () => {
    const options = { ...defaultSetupOptions(2027), createCabinetYear: false };
    const plan = buildYearSetupPlan(2027, EMPTY_SNAPSHOT, options);
    expect(plan.cabinetYear.action).toBe('skip');
    expect(plan.rosterDraft.action).toBe('blocked');
    expect(plan.internCycle.action).toBe('blocked');
  });
});

describe('executing the plan', () => {
  it('writes only what is missing, in dependency order', async () => {
    const { gateway, methods } = fakeGateway();
    const options = defaultSetupOptions(2027, 'cy-2026');
    const plan = buildYearSetupPlan(2027, existing2026, options);

    const report = await runYearSetup(plan, options, gateway);

    expect(methods()).toEqual([
      'createTerm', 'createTerm', 'createTerm',
      'createCabinetYear', 'createRosterDraft', 'createAceCycle', 'createInternCycle',
    ]);
    expect(report).toMatchObject({ created: 7, existing: 0, failed: 0 });
  });

  it('is idempotent: with everything present it writes nothing and reports what exists', async () => {
    const { gateway, calls } = fakeGateway();
    const snapshot: YearSetupSnapshot = {
      terms: defaultTermInputs(2027).map((t) => ({ id: t.code, code: t.code, academic_year_start: 2027, quarter: t.quarter, is_active: false })),
      cabinetYears: [{ id: 'cy-2027', slug: '2027-2028', label: '2027-2028 Cabinet', start_year: 2027, is_active: false }],
      rosterCycles: [{ id: 'rc', cabinet_year_id: 'cy-2027', status: 'draft' }],
      aceCycles: [{ id: 'ace', academic_year_start: 2027, status: 'draft' }],
      internCycles: [{ id: 'ic', academic_year_start: 2027, cabinet_year_id: 'cy-2027', status: 'draft' }],
      houseProfileCount: 0,
      houseBatches: [],
      applications: [],
    };
    const options = defaultSetupOptions(2027, 'cy-2026');
    const plan = buildYearSetupPlan(2027, snapshot, options);

    const first = await runYearSetup(plan, options, gateway);
    const second = await runYearSetup(buildYearSetupPlan(2027, snapshot, options), options, gateway);

    expect(calls).toHaveLength(0);
    expect(first.created).toBe(0);
    expect(second.steps.filter((s) => s.outcome === 'existing').length).toBeGreaterThanOrEqual(7);
    expect(plan.writeCount).toBe(0);
  });

  it('hangs the roster draft and intern cohort on the Cabinet year it just created', async () => {
    const { gateway, calls } = fakeGateway();
    const options = defaultSetupOptions(2027, 'cy-2026');
    await runYearSetup(buildYearSetupPlan(2027, EMPTY_SNAPSHOT, options), options, gateway);

    expect(calls.find((c) => c.method === 'createRosterDraft')?.args[0]).toEqual({ cabinetYearId: 'cy-new', sourceCabinetYearId: 'cy-2026' });
    expect(calls.find((c) => c.method === 'createInternCycle')?.args[0]).toEqual({ startYear: 2027, cabinetYearId: 'cy-new' });
  });

  it('reports a failed step, skips what depended on it, and keeps earlier writes', async () => {
    const { gateway, methods } = fakeGateway();
    gateway.createCabinetYear = async () => {
      throw new Error('boom');
    };
    const options = defaultSetupOptions(2027);
    const report = await runYearSetup(buildYearSetupPlan(2027, EMPTY_SNAPSHOT, options), options, gateway);

    expect(report.failed).toBe(1);
    expect(report.steps.find((s) => s.key === 'cabinetYear')).toMatchObject({ outcome: 'failed', detail: 'boom' });
    expect(report.steps.find((s) => s.key === 'rosterDraft')?.outcome).toBe('skipped');
    expect(report.steps.find((s) => s.key === 'interns')?.outcome).toBe('skipped');
    expect(methods()).toContain('createTerm');
    expect(methods()).toContain('createAceCycle');
    expect(methods()).not.toContain('createRosterDraft');
  });
});

describe('what setup must never do', () => {
  it('has no way to activate a term or a Cabinet year', () => {
    const { gateway } = fakeGateway();
    expect(Object.keys(gateway).filter((name) => /activ/i.test(name))).toEqual([]);
    defaultTermInputs(2027).forEach((term) => expect(term).not.toHaveProperty('is_active'));
  });

  it('does not copy House assignments or reveal Houses by default', async () => {
    const { gateway, methods } = fakeGateway();
    const options = defaultSetupOptions(2027, 'cy-2026');
    const plan = buildYearSetupPlan(2027, existing2026, options);

    expect(plan.houses.action).toBe('skip');
    expect(plan.houses.revealConfigured).toBe(false);
    expect(plan.houses.detail).toMatch(/intentionally not configured/);
    await runYearSetup(plan, options, gateway);
    expect(methods().some((method) => /house/i.test(method))).toBe(false);
  });

  it('offers an empty House batch only once House profiles exist, and only when asked', async () => {
    const withProfiles: YearSetupSnapshot = { ...existing2026, houseProfileCount: 4 };
    const off = buildYearSetupPlan(2027, withProfiles, defaultSetupOptions(2027));
    expect(off.houses).toMatchObject({ action: 'skip', profilesExist: true });

    const optionsOn = { ...defaultSetupOptions(2027), createEmptyHouseBatch: true };
    const on = buildYearSetupPlan(2027, withProfiles, optionsOn);
    expect(on.houses.action).toBe('create');
    const { gateway, calls } = fakeGateway();
    await runYearSetup(on, optionsOn, gateway);
    expect(calls.find((c) => c.method === 'createEmptyHouseBatch')?.args[0]).toEqual({ startYear: 2027, effectiveStartDate: '2027-09-01' });

    // Without profiles the option is ignored: nothing is revealed early.
    const noProfiles = buildYearSetupPlan(2027, existing2026, optionsOn);
    expect(noProfiles.houses.action).toBe('skip');
  });

  it('only ever creates an ACE cycle for the year, never copying past assignments', async () => {
    const { gateway, calls } = fakeGateway();
    const options = defaultSetupOptions(2027);
    await runYearSetup(buildYearSetupPlan(2027, EMPTY_SNAPSHOT, options), options, gateway);
    expect(calls.find((c) => c.method === 'createAceCycle')?.args).toEqual([2027]);
  });
});

describe('application reset', () => {
  const links = [
    { id: 'a-closed', application_key: 'ace_application' as const, open_at: '2025-09-01T07:00:00Z', due_at: '2025-10-01T07:00:00Z', is_enabled: true },
    { id: 'a-open', application_key: 'house_fall' as const, open_at: '2026-09-20T07:00:00Z', due_at: '2026-10-20T07:00:00Z', is_enabled: true },
    { id: 'a-off', application_key: 'intern_application' as const, open_at: '2025-09-01T07:00:00Z', due_at: '2025-10-01T07:00:00Z', is_enabled: false },
    { id: 'a-future', application_key: 'wnc_team_form' as const, open_at: '2027-01-01T08:00:00Z', due_at: '2027-02-01T08:00:00Z', is_enabled: false },
  ];

  it('shows every key with its current status and leaves windows that are open right now unselected', () => {
    const plan = planApplicationReset(links, NOW);
    expect(plan.rows.map((r) => [r.id, r.status, r.selectedByDefault])).toEqual([
      ['a-closed', 'closed', true],
      ['a-open', 'open', false],
      ['a-off', 'disabled', true],
      ['a-future', 'disabled', true],
    ]);
    expect(plan.rows.find((r) => r.id === 'a-open')?.openNow).toBe(true);
  });

  it('disables enabled windows and replaces past timing, and leaves already-clean rows alone', () => {
    const rows = planApplicationReset(links, NOW).rows;
    expect(applicationResetPatch(rows[0], 2027)).toMatchObject({ is_enabled: false });
    expect(applicationResetPatch(rows[0], 2027)?.open_at).toBeDefined();
    expect(applicationResetPatch(rows[3], 2027)).toBeNull();
  });

  it('never invents a URL, enables a window, or hands a past window a public timing', () => {
    const rows = planApplicationReset(links, NOW).rows;
    rows.forEach((row) => {
      const patch = applicationResetPatch(row, 2027);
      if (!patch) return;
      expect(Object.keys(patch).every((key) => ['is_enabled', 'open_at', 'due_at'].includes(key))).toBe(true);
      expect(patch).not.toHaveProperty('target_url');
      expect(patch.is_enabled).not.toBe(true);
    });
    const replaced = applicationResetPatch(rows[0], 2027);
    expect(new Date(replaced?.due_at as string).getTime()).toBeGreaterThan(new Date(replaced?.open_at as string).getTime());
    // A disabled placeholder: the row reads "disabled", so its link stays masked.
    expect(JSON.stringify(replaced)).not.toMatch(/https?:/);
  });

  it('summarizes the year as ready / will-create / intentionally off', () => {
    const plan = buildYearSetupPlan(2027, existing2026, defaultSetupOptions(2027, 'cy-2026'));
    const lines = buildSetupSummary(plan, planApplicationReset([], NOW));
    expect(lines.find((l) => l.id === 'houses')).toMatchObject({ severity: 'info', message: 'House reveal intentionally not configured' });
    expect(lines.find((l) => l.id === 'terms')?.message).toMatch(/Fall\/Winter\/Spring terms will be prepared/);
    expect(lines.find((l) => l.id === 'applications')).toMatchObject({ severity: 'ok', message: 'Applications disabled' });
  });
});
