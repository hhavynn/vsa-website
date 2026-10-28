/**
 * CRC House overview repository (#651): one admin RPC; a missing function is a
 * plain "apply the migration" message and other errors are surfaced, never an
 * empty overview.
 */
import { houseOverviewRepository, HOUSE_OVERVIEW_UNAVAILABLE } from './houseOverview';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

it('reads through the admin RPC and maps the window', async () => {
  supabaseMock.queueResult('rpc:admin_house_overview', {
    data: { houses: [], window: { term_id: 't', term_label: 'Fall 2026', starts_on: '2026-09-20', ends_on: '2026-12-15' }, distinct_house_events: 2, checked_at: '2026-10-28T00:00:00Z' },
    error: null,
  });
  await expect(houseOverviewRepository.getOverview(2026, 't')).resolves.toEqual({
    houses: [], window: { termId: 't', termLabel: 'Fall 2026', startsOn: '2026-09-20', endsOn: '2026-12-15', dated: true }, distinctHouseEvents: 2, checkedAt: '2026-10-28T00:00:00Z',
  });
  expect(supabaseMock.queriesFor('rpc:admin_house_overview')[0].calls[0].args).toEqual([{ p_year: 2026, p_term_id: 't' }]);
});

it('explains a missing function and surfaces other errors', async () => {
  supabaseMock.queueResult('rpc:admin_house_overview', { data: null, error: postgrestError('missing', '42883') });
  await expect(houseOverviewRepository.getOverview(2026, null)).rejects.toThrow(HOUSE_OVERVIEW_UNAVAILABLE);
  supabaseMock.queueResult('rpc:admin_house_overview', { data: null, error: postgrestError('denied', '42501') });
  await expect(houseOverviewRepository.getOverview(2026, null)).rejects.toBeTruthy();
  supabaseMock.queueResult('rpc:admin_house_overview', { data: {}, error: null });
  await expect(houseOverviewRepository.getOverview(2026, null)).rejects.toThrow(/returned no result/);
});
