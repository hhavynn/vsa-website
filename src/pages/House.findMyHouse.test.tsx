import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { House } from './House';
import { hasRevealedHouseMemberships } from '../data/repos/houseMemberships';
import { houseEventsRepository } from '../data/repos/houseEvents';

jest.mock('../data/repos/houseMemberships', () => ({
  ...jest.requireActual('../data/repos/houseMemberships'),
  hasRevealedHouseMemberships: jest.fn(),
}));
jest.mock('../hooks/useAcademicTerms', () => ({
  useAcademicTerms: () => ({
    terms: [{ academic_year_start: 2026, academic_year_end: 2027, is_active: true }],
    loading: false, error: null,
  }),
}));
jest.mock('../hooks/useHouseAssets', () => ({
  usePublishedHouseAssets: () => ({
    assets: [{
      id: 'synthetic-house-profile', house_key: 'synthetic-house',
      house: 'Synthetic House', display_name: 'Synthetic House',
      academic_year_start: 2026, is_active: true, display_order: 1,
    }],
    loading: false, error: null,
  }),
}));
jest.mock('../hooks/useProgramContent', () => ({
  useProgramContent: () => ({ content: null }),
}));
jest.mock('../components/features/house/FindMyHouse', () => ({
  FindMyHouse: ({ academicYearStart }: { academicYearStart: number }) =>
    <section id="find-my-house" aria-label="Published House lookup" data-year={academicYearStart}>
      Synthetic published lookup
    </section>,
}));
jest.mock('../lib/supabase', () => ({
  get supabase() {
    return require('../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const reveal = hasRevealedHouseMemberships as jest.MockedFunction<typeof hasRevealedHouseMemberships>;
const assetSearch = () => screen.queryByRole('region', { name: 'Published House lookup' });

function mount(url = '/house') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/house" element={<House />} />
          <Route path="/house/year/:yearSlug" element={<House />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, client };
}

beforeAll(() => {
  class StubIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  }
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true, configurable: true, value: StubIntersectionObserver,
  });
});
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(houseEventsRepository, 'getPublicUpcomingPreview').mockResolvedValue([]);
  jest.spyOn(houseEventsRepository, 'getPublicPastEventsForYear').mockResolvedValue([]);
  jest.spyOn(houseEventsRepository, 'getPublicEventsForYear').mockResolvedValue([]);
});
afterEach(() => jest.restoreAllMocks());

describe('Find My House visibility and navigation (#641)', () => {
  it('keeps the unannounced lookup and anchor hidden before Reveal', async () => {
    reveal.mockResolvedValue(false);
    mount();
    await waitFor(() => expect(reveal).toHaveBeenCalledWith(2026));
    expect(assetSearch()).not.toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'House page sections' });
    expect(within(nav).queryByRole('link', { name: 'Find My House' })).not.toBeInTheDocument();
    expect(screen.queryByText(/temporarily unavailable\. This does not mean Houses/)).not.toBeInTheDocument();
  });

  it('shows the current-year lookup and a working section anchor only after Reveal', async () => {
    reveal.mockResolvedValue(true);
    mount();
    expect(await screen.findByRole('region', { name: 'Published House lookup' })).toHaveAttribute('data-year', '2026');
    const nav = screen.getByRole('navigation', { name: 'House page sections' });
    const link = within(nav).getByRole('link', { name: 'Find My House' });
    expect(link).toHaveAttribute('href', '#find-my-house');
    expect(link).toHaveClass('touch:min-h-11');
    expect(screen.getByText('Synthetic published lookup')).toBeInTheDocument();
    expect(screen.queryByText(/Find My House is temporarily unavailable/)).not.toBeInTheDocument();
  });

  it('shows an explicit availability notice without a false not-revealed claim when the gate fails', async () => {
    reveal.mockRejectedValue(new Error('synthetic public view denied'));
    mount();
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Find My House is temporarily unavailable. This does not mean Houses have not been revealed.');
    expect(assetSearch()).not.toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'House page sections' }))
      .queryByRole('link', { name: 'Find My House' })).not.toBeInTheDocument();
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it('omits lookup, disclosure notice and anchor for archived years', async () => {
    reveal.mockResolvedValue(true);
    mount('/house/year/2025-2026');
    expect(screen.queryByRole('navigation', { name: 'House page sections' })).not.toBeInTheDocument();
    expect(reveal).not.toHaveBeenCalled();
    expect(assetSearch()).not.toBeInTheDocument();
    expect(screen.queryByText(/This does not mean Houses have not been revealed/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Find My House' })).not.toBeInTheDocument();
  });

  it('never queries or shows the lookup for future academic years', async () => {
    reveal.mockResolvedValue(true);
    mount('/house/year/2027-2028');
    expect(await screen.findByRole('heading', { level: 2, name: /2027-2028 Houses have not been announced yet/i })).toBeInTheDocument();
    expect(reveal).not.toHaveBeenCalled();
    expect(assetSearch()).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Find My House' })).not.toBeInTheDocument();
  });
});
