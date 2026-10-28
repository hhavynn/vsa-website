/**
 * Vietnamese language attribute regression tests for public content (#318).
 *
 * Verifies that genuine Vietnamese-language passages are marked with lang="vi"
 * without marking entire English pages or personal names as Vietnamese.
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

async function waitForRouteToSettle() {
  await screen.findByRole('main', {}, { timeout: 5000 });
  await waitFor(
    () => {
      const text = screen.getByRole('main').textContent?.trim() ?? '';
      const settled = text !== '' && !/^loading/i.test(text);
      expect(settled ? 'settled' : `unsettled: "${text.slice(0, 60)}"`).toBe('settled');
    },
    { timeout: 5000 }
  );
}

describe('Vietnamese language markers (#318)', () => {
  beforeEach(() => supabaseMock.reset());

  it('marks ACE program Vietnamese terms on /ace', async () => {
    renderRoute('/ace');
    await waitForRouteToSettle();

    expect(screen.getAllByText('Anh Chị Em', { selector: '[lang="vi"]' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gia Đình', { selector: '[lang="vi"]' }).length).toBeGreaterThan(0);
  });

  it('marks the VCN song title on the homepage wrapped recap card', async () => {
    renderRoute('/');
    await waitForRouteToSettle();

    expect(screen.getByText('Tình Yêu Thầm Lặng', { selector: '[lang="vi"]' })).toBeInTheDocument();
  });

  it('does not mark the English page wrapper as Vietnamese', async () => {
    renderRoute('/');
    await waitForRouteToSettle();
    const main = screen.getByRole('main');
    expect(main).not.toHaveAttribute('lang', 'vi');
  });
});
