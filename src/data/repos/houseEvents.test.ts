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

import { houseEventsRepository, HouseEventsRepository, PUBLIC_HOUSE_EVENT_HOST_FIELDS } from './houseEvents';
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

  it('pins the exact minimal host columns for all public reads (#640)', async () => {
    for (const name of Object.keys(PUBLIC_READ_INVOCATIONS)) {
      supabaseMock.reset();
      if (name === 'getPublicUpcomingForHouse' || name === 'getPublicPastForHouse') {
        supabaseMock.queueResult('house_event_houses', { data: [{ house_event_id: 'event-1' }], error: null });
      }
      const row = { id: 'event-1', house_profile_id: HOUSE_ID, is_published: true, houses: [{ house_page_asset_id: HOUSE_ID }] };
      supabaseMock.queueResult('house_events', { data: name === 'getPublicEventForHouse' ? row : [row], error: null });
      supabaseMock.queueResult('published_house_page_assets', { data: [{ id: HOUSE_ID, is_active: true }], error: null });
      await PUBLIC_READ_INVOCATIONS[name]();
      const selects = supabaseMock.queriesFor('published_house_page_assets')
        .flatMap(({ calls }) => calls.filter(({ method }) => method === 'select').map(({ args }) => String(args[0])));
      expect(selects).toEqual(['id,house,house_key,display_name,accent_color,is_active']);
    }
    expect(PUBLIC_HOUSE_EVENT_HOST_FIELDS).toBe('id,house,house_key,display_name,accent_color,is_active');
  });

  it('keeps the active collaborators and removes inactive or extraneous profile fields (#640)', async () => {
    const row = {
      id: 'event-1', house_profile_id: 'hp-b', is_published: true,
      houses: [
        { house_page_asset_id: 'hp-a' }, { house_page_asset_id: 'hp-b' }, { house_page_asset_id: 'hp-inactive' },
      ],
    };
    supabaseMock.queueResult('house_events', { data: [row], error: null });
    supabaseMock.queueResult('published_house_page_assets', {
      data: [
        { id: 'hp-a', house: 'alpha', house_key: 'alpha', display_name: 'Alpha', accent_color: null, is_active: true, internal_notes: 'private synthetic note' },
        { id: 'hp-b', house: 'beta', house_key: 'beta', display_name: 'Beta', accent_color: null, is_active: true, image_url: 'synthetic-private-image' },
        { id: 'hp-inactive', house: 'gamma', house_key: 'gamma', display_name: 'Gamma', accent_color: null, is_active: false },
      ],
      error: null,
    });
    const [event] = await houseEventsRepository.getPublicUpcomingPreview(TODAY);
    expect(event.houses?.map((host) => host.id)).toEqual(['hp-b', 'hp-a']);
    expect(event.houses?.every((host) =>
      Object.keys(host).sort().join(',') === 'accent_color,display_name,house,house_key,id,is_active')).toBe(true);
  });

  it('does not advertise a published event as belonging to a hidden primary House (#640)', async () => {
    const row = {
      id: 'published-event-hidden-house', house_profile_id: 'hidden-profile',
      is_published: true, houses: [{ house_page_asset_id: 'hidden-profile' }],
    };
    for (const method of ['getPublicUpcomingForHouse', 'getPublicPastForHouse'] as const) {
      supabaseMock.reset();
      supabaseMock.queueResult('house_event_houses', {
        data: [{ house_event_id: row.id }], error: null,
      });
      supabaseMock.queueResult('house_events', { data: [row], error: null });
      supabaseMock.queueResult('published_house_page_assets', {
        data: [], error: null,
      });
      await expect(houseEventsRepository[method]('hidden-profile', TODAY)).resolves.toEqual([]);
    }
    supabaseMock.reset();
    supabaseMock.queueResult('house_events', { data: row, error: null });
    supabaseMock.queueResult('published_house_page_assets', { data: [], error: null });
    await expect(houseEventsRepository.getPublicEventForHouse(row.id, 'hidden-profile')).resolves.toBeNull();
  });

  it('retains a published primary House for a legacy event without an association row (#640)', async () => {
    supabaseMock.queueResult('house_events', { data: {
      id: 'legacy-event', house_profile_id: HOUSE_ID,
      is_published: true, houses: [],
    }, error: null });
    supabaseMock.queueResult('published_house_page_assets', { data: [{
      id: HOUSE_ID, house: 'fictional', house_key: 'fictional',
      display_name: 'Fictional House', accent_color: null, is_active: true,
    }], error: null });
    const event = await houseEventsRepository.getPublicEventForHouse('legacy-event', HOUSE_ID);
    expect(event).toMatchObject({
      id: 'legacy-event', houses: [{ id: HOUSE_ID, display_name: 'Fictional House' }],
    });
    const ids = supabaseMock.queriesFor('published_house_page_assets')
      .flatMap((query) => query.calls.filter((call) => call.method === 'in'));
    expect(ids).toContainEqual({ method: 'in', args: ['id', [HOUSE_ID]] });
  });

  it('never forwards unexpected private event or nested fields to public consumers (#640)', async () => {
    const eventRow = {
      id: 'synthetic-ev', house_profile_id: HOUSE_ID,
      academic_year_start: 2026, academic_year_end: 2027,
      title: 'Fictional House Social', slug: 'fictional-house-social',
      description: 'Public-facing description', event_date: TODAY,
      start_time: '18:00', end_time: '19:00', location: 'Campus',
      image_url: null, image_thumbnail_url: null,
      gallery_url: null, recap_url: null, rsvp_url: null,
      google_calendar_enabled: true, is_published: true,
      created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
      houses: [{ house_page_asset_id: HOUSE_ID, internal_notes: 'private association note' }],
      internal_notes: 'private event note',
      client_request_id: 'private synthetic request token',
      house: { id: HOUSE_ID, internal_notes: 'private nested profile' },
      score_audit: { total_points: 99 },
    };
    supabaseMock.queueResult('house_events', { data: [eventRow], error: null });
    supabaseMock.queueResult('published_house_page_assets', { data: [
      { id: HOUSE_ID, house: 'fictional', house_key: 'fictional',
        display_name: 'Fictional House', accent_color: '#000000',
        is_active: true, internal_notes: 'private profile note' },
    ], error: null });

    const [event] = await houseEventsRepository.getPublicUpcomingPreview(TODAY, YEAR);
    expect(Object.keys(event).sort()).toEqual([
      'id', 'house_profile_id', 'academic_year_start', 'academic_year_end',
      'title', 'slug', 'description', 'event_date', 'start_time', 'end_time',
      'location', 'image_url', 'image_thumbnail_url', 'gallery_url', 'recap_url',
      'rsvp_url', 'google_calendar_enabled', 'is_published', 'created_at',
      'updated_at', 'houses',
    ].sort());
    expect(event).toMatchObject({
      id: 'synthetic-ev', title: 'Fictional House Social', location: 'Campus',
      houses: [{ id: HOUSE_ID, display_name: 'Fictional House' }],
    });
    const resultJson = JSON.stringify(event);
    for (const secret of ['private event note', 'private profile note',
      'private association note', 'private synthetic request token',
      'score_audit', 'private nested profile']) {
      expect(resultJson).not.toContain(secret);
    }
    expect(event.houses?.[0]).toEqual({
      id: HOUSE_ID, house: 'fictional', house_key: 'fictional',
      display_name: 'Fictional House', accent_color: '#000000', is_active: true,
    });
  });

  it('fails closed if a supposedly public event response includes an unpublished row (#640)', async () => {
    supabaseMock.queueResult('house_events', {
      data: [{ id: 'fictional-hidden', house_profile_id: HOUSE_ID,
        is_published: false, houses: [] }],
      error: null,
    });
    await expect(houseEventsRepository.getPublicUpcomingPreview(TODAY, YEAR))
      .rejects.toThrow(/Unexpected unpublished House event/);
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
