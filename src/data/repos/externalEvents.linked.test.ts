/**
 * Linked external listings: one Event ↔ at most one `external_events` row,
 * matched on the unique `source_event_id` (migration 20261002060000).
 *
 * The recording mock proves what reaches the database (the upsert conflict key,
 * the public status filter, hide-not-delete). The in-memory table below models
 * the unique index, so the save → edit → retype → retype-back lifecycle can be
 * asserted as "still exactly one row".
 */
import { externalEventsRepository } from './externalEvents';
import {
  EMPTY_EXTERNAL_DETAILS,
  ExternalCommonFields,
  planExternalSync,
  UVSA_SOCAL_HOST_VALUE,
} from '../../lib/externalEventLinking';
import { postgrestError, supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const common: ExternalCommonFields = {
  title: 'UVSA SoCal Fall Social',
  date: '2026-10-24',
  academic_term_id: null,
  location: 'Irvine',
  description: 'A social.',
  points: 4,
};
const TODAY = '2026-10-01';

beforeEach(() => supabaseMock.reset());

describe('saveLinkedListing', () => {
  it('upserts on source_event_id so repeat saves update in place', async () => {
    supabaseMock.queueResult('external_events', { data: { id: 'x1' }, error: null });
    const plan = planExternalSync({
      eventType: 'external_event',
      isPublished: true,
      details: { ...EMPTY_EXTERNAL_DETAILS, host: UVSA_SOCAL_HOST_VALUE },
      common,
      existing: null,
      today: TODAY,
    });
    if (plan.action !== 'upsert') throw new Error('expected an upsert plan');

    await externalEventsRepository.saveLinkedListing('evt-1', plan.payload);

    const [call] = supabaseMock.queriesFor('external_events')[0].calls.filter((c) => c.method === 'upsert');
    expect(call.args[0]).toMatchObject({ source_event_id: 'evt-1', host_type: 'uvsa_socal', uvsa_school_id: null, status: 'upcoming' });
    expect(call.args[1]).toEqual({ onConflict: 'source_event_id' });
  });
});

describe('hideLinkedListing', () => {
  it('moves the listing to draft by source event and never deletes it', async () => {
    await externalEventsRepository.hideLinkedListing('evt-1');

    expect(supabaseMock.usedMethod('external_events', 'delete')).toBe(false);
    const calls = supabaseMock.queriesFor('external_events')[0].calls;
    expect(calls).toContainEqual({ method: 'update', args: [{ status: 'draft' }] });
    expect(supabaseMock.filtersFor('external_events')).toContainEqual(['source_event_id', 'evt-1']);
  });
});

describe('getListingsBySourceEventIds', () => {
  it('maps listings by event id and skips the query when there is nothing to look up', async () => {
    expect((await externalEventsRepository.getListingsBySourceEventIds([])).size).toBe(0);
    expect(supabaseMock.queries()).toHaveLength(0);

    supabaseMock.queueResult('external_events', {
      data: [{ id: 'x1', source_event_id: 'evt-1', host_type: 'uvsa_socal' }],
      error: null,
    });
    const listings = await externalEventsRepository.getListingsBySourceEventIds(['evt-1', 'evt-2']);

    expect(listings.get('evt-1')?.host_type).toBe('uvsa_socal');
    expect(listings.has('evt-2')).toBe(false);
  });

  it('selects only public columns (never source_notes / confidence_level)', async () => {
    await externalEventsRepository.getListingsBySourceEventIds(['evt-1']);
    const select = supabaseMock.queriesFor('external_events')[0].calls.find((c) => c.method === 'select');
    expect(String(select?.args[0])).toContain('host_type');
    expect(String(select?.args[0])).toContain('source_event_id');
    // The flyer: the listing's own image plus the linked event's public image/time columns.
    expect(String(select?.args[0])).toContain('ride_info, image_url, status');
    expect(String(select?.args[0])).toContain(
      'source_event:events(id, name, start_time, end_time, thumbnail_url, image_url)',
    );
    expect(String(select?.args[0])).not.toContain('source_notes');
    expect(String(select?.args[0])).not.toContain('show_on_network');
  });
});

describe('Upcoming Externals source', () => {
  it('reads the same external_events table by status, so a linked row flows in with no second list', async () => {
    await externalEventsRepository.getEvents({ status: 'upcoming' });
    expect(supabaseMock.queriesFor('external_events')).toHaveLength(1);
    expect(supabaseMock.filtersFor('external_events')).toContainEqual(['status', 'upcoming']);
  });
});

describe('external event read paths — public/admin safety (#291)', () => {
  it('applies public requested filters, bounds and chronological sorting without admin-only columns', async () => {
    supabaseMock.queueResult('external_events', { data: [{
      id: 'fictional-public-event', title: 'Fictional UVSA Social',
      status: 'upcoming', uvsa_school_id: 'fictional-school',
    }], error: null });
    const rows = await externalEventsRepository.getEvents({
      status: 'upcoming', uvsa_school_id: 'fictional-school',
      is_featured: true, limit: 2,
    });
    expect(rows).toHaveLength(1);
    const calls = supabaseMock.queriesFor('external_events')[0].calls;
    expect(calls).toContainEqual({ method: 'eq', args: ['status', 'upcoming'] });
    expect(calls).toContainEqual({ method: 'eq', args: ['uvsa_school_id', 'fictional-school'] });
    expect(calls).toContainEqual({ method: 'eq', args: ['is_featured', true] });
    expect(calls).toContainEqual({ method: 'limit', args: [2] });
    expect(calls).toContainEqual({ method: 'order', args: ['date', { ascending: true, nullsFirst: false }] });
    const select = String(calls.find((call) => call.method === 'select')?.args[0]);
    expect(select).toContain('uvsa_school:uvsa_schools(');
    expect(select).toContain('source_event:events(');
    expect(select).not.toContain('source_notes');
    expect(select).not.toContain('confidence_level');
    expect(select).not.toContain('uvsa_schools(*)');
  });

  it('returns empty public results without inventing a status, but rejects a denied read', async () => {
    supabaseMock.queueResult('external_events', { data: null, error: null });
    await expect(externalEventsRepository.getEvents()).resolves.toEqual([]);
    const [query] = supabaseMock.queriesFor('external_events');
    expect(query.calls.some((call) => call.method === 'eq' && call.args[0] === 'status')).toBe(false);

    supabaseMock.queueResult('external_events', {
      data: null, error: postgrestError('public event read denied', '42501'),
    });
    await expect(externalEventsRepository.getEvents({ status: 'upcoming' }))
      .rejects.toMatchObject({ name: 'DatabaseError', message: 'Insufficient permissions' });
  });

  it('reads a published event by ID through the same narrow public projection, with missing/error behavior', async () => {
    supabaseMock.queueResult('external_events', {
      data: { id: 'synthetic-event', title: 'Fictional Gathering' }, error: null,
    });
    await expect(externalEventsRepository.getEventById('synthetic-event'))
      .resolves.toMatchObject({ id: 'synthetic-event' });
    const query = supabaseMock.queriesFor('external_events')[0];
    expect(query.calls).toContainEqual({ method: 'eq', args: ['id', 'synthetic-event'] });
    const projection = String(query.calls.find((call) => call.method === 'select')?.args[0]);
    expect(projection).toContain('status');
    expect(projection).not.toContain('source_notes');

    supabaseMock.queueResult('external_events', { data: null, error: null });
    await expect(externalEventsRepository.getEventById('missing-event'))
      .rejects.toMatchObject({
        name: 'NotFoundError', resource: 'external_events', id: 'missing-event',
      });
    supabaseMock.queueResult('external_events', {
      data: null, error: postgrestError('permission denied', '42501'),
    });
    await expect(externalEventsRepository.getEventById('private-event'))
      .rejects.toMatchObject({ name: 'DatabaseError', message: 'Insufficient permissions' });
  });

  it('keeps the full admin projection and distinguishes it from public reads', async () => {
    const admin = { id: 'synthetic-draft', status: 'draft', source_notes: 'private synthetic planning note' };
    supabaseMock.queueResult('external_events', { data: [admin], error: null });
    await expect(externalEventsRepository.getAllEvents()).resolves.toEqual([admin]);
    const calls = supabaseMock.queriesFor('external_events')[0].calls;
    expect(String(calls.find((call) => call.method === 'select')?.args[0]))
      .toContain('*, uvsa_school:uvsa_schools(*)');

    supabaseMock.queueResult('external_events', { data: null, error: null });
    await expect(externalEventsRepository.getAllEvents()).resolves.toEqual([]);
    supabaseMock.queueResult('external_events', {
      data: null, error: postgrestError('admin event read denied', '42501'),
    });
    await expect(externalEventsRepository.getAllEvents())
      .rejects.toMatchObject({ name: 'DatabaseError', message: 'Insufficient permissions' });
  });

  it('does not invent linked-event mappings on empty results or hidden-source errors', async () => {
    supabaseMock.queueResult('external_events', { data: null, error: null });
    await expect(externalEventsRepository.getListingsBySourceEventIds(['synthetic-event']))
      .resolves.toEqual(new Map());

    supabaseMock.queueResult('external_events', {
      data: null, error: postgrestError('linked event lookup denied', '42501'),
    });
    await expect(externalEventsRepository.getListingsBySourceEventIds(['synthetic-event']))
      .rejects.toMatchObject({ name: 'DatabaseError', message: 'Insufficient permissions' });
  });
});

/** Just enough of the table to model `unique (source_event_id)` + upsert. */
function installInMemoryTable() {
  const rows: Array<Record<string, unknown>> = [];
  let nextId = 1;
  const builderFor = () => {
    const state: { op?: 'upsert' | 'update'; row?: Record<string, unknown>; onConflict?: string; patch?: Record<string, unknown> } = {};
    const builder: Record<string, unknown> = {
      upsert: (row: Record<string, unknown>, options: { onConflict: string }) => {
        state.op = 'upsert';
        state.row = row;
        state.onConflict = options.onConflict;
        return builder;
      },
      update: (patch: Record<string, unknown>) => {
        state.op = 'update';
        state.patch = patch;
        return builder;
      },
      select: () => builder,
      eq: (column: string, value: unknown) => {
        rows.filter((r) => r[column] === value).forEach((r) => Object.assign(r, state.patch));
        return Promise.resolve({ data: null, error: null });
      },
      single: () => {
        const key = state.onConflict as string;
        const existing = rows.find((r) => r[key] === (state.row as Record<string, unknown>)[key]);
        if (existing) {
          Object.assign(existing, state.row);
          return Promise.resolve({ data: existing, error: null });
        }
        const created = { id: `ext-${nextId++}`, ...state.row };
        rows.push(created);
        return Promise.resolve({ data: created, error: null });
      },
    };
    return builder;
  };
  const spy = jest.spyOn(supabaseMock.client, 'from').mockImplementation(builderFor as never);
  return { rows, restore: () => spy.mockRestore() };
}

describe('linked listing lifecycle', () => {
  it('create → edit → retype away → retype back leaves exactly one record', async () => {
    const table = installInMemoryTable();
    const sync = (eventType: 'external_event' | 'gbm', host: string, existingStatus?: 'upcoming' | 'draft') =>
      externalEventsRepository.applySyncPlan(
        'evt-1',
        planExternalSync({
          eventType,
          isPublished: true,
          details: { ...EMPTY_EXTERNAL_DETAILS, host },
          common,
          existing: existingStatus ? { status: existingStatus } : null,
          today: TODAY,
        })
      );

    await sync('external_event', 'uci-id');
    expect(table.rows).toHaveLength(1);
    const id = table.rows[0].id;

    // Edit, then switch UCI → UVSA SoCal: same row, FK cleared.
    await sync('external_event', UVSA_SOCAL_HOST_VALUE, 'upcoming');
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]).toMatchObject({ id, host_type: 'uvsa_socal', uvsa_school_id: null, status: 'upcoming' });

    // Back to a school.
    await sync('external_event', 'sdsu-id', 'upcoming');
    expect(table.rows[0]).toMatchObject({ id, host_type: 'school', uvsa_school_id: 'sdsu-id' });

    // Retype away: hidden, links preserved.
    await sync('gbm', 'sdsu-id', 'upcoming');
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]).toMatchObject({ id, status: 'draft', uvsa_school_id: 'sdsu-id', title: common.title });

    // Retype back: same record revived.
    await sync('external_event', 'sdsu-id', 'draft');
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]).toMatchObject({ id, status: 'upcoming' });

    table.restore();
  });
});
