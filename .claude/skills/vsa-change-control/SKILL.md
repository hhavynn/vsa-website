---
name: vsa-change-control
description: Load BEFORE making, planning, or reviewing ANY change to the VSA website repo — code, schema, migrations, RLS, config, copy, or docs. Covers change classification (routine vs gated vs forbidden-without-owner-request), the protected domains (attendance import, points calculation, House membership, leaderboard, RLS), the annotated "never do" list with the incident behind each rule, branch/PR/commit conventions, the PR title regex, the manual-migration policy, freeze windows, and the approval-flow checklist. Triggers: "can I change X?", "is this allowed?", opening a PR, naming a branch, touching supabase/migrations/, anything near points/attendance/leaderboard/House data.
---

# VSA Change Control

**What this skill is for.** This repo runs a production site for 600+ real members, edited concurrently by humans and several AI agents (`claude/`, `codex/`, `gemini/`, `antigravity/` branches). `AGENTS.md` at the repo root is the change-control document of record; this skill explains *how to comply with it*: how to classify a change, which rules are absolute, why each rule exists (with the incident behind it), and the exact branch/PR/verification mechanics. Nothing here overrides `AGENTS.md` — when in doubt, `AGENTS.md` wins.

**When NOT to use this skill:**

| You actually need… | Go to |
|---|---|
| Full incident narratives (egress crisis, RLS recursion outage, etc.) | `vsa-failure-archaeology` |
| RLS mechanics, SECURITY DEFINER, view grants, migration-authoring checklist | `vsa-supabase-security-reference` |
| Exact verification commands, acceptable warnings, test-writing | `vsa-validation-and-qa` |
| How to actually apply a migration / deploy / run the image pipeline | `vsa-run-and-operate` |
| Freeze-window calendar details (House reveals, application opens, VCN) | `vsa-seasonal-operations` |
| Why the architecture invariants exist (repo layer, singleton client…) | `vsa-architecture-contract` |
| Tailwind tokens, styling rules, component layering | `vsa-design-system-reference` |

Jargon, once: **RLS** = Row Level Security, Postgres per-row access policies — the only thing standing between the public anon key and private member data. **Migration** = a SQL file in `supabase/migrations/` that changes the database schema/policies. **Protected domains** = the data logic listed in `AGENTS.md` that agents must not modify unless explicitly requested.

---

## 1. Change classification

Classify every task into exactly one tier before touching code.

| Tier | What falls in it | Gate |
|---|---|---|
| **Routine** | Public copy, UI polish within existing Tailwind tokens, docs in `docs/`, new tests, small bug fixes in non-protected components, admin UX tweaks | Normal branch → verify → PR (Section 7) |
| **Gated** | Anything in `supabase/migrations/` or `supabase/functions/`; any RLS/policy/grant change; auth flows (`AuthContext`, `ProtectedRoute`, `AdminRoute`); Supabase Storage; `src/App.tsx` provider hierarchy; `src/routes/index.tsx`; env vars / GitHub secrets / `vercel.json`; new dependencies; anything *displaying* protected-domain data | Routine gate **plus**: audit-first playbook review, RLS verification pass if policies are touched (Section 5), migration stays manual-apply, explicit callout in PR body |
| **Forbidden without explicit owner request** | Modifying **attendance import**, **points calculation**, **House membership**, or **leaderboard calculation** logic; weakening RLS; deleting DB rows or Storage files; exposing private data; committing to `main`; committing secrets | Do not do it. If the task seems to require it, stop and report — only proceed when the owner explicitly requested that exact change, with acceptance criteria |

Source for the forbidden tier: `AGENTS.md` § "Things to never do" — "Don't modify attendance import, points calculation, House membership, or leaderboard calculation unless explicitly requested."

### Audit-first domains and their playbooks

`AGENTS.md` designates protected/risky domains **audit-first**: inspect and report root cause and risk *before* editing. The canonical roster of the 12 domain playbooks — each with its edit vs. audit/dry-run mode and one-line use case — is **`.claude/agents/README.md`**; read it (and the matching `.claude/agents/<name>.md`) to pick the owning playbook. The modes that matter most for change control:

- **Audit-first / read-only** (report findings, never broad edits): `vsa-architecture-guardian` (cross-cutting architecture, PR risk) and `vsa-points-attendance-guardian` (attendance, points, leaderboard, merge/lookup).
- **Edit-capable but dry-run first / review-only SQL**: `vsa-storage-egress`.
- All other domain playbooks are edit-capable within their scope, still bound by the never-do list and the gating tiers above.

