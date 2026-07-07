---
name: vsa-validation-and-qa
description: Load before claiming any VSA-website change is "done" or "verified", when deciding whether a change needs tests, when adding or modifying Jest tests, when a reviewer asks for acceptance criteria or manual QA evidence, or when routing to the right QA checklist (RLS, leaderboard, accessibility, route QA, degraded mode). Provides the evidence bar (exact lint/build/test commands + acceptable-warning rule), the golden test inventory and what it protects, how to add a test in this CRA/Jest setup, when tests are mandatory vs optional, and manual-QA runbooks for the riskiest change types.
---

# VSA Validation & QA

**What this skill is for.** This is the definition of "verified" for the VSA website. It tells you exactly what evidence a change needs before it can be called done: which commands must pass, which warnings are acceptable, which tests exist and what they certify, when new tests are mandatory, and which manual-QA runbook to execute for your change type. The core stance: **"it compiles" is not evidence.** A green `tsc` pass proves only that the types line up — not that the leaderboard is right, the route loads, or the mobile drawer still opens.

**When NOT to use this skill:**

| If you need… | Go to |
|---|---|
| Whether a change is *allowed* at all (protected domains, never-do list, PR conventions) | `vsa-change-control` |
| Diagnosing *why* a build/test/page is failing | `vsa-debugging-playbook` |
| Running diagnostic tooling: `scripts/verify-rls-security.mjs`, bundle analysis, Lighthouse/axe, web-vitals | `vsa-diagnostics-and-measurement` |
| Writing or reviewing RLS policies and migrations themselves | `vsa-supabase-security-reference` |
| Jest/CRA environment breakage (`Unexpected token 'export'`, node version, env setup) | `vsa-build-and-env` |
| Full incident histories behind these rules | `vsa-failure-archaeology` |

