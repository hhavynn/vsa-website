---
name: vsa-research-frontier
description: Load when brainstorming what to build next on the VSA website, when someone asks "how do we make X best-in-class / beat state of the art for an org website", when evaluating whether an ambitious idea is ready to start, or for roadmap and strategy questions. Catalogs the OPEN and CANDIDATE frontier problems where this project can advance the state of the art for its class (best-in-class student-org website), ranked by impact x readiness, each with repo evidence, this project's specific asset, the first three concrete steps in this repo, and a falsifiable "you have a result when…" milestone. Also lists what NOT to research. Trigger keywords: what should we build next, roadmap, strategy, best-in-class, state of the art, SOTA, ambitious idea, frontier, research direction, is this worth doing.
---

## What this skill is for

This is the **frontier map**: the open problems where the VSA website can plausibly
become best-in-class for its class of software (a student-org website), stated
as falsifiable research questions rather than tasks. Load it when you are
deciding *what* to pursue and whether an ambitious idea is *ready*, not when you
already know what to build.

Owner's definition of "beyond state of the art" (2026-07-05, `AGENTS.md` owner
interview): a **best-in-class org website** whose design/UX craft is
indistinguishable from a top-tier product company. Everything here is labeled
**OPEN** (unsolved, worth pursuing) or **CANDIDATE** (plausible but unproven);
nothing is presented as shipped.

### When NOT to use this skill

| If you are… | Use instead |
|---|---|
| Executing the UI-excellence work (phases, gates, commands) | **vsa-ui-excellence-campaign** |
| Trying to *prove* a hunch — evidence bar, hypothesis-predicts-numbers, review | **vsa-research-methodology** |
| Measuring a specific thing (Lighthouse, axe, bundle, egress) | **vsa-diagnostics-and-measurement** |
| Checking whether a change is allowed / touches a protected domain | **vsa-change-control** |
| Looking up the design tokens/patterns to implement UI | **vsa-design-system-reference** |
| Understanding why a past attempt failed | **vsa-failure-archaeology** |

This skill *frames* problems and readiness. It does not execute, prove, or
measure — it routes to the skills above for those.

---

## How to read a frontier entry

Each problem below gives four things, per the owner's frontier template:

1. **Why current state falls short** — with repo evidence.
2. **This project's specific asset** — the unfair advantage that makes the
   problem tractable *here*.
3. **First three concrete steps IN THIS REPO** — real files and commands.
4. **Falsifiable milestone** — "you have a result when…". If you cannot state a
   milestone that could fail, the idea is not ready.

---

## Ranked frontier (impact x readiness)

Ranking = *how much it moves the owner's "best-in-class org website" goal* x *how
ready the repo is to start today (assets in place, no blockers, evidence
verifiable now)*. Highest first.

| Rank | Problem | Impact | Readiness | State | Note |
|---|---|---|---|---|---|
| 1 | **F1** Product-company-grade UI | Very high | High | OPEN | The owner's stated hardest problem; campaign already running. Execute via **vsa-ui-excellence-campaign**. |
| 2 | **F6** Zero-egress media finish line | High | High | OPEN | Public surfaces already appear migrated; what's left is *proving* it and closing the admin/write path. Cheap, high-confidence. |
| 3 | **F5** Characterization tests for protected domains | High | High | OPEN | Cheap to start; protects the exact logic (points/dates/seasonal) that past incidents burned. |
| 4 | **F3** Ask VSA answer-quality eval | Medium-high | Medium | CANDIDATE | v2 retrieval + `ai_feedback` table already shipped; needs a *frozen eval set* and a scored harness. |
| 5 | **F2** Points-system consolidation | High | Low | OPEN | Protected domain; blocked on `user_id` coverage. Start READ-ONLY audits only. |
| 6 | **F4** Autonomous-maintenance maturity | Medium | Medium | CANDIDATE | Meta-goal; methodology-heavy. Prove via **vsa-research-methodology**. |

Readiness caveats: F2 is *low* readiness because it touches a protected domain
(see **vsa-change-control**) and cannot start with any write. F1 is the flagship
by impact but is an *execution* campaign, not a research question — the frontier
framing here is only the "measurable SOTA" definition; the work itself lives in
**vsa-ui-excellence-campaign**.

