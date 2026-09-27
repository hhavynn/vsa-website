# Accessibility audit — September 2026

## Scope and method

Audited `/`, `/events`, `/leaderboard`, `/gallery`, and `/cabinet`, plus `/get-involved` and `/ace`, on September 25, 2026. Lighthouse 13.0.1 ran in Microsoft Edge 153.0.4234.32 against the optimized production build served with the CRA SPA fallback on port 3002. The accessibility category scored 1.00 on all seven routes. The `color-contrast` audit passed on each route, with no failed Lighthouse accessibility audits.

To repeat the audit, build and serve the production app:

```sh
npm run build
npx --yes serve -s build -l 3002
```

Then run this command for each route (substitute the route and output filename):

```sh
CHROME_PATH="/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
npx --yes lighthouse@13.0.1 http://localhost:3002/leaderboard \
  --only-categories=accessibility \
  --output=json \
  --output-path=/tmp/vsa-leaderboard-accessibility.json \
  --quiet \
  --chrome-flags="--headless=new --no-sandbox"
```

| Route | Lighthouse accessibility score | Failing audits |
|---|---:|---|
| `/` | 1.00 | None; contrast passes |
| `/events` | 1.00 | None; contrast passes |
| `/leaderboard` | 1.00 | None; contrast passes |
| `/gallery` | 1.00 | None; contrast passes |
| `/cabinet` | 1.00 | None; contrast passes |
| `/get-involved` | 1.00 | None; contrast passes |
| `/ace` | 1.00 | None; contrast passes |

The standalone axe CLI was attempted with axe-core 4.10.3, but could not start an Edge WebDriver session because the matching `msedgedriver` executable is not installed. A separate axe-core 4.10.3 browser run through Puppeteer completed against the same production build on all seven routes: zero violations for WCAG 2.1 A/AA and best-practice rules.

## Changes made from the audit

- SplitText headings now expose one screen-reader-only text node and hide the animated character spans from assistive technology.
- Ask VSA's accessible name now includes its visible “Ask” label.
- Leaderboard view and metric toggles expose `aria-pressed`; its year and page-size selects have accessible names; profile cards derive their names from visible card content.
- Active filter controls use the on-brand/on-accent theme foregrounds. Dedicated accent-text and gold-text tokens keep normal coral/gold text readable in light and dark themes, including shared labels, stickers, member menus, Get Involved, points, and wrapped recap surfaces.
- ACE's scoped coral, gold, teal, and muted text colors now use foreground tokens with passing contrast. Initials on filled coral/gold circles use a dark foreground; teal circles use a darkened brand fill with a light foreground.
- Cabinet's year label is associated with its select.
- Gallery album links use their visible content for the accessible name, the cover image is decorative because its title is adjacent, and album titles follow the page's heading hierarchy.

Regression tests verify SplitText's accessible heading text, the page-size selector name, and the mobile drawer's Tab/Shift+Tab wrap, Escape close, and focus restoration.

## Contrast checks

Ratios are computed from the CSS theme tokens using the WCAG relative-luminance formula. Normal text requires 4.5:1.

| Pair | Light | Dark | Result |
|---|---:|---:|---|
| `text3` on page background | 4.81:1 | 5.66:1 | Pass |
| `text3` on surface | 5.42:1 | 5.17:1 | Pass |
| `text3` on secondary surface | 5.09:1 | 4.64:1 | Pass |
| `on-brand` on brand | 6.09:1 | 8.43:1 | Pass |
| `on-accent` on accent | 5.71:1 | 6.90:1 | Pass |
| Accent text token on page / surface / secondary surface (minimum) | 5.68:1 | 5.70:1 | Pass |
| Gold text token on page / surface / secondary surface (minimum) | 6.77:1 | 7.64:1 | Pass |
| ACE teal text token on page / surface / secondary surface (minimum) | 7.19:1 | 9.37:1 | Pass |
| ACE muted text (`text-3`) on page / surface / secondary surface (minimum) | 4.81:1 | 4.64:1 | Pass |

The previous white foreground on the coral accent measured 3.37:1 in light mode and 2.79:1 in dark mode. `--color-on-accent: #061014` now provides the foreground in both themes. ACE avatar initials use that dark foreground on coral and gold fills (minimum 5.71:1); white initials use a darker teal fill (minimum 6.45:1). The ACE palette uses darker/stronger accent and muted foregrounds for text, and dark-mode brand text has a separate readable color.

## Manual screen-reader checks

- **Mobile drawer keyboard flow:** manually verified against the production build in Edge at a 390px viewport. Enter opened the drawer and placed focus inside; Tab reached the last control and wrapped to the first; Shift+Tab wrapped back; Escape closed the drawer and restored focus to the menu button. A component regression test also covers the same behavior.
- **Toast announcements:** the app-level `react-hot-toast` `Toaster` is present, and the library's live region uses `role="status"` with polite announcements. Actual spoken output remains unverified: VoiceOver was unavailable while the Mac was locked, and an accessibility tree cannot confirm speech.

## Policy lookup

UCOP's [IMT-1300 Information Technology Accessibility Policy](https://policy.ucop.edu/doc/7000611/imt-1300) is effective March 17, 2026 and adopts WCAG 2.1 AA for IT in its scope, including digital services owned, operated, provided, or made available by UC. UCSD's current [2026–2027 Principal Member Agreement](https://getinvolved.ucsd.edu/_files/orgs/2026-2027%20Principal%20Member%20Agreement.pdf) describes registered student organizations as independent entities, requires compliance with applicable UC/UCSD policies, and contains no express web-accessibility or WCAG clause. UCSD's [registration guidance](https://getinvolved.ucsd.edu/org-toolkit/register/index.html) says the university stopped hosting or supporting RSO websites in Fall 2024. Given the owner-provided facts that this site is independently hosted, has no UCSD branding, and is not linked from UCSD pages, the public documents reviewed do not identify an explicit accessibility-policy flow-down to this site. They also do not contain an RSO-specific carve-out, so this is a document-based finding rather than a binding applicability determination. WCAG 2.1 AA remains the engineering target regardless.