Jargon used below — **RLS**: Row Level Security, Postgres per-row access policies (Supabase's authorization layer). **CRA**: Create React App, the build toolchain this site uses (`react-scripts`). **jsdom**: the simulated browser DOM Jest runs tests in. **Degraded mode**: the app's required behavior when Supabase is unreachable — public pages fall back to static content instead of crashing.

---

## 1. The evidence bar

A change is **verified** only when ALL FOUR gates pass. Run gates 1–3 locally, in this order (fastest feedback first):

```bash
npm run lint                          # Gate 1 — ESLint over src/**/*.{ts,tsx}
npm run build                         # Gate 2 — production build (CRA + strict TypeScript)
CI=true npm test -- --watchAll=false  # Gate 3 — full Jest suite, one-shot (no watch mode)
```

Gate 4 is **manual exercise of every affected surface** — actually load the routes you touched (see section 7 for per-change-type runbooks). No command substitutes for this; the automated suite is small and logic-only (section 2) and cannot catch a broken page.

**Acceptable warnings.** AGENTS.md (§ Testing) states the rule exactly:

> "Existing jsdom, ThemeProvider, and Framer Motion console warnings are acceptable when the test command exits successfully."

That is the complete allowlist. Exit code 0 with those warnings = pass. Any *new* warning class, or a nonzero exit, is a failure you must resolve — not annotate away.

**Why local verification is the real gate (as of 2026-07-06):**

- CI *does* run checks: `.github/workflows/deploy.yml` runs `npm run lint`, `CI=true npm test -- --coverage --watchAll=false`, and `npm run build` on `pull_request` targeting `main`.
- But `main` has **no branch protection**: `gh api repos/{owner}/{repo}/branches/main/protection` returns 404 "Branch not protected". Nothing on GitHub blocks a merge (or a direct push) when CI is red.
- AGENTS.md says "There is no automated CI test gate; run lint and build locally before pushing." Resolution of the apparent contradiction: CI runs and reports, but it does not *gate* — so treat AGENTS.md as correct in spirit. Your local run is the enforcement mechanism.

Re-check branch protection if this ever changes:

```bash
gh api repos/{owner}/{repo}/branches/main/protection   # 404 = still unprotected
```

**What does NOT count as evidence:**

- "It compiles" / "TypeScript is happy" — type-checks only.
- "The dev server starts" — CRA dev builds are more permissive than `npm run build`.
- "Tests pass" alone — the suite covers a handful of pure-logic modules (section 2); your feature is almost certainly not in it.
- A screenshot of one viewport in one theme — see section 7 for the actual matrix.

---

## 2. Test inventory — the golden set (as of 2026-07-07)

The suite is **ten files** (re-verify with `find src -name "*.test.ts*" | sort`). It is entirely pure-logic and smoke tests — no repository, RLS, or full-page behavior is covered. Know what each certifies and, more importantly, what nothing certifies.

| File | What it certifies | Why it exists |
|---|---|---|
| `src/App.test.tsx` | The full app (provider hierarchy + router) renders without throwing, against the mocked Supabase client from `setupTests.ts`. | Smoke test — catches provider-order breakage and import-time crashes in `App.tsx`. |
| `src/data/legacyHouseArchive.test.ts` | The House archive's exact year list (2018-2019 → 2025-2026); 2020-2021 is an `unconfirmed` gap with no Houses; 2019-2020 = designer Houses (Gucci, Comme des Garçons, Supreme, Yves Saint Laurent); 2023-2024 = beverage Houses (Ca Phe Sua Da, Banana Milk, Matcha, Yakult); 2024-2025 = three Sanrio Houses; the gap year is excluded from verified years. | **Protects domain facts.** House-year mapping has been repeatedly corrupted by agents inventing or shuffling Houses (AGENTS.md "Domain-critical facts" pins these years). This test makes the history executable — an agent that "fixes" the archive breaks the build. |
| `src/utils/seasonalState.test.ts` | Seasonal boundaries in America/Los_Angeles: summer break starts June 15 and ends September 15 (exclusive); `shouldUseSummerEmptyState` only fires when no active items exist. | **Protects domain facts.** The academic-year clock drives visible site behavior (empty states, seasonal content); off-by-one date bugs here silently change the public site twice a year. See `vsa-seasonal-operations` for the full clock. |
| `src/lib/applicationLinks.test.ts` | `getApplicationStatus` window logic: `disabled` when not enabled regardless of dates; `not_open` before open; `open` inside the window with both boundaries inclusive; `closed` after due. | **Risk-adjacent.** Governs whether an application window (and its URL) is exposed — enforces the "closed/future application URLs are never public" safety rule (AGENTS.md). |
| `src/lib/memberMatching.test.ts` | House-assignment cell parsing (strips preference rank/timestamps, handles quoted CSV commas, doesn't mistake preference for class year) and attendance-import matching (unique email → auto-match; duplicate email → review). | **Risk-adjacent to a protected domain.** This is the matching layer of attendance import; the import/points domain is audit-first (section 4; playbook agent `vsa-points-attendance-guardian`). |
| `src/utils/wrapped.test.ts` | `countEventsInWindow` (inclusive date-only window) and House-standings helpers: sort by total points descending without mutating input, winner selection, community-point sums. | **Leaderboard-adjacent.** Exercises standings ordering/winner logic used by VSA Wrapped. Does **not** test the canonical leaderboard calculation — that remains untested (see below). |
| `src/utils/calendar.test.ts` | Calendar date math across month boundaries without timezone shift; `vsaEventToCalendarItem` maps **only public-safe fields**; house/application → calendar-item mapping and tag normalization. | **Privacy-adjacent.** The "public-safe fields only" assertion guards against leaking non-public event data into the public calendar. |
| `src/lib/dateOnly.test.ts` | `toDateOnlyString` / `parseDateOnly`: parse `YYYY-MM-DD` as **local** calendar dates (no timezone shift), reject impossible dates (e.g. Feb 31), fall back to `parseISO` for other strings. | Date-only rendering has caused off-by-one display bugs; this pins the safe parsing behavior. |
| `src/schemas/dataRightsRequests.test.ts` | `DataRightsRequestFormSchema` / `DataRightsDependencyPreviewSchema`: accept only non-destructive, read-only metadata; reject destructive action fields, raw content, invalid identifiers, and oversized notes; require an independent reviewer. | **Privacy/safety.** Keeps the data-rights workflow read-only-by-construction (see `docs/data-rights-anonymization-runbook.md`). |
| `src/schemas/memberPhotoRequests.test.ts` | `MemberPhotoRequestFormSchema`: requires explicit `consent === true`; rejects missing name, invalid email, oversized notes, and unknown fields. | Enforces consent + input bounds on the public member-photo-request form. |

**Still unprotected — where you have NO automated safety net:**

- **Points / attendance / leaderboard _calculation_** — no direct tests. `memberMatching.test.ts` covers import _matching_ and `wrapped.test.ts` covers standings _sorting_, but the canonical points math and leaderboard aggregation are exercised only by manual QA + the leaderboard checklist (section 5). This is the most protected domain in the repo (section 4).
- **All repositories in `src/data/repos/`** — no tests; every Supabase query path is exercised only by humans.
- **Routing, auth gating, admin gating, and all feature components** — only the top-level smoke test.
- **RLS policies** — deliberately not covered by Jest (client tests can't prove server policy). Covered instead by `scripts/verify-rls-security.mjs` → interpretation guide in `vsa-diagnostics-and-measurement`, runbook pointer in section 5.

Consequence: for any change in an unprotected area, Gate 4 (manual exercise) carries the entire burden. Do not skip it.

---

## 3. How to add a test

**Where it goes.** Colocate next to the source file: `src/utils/foo.ts` → `src/utils/foo.test.ts` (`.test.tsx` for component tests). CRA discovers `*.test.ts(x)` anywhere under `src/` automatically — no config change needed.

**Run just your file:**

```bash
CI=true npm test -- --watchAll=false --testPathPattern=seasonalState
```

**What's already set up for you** (`src/setupTests.ts`, loaded before every test file):

- `@testing-library/jest-dom` matchers (`toBeInTheDocument`, etc.)
- `process.env.REACT_APP_SUPABASE_URL` / `_ANON_KEY` set to test dummies — so importing `src/lib/supabase.ts` (which throws on missing env at module load) works in tests
- `window.matchMedia` mocked (jsdom lacks it; ThemeContext needs it)
- `@supabase/supabase-js` module-mocked with a chainable no-op query builder — tests never hit a real database

**Jest quirks pinned in `package.json`:**

```json
"jest": {
  "transformIgnorePatterns": [
    "node_modules/(?!(zod|@hookform/resolvers)/)"
  ]
}
```

`zod` and `@hookform/resolvers` ship ESM; without this exception Jest fails with `Unexpected token 'export'`. If a new ESM-only dependency breaks tests the same way, that pattern is where it gets added — but environment breakage diagnosis belongs to `vsa-build-and-env`.

**The pattern to copy** — pure-function domain tests, from `src/utils/seasonalState.test.ts`:

```ts
import {
  getCurrentVsaSeason,
  isSummerBreak,
  shouldUseSummerEmptyState,
} from './seasonalState';

describe('seasonal state helpers', () => {
  it('treats the day before June 15 as active year', () => {
    expect(isSummerBreak(new Date('2026-06-14T19:00:00Z'))).toBe(false);
    expect(getCurrentVsaSeason(new Date('2026-06-14T19:00:00Z'))).toBe('active_year');
  });

  it('starts summer break on June 15 in Los Angeles', () => {
    expect(isSummerBreak(new Date('2026-06-15T19:00:00Z'))).toBe(true);
  });
});
```

Notes on the pattern: plain `describe`/`it`, exact expected values (not shape assertions), each `it` name states the domain fact it pins. Prefer this style — extract logic into a pure function and test the function, rather than mounting large component trees.

**CRA/jsdom limitations — what Jest here cannot verify:**

- No real browser: no layout, no CSS, no Tailwind classes actually applied, no dark-mode rendering, no scroll/resize behavior. Visual claims need manual QA (section 7).
- No real network or database: the Supabase client is mocked, so tests cannot verify queries, RLS, or data correctness.
- Framer Motion and ThemeProvider emit known warnings under jsdom — acceptable per the rule quoted in section 1.
- CRA owns the Jest config; only the whitelisted keys (like `transformIgnorePatterns`) can be overridden in `package.json`. Do not attempt a standalone `jest.config.js` and do not `npm run eject`.
- No secrets or real member data in tests or fixtures, ever (`.claude/agents/vsa-testing-qa.md`).

---

## 4. When tests are REQUIRED vs optional

**REQUIRED — protected domains.** AGENTS.md forbids modifying attendance import, points calculation, House membership, or leaderboard calculation *unless explicitly requested*. When such a change IS explicitly requested, `.claude/agents/vsa-points-attendance-guardian.md` sets the bar:

> "Any change requires clear acceptance criteria and tests."

Concretely, before merge a protected-domain change must have: (a) written acceptance criteria (section 6) agreed *before* coding, (b) new or updated tests pinning the changed behavior, (c) all four evidence gates green, (d) the relevant manual checklist run (leaderboard checklist for anything touching standings — section 5). Whether the change is permissible at all is `vsa-change-control`'s territory; this skill only defines the evidence it must carry.

**REQUIRED — domain-fact changes.** If you legitimately change House history data or seasonal boundaries, update `legacyHouseArchive.test.ts` / `seasonalState.test.ts` in the same PR with the corrected facts. A red golden test is doing its job; never delete or loosen it to get green.

**STRONGLY RECOMMENDED:** regression test for any fixed logic bug (pin the bug, per `.claude/agents/vsa-testing-qa.md`); tests for any new pure utility in `src/utils/` or `src/lib/`; tests for new data-transform logic feeding public pages.

**OPTIONAL (manual QA carries the burden instead):** styling/layout-only changes, copy changes, component rearrangements with no logic change. jsdom can't see what these change anyway — spend the effort on the section 7 runbook instead.

**Never acceptable:** weakening protected logic, deleting a golden test, or loosening an assertion to make a suite pass (`vsa-testing-qa` playbook: "Do not weaken protected logic to make a test pass").

---

## 5. Checklist routing table

Pick every row that matches your change; run all that apply.

| You changed… | Run this | Notes |
|---|---|---|
| Anything under `supabase/migrations/` touching RLS, grants, views, or RPCs | `docs/rls-verification-checklist.md` → `node scripts/verify-rls-security.mjs` | Staging first, production after. Never with a `service_role` key (bypasses RLS, invalidates every check). Mutation tests (`RLS_ALLOW_MUTATION_TESTS=true`) never on production without leadership approval. Script env/interpretation details: `vsa-diagnostics-and-measurement`. |
| Anything near points, attendance, standings, academic terms, or the leaderboard UI | `docs/leaderboard-test-checklist.md` | Covers four surfaces: public `/leaderboard` (year selector defaults to active year, All-Time matches prior standings, year switching/search/pagination), `/admin/points` (KPI cards and Top-10 follow selected year), `/admin/import` (term labels shown, no-term warning, points attributed to the event's academic year), `/admin/members` (Yearly Breakdown sums match per-year events). Run it whenever standings could shift, even from a "display-only" change. |
| Modals, drawers, toasts, calendars, or other dynamic/interactive UI | Open manual a11y items in `docs/final-compliance-reaudit.md` (§2, §7) | Still-open live checks as of that audit (2026-06-19): mobile-drawer focus trap (Tab stays inside, focus returns to menu button on close); toast announcements read by screen readers (`role="status"`/`aria-live="polite"`); color contrast ≥ 4.5:1 for secondary text in BOTH themes; full keyboard walk with visible focus on every interactive element. |
| Routes, auth, providers, or anything in `src/routes/` / `src/App.tsx` | Route QA (below) | |

**Route QA runbook:**

1. **Public loads without auth** — in a logged-out/incognito session, load `/`, `/events`, `/leaderboard`, `/cabinet`, `/gallery`. No auth prompt, no crash, no private data (check the leaderboard network payload for `auth_user_id`/emails — must be absent, per `docs/final-compliance-reaudit.md` §7).
2. **Protected redirects** — logged out, visit `/profile`, `/points`, `/feedback`: expect redirect to sign-in, not a blank page or error.
3. **Admin gated** — as a signed-in *non-admin*, visit `/admin`: expect denial/redirect, and no admin nav items visible.
4. **Degraded mode** — the app must survive Supabase being unreachable. To simulate locally: point `.env.local` at a syntactically valid but unreachable project (e.g. `REACT_APP_SUPABASE_URL=https://unreachable-degraded-test.supabase.co`, any non-empty anon key) and restart `npm start`. Fetches fail → `isSupabaseUnavailable()` (`src/utils/isSupabaseUnavailable.ts`) returns true for network errors and 429/402/503/504 → public pages must show fallback content (`src/config/publicFallbackContent.ts`) or `ContentUnavailableState`, never a white screen. **Do not test by deleting the env vars** — `src/lib/supabase.ts` throws `Missing Supabase environment variables` at boot, which tests nothing (that symptom belongs to `vsa-build-and-env`). Restore your real `.env.local` afterward.

---

## 6. Acceptance-criteria discipline

Write acceptance criteria **before coding**, as observable, testable outcomes — each one something a reviewer can check true/false without reading the diff. "Improve the events page" is not a criterion; "the calendar button stays inside its card at 375px width" is.

The repo template is `docs/claude-subagent-task-template.md` (fields: Subagent, Goal, Current problem, Scope, Out of scope, Likely files, Safety rules, **Acceptance criteria**, Verification commands, Manual QA, Final response format). Its verification-commands block is exactly the section 1 gates. The template's own filled example, verbatim — this is the calibration for how specific criteria should be:

```
Goal:
  Fix the Google Calendar button overflowing on event cards on mobile.

Acceptance criteria:
  - Button stays within the card on mobile and desktop
  - No regression to other event card content

Manual QA:
  - Load /events at mobile and desktop widths; confirm button fits
```

Rules of thumb:

- 2–5 criteria. More usually means the scope is too big for one PR (AGENTS.md: small, focused PRs with explicit acceptance criteria).
- Every criterion pairs with a verification method: a command, a test, or a specific manual-QA step. If you can't say how you'd check it, rewrite it.
- Include at least one **negative** criterion (what must NOT change) whenever the change is near a protected domain — e.g. "public leaderboard standings identical before/after".
- For protected-domain changes, criteria are mandatory and precede any edit (section 4).

---

## 7. Manual QA runbooks for the riskiest recurring change types

These are the change types that historically break in ways no command catches. Run the matching runbook as Gate 4.

### A. Public content change (copy, launch content, program pages)

1. Load the changed route logged out. Confirm the new content, no placeholder text, no broken images.
2. Grep your diff for private data: no emails, check-in codes, real application URLs for closed/future windows (AGENTS.md never-do list; form-link rules live with `vsa-applications-forms` / `vsa-change-control`).
3. Domain-fact spot check: presidents, House names, and years must match AGENTS.md "Domain-critical facts" — never invent Houses or members.
4. Degraded mode (section 5 step 4): the changed page still renders fallback content when Supabase is unreachable.
5. Both themes: toggle light/dark; new copy must use semantic tokens (no invisible gray-on-gray text in dark mode).

### B. Admin CRUD change (events, gallery, cabinet, members, applications)

1. As admin: exercise the full cycle — create, edit, verify it renders where members see it, delete/unpublish. Confirm drafts/unpublished items do NOT appear on public routes.
2. As non-admin: confirm the admin route is still gated and the new UI leaks nothing (route QA steps 1–3).
3. Check mutations flow through the repository layer (`src/data/repos/`), not raw `supabase.from(...)` in components — verification habit from `docs/rls-verification-checklist.md` §8.
4. Errors surface via toast or `PageError` — force one failure (e.g. required field empty) and confirm it's not swallowed.
5. If the change touches points/attendance/standings even indirectly, run the leaderboard checklist (section 5).

### C. Mobile UI change (the current campaign area — see `vsa-ui-excellence-campaign`)

Device-emulation matrix — all cells, in browser devtools:

| | 375px (mobile) | 768px (tablet) | Desktop |
|---|---|---|---|
| Light mode | ☐ | ☐ | ☐ |
| Dark mode | ☐ | ☐ | ☐ |

Per cell: no horizontal overflow/clipped tap targets; bottom sheets, snap rails, and the quick-nav dock still open/scroll/dismiss (these shipped recently — commits `feb4b263`, `368fbf63`, `5902bdd6` — and regress easily); fixed/sticky elements don't cover content or each other.

Then: keyboard/focus pass on any new interactive element (a11y items, section 5); degraded mode on the changed page; confirm no inline `style` props or hardcoded color classes snuck in (`npm run lint` won't catch these — grep your diff).

### D. Migration-coupled change (frontend + `supabase/migrations/` together)

1. **Order matters**: migrations are applied manually here — application procedure and ordering live in `vsa-run-and-operate`; the policy lives in `vsa-change-control`. QA the frontend against a database that already has the migration.
2. Test the *mismatch* window both ways: new frontend against old schema (pre-apply) and old frontend against new schema (post-apply, pre-deploy). Neither may hard-crash public pages — expect graceful errors or fallbacks.
3. If the migration touches RLS, grants, a view, or an RPC: RLS checklist row (section 5) is mandatory. New views have a known privilege gotcha — see `vsa-supabase-security-reference` before writing, `scripts/verify-rls-security.mjs` after applying.
4. Update `src/types/database.ts` to match the schema (AGENTS.md convention) — then re-run all of section 1's gates, since the build is what proves the types agree.
5. Verify with real (staging) data shapes, not just the mocked client — Jest cannot see schema drift (section 3 limitations).

---

## Provenance and maintenance

Sources (repo, branch `codex/reactbits-ui`, as of 2026-07-06):

- `AGENTS.md` — §Testing (acceptable-warnings rule, quoted verbatim), §PR/branch conventions ("no automated CI test gate"), §Things to never do, §Domain-critical facts.
- `package.json` — scripts and `jest.transformIgnorePatterns`.
- `src/App.test.tsx`, `src/data/legacyHouseArchive.test.ts`, `src/utils/seasonalState.test.ts`, `src/setupTests.ts` — read in full.
- `src/lib/supabase.ts` (env throw at line 13), `src/utils/isSupabaseUnavailable.ts` (degraded-mode detection).
- `.claude/agents/vsa-testing-qa.md`, `.claude/agents/vsa-points-attendance-guardian.md` (quoted).
- `docs/rls-verification-checklist.md`, `docs/leaderboard-test-checklist.md`, `docs/final-compliance-reaudit.md` (dated 2026-06-19), `docs/claude-subagent-task-template.md` (example quoted verbatim).
- `.github/workflows/deploy.yml` — lint/test/build on `pull_request` → `main`.
- `gh api repos/{owner}/{repo}/branches/main/protection` → HTTP 404 "Branch not protected" (checked 2026-07-06).

Re-verify volatile facts:

```bash
find src -name "*.test.ts*" | sort                               # test inventory — 10 files as of 2026-07-07?
grep -n "acceptable" AGENTS.md                                    # acceptable-warnings rule unchanged?
grep -n "transformIgnorePatterns" -A 3 package.json               # jest quirk unchanged?
grep -n "pull_request\|npm run lint\|npm test\|npm run build" .github/workflows/deploy.yml
gh api repos/{owner}/{repo}/branches/main/protection              # 404 = main still unprotected
grep -n "acceptance criteria and tests" .claude/agents/vsa-points-attendance-guardian.md
ls docs/rls-verification-checklist.md docs/leaderboard-test-checklist.md docs/final-compliance-reaudit.md docs/claude-subagent-task-template.md
```