---

## F1 — Product-company-grade UI on a student-org budget (FLAGSHIP, OPEN)

**Why current state falls short.** The owner's hardest live problem (2026-07-05):
"maximizing mobile UI and making the entire website's UI beautiful and unique."
The campaign is underway (recent commits on `codex/reactbits-ui`: bottom sheets,
skeletons, quick-nav dock, snap rail) but two perceived-performance techniques
that top product apps use are **absent from `src/` as of 2026-07-06**:

- **No optimistic updates.** `grep -rn "onMutate" src/` returns **0** matches —
  every react-query mutation waits for the server round-trip before the UI
  reflects it.
- **No View Transitions.** `grep -rn "startViewTransition\|useViewTransition" src/`
  returns **0** — route/element transitions are Framer-only, no cross-document
  or same-document view-transition morphs.

The gap is not "it looks bad" — it is that **"best-in-class" is not yet defined
as numbers**, so nobody can say when it's reached.

**This project's specific asset.** A complete design system already exists
(semantic tokens, Framer Motion conventions, a scrapbook identity — see
**vsa-design-system-reference**), plus measurement instruments already wired
(`web-vitals` dependency, `npm run analyze`, axe/Lighthouse procedure in
**vsa-diagnostics-and-measurement**). You can *define and measure* SOTA today.

**First three concrete steps in this repo.**

1. Freeze a **measurable "SOTA org website" rubric** as the campaign baseline —
   propose these targets (confirm/adjust with the owner): Lighthouse mobile
   Performance ≥ 95, Accessibility = 100, Best-Practices ≥ 95; axe = 0 serious/
   critical violations; LCP < 2.0s and CLS < 0.05 on the home + events + house
   pages. Record the *current* numbers first (see next step).
2. Capture the baseline with the exact commands in
   **vsa-diagnostics-and-measurement** (Lighthouse, axe, `npm run analyze`,
   web-vitals) so every future gate compares against a real number, not a
   memory.
3. Pick ONE distinctive-identity or perceived-performance technique to pilot
   behind the campaign's decision gates — e.g. optimistic updates on the
   points/check-in mutation, or a View Transition on a single route pair — and
   run it through the phased plan in **vsa-ui-excellence-campaign**. Do not
   batch several at once.

**Falsifiable milestone.** You have a result when the home, events, and house
pages hit the frozen rubric numbers on a real mobile Lighthouse/axe run (0
serious axe violations, Perf ≥ 95), *and* at least one perceived-performance
technique (optimistic update or view transition) ships and demonstrably removes
a visible server-wait on a core interaction. If the numbers regress, the result
is falsified.

> Execution note: the *how* (phases, gates, ranked solution menu, wrong paths)
> lives in **vsa-ui-excellence-campaign** and promotes through
> **vsa-change-control**. This entry only fixes the definition and the milestone.

## F2 — Points-system consolidation (OPEN, protected domain)

**Why current state falls short.** Two parallel points systems exist. Verified
in `docs/leaderboard-system.md` "Future Considerations" (L44): the public
leaderboard is served by `members` + `member_event_attendance` (+ `academic_terms`
/ the `member_yearly_points` view), while a **secondary** system —
`event_attendance` (`supabase/migrations/20240320000003_create_event_attendance.sql`)
and `user_points` (`supabase/migrations/20240320000011_create_user_points.sql`) —
tracks authenticated self check-ins. Two sources of truth for "how many points
does a person have" is the classic setup for divergence and reconciliation bugs.
The doc names the blocker explicitly: consolidate "once `user_id` coverage is
verified for all members."

**This project's specific asset.** The unification hook already exists in the
schema: `members.user_id uuid REFERENCES auth.users(id)` (verified in
`supabase/migrations/20240328000000_create_members_table.sql` L10). So a member
row *can* be linked to an auth user — the question is only *how many are*, which
is a read-only query away.

**First three concrete steps in this repo** — all READ-ONLY (this is a protected
domain per `AGENTS.md` "Things to never do": *don't modify points calculation or
leaderboard unless explicitly requested*). **No writes until the owner accepts
acceptance criteria — route through vsa-change-control.**

