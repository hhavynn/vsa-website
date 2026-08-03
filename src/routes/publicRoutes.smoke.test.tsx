/**
 * Route-level smoke tests for every public page (#294).
 *
 * WHAT THIS PROTECTS
 * ------------------
 * Before this existed, nothing in CI could tell you a public page had stopped
 * rendering. Every test was unit-level over utils/, schemas/ and lib/, so a
 * change that blanked the events page — a bad import, a provider ordering
 * change, a throw during first render — passed CI and shipped straight to
 * production, because main auto-deploys.
 *
 * These tests do not assert page content, deliberately. Content changes every
 * academic year and asserting on copy would make this suite a maintenance tax
 * that gets deleted. What they assert is that **the route mounts and does not
 * fall into the ErrorBoundary** — see the KNOWN LIMITATION note at the bottom
 * for the failure mode this does not yet cover.
 *
 * Data is served by the recording Supabase mock with empty results, so each
 * page renders its empty/degraded state. That is the correct thing to smoke
 * test — it is also exactly what a visitor sees during summer break, and what
 * they would see if the database were unreachable.
 */

import { render, screen } from '@testing-library/react';
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

/**
 * Every statically-reachable public path, plus one representative value for
 * each parameterised public route. Admin and protected tiers are out of scope
 * here — they have their own gating and belong in a separate suite.
 */
const PUBLIC_ROUTES = [
  '/',
  '/events',
  '/calendar',
  '/leaderboard',
  '/cabinet',
  '/get-involved',
  '/gallery',
  '/ace',
  '/house',
  '/house/archive',
  '/house/archive/2025-2026',
  '/house/year/2025-2026',
  '/house/dragon',
  '/house-system',
  '/intern-program',
  '/vcn',
  '/vcn/current',
  '/vcn/archive',
  '/wild-n-culture',
  '/uvsa-network',
  '/points',
  '/feedback',
  '/privacy',
  '/admin/login',
];

function renderRoute(path: string) {
  // A fresh QueryClient per render prevents one route's cached failure from
  // leaking into the next and turning this suite order-dependent.
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

describe('public routes render without crashing (#294)', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    supabaseMock.reset();
    // React logs the full component stack when an error boundary catches.
    // Silence it so a deliberate render failure does not bury the assertion,
    // but keep the calls so they can still be inspected.
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it.each(PUBLIC_ROUTES)('%s mounts and stays out of the error boundary', async (path) => {
    renderRoute(path);

    // Assert something POSITIVE, and let findBy* do the waiting.
    //
    // The tempting version — waitFor(() => expect(queryByText(/loading/i))
    // .not.toBeInTheDocument()) followed by an assertion that no error copy is
    // present — is worthless: while the lazy chunk is still resolving the DOM
    // is empty, so both conditions are trivially true and the assertion fires
    // against nothing at all. Waiting for <main> to exist forces the route to
    // have actually mounted before anything is asserted.
    //
    // See the KNOWN LIMITATION note at the bottom for what this still misses.
    const main = await screen.findByRole('main');
    expect(main).toBeInTheDocument();

    // And it must not have fallen back to the error boundary.
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  /**
   * KNOWN LIMITATION — read before trusting this suite.
   *
   * These tests catch a route that fails to MOUNT: a bad import, a module-load
   * throw, a provider-ordering break, a missing export. They do NOT catch a
   * page component that throws during render.
   *
   * That was established by mutation, not assumed. Injecting
   * `throw new Error(...)` into the Events page leaves this suite green,
   * because Layout wraps its <Outlet> in its own
   * <Suspense fallback={<PageLoader />}>: the nav, <main> and footer all render
   * normally and the page area sits on "Loading..." indefinitely. The outer
   * ErrorBoundary never engages, so there is no error copy to assert on.
   *
   * Asserting "the loader clears and <main> is non-empty" would close that
   * gap, but it cannot be turned on yet: against an empty database
   * /events, /leaderboard and /gallery render a completely empty <main> with
   * no empty state at all, and several other routes keep a section spinner up
   * forever. Those are pre-existing degraded-mode defects, and encoding them
   * as failing tests here would mean shipping a red suite.
   *
   * The follow-up, in order:
   *   1. Fix the degraded-mode rendering so every public route renders
   *      *something* when the database returns no rows.
   *   2. Then add `expect(main.textContent).not.toBe('')` and a loader-cleared
   *      assertion here, which also closes the throw-during-render gap.
   */
});
