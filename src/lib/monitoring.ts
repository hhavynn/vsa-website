/**
 * Sentry error monitoring. Inert unless REACT_APP_SENTRY_DSN is set in a
 * production build. Errors only: no tracing, no session replay, no user
 * identity. See docs/observability-instrumentation-plan.md.
 *
 * The SDK (~30 kB gzip) is a lazy chunk, so it costs nothing while inert and
 * stays off the critical path when enabled. Errors raised before it loads are
 * buffered and sent once it does.
 */
import type * as SentryClient from './sentryClient';

type SentryOptions = NonNullable<Parameters<typeof SentryClient.init>[0]>;
type Breadcrumb = Parameters<NonNullable<SentryOptions['beforeBreadcrumb']>>[0];
type SentryEvent = Parameters<NonNullable<SentryOptions['beforeSend']>>[0];

const DSN = process.env.REACT_APP_SENTRY_DSN;
const IS_PRODUCTION_BUILD = process.env.NODE_ENV === 'production';
const MAX_BUFFERED_ERRORS = 20;

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
// Breadcrumb selectors can carry aria-label/title/alt text, which on admin
// pages may include member names.
const SELECTOR_ATTRIBUTE_PATTERN = /\[[^\]]*\]/g;

export function redactText(text: string): string {
  return text.replace(JWT_PATTERN, '[token]').replace(EMAIL_PATTERN, '[email]');
}

/**
 * Drops the query string and fragment. PostgREST filters (for example
 * `email=in.(...)`) live in the query, and Supabase auth redirects put tokens
 * in the fragment.
 */
export function stripUrl(url: string): string {
  return redactText(url.split(/[?#]/, 1)[0]);
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === 'console') return null;

  const scrubbed: Breadcrumb = { ...breadcrumb };
  if (scrubbed.message) {
    scrubbed.message = redactText(
      scrubbed.category?.startsWith('ui.')
        ? scrubbed.message.replace(SELECTOR_ATTRIBUTE_PATTERN, '')
        : scrubbed.message
    );
  }
  if (scrubbed.data) {
    const data = { ...scrubbed.data };
    for (const key of ['url', 'from', 'to']) {
      if (typeof data[key] === 'string') data[key] = stripUrl(data[key]);
    }
    scrubbed.data = data;
  }
  return scrubbed;
}

export function scrubEvent(event: SentryEvent): SentryEvent {
  delete event.user;

  if (event.request) {
    const { url } = event.request;
    event.request = {
      url: url ? stripUrl(url) : undefined,
      headers: event.request.headers?.['User-Agent']
        ? { 'User-Agent': event.request.headers['User-Agent'] }
        : undefined,
    };
  }

  if (event.message) event.message = redactText(event.message);

  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = redactText(exception.value);
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null);
  }

  return event;
}

export const isMonitoringConfigured = () => Boolean(DSN) && IS_PRODUCTION_BUILD;

let sentry: typeof SentryClient | undefined;
let loadFailed = false;
const pending: Array<{ error: unknown; componentStack?: string | null }> = [];

function capture(sdk: typeof SentryClient, error: unknown, componentStack?: string | null) {
  sdk.captureException(error, componentStack ? { contexts: { react: { componentStack } } } : undefined);
}

function buffer(error: unknown, componentStack?: string | null) {
  if (pending.length < MAX_BUFFERED_ERRORS) pending.push({ error, componentStack });
}

/** Called once, before the first render. Resolves when the SDK is ready. */
export function initMonitoring(): Promise<void> | undefined {
  if (!isMonitoringConfigured()) return undefined;

  const onError = (event: ErrorEvent) => buffer(event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) => buffer(event.reason);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  const stopBuffering = () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };

  return import('./sentryClient')
    .then((Sentry) => {
      stopBuffering();
      Sentry.init({
        dsn: DSN,
        environment: process.env.REACT_APP_VERCEL_ENV || process.env.NODE_ENV,
        release: process.env.REACT_APP_VERCEL_GIT_COMMIT_SHA,
        // v11 collects everything when dataCollection is unset (sendDefaultPii
        // no longer exists), so every category is switched off explicitly.
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
          graphQL: { document: false, variables: false },
          genAI: { inputs: false, outputs: false },
          databaseQueryData: false,
          stackFrameVariables: false,
        },
        // The default rewrites real fetch error messages, and
        // isSupabaseUnavailable() classifies outages by matching them.
        enhanceFetchErrorMessages: 'report-only',
        // Console calls across src/ log values the app handles; keep them out.
        integrations: (defaults) => defaults.filter((integration) => integration.name !== 'Console'),
        beforeBreadcrumb: scrubBreadcrumb,
        beforeSend: scrubEvent,
        denyUrls: [/^(?:chrome|moz|safari-web)-extension:\/\//i, /^chrome:\/\//i],
        ignoreErrors: [
          /^ResizeObserver loop/,
          // Injected by in-app browsers (social-app webviews) into the page
          // before our code runs; the stack is the HTML document itself.
          /window\._META\.IABInnerFrame/,
        ],
      });
      sentry = Sentry;
      for (const { error, componentStack } of pending.splice(0)) capture(Sentry, error, componentStack);
    })
    .catch(() => {
      // Monitoring must never break the app; without the SDK, errors go unreported.
      stopBuffering();
      loadFailed = true;
      pending.length = 0;
    });
}

export function reportError(error: unknown, componentStack?: string | null) {
  if (!isMonitoringConfigured() || loadFailed) return;
  if (sentry) capture(sentry, error, componentStack);
  else buffer(error, componentStack);
}
