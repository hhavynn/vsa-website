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
 * These tests do not assert page copy, deliberately. Content changes every
 * academic year and asserting on wording would make this suite a maintenance
 * tax that gets deleted instead of maintained. What they assert is that the
 * route **mounts, settles, and renders something** — see the note at the
 * bottom for exactly which failures that does and does not cover.
 *
 * Data is served by the recording Supabase mock with empty results, so every
 * page renders its empty state. That is the right thing to smoke test: it is
 * what a visitor sees during summer break, and what they would see if the
 * database were unreachable.
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
  // Historical House detail: year + house slug together. These are declared as
  // multi-line <Route> elements in routes/index.tsx and are easy to miss when
  // eyeballing the file — they resolve HouseDetail through a different path
  // than /house/:houseSlug does.
  '/house/archive/2025-2026/dragon',
  '/house/year/2025-2026',
  '/house/year/2025-2026/dragon',
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
  // Member accounts are intentionally parked for this release, but the route
  // is public and reachable, so it still has to render.
  '/profile',
  '/admin/login',
  // Redirects to /admin/login; included so the redirect itself is covered.
  '/signin',
  // The catch-all NotFound page. Public-facing and easy to forget.
  '/definitely-not-a-real-route',
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

  it.each(PUBLIC_ROUTES)('%s mounts, settles, and renders content', async (path) => {
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
    // See the note at the bottom for the full catches/misses list.
    const main = await screen.findByRole('main');
    expect(main).toBeInTheDocument();

    // And it must not have fallen back to the error boundary.
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();

    // THE ASSERTION WITH TEETH: the page must actually settle.
    //
    // Two conditions, and both are load-bearing:
    //   - non-empty, because the skeletons render pure markup with no text, so
    //     an unsettled page reads as ''.
    //   - not still on the loader, because when a page component throws during
    //     render the outer ErrorBoundary never engages — Layout's own
    //     <Suspense fallback={<PageLoader />}> keeps the nav, main and footer
    //     intact and the page area sits on "Loading..." forever. Without this
    //     clause a thrown page reads as non-empty and passes.
    //
    // Verified in both directions by mutation; see the note below.
    //
    // Expressed as one assertion on a descriptive string rather than two
    // expects, both to satisfy testing-library/no-wait-for-multiple-assertions
    // and so a timeout reports what the page was actually stuck on.
    await waitFor(
      () => {
        const text = main.textContent?.trim() ?? '';
        const settled = text !== '' && !/^loading/i.test(text);
        expect(settled ? 'settled' : `unsettled: "${text.slice(0, 60)}"`).toBe('settled');
      },
      { timeout: 5000 }
    );
  });

  /**
   * WHAT THIS SUITE DOES AND DOES NOT CATCH — verified by mutation.
   *
   * Catches:
   *   - a route that fails to mount (bad import, module-load throw,
   *     provider-ordering break, missing export) — <main> never appears;
   *   - a page component that throws during render — the page area is pinned
   *     on "Loading..." forever and never settles;
   *   - a page that renders nothing at all.
   *
   * Proven, not assumed: injecting `throw new Error(...)` into the Events page
   * fails exactly one test (/events, by timeout) and leaves the other 23
   * passing. Removing the throw returns the suite to 24/24.
   *
   * The subtle part worth preserving: when a page throws, the outer
   * ErrorBoundary never engages. Layout wraps its <Outlet> in its own
   * <Suspense fallback={<PageLoader />}>, so nav, <main> and footer render
   * normally while the page area spins indefinitely. Users see an eternal
   * loader rather than an error. That is why "no error-boundary copy" is not
   * sufficient on its own and the settle assertion carries the weight.
   *
   * Does not catch: wrong content, broken styling, or a page that renders a
   * plausible-looking but incorrect state. Those need per-page tests.
   */
});
