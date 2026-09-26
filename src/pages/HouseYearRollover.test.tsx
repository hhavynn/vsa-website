/**
 * Guards the start-of-year House rollover. Once a new academic term is marked
 * active, the new year's Houses stay unpublished until House Reveal. During
 * that gap:
 *   - /house must not present last year's Houses as the current ones, and
 *   - year-less links like /house/bowser (Find My Points, event cards,
 *     bookmarks) must still reach the House's most recent published year.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { HouseDetail } from './HouseDetail';
import { House } from './House';
import { supabaseMock } from '../test-utils/supabaseMock';

// Framer Motion's whileInView needs IntersectionObserver, which jsdom lacks.
beforeAll(() => {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  Object.defineProperty(window, 'IntersectionObserver', { writable: true, value: MockIntersectionObserver });
});

jest.mock('../lib/supabase', () => ({
  get supabase() {
    return require('../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const ACTIVE_2026_TERM = {
  id: 'fa26',
  code: 'FA26',
  label: 'Fall 2026',
  quarter: 'fall',
  academic_year_start: 2026,
  academic_year_end: 2027,
  starts_on: '2026-09-21',
  ends_on: '2026-12-31',
  is_active: true,
  display_order: 20261,
  created_at: '2026-05-12T00:00:00Z',
  updated_at: '2026-05-12T00:00:00Z',
};

const BOWSER_2025 = {
  id: 'bowser-2025',
  academic_year_start: 2025,
  academic_year_end: 2026,
  house: 'Bowser',
  house_key: 'Bowser',
  display_name: 'Bowser',
  description: null,
  image_url: null,
  image_thumbnail_url: null,
  image_alt: null,
  cover_image_url: null,
  accent_color: null,
  emoji: null,
  display_order: 1,
  is_active: true,
  house_parent_image_url: null,
  house_parent_heading: null,
  house_parent_body: null,
  source_doc_url: null,
  internal_notes: null,
  created_at: '2025-11-08T00:00:00Z',
  updated_at: '2025-11-08T00:00:00Z',
};

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, cacheTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/house" element={<House />} />
          <Route path="/house/year/:yearSlug/:houseSlug" element={<HouseDetail />} />
          <Route path="/house/:houseSlug" element={<HouseDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('House pages before the new year\'s House Reveal', () => {
  beforeEach(() => {
    supabaseMock.reset();
    supabaseMock.setDefault('academic_terms', { data: [ACTIVE_2026_TERM], error: null });
  });

  it('/house shows the not-announced state instead of last year\'s Houses', async () => {
    renderAt('/house');

    expect(await screen.findByText(/2026-2027 Houses have not been announced yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^bowser$/i })).not.toBeInTheDocument();
  }, 15000);

  it('redirects a year-less House link to the latest year that published it', async () => {
    supabaseMock
      // Active year (2026): nothing published yet.
      .queueResult('published_house_page_assets', { data: [], error: null })
      // Fallback lookup across every published year.
      .queueResult('published_house_page_assets', { data: [BOWSER_2025], error: null })
      // Year-scoped page after the redirect.
      .setDefault('published_house_page_assets', { data: [BOWSER_2025], error: null });

    renderAt('/house/bowser');

    expect(await screen.findByRole('heading', { level: 1, name: /bowser/i })).toBeInTheDocument();
    expect(screen.queryByText(/house page not found/i)).not.toBeInTheDocument();
  }, 15000);
});
