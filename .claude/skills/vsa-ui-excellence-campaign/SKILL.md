---
name: vsa-ui-excellence-campaign
description: Load when working on the VSA website's standing UI-excellence campaign — "make the mobile UI and the whole site beautiful and unique", polishing a public page (home, events, leaderboard, house, gallery, cabinet, points), adding motion/animation, extending the scrapbook visual identity, or when asked "what UI work is next / already done?". Provides the phased, decision-gated campaign plan: state assessment, measurable baseline commands (Lighthouse, axe, bundle size), numbered PR-sized phases with numeric gates, a ranked solution menu, fenced wrong paths, and the promotion protocol through vsa-change-control.
---

# VSA UI Excellence Campaign

**What this is for.** The owner's hardest live problem (owner interview, 2026-07-05) is "maximizing mobile UI and making the entire website's UI beautiful and unique," with the bar set at "design/UX craft indistinguishable from a top-tier product company." This skill is the executable field manual for that campaign: a Sonnet-class session (or a human tech chair) picks up ONE phase, runs it end-to-end with before/after numbers, and hands off. Success is **measured, never eyeballed**. Every phase ships as one PR routed through vsa-change-control.

**When NOT to use this skill:**

| You actually need | Go to |
|---|---|
| The design language itself — tokens, type scale, dark mode, Framer Motion conventions, component layering, mobile patterns | vsa-design-system-reference |
| How to run/interpret Lighthouse, axe, `npm run analyze`, web-vitals, route inventory | vsa-diagnostics-and-measurement |
| Whether a change is allowed, branch/PR conventions, protected domains | vsa-change-control |
| Whether a surface is currently frozen (House reveal, application opens, VCN) | vsa-seasonal-operations |
| What counts as "verified", test commands, QA checklists | vsa-validation-and-qa |
| Debugging broken UI (wrong colors, dark-mode bugs) | vsa-debugging-playbook |

Jargon: **a11y** = accessibility. **gz** = gzip-compressed size. **CLS** = Cumulative Layout Shift. **Degraded mode** = the site's fallback rendering when Supabase is unreachable (see vsa-architecture-contract).

---

## Phase 0 — Campaign state assessment (run at the start of EVERY session)

The campaign is long-running and multi-session. Before doing anything, establish what has already shipped so you do not redo it.

```bash
# 1. What UI work is already on main?
git log --oneline origin/main -- src/components src/index.css src/pages | head -40
git log --oneline origin/main --grep="polish\|mobile\|motion\|skeleton\|sheet\|animate" | head -30

# 2. Confirm the big UI merge (#184) is in your base
git branch --contains c315654e   # must list your current branch
```

### Already done — DO NOT redo (verified merged to main via PR #184, merge commit `c315654e`, as of 2026-07-06)

Mobile roadmap:

| SHA | Shipped |
|---|---|
| `feb4b263` | Modals converted to mobile bottom sheets |
| `acdc00b1` | Skeleton loading states |
| `5902bdd6` | Mobile quick-nav dock |
| `368fbf63` | Swipeable snap rail for ThisWeekInVSA cards on mobile |
| `922305b8` | Remaining mobile UI roadmap items |
| `80037b70` | Mobile gallery browsing fixes |
| `bce6720e` | Mobile gallery browsing upgrade |

Desktop/site polish:

| SHA | Shipped |
|---|---|
| `e0feb783` | Homepage hero motion refresh |
| `2403cff9` | Animated leaderboard counters |
| `51855845` | Spotlight event cards |
| `3af6f448` | Mobile event interaction polish |
| `a28a116e` | Admin dashboard motion polish |
| `cc708c8f` | Leadership profile card polish |

Also already merged: VSA Wrapped + the scrapbook visual identity (`a3d7ea60`, restyle `29ad2114`), site-wide mobile audit fixes (`127f7114`), calendar overhaul (`32e6d6f9`).

If a phase below appears to overlap one of these SHAs, `git show <sha> --stat` first; extend, don't rebuild.

---

## Phase 1 — Baseline gate (mandatory before the first new UI PR)

**Rule: no UI PR without before/after numbers.** A PR body that says "looks better" is an automatic rejection. Capture the baseline once, commit it to the campaign ledger (bottom of this file), and diff against it in every subsequent PR.

