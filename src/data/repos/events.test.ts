/**
 * Repository-layer tests for EventsRepository (#291), including the
 * draft-content leak guard (#292).
 *
 * These assert behaviour that matters rather than call order: which filters
 * reach the database, what a caller gets back, and how a permission denial
 * surfaces. The mock records the query chain, so "did the public path exclude
 * unpublished events?" is a real assertion and not a replay of canned data.
 */

import { eventsRepository } from './events';
import { DatabaseError } from '../errors';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

// babel-plugin-jest-hoist lifts this above the imports at compile time, so the
// repository under test receives the mock. The lazy getter keeps the factory
// from referencing an out-of-scope binding.
jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const publishedEvent = {
  id: 'event-1',
  name: 'Welcome Night',
  date: '2026-10-01',
  is_published: true,
};

beforeEach(() => {
  supabaseMock.reset();
});

describe('EventsRepository — draft content must not reach public consumers (#292)', () => {
  it('excludes unpublished events by default', async () => {
    supabaseMock.queueResult('events', { data: [publishedEvent], error: null });

    await eventsRepository.getEvents();

    expect(supabaseMock.filtersFor('events')).toContainEqual(['is_published', true]);
  });

  it('includes unpublished events only when a caller opts in explicitly', async () => {
    supabaseMock.queueResult('events', { data: [publishedEvent], error: null });

    await eventsRepository.getEvents({ include_unpublished: true });

    // The admin escape hatch is deliberate; what matters is that it is opt-in.
    expect(supabaseMock.filtersFor('events')).not.toContainEqual(['is_published', true]);
  });

  it('excludes unpublished events from the public upcoming preview', async () => {
    supabaseMock.queueResult('events', { data: [publishedEvent], error: null });

    await eventsRepository.getPublicUpcomingPreview('2026-09-15', 4);

    expect(supabaseMock.filtersFor('events')).toContainEqual(['is_published', true]);
  });

  it('excludes unpublished events from past-archive availability', async () => {
    supabaseMock.queueResult('events', {
      data: [{ academic_term_id: 'term-1' }],
      error: null,
    });

    await eventsRepository.getPublishedPastEventArchiveAvailability('2026-06-01');

    expect(supabaseMock.filtersFor('events')).toContainEqual(['is_published', true]);
  });
});

describe('EventsRepository.getEvents', () => {
  it('returns events with interest counts attached', async () => {
    supabaseMock.queueResult('events', { data: [publishedEvent], error: null });
    supabaseMock.queueResult('event_interest_counts', {
      data: [{ event_id: 'event-1', interested: 5, going: 2 }],
      error: null,
    });

    const result = await eventsRepository.getEvents();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('event-1');
    expect(result[0].interest_counts).toEqual({
      event_id: 'event-1',
      interested: 5,
      going: 2,
    });
  });

  it('returns null interest counts when an event has none', async () => {
    supabaseMock.queueResult('events', { data: [publishedEvent], error: null });
    supabaseMock.queueResult('event_interest_counts', { data: [], error: null });

    const [event] = await eventsRepository.getEvents();

    expect(event.interest_counts).toBeNull();
  });

  it('handles the empty case without throwing', async () => {
    supabaseMock.queueResult('events', { data: [], error: null });

    await expect(eventsRepository.getEvents()).resolves.toEqual([]);
  });

  it('applies the requested sort and pagination', async () => {
    supabaseMock.queueResult('events', { data: [], error: null });

    await eventsRepository.getEvents({ sort_by: 'name', sort_ascending: false, limit: 5 });

    const calls = supabaseMock.queriesFor('events')[0].calls;
    expect(calls).toContainEqual({ method: 'order', args: ['name', { ascending: false }] });
    expect(calls).toContainEqual({ method: 'limit', args: [5] });
  });

  it('surfaces a permission denial as a typed DatabaseError', async () => {
    // 42501 is insufficient_privilege — what an RLS denial looks like from
    // PostgREST. This is the path a security regression would travel.
    supabaseMock.queueResult('events', {
      data: null,
      error: postgrestError('permission denied for table events', '42501'),
    });

    await expect(eventsRepository.getEvents()).rejects.toBeInstanceOf(DatabaseError);
  });

  it('maps the RLS denial to a readable message and preserves the code', async () => {
    supabaseMock.queueResult('events', {
      data: null,
      error: postgrestError('permission denied for table events', '42501'),
    });

    await expect(eventsRepository.getEvents()).rejects.toMatchObject({
      message: 'Insufficient permissions',
      code: '42501',
    });
  });
});
