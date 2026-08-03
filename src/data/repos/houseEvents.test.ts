/**
 * Draft-content leak guard for house events (#292), plus repository-layer
 * coverage (#291).
 *
 * WHY THIS IS STRUCTURAL RATHER THAN CASE-BY-CASE
 * -----------------------------------------------
 * HouseEventsRepository splits its read surface by naming convention: six
 * `getPublic*` methods that must exclude drafts, and `getAdminEvents` which
 * must not. Testing them one at a time would guard today's methods and say
 * nothing about the next one somebody adds.
 *
 * So this test discovers `getPublic*` methods by reflection and fails if any
 * of them omits `.eq('is_published', true)` — and separately fails if a new
 * `getPublic*` method appears without being added to the invocation table.
 * A future `getPublicFooBar` that forgets the filter cannot pass silently.
 */

import { houseEventsRepository, HouseEventsRepository } from './houseEvents';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

// Hoisted above the imports by babel-plugin-jest-hoist; the lazy getter avoids
// referencing an out-of-scope binding from inside the factory.
jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const TODAY = '2026-10-01';
const HOUSE_ID = 'house-profile-1';
const YEAR = 2026;

/**
 * How to call each public read method. Keep in sync with the repository —
 * the completeness test below fails if a `getPublic*` method is missing here.
 */
const PUBLIC_READ_INVOCATIONS: Record<string, () => Promise<unknown>> = {
  getPublicUpcomingForHouse: () =>
    houseEventsRepository.getPublicUpcomingForHouse(HOUSE_ID, TODAY),
  getPublicPastForHouse: () => houseEventsRepository.getPublicPastForHouse(HOUSE_ID, TODAY),
  getPublicEventsForYear: () => houseEventsRepository.getPublicEventsForYear(YEAR),
  getPublicPastEventsForYear: () =>
    houseEventsRepository.getPublicPastEventsForYear(TODAY, YEAR),
  getPublicUpcomingPreview: () => houseEventsRepository.getPublicUpcomingPreview(TODAY, YEAR),
  getPublicEventsInRange: () =>
    houseEventsRepository.getPublicEventsInRange('2026-09-01', '2026-12-31'),
};

function discoverPublicReadMethods(): string[] {
  return Object.getOwnPropertyNames(HouseEventsRepository.prototype)
    .filter((name) => name.startsWith('getPublic'))
    .sort();
}

beforeEach(() => {
  supabaseMock.reset();
});

describe('HouseEventsRepository — public read surface excludes drafts (#292)', () => {
  it('has an invocation registered for every getPublic* method', () => {
    // Guards the guard: if someone adds a public read method and does not
    // register it here, this fails rather than silently skipping it.
    expect(discoverPublicReadMethods()).toEqual(Object.keys(PUBLIC_READ_INVOCATIONS).sort());
  });

  it.each(Object.keys(PUBLIC_READ_INVOCATIONS))(
    '%s filters on is_published = true',
    async (methodName) => {
      await PUBLIC_READ_INVOCATIONS[methodName]();

      expect(supabaseMock.filtersFor('house_events')).toContainEqual(['is_published', true]);
    }
  );

  it('the admin read path deliberately does not filter on is_published', async () => {
    await houseEventsRepository.getAdminEvents(YEAR);

    // Admins must be able to see drafts; this asserts the asymmetry is real
    // and intentional rather than accidental.
    expect(supabaseMock.filtersFor('house_events')).not.toContainEqual(['is_published', true]);
  });
});

describe('HouseEventsRepository — behaviour', () => {
  it('returns an empty list when there are no published events', async () => {
    supabaseMock.queueResult('house_events', { data: [], error: null });

    await expect(houseEventsRepository.getPublicEventsForYear(YEAR)).resolves.toEqual([]);
  });

  it('orders upcoming events by date ascending', async () => {
    await houseEventsRepository.getPublicUpcomingForHouse(HOUSE_ID, TODAY);

    expect(supabaseMock.queriesFor('house_events')[0].calls).toContainEqual({
      method: 'order',
      args: ['event_date', { ascending: true }],
    });
  });

  it('surfaces a permission denial rather than returning empty', async () => {
    // Failing open — returning [] on an RLS denial — would look identical to
    // "no events" in the UI and hide a security regression.
    supabaseMock.queueResult('house_events', {
      data: null,
      error: postgrestError('permission denied for table house_events', '42501'),
    });

    await expect(houseEventsRepository.getPublicEventsForYear(YEAR)).rejects.toMatchObject({
      message: 'Insufficient permissions',
    });
  });
});
