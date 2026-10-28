# Browser security headers and CSP

The production Vercel configuration applies a small set of browser security headers to every response. The policy is intentionally conservative: it adds protections that do not change the application's network or rendering behavior while leaving Content Security Policy (CSP) enforcement for a measured rollout.

## Headers applied

| Header | Value | Protection |
| --- | --- | --- |
| `X-Content-Type-Options` | `nosniff` | Prevents browsers from treating a response as a different MIME type. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Sends the full referrer on same-origin requests, only the origin cross-origin, and no referrer on HTTPS-to-HTTP downgrades. |
| `Permissions-Policy` | Disables accelerometer, Bluetooth, camera, geolocation, gyroscope, magnetometer, microphone, payment, and USB | Prevents the application and embedded content from requesting browser capabilities the site does not use. |
| `X-Frame-Options` | `DENY` | Prevents the VSA site itself from being framed, reducing clickjacking risk. This does not prevent the site from embedding approved third-party media. |
| `Strict-Transport-Security` | `max-age=0` | Intentionally disables HSTS so browsers clear cached policies instead of pinning HTTPS for this host. This preserves UCSD captive-portal Wi-Fi compatibility; `preload` is deliberately omitted. |

The top-level `headers` rule applies these headers to `/(.*)`. A second `headers` rule sets `Cache-Control: public, max-age=0, must-revalidate` on `/index.html` and on SPA routes (paths with no `.`, excluding `/static/`), so browsers revalidate the HTML shell after every deploy. A top-level `rewrites` rule sends `/((?!static/).*)` to `/index.html` for the single-page application fallback; it excludes `/static/` so a chunk removed by a newer deploy returns a 404 instead of `200 text/html`. The current configuration has no legacy `routes` array and deliberately sets **no** `Cache-Control` on `/static/**`: an explicit immutable header could also be applied to a 404 and pin the missing-chunk response for a year, so hashed assets rely on Vercel's built-in static caching. Verify on a deployment with `curl -I <url>/static/js/<missing>.js` (expect 404, no immutable) and `curl -I <url>/events` (expect `max-age=0, must-revalidate`).

## HSTS decision

HSTS is intentionally disabled as of PR #187, merged 2026-07-08. That PR changed `Strict-Transport-Security` to `max-age=0` after a cached one-year HSTS policy caused `net::ERR_CERT_AUTHORITY_INVALID` on `UCSD-GUEST` captive-portal Wi-Fi. Students were locked out because the browser rejected the captive portal's interception before the portal could complete.

PR #480 (merged 2026-09-30) reintroduced `max-age=31536000` without that validation, and production served it until the fix that restored `max-age=0`. `src/vercelConfig.test.ts` now pins the exact value so a change fails CI instead of shipping silently. Browsers that cached the one-year policy clear it on their next successful HTTPS visit after the fix deploys.

The tradeoff is known and accepted: the site does not receive HSTS protection against SSL-stripping or downgrade attacks while this header remains `max-age=0`.

Revisit this only after proving that captive-portal detection still works, for example by validating a short, ramped `max-age` against campus Wi-Fi on a Vercel preview before promoting it. `preload` remains deliberately omitted.

## CSP rollout decision

CSP is deferred in this change: neither an enforced `Content-Security-Policy` nor a `Content-Security-Policy-Report-Only` header is sent yet.

The application has one inline theme bootstrap script (hashed, see below), loads Google Fonts, injects Google Analytics only after consent, connects to an environment-selected Supabase project, loads user-managed image URLs, embeds approved video URLs, and lets administrators fetch or link approved Google resources. A guessed policy could silently break login, Ask VSA, media, analytics consent behavior, or admin workflows. A report-only policy without a configured reporting endpoint would provide no actionable telemetry and may create misleading console noise.

Before enforcement, deploy a report collector with a documented retention and access policy, inventory production violations, narrow the allowlist, and hash the inline theme bootstrap (done, see below). Test the report-only policy on a Vercel preview before promoting it to production.

## Inline script hash (#222)

`public/index.html` has one inline `<script>` in `<head>` that adds `light` or `dark` to `<html>` before first paint, so the page never flashes the wrong theme. A policy without `'unsafe-inline'` allows it by hash, so the draft `script-src` above names `'sha256-Ly1WRgypBlCo+zVJxALqOhWaWZTLVdAzid4xLq3bnBk='` instead.

- **Hash the built file.** CRA minifies the inline script into `build/index.html`, and browsers hash the bytes they are served, so the hash of `public/index.html` is wrong.
- **Single source of truth:** `config/csp-script-hashes.json`. The draft `script-src` line in this doc must name exactly the same hashes.
- **Guard:** `npm run check:csp-hashes` (`scripts/check-csp-inline-hashes.mjs`) runs after `npm run build` in `.github/workflows/deploy.yml`. It fails if `build/index.html` has an inline script that is not allowlisted, if an allowlisted hash matches no inline script (stale), or if this doc's `script-src` disagrees with the allowlist. `src/lib/cspInlineHashes.test.ts` pins the hashing and parsing, and the doc/allowlist agreement.
- **Regenerate** after any change to the inline script: `npm run build && npm run check:csp-hashes`. The failure prints the actual hash. Put it in `config/csp-script-hashes.json` and in the `script-src` line above, then rerun the check.
- **No runtime chunk.** CRA 5 does not inline a runtime chunk, and `npm run check:csp-hashes` fails if any unlisted inline script ever appears.

