/**
 * Automated axe accessibility regression checks for representative public routes (#315).
 *
 * These tests run axe-core against fully-rendered pages in both light and dark
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
import { QueryClient, QueryClientProvider } from 'react-query';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { SiteSettingsProvider } from '../context/SiteSettingsContext';
import { AnalyticsConsentProvider } from '../context/AnalyticsConsentContext';
import AppRoutes from './index';
import { supabaseMock } from '../test-utils/supabaseMock';

expect.extend(toHaveNoViolations);

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

function renderRoute(path: string, theme: Theme) {
  setHtmlTheme(theme);
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

interface AxeViolation {
  id: string;
  impact?: string;
  help: string;
  nodes: Array<{ target: string[] }>;
}

function formatViolations(violations: AxeViolation[]) {
  return violations
    .map(
      (v) =>
        `• ${v.impact?.toUpperCase() ?? 'UNKNOWN'}: ${v.id} - ${v.help}\n  Elements: ${v.nodes
          .map((n) => n.target.join(' '))
          .join(', ')}`
    )
    .join('\n');
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
      renderRoute(path, theme);
      await waitForRouteToSettle();

      const container = document.body;
      const results = await axe(container, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
        },
      });

      const seriousOrCritical = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      expect(seriousOrCritical).toHaveLength(0);
      if (results.violations.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(`Non-blocking axe findings on ${path} (${theme}):\n${formatViolations(results.violations)}`);
      }
    },
    20000
  );
});
