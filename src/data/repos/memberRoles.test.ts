import { getPublicMemberRoles } from './memberRoles';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

const year = { id: 'cabinet-year-2026' };
const roles = [
  { id: 'role-1', member_id: 'verified-1', role: 'Events Chair', category: 'General Board' },
  { id: 'role-2', member_id: 'verified-2', role: 'Intern', category: 'Interns' },
  { id: 'role-3', member_id: null, role: 'President', category: 'Executive Board' },
];

describe('bounded public role-source reads (#623/#627)', () => {
  it('reads exactly one year and one batched Cabinet query with minimal public fields', async () => {
    supabaseMock.queueResult('cabinet_years', { data: [year], error: null });
    supabaseMock.queueResult('cabinet_members', { data: roles, error: null });
    const result = await getPublicMemberRoles(2026, ['verified-2', 'verified-1', 'verified-2']);

    expect(result.get('verified-1')?.map((role) => role.label)).toEqual(['Board Member', 'Events Chair']);
    expect(result.get('verified-2')?.map((role) => role.label)).toEqual(['Intern']);
    expect(supabaseMock.queries().map((q) => q.table)).toEqual(['cabinet_years', 'cabinet_members']);
    expect(supabaseMock.filtersFor('cabinet_years')).toEqual([['start_year', 2026]]);
    expect(supabaseMock.filtersFor('cabinet_members')).toEqual([['cabinet_year_id', year.id]]);

    const members = supabaseMock.queriesFor('cabinet_members')[0].calls;
    expect(members.find((call) => call.method === 'select')?.args[0]).toBe('id, member_id, role, category');
    expect(members.find((call) => call.method === 'in')?.args).toEqual([
      'member_id', ['verified-1', 'verified-2'],
    ]);
    expect(members.some((call) => call.method === 'limit' && call.args[0] === 501)).toBe(true);
    expect(JSON.stringify(members)).not.toMatch(/email|draft|review_note|house_member_yearly_points|\*/);
  });

  it('returns no roles without a Cabinet year or selected IDs; never guesses from legacy yearless Cabinet entries', async () => {
    expect(await getPublicMemberRoles(2026, [])).toEqual(new Map());
    expect(supabaseMock.queries()).toHaveLength(0);
    supabaseMock.queueResult('cabinet_years', { data: [], error: null });
    expect(await getPublicMemberRoles(2026, ['verified-1'])).toEqual(new Map());
    expect(supabaseMock.queriesFor('cabinet_members')).toHaveLength(0);
  });

  it('fails closed on an ambiguous Cabinet year instead of presenting mismatched historical roles', async () => {
    supabaseMock.queueResult('cabinet_years', { data: [year, { id: 'duplicate' }], error: null });
    await expect(getPublicMemberRoles(2026, ['verified-1'])).rejects.toThrow();
    expect(supabaseMock.queriesFor('cabinet_members')).toHaveLength(0);
  });

  it('propagates public permission failures without suppressing the independently fetched leaderboard', async () => {
    supabaseMock.queueResult('cabinet_years', { data: [year], error: null });
    supabaseMock.queueResult('cabinet_members', {
      data: null, error: postgrestError('permission denied', '42501'),
    });
    await expect(getPublicMemberRoles(2026, ['verified-1'])).rejects.toThrow();
    expect(supabaseMock.queriesFor('member_yearly_points')).toHaveLength(0);
    expect(supabaseMock.queriesFor('members')).toHaveLength(0);
  });

  it('protects query budget against more than one visible page of member IDs', async () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => `member-${i}`);
    await expect(getPublicMemberRoles(2026, tooMany)).rejects.toThrow(/visible-member limit/);
    expect(supabaseMock.queries()).toHaveLength(0);
  });
});
