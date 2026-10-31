import { ACE_ELIGIBILITY_UNAVAILABLE, aceAssignmentsRepository } from './aceAssignments';
import { ValidationError } from '../errors';
import { postgrestError, supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

const callsOf = (table: string, method: string) =>
  supabaseMock
    .queriesFor(table)
    .flatMap((query) => query.calls)
    .filter((call) => call.method === method);

describe('cycle status changes', () => {
  it('locks only while the cycle is still a draft', async () => {
    supabaseMock.setDefault('ace_assignment_cycles', { data: { id: 'c1', status: 'locked' }, error: null });
    await aceAssignmentsRepository.setCycleStatus('c1', 'draft', 'locked');
    expect(supabaseMock.filtersFor('ace_assignment_cycles')).toEqual(
      expect.arrayContaining([['id', 'c1'], ['status', 'draft']]),
    );
    expect((callsOf('ace_assignment_cycles', 'update')[0].args[0] as { status: string }).status).toBe('locked');
  });

  it('reports a stale screen instead of overwriting another admin\'s change', async () => {
    supabaseMock.setDefault('ace_assignment_cycles', { data: null, error: null });
    await expect(aceAssignmentsRepository.setCycleStatus('c1', 'draft', 'locked')).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses impossible transitions before touching the database', async () => {
    await expect(aceAssignmentsRepository.setCycleStatus('c1', 'published', 'draft')).rejects.toBeInstanceOf(ValidationError);
    await expect(aceAssignmentsRepository.setCycleStatus('c1', 'draft', 'published')).rejects.toBeInstanceOf(ValidationError);
    expect(supabaseMock.queriesFor('ace_assignment_cycles')).toHaveLength(0);
  });
});

describe('drafts', () => {
  it('imports create draft rows only and never touch the live ACE tree', async () => {
    supabaseMock.setDefault('ace_assignment_drafts', { data: [], error: null });
    await aceAssignmentsRepository.addDrafts(
      'c1',
      [
        { little_name: 'Amy Tran', little_member_id: 'm1', big_ace_member_id: 'b1', notes: null },
        { little_name: 'Kevin Le', little_member_id: null, big_ace_member_id: null, notes: 'Requested Big: X (not found)' },
      ],
      5,
    );
    const rows = callsOf('ace_assignment_drafts', 'insert')[0].args[0] as Array<Record<string, unknown>>;
    expect(rows.map((r) => [r.cycle_id, r.little_name, r.display_order])).toEqual([
      ['c1', 'Amy Tran', 5],
      ['c1', 'Kevin Le', 6],
    ]);
    expect(rows.every((r) => !('email' in r))).toBe(true);
    expect(supabaseMock.queriesFor('ace_family_members')).toHaveLength(0);
  });

  it('bulk-links Littles only while still unlinked, and reports skipped ones', async () => {
    supabaseMock
      .queueResult('ace_assignment_drafts', { data: [{ id: 'd1' }], error: null })
      .queueResult('ace_assignment_drafts', { data: [], error: null });
    await expect(
      aceAssignmentsRepository.linkDraftMembers([
        { draftId: 'd1', memberId: 'm1' },
        { draftId: 'd2', memberId: 'm2' },
      ]),
    ).resolves.toEqual({ linked: ['d1'], skipped: ['d2'] });
    for (const query of supabaseMock.queriesFor('ace_assignment_drafts')) {
      expect(query.calls).toContainEqual({ method: 'is', args: ['little_member_id', null] });
    }
  });
});

describe('publishCycle', () => {
  it('publishes through the single database function and never inserts nodes itself', async () => {
    supabaseMock.setDefault('rpc:publish_ace_assignment_cycle', {
      data: { cycle_id: 'c1', status: 'published', created: 42, total: 42, already_published: false },
      error: null,
    });
    await expect(aceAssignmentsRepository.publishCycle('c1')).resolves.toEqual({
      cycleId: 'c1',
      created: 42,
      total: 42,
      alreadyPublished: false,
    });
    expect(supabaseMock.queriesFor('rpc:publish_ace_assignment_cycle')[0].calls[0].args[0]).toEqual({ p_cycle_id: 'c1' });
    expect(supabaseMock.queriesFor('ace_family_members')).toHaveLength(0);
  });

  it('a repeat publish reports the cycle as already published with nothing created', async () => {
    supabaseMock.setDefault('rpc:publish_ace_assignment_cycle', {
      data: { cycle_id: 'c1', status: 'published', created: 0, total: 42, already_published: true },
      error: null,
    });
    await expect(aceAssignmentsRepository.publishCycle('c1')).resolves.toMatchObject({ created: 0, alreadyPublished: true });
  });

  it('surfaces the database\'s blocker list', async () => {
    supabaseMock.setDefault('rpc:publish_ace_assignment_cycle', {
      data: null,
      error: { message: 'Publish blocked: 2 Little(s) have no Big', code: 'P0001', details: '', hint: '' },
    });
    await expect(aceAssignmentsRepository.publishCycle('c1')).rejects.toThrow('Publish blocked: 2 Little(s) have no Big');
  });

  it('rejects an unexpected response shape', async () => {
    supabaseMock.setDefault('rpc:publish_ace_assignment_cycle', { data: { nope: true }, error: null });
    await expect(aceAssignmentsRepository.publishCycle('c1')).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('published-cycle ACE participation roster (#649)',()=>{
  const sample=(id:string)=>({id,little_name:'Synthetic '+id,little_member_id:'member-'+id,
    big_ace_member_id:'big',published_ace_member_id:'node-'+id});
  it('pages all published-cycle rows beyond 1000 with only identity fields, no draft notes',async()=>{
    supabaseMock.queueResult('ace_assignment_cycles',{data:{id:'cycle',status:'published',academic_year_start:2026},error:null});
    supabaseMock.queueResult('ace_assignment_drafts',{data:Array.from({length:500},(_,i)=>sample(String(i))),error:null});
    supabaseMock.queueResult('ace_assignment_drafts',{data:Array.from({length:500},(_,i)=>sample(String(i+500))),error:null});
    supabaseMock.queueResult('ace_assignment_drafts',{data:[sample('1000')],error:null});
    const list=await aceAssignmentsRepository.listPublishedCycleLittles('cycle',2026);
    expect(list).toHaveLength(1001);
    const queries=supabaseMock.queriesFor('ace_assignment_drafts');
    expect(queries.map(q=>q.calls.find(c=>c.method==='range')?.args))
      .toEqual([[0,499],[500,999],[1000,1499]]);
    queries.forEach(q=>{
      expect(q.calls).toContainEqual({method:'eq',args:['cycle_id','cycle']});
      const selection=String(q.calls.find(c=>c.method==='select')?.args[0]);
      expect(selection).not.toMatch(/notes|email|\*/);
    });
  });
  it('refuses unapproved cycles and never reads draft roster',async()=>{
    supabaseMock.queueResult('ace_assignment_cycles',{data:{id:'cycle',status:'locked',academic_year_start:2026},error:null});
    await expect(aceAssignmentsRepository.listPublishedCycleLittles('cycle',2026)).rejects.toThrow();
    expect(supabaseMock.queriesFor('ace_assignment_drafts')).toHaveLength(0);
  });
  it('later page failure rejects all status counts',async()=>{
    supabaseMock.queueResult('ace_assignment_cycles',{data:{id:'cycle',status:'published',academic_year_start:2026},error:null});
    supabaseMock.queueResult('ace_assignment_drafts',{data:Array.from({length:500},(_,i)=>sample(String(i))),error:null});
    supabaseMock.queueResult('ace_assignment_drafts',{data:null,error:{message:'denied',code:'42501'}});
    await expect(aceAssignmentsRepository.listPublishedCycleLittles('cycle',2026)).rejects.toThrow();
  });
});

describe('saved eligibility policy', () => {
  it('saves both minimums and a de-duplicated event set in one RPC', async () => {
    supabaseMock.queueResult('rpc:save_ace_eligibility_policy', {
      data: { cycle_id: 'c1', little_min_events: 4, big_min_events: 3, event_count: 2, added: 2, removed: 0 },
      error: null,
    });
    await expect(
      aceAssignmentsRepository.saveEligibilityPolicy('c1', { littleMin: 4, bigMin: 3, eventIds: ['e2', 'e1', 'e2'] }),
    ).resolves.toEqual({ cycleId: 'c1', eventCount: 2, added: 2, removed: 0 });
    expect(supabaseMock.queriesFor('rpc:save_ace_eligibility_policy')[0].calls[0].args[0]).toEqual({
      p_cycle_id: 'c1',
      p_little_min_events: 4,
      p_big_min_events: 3,
      p_event_ids: ['e1', 'e2'],
    });
    expect(supabaseMock.queriesFor('ace_assignment_cycle_events')).toHaveLength(0);
  });

  it('refuses minimums outside 1–20 and more than 100 events before touching the database', async () => {
    await expect(aceAssignmentsRepository.saveEligibilityPolicy('c1', { littleMin: 0, bigMin: 3, eventIds: [] })).rejects.toBeInstanceOf(ValidationError);
    await expect(aceAssignmentsRepository.saveEligibilityPolicy('c1', { littleMin: 4, bigMin: 21, eventIds: [] })).rejects.toBeInstanceOf(ValidationError);
    const many = Array.from({ length: 101 }, (_, i) => `e${i}`);
    await expect(aceAssignmentsRepository.saveEligibilityPolicy('c1', { littleMin: 4, bigMin: 3, eventIds: many })).rejects.toBeInstanceOf(ValidationError);
    expect(supabaseMock.queriesFor('rpc:save_ace_eligibility_policy')).toHaveLength(0);
  });

  it('surfaces the frozen-policy refusal from the database', async () => {
    supabaseMock.queueResult('rpc:save_ace_eligibility_policy', {
      data: null,
      error: postgrestError('The eligibility policy is locked and cannot be edited. Unlock the cycle first.', 'P0001'),
    });
    await expect(aceAssignmentsRepository.saveEligibilityPolicy('c1', { littleMin: 4, bigMin: 3, eventIds: [] })).rejects.toThrow(/locked/);
  });

  it('asks for the migration when the policy table or function is missing', async () => {
    supabaseMock.queueResult('ace_assignment_cycle_events', { data: null, error: postgrestError('missing', 'PGRST205') });
    await expect(aceAssignmentsRepository.listEligibilityEventIds('c1')).rejects.toThrow(ACE_ELIGIBILITY_UNAVAILABLE);
    supabaseMock.queueResult('rpc:save_ace_eligibility_policy', { data: null, error: postgrestError('missing', 'PGRST202') });
    await expect(aceAssignmentsRepository.saveEligibilityPolicy('c1', { littleMin: 4, bigMin: 3, eventIds: [] })).rejects.toThrow(ACE_ELIGIBILITY_UNAVAILABLE);
  });

  it('reads only the event ids of one cycle', async () => {
    supabaseMock.queueResult('ace_assignment_cycle_events', { data: [{ event_id: 'e1' }, { event_id: 'e2' }], error: null });
    await expect(aceAssignmentsRepository.listEligibilityEventIds('c1')).resolves.toEqual(['e1', 'e2']);
    expect(callsOf('ace_assignment_cycle_events', 'select')[0].args[0]).toBe('event_id');
    expect(supabaseMock.filtersFor('ace_assignment_cycle_events')).toContainEqual(['cycle_id', 'c1']);
  });
});

describe('approved cycle term writes (#674)', () => {
  it('creates a cycle with explicit FA26, not a term guessed from the current date', async () => {
    supabaseMock.setDefault('ace_assignment_cycles', {
      data: { id: 'cycle-1', academic_year_start: 2026, pickup_term: 'FA26', status: 'draft' }, error: null,
    });
    await aceAssignmentsRepository.createCycle(2026, 'FA26');
    expect(callsOf('ace_assignment_cycles', 'insert')[0].args[0]).toEqual({
      academic_year_start: 2026, academic_year_end: 2027, pickup_term: 'FA26',
    });
  });

  it('allows SP27 in the 2026–27 cycle and rejects SP27 scoped to 2027–28', async () => {
    supabaseMock.setDefault('ace_assignment_cycles', {
      data: { id: 'c1', pickup_term: 'SP27' }, error: null,
    });
    await expect(aceAssignmentsRepository.createCycle(2026, 'SP27')).resolves.toBeTruthy();
    await expect(aceAssignmentsRepository.createCycle(2027, 'SP27')).rejects.toBeInstanceOf(ValidationError);
    expect(callsOf('ace_assignment_cycles', 'insert')).toHaveLength(1);
  });

  it('updates the term only for matching draft, year and previously approved value', async () => {
    supabaseMock.setDefault('ace_assignment_cycles', { data: { id: 'c1', pickup_term: 'SP27' }, error: null });
    await aceAssignmentsRepository.setCycleTerm('c1', 2026, null, 'SP27');
    const query = supabaseMock.queriesFor('ace_assignment_cycles')[0];
    expect(query.calls).toContainEqual({ method: 'eq', args: ['status', 'draft'] });
    expect(query.calls).toContainEqual({ method: 'eq', args: ['academic_year_start', 2026] });
    expect(query.calls).toContainEqual({ method: 'is', args: ['pickup_term', null] });
    expect((callsOf('ace_assignment_cycles', 'update')[0].args[0] as { pickup_term: string }).pickup_term).toBe('SP27');
  });

  it('does not overwrite an edited or locked cycle when the CAS returns no row', async () => {
    supabaseMock.setDefault('ace_assignment_cycles', { data: null, error: null });
    await expect(aceAssignmentsRepository.setCycleTerm('c1', 2026, 'FA26', 'SP27')).rejects.toBeInstanceOf(ValidationError);
    expect(supabaseMock.filtersFor('ace_assignment_cycles')).toContainEqual(['pickup_term', 'FA26']);
  });
});