1. **Draft the `user_id` coverage audit** (read-only). Do not run it against prod
   without the owner; draft and review it first:
   ```sql
   -- What fraction of leaderboard members are linked to an auth user?
   select
     count(*)                              as total_members,
     count(*) filter (where user_id is null) as unlinked_members,
     round(100.0 * count(*) filter (where user_id is not null) / nullif(count(*),0), 1)
                                           as pct_linked
   from public.members;
   ```
2. **Draft the reconciliation query** that compares the two systems for the
   *same person* (join `members` → `event_attendance`/`user_points` via `user_id`)
   and surfaces any point total that disagrees. Keep it read-only; this is the
   evidence that consolidation is even safe.
3. **Write acceptance criteria, not code.** Take the coverage % and the
   reconciliation diff to the owner via **vsa-change-control**; consolidation
   cannot begin until there is an owner request + accepted criteria.

**Falsifiable milestone.** You have a result when **one system feeds both the
public leaderboard and the authenticated check-in surface**, and the reconciled
per-person totals are **proven equal to the pre-consolidation totals on
historical data** (a diff query returns zero rows). If any historical total
changes, the migration is falsified and must not ship.

## F3 — Ask VSA as a best-in-class org assistant (CANDIDATE)

**Why current state falls short.** Ask VSA v2 shipped real retrieval quality
machinery, verified:
- Retrieval metadata (`aliases text[]`, `freshness`, `valid_until`,
  `academic_year`, confidence) added in
  `supabase/migrations/20260704000000_ai_knowledge_v2_schema.sql`, with a
  retrieval function that "skips expired entries, matches on aliases, surfaces
  year/confidence" (same file, L60), plus dedupe/expansion migrations
  (`20260704000001_ai_knowledge_v2_dedupe.sql`, `..._expansion.sql`).
- A feedback loop table `ai_feedback` (`rating`, `answer_excerpt`, `page_path`,
  `category`, `feedback_text`) in
  `supabase/migrations/20260617000001_add_ai_feedback.sql` — public can INSERT,
  public **cannot SELECT** (implicit deny), admins manage.

What's missing is **measured answer quality**. There is no eval set and no score,
so "the assistant is good" is currently an assertion, not a number. The behavior
rules live in the Edge Function `SYSTEM_PROMPT`
(`supabase/functions/vsa-ai-assistant/index.ts` L34) and volatile facts live in
`ai_knowledge_base` rows — a clean prompt-vs-DB split (see
**vsa-architecture-contract**) — but nothing tells you the *hit rate*.

**This project's specific asset.** The `ai_feedback` table is a **built-in
labeled-data source**: real user questions (`page_path`), real answer excerpts,
and a human `helpful` / `not_helpful` label. That is exactly the raw material for
an eval set — most org assistants have to invent test questions from scratch.

**First three concrete steps in this repo.**

1. **Build a frozen eval set from `ai_feedback` rows** (admin/service access only;
   the table is not public). Export a representative sample of real questions +
   expected-answer facts (grounded in `ai_knowledge_base`), freeze it as a file,
   and never let the model see it during development.
2. **Write a scoring harness** that runs each frozen question through the same
   retrieval + prompt path as `supabase/functions/vsa-ai-assistant/index.ts` and
   scores answers (correct / incorrect / privacy-violation). Reuse the retrieval
   function from the v2 schema migration so you test the *real* path.
3. **Add a privacy assertion to every eval case**: the answer must never surface
   private member data, emails, check-in codes, or closed/future application URLs
   (`AGENTS.md` "Things to never do"). A privacy violation is an automatic fail
   regardless of correctness.

