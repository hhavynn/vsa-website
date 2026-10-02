/**
 * Proves normal admin usage stays far below the Supabase request circuit
 * breaker: a full Admin Overview load (health counts + Operations dashboard)
 * is replayed, request for request, through the real guard.
 */
import { adminOverviewRepository } from './adminOverview';
import { adminOperationsRepository } from './adminOperations';
import { academicTermsRepository } from './academicTerms';
import { supabaseMock, RecordedQuery } from '../../test-utils/supabaseMock';
import { REQUEST_GUARD_CONFIG, createRequestGuard } from '../../lib/supabaseRequestGuard';

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

function isHead(query: RecordedQuery) {
  return query.calls.some((call) => call.method === 'select' && JSON.stringify(call.args).includes('"head":true'));
}

/** Replays one recorded Supabase call as the HTTP request PostgREST would send. */
function toRequest(query: RecordedQuery, index: number): { url: string; init: RequestInit } {
  const filters = query.calls.filter((call) => call.method !== 'select').map((call) => `${call.method}=${JSON.stringify(call.args)}`);
  const writes = query.calls.some((call) => ['insert', 'update', 'upsert', 'delete'].includes(call.method));
  const method = writes ? 'POST' : isHead(query) ? 'HEAD' : 'GET';
  return { url: `https://test.supabase.co/rest/v1/${query.table}?${filters.join('&')}&n=${index}`, init: { method } };
}

async function loadAdminOverviewOnce() {
  const before = supabaseMock.queries().length;
  await Promise.all([adminOverviewRepository.load(NOW), adminOperationsRepository.loadInputs()]);
  return supabaseMock.queries().slice(before);
}

describe('admin request budget', () => {
  it('a full Admin Overview load is a few dozen requests, a fraction of the burst limit', async () => {
    const requests = await loadAdminOverviewOnce();

    // Was ~45 count probes for the health scan alone, plus the dashboard.
    expect(requests.length).toBeLessThanOrEqual(40);
    expect(requests.length).toBeLessThan(REQUEST_GUARD_CONFIG.burstMaxRequests / 4);
    expect(requests.filter(isHead).length).toBeLessThanOrEqual(5);
  });

  it('never queries the same table with several count filters', async () => {
    const requests = await loadAdminOverviewOnce();
    const headsPerTable = requests.filter(isHead).reduce<Record<string, number>>((acc, q) => ({ ...acc, [q.table]: (acc[q.table] ?? 0) + 1 }), {});
    // `members` is counted by both the health scan and the Operations dashboard (the one remaining duplicate).
    expect(Math.max(...Object.values(headsPerTable))).toBeLessThanOrEqual(2);
  });

  it('does not trip the circuit breaker when an admin loads, refreshes and re-opens the Overview back to back', async () => {
    let clock = 0;
    const sent: string[] = [];
    const warnings: string[] = [];
    const guard = createRequestGuard({
      now: () => clock,
      warn: (message) => warnings.push(message),
      fetch: (async (input: RequestInfo | URL) => {
        sent.push(String(input));
        return new Response('[]', { status: 200 });
      }) as typeof fetch,
    });

    let responses = 0;
    for (let load = 0; load < 3; load += 1) {
      const requests = await loadAdminOverviewOnce();
      const results = await Promise.all(
        requests.map((query, index) => {
          const { url, init } = toRequest(query, index);
          return guard.fetch(url, init);
        }),
      );
      responses += results.length;
      expect(results.every((response) => response.status === 200)).toBe(true);
      clock += 2_000;
    }

    expect(warnings).toEqual([]);
    expect(guard.getState()).toMatchObject({ blocked: false, trips: 0, blockedRequests: 0 });
    expect(sent).toHaveLength(responses);
  });
});
