/**
 * Additional read-path coverage for EventsRepository (#291), complementing
 * events.test.ts (which owns the draft-exclusion guards and the basic
 * getEvents cases -- those are not repeated here).
 *
 * Events are not part of the points arithmetic. The retired code check-in
 * system (event_attendance + user_points) is no longer read here; the only
 * active points model is member_event_attendance -> member_yearly_points /
 * house_*, see docs/leaderboard-system.md. These tests only characterise the
 * events repository's own behaviour.
 *
 * Fixture ids are made up.
 */

import { eventsRepository } from './events';
import { DatabaseError } from '../errors';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => {
  supabaseMock.reset();
});

const publishedEvent = {
  id: 'event-1',
  name: 'Welcome Night',
  date: '2026-10-01',
  is_published: true,
  check_in_form_url: null,
};

function callsFor(table: string): Array<{ method: string; args: unknown[] }> {
  return supabaseMock.queriesFor(table).flatMap((q) => q.calls);
}

function firstCall(table: string, method: string): unknown[] | undefined {
  return callsFor(table).find((c) => c.method === method)?.args;
}

const denied = () => postgrestError('permission denied for table events', '42501');

describe('EventsRepository.getEvents: failure and filter paths', () => {
  it('rejects with a wrapped error (not a silent empty list) when the query returns null data without an error', async () => {
    supabaseMock.queueResult('events', { data: null, error: null });

    // NotFoundError is thrown inside withErrorHandling, which re-wraps it as a
    // plain Error with the context prefix (see errors.test.ts).
    await expect(eventsRepository.getEvents()).rejects.toThrow('Failed to fetch events: No events found');
  });

  it('ignores an interest-count query error and returns events with null counts', async () => {
    supabaseMock.queueResult('events', { data: [publishedEvent], error: null });
    supabaseMock.queueResult('event_interest_counts', { data: null, error: denied() });

    const [event] = await eventsRepository.getEvents();

    // The interest error is not inspected; the event still renders with no counts.
    expect(event.interest_counts).toBeNull();
    expect(event).not.toHaveProperty('attendance_count');
  });

  it('public projection omits check_in_form_url; the admin projection includes it', async () => {
    await eventsRepository.getEvents();
    await eventsRepository.getEvents({ include_unpublished: true });

    const [publicSelect, adminSelect] = supabaseMock
      .queriesFor('events')
      .map((q) => String(q.calls.find((c) => c.method === 'select')?.args[0]));
    expect(publicSelect).not.toContain('check_in_form_url');
    expect(publicSelect).not.toContain('*');
    expect(adminSelect).toContain('check_in_form_url');
  });

  it('applies event_type, term, and date-range filters', async () => {
    await eventsRepository.getEvents({
      event_type: 'mixer',
      academic_term_id: 'term-1',
      date_from: '2026-09-01',
      date_to: '2026-12-01',
    });

    const calls = callsFor('events');
    expect(supabaseMock.filtersFor('events')).toEqual(
      expect.arrayContaining([
        ['is_published', true],
        ['event_type', 'mixer'],
        ['academic_term_id', 'term-1'],
      ])
    );
    expect(calls).toContainEqual({ method: 'gte', args: ['date', '2026-09-01'] });
    expect(calls).toContainEqual({ method: 'lte', args: ['date', '2026-12-01'] });
  });

  it('filters to unassigned events when academic_term_id is null', async () => {
    await eventsRepository.getEvents({ academic_term_id: null });

    expect(callsFor('events')).toContainEqual({ method: 'is', args: ['academic_term_id', null] });
    expect(supabaseMock.filtersFor('events').map(([column]) => column)).not.toContain('academic_term_id');
  });

  it('orders by date ascending by default', async () => {
    await eventsRepository.getEvents();

    expect(callsFor('events')).toContainEqual({ method: 'order', args: ['date', { ascending: true }] });
  });

  it('uses range for an offset, defaulting the page size to 10 when no limit is given', async () => {
    await eventsRepository.getEvents({ offset: 20 });
    await eventsRepository.getEvents({ offset: 20, limit: 5 });

    const ranges = callsFor('events').filter((c) => c.method === 'range').map((c) => c.args);
    expect(ranges).toEqual([
      [20, 29],
      [20, 24],
    ]);
  });
});

