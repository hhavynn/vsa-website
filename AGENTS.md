# AGENTS.md

Single source of truth for AI coding agents working in this repo.

---

## Project overview

Vietnamese Student Association (VSA) at UCSD member website. This is a production-used site serving 600+ members. Members sign in to check in to events, track points, and view house standings. Admins manage events, gallery, cabinet, VCN archives, house programs, and site content. There is also a public-facing side (home, events, leaderboard, cabinet, gallery) that degrades gracefully when Supabase is unavailable.

**Tech stack:** Create React App · TypeScript · React 18 · React Router v6 · React Query v3 · Supabase (Auth + PostgreSQL + Storage) · Tailwind CSS v3 · Framer Motion · react-hook-form + Zod · react-hot-toast

**Deployed to:** Vercel (static build via `@vercel/static-build`, SPA fallback in `vercel.json`)

---

## Current project phase

This is a mature production site. Prioritize stabilization, safety, admin workflows, content correctness, and polish. Avoid broad or speculative feature work; prefer small, focused PRs with explicit acceptance criteria.

---

## Startup and workspace behavior

- Run `git status --short --branch` before editing. Stop when unexpected dirty files are present.
- `.gitignore` may contain local setup changes; do not stage it unless the user explicitly requests that change.
- Work one PR at a time. Do not create temporary folders, worktrees, duplicate repositories, or sibling folders unless explicitly requested.
- Fetch before branching. If local `main` is behind and local setup files prevent pulling, create the feature branch from freshly fetched `origin/main`.
- Never use destructive Git commands such as `git reset --hard` or `git clean -fd` without explicit authorization.

---

## Repo structure

```
src/
  App.tsx                        Entry point; sets up provider hierarchy
  routes/index.tsx               All route definitions (lazy-loaded pages)
  routes/ProtectedRoute.tsx      Auth gate
  routes/AdminRoute.tsx          Admin flag gate
  pages/                         One file per page/route; thin orchestration layer
    Admin/                       Admin-only pages
  components/
    layout/                      Layout, Header, Footer, navigation shell
    layout/navigation/           Header sub-components (NavLinks, MobileDrawer, UserMenu…)
    features/                    Feature-grouped components (admin/, auth/, events/, points/…)
    common/                      Shared utilities (ErrorBoundary, Modal, PageLoader, Skeleton…)
    ui/                          Base primitives (Button, Input, Card, Badge, Label)
  context/                       React contexts (AuthContext, ThemeContext, PointsContext, SiteSettingsContext)
  data/
    errors.ts                    Custom error classes + withErrorHandling() wrapper
    repos/                       Repository singletons — ALL Supabase queries live here
  lib/
    supabase.ts                  Supabase singleton client
    utils.ts                     cn() helper (clsx + tailwind-merge)
  types/
    database.ts                  Generated-style DB types + domain enums
    index.ts                     Additional shared TypeScript types
  schemas/index.ts               Zod schemas for forms and API validation
  constants/                     Enum-like config (eventTypes, houses, cabinetOptions)
  config/publicFallbackContent.ts Static fallback data used in degraded mode
  utils/                         Pure utility functions (date helpers, slug utils, etc.)
  styles/ace.css                 Feature-specific CSS (ACE program)
supabase/
  config.toml
  migrations/                    SQL migration files (source of truth for schema)
  functions/                     Supabase Edge Functions
schema.sql                       Full DB schema snapshot (reference only)
tailwind.config.js               Brand tokens, type scale, spacing grid
vercel.json                      Static-build config + SPA fallback routes
```

---

## Dev setup

```bash
# 1. Install dependencies
npm install

# 2. Create local env file
cp env.example .env.local
# Fill in:
#   REACT_APP_SUPABASE_URL=
#   REACT_APP_SUPABASE_ANON_KEY=
#   REACT_APP_OPENAI_API_KEY=   # optional — AI assistant feature

# 3. Start dev server
npm start          # http://localhost:3000

# 4. Build for production
npm run build
```

Other useful commands:

```bash
npm test                                        # Jest + React Testing Library (watch mode)
npm test -- --testPathPattern=<file>            # Run a single test file
npm run lint                                    # ESLint over src/**/*.{ts,tsx}
npm run format                                  # Prettier over src/**/*.{ts,tsx}
npm run analyze                                 # Bundle analysis (source-map-explorer)
```

---

## Coding conventions

### TypeScript
- Strict mode is on. Never use `any`; reach for `unknown` + type narrowing instead.
- Domain enums are string unions defined in `src/types/database.ts` (e.g. `SiteEventType`, `ApplicationStatus`, `ApplicationKey`). Use those types rather than raw strings.
- Types for the DB schema live in `src/types/database.ts`. Update that file when the schema changes.

