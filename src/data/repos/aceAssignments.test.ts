import { aceAssignmentsRepository } from './aceAssignments';
import { ValidationError } from '../errors';
import { supabaseMock } from '../../test-utils/supabaseMock';

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