Interpretation guides for every instrument below live in **vsa-diagnostics-and-measurement** — this section only lists the campaign's exact capture procedure.

```bash
# 0. Route inventory (what surfaces exist, by tier)
node .claude/skills/vsa-diagnostics-and-measurement/scripts/route-inventory.mjs

# 1. Bundle sizes (verified scripts in package.json)
npm run analyze        # JS chunks via source-map-explorer
npm run analyze:css    # CSS
# Record: main chunk gz KB, total JS gz KB, CSS gz KB.

# 2. Lighthouse mobile, per key route (dev server on :3000; use a production
#    build via `npx serve -s build` for numbers you intend to publish)
for r in / /events /leaderboard /house /gallery /cabinet /points; do
  npx lighthouse "http://localhost:3000$r" \
    --only-categories=performance,accessibility,best-practices \
    --form-factor=mobile --screenEmulation.mobile \
    --output=json --output-path="./lighthouse-$(echo $r | tr '/' '_').json" \
    --chrome-flags="--headless"
done
# Record per route: perf score, a11y score, best-practices score, CLS, LCP.

# 3. axe accessibility violations per key route
for r in / /events /leaderboard /house /gallery /cabinet /points; do
  npx @axe-core/cli "http://localhost:3000$r" --exit || echo "VIOLATIONS on $r"
done
# Record: violation count + rule ids per route.
```

Notes:
- `npx lighthouse` and `npx @axe-core/cli` are fetched on demand (not repo dependencies) — needs network. Do NOT add them to package.json (heavy-deps rule, AGENTS.md "Don't add heavy dependencies without explicit justification", line ~268).
- Baseline numbers cannot be derived from the repo alone. Record each as **"baseline X₀ — capture on first run"** in the ledger until an actual run fills it in.
- Lighthouse output files and `lighthouse-*.json` must NOT be committed.

---

## Campaign phases (numbered, PR-sized, decision-gated)

**Surface order is fixed: public before admin.** Public surfaces from `src/routes/index.tsx` (verified 2026-07-06): `/`, `/events`, `/calendar`, `/leaderboard`, `/cabinet`, `/get-involved`, `/gallery`, `/ace`, `/house` (+ `/house/archive/...`, `/house/year/...`, `/house/:houseSlug`), `/house-system`, `/intern-program`, `/vcn` (+ `/vcn/current`, `/vcn/archive`), `/wild-n-culture`, `/uvsa-network`, `/privacy`. Points lookup lives at `/points` (Find My Points).

### The universal gate (applies to every phase)

Run before opening the PR; paste results into the PR body.

```bash
npm run lint && npm run build
CI=true npm test -- --watchAll=false
npm run analyze                       # compare vs baseline
# Lighthouse + axe on the touched route(s), commands from Phase 1
```

**Numeric gate criteria — ALL must hold or the phase does not ship:**

| Metric | Gate |
|---|---|
| Lighthouse a11y (touched routes) | ≥ baseline X₀ (no regression) |
| Lighthouse perf (touched routes) | ≥ baseline − 2 points |
| axe violations (touched routes) | zero NEW violations |
| Main JS bundle delta | ≤ +5 KB gz per phase |
| CLS (touched routes) | ≤ baseline |
| lint/build/test | all exit 0 |

**If the bundle gate is exceeded → branch to a bundle-diet step**: run `npm run analyze`, identify the growth (usually an accidentally-imported module or un-lazy component), fix via lazy loading / import pruning, re-measure. Only if diet fails, ask the owner whether the feature justifies the bytes — never silently ship the regression.

**Every phase:** check vsa-seasonal-operations freeze windows BEFORE starting (House pages, application surfaces, and VCN pages freeze around reveals/opens); route the PR through vsa-change-control (branch naming, PR title regex, classification); one phase = one PR.

**Rollback note (all phases):** these are presentation-only changes — rollback is `git revert <merge-sha>` of the phase PR. No migrations, no data. If a phase accidentally touched data logic, it violated the fence below and must be reverted immediately.

### Phase sequence

Each phase: **objective → verify with the universal gate → surface-specific checks → ship**.

