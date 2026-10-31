/**
 * #291: the search palette loads admin-only index rows after it opens.
 * All rows, names, and routes in this test are invented. Nothing hits Supabase.
 */
import { adminSearchRepository } from './adminSearch';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';
import { memberLookupRepository } from './memberLookup';
import { cabinetYearsRepository } from './cabinetYears';
import { houseAssignmentsRepository } from './houseAssignments';
import { adminOperationsRepository } from './adminOperations';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));
jest.mock('./memberLookup', () => ({
  memberLookupRepository: { listMemberDirectory: jest.fn() },
}));
jest.mock('./cabinetYears', () => ({
  cabinetYearsRepository: { getYears: jest.fn() },
}));
jest.mock('./houseAssignments', () => ({
  houseAssignmentsRepository: { listBatches: jest.fn(), getDrafts: jest.fn() },
}));
jest.mock('./adminOperations', () => ({
  adminOperationsRepository: { resolveYearStart: jest.fn() },
}));

const members = memberLookupRepository.listMemberDirectory as jest.Mock;
const years = cabinetYearsRepository.getYears as jest.Mock;
const batches = houseAssignmentsRepository.listBatches as jest.Mock;
const drafts = houseAssignmentsRepository.getDrafts as jest.Mock;
const resolveYear = adminOperationsRepository.resolveYearStart as jest.Mock;

beforeEach(() => {
  supabaseMock.reset();
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  members.mockResolvedValue([]);
  years.mockResolvedValue([]);
  batches.mockResolvedValue([]);
  drafts.mockResolvedValue([]);
  resolveYear.mockResolvedValue(2026);
});
afterEach(() => jest.restoreAllMocks());

