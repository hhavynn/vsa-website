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
  getPublicEventForHouse: () => houseEventsRepository.getPublicEventForHouse('event-1', HOUSE_ID),
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
  it('returns a linked event only when this House hosts it using published profiles', async () => {
    const row = { id: 'ev-1', house_profile_id: 'hp-other', is_published: true, houses: [{ house_page_asset_id: 'hp-other' }] };
    supabaseMock.queueResult('house_events', { data: row, error: null });
    supabaseMock.queueResult('published_house_page_assets', { data: [{ id: 'hp-other', is_active: true }], error: null });
    await expect(houseEventsRepository.getPublicEventForHouse('ev-1', HOUSE_ID)).resolves.toBeNull();

    supabaseMock.queueResult('house_events', { data: { ...row, houses: [...row.houses, { house_page_asset_id: HOUSE_ID }] }, error: null });
    supabaseMock.queueResult('published_house_page_assets', { data: [{ id: 'hp-other', is_active: true }, { id: HOUSE_ID, is_active: true }], error: null });
    await expect(houseEventsRepository.getPublicEventForHouse('ev-1', HOUSE_ID)).resolves.toMatchObject({ id: 'ev-1' });

    supabaseMock.queueResult('house_events', { data: null, error: null });
    await expect(houseEventsRepository.getPublicEventForHouse('missing', HOUSE_ID)).resolves.toBeNull();
  });

  it('fills hosts the profile embed cannot return from published profiles only, primary first', async () => {
    supabaseMock.queueResult('house_events', {
      data: [{
        id: 'he-1', house_profile_id: 'hp-b', is_published: true,
        houses: [
          { house_page_asset_id: 'hp-a', house: null },
          { house_page_asset_id: 'hp-b', house: null },
          // An admin's embed can include a not-yet-public profile; never show it.
          { house_page_asset_id: 'hp-hidden' },
        ],
      }],
      error: null,
    });
    supabaseMock.queueResult('published_house_page_assets', {
      data: [{ id: 'hp-a', display_name: 'A', is_active: true }, { id: 'hp-b', display_name: 'B', is_active: true }],
      error: null,
    });

    const [event] = await houseEventsRepository.getPublicUpcomingPreview(TODAY, null, 4);
    expect(event.houses?.map((h) => h.id)).toEqual(['hp-b', 'hp-a']);
    expect(supabaseMock.queriesFor('published_house_page_assets')).toHaveLength(1);
  });

  it.each(Object.keys(PUBLIC_READ_INVOCATIONS))('%s allowlists published House profile columns without internal notes or private source documents', async (name) => {
    // Force a published host fallback by returning the joined ID only.
    if (name === 'getPublicUpcomingForHouse' || name === 'getPublicPastForHouse') {
      supabaseMock.queueResult('house_event_houses', { data: [{ house_event_id: 'event-1' }], error: null });
    }
    supabaseMock.queueResult('house_events', {
      data: [{ id: 'event-1', house_profile_id: HOUSE_ID, is_published: true, houses: [{ house_page_asset_id: HOUSE_ID }] }],
      error: null,
    });
    supabaseMock.queueResult('published_house_page_assets', {
      data: [{ id: HOUSE_ID, house: 'example', house_key: 'example', display_name: 'Example House', is_active: true }],
      error: null,
    });
    // For maybeSingle() reads the response is an object rather than an array.
    if (name === 'getPublicEventForHouse') {
      // The check below inspects the generated query, not the response shape.
      // Skip this synthetic payload path and use a direct full single read.
      supabaseMock.reset();
      supabaseMock.queueResult('house_events', {
        data: { id: 'event-1', house_profile_id: HOUSE_ID, is_published: true, houses: [{ house_page_asset_id: HOUSE_ID }] },
        error: null,
      });
      supabaseMock.queueResult('published_house_page_assets', {
        data: [{ id: HOUSE_ID, is_active: true }],
        error: null,
      });
    }
    await PUBLIC_READ_INVOCATIONS[name]();
    const queries = supabaseMock.queriesFor('published_house_page_assets');
    expect(queries).toHaveLength(1);
    const projection = String(queries[0].calls.find((call) => call.method === 'select')?.args[0]);
    expect(projection).toContain('display_name');
    expect(projection).toContain('house_key');
    expect(projection).not.toContain('*');
    expect(projection).not.toContain('internal_notes');
    expect(projection).not.toContain('source_doc_url');
    expect(projection).not.toContain('house_parent_body');
  });

  it('does not disguise published House-profile lookup failure as an unhosted event', async () => {
    supabaseMock.queueResult('house_events', {
      data: [{ id: 'event-1', house_profile_id: HOUSE_ID, is_published: true, houses: [{ house_page_asset_id: HOUSE_ID }] }],
      error: null,
    });
    supabaseMock.queueResult('published_house_page_assets', {
      data: null, error: postgrestError('permission denied for published House profiles', '42501'),
    });
    await expect(houseEventsRepository.getPublicUpcomingPreview(TODAY, YEAR))
      .rejects.toMatchObject({ message: 'Insufficient permissions' });
  });

  it.each(Object.keys(PUBLIC_READ_INVOCATIONS))('%s never embeds the private House profile table', async (methodName) => {
    await PUBLIC_READ_INVOCATIONS[methodName]();
    const selects = supabaseMock.queriesFor('house_events')
      .flatMap(({ calls }) => calls)
      .filter(({ method }) => method === 'select')
      .map(({ args }) => String(args[0]));
    expect(selects).toHaveLength(1);
    expect(selects[0]).toContain('houses:house_event_houses(house_page_asset_id)');
    expect(selects[0]).not.toContain('house_page_assets(*)');
  });

  it.each(['getPublicUpcomingForHouse', 'getPublicPastForHouse'] as const)(
    '%s propagates an association permission error before reading events',
    async (name) => {
      supabaseMock.queueResult('house_event_houses', {
        data: null,
        error: postgrestError('permission denied for table house_event_houses', '42501'),
      });
      await expect(houseEventsRepository[name](HOUSE_ID, TODAY)).rejects.toMatchObject({
        message: 'Insufficient permissions',
      });
      expect(supabaseMock.queriesFor('house_events')).toHaveLength(0);
    },
  );

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
