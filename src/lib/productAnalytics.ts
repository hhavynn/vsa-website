/**
 * PostHog product analytics, run alongside GA4 behind the same "Allow
 * analytics" choice. Inert unless REACT_APP_POSTHOG_KEY and
 * REACT_APP_POSTHOG_HOST are set, and the SDK is a lazy chunk fetched only
 * after consent. Events are anonymous: never call identify(), alias() or
 * setPersonProperties() with member data.
 * See docs/observability-instrumentation-plan.md (Phase 3).
 */
import type { CaptureResult, PostHog, Properties, Property } from 'posthog-js';
import { redactText, stripUrl } from './monitoring';

const KEY = process.env.REACT_APP_POSTHOG_KEY;
const HOST = process.env.REACT_APP_POSTHOG_HOST;

// Admin pages render member data, and sign-in is not a product surface.
const EXCLUDED_PATH_PREFIXES = ['/admin', '/signin'];
const URL_PROPERTIES = new Set([
  '$current_url',
  '$referrer',
  '$initial_current_url',
  '$initial_referrer',
  '$prev_pageview_url',
]);
const MAX_SCRUB_DEPTH = 4;

export const isProductAnalyticsConfigured = () => Boolean(KEY && HOST);

export function isExcludedPath(pathname: string): boolean {
  return EXCLUDED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function scrubValue(key: string, value: Property, depth: number): Property {
  if (typeof value === 'string') return URL_PROPERTIES.has(key) ? stripUrl(value) : redactText(value);
  if (depth >= MAX_SCRUB_DEPTH || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => scrubValue(key, item, depth + 1));
  return scrubProperties(value as Properties, depth + 1);
}

function scrubProperties(properties: Properties, depth = 0): Properties {
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [key, scrubValue(key, value, depth)])
  );
}

/** PostHog `before_send`: drop excluded pages, strip query strings, redact emails and tokens. */
export function scrubProductEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) return null;
  const pathname = event.properties.$pathname;
  if (typeof pathname === 'string' && isExcludedPath(pathname)) return null;

  return {
    ...event,
    properties: scrubProperties(event.properties),
    ...(event.$set ? { $set: scrubProperties(event.$set) } : {}),
    ...(event.$set_once ? { $set_once: scrubProperties(event.$set_once) } : {}),
  };
}

let client: PostHog | undefined;
let loading: Promise<PostHog | undefined> | undefined;

function load(): Promise<PostHog | undefined> {
  if (!loading) {
    loading = import('posthog-js')
      .then(({ default: posthog }) => {
        posthog.init(KEY as string, {
          api_host: HOST as string,
          defaults: '2026-08-30',
          persistence: 'localStorage',
          person_profiles: 'never',
          capture_pageview: false,
          capture_pageleave: false,
          autocapture: { dom_event_allowlist: ['click'], element_allowlist: ['a', 'button'] },
          mask_all_text: true,
          mask_all_element_attributes: true,
          mask_personal_data_properties: true,
          rageclick: false,
          capture_dead_clicks: false,
          capture_heatmaps: false,
          capture_performance: false,
          capture_exceptions: false,
          disable_session_recording: true,
          disable_surveys: true,
          disable_web_experiments: true,
          advanced_disable_flags: true,
          disable_external_dependency_loading: true,
          respect_dnt: true,
          before_send: scrubProductEvent,
        });
        client = posthog;
        return posthog;
      })
      .catch(() => {
        // Analytics must never break the app; a later page view retries.
        loading = undefined;
        return undefined;
      });
  }
  return loading;
}

/** Called only after consent is granted. Path only, like GA4: no query string. */
export function trackProductPageView(path: string) {
  if (!isProductAnalyticsConfigured() || isExcludedPath(path)) return;
  load().then((posthog) => {
    if (!posthog) return;
    if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing({ captureEventName: null });
    posthog.capture('$pageview', { $current_url: `${window.location.origin}${path}` });
  });
}

/** Called when consent is declined: forget the anonymous ID and stop capturing. */
export function disableProductAnalytics() {
  if (client) {
    client.reset(true);
    client.opt_out_capturing();
    return;
  }
  // Not loaded on this visit: clear what an earlier, consented visit stored
  // rather than loading the SDK just to opt out.
  if (!KEY) return;
  try {
    Object.keys(window.localStorage)
      .filter((storageKey) => storageKey.startsWith(`ph_${KEY}`))
      .forEach((storageKey) => window.localStorage.removeItem(storageKey));
  } catch {
    // Storage can be unavailable; nothing was persisted then.
  }
}
