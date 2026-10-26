// Complete roster and attendance reads past the 1,000-row PostgREST cap. Synthetic rows only.
import { memberIdentityRepository, readAllById } from './memberIdentity';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const member = (n: number) => ({
  id: id(n), first_name: `First${n}`, last_name: `Last${n}`, college: null, year: null, email: null,
  points: 0, events_attended: 0, created_at: '2026-01-01T00:00:00Z',
});

beforeEach(() => supabaseMock.reset());

describe('loadRoster', () => {
  it('reads every member past the 1,000-row cap, in id order', async () => {
    supabaseMock.setDefault('members', { data: Array.from({ length: 2500 }, (_, i) => member(2500 - i)), error: null });
    const roster = await memberIdentityRepository.loadRoster();
    expect(roster).toHaveLength(2500);
    expect(roster[0].id).toBe(id(1));
    expect(roster[2499].id).toBe(id(2500));
    // Three full pages and the empty page that proves the end.
    expect(supabaseMock.queriesFor('members')).toHaveLength(4);
    const gt = supabaseMock.queriesFor('members').map((q) => q.calls.find((c) => c.method === 'gt')?.args[1]);
    expect(gt).toEqual([undefined, id(1000), id(2000), id(2500)]);
  });

  it('keeps reading when the server returns pages smaller than requested', async () => {
    for (let page = 0; page < 3; page += 1) {
      supabaseMock.queueResult('members', { data: Array.from({ length: 400 }, (_, i) => member(page * 400 + i + 1)), error: null });
    }
    supabaseMock.queueResult('members', { data: [], error: null });
    expect(await memberIdentityRepository.loadRoster()).toHaveLength(1200);
  });

  it('throws instead of returning a partial roster when a later page fails', async () => {
    supabaseMock.queueResult('members', { data: Array.from({ length: 1000 }, (_, i) => member(i + 1)), error: null });
    supabaseMock.queueResult('members', { data: null, error: { message: 'canceling statement due to statement timeout', code: '57014' } });
    await expect(memberIdentityRepository.loadRoster()).rejects.toThrow(/statement timeout/);
  });

  it('throws when the very first page fails, never reporting zero members', async () => {
    supabaseMock.queueResult('members', { data: null, error: { message: 'permission denied' } });
    await expect(memberIdentityRepository.loadRoster()).rejects.toThrow('Could not load the complete member list: permission denied');
  });

  it('refuses pages that do not advance', async () => {
    supabaseMock.queueResult('members', { data: [member(5)], error: null });
    supabaseMock.queueResult('members', { data: [member(5)], error: null });
    await expect(memberIdentityRepository.loadRoster()).rejects.toThrow(/out of order/);
  });
});

describe('loadEventAttendeeIds', () => {
  it('reads every attendee of a large event, filtered to that event', async () => {
    supabaseMock.setDefault('member_event_attendance', {
      data: Array.from({ length: 1500 }, (_, i) => ({ id: id(i + 1), member_id: `m${i}` })),
      error: null,
    });
    const ids = await memberIdentityRepository.loadEventAttendeeIds('gbm');
    expect(ids.size).toBe(1500);
    expect(supabaseMock.filtersFor('member_event_attendance').every(([column, value]) => column === 'event_id' && value === 'gbm')).toBe(true);
  });

  it('throws on a failed read instead of reporting nobody as already recorded', async () => {
    supabaseMock.queueResult('member_event_attendance', { data: null, error: { message: 'JWT expired', code: 'PGRST301' } });
    await expect(memberIdentityRepository.loadEventAttendeeIds('gbm')).rejects.toThrow('JWT expired');
  });
});

describe('readAllById', () => {
  it('stops on the first empty page', async () => {
    const pages = [[{ id: 'a' }, { id: 'b' }], []];
    const reads: Array<string | null> = [];
    const rows = await readAllById(async (afterId) => {
      reads.push(afterId);
      return { data: pages.shift() ?? [], error: null };
    }, 2);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(reads).toEqual([null, 'b']);
  });
});
