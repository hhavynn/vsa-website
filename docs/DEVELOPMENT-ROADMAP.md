# Development roadmap

A grounded backlog for the VSA website: **17 epics, 107 open sub-issues** (#205–#329), created 2026-07-28.

> [#252](https://github.com/hhavynn/vsa-website/issues/252) (regroup admin nav) was closed as not planned — the command palette (#250) makes it largely moot.

Every issue was written against the code as it exists — file paths, line counts, and config values in the issue bodies were verified, not assumed. Where an issue proposes something ambitious, it says what already exists so nobody rebuilds a feature that's half-built.

This document is the index. The issues are the source of truth.

---

## 1. The epics

| # | Epic | Area | Subs | Priority |
|---|---|---|---|---|
| [#205](https://github.com/hhavynn/vsa-website/issues/205) | Security — browser headers, CSP rollout, transport hardening | security | 6 | **P0** |
| [#206](https://github.com/hhavynn/vsa-website/issues/206) | Security — RLS, secrets, public data exposure | security | 6 | **P0** |
| [#207](https://github.com/hhavynn/vsa-website/issues/207) | Auth — member accounts + admin auth hardening | auth | 6 | P1 |
| [#208](https://github.com/hhavynn/vsa-website/issues/208) | Ask VSA — answer quality, knowledge ops, cost control | ask-vsa | 6 | P1 |
| [#209](https://github.com/hhavynn/vsa-website/issues/209) | Mobile UI/UX — public page polish and touch ergonomics | mobile | 7 | P1 |
| [#210](https://github.com/hhavynn/vsa-website/issues/210) | Admin DX — navigation and information architecture | admin-dx | 4 | P1 |
| [#211](https://github.com/hhavynn/vsa-website/issues/211) | Admin DX — workflow efficiency, bulk ops, safety rails | admin-dx | 6 | P1 |
| [#212](https://github.com/hhavynn/vsa-website/issues/212) | Navigation & findability | nav | 6 | P1 |
| [#213](https://github.com/hhavynn/vsa-website/issues/213) | New school year — dynamic content and de-hardcoding | new-year | 6 | **P0** ⏰ |
| [#214](https://github.com/hhavynn/vsa-website/issues/214) | New school year — applications, House cycle, seasonal gating | new-year | 5 | **P0** ⏰ |
| [#215](https://github.com/hhavynn/vsa-website/issues/215) | New features — member-facing | feature | 7 | P2 |
| [#216](https://github.com/hhavynn/vsa-website/issues/216) | New features — cabinet tooling and institutional memory | feature | 5 | P2 |
| [#217](https://github.com/hhavynn/vsa-website/issues/217) | Testing & QA foundation | testing | 7 | **P0** |
| [#218](https://github.com/hhavynn/vsa-website/issues/218) | Performance, accessibility, platform health | perf / a11y | 7 | P1 |
| [#304](https://github.com/hhavynn/vsa-website/issues/304) | AI/agentic workflow — repo legibility for agents and humans | ai-workflow / docs | 8 | P1 |
| [#313](https://github.com/hhavynn/vsa-website/issues/313) | Accessibility — WCAG 2.2 AA beyond automated tooling | a11y | 8 | P1 |
| [#314](https://github.com/hhavynn/vsa-website/issues/314) | Contributor environment — start cleanly on any machine | devex | 7 | **P0** |

⏰ = calendar-bound

Each epic carries a pinned comment listing its sub-issues with a suggested order and the dependencies between them.

---

## 2. What to do first

Three things genuinely come before the rest.

### #217 — Testing foundation

The highest-leverage epic on the board, and the least visible. Right now **every** safety property in this repo is enforced by human review. That works while one person holds the whole model in their head. It stops working the moment a second developer joins.

There are 15 test files, covering utils, schemas, and helpers — against ~14,300 lines of admin pages, ~15,200 lines of components, 91 migrations, and 5 Edge Functions. Zero repository tests, zero RLS tests, one page-level smoke test.

Start: [#290](https://github.com/hhavynn/vsa-website/issues/290) (CI) → [#295](https://github.com/hhavynn/vsa-website/issues/295) (contributor guide) → [#293](https://github.com/hhavynn/vsa-website/issues/293) (points characterization tests, which gate several refactors elsewhere).

### #213 / #214 — New school year

Calendar-bound. The academic year rolls over in September, and the site currently needs a developer to roll with it. At least 12 source files hardcode the 2025–26 year, including a navigation label. Work that lands in October is worth much less than work that lands in August.

Start: [#267](https://github.com/hhavynn/vsa-website/issues/267) (inventory), [#263](https://github.com/hhavynn/vsa-website/issues/263) (the nav label — small, urgent), [#271](https://github.com/hhavynn/vsa-website/issues/271) (launch checklist, **rehearsed** against a preview environment).

### #314 — Contributor environment

The two blockers that made the documented setup path fail are **fixed** (2026-07-29):

- ✅ **`.env.example` was missing `REACT_APP_SUPABASE_ANON_KEY`** ([#323](https://github.com/hhavynn/vsa-website/issues/323), closed) — copying the file as documented produced an app that threw `Missing Supabase environment variables`. The file now marks both required vars and warns that `REACT_APP_*` ships in the public bundle.
- ✅ **Node disagreed three ways** ([#324](https://github.com/hhavynn/vsa-website/issues/324)) — CI said 20, `Dockerfile` said 18, nothing else said anything. Everything is now on **Node 22**: `.nvmrc`, `engines`, `deploy.yml`, both image-migration workflows, `Dockerfile`, and the devcontainer. Verified on 22.22.2 — `npm ci`, lint, 126 tests, and build all pass.

Also landed: `.devcontainer/devcontainer.json` ([#325](https://github.com/hhavynn/vsa-website/issues/325)) and [`docs/FIRST-TIME-SETUP.md`](FIRST-TIME-SETUP.md) for contributors new to git and the terminal.

**What remains:** hand [#326](https://github.com/hhavynn/vsa-website/issues/326) (from-zero verification) to the new contributor — they're the only person who can genuinely test a clean setup, and it's their first hour anyway. #324 stays open for confirming Vercel's Node version; #325 stays open until someone has actually launched a Codespace from the devcontainer.

### #219 and #299 — Two standing security/cost gaps

- [#219](https://github.com/hhavynn/vsa-website/issues/219) — `vercel.json` ships `Strict-Transport-Security: max-age=0` while `docs/security-headers-and-csp.md` documents a 1-year policy. `max-age=0` is the value that disables HSTS. **Check `git blame` before changing it** — it may have been set deliberately to flush a bad policy from browser caches, in which case the doc is what needs fixing.
- [#299](https://github.com/hhavynn/vsa-website/issues/299) — Supabase egress has caused a real incident and still has no alert.

---

## 3. Labels

**Area:** `area:security` `area:auth` `area:ask-vsa` `area:mobile` `area:admin-dx` `area:nav` `area:new-year` `area:feature` `area:testing` `area:perf` `area:a11y` `area:ai-workflow` `area:docs` `area:devex`

**Type:** `type:epic` `type:bug` `type:enhancement` `type:chore`

**Priority:** `priority:P0` `priority:P1` `priority:P2`

**Workflow:** `good first issue` · `needs-decision` (owner call required) · `gated:change-control` (protected domain — sign-off required) · `blocked:external` (waiting on another cabinet chair)

**Agent routing:** `agent:claude` · `agent:codex` · `agent:antigravity` — see §6.

**Milestones:** see §10.

### `blocked:external`

VSA's real workflow is: the responsible chair drafts a form → it's approved → a release date is set → it goes out as an Instagram post. Site work that depends on that chain **cannot be finished on engineering time alone**, no matter the priority.

Currently tagged: [#271](https://github.com/hhavynn/vsa-website/issues/271) (needs every chair's dates), [#276](https://github.com/hhavynn/vsa-website/issues/276), [#277](https://github.com/hhavynn/vsa-website/issues/277) (House Reveal — Community Relations chair), [#283](https://github.com/hhavynn/vsa-website/issues/283), [#284](https://github.com/hhavynn/vsa-website/issues/284), [#286](https://github.com/hhavynn/vsa-website/issues/286), [#288](https://github.com/hhavynn/vsa-website/issues/288).

**Most of these split.** The engineering half (gating logic, admin preview, payload-leak verification, year mapping) is almost never blocked — only the content half is. Do the unblocked half early so the chair's delivery becomes a content entry rather than a build under deadline. #277's comment shows the split in detail.

Labels were auto-created by the issues API and default to grey. Colouring them in repo settings makes the board far more readable; it takes about two minutes.

---

## 4. Setting up the GitHub Project board

The board could not be created programmatically — GitHub Projects v2 is GraphQL-only, and this session's token was restricted to REST plus a pinned set of operations. Manual setup, roughly two minutes:

1. **Projects → New project → Board.** Name it something like "VSA Website Roadmap."
2. **Add items:** `is:issue is:open repo:hhavynn/vsa-website` — adds all 99 at once.
3. **Add a built-in workflow:** *Auto-add to project* on newly-opened issues, so future issues land automatically.
4. **Suggested fields:**
   - `Status` — Backlog / Ready / In progress / In review / Done
   - `Priority` — single-select, populate from the `priority:*` labels
   - `Area` — single-select, populate from `area:*`
   - `Size` — S / M / L
5. **Suggested views:**
   - *Board by Status* — the working view
   - *Table grouped by Area* — the planning view
   - *"Do first"* — filter `label:priority:P0`
   - *"Good first issues"* — filter `label:"good first issue"`, for onboarding

### Sub-issue hierarchy

[#205](https://github.com/hhavynn/vsa-website/issues/205) uses GitHub's native sub-issue links, so it shows a progress bar. The other 13 epics use checklist comments instead — same information, no progress bar. Native linking returns the full parent body on every call, which made 85 of them impractical in one session.

To convert an epic: open it, find the **Sub-issues** panel, *Add existing issue*, paste the numbers from its checklist comment. Optional — the checklists are perfectly usable as-is.

---

## 5. Onboarding a second developer

### Before they start

1. Invite them as a collaborator (the repo is private — they can't clone until they accept).
2. Send them [`docs/FIRST-TIME-SETUP.md`](FIRST-TIME-SETUP.md). It assumes no prior git or terminal experience and explains why each step exists.
3. Then [`docs/ai/AGENT-TOOLCHAIN-SETUP.md`](ai/AGENT-TOOLCHAIN-SETUP.md) — the agent skills, playbooks, and guardrails are all committed, so they work on a fresh clone. Only Superpowers, Impeccable, and the Graphify binary are per-machine installs.
4. Make sure they read `AGENTS.md`. The governance here is unusually rich and not guessable — and asking an agent to explain the codebase is the fastest way in.

### Suggested first five issues, in order

| # | Issue | Why it's a good start |
|---|---|---|
| [#326](https://github.com/hhavynn/vsa-website/issues/326) | Verify from-zero setup on their OS | They're the only person who can truly test it — and it's their first hour anyway |
| [#295](https://github.com/hhavynn/vsa-website/issues/295) | Expand CONTRIBUTING.md | Learn the rules by writing them down |
| [#317](https://github.com/hhavynn/vsa-website/issues/317) | Screen-reader test the core journeys | No code knowledge needed; teaches the whole product |
| [#263](https://github.com/hhavynn/vsa-website/issues/263) | Remove hardcoded year from nav label | Small, real, ships something urgent |
| [#243](https://github.com/hhavynn/vsa-website/issues/243) | Mobile audit | No code knowledge needed; steers the roadmap |

Then: [#220](https://github.com/hhavynn/vsa-website/issues/220) (security-headers doc), [#262](https://github.com/hhavynn/vsa-website/issues/262) (orphaned routes), [#318](https://github.com/hhavynn/vsa-website/issues/318) (Vietnamese `lang` attributes), [#321](https://github.com/hhavynn/vsa-website/issues/321) (landmarks and headings), [#307](https://github.com/hhavynn/vsa-website/issues/307) (protected-domain comments in source).

Then, once they've got their bearings: [#266](https://github.com/hhavynn/vsa-website/issues/266) (404 page), [#294](https://github.com/hhavynn/vsa-website/issues/294) (route smoke tests), [#254](https://github.com/hhavynn/vsa-website/issues/254) (admin breadcrumbs), [#280](https://github.com/hhavynn/vsa-website/issues/280) (gallery↔event linking), [#272](https://github.com/hhavynn/vsa-website/issues/272) (fallback content).

All 18 `good first issue` items were chosen to avoid protected domains entirely.

### What to keep away from them at first

Anything labelled `gated:change-control`: attendance import, points calculation, House membership, leaderboard, RLS. Not because they can't handle it — because those areas have incident history, settled decisions, and non-obvious constraints that take a while to absorb. `vsa-failure-archaeology` documents why.

### Splitting the work

The epics were scoped to parallelise cleanly:

- **Independent tracks:** mobile (#209), nav (#212), admin DX (#210, #211) barely touch each other.
- **Sequential:** the CSP track (#221 → #223 → #222 → #224) is strictly ordered.
- **Shared prerequisite:** #217's tests gate refactors in #211 and #207. Whoever takes #217 unblocks the other person.

A reasonable split: one person on #217 + #213/#214 (the time-critical, high-context work), the other on #209 + #212 (visible, well-bounded, low-risk).

---

## 6. Assigning work to AI agents

Issues on this board are written to be agent-ready: each carries acceptance criteria, an owning skill/playbook, and the guardrails for its domain. That's deliberate — an agent handed one of these has what it needs without a human naming tools or files.

### ⚠️ Before assigning anything

**`main` has no branch protection, and on this repo it may not be possible to add any.** `AGENTS.md` L258 states the situation: CI runs on every PR but "is **not a protected merge gate** … nothing mechanically blocks merging a red PR."

This repo is **private**, and on GitHub Free, branch protection and rulesets are **public-repo only** — private repos need GitHub Pro (personal) or Team (organization). So `.github/CODEOWNERS` currently auto-requests review but gates nothing.

```bash
gh api repos/hhavynn/vsa-website/branches/main/protection   # 404 = unprotected
```

Three honest options:

| Option | Cost | Effect |
|---|---|---|
| **Make the repo public** | free | Branch protection, rulesets, CODEOWNERS enforcement, code scanning and secret scanning all become available |
| **GitHub Pro** | ~$4/mo | Branch protection + CODEOWNERS enforcement on the private repo. Code scanning still needs Team/Enterprise |
| **Stay as-is** | free | No mechanical gate. Review discipline is a human convention |

The owner's decision (2026-07-29) was **not to pay**, so the third option is in effect unless the repo goes public.

**What that means in practice:** nothing stops a red PR — or an AI agent's PR touching a protected domain — from being merged. Until that changes, treat these as manual rules:

- Don't merge a PR with a red `test` job.
- Read the diff on anything matching a path in `.github/CODEOWNERS`, especially points, attendance, House membership, leaderboard, and migrations.
- Never let an unattended agent merge its own work.

The `gated:change-control` and `blocked:external` labels exist precisely because the platform isn't enforcing anything here.

### How each agent receives work

**Preferred path: GitHub Agent HQ.** Claude and Codex can be added directly to an issue's **Assignees** field alongside Copilot. Assigning one starts it working and it opens a draft PR. Multiple agents can be assigned to the same issue to compare approaches.

This requires enabling agents for this repository first — see "Enabling Agent HQ" below. Until then, use the fallback column.

| Agent | Primary (Agent HQ) | Fallback | Contract it reads |
|---|---|---|---|
| **Claude** | Assign in the Assignees field | `@claude` comment (the GitHub App is installed), or claude.ai/code | `CLAUDE.md` → `AGENTS.md` |
| **Codex** | Assign in the Assignees field | Connect the repo in the Codex interface | `AGENTS.md` directly (L229 addresses Codex explicitly) |
| **Antigravity** | — not a GitHub-integrated agent | Clone locally, open the IDE, point it at the issue URL | `ANTIGRAVITY.md` |

Antigravity suits hands-on local sessions where you're steering. Claude and Codex suit async issue-driven work.

When using a fallback path, a useful phrasing:

> Implement #NNN. Follow `AGENTS.md` and `docs/ai/AGENTIC-ENGINEERING-WORKFLOW.md`. Branch `claude/<scope>-<desc>`. Run the final-gate checks and open a PR with evidence.

### Enabling Agent HQ for this repository

Agent HQ is **opt-in per repository**, and the account that **owns** the repo must enable it — so it does not carry over from another account's projects.

1. Confirm which account holds the Copilot subscription. Claude and Codex require **Copilot Pro, Pro+, Business, or Enterprise**.
2. On the owning account (`hhavynn`): **Settings → Copilot → Cloud agent**.
3. Toggle **Claude** and/or **Codex** on.
4. Add `hhavynn/vsa-website` to the allowed repositories — it's an allowlist, not account-wide.

Agents then appear in the Assignees picker with an **AI** badge.

⚠️ Because assignment now *starts work*, the CODEOWNERS and branch-protection setup below stops being housekeeping and becomes the actual safety boundary. An assigned agent can open a PR against `main` without a human in the loop.

### Routing labels

`agent:claude` · `agent:codex` · `agent:antigravity`

Applied as a starter set, not exhaustively:

- **`agent:codex`** — [#220](https://github.com/hhavynn/vsa-website/issues/220), [#318](https://github.com/hhavynn/vsa-website/issues/318), [#321](https://github.com/hhavynn/vsa-website/issues/321), [#329](https://github.com/hhavynn/vsa-website/issues/329) — docs and mechanical work, cheap to run in parallel
- **`agent:claude`** — [#251](https://github.com/hhavynn/vsa-website/issues/251), [#316](https://github.com/hhavynn/vsa-website/issues/316), [#319](https://github.com/hhavynn/vsa-website/issues/319) — multi-file changes needing judgement
- **`agent:antigravity`** — [#245](https://github.com/hhavynn/vsa-website/issues/245) — visual iteration that benefits from a local browser loop

Add an `Agent` field to Project #4 to see ownership in the table view, and label before starting so two agents don't pick up the same issue.

### What never goes to an unattended agent

- Anything labelled **`gated:change-control`** — attendance import, points calculation, House membership, leaderboard, RLS. Owner review on every line.
- Anything labelled **`blocked:external`** — the blocker is a person, not a keyboard.
- Anything touching a path in `.github/CODEOWNERS`.

Branch prefixes stay per-agent (`claude/`, `codex/`, `antigravity/`) per `AGENTS.md` L256, so authorship is legible in the branch list.

## 7. Guardrails encoded in every issue

Each issue carries the constraints relevant to its area. The recurring ones:

- **Protected domains** — attendance import, points calculation, House membership, leaderboard, RLS. Gated by `vsa-change-control`.
- **Freeze windows** — House pages, application links/gating, and VCN surfaces have an owner-confirmed freeze policy (2026-07-05). Check `vsa-seasonal-operations` before touching them at *any* time of year.
- **Never** — delete Supabase Storage originals · weaken an RLS policy to make a query work · expose check-in codes · hardcode a real application link · expose a closed or future application URL · commit a secret · `npm run eject` · auto-apply migrations to production.
- **Dual points systems** — the public leaderboard and the authenticated check-in flow read and write *different tables* and are not reconciled. Never present them as unified; never fix a leaderboard number by writing to the check-in tables. See `docs/leaderboard-system.md`.
- **Owning skill / subagent** — named per issue, so the right context loads without anyone having to know the skill router.

---

## 8. Rescoped after audit (2026-07-28)

A post-creation audit against the actual repo found three issues proposing things that **already exist**. All three were rescoped rather than closed, because a real gap remained inside each:

| Issue | What already existed | What survived |
|---|---|---|
| [#290](https://github.com/hhavynn/vsa-website/issues/290) | `.github/workflows/deploy.yml` already runs `npm ci` → lint → test (with coverage) → build on every PR to `main`, Node pinned to 20 | Explicit `tsc --noEmit`, branch-protection verification, coverage reporting |
| [#230](https://github.com/hhavynn/vsa-website/issues/230) | Same workflow already runs **CodeQL** + **Trivy** with SARIF upload | Dependabot, secret push protection, pinning `trivy-action@master`, a triage rule |
| [#295](https://github.com/hhavynn/vsa-website/issues/295) | `.github/CONTRIBUTING.md` + a strong `pull_request_template.md` + `pr-title.yml` enforcing the Conventional Commits regex | Protected domains, freeze windows, never-do list, env setup — none of which the existing file covers |
| [#281](https://github.com/hhavynn/vsa-website/issues/281) | `ThisWeekInVSA.tsx` already has the event stack, House events, summer empty state, skeletons, reduced motion | Closing-soon application deadlines |
| [#284](https://github.com/hhavynn/vsa-website/issues/284) | `EventRecapEditor` exists — but it's an **internal cabinet post-mortem** (budget notes, what failed, risks), not a public feature. Has an `is_public_highlight_published` flag | Surfacing the public highlight, with a whitelist of public-safe fields |

**Lesson for future issue-writing here:** this repo is further along than its documentation suggests. Check `.github/`, `scripts/`, and `package.json` scripts before proposing infrastructure.

## 9. Known gaps in this roadmap

Stated plainly so nobody mistakes the backlog for a complete picture:

- **Not verified at runtime.** Issues were written from source, migrations, and docs. Nothing was checked against the running production site — the mobile audit ([#243](https://github.com/hhavynn/vsa-website/issues/243)) and the baselines ([#297](https://github.com/hhavynn/vsa-website/issues/297)) exist to close that gap, and their findings should re-rank their epics.
- **Effort not estimated.** Priorities reflect impact and urgency, not cost. Add a `Size` field during grooming.
- **`secure-ai` Edge Function** — its relationship to `vsa-ai-assistant` is unclear from source; [#229](https://github.com/hhavynn/vsa-website/issues/229) resolves whether it's live or vestigial.
- **Feature issues (#215, #216) are proposals, not commitments.** Several may already be partly built — `EventRecapEditor.tsx` and `ThisWeekInVSA.tsx` in particular. Read before building.

---

## 10. Milestones

Five milestones covering all 125 issues (#205–#329), closed ones included. They answer *"what are we working toward next"* — the epics already answer *"what is this about"*, so milestones are deliberately time- and goal-shaped rather than another category axis.

**These must be created by hand** (Issues → Milestones → New milestone). Milestone numbers are assigned sequentially, so **create them in exactly this order** or the mapping below won't line up.

| # | Milestone | Due | Goal |
|---|---|---|---|
| 1 | **Contributor onboarding** | ASAP | A new contributor can clone, run, and ship a first PR without help |
| 2 | **September rollover** | 2026-09-01 | The site flips to the new academic year without a developer |
| 3 | **Safety net — testing & security** | — | Invariants enforced by CI rather than by memory |
| 4 | **Product polish — mobile, nav, a11y, perf** | — | The student-facing experience is good on a phone and usable by everyone |
| 5 | **Tooling & features** | — | Admin DX, new features, and the AI/agentic workflow |

Milestones 1 and 2 are the only ones with real deadlines. 3 is the highest-leverage. 4 and 5 are ongoing.

### Issue → milestone mapping

**M1 — Contributor onboarding** (12)
`230` `236` `295` `307` `314` `323`✅ `324` `325` `326` `327`✅ `328` `329`

**M2 — September rollover** (15)
`213` `214` `239` `263` `267` `268` `269` `270` `271` `272` `273` `274` `275` `276` `277`

**M3 — Safety net: testing & security** (22)
`205` `206` `217` `219` `220` `221` `222` `223` `224` `225` `226` `227` `228` `229` `232` `290` `291` `292` `293` `294` `296` `310`

**M4 — Product polish** (33)
`209` `212` `218` `231` `242` `243` `244` `245` `246` `247` `248` `249` `261` `262` `264` `265` `266` `297` `298` `299` `300` `301` `302` `303` `313` `315` `316` `317` `318` `319` `320` `321` `322`

**M5 — Tooling & features** (43)
`207` `208` `210` `211` `215` `216` `233` `234` `235` `237` `238` `240` `241` `250` `251` `252`✅ `253` `254` `255` `256` `257` `258` `259` `260` `278` `279` `280` `281` `282` `283` `284` `285` `286` `287` `288` `289` `304` `305` `306` `308` `309` `311` `312`

✅ = closed. The three closed issues are milestoned so the completed work still shows against its goal: [#323](https://github.com/hhavynn/vsa-website/issues/323) and [#327](https://github.com/hhavynn/vsa-website/issues/327) were part of getting the environment working (M1); [#252](https://github.com/hhavynn/vsa-website/issues/252) was closed as not planned but belongs to the admin-DX group (M5).

### A note on where epics sit

An epic carries the same milestone as the bulk of its children, so a milestone's progress bar tracks something real. Two epics are deliberately split from their children:

- **#218** (performance/a11y) sits in M4 with its children, but its accessibility children moved to epic **#313**, which is also M4.
- **#207** (auth) sits in M5, but its two security-shaped children — **#232** (session expiry tests) and **#235** (sign-in hardening) — are split: #232 → M3 with the other test work, #235 stays M5.

Where a child's deadline differs from its epic's, the child's deadline wins. **#239** (stale Ask VSA knowledge) belongs to epic #208 in M5, but it has a September deadline, so it sits in M2.
