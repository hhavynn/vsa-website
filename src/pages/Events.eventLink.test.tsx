/* eslint-disable testing-library/no-node-access -- asserts the card the anchor lands on */
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { Events } from './Events';
import { supabaseMock } from '../test-utils/supabaseMock';

const mockPageSize = 9;
const mockTerm = {
  id: 't1', code: 'F25', label: 'Fall 2025', academic_year_start: 2025, academic_year_end: 2026,
  is_active: false, starts_on: '2025-09-20', ends_on: '2025-12-12', display_order: 1,
};

const makeEvent = (n: number) => ({
  id: `evt-${n}`,
  name: `Past Event ${n}`,
  description: '',
  date: '2025-10-01T19:00:00Z',
  location: 'Somewhere',
  points: 1,
  event_type: 'gbm',
  is_published: true,
  academic_term_id: 't1',
});
// Three archive pages of nine; the deep-linked event sits on the second.
const mockAllPast = Array.from({ length: mockPageSize * 2 }, (_, i) => makeEvent(i + 1));
const mockFetchLog: number[] = [];

jest.mock('../lib/supabase', () => ({
  get supabase() {
    return require('../test-utils/supabaseMock').supabaseMock.client;
  },
}));
jest.mock('../hooks/useAcademicTerms', () => ({
  useAcademicTerms: () => ({ terms: [mockTerm], loading: false, error: null }),
}));
jest.mock('../hooks/useExternalEvents', () => ({
  useLinkedExternalListings: () => new Map(),
}));
jest.mock('../hooks/useEvents', () => ({
  useEvents: () => ({ events: [], loading: false, error: null }),
  usePublishedPastEventArchiveAvailability: () => ({
    data: { termIds: ['t1'], hasUnassignedEvents: false },
    isLoading: false,
    error: null,
  }),
  // Behaves like the real infinite query: page N is only present after N fetches.
  useInfiniteEvents: () => {
    const { useState } = require('react');
    const [pageCount, setPageCount] = useState(1);
    const pages = Array.from({ length: pageCount }, (_, i) =>
      mockAllPast.slice(i * mockPageSize, (i + 1) * mockPageSize),
    );
    return {
      data: { pages },
      isLoading: false,
      error: null,
      hasNextPage: pageCount * mockPageSize < mockAllPast.length,
      fetchNextPage: () => {
        mockFetchLog.push(pageCount + 1);
        setPageCount((count: number) => count + 1);
      },
      isFetchingNextPage: false,
    };
  },
}));

beforeEach(() => {
  supabaseMock.reset();
  mockFetchLog.length = 0;
  window.HTMLElement.prototype.scrollIntoView = () => undefined;
});

const renderAt = (url: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Events />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('/events deep link from a Gallery album', () => {
  it('keeps loading archive pages until the linked event is on screen', async () => {
    renderAt('/events?term=t1#event-evt-12');
    expect((await screen.findAllByText('Past Event 12')).length).toBeGreaterThan(0);
    expect(document.getElementById('event-evt-12')).not.toBeNull();
    expect(mockFetchLog).toEqual([2]);
  });

  it('does not fetch more pages when the linked event is already rendered', async () => {
    renderAt('/events?term=t1#event-evt-3');
    expect((await screen.findAllByText('Past Event 3')).length).toBeGreaterThan(0);
    expect(document.getElementById('event-evt-3')).not.toBeNull();
    expect(mockFetchLog).toEqual([]);
  });

  it('does not fetch extra pages for a plain /events visit', async () => {
    renderAt('/events');
    await screen.findAllByText('Past Event 1');
    expect(mockFetchLog).toEqual([]);
  });

  it('stops paging once the archive is exhausted when the event is not in it', async () => {
    renderAt('/events?term=t1#event-missing');
    await screen.findAllByText('Past Event 1');
    await waitFor(() => expect(screen.getAllByText('Past Event 18').length).toBeGreaterThan(0));
    expect(mockFetchLog).toEqual([2]);
    expect(document.getElementById('event-missing')).toBeNull();
  });
});
