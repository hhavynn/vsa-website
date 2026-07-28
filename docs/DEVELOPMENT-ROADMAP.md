# Development roadmap

A grounded backlog for the VSA website: **14 epics, 85 sub-issues** (#205–#303), created 2026-07-28.

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
| [#210](https://github.com/hhavynn/vsa-website/issues/210) | Admin DX — navigation and information architecture | admin-dx | 5 | P1 |
| [#211](https://github.com/hhavynn/vsa-website/issues/211) | Admin DX — workflow efficiency, bulk ops, safety rails | admin-dx | 6 | P1 |
| [#212](https://github.com/hhavynn/vsa-website/issues/212) | Navigation & findability | nav | 6 | P1 |
| [#213](https://github.com/hhavynn/vsa-website/issues/213) | New school year — dynamic content and de-hardcoding | new-year | 6 | **P0** ⏰ |
| [#214](https://github.com/hhavynn/vsa-website/issues/214) | New school year — applications, House cycle, seasonal gating | new-year | 5 | **P0** ⏰ |
| [#215](https://github.com/hhavynn/vsa-website/issues/215) | New features — member-facing | feature | 7 | P2 |
| [#216](https://github.com/hhavynn/vsa-website/issues/216) | New features — cabinet tooling and institutional memory | feature | 5 | P2 |
| [#217](https://github.com/hhavynn/vsa-website/issues/217) | Testing & QA foundation | testing | 7 | **P0** |
| [#218](https://github.com/hhavynn/vsa-website/issues/218) | Performance, accessibility, platform health | perf / a11y | 7 | P1 |

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

### #219 and #299 — Two standing security/cost gaps

- [#219](https://github.com/hhavynn/vsa-website/issues/219) — `vercel.json` ships `Strict-Transport-Security: max-age=0` while `docs/security-headers-and-csp.md` documents a 1-year policy. `max-age=0` is the value that disables HSTS. **Check `git blame` before changing it** — it may have been set deliberately to flush a bad policy from browser caches, in which case the doc is what needs fixing.
- [#299](https://github.com/hhavynn/vsa-website/issues/299) — Supabase egress has caused a real incident and still has no alert.

---

## 3. Labels

**Area:** `area:security` `area:auth` `area:ask-vsa` `area:mobile` `area:admin-dx` `area:nav` `area:new-year` `area:feature` `area:testing` `area:perf` `area:a11y`

**Type:** `type:epic` `type:bug` `type:enhancement` `type:chore`

**Priority:** `priority:P0` `priority:P1` `priority:P2`

**Workflow:** `good first issue` · `needs-decision` (owner call required) · `gated:change-control` (protected domain — sign-off required)

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

1. Invite them as a collaborator.
2. Point them at [#295](https://github.com/hhavynn/vsa-website/issues/295) — writing the contributor guide **is** the onboarding. They learn the rules by documenting them, and the review corrects their understanding before they touch anything protected.
3. Make sure they read `AGENTS.md` and skim the `.claude/skills/vsa-*` library. The governance here is unusually rich and not guessable.

### Suggested first five issues, in order

| # | Issue | Why it's a good start |
|---|---|---|
| [#295](https://github.com/hhavynn/vsa-website/issues/295) | Contributor guide + PR checklist | Learn the rules by writing them down |
| [#220](https://github.com/hhavynn/vsa-website/issues/220) | Fix the security-headers doc | Docs-only; teaches the security posture |
| [#263](https://github.com/hhavynn/vsa-website/issues/263) | Remove hardcoded year from nav label | Small, real, ships something urgent |
| [#262](https://github.com/hhavynn/vsa-website/issues/262) | Surface orphaned public routes | Forces reading the router and nav config |
| [#243](https://github.com/hhavynn/vsa-website/issues/243) | Mobile audit | No code knowledge needed; steers the roadmap |

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

## 6. Guardrails encoded in every issue

Each issue carries the constraints relevant to its area. The recurring ones:

- **Protected domains** — attendance import, points calculation, House membership, leaderboard, RLS. Gated by `vsa-change-control`.
- **Freeze windows** — House pages, application links/gating, and VCN surfaces have an owner-confirmed freeze policy (2026-07-05). Check `vsa-seasonal-operations` before touching them at *any* time of year.
- **Never** — delete Supabase Storage originals · weaken an RLS policy to make a query work · expose check-in codes · hardcode a real application link · expose a closed or future application URL · commit a secret · `npm run eject` · auto-apply migrations to production.
- **Dual points systems** — the public leaderboard and the authenticated check-in flow read and write *different tables* and are not reconciled. Never present them as unified; never fix a leaderboard number by writing to the check-in tables. See `docs/leaderboard-system.md`.
- **Owning skill / subagent** — named per issue, so the right context loads without anyone having to know the skill router.

---

## 7. Known gaps in this roadmap

Stated plainly so nobody mistakes the backlog for a complete picture:

- **Not verified at runtime.** Issues were written from source, migrations, and docs. Nothing was checked against the running production site — the mobile audit ([#243](https://github.com/hhavynn/vsa-website/issues/243)) and the baselines ([#297](https://github.com/hhavynn/vsa-website/issues/297)) exist to close that gap, and their findings should re-rank their epics.
- **Effort not estimated.** Priorities reflect impact and urgency, not cost. Add a `Size` field during grooming.
- **`secure-ai` Edge Function** — its relationship to `vsa-ai-assistant` is unclear from source; [#229](https://github.com/hhavynn/vsa-website/issues/229) resolves whether it's live or vestigial.
- **Feature issues (#215, #216) are proposals, not commitments.** Several may already be partly built — `EventRecapEditor.tsx` and `ThisWeekInVSA.tsx` in particular. Read before building.
