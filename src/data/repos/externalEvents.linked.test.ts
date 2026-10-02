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
import { supabaseMock } from '../../test-utils/supabaseMock';

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
