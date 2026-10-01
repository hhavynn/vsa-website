/**
 * The real gateway behind New Year Setup. Whatever the wizard asks for, terms
 * and Cabinet years are created inactive, nothing is activated, no House
 * membership is written, and an application reset never carries a URL.
 */
import { buildYearSetupGateway, yearSetupRepository } from './yearSetup';
import { academicTermsRepository } from './academicTerms';
import { cabinetYearsRepository } from './cabinetYears';
import { cabinetRosterRepository } from './cabinetRoster';
import { aceAssignmentsRepository } from './aceAssignments';
import { internCohortRepository } from './internCohort';
import { houseAssignmentsRepository } from './houseAssignments';
import { houseMembershipsWriteRepository } from './houseMembershipWrites';
import { applicationLinksRepository } from './applicationLinks';
import { defaultSetupOptions, defaultTermInputs, planApplicationReset } from '../../lib/yearSetup';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));
jest.mock('./academicTerms');
jest.mock('./cabinetYears');
jest.mock('./cabinetRoster');
jest.mock('./aceAssignments');
jest.mock('./internCohort');
jest.mock('./houseAssignments');
jest.mock('./houseMembershipWrites');
jest.mock('./applicationLinks');

const terms = academicTermsRepository as jest.Mocked<typeof academicTermsRepository>;
const years = cabinetYearsRepository as jest.Mocked<typeof cabinetYearsRepository>;
const rosters = cabinetRosterRepository as jest.Mocked<typeof cabinetRosterRepository>;
const ace = aceAssignmentsRepository as jest.Mocked<typeof aceAssignmentsRepository>;
const interns = internCohortRepository as jest.Mocked<typeof internCohortRepository>;
const houses = houseAssignmentsRepository as jest.Mocked<typeof houseAssignmentsRepository>;
const houseWrites = houseMembershipsWriteRepository as jest.Mocked<typeof houseMembershipsWriteRepository>;
const links = applicationLinksRepository as jest.Mocked<typeof applicationLinksRepository>;

beforeEach(() => {
  jest.resetAllMocks();
  supabaseMock.reset();
  terms.createTerm.mockResolvedValue({ id: 't1' } as never);
  years.createYear.mockResolvedValue({ id: 'cy1' } as never);
  rosters.createCycle.mockResolvedValue({ created: true, positionsCopied: 19, cycle: { id: 'rc1' } } as never);
  ace.createCycle.mockResolvedValue({ id: 'ace1' } as never);
  interns.createCycle.mockResolvedValue({ id: 'ic1' } as never);
  houses.createEmptyBatch.mockResolvedValue({ id: 'hb1' } as never);
  links.updateApplicationLink.mockResolvedValue({} as never);
});

describe('gateway', () => {
  it('creates every term inactive, even the first one of the year', async () => {
    const gateway = buildYearSetupGateway('admin-1');
    for (const term of defaultTermInputs(2027)) await gateway.createTerm(term);

    expect(terms.createTerm).toHaveBeenCalledTimes(4);
    terms.createTerm.mock.calls.forEach(([payload]) => expect(payload.is_active).toBe(false));
    expect(terms.setActiveTerm).not.toHaveBeenCalled();
  });

  it('creates the Cabinet year inactive and never calls setActiveYear', async () => {
    const gateway = buildYearSetupGateway('admin-1');
    await gateway.createCabinetYear({ slug: '2027-2028', label: '2027-2028 Cabinet', startYear: 2027 });

    expect(years.createYear).toHaveBeenCalledWith({
      label: '2027-2028 Cabinet',
      slug: '2027-2028',
      start_year: 2027,
      end_year: 2028,
      theme_name: null,
      is_active: false,
      display_order: 2027,
    });
    expect(years.setActiveYear).not.toHaveBeenCalled();
  });

  it('passes the signed-in admin through to the roster and intern cycles', async () => {
    const gateway = buildYearSetupGateway('admin-1');
    await gateway.createRosterDraft({ cabinetYearId: 'cy1', sourceCabinetYearId: 'cy0' });
    await gateway.createInternCycle({ startYear: 2027, cabinetYearId: 'cy1' });

    expect(rosters.createCycle).toHaveBeenCalledWith({ cabinetYearId: 'cy1', sourceCabinetYearId: 'cy0', userId: 'admin-1' });
    expect(interns.createCycle).toHaveBeenCalledWith({ academicYearStart: 2027, cabinetYearId: 'cy1', userId: 'admin-1' });
  });

  it('creates an empty House batch without ever writing a House membership', async () => {
    const gateway = buildYearSetupGateway('admin-1');
    await gateway.createEmptyHouseBatch({ startYear: 2027, effectiveStartDate: '2027-09-20' });

    expect(houses.createEmptyBatch).toHaveBeenCalledWith({
      academicYearStart: 2027,
      effectiveStartDate: '2027-09-20',
      sourceLabel: 'New Year Setup',
      userId: 'admin-1',
    });
    expect(houses.publishBatch).not.toHaveBeenCalled();
    expect(houseWrites.applyMembership).not.toHaveBeenCalled();
  });
});

