import { contentHealthRepository } from './contentHealth';
import { ContentHealthFinding } from '../../lib/contentHealth';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const NOW = new Date('2026-10-04T18:00:00Z');

const finding = (overrides: Partial<ContentHealthFinding> = {}): ContentHealthFinding => ({
  key: 'draft-event-past:d1',
  check: 'draft-event-past',
  severity: 'medium',
  area: 'events',
  contentType: 'Event',
  title: 'Mixer',
  reason: 'Still a draft.',
  fixPath: '/admin/events?filter=draft',
  checkedAt: NOW.toISOString(),
  fingerprint: '2026-08-01T00:00:00Z',
  acknowledgeable: true,
  ...overrides,
});

beforeEach(() => supabaseMock.reset());

describe('readState', () => {
  it('is one request that skips healthy and skipped links', async () => {
    supabaseMock.queueResult('content_health_state', { data: [], error: null, count: 0 } as never);
    await contentHealthRepository.readState();

    const queries = supabaseMock.queries();
    expect(queries).toHaveLength(1);
    expect(queries[0].table).toBe('content_health_state');
    expect(queries[0].calls).toContainEqual({ method: 'or', args: ['check_status.eq.failed,kind.eq.acknowledgement,kind.eq.check_run'] });
  });

  it('returns null, quietly, when the table does not exist yet', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    supabaseMock.queueResult('content_health_state', { data: null, error: { code: 'PGRST205', message: 'not found' } });
    expect(await contentHealthRepository.readState()).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('returns null, loudly, for any other failure or a row-capped response', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    supabaseMock.queueResult('content_health_state', { data: null, error: { code: '42501', message: 'permission denied' } });
    expect(await contentHealthRepository.readState()).toBeNull();
    supabaseMock.queueResult('content_health_state', { data: [{ kind: 'link_check' }], error: null, count: 1500 } as never);
    expect(await contentHealthRepository.readState()).toBeNull();
    expect(consoleError).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });
});

describe('acknowledging', () => {
  it('stores an acknowledgement bound to the finding, expiring on its own, and touches no content table', async () => {
    await contentHealthRepository.acknowledge(finding(), NOW);

    const queries = supabaseMock.queries();
    expect(queries.map((q) => q.table)).toEqual(['content_health_state']);
    const upsert = queries[0].calls.find((call) => call.method === 'upsert');
    expect(upsert?.args[0]).toEqual({
      kind: 'acknowledgement',
      subject_key: 'draft-event-past:d1',
      fingerprint: '2026-08-01T00:00:00Z',
      acknowledged_at: NOW.toISOString(),
      expires_at: new Date(NOW.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(upsert?.args[1]).toEqual({ onConflict: 'kind,subject_key' });
  });

  it('refuses to acknowledge what only a review can clear', async () => {
    await expect(contentHealthRepository.acknowledge(finding({ acknowledgeable: false }), NOW)).rejects.toThrow();
    expect(supabaseMock.queries()).toEqual([]);
  });

  it('stopping removes only the acknowledgement row, never the finding or the content', async () => {
    await contentHealthRepository.removeAcknowledgement('draft-event-past:d1');

    const [query] = supabaseMock.queries();
    expect(query.calls.map((call) => call.method)).toEqual(['delete', 'eq', 'eq']);
    expect(query.calls).toContainEqual({ method: 'eq', args: ['kind', 'acknowledgement'] });
    expect(query.calls).toContainEqual({ method: 'eq', args: ['subject_key', 'draft-event-past:d1'] });
  });
});
