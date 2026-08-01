# Contributing

This document covers PR mechanics. For everything else a new contributor needs — environment setup, what's off-limits, and why — see the sections below. Where this file points at `AGENTS.md` or a `.claude/skills/` file, that target is authoritative; this file doesn't restate it, so read the link rather than assume this page has the full rule.

## Environment setup

1. Install **Node 22** (`.nvmrc` pins it; `nvm use` in the repo root resolves it).
2. `npm ci` for a clean, reproducible install (matches CI/Docker), or `npm install` for day-to-day work.
3. `cp .env.example .env.local` and fill in `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` from your Supabase project's API settings. The app throws on boot without both.
4. `npm start` → http://localhost:3000.

Useful commands: `npm test`, `npm run lint`, `npm run format`, `npm run build`, `npm run analyze`.

Don't have Supabase credentials yet? Syntactically-valid placeholders (e.g. `https://placeholder.supabase.co` / `placeholder-anon-key`) let the app boot; public pages then render fallback content instead of crashing. Auth-dependent pages (`/profile`, `/points` check-in, `/admin/*`) won't work without real credentials.

For the full from-zero runbook and every known setup trap (CRA script wrapping, the Jest ESM allowlist, the pinned TypeScript version, and more) — load the `vsa-build-and-env` skill, or read `.claude/skills/vsa-build-and-env/SKILL.md` if you're not working in an environment with skills support.

### Platform verification status (issue #326)

**Windows** — verified 2026-07-31 in both Git Bash and PowerShell on Node 22.18.0 / npm 10.9.3: `npm ci` (1419 packages, expected CRA transitive-advisory noise), `npm run lint` (exit 0, clean), `CI=true npm test -- --watchAll=false` (15 suites, 126 tests, all passed), and `npm run build` all succeeded. No workarounds were needed beyond the existing `node ./node_modules/react-scripts/bin/react-scripts.js` script wrapping — which is load-bearing and **must stay** (see below).

**Linux** — continuously verified by CI: `.github/workflows/deploy.yml` runs `npm ci`, `npm run lint`, `CI=true npm test -- --coverage --watchAll=false`, and `npm run build` on `ubuntu-latest` for every PR to `main`.

**macOS** — **not verified.** No team member or CI runner has done a fresh from-zero setup on macOS. If you are the first contributor to do so, please update this note with your Node version, any deviations, and the date.

**Why the npm scripts wrap react-scripts in `node`** — all CRA scripts in `package.json` are `node ./node_modules/react-scripts/bin/react-scripts.js <cmd>` instead of bare `react-scripts <cmd>`. This is load-bearing: reverting to bare `react-scripts build` breaks the Vercel build with a bin-permission error (commits `96ba2eee` and `edd9c161`, "run react-scripts via node to bypass vercel bin permissions"; the `Dockerfile` needs `chmod +x node_modules/.bin/*` for the same reason). Do not "clean up" these scripts without first re-verifying the Vercel deploy path.

### Dev container (alternative setup)

`.devcontainer/devcontainer.json` is an **alternative to local install, not a replacement**. It works in two environments:

- **GitHub Codespaces** — open the repo on GitHub, click "Code → Codespaces → Create codespace." No local installation required; the browser (or VS Code connected to the Codespace) handles everything.
- **VS Code Dev Containers** — clone locally, open in VS Code, and accept the "Reopen in Container" prompt (requires the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) and Docker).

In both cases the container is pinned to **Node 22** (matching `.nvmrc`, the Dockerfile, and CI), runs `npm ci` automatically on creation, forwards **port 3000**, and preinstalls the ESLint, Prettier, and Tailwind CSS VS Code extensions.

**Credentials in a Codespace:** never put Supabase values in `devcontainer.json` — it is committed. Set them as **Codespaces repository secrets** instead: Repo Settings → Secrets and variables → Codespaces → New repository secret, and add `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY`. Codespaces exposes those as environment variables, and Create React App reads `REACT_APP_*` straight from the environment — so no `.env.local` file is needed in a Codespace, and contributors never handle credentials directly.

## Protected domains

Some parts of this codebase are **gated** or **forbidden to touch without an explicit request**, because they hold real production data for 600+ members. In plain terms:

- **Attendance import, points calculation, House membership, and leaderboard calculation** — don't modify this logic unless the task explicitly asks for it. Points are server-authoritative, and there are two coexisting points systems (see `docs/leaderboard-system.md`) — a "simple fix" in one can silently corrupt the other.
- **RLS (Row Level Security) policies, grants, and anything in `supabase/migrations/` or `supabase/functions/`** — these are gated: they need audit-first review, forward-only migrations (never edit a shipped one), and — if RLS/grants/views change — a full RLS verification pass before the PR is mergeable.
- **Auth flows, `src/App.tsx`'s provider hierarchy, `src/routes/index.tsx`, env vars, and `vercel.json`** — also gated.
- **Never create fake events, members, points, standings, application links, or House assignments.** This is production data for real people.