describe('runSetup against a stale preview', () => {
  function queueSnapshot(overrides: Partial<Record<string, unknown[]>> = {}) {
    const tables: Record<string, unknown[]> = {
      academic_terms: [],
      cabinet_years: [{ id: 'cy2026', slug: '2026-2027', label: '2026-2027 Cabinet', start_year: 2026, is_active: true }],
      cabinet_roster_cycles: [],
      ace_assignment_cycles: [],
      intern_cohort_cycles: [],
      house_assignment_batches: [],
      application_links: [],
      ...overrides,
    };
    Object.entries(tables).forEach(([table, rows]) => supabaseMock.queueResult(table, { data: rows, error: null }));
    supabaseMock.queueResult('house_page_assets', { data: null, error: null });
  }

  it('re-reads what exists right before writing and skips whatever another admin just created', async () => {
    queueSnapshot({ ace_assignment_cycles: [{ id: 'ace-x', academic_year_start: 2027, status: 'draft' }] });

    const { report } = await yearSetupRepository.runSetup(2027, defaultSetupOptions(2027, 'cy2026'), 'admin-1');

    expect(ace.createCycle).not.toHaveBeenCalled();
    expect(report.steps.find((step) => step.key === 'ace')?.outcome).toBe('existing');
    expect(terms.createTerm).toHaveBeenCalledTimes(3);
  });

  it('only reads while previewing; the snapshot performs no writes', async () => {
    queueSnapshot();
    await yearSetupRepository.loadSnapshot(2027);
    const methods = supabaseMock.queries().flatMap((q) => q.calls.map((c) => c.method));
    expect(methods.filter((m) => ['insert', 'update', 'upsert', 'delete'].includes(m))).toEqual([]);
  });
});

describe('resetApplications', () => {
  const rows = planApplicationReset(
    [
      { id: 'a1', application_key: 'ace_application', open_at: '2025-09-01T07:00:00Z', due_at: '2025-10-01T07:00:00Z', is_enabled: true },
      { id: 'a2', application_key: 'intern_application', open_at: '2025-09-01T07:00:00Z', due_at: '2025-10-01T07:00:00Z', is_enabled: false },
    ],
    new Date('2026-10-02T12:00:00-07:00'),
  ).rows;

  it('patches only enablement and timing, never a URL, and never enables a window', async () => {
    const result = await yearSetupRepository.resetApplications(rows, 2027);

    expect(result.updated).toBe(2);
    links.updateApplicationLink.mock.calls.forEach(([, patch]) => {
      expect(patch).not.toHaveProperty('target_url');
      expect(patch.is_enabled).not.toBe(true);
    });
    expect(links.createApplicationLink).not.toHaveBeenCalled();
    expect(links.deleteApplicationLink).not.toHaveBeenCalled();
  });

  it('reports a window that could not be updated and keeps going', async () => {
    links.updateApplicationLink.mockRejectedValueOnce(new Error('denied'));
    const result = await yearSetupRepository.resetApplications(rows, 2027);
    expect(result.failed).toEqual([{ key: 'ace_application', message: 'denied' }]);
    expect(result.updated).toBe(1);
  });
});