### Components
- Pages in `src/pages/` are thin orchestration layers. Heavy UI logic goes in `src/components/features/<domain>/`.
- Base UI atoms (Button, Input, Card, Badge) live in `src/components/ui/`. Use them; don't reinvent.
- Use the `cn()` helper from `src/lib/utils.ts` for conditional class names — never raw string concatenation.
- Components use named exports, not default exports, except for lazy-loaded page modules (CRA requires a default export there). Match the export style of the existing file in the same directory.
- All pages are lazy-loaded in `src/routes/index.tsx` via `React.lazy()` + `Suspense`.

### Styling
- **Tailwind only** — no inline `style` props, no CSS modules, no new `.css` files unless truly unavoidable (see `src/styles/ace.css` as the precedent for that exception).
- Use semantic color tokens from `tailwind.config.js`: `text-text-primary`, `bg-surface`, `bg-surface2`, `border-border-strong`. Never hardcode `text-gray-900` / `bg-white` pairs.
- Dark mode is `class`-based (set on `<html>` by `ThemeContext`). Use `dark:` variants only when the semantic tokens are insufficient.
- Prefer `brand-600` (light mode) / `brand-400` (dark mode) for primary interactive elements.
- Animation: use Framer Motion for enter/exit transitions; use Tailwind `animate-fade-in` for simple opacity fades.

### Data layer
- **All Supabase queries go through a repository in `src/data/repos/`.** Import the exported singleton (e.g. `eventsRepository`), never call `supabase` directly from a component or page.
- Wrap async repo operations with `withErrorHandling()` from `src/data/errors.ts`.
- Use `react-query` (`useQuery`, `useMutation`) in components to call repositories — not raw `useEffect` + `useState` patterns.

### Forms
- react-hook-form + Zod schemas from `src/schemas/index.ts`.
- Use `@hookform/resolvers/zod` for the resolver.
- Add new schemas to `src/schemas/index.ts`, not inline in component files.

### Error handling
- Throw typed errors (`DatabaseError`, `ValidationError`, `NotFoundError`, etc.) from repos.
- Surface errors to users via `react-hot-toast` or the `PageError` / `ContentUnavailableState` components.
- Never swallow errors silently.

### Degraded mode
- The app must run without Supabase (network failure, outage). Use `isSupabaseUnavailable()` from `src/utils/isSupabaseUnavailable.ts` and render `ContentUnavailableState` or fall back to `src/config/publicFallbackContent.ts` where appropriate.

---

## Key files

| File | Why it matters |
|---|---|
| `src/App.tsx` | Provider hierarchy — touch with care |
| `src/routes/index.tsx` | All routes; add new pages here |
| `src/types/database.ts` | Source of truth for DB types and domain enums |
| `src/data/errors.ts` | Error classes and `withErrorHandling` — used everywhere |
| `src/lib/supabase.ts` | Supabase singleton — don't create new clients |
| `src/context/AuthContext.tsx` | Auth state + `useAdmin()` hook |
| `src/schemas/index.ts` | All Zod schemas |
| `src/config/publicFallbackContent.ts` | Static fallback data for degraded mode |
| `tailwind.config.js` | Brand tokens — change colors here, nowhere else |
| `vercel.json` | Deployment config and SPA fallback routes |
| `supabase/migrations/` | Source of truth for schema changes |

---

## Testing

```bash
npm run build
npm run lint
CI=true npm test -- --watchAll=false
```

Existing jsdom, ThemeProvider, and Framer Motion console warnings are acceptable when the test command exits successfully.

Tests live alongside the source files they test (`*.test.ts` / `*.test.tsx`). `src/setupTests.ts` configures jest-dom matchers.

Current test files:
- `src/App.test.tsx`
- `src/data/legacyHouseArchive.test.ts`
- `src/utils/seasonalState.test.ts`

---

## Codex VSA playbook workflow

Codex should use the VSA playbook roster below when the user requests a domain-specific agent or playbook. The existing files in `.claude/agents/` are the source-of-truth domain playbooks even though Codex does not load them as native Claude Code subagents.

- When the user says “use `vsa-house-system`” (or another roster name), read `.claude/agents/<name>.md` first and follow its scope and constraints.
- Spawn or run multiple subagents only when the user explicitly asks for them, then consolidate their findings into one coherent result.
- Protected or risky domains are audit-first: inspect and report root cause and risk before editing.
- See `docs/codex-subagent-workflow.md` for invocation examples and `docs/codex-subagent-task-template.md` for a copy-paste task prompt.

