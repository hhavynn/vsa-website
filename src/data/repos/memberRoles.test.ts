import { getPublicMemberRoles, getPublishedBoardMemberIds } from './memberRoles';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() { return require('../../test-utils/supabaseMock').supabaseMock.client; },
}));
beforeEach(() => supabaseMock.reset());

const year = { id: 'cabinet-year-2026' };
const row = (member_id: string, kind: string, label: string) => ({
  member_id, kind, label, academic_year_start: 2026,
  source_type: 'cabinet_members', related_key: null,
});

describe('bounded public member role RPC (#623)', () => {
  it('reads exactly one bounded RPC, not private Cabinet or member tables', async () => {
    supabaseMock.queueResult('rpc:public_member_roles', { data: [
      row('one','board','Board Member'),row('one','cabinet_position','Events Chair'),
      row('two','intern','Intern'),
    ],error:null });
    const map=await getPublicMemberRoles(2026,['two','one','two']);
    expect(map.get('one')?.map(r=>r.label)).toEqual(['Board Member','Events Chair']);
    expect(map.get('two')?.map(r=>r.label)).toEqual(['Intern']);
    expect(supabaseMock.queries().map(q=>q.table)).toEqual(['rpc:public_member_roles']);
    expect(supabaseMock.queries()[0].calls[0]).toEqual({
      method:'rpc',args:[{p_year:2026,p_member_ids:['one','two']}],
    });
  });

  it('short-circuits empty member IDs without a network read', async () => {
    expect(await getPublicMemberRoles(2026,[])).toEqual(new Map());
    expect(supabaseMock.queries()).toHaveLength(0);
  });

  it('sends 450 visible IDs in exactly 200/200/50 member batches', async () => {
    const ids=Array.from({length:450},(_,i)=>'id-'+String(i).padStart(4,'0'));
    for(let i=0;i<3;i++) supabaseMock.queueResult('rpc:public_member_roles',{data:[],error:null});
    expect(await getPublicMemberRoles(2026,ids)).toEqual(new Map());
    const calls=supabaseMock.queriesFor('rpc:public_member_roles');
    expect(calls).toHaveLength(3);
    expect(calls.map(c=>(c.calls[0].args[0] as {p_member_ids:string[]}).p_member_ids.length))
      .toEqual([200,200,50]);
    expect(calls.every(c=>(c.calls[0].args[0] as {p_year:number}).p_year===2026)).toBe(true);
  });

  it('propagates a missing or denied role RPC instead of hiding the failed read', async () => {
    supabaseMock.queueResult('rpc:public_member_roles', {data:null,error:postgrestError('permission denied','42501')});
    await expect(getPublicMemberRoles(2026,['one'])).rejects.toThrow(/Insufficient permissions/);
    expect(supabaseMock.queriesFor('cabinet_members')).toHaveLength(0);
  });

  it('rejects a foreign member returned by the RPC', async () => {
    supabaseMock.queueResult('rpc:public_member_roles', {data:[row('other','board','Board Member')],error:null});
    await expect(getPublicMemberRoles(2026,['one'])).rejects.toThrow(/foreign year or member/);
  });

  it('rejects unbounded result arrays and 2,001-member requests', async () => {
    supabaseMock.queueResult('rpc:public_member_roles', {data:Array.from({length:26},()=>row('one','board','Board Member')),error:null});
    await expect(getPublicMemberRoles(2026,['one'])).rejects.toThrow(/response budget/);
    supabaseMock.reset();
    await expect(getPublicMemberRoles(2026,Array.from({length:2001},(_,i)=>'id-'+i)))
      .rejects.toThrow(/visible-member limit/);
    expect(supabaseMock.queries()).toHaveLength(0);
  });
});

describe('published Board cohort read (#628)', () => {
  it('reads only canonical linked Board IDs and excludes intern-only rows', async () => {
    supabaseMock.queueResult('cabinet_years', { data: [year], error: null });
    supabaseMock.queueResult('cabinet_members', { data: [
      { id: 'r1', member_id: 'member-board', category: 'Executive Board' },
      { id: 'r2', member_id: 'member-board', category: 'General Board' },
      { id: 'r3', member_id: 'intern-only', category: 'Interns' },
    ], error: null });
    await expect(getPublishedBoardMemberIds(2026)).resolves.toEqual(new Set(['member-board']));
    expect(supabaseMock.queries().map((q) => q.table)).toEqual(['cabinet_years', 'cabinet_members']);
    const reads = supabaseMock.queriesFor('cabinet_members')[0].calls;
    expect(reads).toContainEqual({ method: 'select', args: ['id, member_id, category'] });
    expect(reads).toContainEqual({ method: 'eq', args: ['cabinet_year_id', year.id] });
    expect(reads).toContainEqual({ method: 'range', args: [0, 499] });
    expect(JSON.stringify(reads)).not.toMatch(/name|email|draft|house_member|attendance|points|\*/);
  });

  it('fails closed when an academic year or published Board roster is unavailable', async () => {
    supabaseMock.queueResult('cabinet_years', { data: [], error: null });
    await expect(getPublishedBoardMemberIds(2026)).rejects.toThrow();
    expect(supabaseMock.queriesFor('cabinet_members')).toHaveLength(0);
    supabaseMock.reset();
    supabaseMock.queueResult('cabinet_years', { data: [year], error: null });
    supabaseMock.queueResult('cabinet_members', { data: [{ id: 'i1', member_id: 'intern', category: 'Interns' }], error: null });
    await expect(getPublishedBoardMemberIds(2026)).rejects.toThrow(/not yet available/);
  });

  it('paginates the public roster after 500 rows without arbitrary classifications', async () => {
    supabaseMock.queueResult('cabinet_years', { data: [year], error: null });
    const make = (index: number) => ({ id: 'r-' + index, member_id: 'member-' + index, category: 'General Board' });
    supabaseMock.queueResult('cabinet_members', { data: Array.from({ length: 500 }, (_, i) => make(i)), error: null });
    supabaseMock.queueResult('cabinet_members', { data: [make(500)], error: null });
    const result = await getPublishedBoardMemberIds(2026);
    expect(result.size).toBe(501);
    const ranges = supabaseMock.queriesFor('cabinet_members').flatMap(q => q.calls).filter(c => c.method === 'range');
    expect(ranges).toEqual([{ method: 'range', args: [0, 499] }, { method: 'range', args: [500, 999] }]);
  });

  it('does not silently classify after an RLS/permissions failure', async () => {
    supabaseMock.queueResult('cabinet_years', { data: [year], error: null });
    supabaseMock.queueResult('cabinet_members', { data: null, error: postgrestError('permission denied', '42501') });
    await expect(getPublishedBoardMemberIds(2026)).rejects.toThrow();
    expect(supabaseMock.queriesFor('member_yearly_points')).toHaveLength(0);
  });
});

describe('getPublishedBoardMemberIds with unlinked positions', () => {
  it('refuses to split cohorts while a Board position has no member link', async () => {
    supabaseMock.queueResult('cabinet_years', { data: [{ id: 'cabinet-year-2024' }], error: null });
    supabaseMock.queueResult('cabinet_members', {
      data: [
        { id: 'c1', member_id: 'linked', category: 'Executive Board' },
        { id: 'c2', member_id: null, category: 'General Board' },
      ],
      error: null,
    });
    await expect(getPublishedBoardMemberIds(2024)).rejects.toThrow();
  });
});