describe('EventsRepository.getUpcomingEvents / getEventsByType', () => {
  it('upcoming: published only, bounded below by now, limited (default 5)', async () => {
    supabaseMock.queueResult('events', { data: [publishedEvent], error: null });

    const result = await eventsRepository.getUpcomingEvents();

    expect(result.map((e) => e.id)).toEqual(['event-1']);
    expect(supabaseMock.filtersFor('events')).toContainEqual(['is_published', true]);
    const gte = callsFor('events').find((c) => c.method === 'gte');
    expect(gte?.args[0]).toBe('date');
    expect(Number.isNaN(Date.parse(String(gte?.args[1])))).toBe(false);
    expect(firstCall('events', 'limit')).toEqual([5]);
  });

  it('upcoming: honours a custom limit and returns [] when empty', async () => {
    supabaseMock.queueResult('events', { data: [], error: null });

    await expect(eventsRepository.getUpcomingEvents(2)).resolves.toEqual([]);
    expect(firstCall('events', 'limit')).toEqual([2]);
  });

  it('upcoming: rejects with a DatabaseError on a database error', async () => {
    supabaseMock.queueResult('events', { data: null, error: denied() });
    await expect(eventsRepository.getUpcomingEvents()).rejects.toBeInstanceOf(DatabaseError);
  });

  it('by type: published only, filtered to the type, optional limit', async () => {
    supabaseMock.queueResult('events', { data: [publishedEvent], error: null });

    await eventsRepository.getEventsByType('mixer', 3);

    expect(supabaseMock.filtersFor('events')).toEqual(
      expect.arrayContaining([
        ['is_published', true],
        ['event_type', 'mixer'],
      ])
    );
    expect(firstCall('events', 'limit')).toEqual([3]);
  });

  it('by type: applies no limit when none is given, and rejects with a DatabaseError on error', async () => {
    await eventsRepository.getEventsByType('mixer');
    expect(supabaseMock.usedMethod('events', 'limit')).toBe(false);

    supabaseMock.queueResult('events', { data: null, error: denied() });
    await expect(eventsRepository.getEventsByType('mixer')).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('EventsRepository: retired code check-in surface', () => {
  it.each(['getEventById', 'checkInUser', 'getCheckInCode', 'setCheckInCode', 'getEventStats'])(
    'no longer exposes %s',
    (method) => {
      expect(eventsRepository).not.toHaveProperty(method);
    },
  );

  it('never reads the retired attendance or code tables while listing events', async () => {
    supabaseMock.queueResult('events', { data: [publishedEvent], error: null });

    await eventsRepository.getEvents();

    const tables = supabaseMock.queries().map((query) => query.table);
    expect(tables).not.toContain('event_attendance');
    expect(tables).not.toContain('event_check_in_secrets');
  });
});

describe('EventsRepository.getPublicUpcomingPreview', () => {
  const previewRow = {
    id: 'event-1',
    name: 'Welcome Night',
    date: '2026-10-01',
    start_time: null,
    end_time: null,
    end_date: null,
    location: null,
    points: 2,
    event_type: 'mixer',
    image_url: null,
    thumbnail_url: null,
  };

  it('returns preview rows with interest counts, bounded by date and ordered by date ascending', async () => {
    supabaseMock.queueResult('events', { data: [previewRow], error: null });
    supabaseMock.queueResult('event_interest_counts', {
      data: [{ event_id: 'event-1', interested: 1, going: 0 }],
      error: null,
    });

    const result = await eventsRepository.getPublicUpcomingPreview('2026-09-15', 4);

    expect(result).toEqual([{ ...previewRow, interest_counts: { event_id: 'event-1', interested: 1, going: 0 } }]);
    const calls = callsFor('events');
    expect(calls).toContainEqual({ method: 'gte', args: ['date', '2026-09-15'] });
    expect(calls).toContainEqual({ method: 'order', args: ['date', { ascending: true }] });
    expect(calls).toContainEqual({ method: 'limit', args: [4] });
  });

  it('selects only public preview columns (no check_in_form_url, no *)', async () => {
    await eventsRepository.getPublicUpcomingPreview('2026-09-15');

    const columns = String(firstCall('events', 'select')?.[0]);
    expect(columns).not.toContain('check_in_form_url');
    expect(columns).not.toContain('*');
  });

  it('defaults the limit to 4', async () => {
    await eventsRepository.getPublicUpcomingPreview('2026-09-15');
    expect(firstCall('events', 'limit')).toEqual([4]);
  });

  it('gives null interest counts to events without a counts row', async () => {
    supabaseMock.queueResult('events', { data: [previewRow], error: null });

    const [event] = await eventsRepository.getPublicUpcomingPreview('2026-09-15');

    expect(event.interest_counts).toBeNull();
  });

  it('returns [] for empty and for null data', async () => {
    supabaseMock.queueResult('events', { data: [], error: null });
    supabaseMock.queueResult('events', { data: null, error: null });

    await expect(eventsRepository.getPublicUpcomingPreview('2026-09-15')).resolves.toEqual([]);
    await expect(eventsRepository.getPublicUpcomingPreview('2026-09-15')).resolves.toEqual([]);
  });

  it('rejects with a DatabaseError on a database error', async () => {
    supabaseMock.queueResult('events', { data: null, error: denied() });
    await expect(eventsRepository.getPublicUpcomingPreview('2026-09-15')).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('EventsRepository.getPublishedPastEventArchiveAvailability', () => {
  it('collects distinct term ids and flags unassigned events', async () => {
    supabaseMock.queueResult('events', {
      data: [
        { academic_term_id: 'term-1' },
        { academic_term_id: 'term-1' },
        { academic_term_id: 'term-2' },
        { academic_term_id: null },
      ],
      error: null,
    });

    const result = await eventsRepository.getPublishedPastEventArchiveAvailability('2026-06-01');

    expect(result.termIds.sort()).toEqual(['term-1', 'term-2']);
    expect(result.hasUnassignedEvents).toBe(true);
    expect(callsFor('events')).toContainEqual({ method: 'lte', args: ['date', '2026-06-01'] });
  });

  it('reports no unassigned events when every event has a term', async () => {
    supabaseMock.queueResult('events', { data: [{ academic_term_id: 'term-1' }], error: null });

    await expect(eventsRepository.getPublishedPastEventArchiveAvailability('2026-06-01')).resolves.toEqual({
      termIds: ['term-1'],
      hasUnassignedEvents: false,
    });
  });

  it('returns no terms and no unassigned flag for empty and null data', async () => {
    supabaseMock.queueResult('events', { data: [], error: null });
    supabaseMock.queueResult('events', { data: null, error: null });

    const expected = { termIds: [], hasUnassignedEvents: false };
    await expect(eventsRepository.getPublishedPastEventArchiveAvailability('2026-06-01')).resolves.toEqual(expected);
    await expect(eventsRepository.getPublishedPastEventArchiveAvailability('2026-06-01')).resolves.toEqual(expected);
  });

  it('rejects with a DatabaseError on a database error', async () => {
    supabaseMock.queueResult('events', { data: null, error: denied() });
    await expect(eventsRepository.getPublishedPastEventArchiveAvailability('2026-06-01')).rejects.toBeInstanceOf(
      DatabaseError
    );
  });
});
