/**
 * Request budget for the Admin Overview. The page used to issue ~45 count
 * probes (events alone 12 times) in several sequential stages.
 */
import { adminOverviewRepository } from './adminOverview';
import { academicTermsRepository } from './academicTerms';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));
jest.mock('./academicTerms', () => ({ academicTermsRepository: { getActiveTerm: jest.fn() } }));

const NOW = new Date('2026-10-02T12:00:00Z');

beforeEach(() => {
  supabaseMock.reset();
  (academicTermsRepository.getActiveTerm as jest.Mock).mockResolvedValue({ academic_year_start: 2026 });
});

function isHeadCount(query: { calls: Array<{ method: string; args: unknown[] }> }) {
  return query.calls.some((call) => call.method === 'select' && JSON.stringify(call.args).includes('"head":true'));
}

describe('adminOverviewRepository.load', () => {
  it('reads each table once, and only the large members table is a count probe', async () => {
    const snapshot = await adminOverviewRepository.load(NOW);

    const queries = supabaseMock.queries();
    const perTable = queries.reduce<Record<string, number>>((acc, q) => ({ ...acc, [q.table]: (acc[q.table] ?? 0) + 1 }), {});

    expect(Object.values(perTable).every((n) => n === 1)).toBe(true);
    // 17 table reads here + 1 active-term lookup (mocked) = 18 requests, down from ~45.
    // The attention queue's three counts replaced the old merge-exclusions count (net +2).
    expect(queries).toHaveLength(17);
    expect(snapshot.unavailable).toEqual([]);
    expect(queries.filter(isHeadCount).map((q) => q.table).sort()).toEqual(['academic_terms', 'ai_feedback', 'data_rights_requests', 'member_photo_requests', 'members']);
  });

  it('is read-only', async () => {
    await adminOverviewRepository.load(NOW);
    const writes = ['insert', 'update', 'upsert', 'delete'];
    expect(supabaseMock.queries().some((q) => q.calls.some((c) => writes.includes(c.method)))).toBe(false);
  });

  it('feeds the rows it read into the derived stats', async () => {
    supabaseMock.queueResult('members', { data: null, error: null, count: 820 } as never);
    supabaseMock.queueResult('events', {
      data: [
        { date: '2026-10-10T01:00:00Z', is_published: true, image_url: null, location: 'PC', check_in_form_url: 'https://forms.gle/a', academic_term_id: null },
        { date: '2026-09-01T01:00:00Z', is_published: false, image_url: '/a.jpg', location: null, check_in_form_url: null, academic_term_id: 't' },
      ],
      error: null,
      count: 2,
    } as never);

    const { stats } = await adminOverviewRepository.load(NOW);

    expect(stats).toMatchObject({ members: 820, events: 2, upcomingEvents: 1, eventsPublished: 1, eventsDraft: 1, eventsMissingImage: 1, eventsMissingLocation: 1, eventsMissingTerms: 1 });
  });

  it('treats a response cut off by the API row cap as unavailable, not as a smaller number', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      supabaseMock.queueResult('cabinet_members', {
        data: [{ cabinet_year_id: 'a', image_url: null, role: 'x' }],
        error: null,
        count: 1500,
      } as never);

      const { stats, unavailable } = await adminOverviewRepository.load(NOW);

      expect(unavailable).toContain('cabinet');
      expect(stats.cabinetMembers).toBe(0);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('keeps going when one table fails and says which one', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      supabaseMock.queueResult('gallery_events', { data: null, error: { message: 'permission denied' } });
      const { unavailable } = await adminOverviewRepository.load(NOW);
      expect(unavailable).toEqual(['gallery']);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('marks the active term unavailable when its lookup throws', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      (academicTermsRepository.getActiveTerm as jest.Mock).mockRejectedValue(new Error('nope'));
      const { stats } = await adminOverviewRepository.load(NOW);
      expect(stats.activeTermUnavailable).toBe(true);
    } finally {
      consoleError.mockRestore();
    }
  });
});