This is a summary, not the full rule set. The authoritative source — full tier classification, the domain playbooks, and *why* each rule exists (with the incident behind it) — is the `vsa-change-control` skill and `AGENTS.md`'s own change-control section. Read those before touching anything on this list.

## Freeze windows

Around **House reveals**, **application-window openings**, and **VCN (Vietnamese Culture Night)**, the affected public surfaces (House pages, application CTAs/links, VCN pages) are frozen — don't change them, even for "safe" refactors or copy tweaks, without explicit owner approval. A broken House page during reveal night or a dead application link at open time is a real-world incident for members, not just a bug.

Before starting any change to House pages, application links, or VCN surfaces, check whether a freeze window is active. The calendar, exact affected surfaces, and the pre-change check live in the `vsa-seasonal-operations` skill.

## Never do this

The full list is in `AGENTS.md` under "Things to never do." A few that trip up new contributors most often:

- Don't run `npm run eject` — it's permanent.
- Don't weaken or broadly modify RLS policies.
- Don't delete database rows or Supabase Storage files (Storage originals are a staging buffer, not disposable — see `vsa-run-and-operate`).
- Don't hardcode application links, and don't expose a closed or future application's URL publicly.
- Don't mutate production Supabase from a PR unless explicitly approved (see below).
- Don't commit secrets, `.env*` files, or generated local files.

## Branch naming

`<scope>/<short-description>`, e.g. `feat/event-end-date`, `fix/house-leaderboard`, `chore/audit-content`. AI-agent branches are prefixed by agent (`claude/…`, `codex/…`, `gemini/…`, `antigravity/…`).

## Dependencies and the lockfile

- **Use `npm ci` for setup and in CI** — it installs from `package-lock.json` exactly and never modifies it. Use `npm install` only when you are intentionally changing which packages are installed.
- **Lockfile changes go in their own commit**, never mixed into a feature diff. A PR that changes `package-lock.json` alongside feature code makes the lockfile diff unreviable.
- **Adding a dependency requires explicit justification** — small, actively maintained, and worth the bundle cost. See issue #300 for bundle-size tracking. `AGENTS.md` prohibits adding heavy dependencies without explicit justification.
- **Never run `npm run eject`** — ejecting CRA is permanent and irreversible (`AGENTS.md`: "Things to never do").
- **Major upgrades of `react-scripts`, `react-query`, `typescript`, or `tailwindcss` are `vsa-change-control` items** (see issue #301) — they are high-risk framework changes and must never happen casually. Follow the `vsa-change-control` gating path documented in `AGENTS.md`.
- **Dependabot** (issue #230, not yet merged) will open automated dependency-bump PRs when that work lands. Merging a Dependabot PR is a judgement call — read the diff, check the changelog, and verify CI passes before merging.

## Licensing expectations

Code contributions to this repository are contributed under the MIT License for
the software code. Do not commit third-party assets, member photographs, or other
non-code content unless you have confirmed the rights needed for this public
repository and documented any license or usage limits clearly in the PR.

## Dual points systems

There are **two coexisting points/attendance systems** in this codebase: the public leaderboard (`member_event_attendance` + `events` + `academic_terms`) and authenticated check-ins (`event_attendance` + `user_points`). This is a known, deliberate (if temporary) split — consolidating them is documented future work, not a bug to "fix" in passing. Read `docs/leaderboard-system.md` before touching either one.

## PR title format

All PR titles must use Conventional Commit style:

`type(scope optional): short description`

Allowed types:

`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`, `ci`, `build`, `revert`, `security`

Examples:

- `feat: add public calendar filters`
- `fix: correct leaderboard year selector`
- `chore: update GitHub workflows`
- `docs: update admin runbook`
- `ci: add PR title check`

## Pull request expectations

Keep PRs scoped and reviewable.

Before opening a PR, include proportional verification results. The definitive ownership model, final-gate matrix, acceptable warnings, manual-QA runbooks, and golden-test inventory live in `.claude/skills/vsa-validation-and-qa/SKILL.md`. Run `git diff --check` for every change; run lint, build, broader tests, security checks, and manual QA only when the changed artifacts and risk make them relevant. Do not repeat a successful check unless a later semantic change invalidated its evidence.

Do not commit secrets, generated local files, Graphify output, local settings, or unrelated changes.

Do not mutate production Supabase from a PR unless explicitly approved.