---

## 2. The "Things to never do" list, annotated

The list itself is normative in `AGENTS.md`. Below is each rule with WHY and, where verified in git history, the incident behind it. Full incident narratives live in `vsa-failure-archaeology` — do not re-litigate them here.

| Rule (AGENTS.md) | Why / incident (verified evidence) |
|---|---|
| Don't commit to `main` | Multi-agent repo (49 `codex/*`, 41 `claude/*`, 17 `gemini/*`, 7 `antigravity/*` remote branches as of 2026-07-06). All review happens on PRs; a direct push bypasses the only human checkpoint and auto-deploys to production via `.github/workflows/deploy.yml` |
| Don't commit secrets or environment files | The Supabase anon key is public by design, but service keys / `VERCEL_TOKEN` / AI keys are not. Secrets belong in `.env.local` (gitignored) and GitHub/Vercel/Supabase secret stores |
| Don't touch `supabase/.temp/cli-latest` | Supabase CLI-managed local state; editing it produces spurious diffs. (No incident found in git history — rule is preventative.) |
| Don't broadly modify or weaken RLS | **Two incidents.** (1) Emergency hardening `20260619000000_emergency_security_hardening.sql` (commit `8183caba`, PR #145, 2026-06-19) fixed client-mutable `is_admin`, exposed `check_in_code`, and directly-mutable `user_points` — all consequences of loose policies. (2) `user_profiles` RLS recursion outage: policies queried `user_profiles` from within `user_profiles` policies → infinite recursion, fixed by SECURITY DEFINER helper `is_admin_user()` in `20260620020000_fix_user_profiles_rls_recursion.sql` (commit `9e0c102e`, PR #160). RLS changes get the verification pass (Section 5) |
| Don't delete database rows or Supabase Storage files | **Egress crisis.** Supabase Storage egress overran limits; the fix was a pipeline that copies images into repo-hosted `/public/images/**` served by Vercel (`scripts/migrate-supabase-images-to-public.ts`, `docs/event-image-migration.md`, workflows `migrate-images.yml` / `migrate-event-images.yml`; commits `6f22ce86` PR #89, `d2944165` PR #96, 2026-05). Supabase Storage remains the **staging buffer and original-of-record** — deleting originals breaks re-migration and admin uploads. Deletions are also unrecoverable in production |
| Don't expose private member data, emails, check-in codes, payment logs, import notes, or admin notes publicly | **Check-in code incident.** Codes were client-readable on `public.events`; anyone could self-award attendance points. Fixed in two steps: server-authoritative check-in RPC (PR #145), then codes moved off `events` entirely into admin-only `event_check_in_secrets` (`20260620000000_move_check_in_code_to_secrets_table.sql`, commit `c453eb5a`, PR #154). Related: `20260619040000_minimize_public_member_exposure.sql` and attendance-insert hardening (`20260620010000_harden_attendance_rls.sql`, commit `e1bf169c`, PR #157) |
| Don't modify attendance import, points calculation, House membership, or leaderboard calculation unless explicitly requested | Points are **server-authoritative** since PR #145 (direct `user_points` mutation was closed as a security hole). There are also **two coexisting points systems** (public leaderboard: `member_event_attendance` + `events` + `academic_terms`; authenticated check-ins: `event_attendance` + `user_points` — see `docs/leaderboard-system.md`); a "simple fix" in one silently corrupts the other. Consolidation is FUTURE work, not done. Real members' standings depend on this data |
| Don't create fake events, members, points, standings, application links, or House assignments | Production data for real people. Domain facts are strict: 2026–2027 Houses are placeholders (never invent); closed/future application URLs must never be exposed (`AGENTS.md` § Domain-critical facts) |
| Don't add heavy dependencies without explicit justification | CRA (Create React App) ships one client bundle; check impact with `npm run analyze` before proposing |
| Don't query Supabase from a component / don't create a new Supabase client | Architecture invariants (repo layer in `src/data/repos/`, singleton in `src/lib/supabase.ts`) — rationale in `vsa-architecture-contract` |
| Don't hardcode color classes / no inline `style` props | Design-system invariants — rationale and tokens in `vsa-design-system-reference` |
| Don't run `npm run eject` | Ejecting CRA is permanent and unreviewable |
| Don't add OpenAI API calls outside `src/components/features/ai/` | Keeps client-side AI key surface auditable in one place; the production assistant runs server-side in `supabase/functions/vsa-ai-assistant` (see `vsa-ai-knowledge` playbook) |
| Don't touch `src/react-app-env.d.ts` | CRA auto-generates it; edits are overwritten |
| Don't write what-comments / don't over-handle errors / don't use `any` | Code-quality conventions; enforced in review. Use `unknown` + narrowing, validate only at system boundaries |