## Runtime script inventory for a future enforced policy

Recorded for #223/#224; nothing here is changed by #222.

- Inline `<script>`: only the theme bootstrap, covered by the hash.
- External scripts: the CRA bundle (`/static/js/*`, `'self'`) and the consent-gated GA4 loader. `src/lib/analytics.ts` injects `https://www.googletagmanager.com/gtag/js?id=...` with `document.createElement('script')`; this is covered by the `https://www.googletagmanager.com` source (no inline code, no nonce needed). GA4 then sends data to the `google-analytics.com` collection hosts (`connect-src`/`img-src`).
- No `eval`, `new Function`, string `setTimeout`, `javascript:` URLs, Web Workers, service workers or `importScripts` in `src/` or `public/`; no inline event-handler attributes in `public/index.html`. So `'unsafe-eval'` is not needed for production bundles (CRA production uses `source-map`, not an `eval` devtool).
- Not scripts but needed by the same policy: React `style={...}` props and `el.style.setProperty` (CSSOM, allowed) mean `style-src 'unsafe-inline'` stays until inline style attributes are removed; Google Fonts CSS needs `style-src https://fonts.googleapis.com`.

## External services to account for

A future CSP must cover only the services confirmed in production:

- `self` for the CRA bundles, manifest, icons, and same-origin navigation.
- The configured `https://<project-ref>.supabase.co` origin for database, Auth, Storage, realtime WebSocket traffic, analytics proxy, and the Ask VSA Edge Function. Prefer the exact project origin over a wildcard.
- `https://www.googletagmanager.com` for the consent-gated GA4 script, plus the GA4 collection origins observed in the browser (commonly `https://www.google-analytics.com` and regional collection hosts).
- `https://fonts.googleapis.com` for font CSS and `https://fonts.gstatic.com` for font files.
- `https://o<org-id>.ingest.us.sentry.io` (the exact host in `REACT_APP_SENTRY_DSN`) for Sentry error reports, once that variable is set. The SDK is a same-origin lazy chunk, so it needs no `script-src` entry. See [the observability plan](observability-instrumentation-plan.md).
- `https://us.i.posthog.com` for PostHog events, after analytics consent. The SDK is a same-origin lazy chunk with `disable_external_dependency_loading`, so it needs no `script-src` or `worker-src` entry while Session Replay stays off.
- Approved image origins currently stored in public content, including Supabase Storage and any Google-hosted or migrated gallery/cabinet images. `data:` and `blob:` may be needed for previews and locally generated image uploads.
- Approved frame origins for VCN/WNC video embeds, such as the exact YouTube domains observed in production.
- Google Photos and Google Calendar are outbound links and normally need no CSP source. Google Drive/Docs/Sheets may need `connect-src` only where an admin workflow fetches them from the browser.

An initial policy will likely need directives along these lines, but it must not be copied into production without replacing placeholders and validating actual traffic:

```text
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
script-src 'self' 'sha256-Ly1WRgypBlCo+zVJxALqOhWaWZTLVdAzid4xLq3bnBk=' https://www.googletagmanager.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com data:;
img-src 'self' data: blob: https:;
connect-src 'self' https://<project-ref>.supabase.co wss://<project-ref>.supabase.co https://www.google-analytics.com https://o<org-id>.ingest.us.sentry.io https://us.i.posthog.com;
frame-src https://www.youtube.com https://www.youtube-nocookie.com;
manifest-src 'self';
```

The broad `https:` image source and the `style-src 'unsafe-inline'` value are migration scaffolding, not the desired final state. Tighten them after production inventory. Keep analytics sources in the CSP even though application consent remains the control that decides whether GA loads.

## Manual QA

On a Vercel preview, verify response headers on the document and a static asset, then check:

- Home, Events, Gallery, and Cabinet load with their images and degraded states intact.
- Google Photos, calendar, and other external links open normally.
- VCN/WNC embedded videos still play.
- Ask VSA opens, sends a request, and shows a friendly unavailable state on failure.
- Sign-in, sign-out, session restoration, protected pages, and admin status still work.
- Admin image previews/uploads and approved Google Sheets/Drive workflows still work.
- Google Analytics makes no request before consent, loads after consent, and remains disabled after a decline.
- The browser console has no header-related or CSP blocking errors. This change does not send CSP, so any CSP enforcement observed should be investigated as another configuration layer.
- The site cannot be embedded in a cross-origin iframe.
- HTTP requests to the production domain redirect to HTTPS before relying on HSTS.

## Rollback

If a header causes a production regression, revert the affected entry in the top-level `headers` rule in `vercel.json` and redeploy. Prefer removing only the implicated directive or capability after reproducing the issue on a preview. Do not disable analytics consent, weaken authentication, broaden data access, or add a permissive CSP as a workaround. HSTS remains cached by browsers for its advertised lifetime, which is why this change does not use `preload`; confirm HTTPS coverage for any production subdomains before release.
