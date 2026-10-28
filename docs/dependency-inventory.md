# Direct dependency inventory

Applies to every entry in `package.json` `dependencies` / `devDependencies` as of
October 26, 2026 (issue #349 — audit for dependency bloat and slop squatting).
When a dependency is added or removed, update this file in the same PR and
record the registry check in the "provenance" table — that is the anti-slop
control: every name is verified to resolve to the upstream project it claims to
be, with an established maintainer history, before it is allowed into the
dependency tree.

Classification method: every import site for every package was enumerated with
`grep` over `src/`, `scripts/`, `supabase/` and `.github/`, counting static and
dynamic imports (including type-only re-exports), not assumed. Build-time
requirements (CRA's ownership of its own config, Deno's use of `@types/node`,
Tailwind's postcss plugin chain) were verified against the real build, not
depcheck — depcheck-style tools false-positive on exactly these cases.

## `dependencies` — runtime-required (bundled into `.js` produced from `src/`)

| Package | Why it is here (what it provides that is not worth writing) |
| --- | --- |
| `@hookform/resolvers` | `zodResolver` glues `react-hook-form` to `zod` in the signin and feedback forms plus admin form shells. Writing a bespoke resolver layer for four forms is not worth it. |
| `@supabase/supabase-js` | The only database/auth/storage client; every repository in `src/data/repos/` reaches Supabase through the `src/lib/supabase.ts` singleton. Also used by `scripts/verify-rls-security.mjs`. |
| `clsx` | `cn()` in `src/lib/utils.ts` merges conditional class names app-wide. Tiny (239 B) and canonical. |
| `date-fns` | Date math and formatting in `src/lib/dateOnly.ts`, event cards, `MyVSACard`, photo-request tab and program content. Replacing the handful of used helpers with bespoke code would duplicate known-tricky calendar logic (timezone, windows) — kept deliberately. |
| `framer-motion` | Layout, entrance and reduced-motion-aware animation across 30+ components, incl. the app-root `MotionConfig` safety net. Heavy, and the only package whose bundle cost is knowingly paid for continuous UX value — flagged again in issue #301 as a potential `motion` migration. |
| `react`, `react-dom` | Framework. |
| `react-dropzone` | Admin image upload (Members, ACE families) needs drag-drop + file-type rules; hand-rolling a compliant dropzone is not worth it. |
| `react-hook-form` | Form state for signin, feedback, photo request and admin ops forms (`useAdminForm`). |
| `react-hot-toast` | Project-wide toast surface (60+ call sites) with a11y-safe defaults. |
| `react-icons` | Icon set for events/gallery/UVSA/admin surfaces, imported per-set (e.g. `react-icons/fa`) with named icons only. Webpack does not fully eliminate unused icons from every imported set, so import and bundle discipline matters. Lazy-boundary work is proposed in #581. |
| `react-query` | Server-state hooks (caching, invalidations) for the whole data layer. v3 — the project's long-term data API; upgrades are a #301 change-control item. |
| `react-router-dom` | Routing for every surface (data routerless BrowserRouter usage). |
| `tailwind-merge` | The other half of `cn()`: resolves Tailwind class conflicts so later utilities win. Can't be hand-trivially replicated. |
| `web-vitals` | In `src/reportWebVitals.ts`, referenced via a **dynamic** import behind a handler that no caller currently passes — so nothing from it ships into the initial load. Kept as the scaffold for field-vitals wiring (measured in `vsa-diagnostics-and-measurement` §6); remove together with that scaffold if the analytics decision says no. |
| `zod` | Shared schemas in `src/schemas/index.ts` (forms, admin payloads, application-link parsing) driving RHF validation. v3 API chosen for `react-scripts` TS compatibility. |

## `devDependencies` — development-required (never bundled)

| Package | Why it is here |
| --- | --- |
| `@testing-library/jest-dom` | jest matchers registered in `src/setupTests.ts` for DOM assertions in every component test. Moved from `dependencies` in #349. |
| `@testing-library/react` | React component testing (122 import sites — all test files). Moved from `dependencies`. |
| `@testing-library/user-event` | Realistic interaction simulation in tests (34 import sites). Moved from `dependencies`. |
| `@types/jest` | Types for test files so `tsc` accepts jest globals. Moved from `dependencies`. |
| `@types/node` | Type definitions consumed by Deno's `typecheck:edge` (Deno reads project `@types/node`) and `tsx` script authoring. Moved from `dependencies`. |
| `@types/react`, `@types/react-dom` | Types used by the React 18 type checking the project runs in dev; no runtime byte. Moved from `dependencies`. |
| `autoprefixer` | PostCSS plugin chain in `postcss.config.js` below Tailwind. Required for `npm run build`. |
| `postcss` | Same chain, declared explicitly as `postcss.config.js` is a project config. |
| `prettier` | `npm run format`. |
| `react-scripts` | The CRA build/test host; every npm script drives it. |
| `sharp` | `audit:image-exif` and the image-migration pipelines. |
| `source-map-explorer` | `npm run analyze*` bundle composition. |
| `tailwindcss` | Tailwind v3 JIT via the project `postcss.config.js`. Major upgrades are change-control items (#301). |
| `tsx` | Runs the TS maintenance/audit scripts (`migrate:images:*`, `audit:storage-content`, `check:content-links`). |
| `typescript` | Satisfies `react-scripts`' TypeScript peer (which gates CRA's TS plugin), the editor and stylelint-free `npm run lint`. `npm run typecheck` pins TS 5.6.3 via `npx` instead — see `docs/typechecking.md`. Moved out of `dependencies` in #349: nothing imports it at runtime. |

## Removed

| Package | Evidence |
| --- | --- |
| `@supabase/ssr` | Zero import sites anywhere in the repo (src, scripts, supabase functions, config, vercel). The project's Supabase usage is browser-only through `src/lib/supabase.ts`; `@supabase/ssr` cookie-session helpers had no consumer. Removed in #349 rather than waiting for a drift-into-production. |

## Uncertain / flagged (not changed)

- `dotenv` — imports appear in two ad-hoc scripts (`src/scripts/migrateCabinet.ts`, `src/scripts/normalizeYears.ts`) that rely on `dotenv` resolving *through `react-scripts`' dependency tree*, but `dotenv` is not a direct dependency. Neither script is wired to any npm script. Left untouched here (removing scripts is out of scope, adding a dependency for dead tooling deserved scrutiny); flagged so the next person either wires them properly or archives them.
- `web-vitals` — see row above; its presence is a scaffold decision, not a sloppy leftover.

## Provenance (anti-slop-squatting review, registry check on 2026-10-26)

The original 25 names were checked on October 26. The eight existing development
dependencies were checked on October 27. Registry repository, current maintainers,
and package creation dates were checked; the maintainer names below are a
spot-check, not proof of uninterrupted ownership history.

| Package | Registry identity | Maintainers (spot-check) |
| --- | --- | --- |
| `@hookform/resolvers` | `react-hook-form/resolvers` GitHub | bluebill1049, kotarella1110, jorisre |
| `@supabase/supabase-js` | `supabase/supabase-js` | etienne_supa, mandarini |
| `@supabase/ssr` (removed) | `supabase/ssr` | (supabase org) |
| `@testing-library/*` ×3 | `testing-library/*` repos | testing-library-bot, kentcdodds, eps1lon, … |
| `@types/jest` | `DefinitelyTyped/DefinitelyTyped` | types |
| `@types/node` | `DefinitelyTyped/DefinitelyTyped` | types |
| `@types/react`, `@types/react-dom` | `DefinitelyTyped/DefinitelyTyped` | types |
| `autoprefixer` | `postcss/autoprefixer` | ai |
| `clsx` | `lukeed/clsx` | lukeed |
| `date-fns` | `date-fns/date-fns` | kossnocorp |
| `framer-motion` | `motiondivision/motion` | nvh, popmotion |
| `postcss` | `postcss/postcss` | ai |
| `prettier` | `prettier/prettier` | jlongster, lydell, thorn0, … |
| `react`, `react-dom` | `react/react` (Meta) | fb, react-bot |
| `react-dropzone` | `react-dropzone/react-dropzone` | rolandjitsu, okonet, rxmarbles |
| `react-hook-form` | `react-hook-form/react-hook-form` | bluebill1049 |
| `react-hot-toast` | `timolins/react-hot-toast` | timolins |
| `react-icons` | `react-icons/react-icons` | nwwells, tusbar, gorangajic, kamijin_fanta |
| `react-query` | `tannerlinsley/react-query` (upstream name for v3; the package lives at `@tanstack/react-query` from v4) | tannerlinsley, tkdodo |
| `react-router-dom` | `remix-run/react-router` | brophdawg11, mjackson |
| `react-scripts` | `facebook/create-react-app` | fb, gaearon, timer, … |
| `sharp` | `lovell/sharp` | lovell |
| `source-map-explorer` | `danvk/source-map-explorer` | danvk, hypercubed, nikolay-borzov |
| `tailwindcss` | `tailwindlabs/tailwindcss` | adamwathan, reinink, malfaitrobin |
| `tailwind-merge` | `dcastil/tailwind-merge` | dcastil (aka dcas) |
| `tsx` | `privatenumber/tsx` | hirokiosame |
| `typescript` | `microsoft/TypeScript` | microsoft1es, typescript-bot, jakebailey |
| `web-vitals` | `GoogleChrome/web-vitals` | philipwalton, tunetheweb (Google) |
| `zod` | `colinhacks/zod` | colinhacks |

For the future: when adding a new dependency, verify the same way
(`https://registry.npmjs.org/<name>/latest` → `repository.url`, `maintainers`,
and published-package-registration timeline), record the line above, and see the
agent-facing rule in `.github/CONTRIBUTING.md` (§ Dependencies and the
lockfile).