| # | Phase (one PR each) | Objective | Surface-specific verification |
|---|---|---|---|
| 2 | Home identity pass | Extend scrapbook identity (solution A) from WrappedRecapCard/ThisWeekInVSA to remaining home sections; unify motion timings | Hero motion (`e0feb783`) untouched or improved; 375px snap rail (`368fbf63`) still swipes; degraded-mode home renders |
| 3 | Events surface | Spotlight cards (`51855845`) coherence pass + list/detail motion language; empty + skeleton states on-token | Drafts still excluded from public list; check-in codes never rendered; bottom sheets (`feb4b263`) intact |
| 4 | Leaderboard | Visual distinction pass (podium/house treatment) WITHOUT touching ranking data logic | Counters (`2403cff9`) still animate; numbers identical before/after (screenshot + DOM text diff); zero repo-layer diffs |
| 5 | House pages | Scrapbook/house-color identity on `/house`, archive, detail | FREEZE CHECK mandatory (vsa-seasonal-operations); house-year mapping untouched; never invent 2026–27 Houses |
| 6 | Gallery | Polish on top of `bce6720e`/`80037b70` (lightbox motion, masonry rhythm) | Image loading stays lazy; no Supabase Storage URL changes (egress — see vsa-failure-archaeology) |
| 7 | Cabinet | Profile-card system pass on top of `cc708c8f`/`ada86e21` | No fake members; current vs archive never mixed |
| 8 | Points lookup (`/points`) | Make Find My Points feel first-class (motion, states) | Presentation only — zero changes to points math or queries (protected domain) |
| 9 | Calendar + program pages (`/calendar`, `/get-involved`, `/ace`, `/intern-program`, `/vcn*`, `/wild-n-culture`, `/uvsa-network`) | Consistency sweep: tokens, type scale, motion, empty states | FREEZE CHECK for ace/vcn/application surfaces; closed/future application URLs never exposed |
| 10 | Showpiece component (solution C) | ONE reimplemented signature interaction on the highest-traffic surface | Bundle gate is the hard constraint; `useReducedMotion` fallback required |
| 11 | Typography/spacing refinement (solution D) | Site-wide rhythm audit → single tokens-level PR | Visual-diff screenshots at 375/768/1280 in PR body |
| 12+ | Admin surfaces | Only AFTER 2–11 are green | Extends `a28a116e`; same gates |

Do not run phases in parallel across sessions without checking `git log origin/main` for a phase that already landed (Phase 0).

---

## Solution menu, ranked (for "beautiful AND unique")

Ranked by (uniqueness gained) / (risk × effort). Evidence obligation = what the PR body must prove.

**A. Extend the merged scrapbook identity — RANK 1.**
The site already owns a unique visual language, shipped with VSA Wrapped and now used across home, calendar, points, and house components: `scrapbook-paper`, `scrapbook-photo`, `scrapbook-note`, `scrapbook-pin`, `scrapbook-sticker-{teal,coral,gold}`, `scrapbook-tape-{teal,coral,gold}`, `--tape-*` CSS variables — all in `src/index.css` (verified lines ~369–630, 2026-07-06). Extending it via existing classes + framer-motion reveals costs ~0 KB bundle.
- Effort: low per surface. Risk: low (CSS classes exist; dark-mode variants exist).
- Evidence obligation: before/after screenshots at 375px + dark mode; bundle delta ≈ 0; a11y unchanged.
- Restraint rule: scrapbook is an **accent**, not a theme — cap at 1–2 scrapbook-treated elements per viewport; admin surfaces stay clean.

**B. Motion-language upgrades — RANK 2.**
Stay inside the established conventions (vsa-design-system-reference owns them): easing `[0.22, 1, 0.36, 1]` (verified 5 uses in src/), 0.4–0.62s reveals, `useReducedMotion` guard (verified 14 files use it). Upgrades = staggered list reveals, shared-layout transitions, scroll-linked accents.
- Effort: low–medium. Risk: low–medium (jank on low-end phones).
- Evidence obligation: CLS ≤ baseline; interaction demo (screen recording or GIF) at 375px; `useReducedMotion` path shown in the diff.

