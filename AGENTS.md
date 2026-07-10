# AGENTS.md

Single source of truth for AI coding agents working in this repo.

---

## Project overview

Vietnamese Student Association (VSA) at UCSD member website. This is a production-used site serving 600+ members. Members sign in to check in to events, track points, and view house standings. Admins manage events, gallery, cabinet, VCN archives, house programs, and site content. There is also a public-facing side (home, events, leaderboard, cabinet, gallery) that degrades gracefully when Supabase is unavailable.

**Tech stack:** Create React App · TypeScript · React 18 · React Router v6 · React Query v3 · Supabase (Auth + PostgreSQL + Storage) · Tailwind CSS v3 · Framer Motion · react-hook-form + Zod · react-hot-toast

**Deployed to:** Vercel (zero-config CRA build, SPA fallback in `vercel.json`)

---

## Current project phase

This is a mature production site. Prioritize stabilization, safety, admin workflows, content correctness, and polish. Avoid broad or speculative feature work; prefer small, focused PRs with explicit acceptance criteria.

---

## Agent operating model

This repo runs a self-orchestrating workflow so the user can speak in plain, messy, product language (*"the events page lowkey looks ass on mobile fix it"*) without naming tools or process. **The repository supplies the process — the user should never have to name Graphify, Repomix, Superpowers, Impeccable, a specific skill, a domain playbook, tests, or a risk tier.** You infer all of that.

**For every non-trivial task, follow `docs/ai/AGENTIC-ENGINEERING-WORKFLOW.md`** — the one canonical, detailed orchestration workflow. This `AGENTS.md` is the authoritative governance contract (protected domains, never-do list, branch/PR rules, domain facts); the workflow doc is the authoritative *how*. Do not duplicate the workflow here.

The mandatory shape, scaled to risk:

1. Read the governing instructions and inspect the worktree.
2. Translate the request into an engineering brief (outcome, actors, surface, data, backend/migration, privacy, mobile/a11y, seasonal, tests).
3. **Classify risk.** Low (copy/styling/docs) → lightweight, no ceremony. Medium (new route/component/repo method/form) → normal discovery, tests, review. High (auth, RLS, grants, migrations, points, attendance, House membership, leaderboard, applications, check-in, storage policies, private data, production) → owning skill + `vsa-change-control`, architecture review, privacy review, stronger validation, adversarial review, production safeguards.
4. Load only the **owning** project skill(s) and relevant **playbook(s)** — never all 16 skills, never every playbook. Skills (`.claude/skills/`) are knowledge; playbooks (`.claude/agents/`) are domain personas — distinct mechanisms.
5. **Graphify** for structural questions before broad grep → **Repomix** (`npx repomix`) for a narrow slice once scope is known → **direct source reads** to verify.
6. Use **Superpowers** methodology (plugin installed; workflow doc §6 summarizes it) for meaningful work; **Impeccable** for meaningful UI (never replacing the design system).
7. Implement in reviewable slices → validate proportionally (workflow §13) → adversarial review (§14) → report **exact** evidence (never conflate "read a playbook" with "invoked a subagent," or "wrote a migration" with "applied one").

**Autonomy:** once asked for a feature/fix, proceed through the whole task; don't stop after audit/plan or repeatedly ask "should I implement this?" Pause only for destructive/irreversible/production actions, missing secrets, gated domains (`vsa-change-control`), or genuinely ambiguous intent. For ordinary ambiguity, assume, record it, and continue.

Harness adapters: Claude → `CLAUDE.md`; Gemini → `GEMINI.md`; Antigravity → `ANTIGRAVITY.md`; Codex inherits this `AGENTS.md`. All point back to the canonical workflow.

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
tailwind.config.js               Brand tokens, type scale, spacing grid
vercel.json                      Static-build config + SPA fallback routes
Dockerfile / docker-compose.yml  Optional local containerized run (nginx-served build)
```

---

## Dev setup

```bash
# 1. Install dependencies
npm install

# 2. Create local env file
cp .env.example .env.local
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
| `src/context/AuthContext.tsx` | Auth session state |
| `src/hooks/useAdmin.ts` | Admin-status lookup used by admin route gating |
| `src/schemas/index.ts` | All Zod schemas |
| `src/config/publicFallbackContent.ts` | Static fallback data for degraded mode |
| `tailwind.config.js` | Brand tokens — change colors here, nowhere else |
| `vercel.json` | Deployment config and SPA fallback routes |
| `supabase/migrations/` | Source of truth for schema changes |

---

## Testing

The canonical validation runbook — evidence ownership, proportional final gates, the acceptable-warnings rule, per-change-type manual QA, and the golden-test inventory — is **`.claude/skills/vsa-validation-and-qa/SKILL.md`**. It owns the definitive matrix. For application/runtime changes, the common final-gate command set is:

```bash
npm run lint
npm run build
CI=true npm test -- --watchAll=false
```

Do not run that trio automatically for documentation-only, agent-configuration, or isolated non-runtime changes. Use the targeted documentation/reference/registry checks assigned by the canonical ownership model. Every new verification run must answer a new question.

Existing jsdom, ThemeProvider, and Framer Motion console warnings are acceptable when the test command exits successfully.

Tests live alongside the source files they test (`*.test.ts` / `*.test.tsx`); `src/setupTests.ts` configures jest-dom matchers. The suite grows over time, so this file does not enumerate it — list the current tests with `find src -name "*.test.ts*" | sort`. The authoritative inventory of what each test certifies is `vsa-validation-and-qa` §2.

---

## Graphify: Query-First Workflow

Graphify indexes the codebase into a navigable graph. Run it before reading files speculatively — it keeps context focused and token usage low.

```bash
./scripts/graphify-run query "<question>"           # Architecture and dependency questions
./scripts/graphify-run path "<source>" "<target>"   # Trace relationships between files or symbols
./scripts/graphify-run explain "<file or symbol>"   # Understand a file's role in the graph
./scripts/graphify-run hook status                  # Check git hook is active
graphify . --update                                 # Refresh the graph if stale (interactive only)
```

**PATH note:** Use `./scripts/graphify-run` instead of bare `graphify` in subagents and hooks. Subagent PATH typically excludes `~/.local/bin` where Graphify installs; the wrapper resolves the binary across all common install locations.

Check `graphify-out/GRAPH_REPORT.md` for initial orientation when entering an unfamiliar part of the codebase. `graphify-out/cost.json` and `graphify-out/cache/` are local only — never commit them. Keep graph-output updates in a separate `chore: update graphify graph` commit rather than mixing into feature PRs.

If Graphify is unavailable, continue with targeted `grep`/`find` and report the blocker. Do not install or rebuild Graphify inside a feature PR unless the task explicitly asks. Install with `uv tool install graphifyy` or `pipx install graphifyy`.

---

## Codex VSA playbook workflow

Codex inherits this `AGENTS.md` as its contract and follows `docs/ai/AGENTIC-ENGINEERING-WORKFLOW.md` for the full orchestration (risk classification, skill/playbook routing, Graphify → Repomix → source, validation, adversarial review). Codex automatically infers the owning skills and domain playbooks from the natural-language request; the user never needs to name them. The files in `.claude/agents/` are the source-of-truth domain playbooks even though Codex does not load them as Claude Code subagents — read and apply them using Codex's own delegation mechanics, and never claim a Claude-native subagent was invoked.

- Delegate bounded work automatically when specialization, safety, independent review, or genuinely parallel non-overlapping concerns materially improve the result. Do not delegate tiny or single-concern work ceremonially.
- Define concern and file-ownership boundaries, prevent overlapping writes, wait for relevant specialists, reconcile findings against repository evidence, and retain responsibility for integration and final verification.
- If native delegation is unavailable, execute the same playbooks sequentially as isolated specialist passes; never skip required architecture, privacy, security, or domain review because the harness lacks subagents.
- Protected or risky domains are audit-first: inspect and report root cause and risk before editing.
- See `docs/codex-subagent-workflow.md` for Codex mechanics and `docs/codex-subagent-task-template.md` for the parent agent's internal delegation contract.

### VSA playbook roster

The canonical roster — every playbook with its edit/audit mode and one-line use case — is **`.claude/agents/README.md`**. Do not maintain a second copy here: read that registry, then the matching `.claude/agents/<name>.md` file, to route. The two read-only guardians are `vsa-architecture-guardian` and `vsa-points-attendance-guardian` (audit-first; they identify risk and recommend scoped follow-ups, never broad edits).

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
- CI runs lint, tests, build, CodeQL, and Trivy on every PR to `main` (`.github/workflows/deploy.yml`), but it is **not a protected merge gate** while `main` has no branch protection — nothing mechanically blocks merging a red PR. Local verification before pushing is therefore the real gate; treat a red CI run as blocking by convention. (Re-check with `gh api repos/hhavynn/vsa-website/branches/main/protection` — a 404 means still unprotected.)

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
- **Don't add OpenAI API calls** outside of `src/components/features/ai/`.
- **Don't touch `src/react-app-env.d.ts`** — CRA auto-generates it.
- **Don't add error handling for code paths that can't fail.** Only validate at system boundaries (user input, external API responses).
- **Don't use `any`** — use `unknown` with type narrowing, or the existing domain types from `src/types/`.

---

## PR and final response expectations

Report the summary, files changed, safety confirmations, verification results, manual QA, pushed branch, and manual PR title/body. If `.gitignore` had pre-existing local changes, explicitly confirm it was preserved and left uncommitted.
