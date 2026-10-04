import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider, notifyManager } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { SiteSettingsProvider } from '../context/SiteSettingsContext';
import { AnalyticsConsentProvider } from '../context/AnalyticsConsentContext';
import AppRoutes from '../routes';
import { eventsRepository } from '../data/repos/events';
import { galleryRepository } from '../data/repos/gallery';
import { supabaseMock } from '../test-utils/supabaseMock';
import { NotFound } from './NotFound';

jest.mock('../lib/supabase', () => ({
  get supabase() {
    return require('../test-utils/supabaseMock').supabaseMock.client;
  },
}));

// react-query notifies observers outside React's batch; route it through act()
// so the one-time index fetch resolving mid-test is not reported as an unwrapped update.
beforeAll(() => notifyManager.setBatchNotifyFunction((callback) => act(callback)));

beforeEach(() => {
  supabaseMock.reset();
  window.scrollTo = jest.fn();
  jest.spyOn(eventsRepository, 'getPublicSearchEntries').mockResolvedValue([]);
  jest.spyOn(galleryRepository, 'getPublicSearchAlbums').mockResolvedValue([]);
});
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  jest.restoreAllMocks();
});

function renderNotFound(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <NotFound />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NotFound recovery surface', () => {
  it('stays an honest 404: heading, status sticker and no redirect', () => {
    renderNotFound('/some/dead/link');
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('embeds public search', async () => {
    renderNotFound('/some/dead/link');
    const search = screen.getByRole('combobox', { name: /Search pages, events and photo albums/ });
    await userEvent.type(search, 'calendar');
    expect(await screen.findByRole('option', { name: /Calendar/ })).toBeInTheDocument();
    // Let the one-time events/albums fetch land so it does not update after the test ends.
    await waitFor(() => expect(screen.queryByText(/Loading events and photo albums/)).not.toBeInTheDocument());
  });

  it('offers Home, Events and Get Involved on every 404', () => {
    renderNotFound('/some/dead/link');
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Events' })).toHaveAttribute('href', '/events');
    expect(screen.getByRole('link', { name: 'Get Involved' })).toHaveAttribute('href', '/get-involved');
  });

  it('suggests likely destinations built from the URL’s words and the public nav metadata', () => {
    renderNotFound('/vcn/2019');
    const aside = screen.getByRole('complementary');
    expect(within(aside).getByText('You might have meant')).toBeInTheDocument();
    const hrefs = within(aside).getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/vcn', '/vcn/archive']));
  });

  it('recovers the known legacy /profile URL with a clear destination, still as a 404', () => {
    renderNotFound('/profile');
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByText('Looking for this?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find My Points' })).toHaveAttribute('href', '/points');
  });

  it('recovers the legacy points explainer URL to its in-page anchor', () => {
    renderNotFound('/points-explainer');
    expect(screen.getByRole('link', { name: 'How points work' })).toHaveAttribute('href', '/points#how-points-work');
  });

  it('gives an unknown URL no legacy card and no guesses', () => {
    renderNotFound('/zzzz-qqqq');
    expect(screen.queryByText('Looking for this?')).not.toBeInTheDocument();
    expect(screen.queryByText('You might have meant')).not.toBeInTheDocument();
  });

  it('reveals nothing about admin routes: an admin URL renders exactly like any other unknown URL', () => {
    // React's generated ids (useId) differ per mount; everything else must be identical.
    const normalize = (html: string) => html.replace(/:r[0-9a-z]+:/g, ':r:');
    const { container: baseline, unmount: unmountBaseline } = renderNotFound('/zzzz-qqqq');
    const unknownHtml = normalize(baseline.innerHTML);
    unmountBaseline();

    for (const path of ['/admin/members', '/admin/does-not-exist', '/admin']) {
      const { container, unmount } = renderNotFound(path);
      expect(normalize(container.innerHTML)).toBe(unknownHtml);
      unmount();
    }
  });
});

describe('NotFound inside the real app routes', () => {
  function renderApp(path: string) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AnalyticsConsentProvider>
            <AuthProvider>
              <SiteSettingsProvider>
                <MemoryRouter initialEntries={[path]}>
                  <AppRoutes />
                </MemoryRouter>
              </SiteSettingsProvider>
            </AuthProvider>
          </AnalyticsConsentProvider>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  }

  it('renders the recovery page for an unknown URL and keeps the site header search available', async () => {
    renderApp('/definitely-not-a-real-route');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Search pages, events and photo albums/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Search the site' }).length).toBeGreaterThan(0);
  });

  it('treats unknown admin URLs as ordinary missing pages for a signed-out visitor', async () => {
    renderApp('/admin/definitely-not-real');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(screen.queryByText('Looking for this?')).not.toBeInTheDocument();
  });
});