### VSA playbook roster

- `vsa-architecture-guardian` — cross-cutting architecture, route/data-flow safety, and PR risk; audit/review-only.
- `vsa-public-content` — public pages, launch copy, programs, and degraded-mode content.
- `vsa-admin-workflows` — admin navigation, dashboards, CRUD flows, and admin UX.
- `vsa-events-gallery` — events, recaps, gallery, calendar controls, and publishing behavior.
- `vsa-points-attendance-guardian` — attendance, points, leaderboard, merge, and lookup behavior; audit-first/read-only.
- `vsa-house-system` — House pages, archives, profiles, routing, and standings display.
- `vsa-cabinet-leadership` — cabinet pages, archives, admin, and current leadership content.
- `vsa-ai-knowledge` — Ask VSA, AI knowledge content, admin UI, and Edge Function privacy.
- `vsa-applications-forms` — application windows, statuses, and public form-link safety.
- `vsa-storage-egress` — Storage URL and egress audits; dry-run/review-only migration work.
- `vsa-testing-qa` — build, lint, tests, route QA, and regression checks.
- `vsa-docs-acceptance` — runbooks, acceptance criteria, PR checklists, and contributor docs.

### Domain-critical facts

- Current 2026–2027 president fallback/copy should use April Pham and Havyn Nguyen.
- 2026–2027 Houses are placeholders only; do not invent Houses.
- 2025–2026 Houses are Bowser, Donkey Kong, Boo, and Toad.
- 2023–2024 Houses are drinks/treats, not designer Houses. Designer Houses belong to 2019–2020; Mario Houses belong only to 2025–2026.
- Closed or future application URLs must not be exposed publicly.
- Application keys: `ace_application`, `house_fall`, `house_winter`, `house_spring`, `intern_application`, `cabinet_application`, `vcn_stage_ninja_interest`, `vcn_props_team_interest`, `wnc_team_form`.

---

## PR / branch conventions

- **Never commit directly to `main`.** All changes go on a feature branch merged via PR.
- **Stop if there are unexpected uncommitted changes in the working tree.** Don't overwrite in-progress work.
- Branch names: `<scope>/<short-description>` (e.g. `feat/event-end-date`, `fix/house-leaderboard`, `chore/audit-content`). AI-generated branches are often prefixed `claude/` or `codex/`.
- PRs are small and focused — one feature or fix per PR. No bundled unrelated changes.
- There is no automated CI test gate; run lint and build locally before pushing.

```bash
git checkout -b feat/my-feature
# make changes
npm run lint && npm run build    # sanity check
git push -u origin feat/my-feature
# provide a manual PR title and body unless PR creation was explicitly requested
```

---

## Things to never do

- **Don't commit to `main`** — always use a branch + PR.
- **Don't commit secrets or environment files.**
- **Don't touch `supabase/.temp/cli-latest`.**
- **Don't broadly modify or weaken RLS.**
- **Don't delete database rows or Supabase Storage files.**
- **Don't expose private member data, emails, check-in codes, payment logs, import notes, or admin notes publicly.**
- **Don't modify attendance import, points calculation, House membership, or leaderboard calculation unless explicitly requested.**
- **Don't create fake events, members, points, standings, application links, or House assignments.**
- **Don't add heavy dependencies without explicit justification.**
- **Don't query Supabase from a component directly.** Use the repo layer in `src/data/repos/`.
- **Don't create a new Supabase client instance.** Import `supabase` from `src/lib/supabase.ts`.
- **Don't hardcode color classes** (`text-gray-*`, `bg-white`, `bg-gray-900`). Use semantic tokens from `tailwind.config.js`.
- **Don't add inline `style` props** for anything Tailwind can handle.
- **Don't write comments that explain what the code does.** Only add a comment when the *why* is non-obvious (hidden constraint, workaround, subtle invariant).
- **Don't run `npm run eject`.** Ejecting CRA is permanent.
- **Don't edit `schema.sql` directly.** It's a reference snapshot; schema changes belong in `supabase/migrations/`.
- **Don't add OpenAI API calls** outside of `src/components/features/ai/`.
- **Don't touch `src/react-app-env.d.ts`** — CRA auto-generates it.
- **Don't add error handling for code paths that can't fail.** Only validate at system boundaries (user input, external API responses).
- **Don't use `any`** — use `unknown` with type narrowing, or the existing domain types from `src/types/`.

---

## PR and final response expectations

Report the summary, files changed, safety confirmations, verification results, manual QA, pushed branch, and manual PR title/body. If `.gitignore` had pre-existing local changes, explicitly confirm it was preserved and left uncommitted.