describe('admin search repository (#291)', () => {
  it('shows admin navigation in the genuinely empty index; never fabricates a member', async () => {
    const rows = await adminSearchRepository.loadRecords();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((record) => record.type === 'page')).toBe(true);
    expect(members).toHaveBeenCalledTimes(1);
    expect(resolveYear).toHaveBeenCalledTimes(1);
    expect(supabaseMock.queriesFor('members')).toHaveLength(0);
    expect(supabaseMock.queriesFor('member_identity_emails')).toHaveLength(0);
    expect(supabaseMock.queriesFor('house_memberships')).toHaveLength(0);
    expect(supabaseMock.queriesFor('member_yearly_points')).toHaveLength(0);
  });

  it('loads bounded admin-only columns, canonical IDs, unpublished drafts, and independent sources', async () => {
    members.mockResolvedValue([{ id: 'fictional-member', fullName: 'Ada Example', college: 'Sixth', year: '2029' }]);
    years.mockResolvedValue([{ id: 'cab-year', start_year: 2026 }]);
    batches.mockResolvedValue([{ id: 'house-batch' }]);
    drafts.mockResolvedValue([{
      id: 'house-draft', batch_id: 'house-batch', source_name: 'Draft Name',
      member_id: 'fictional-member', house_profile_id: 'house-profile',
    }]);
    supabaseMock.setDefault('ace_family_members', { data: [{
      id: 'ace-node', name: 'Bree Sample', family_id: 'ace-family', role_label: 'Big', member_id: null,
    }], error: null });
    supabaseMock.setDefault('ace_families', { data: [{
      id: 'ace-family', name: 'Fictional Fam', academic_year_start: 2026,
    }], error: null });
    supabaseMock.setDefault('cabinet_members', { data: [{
      id: 'cabinet-row', name: 'Cam Fictional', role: 'President', category: null,
      cabinet_year_id: 'cab-year',
    }], error: null });
    supabaseMock.setDefault('intern_cohort_cycles', { data: [
      { id: 'active-cycle', academic_year_start: 2026, status: 'draft' },
      { id: 'published-cycle', academic_year_start: 2026, status: 'published' },
    ], error: null });
    supabaseMock.setDefault('intern_cohort_drafts', { data: [
      { id: 'intern-draft', name: 'Drew Sample', cycle_id: 'active-cycle' },
      { id: 'published-draft', name: 'Eli Sample', cycle_id: 'published-cycle' },
      { id: 'missing-cycle', name: 'Farah Sample', cycle_id: 'not-listed' },
    ], error: null });
    supabaseMock.setDefault('events', { data: [{
      id: 'event-draft', name: 'Fictional planning event', date: null, is_published: false,
    }], error: null });
    supabaseMock.setDefault('house_page_assets', { data: [{
      id: 'house-profile', house_key: 'sample', display_name: 'Fictional House',
    }], error: null });

    const rows = await adminSearchRepository.loadRecords();
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'member', id: 'fictional-member', to: '/admin/members?member=fictional-member' }),
      expect.objectContaining({ type: 'ace', id: 'ace-node', to: '/admin/ace?family=ace-family&node=ace-node' }),
      expect.objectContaining({ type: 'cabinet', id: 'cabinet-row', to: '/admin/cabinet?member=cabinet-row' }),
      expect.objectContaining({ type: 'intern', id: 'intern-draft', to: '/admin/interns?cycle=active-cycle&row=intern-draft' }),
      expect.objectContaining({ type: 'event', id: 'event-draft', detail: 'Draft' }),
      expect.objectContaining({ type: 'house', id: 'house-draft', title: 'Ada Example',
        to: '/admin/houses?batch=house-batch&row=house-draft' }),
    ]));
    expect(rows.some((r) => r.id === 'published-draft' || r.id === 'missing-cycle')).toBe(false);
    expect(resolveYear).toHaveBeenCalledTimes(1);
    expect(batches).toHaveBeenCalledWith(2026);
    expect(drafts).toHaveBeenCalledWith('house-batch');
    expect(members).toHaveBeenCalledTimes(2);

    const expectedColumns: Record<string, string> = {
      ace_family_members: 'id, name, role_label, family_id, member_id',
      ace_families: 'id, name, academic_year_start',
      cabinet_members: 'id, name, role, category, cabinet_year_id',
      intern_cohort_drafts: 'id, name, cycle_id',
      intern_cohort_cycles: 'id, academic_year_start, status',
      events: 'id, name, date, is_published',
      house_page_assets: 'id, house_key, display_name',
    };
    for (const [table, columns] of Object.entries(expectedColumns)) {
      const query = supabaseMock.queriesFor(table)[0];
      expect(query.calls).toContainEqual({ method: 'select', args: [columns] });
      expect(columns).not.toMatch(/email|phone|notes|attendance|score|points/i);
    }
    expect(supabaseMock.queriesFor('intern_cohort_cycles')[0].calls)
      .toContainEqual({ method: 'neq', args: ['status', 'archived'] });
    expect(supabaseMock.queriesFor('house_page_assets')[0].calls)
      .toContainEqual({ method: 'eq', args: ['academic_year_start', 2026] });
  });

  it('pages the entire ACE source past 1,000, sorts by ID and retains the last record', async () => {
    const first = Array.from({ length: 1000 }, (_, i) => ({
      id: 'node-' + String(i).padStart(4, '0'), name: 'Fictional ' + i,
      role_label: null, family_id: 'fam', member_id: null,
    }));
    supabaseMock.queueResult('ace_family_members', { data: first, error: null });
    supabaseMock.queueResult('ace_family_members', { data: [{
      id: 'node-1000', name: 'Last Fictional', role_label: null, family_id: 'fam', member_id: null,
    }], error: null });
    supabaseMock.setDefault('ace_families', { data: [{ id: 'fam', name: 'Fam', academic_year_start: 2026 }], error: null });
    const records = await adminSearchRepository.loadRecords();
    expect(records.filter((record) => record.type === 'ace')).toHaveLength(1001);
    expect(records.find((record) => record.id === 'node-1000')?.to).toBe(
      '/admin/ace?family=fam&node=node-1000',
    );
    const calls = supabaseMock.queriesFor('ace_family_members');
    expect(calls).toHaveLength(2);
    expect(calls.map((q) => q.calls.find((call) => call.method === 'range')?.args))
      .toEqual([[0, 999], [1000, 1999]]);
    calls.forEach((q) => expect(q.calls).toContainEqual({ method: 'order', args: ['id'] }));
  });

  it('keeps all other source results when the second ACE page fails, never returning partial ACE', async () => {
    members.mockResolvedValue([{ id: 'fictional-member', fullName: 'Ada Example' }]);
    const first = Array.from({ length: 1000 }, (_, i) => ({
      id: 'node-' + i, name: 'Test ' + i, role_label: null, family_id: 'fam', member_id: null,
    }));
    supabaseMock.queueResult('ace_family_members', { data: first, error: null });
    supabaseMock.queueResult('ace_family_members', {
      data: null, error: postgrestError('synthetic denied second page', '42501'),
    });
    const result = await adminSearchRepository.loadRecords();
    expect(result.some((r) => r.type === 'ace')).toBe(false);
    expect(result.find((r) => r.id === 'fictional-member')).toBeDefined();
    expect(result.some((r) => r.type === 'page')).toBe(true);
    expect(console.warn).toHaveBeenCalledWith('Admin search: could not load ACE', expect.any(Error));
  });

  it('keeps unrelated results on a House profile error, never labels the draft as assigned', async () => {
    batches.mockResolvedValue([{ id: 'house-batch' }]);
    drafts.mockResolvedValue([{
      id: 'draft', batch_id: 'house-batch', source_name: 'Invented Student',
      house_profile_id: 'bad-house', member_id: null,
    }]);
    supabaseMock.setDefault('house_page_assets', {
      data: null, error: postgrestError('synthetic permission denied', '42501'),
    });
    const result = await adminSearchRepository.loadRecords();
    expect(result.find((r) => r.id === 'draft')).toBeUndefined();
    expect(result.some((r) => r.type === 'page')).toBe(true);
    expect(console.warn).toHaveBeenCalledWith('Admin search: could not load Houses', expect.any(Error));
  });
});
