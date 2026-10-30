import * as Sentry from './sentryClient';
import { redactText, scrubBreadcrumb, scrubEvent, stripUrl } from './monitoring';

jest.mock('./sentryClient', () => ({ init: jest.fn(), captureException: jest.fn() }));

const DSN = 'https://publickey@o1.ingest.us.sentry.io/2';

function loadWithEnv(env: Record<string, string | undefined>) {
  const saved = { ...process.env };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  let monitoring: typeof import('./monitoring') | undefined;
  jest.isolateModules(() => {
    monitoring = require('./monitoring');
  });
  process.env = saved;
  return monitoring!;
}

describe('monitoring scrubbers', () => {
  it('redacts emails and JWTs', () => {
    expect(redactText('Lookup failed for Jane.Doe+vsa@ucsd.edu')).toBe('Lookup failed for [email]');
    expect(redactText('token eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl here')).toBe('token [token] here');
  });

  it('drops query strings and fragments from URLs', () => {
    expect(stripUrl('https://x.supabase.co/rest/v1/members?select=id&email=in.(a@b.co)')).toBe(
      'https://x.supabase.co/rest/v1/members'
    );
    expect(stripUrl('https://www.vsaatucsd.com/signin#access_token=abc&type=recovery')).toBe(
      'https://www.vsaatucsd.com/signin'
    );
  });

  it('drops console breadcrumbs', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'member a@b.co' })).toBeNull();
  });

  it('strips URLs on fetch and navigation breadcrumbs', () => {
    expect(
      scrubBreadcrumb({ category: 'fetch', data: { url: '/rest/v1/members?email=eq.a@b.co', status_code: 200 } })
    ).toEqual({ category: 'fetch', data: { url: '/rest/v1/members', status_code: 200 } });
    expect(scrubBreadcrumb({ category: 'navigation', data: { from: '/admin/members?q=Jane', to: '/signin#x' } })).toEqual(
      { category: 'navigation', data: { from: '/admin/members', to: '/signin' } }
    );
  });

  it('removes attribute text from click selectors', () => {
    expect(
      scrubBreadcrumb({ category: 'ui.click', message: 'div.row > button.btn[aria-label="Remove Jane Doe"]' })
    ).toEqual({ category: 'ui.click', message: 'div.row > button.btn' });
  });

  it('removes user, headers other than User-Agent, and PII in messages from events', () => {
    const event = scrubEvent({
      type: undefined,
      user: { id: 'u1', email: 'a@b.co' },
      request: {
        url: 'https://www.vsaatucsd.com/points?email=a@b.co',
        headers: { 'User-Agent': 'UA', Referer: 'https://www.vsaatucsd.com/admin?q=a@b.co' },
        cookies: { sb: 'session' },
      },
      message: 'Failed for a@b.co',
      exception: { values: [{ type: 'DatabaseError', value: 'duplicate a@b.co' }] },
      breadcrumbs: [{ category: 'console', message: 'x' }, { category: 'fetch', data: { url: '/r?x=1' } }],
    });

    expect(event.user).toBeUndefined();
    expect(event.request).toEqual({ url: 'https://www.vsaatucsd.com/points', headers: { 'User-Agent': 'UA' } });
    expect(event.message).toBe('Failed for [email]');
    expect(event.exception?.values?.[0].value).toBe('duplicate [email]');
    expect(event.breadcrumbs).toEqual([{ category: 'fetch', data: { url: '/r' } }]);
  });
});

describe('initMonitoring', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does nothing without a DSN', async () => {
    const monitoring = loadWithEnv({ REACT_APP_SENTRY_DSN: undefined, NODE_ENV: 'production' });
    expect(monitoring.initMonitoring()).toBeUndefined();
    monitoring.reportError(new Error('boom'));
    await Promise.resolve();
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('does nothing outside production builds', () => {
    const monitoring = loadWithEnv({ REACT_APP_SENTRY_DSN: DSN, NODE_ENV: 'development' });
    expect(monitoring.initMonitoring()).toBeUndefined();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('initializes errors-only with every data-collection category off', async () => {
    const monitoring = loadWithEnv({ REACT_APP_SENTRY_DSN: DSN, NODE_ENV: 'production' });
    await monitoring.initMonitoring();

    expect(Sentry.init).toHaveBeenCalledTimes(1);
    const options = (Sentry.init as jest.Mock).mock.calls[0][0];
    expect(options.dsn).toBe(DSN);
    expect(options.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      stackFrameVariables: false,
    });
    expect(options.enhanceFetchErrorMessages).toBe('report-only');
    expect(options).not.toHaveProperty('tracesSampleRate');
    expect(options).not.toHaveProperty('replaysSessionSampleRate');
    expect(options.integrations([{ name: 'Console' }, { name: 'Breadcrumbs' }])).toEqual([{ name: 'Breadcrumbs' }]);
  });

  it('ignores errors thrown by scripts that in-app browsers inject', async () => {
    const monitoring = loadWithEnv({ REACT_APP_SENTRY_DSN: DSN, NODE_ENV: 'production' });
    await monitoring.initMonitoring();

    const { ignoreErrors } = (Sentry.init as jest.Mock).mock.calls[0][0];
    const isIgnored = (message: string) => ignoreErrors.some((pattern: RegExp) => pattern.test(message));
    expect(isIgnored("undefined is not an object (evaluating 'window._META.IABInnerFrame')")).toBe(true);
    expect(isIgnored('ResizeObserver loop completed with undelivered notifications.')).toBe(true);
    expect(isIgnored("undefined is not an object (evaluating 'event.target.value')")).toBe(false);
  });

  it('sends errors raised before the SDK loaded once it is ready', async () => {
    const monitoring = loadWithEnv({ REACT_APP_SENTRY_DSN: DSN, NODE_ENV: 'production' });
    const early = new Error('early');
    const caught = new Error('caught by a boundary');
    const removeListener = jest.spyOn(window, 'removeEventListener');

    const ready = monitoring.initMonitoring();
    window.dispatchEvent(new ErrorEvent('error', { error: early }));
    monitoring.reportError(caught, 'in Page');
    expect(Sentry.captureException).not.toHaveBeenCalled();

    await ready;
    expect(Sentry.captureException).toHaveBeenNthCalledWith(1, early, undefined);
    expect(Sentry.captureException).toHaveBeenNthCalledWith(2, caught, {
      contexts: { react: { componentStack: 'in Page' } },
    });

    // The SDK's own handlers take over, so the buffering listeners are gone.
    expect(removeListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    removeListener.mockRestore();

    monitoring.reportError(new Error('later'));
    expect(Sentry.captureException).toHaveBeenCalledTimes(3);
  });
});
