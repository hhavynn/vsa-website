# Browser security headers and CSP

The production Vercel configuration applies a small set of browser security headers to every response. The policy is intentionally conservative: it adds protections that do not change the application's network or rendering behavior while leaving Content Security Policy (CSP) enforcement for a measured rollout.

## Headers applied

| Header | Value | Protection |
| --- | --- | --- |
| `X-Content-Type-Options` | `nosniff` | Prevents browsers from treating a response as a different MIME type. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Sends the full referrer on same-origin requests, only the origin cross-origin, and no referrer on HTTPS-to-HTTP downgrades. |
| `Permissions-Policy` | Disables accelerometer, Bluetooth, camera, geolocation, gyroscope, magnetometer, microphone, payment, and USB | Prevents the application and embedded content from requesting browser capabilities the site does not use. |
| `X-Frame-Options` | `DENY` | Prevents the VSA site itself from being framed, reducing clickjacking risk. This does not prevent the site from embedding approved third-party media. |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Instructs browsers to use HTTPS for the current host and its subdomains for one year. `preload` is intentionally omitted. |

The global header route uses Vercel's `continue` behavior so the existing static-asset caching, `index.html` caching, filesystem handling, and SPA fallback routes continue to run unchanged. It remains in the legacy `routes` array to guarantee that the header rule executes before this project's legacy terminating SPA fallback.

## CSP rollout decision

CSP is deferred in this change: neither an enforced `Content-Security-Policy` nor a `Content-Security-Policy-Report-Only` header is sent yet.

The application currently has an inline theme bootstrap script, loads Google Fonts, injects Google Analytics only after consent, connects to an environment-selected Supabase project, loads user-managed image URLs, embeds approved video URLs, and lets administrators fetch or link approved Google resources. A guessed policy could silently break login, Ask VSA, media, analytics consent behavior, or admin workflows. A report-only policy without a configured reporting endpoint would provide no actionable telemetry and may create misleading console noise.

Before enforcement, deploy a report collector with a documented retention and access policy, inventory production violations, narrow the allowlist, and remove or nonce/hash the inline theme bootstrap. Test the report-only policy on a Vercel preview before promoting it to production.

## External services to account for

A future CSP must cover only the services confirmed in production:

- `self` for the CRA bundles, manifest, icons, and same-origin navigation.
- The configured `https://<project-ref>.supabase.co` origin for database, Auth, Storage, realtime WebSocket traffic, analytics proxy, and the Ask VSA Edge Function. Prefer the exact project origin over a wildcard.
- `https://www.googletagmanager.com` for the consent-gated GA4 script, plus the GA4 collection origins observed in the browser (commonly `https://www.google-analytics.com` and regional collection hosts).
- `https://fonts.googleapis.com` for font CSS and `https://fonts.gstatic.com` for font files.
- Approved image origins currently stored in public content, including Supabase Storage and any Google-hosted or migrated gallery/cabinet images. `data:` and `blob:` may be needed for previews and locally generated image uploads.
- Approved frame origins for VCN/WNC video embeds, such as the exact YouTube domains observed in production.
- Google Photos and Google Calendar are outbound links and normally need no CSP source. Google Drive/Docs/Sheets may need `connect-src` only where an admin workflow fetches them from the browser.

An initial policy will likely need directives along these lines, but it must not be copied into production without replacing placeholders and validating actual traffic:

```text
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
script-src 'self' 'unsafe-inline' https://www.googletagmanager.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com data:;
img-src 'self' data: blob: https:;
connect-src 'self' https://<project-ref>.supabase.co wss://<project-ref>.supabase.co https://www.google-analytics.com;
frame-src https://www.youtube.com https://www.youtube-nocookie.com;
manifest-src 'self';
```

The broad `https:` image source and `'unsafe-inline'` values are migration scaffolding, not the desired final state. Tighten them after production inventory. Keep analytics sources in the CSP even though application consent remains the control that decides whether GA loads.

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

If a header causes a production regression, revert the header route in `vercel.json` and redeploy. Prefer removing only the implicated directive or capability after reproducing the issue on a preview. Do not disable analytics consent, weaken authentication, broaden data access, or add a permissive CSP as a workaround. HSTS remains cached by browsers for its advertised lifetime, which is why this change does not use `preload`; confirm HTTPS coverage for any production subdomains before release.
