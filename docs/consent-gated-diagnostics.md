# Consent-gated error and field-performance signals — partial #302

The site uses its **existing** GA4 loader and existing visitor consent. No new
SDK, endpoint, cookie, backend database, monitoring provider or third-party
origin is introduced.

## Emitted signals (only after opt-in)

| Event | Allowed parameters | Deliberately absent |
|---|---|---|
| `exception` | `description`: fixed `render_failure` or `chunk_load`, `page_area`: fixed `public` or `admin`, `fatal: true` | error messages, component stack, call stack, raw path, query/hash, member ID, provider payload |
| `web_vital` | `metric_name`: CLS/FCP/INP/LCP/TTFB allowlist; `metric_value`: finite nonnegative number, rounded to three decimals | metric ID, navigation URL, resource timing, attribution, cookies, user properties |

Tracking stays disabled when consent is absent or declined. The first granted
consent loads GA4 and installs Web Vitals observers once per tab; later
withdrawal stops emitting even if the browser performance observers remain.
`disableGA()` disables diagnostic sends synchronously, before React re-renders.
The prior no-op `reportWebVitals()` bootstrap is removed.

A stale chunk that recovers with its one automatic reload is **not** reported as
a production exception, to avoid noisy transient deploy mismatches. An actual
uncaught React error that reaches the fallback may be reported as a category.
This PR does not capture all network errors, Promise rejections or Edge Function
failures, and does not yet set up threshold-based alert delivery. GA4's own
standard browser details may be present according to its consented collection
settings; this code adds no raw browser fingerprint or stack information.

## QA checklist

1. With consent unset and with consent declined, open a public route and
   trigger a synthetic rendering error. No GA4 script load or new diagnostic
   request should occur.
2. Grant analytics consent; verify one GA4 script and one Web Vitals
   initialization (also in React StrictMode), and coarse `exception` when a
   synthetic crash triggers the fallback. Verify captured payload excludes
   raw errors, querystrings, session/member identifiers, and stack traces.
3. Change public pages; no duplicate vitals observer registrations.
   Withdraw consent; verify further vitals/errors no longer emit.
4. Test a chunk-load recovery and retry; confirm the automatic successful
   recovery is not counted as an exception.
5. Check GA4 consent and event data in its debug tools, then compare that
   to the user-facing privacy policy and existing retention. No implied
   full-traffic coverage: these are opt-in samples only.
6. Follow the existing repo's GA4/CSP and manual browser QA checklist;
   desktop/mobile, light/dark, and reduced-motion paths.

## Follow-up scope

The full #302 goal needs a reviewed error-rate alert and an operational
Edge Function error view; web-vitals metrics need deliberate GA4
custom-dimension/metric configuration and sampling interpretation.
This change does not claim alerting or complete production monitoring.