**Cautionary precedent for auth changes:** commit `a4b2fca9` (2025-10-06) is `Revert "Redesign authentication: admin-only sign-in, public browsing for general members"` — a shipped auth redesign that had to be rolled back. Treat auth-flow redesigns as gated and get explicit owner sign-off on the intended behavior before building.

---

## 3. Branch / PR conventions

All verified against `AGENTS.md`, `.github/CONTRIBUTING.md`, `.github/pull_request_template.md`, `.github/workflows/pr-title.yml` (as of 2026-07-06).

1. **Never commit to `main`.** Fetch first; branch from freshly fetched `origin/main` if local `main` is behind.
2. **One PR at a time.** No temp folders, worktrees, or sibling repos unless explicitly requested. Run `git status --short --branch` before editing; **stop** if unexpected dirty files exist (don't overwrite in-progress work). Don't stage `.gitignore` local changes.
3. **Branch names:** `<scope>/<short-description>`, e.g. `feat/event-end-date`, `fix/house-leaderboard`, `chore/audit-content`. AI-agent branches are prefixed by agent: `claude/…`, `codex/…` (also `gemini/…`, `antigravity/…` in practice).
4. **PRs are small and focused** — one feature or fix per PR, no bundled unrelated changes.
5. **PR title** must match the conventional-commit regex enforced by `.github/workflows/pr-title.yml`:

   ```
   ^(feat|fix|chore|docs|refactor|test|style|perf|ci|build|revert|security)(\([a-z0-9-]+\))?!?: .+
   ```

   Valid: `feat: add Ask VSA suggestions`, `feat(ai): improve Ask VSA chat`, `fix!: remove deprecated backend`. Scope must be lowercase alphanumeric/hyphen.
6. **PR body** follows `.github/pull_request_template.md`: Summary, Type checkbox, Safety/Scope checkboxes (no unrelated files, no secrets, no private/admin data exposed, **no production Supabase mutation**, RLS/storage/auth changes documented), Verification checkboxes, Screenshots/Notes. `AGENTS.md` additionally expects the final report to include: summary, files changed, safety confirmations, verification results, manual QA, pushed branch, and a manual PR title/body (provide these in the response; only create the PR if explicitly requested).
7. **Pre-push verification:** follow the ownership model and proportional final-gate matrix in `.claude/skills/vsa-validation-and-qa/SKILL.md`; root `AGENTS.md` § Testing shows the common application/runtime command set, not a docs-only default. Report exact results and why broader checks were not relevant when they would answer no new question.

---

## 4. CI reality: checks run, but do not enforce merges

`AGENTS.md` and `.github/workflows/deploy.yml` now state the same distinction, verified 2026-07-06:

- `deploy.yml` has triggered on `pull_request` → `main` since commit `03ddf10d` (2025-09-21), running `npm run lint`, `CI=true npm test -- --coverage --watchAll=false`, and `npm run build`. It was last touched by `ba6907ee` (PR #176, 2026-07-02), which also added `pr-title.yml`.
- **The `main` branch is not protected**: `gh api repos/hhavynn/vsa-website/branches/main/protection` returns HTTP 404 "Branch not protected" (checked 2026-07-06). No status check is *required* to merge.

**Current truth:** CI runs lint/test/build (plus CodeQL and Trivy scans) on every PR to `main`, and deploys `main` to Vercel — but nothing mechanically blocks merging a red PR. Consequences for you:

1. Local verification (Section 3 step 7) is **mandatory**, not a courtesy — it is the actual gate.
2. A red CI run must still be treated as blocking by convention, even though GitHub would let you merge.
3. If branch protection is ever enabled, this section is stale — re-run the `gh api` command above.

---

## 5. Migration / RLS gating

- `supabase/migrations/` is the **source of truth for schema** (`AGENTS.md` § Key files). 89 migration files as of 2026-07-06.
- **Migrations are never auto-applied.** No GitHub workflow touches the production database schema (the only workflows are `deploy.yml`, `migrate-images.yml`, `migrate-event-images.yml`, `pr-title.yml`). A merged PR ships the SQL file; a human applies it to production manually. `.github/CONTRIBUTING.md`: *"Do not mutate production Supabase from a PR unless explicitly approved."* The PR template's "No production Supabase mutation" checkbox must be honest. Application procedure and ordering: `vsa-run-and-operate`.
- Migrations are **forward-only**: never edit a shipped migration; write a new one (stated in the headers of `20260619000000` and `20260620000000`).
- **Any change that touches RLS, grants, views, or SECURITY DEFINER functions requires the RLS verification pass** before the PR is mergeable: run `scripts/verify-rls-security.mjs` and walk `docs/rls-verification-checklist.md`. How to run it and interpret results: `vsa-validation-and-qa` and `vsa-diagnostics-and-measurement`. Why the checks exist (default privileges on views, auto-updatable views bypassing base-table RLS, revoke-then-grant pattern): `vsa-supabase-security-reference`.
- Deploy-order coupling: when a change spans migrations + frontend + Edge Function, migrations go first (see `vsa-run-and-operate`).

---

## 6. Freeze windows

Calendar-driven freeze windows exist (owner-confirmed 2026-07-05; previously unwritten). Around **House reveals**, **application opens**, and **VCN** (Vietnamese Culture Night), the affected public surfaces must not change — a broken House page during reveal night or a dead application link at open time is a real-world incident, not just a bug. Before starting any change to House pages, application CTAs/links, or VCN pages, check whether a freeze window is active. The calendar, affected surfaces, and exception process live in `vsa-seasonal-operations`.

---

## 7. Approval-flow checklist (run this before ANY change)

```text
1. CLASSIFY   — Which tier (Section 1)? If "forbidden": stop unless the owner
                explicitly requested this exact change. If it touches
                supabase/, auth, routes, App.tsx, config, or deps: gated.
2. FREEZE?    — Does the change touch House / applications / VCN surfaces?
                Check vsa-seasonal-operations for an active freeze window.
3. PLAYBOOK   — Pick the .claude/agents/<domain>.md playbook (Section 1 table)
                and obey its mode. Audit-first domains: report findings and
                risk BEFORE editing.
4. BRANCH     — git status --short --branch (stop on unexpected dirt).
                Fetch, then branch from origin/main: <scope>/<short-description>.
5. BUILD      — Make the change. Gated tier: migrations forward-only,
                RLS changes get the verification pass (Section 5),
                no production Supabase mutation from the working tree.
6. VERIFY     — Follow the canonical matrix in vsa-validation-and-qa,
                scaled to the change, and report exact results.
                Include manual QA of every affected route/surface.
7. PR         — Push branch. Title matches the regex (Section 3.5).
                Body per .github/pull_request_template.md with safety
                confirmations and verification results. One concern per PR.
                CI must go green even though GitHub won't force it.
```

---

## Provenance and maintenance

Facts verified against the repo on 2026-07-06 (branch `codex/reactbits-ui`). Sources: `AGENTS.md`; `.github/workflows/pr-title.yml`, `deploy.yml`; `.github/CONTRIBUTING.md`, `pull_request_template.md`; `.claude/agents/README.md`; `docs/event-image-migration.md`, `docs/leaderboard-system.md`, `docs/rls-verification-checklist.md`; migrations `20260619000000`, `20260619040000`, `20260620000000`, `20260620010000`, `20260620020000_fix_user_profiles_rls_recursion.sql`; commits `8183caba` (#145), `c453eb5a` (#154), `e1bf169c` (#157), `9e0c102e` (#160), `6f22ce86` (#89), `d2944165` (#96), `a4b2fca9` (auth revert), `03ddf10d`, `c2d1e08c`, `ba6907ee` (#176). Freeze-window policy: owner interview 2026-07-05 (recorded here and in `vsa-seasonal-operations`).

Re-verify drift-prone claims:

```bash
grep -n "regex = " .github/workflows/pr-title.yml                    # PR title regex
grep -n "pull_request" .github/workflows/deploy.yml                  # CI-on-PR still true
gh api repos/hhavynn/vsa-website/branches/main/protection            # 404 = still no merge gate
grep -n "never do" -A 30 AGENTS.md                                   # never-do list unchanged
ls .github/workflows/                                                # still no migration-applying workflow
ls supabase/migrations | wc -l                                       # migration count (89 as of 2026-07-06)
ls .claude/agents/                                                   # playbook roster
git log --oneline -3 -- AGENTS.md .github/CONTRIBUTING.md            # conventions changed?
```
