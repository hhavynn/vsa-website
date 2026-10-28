# Public route manifest, sitemap, and share metadata

Last updated: 2026-10-27

This site is a client-rendered SPA (CRA). Search engines render it, but link unfurlers (Discord, iMessage, Slack, X) read the HTML they fetch **without running JavaScript**, so tags that React injects after mount never reach them. This document describes the public route manifest, the sitemap generated from it at build time, and the per-route metadata (title, description, canonical URL, Open Graph, Twitter) that both the prerendered HTML and the running app use.

This document does not describe ranking strategy, keyword research, or Search Console configuration, and it does not authorize publishing a route that is not ready to be public.

## The manifest: `src/routes/publicRouteSeo.ts`

One list drives everything:

| Consumer | What it reads |
|---|---|
| `sitemap.xml` (build output) | `PUBLIC_ROUTE_SEO` |
| Prerendered HTML shell per route (build output) | `PUBLIC_ROUTE_SEO` |
| Live document tags while a visitor moves between routes | `PUBLIC_ROUTE_SEO` |

Each entry carries the canonical path, the page title, the meta description, and optional sitemap hints (`priority`, `changeFrequency`, share image).

Rules for the manifest:

- Only canonical, indexable public routes. Admin, private and non-indexable URLs live in `NON_INDEXABLE_PUBLIC_PATHS` instead: `/admin`, `/admin/login`, `/profile`, `/points`, `/feedback`, `/signin`.
- Parameterized routes (`/house/:houseSlug`) are never listed. One entry per possible value cannot be enumerated, so they stay out of the sitemap and carry no canonical URL.
- Aliases (`/house-system`), redirects (`/signin`) and deep links are not listed.
- The discoverability decision for each route (where it is linked from) lives in `src/routes/publicRouteInventory.ts`. `src/routes/publicRouteSeo.test.ts` fails if the two drift apart.

## Adding a public route

1. Add the route to `src/routes/index.tsx`.
2. Record its discoverability decision in `src/routes/publicRouteInventory.ts`.
3. Add it to `PUBLIC_ROUTE_SEO` in `src/routes/publicRouteSeo.ts` with a unique title and description, unless it must stay out of the sitemap — in which case add it to `NON_INDEXABLE_PUBLIC_PATHS` and to the `Disallow` list in `public/robots.txt`.
4. Remove the page's static `<PageTitle title="..." />` prop. The manifest is the source of truth; a page keeps the prop only when its title is genuinely dynamic (a House year, the current VCN show).

## What the build writes

`npm run build` runs `react-scripts build`, then the `postbuild` script `scripts/generate-seo-assets.ts`, which writes into `build/`:

| File | Purpose |
|---|---|
| `sitemap.xml` | The indexable public routes, with absolute URLs. Deterministic: no build timestamp, so rebuilding does not churn the file. |
| `index.html` | The prerendered home page (the CRA shell plus the home route's tags). |
| `<route>/index.html` | One prerendered shell per manifest route, e.g. `build/events/index.html`. Vercel serves the static file before the SPA rewrite, so `/events` returns route-specific tags. |
| `spa.html` | The neutral shell for deep links with no prerendered page of their own. It carries no canonical URL on purpose: the home page's canonical would tell crawlers to drop those pages. |

`vercel.json` rewrites every unmatched path to `/spa.html` (previously `/index.html`), and pins `buildCommand` to `npm run build` so the assets are always generated. The local Docker image follows the same rule in `nginx.conf`.

## Live metadata

`src/components/common/PageTitle.tsx` applies the manifest's tags to the live document on every route change: `document.title`, the meta description, `link[rel="canonical"]`, the `og:*` and `twitter:*` tags, and `robots` (`noindex, nofollow`) for the non-indexable paths. It reads the current path with `useLocation()`, so a client-side navigation updates the tags as well.

Routes the manifest does not own (admin pages, parameterized House pages) get an accurate title and the site description, no canonical URL, and no `noindex` unless they are on the non-indexable list.

## robots.txt

`public/robots.txt` disallows `/admin`, `/profile`, `/points` and `/feedback`, and points at the sitemap:

```
Sitemap: https://www.vsaatucsd.com/sitemap.xml
```

`src/routes/publicRouteSeo.test.ts` fails if the two lists drift apart.

## Verification

```bash
npm run build                     # also writes the sitemap and the route shells
cat build/sitemap.xml             # only indexable public routes
grep -c "<title>" build/events/index.html          # 1, never a duplicate
grep "canonical" build/events/index.html
grep -c "canonical" build/spa.html                # 0: the neutral shell has none
npm run check:csp-hashes          # the inline theme script is untouched by the generator
CI=true npm test -- --watchAll=false --testPathPattern="(publicRouteSeo|seo/metadata|PageTitle)"
```

## Known failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `/events` shows the home page's tags | The prerendered shell is missing, so the rewrite served `build/index.html` | Check that `build/events/index.html` exists; `npm run build` must run the `postbuild` step |
| Every deep link 404s | `build/spa.html` was not generated, and the rewrite points at it | The `postbuild` step failed — run `npm run build` and read its output; the build fails loudly when the generator fails |
| A page has two `<title>` tags | A new tag was added to `public/index.html` that the generator does not manage | Add it to the managed tag list in `src/lib/seo/metadata.ts`, or remove it from the shell |
| The sitemap lists a private route | A route was added to the manifest without an exclusion decision | Remove it from `PUBLIC_ROUTE_SEO`; `src/routes/publicRouteSeo.test.ts` pins the exclusion list |
