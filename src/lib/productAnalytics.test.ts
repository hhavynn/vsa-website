import type { CaptureResult } from 'posthog-js';
import { isExcludedPath, scrubProductEvent } from './productAnalytics';

const mockPosthog = {
  init: jest.fn(),
  capture: jest.fn(),
  has_opted_out_capturing: jest.fn(() => false),
  opt_in_capturing: jest.fn(),
  opt_out_capturing: jest.fn(),
  reset: jest.fn(),
};
jest.mock('posthog-js', () => ({ __esModule: true, default: mockPosthog }));

const KEY = 'phc_testkey';

function loadWithEnv(env: Record<string, string | undefined>) {
  const saved = { ...process.env };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  let analytics: typeof import('./productAnalytics') | undefined;
  jest.isolateModules(() => {
    analytics = require('./productAnalytics');
  });
  process.env = saved;
  return analytics!;
}

const configured = () => loadWithEnv({ REACT_APP_POSTHOG_KEY: KEY, REACT_APP_POSTHOG_HOST: 'https://us.i.posthog.com' });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function event(properties: CaptureResult['properties'], extra: Partial<CaptureResult> = {}): CaptureResult {
  return { uuid: 'u', event: '$autocapture', properties, ...extra } as CaptureResult;
}

describe('product analytics scrubbing', () => {
  it('excludes admin and sign-in paths only', () => {
    expect(isExcludedPath('/admin')).toBe(true);
    expect(isExcludedPath('/admin/members')).toBe(true);
    expect(isExcludedPath('/signin')).toBe(true);
    expect(isExcludedPath('/administrators')).toBe(false);
    expect(isExcludedPath('/events')).toBe(false);
  });

  it('drops events captured on excluded pages', () => {
    expect(scrubProductEvent(event({ $pathname: '/admin/members' }))).toBeNull();
    expect(scrubProductEvent(null)).toBeNull();
  });

  it('strips query strings and fragments from URL properties and redacts emails elsewhere', () => {
    const scrubbed = scrubProductEvent(
      event(
        {
          $pathname: '/gallery',
          $current_url: 'https://www.vsaatucsd.com/gallery?search=Jane#x',
          $referrer: 'https://www.vsaatucsd.com/points?email=a@b.co',
          note: 'contact a@b.co',
          $elements: [{ tag_name: 'a', $el_text: 'mail jane@ucsd.edu' }],
        },
        { $set_once: { $initial_current_url: 'https://www.vsaatucsd.com/?ref=x' } }
      )
    );

    expect(scrubbed?.properties).toEqual({
      $pathname: '/gallery',
      $current_url: 'https://www.vsaatucsd.com/gallery',
      $referrer: 'https://www.vsaatucsd.com/points',
      note: 'contact [email]',
      $elements: [{ tag_name: 'a', $el_text: 'mail [email]' }],
    });
    expect(scrubbed?.$set_once).toEqual({ $initial_current_url: 'https://www.vsaatucsd.com/' });
  });
});

describe('product analytics loading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPosthog.has_opted_out_capturing.mockReturnValue(false);
    window.localStorage.clear();
  });

  it('does nothing unless both the key and host are set', async () => {
    const analytics = loadWithEnv({ REACT_APP_POSTHOG_KEY: KEY, REACT_APP_POSTHOG_HOST: undefined });
    expect(analytics.isProductAnalyticsConfigured()).toBe(false);
    analytics.trackProductPageView('/events');
    await flush();
    expect(mockPosthog.init).not.toHaveBeenCalled();
  });

  it('initializes once with anonymous, minimal-capture defaults and sends a path-only page view', async () => {
    const analytics = configured();
    analytics.trackProductPageView('/events');
    analytics.trackProductPageView('/gallery');
    await flush();

    expect(mockPosthog.init).toHaveBeenCalledTimes(1);
    const [key, options] = mockPosthog.init.mock.calls[0];
    expect(key).toBe(KEY);
    expect(options).toEqual(
      expect.objectContaining({
        api_host: 'https://us.i.posthog.com',
        persistence: 'localStorage',
        person_profiles: 'never',
        capture_pageview: false,
        autocapture: { dom_event_allowlist: ['click'], element_allowlist: ['a', 'button'] },
        mask_all_text: true,
        mask_all_element_attributes: true,
        disable_session_recording: true,
        disable_external_dependency_loading: true,
        capture_exceptions: false,
        advanced_disable_flags: true,
        before_send: analytics.scrubProductEvent,
      })
    );
    expect(mockPosthog.capture).toHaveBeenCalledWith('$pageview', { $current_url: `${window.location.origin}/events` });
    expect(mockPosthog.capture).toHaveBeenCalledTimes(2);
  });

  it('never loads for excluded paths', async () => {
    const analytics = configured();
    analytics.trackProductPageView('/admin/members');
    await flush();
    expect(mockPosthog.init).not.toHaveBeenCalled();
  });

  it('opts back in without an extra event after an earlier decline', async () => {
    mockPosthog.has_opted_out_capturing.mockReturnValue(true);
    const analytics = configured();
    analytics.trackProductPageView('/events');
    await flush();
    expect(mockPosthog.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: null });
  });

  it('on decline, resets the anonymous ID and opts out', async () => {
    const analytics = configured();
    analytics.trackProductPageView('/events');
    await flush();
    analytics.disableProductAnalytics();
    expect(mockPosthog.reset).toHaveBeenCalledWith(true);
    expect(mockPosthog.opt_out_capturing).toHaveBeenCalled();
  });

  it('on decline before loading, clears stored PostHog data without loading the SDK', () => {
    window.localStorage.setItem(`ph_${KEY}_posthog`, '{"distinct_id":"x"}');
    window.localStorage.setItem('theme', 'dark');
    const analytics = configured();
    analytics.disableProductAnalytics();
    expect(window.localStorage.getItem(`ph_${KEY}_posthog`)).toBeNull();
    expect(window.localStorage.getItem('theme')).toBe('dark');
    expect(mockPosthog.init).not.toHaveBeenCalled();
  });
});
