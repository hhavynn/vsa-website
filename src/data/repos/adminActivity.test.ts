import { ACTIVITY_ACTIONS, activitySummary, buildUndoMetadata } from '../../lib/adminActivity';

const insert = jest.fn();
const select = jest.fn();
const single = jest.fn();
const mockGetSession = jest.fn();
const order = jest.fn();
const limit = jest.fn();
const or = jest.fn();
const eq = jest.fn();

function listChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const thenable = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
  chain.select = jest.fn(() => chain);
  chain.order = order.mockImplementation(() => chain);
  chain.limit = limit.mockImplementation(() => chain);
  chain.or = or.mockImplementation(() => chain);
  chain.eq = eq.mockImplementation(() => chain);
  return Object.assign(chain, thenable);
}

let mockFromImpl: () => unknown;
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: (...args: unknown[]) => mockGetSession(...args) },
    from: (...args: unknown[]) => {
      void args;
      return mockFromImpl();
    },
  },
}));

import { AdminActivityRepository } from './adminActivity';

const repo = new AdminActivityRepository();
const UUID = '3b5f6c1e-9d3a-4b5e-8f10-1a2b3c4d5e6f';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue({ data: { session: { user: { email: 'havyn@vsa.org', user_metadata: { full_name: 'Havyn Nguyen' } } } } });
  single.mockResolvedValue({ data: { id: 'log-1' }, error: null });
  select.mockReturnValue({ single });
  insert.mockReturnValue({ select });
  mockFromImpl = () => ({ insert });
});

describe('AdminActivityRepository.record', () => {
  it('writes the entry with a concise summary, the actor first name, and the undo spec', async () => {
    const id = await repo.record({
      action: ACTIVITY_ACTIONS.houseAssignmentChanged,
      entityType: 'house_assignment_draft',
      entityId: UUID,
      academicYearStart: 2026,
      summary: activitySummary.houseChanged('Kevin Tran', 'Boo', 'Toad'),
      metadata: buildUndoMetadata({ kind: 'house_draft_house', target: { batchId: 'b', draftId: 'd' }, before: 'boo', after: 'toad' }),
    });
    expect(id).toBe('log-1');
    expect(insert).toHaveBeenCalledTimes(1);
    const row = insert.mock.calls[0][0];
    expect(row).toMatchObject({
      action: 'house.assignment_changed',
      entity_type: 'house_assignment_draft',
      entity_id: UUID,
      academic_year_start: 2026,
      summary: "Changed Kevin Tran's House: Boo → Toad",
    });
    expect(row.metadata.actor).toBe('Havyn');
    expect(row.metadata.undo.kind).toBe('house_draft_house');
    // The actor id is filled by the database (auth.uid()), never sent by the client.
    expect(row).not.toHaveProperty('actor_user_id');
  });

  it('never stores sensitive fields passed in metadata', async () => {
    await repo.record({ action: 'member.link_changed', entityType: 'member', summary: 's', metadata: { email: 'a@b.c', phone: '1', note: 'ok' } });
    const { metadata } = insert.mock.calls[0][0];
    expect(metadata).not.toHaveProperty('email');
    expect(metadata).not.toHaveProperty('phone');
    expect(metadata.note).toBe('ok');
  });

  it('drops an entity id that is not a uuid instead of failing the insert', async () => {
    await repo.record({ action: 'ace.link_changed', entityType: 'ace_family_member', entityId: 'not-a-uuid', summary: 's' });
    expect(insert.mock.calls[0][0].entity_id).toBeNull();
  });

  it('never throws or blocks the admin change when the log cannot be written', async () => {
    single.mockResolvedValue({ data: null, error: { message: 'relation "admin_activity_log" does not exist' } });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(repo.record({ action: 'ace.link_changed', entityType: 'x', summary: 's' })).resolves.toBeNull();
  });

  it('also survives a thrown error', async () => {
    mockGetSession.mockRejectedValue(new Error('offline'));
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(repo.record({ action: 'ace.link_changed', entityType: 'x', summary: 's' })).resolves.toBeNull();
  });
});

describe('AdminActivityRepository.list', () => {
  const rows = [
    { id: 'a', actor_user_id: 'u', action: 'house.assignment_changed', entity_type: 't', entity_id: null, academic_year_start: 2026, summary: 's', metadata: { x: 1 }, created_at: '2026-10-02T00:00:00Z' },
    { id: 'b', actor_user_id: null, action: 'ace.link_changed', entity_type: 't', entity_id: null, academic_year_start: null, summary: 's', metadata: null, created_at: '2026-10-01T00:00:00Z' },
  ];

  it('maps rows to entries, tolerating missing metadata', async () => {
    mockFromImpl = () => listChain({ data: rows, error: null });
    const entries = await repo.list();
    expect(entries.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(entries[1].metadata).toEqual({});
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('filters by domain on the server using the action prefix', async () => {
    mockFromImpl = () => listChain({ data: [], error: null });
    await repo.list({ filter: 'houses', academicYearStart: 2026, limit: 10 });
    expect(or).toHaveBeenCalledWith('action.like.house.%');
    expect(eq).toHaveBeenCalledWith('academic_year_start', 2026);
    expect(limit).toHaveBeenCalledWith(10);
  });

  it('applies no action filter for All', async () => {
    mockFromImpl = () => listChain({ data: [], error: null });
    await repo.list({ filter: 'all' });
    expect(or).not.toHaveBeenCalled();
  });
});
