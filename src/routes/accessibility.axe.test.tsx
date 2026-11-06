/**
 * Automated axe accessibility regression checks for representative public routes (#315).
 *
 * These tests run axe-core against representative pages in both light and dark
 * themes. Critical and serious violations fail the suite. The violation message
 * includes the rule id, impact, and a CSS selector for the failing element so
 * regressions are actionable.
 *
 * Automated axe checks in jsdom do NOT prove real-browser colour contrast,
 * screen-reader behaviour, or manual focus handling. They catch structural
 * regressions (landmarks, labels, headings, alt text, etc.).
 */

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'jest-axe';
import { formatAxeViolations, withoutReviewedFalsePositives } from '../lib/axeRegressionPolicy';
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

type Theme = 'light' | 'dark';

const AXE_ROUTE_THEME_CASES: [string, Theme][] = [
  ['/', 'light'],
  ['/', 'dark'],
  ['/events', 'light'],
  ['/events', 'dark'],
  ['/leaderboard', 'light'],
  ['/leaderboard', 'dark'],
  ['/points', 'light'],
  ['/points', 'dark'],
  ['/gallery', 'light'],
  ['/gallery', 'dark'],
  ['/house', 'light'],
  ['/house', 'dark'],
  ['/get-involved', 'light'],
  ['/get-involved', 'dark'],
];

function setHtmlTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
}

function mountRoute(path: string, theme: Theme) {
  setHtmlTheme(theme);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  render(
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
  return queryClient;
}

async function waitForRouteToSettle(queryClient: QueryClient, path: string) {
  await screen.findByRole('main', {}, { timeout: 5000 });
  await screen.findByRole('heading', { level: 1 }, { timeout: 5000 });
  await waitFor(
    () => {
      expect(queryClient.isFetching()).toBe(0);
      if (path === '/house') {
        expect(screen.queryByText('Loading standings...')).not.toBeInTheDocument();
      }
    },
    { timeout: 5000 }
  );
}

describe('axe accessibility regression checks (#315)', () => {
  beforeEach(() => {
    supabaseMock.reset();
  });

  afterEach(() => {
    setHtmlTheme('light');
  });

  it.each(AXE_ROUTE_THEME_CASES)(
    '%s has no critical or serious axe violations in %s mode',
    async (path, theme) => {
      const queryClient = mountRoute(path, theme);
      await waitForRouteToSettle(queryClient, path);

      const container = document.body;
      const results = await axe(container, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
        },
      });

      const violations = withoutReviewedFalsePositives(results.violations, path, theme);
      const seriousOrCritical = violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      if (seriousOrCritical.length > 0) {
        throw new Error(
          `Critical/serious accessibility violations on ${path} (${theme}):\n${formatAxeViolations(seriousOrCritical)}`
        );
      }
      if (violations.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(`Non-blocking axe findings on ${path} (${theme}):\n${formatAxeViolations(violations)}`);
      }
    },
    20000
  );
});
