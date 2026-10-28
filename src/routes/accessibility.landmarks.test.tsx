/**
 * Landmark and heading-hierarchy regression tests for representative public routes (#321).
 *
 * These tests do not prove full WCAG compliance, but they do verify the
 * shared-layout contract: one main landmark, one header, one footer, one
 * labeled primary navigation, a functional skip-to-content target, and a
 * single h1 per page.
 */

import { render, screen, waitFor } from '@testing-library/react';
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

const REPRESENTATIVE_PUBLIC_ROUTES = [
  '/',
  '/events',
  '/calendar',
  '/leaderboard',
  '/cabinet',
  '/get-involved',
  '/gallery',
  '/ace',
  '/house',
  '/vcn',
  '/points',
  '/feedback',
  '/privacy',
  '/definitely-not-a-real-route',
];

function renderRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, cacheTime: 0 },
    },
  });

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
    </QueryClientProvider>
  );
}

describe('shared layout landmarks (#321)', () => {
  beforeEach(() => supabaseMock.reset());

  it.each(REPRESENTATIVE_PUBLIC_ROUTES)(
    '%s renders exactly one main, header, and footer landmark',
    async (path) => {
      renderRoute(path);

      const main = await screen.findByRole('main', {}, { timeout: 5000 });
      expect(main).toBeInTheDocument();
      expect(main).toHaveAttribute('id', 'main-content');

      expect(screen.getAllByRole('banner')).toHaveLength(1);
      expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    },
    20000
  );

  it('primary navigation has an accessible label', async () => {
    renderRoute('/');
    await screen.findByRole('main', {}, { timeout: 5000 });

    const nav = screen.getByRole('navigation', { name: /primary navigation/i });
    expect(nav).toBeInTheDocument();
  });

  it('skip-to-content link targets the main landmark', async () => {
    renderRoute('/');
    await screen.findByRole('main', {}, { timeout: 5000 });

    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });
});

describe('heading hierarchy (#321)', () => {
  beforeEach(() => supabaseMock.reset());

  it.each(REPRESENTATIVE_PUBLIC_ROUTES)(
    '%s renders exactly one h1',
    async (path) => {
      renderRoute(path);
      await screen.findByRole('main', {}, { timeout: 5000 });

      // Wait for the lazy route chunk and its data to settle before asserting
      // on headings, mirroring the smoke-test settle check.
      await waitFor(
        () => {
          const text = screen.getByRole('main').textContent?.trim() ?? '';
          const settled = text !== '' && !/^loading/i.test(text);
          expect(settled ? 'settled' : `unsettled: "${text.slice(0, 60)}"`).toBe('settled');
        },
        { timeout: 5000 }
      );

      const h1s = screen.getAllByRole('heading', { level: 1 });
      expect(h1s).toHaveLength(1);
    },
    20000
  );
});