**C. Reactbits-style showpiece components, RE-IMPLEMENTED — RANK 3.**
Signature interactions (e.g. count-up odometers, magnetic buttons, decrypt-text reveals) built **from scratch with framer-motion + Tailwind**. NEVER installed as a dependency — reactbits and similar kits fail the AGENTS.md heavy-deps rule and would fight the token system. One showpiece per phase, on the highest-traffic surface.
- Effort: medium–high. Risk: medium (bundle, a11y, uniqueness backfiring into gimmick).
- Evidence obligation: bundle delta ≤ +5 KB gz measured via `npm run analyze`; zero new axe violations; reduced-motion fallback; owner sign-off on the concept BEFORE building (post a description/sketch, not after-the-fact code).

**D. Typography/spacing refinement — RANK 4 (highest craft-per-byte, least visible).**
Consistent type scale, line-length caps, spacing rhythm, optical alignment. This is what actually makes a site read as "top-tier product company"; it just never demos well.
- Effort: medium (audit-heavy). Risk: low.
- Evidence obligation: side-by-side screenshots per breakpoint; zero bundle delta; list of token-level (not one-off) changes.

Default play: A + B together per surface phase; C sparingly (phases with owner pre-approval); D as its own dedicated phase (11).

---

## Fenced wrong paths (attempted or tempting — do not go here)

| Wrong path | Why fenced |
|---|---|
| Installing UI kits / animation libraries (reactbits, react-spring, GSAP, shadcn as dep, etc.) | AGENTS.md heavy-deps rule; framer-motion + Tailwind already cover the space; kits fight the semantic token system and blow the bundle gate. Re-implement instead (solution C). |
| New `.css` files | The design system is Tailwind + `src/index.css` layers. Lone existing exception: `src/styles/ace.css`. New CSS files fragment theming and dodge dark-mode tokens. |
| Inline `style={{...}}` for anything token-expressible | Invisible to the token system; breaks dark mode; unreviewable. (Dynamic values like framer-motion transforms are fine.) |
| Hardcoded colors (`#14b8a6`, `text-teal-500`, …) | Must use semantic tokens (vsa-design-system-reference). Hardcoded colors are the #1 source of dark-mode bugs (vsa-debugging-playbook). |
| Polishing admin surfaces before public ones | Owner priority is member-facing beauty; admin has ~10 users. Admin waits until phase 12+. |
| Touching data logic while restyling (points math, leaderboard queries, attendance, House membership, repo layer) | Protected domains (vsa-change-control). A restyle PR with a `src/data/` diff is auto-reject. Presentation and data changes never share a PR. |
| Shipping UI to frozen surfaces (House pages near reveal, application pages near opens, VCN near show) | Freeze windows, owner-confirmed 2026-07-05 (vsa-seasonal-operations owns the calendar and pre-change check). |
| Judging by screenshots alone / "looks good to me" | The campaign's core rule is measurement. Screenshots are evidence of appearance, not of a11y, CLS, bundle, or reduced-motion behavior. Numbers or it didn't happen. |
| Redoing merged work because it "could be better" | Phase 0 list. Extend with evidence of a specific deficiency, never rewrite. |

---

## Validation-and-promotion protocol

### Per-PR checklist (paste into PR body, all boxes required)

```markdown
- [ ] `npm run lint && npm run build` exit 0
- [ ] `CI=true npm test -- --watchAll=false` exit 0 (known jsdom/Framer warnings OK)
- [ ] Metrics table below filled in (before = ledger baseline, after = this branch)
- [ ] Verified at 375px AND 768px emulation (DevTools device toolbar)
- [ ] Dark mode verified at both widths
- [ ] Reduced-motion verified (emulate prefers-reduced-motion)
- [ ] Degraded mode unaffected (Supabase-down fallback still renders — see vsa-debugging-playbook)
- [ ] a11y: zero new axe violations; Lighthouse a11y ≥ baseline
- [ ] No diffs outside presentation files (no src/data/, no supabase/)
- [ ] Freeze-window check passed (vsa-seasonal-operations)

| Metric | Before | After |
|---|---|---|
| Lighthouse perf / a11y / BP (route) | | |
| CLS / LCP (route) | | |
| axe violations (route) | | |
| Main JS gz / total JS gz | | |
```