**Falsifiable milestone.** You have a result when the assistant scores **≥ X%
correct on a frozen eval set** (owner sets X; pick it *before* running so you
can't move the goalpost) with **zero privacy violations**. Re-running the frozen
set after a knowledge-base change gives a comparable number. If correctness can't
be reproduced across runs, the result is falsified.

> Methodology (freezing the set, avoiding leakage, hypothesis-predicts-number):
> **vsa-research-methodology**. Privacy/RLS specifics: **vsa-supabase-security-reference**.

## F4 — Autonomous-maintenance maturity (CANDIDATE)

**Why current state falls short.** This repo already runs multi-agent
development: 12 domain playbooks in `.claude/agents/*.md` (verified:
`vsa-admin-workflows`, `vsa-points-attendance-guardian`, `vsa-storage-egress`,
etc. + `README.md`), a graphify knowledge graph, and this very skill library.
Branches are prefixed by agent (`claude/`, `codex/`, `gemini/`, `antigravity/`).
But there is no *demonstrated* end-to-end run where a **cheap-model** session
takes a gated change from start to merge-ready with **zero manifest
(`AGENTS.md`) violations**. "The agents work" is currently a workflow, not a
proven capability with a pass/fail record.

**This project's specific asset.** The manifest itself is machine-checkable: many
`AGENTS.md` rules have concrete detectors (e.g. "don't query Supabase from a
component" → grep for `supabase` imports outside `src/data/repos/`; "don't
hardcode color classes" → grep for `text-gray-`/`bg-white`; PR-title regex in
`.github/workflows/pr-title.yml`). A run can be *scored* against the manifest
mechanically.

**First three concrete steps in this repo.**

1. **Pick a small gated change with crisp acceptance criteria** — e.g. a
   characterization test from F5, or a docs fix — something touching exactly one
   domain and one playbook in `.claude/agents/`.
2. **Define the manifest-violation checklist as commands** (the verification trio
   `npm run lint && npm run build`, `CI=true npm test -- --watchAll=false`, plus
   the grep-based `AGENTS.md` detectors). This checklist *is* the pass/fail
   oracle. Detailed evidence bar: **vsa-validation-and-qa**.
3. **Run the change on a cheap model** end-to-end (branch → change → verification
   trio → PR-ready) and record every violation the checklist catches.

**Falsifiable milestone.** You have a result when a **cheap-model session
completes a gated change end-to-end with zero `AGENTS.md` violations** caught by
the checklist, reproducibly (a second, different small change also passes clean).
If the cheap model needs manual rescue on either run, the capability is
falsified for now.

> This is a *methodology* claim about how work gets done here — prove it the way
> **vsa-research-methodology** prescribes (hypothesis, adversarial review,
> branch lifecycle), not by anecdote.

## F5 — Characterization-test coverage for protected domains (OPEN)

**Why current state falls short.** The most dangerous logic in the repo (points,
dates, seasonal state) is the least defended by tests. Derive the current test
set with `find src -name "*.test.ts*" | sort`; the authoritative inventory and
coverage gaps live in **vsa-validation-and-qa** §2. Never repeat a copied count.

Even at 10, coverage is thin relative to risk: the protected domains named in
`AGENTS.md` ("Things to never do": points calculation, House membership,
leaderboard) are exactly the pure functions where a silent behavior change would
recreate a past incident. A **characterization test** (a snapshot of *current*
output for a range of inputs) turns "did this refactor change points math?" from
a guess into a red/green signal.

**This project's specific asset.** The riskiest logic is already isolated in
pure, dependency-free functions (date/seasonal/points helpers in `src/utils/`
and `src/lib/`) — pure functions are trivial to snapshot without mocking
Supabase or React. Some are already covered (`seasonalState`, `calendar`,
`dateOnly`, `memberMatching`), proving the pattern works here.

**First three concrete steps in this repo.**

1. **Inventory the untested pure functions in protected domains.** Use
   `./scripts/graphify-run explain "points calculation"` and
   `./scripts/graphify-run query "pure functions for points and House standings"`
   to find the points/standings helpers not yet in the test list above.
2. **Snapshot the highest-risk one first** — the points/standings math — by
   writing a characterization test that feeds a representative input matrix and
   asserts the *current* output (Jest `toMatchSnapshot` or explicit expected
   values). Follow the "how to add a test" pattern in **vsa-validation-and-qa**.
3. **Run it green, then intentionally perturb the function** locally to confirm
   the test goes red (a characterization test that can't fail proves nothing).
   Revert the perturbation.

**Falsifiable milestone.** You have a result when every pure function in a named
protected domain (start with points/standings, then date/seasonal) has a
characterization test that (a) passes on `main` and (b) demonstrably goes red
when the function's output changes. If a deliberate behavior change slips through
green, the coverage is falsified.

## F6 — Zero-egress media architecture: the finish line (OPEN)

**Why current state falls short.** The Supabase egress crisis (a costliest-ever
incident — see **vsa-failure-archaeology**) drove an image-migration pipeline
that moves media out of Storage and serves it from `public/`
(`docs/event-image-migration.md`, `docs/house-image-migration.md`,
`scripts/migrate-supabase-images-to-public.ts`, and the
`.claude/agents/vsa-storage-egress.md` playbook). The **public read path already
looks migrated**: `grep -rln "storage/v1/object\|\.storage\.from\|supabase.co/storage"`
over `src/pages` and `src/components/features` **excluding admin** returns **0
matches** as of 2026-07-06. But the crisis isn't declared *finished* because:

- Remaining Storage references are all in **admin/write surfaces** (verified list:
  `src/components/features/admin/HouseImagesManager.tsx`,
  `.../HouseEventsManager.tsx`, `src/pages/Admin/*`, `src/lib/imageUpload.ts`,
  `src/data/repos/photoRequests.ts`, `src/data/repos/aceFamilies.ts`) plus the
  transform helper `src/lib/supabaseImages.ts`. Uploads still land in Storage;
  whether every uploaded asset then gets migrated to `public/` before it's served
  publicly is not proven by a standing check.
- There is no **standing audit** asserting "no public surface serves a Storage
  URL." Today's clean grep is a snapshot, not a guardrail — a new feature could
  reintroduce a Storage URL on a public page and nobody would notice until the
  next bill.

**This project's specific asset.** The audit tooling already exists:
`docs/supabase-usage-audit.sql` (Storage egress by bucket) and the
`vsa-storage-egress` agent + `npm run migrate:images:{dry,apply}` pipeline. You
can *measure* egress and *enforce* the invariant, not just eyeball it (see
**vsa-diagnostics-and-measurement**).

**First three concrete steps in this repo.**

1. **Re-run the public-surface audit as the baseline** and save it:
   ```bash
   grep -rln "storage/v1/object\|\.storage\.from\|supabase.co/storage" \
     src/pages src/components/features | grep -viE "admin|Admin"
   ```
   Expected today: empty. Any hit is a regression to fix first.
2. **Audit live egress** with `docs/supabase-usage-audit.sql` (read-only) to
   confirm Storage bandwidth is archive-level, not serving traffic. Interpretation
   guide: **vsa-diagnostics-and-measurement**.
3. **Trace the admin upload path** (`src/lib/imageUpload.ts` →
   `src/components/features/admin/*`) to confirm every newly uploaded asset is
   migrated to `public/` before any public surface links to it — i.e. Storage is
   truly write/archive-only, never a public read source.

**Falsifiable milestone.** You have a result when **all public surfaces are
served from repo `public/`** (the grep in step 1 stays empty, ideally enforced by
a standing check/test), Storage is **archive-only** (no public reads), and the
`docs/supabase-usage-audit.sql` egress numbers confirm Storage bandwidth is
negligible. If any public page is caught serving a Storage URL, the finish line
is falsified.

> **Never delete Storage originals** (`AGENTS.md`: "Don't delete database rows or
> Supabase Storage files"). "Archive-only" means *stop serving publicly*, not
> *delete*. Operational detail: **vsa-run-and-operate**.

---

## What NOT to research

These are off the frontier. They are heavy, unrequested, or already-settled — do
not open them as "research directions," and push back if someone proposes one.

```text
DO NOT RESEARCH — with reason

1. CRA → Next.js (or Vite/Remix) framework rewrite
   Reason: Huge, unrequested, and re-risks everything (routing, auth, provider
   hierarchy, build/deploy). The owner's goal is a best-in-class *org website*,
   not a framework migration. AGENTS.md even forbids `npm run eject`. If perf is
   the concern, chase it via F1's measured rubric, not a rewrite.

2. Replacing Supabase (Postgres/Auth/Storage/Edge Functions)
   Reason: The entire backend, RLS security model, and 89+ migrations are built
   on it. Swapping it out throws away every settled security battle
   (RLS recursion fix, check-in secrets, egress migration) for no user-visible
   gain. Not a frontier — a demolition.

3. Auth redesign (admin-only sign-in / public-browsing rework)
   Reason: Already tried and REVERTED — commit a4b2fca9
   ("Revert 'Redesign authentication: admin-only sign-in, public browsing for
   general members'"). Settled battle; see vsa-failure-archaeology before even
   thinking about it.

4. Anything that weakens or routes around AGENTS.md protections
   Reason: Broadly modifying RLS, deleting DB rows or Storage files, exposing
   private member data / emails / check-in codes / closed application URLs,
   changing points/attendance/House/leaderboard logic without an explicit owner
   request, faking events/members/standings, or adding heavy deps. These are the
   "Things to never do" list — non-negotiable, not research questions.

5. Speculative AI features beyond measured answer quality (F3)
   Reason: Adding new AI surfaces before Ask VSA is measured on a frozen eval set
   is building on sand. Prove F3's number first. AGENTS.md also bounds AI code
   location ("Don't add OpenAI API calls outside src/components/features/ai/").
```

---

## Provenance and maintenance

**Owner definition (2026-07-05, re-stated 2026-07-06):** "beyond state of the
art" = best-in-class org website, craft indistinguishable from a top-tier product
company; hardest live problem = mobile + site-wide UI beauty. Source: `AGENTS.md`
owner interview (dated in the manifest / change-control record). Re-confirm with
the owner before treating any milestone number (F1 rubric, F3 "X%") as fixed.

**Sources used (repo artifacts, verified 2026-07-06):**

| Claim | Source | Re-verify |
|---|---|---|
| No optimistic updates / view transitions in src | grep, 0 matches | `grep -rn "onMutate\|startViewTransition\|useViewTransition" src/` |
| Dual points systems, consolidation is future work | `docs/leaderboard-system.md` L42–44 | `grep -n -A3 "Future Consideration" docs/leaderboard-system.md` |
| `members.user_id` FK exists | `supabase/migrations/20240328000000_create_members_table.sql` L10 | `grep -n "user_id" supabase/migrations/20240328000000_create_members_table.sql` |
| Points tables `event_attendance` / `user_points` | `..._create_event_attendance.sql`, `..._create_user_points.sql` | `ls supabase/migrations/ \| grep -iE "event_attendance\|user_points"` |
| Ask VSA v2 retrieval (aliases/valid_until/freshness) | `supabase/migrations/20260704000000_ai_knowledge_v2_schema.sql` | `grep -nE "aliases\|valid_until\|freshness" supabase/migrations/20260704000000_ai_knowledge_v2_schema.sql` |
| `ai_feedback` table (rating/answer_excerpt/page_path) | `supabase/migrations/20260617000001_add_ai_feedback.sql` | `sed -n '1,25p' supabase/migrations/20260617000001_add_ai_feedback.sql` |
| Ask VSA behavior in Edge Function SYSTEM_PROMPT | `supabase/functions/vsa-ai-assistant/index.ts` L34 | `grep -n "SYSTEM_PROMPT" supabase/functions/vsa-ai-assistant/index.ts` |
| Current test inventory and coverage gaps | `vsa-validation-and-qa` §2 | `find src -name "*.test.ts*" \| sort` |
| Public surfaces already Storage-free | grep, 0 non-admin matches | `grep -rln "storage/v1/object\|\.storage\.from\|supabase.co/storage" src/pages src/components/features \| grep -viE "admin\|Admin"` |
| Egress pipeline + audit tooling | `docs/event-image-migration.md`, `docs/supabase-usage-audit.sql`, `.claude/agents/vsa-storage-egress.md` | `ls docs/ \| grep -iE "image\|usage"` |
| 12 agent playbooks (multi-agent dev) | `.claude/agents/*.md` | `ls .claude/agents/*.md \| wc -l` |
| Auth redesign reverted | commit `a4b2fca9` | `git log --oneline -1 a4b2fca9` |
| AGENTS.md "Things to never do" list | `AGENTS.md` §"Things to never do" | `grep -n "Things to never do" AGENTS.md` |

**Maintenance triggers.** Re-verify this skill when: the UI campaign closes a
gate (update F1 numbers), a consolidation or eval-set PR lands (move F2/F3 from
OPEN/CANDIDATE toward done), the test coverage shape changes (update F5), or a new public
surface reintroduces a Storage URL (F6 regression). Volatile numbers here (test
inventory, migration count, "0 matches" greps) are snapshots — always re-run
the command, never quote a copied number blind.
