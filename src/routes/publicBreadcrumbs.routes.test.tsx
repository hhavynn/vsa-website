/**
 * Breadcrumbs on the real nested public routes (#265): present where the URL
 * has a parent, absent on flat top-level pages. Data comes from the recording
 * Supabase mock with empty results, like the route smoke suite.
 */
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { SiteSettingsProvider } from '../context/SiteSettingsContext';
import { AnalyticsConsentProvider } from '../context/AnalyticsConsentContext';
import AppRoutes from './index';
import { supabaseMock } from '../test-utils/supabaseMock';

jest.mock('../lib/supabase', () => ({
  get supabase() {
    return require('../test-utils/supabaseMock').supabaseMock.client;
  },
}));

function renderRoute(path: string) {
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

const crumbs = () => within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getAllByRole('listitem').map((item) => item.textContent?.replace('›', '').trim());

beforeEach(() => {
  supabaseMock.reset();
  window.scrollTo = jest.fn();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('breadcrumbs on nested public routes', () => {
  it('/vcn/current: Home > VCN > This year’s show', async () => {
    renderRoute('/vcn/current');
    await screen.findByRole('navigation', { name: 'Breadcrumb' });
    expect(crumbs()).toEqual(['Home', 'VCN', 'This year’s show']);
  });

  it('/vcn/archive: Home > VCN > Archive', async () => {
    renderRoute('/vcn/archive');
    await screen.findByRole('navigation', { name: 'Breadcrumb' });
    expect(crumbs()).toEqual(['Home', 'VCN', 'Archive']);
  });

  it('/house/archive: Home > House > Archive', async () => {
    renderRoute('/house/archive');
    await screen.findByRole('navigation', { name: 'Breadcrumb' });
    expect(crumbs()).toEqual(['Home', 'House', 'Archive']);
  });

  it('/house/year/<past year>: the year sits under Archive and is not marked Current', async () => {
    renderRoute('/house/year/2021-2022');
    await screen.findByRole('navigation', { name: 'Breadcrumb' });
    expect(crumbs()).toEqual(['Home', 'House', 'Archive', '2021–22']);
  });

  it('/house/year/<future year>: the coming-soon placeholder still gets a trail, with no archive claim', async () => {
    renderRoute('/house/year/2090-2091');
    await screen.findByRole('navigation', { name: 'Breadcrumb' });
    expect(crumbs()).toEqual(['Home', 'House', '2090–91']);
  });

  it.each(['/events', '/gallery', '/vcn', '/house', '/leaderboard', '/get-involved'])('%s is a flat page and gets no breadcrumb', async (path) => {
    renderRoute(path);
    // Wait for the page itself, then assert the absence.
    await screen.findByRole('main');
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
  });
});