Then route through **vsa-change-control**: correct branch prefix, conventional-commit PR title (enforced by the pr-title workflow), classification (UI polish on public non-frozen surfaces is routine; anything brushing protected domains is gated), owner review for solution-C showpieces.

**Promotion:** a phase is DONE only when its PR is merged to main AND its ledger row below is appended (separate follow-up commit to this file is fine).

### Campaign ledger (append one row per merged phase — do not delete rows)

| Date | Phase | PR | Metrics before → after (perf/a11y/bundle) |
|---|---|---|---|
| 2026-07-04 (pre-campaign) | Mobile roadmap + desktop polish | #184 (`c315654e`) | baseline X₀ — capture on first run |
| | | | |

---

## Definition of done — initial targets, owner may revise

The campaign is complete when ALL of the following hold, verified by re-running the Phase 1 commands (falsifiable — each line is a number someone can check):

1. Every public route scores Lighthouse mobile **a11y ≥ 95** and **best-practices ≥ 95**; **perf ≥ baseline X₀ and ≥ 85** on a production build.
2. **Zero axe violations** on all public routes at 375px and 1280px, light and dark.
3. Main JS bundle gz ≤ **baseline X₀ + 25 KB** total across the whole campaign.
4. Phases 2–11 all have merged PRs and ledger rows with before/after numbers.
5. Every public surface uses only semantic tokens (spot-check: `grep -rn "#[0-9a-fA-F]\{6\}" src/components src/pages` returns no new hardcoded colors vs baseline) and every animation added by the campaign has a `useReducedMotion` path.
6. The "unique" test: at least 3 public surfaces carry the scrapbook identity or a bespoke showpiece that appears in no component library (owner confirms by inspection — the one permitted subjective check, exercised once at campaign close).

If the owner revises targets, edit this section in place and date-stamp the revision.

---

## Provenance and maintenance

Sources (all verified 2026-07-06 in this repo):
- Owner interview answers dated 2026-07-05 (hardest problem, quality bar, freeze windows) — restated here; freeze-window mechanics owned by vsa-seasonal-operations.
- Merged UI work: `git log` — SHAs `feb4b263`, `acdc00b1`, `5902bdd6`, `368fbf63`, `922305b8`, `80037b70`, `bce6720e`, `e0feb783`, `2403cff9`, `51855845`, `3af6f448`, `a28a116e`, `cc708c8f`, merged via PR #184 merge commit `c315654e` (confirmed `git branch --contains c315654e` includes origin/main).
- Scrapbook classes/variables: `src/index.css` lines ~88–90 (`--tape-*`), ~369–630 (`.scrapbook-*`, `.scrapbook-sticker-*`, `.scrapbook-tape-*`); usage across `src/components/features/{home,calendar,points,house,wrapped}` via `grep -rln scrapbook src/`.
- Motion conventions: 5 uses of easing `[0.22, 1, 0.36, 1]` and 14 files with `useReducedMotion` in `src/` (grep counts).
- Scripts: `package.json` lines 38–40 (`analyze`, `analyze:css`, `analyze:all`); route inventory helper at `.claude/skills/vsa-diagnostics-and-measurement/scripts/route-inventory.mjs`.
- Routes: `src/routes/index.tsx` lines ~186–290.
- Heavy-deps rule: `AGENTS.md` ("Don't add heavy dependencies without explicit justification").

UNVERIFIED / capture-on-first-run: all baseline metric values (Lighthouse, axe, bundle sizes); `npx lighthouse` / `npx @axe-core/cli` exact CLI flags (standard tools, not repo deps — adjust flags if versions drift).

Re-verification one-liners:

```bash
git branch --contains c315654e | grep -q . && echo merged        # #184 still in base
grep -c "scrapbook" src/index.css                                # identity classes exist
grep -n '"analyze' package.json                                  # analyze scripts intact
ls .claude/skills/vsa-diagnostics-and-measurement/scripts/       # route-inventory.mjs exists
grep -rn "path=" src/routes/index.tsx | head -30                 # route inventory drift
grep -rln "useReducedMotion" src/ | wc -l                        # motion guard adoption
```
