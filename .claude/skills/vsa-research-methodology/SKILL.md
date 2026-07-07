---
name: vsa-research-methodology
description: Load when turning a hunch into a proven, adopted change on the VSA website — about to run an experiment, proposing a fix to a HARD problem (RLS recursion, egress spike, perf regression), reviewing whether a change is actually proven vs merely plausible, or deciding whether an idea is ready to adopt or should be retired. Provides this project's evidence bar (one mechanism must explain ALL observations and survive adversarial review), the hypothesis-predicts-numbers-before-running template per domain, the multi-agent branch lifecycle (claude/ codex/ gemini/ antigravity/ feat/), a copy-paste adversarial cross-model review prompt, dead-branch retirement etiquette, and where good ideas historically came from here (audits). Trigger keywords: experiment, hypothesis, proof, evidence bar, adversarial review, is this proven, ready to adopt, retire this idea, dead branch, cross-model review.
---

# VSA Research Methodology — how a hunch becomes an accepted change here

**What this skill is for.** This is the discipline that separates "this change looks right" from
"this change is proven and adopted" on the VSA (Vietnamese Student Association) website. Load it
when you are about to run an experiment, propose a fix to a genuinely hard problem, judge whether
someone else's change is really proven, or decide whether an idea should ship or be retired. Every
rule below is grounded in this repo's actual history — not generic research advice.

Jargon defined once, on first use: **RLS** = Postgres Row-Level Security (per-row access policies);
**egress** = bytes Supabase bills for data leaving its servers; **SECURITY DEFINER** = a Postgres
function that runs with its owner's privileges, bypassing the caller's RLS; **CRA** = Create React
App; **conventional-commit** = the `type: subject` commit/PR-title format enforced here.

## When NOT to use this skill

| If you are… | Use instead |
|---|---|
| Deciding **what** to work on, picking a frontier problem, or judging if an ambitious idea is worth starting | **vsa-research-frontier** |
| Doing **routine** verification (lint/build/test on an ordinary change) and just need the pass bar | **vsa-validation-and-qa** |
| Classifying whether a change is allowed / gated / forbidden, or naming a branch/PR | **vsa-change-control** |
| Writing the post-mortem of a retired direction so it isn't re-fought | **vsa-failure-archaeology** |
| Timing an experiment around House reveals / application opens / VCN freeze windows | **vsa-seasonal-operations** |

This skill is the *method* (how to prove). Those skills are the *targets, bar, rules, record, and calendar*.

---

## 1. The evidence bar

A change to a hard problem is **adopted** only when it clears this bar:

1. **One mechanism explains ALL observations — including the negatives.** A fix that explains the
   failure but not why an earlier "safe" version *didn't* fail (or vice-versa) has not identified the
   mechanism. If your story has an unexplained observation, you have the wrong story.
2. **The mechanism predicts numbers before you run** (Section 2). "It should get better" is not a
   prediction; "check X will flip from FAIL to PASS" is.
3. **It survives adversarial review** (Section 4) — a second agent/model actively tries to break it,
   not just skims it.
4. **Before/after evidence is attached**, not asserted. Numbers, command output, or a diff of which
   checks flipped.

Plausibility is not proof. This repo has a documented case of a plausible-but-wrong hypothesis
shipping — read it before you trust your own reasoning.

### Worked example: the `user_profiles` RLS recursion (the hypothesis that failed)

Read the two migrations side by side — this is the canonical "one mechanism, all observations"
lesson in this repo.

```bash
git show 20260619000000_emergency_security_hardening.sql | sed -n '67,82p'   # the failed hypothesis
cat supabase/migrations/20260620020000_fix_user_profiles_rls_recursion.sql   # the fix (PR #160)
git log -1 --format='%h %s' 9e0c102e                                         # 9e0c102e Fix user profile RLS recursion (#160)
```

**The failed hypothesis.** The emergency hardening migration
`20260619000000_emergency_security_hardening.sql` added an "Admins can view all profiles" SELECT
policy on `user_profiles` whose `USING` clause runs `EXISTS (SELECT 1 FROM public.user_profiles up
WHERE up.id = auth.uid() AND up.is_admin = true)`. Its own comment (lines 73–74) asserts:

> "Inner query is anchored by `auth.uid() = id`, which is permitted by the own-profile policy above,
> so **no recursive RLS loop occurs.**"

That assertion was wrong. A SELECT policy that queries the same table it protects re-triggers RLS on
that inner query; the "own-profile policy permits it" reasoning did not hold, and the table hit
Postgres's infinite-recursion error.

**The mechanism that explained everything.** PR #160 / commit `9e0c102e` /
`20260620020000_fix_user_profiles_rls_recursion.sql` fixes it by moving the admin check into a
`SECURITY DEFINER` function `public.is_admin_user(p_user_id uuid DEFAULT auth.uid())` (declared
`STABLE`, `SET search_path = ''`). Because SECURITY DEFINER evaluates with the owner's privileges, it
**bypasses table RLS** on the inner lookup — so the policy no longer recurses. The function is
caller-bound (`p_user_id = auth.uid()`) so it can't be used to enumerate other users' admin status,
and it is `REVOKE ALL … FROM anon` / `GRANT EXECUTE … TO authenticated`.

**What history records vs doesn't.** The migrations and PR number are recorded and verifiable
(commands above). What the git record does **not** contain is a captured reproduction of the
recursion error message or a timestamped log of the outage; the evidence that the first hypothesis
failed is the *existence and content* of the follow-up migration one day later, plus its explicit
comment about preventing recursion. Do not overstate: the fix is proven by the code; the outage
timeline lives in **vsa-failure-archaeology**, not here.

**Lesson to carry:** a comment asserting "no risk" is not evidence of no risk. On `user_profiles`,
any policy that must read `is_admin` goes through `public.is_admin_user(...)`, never an inline
`EXISTS` on the same table. (RLS mechanics and the SECURITY DEFINER pattern are owned by
**vsa-supabase-security-reference**.)

---

## 2. Hypothesis predicts numbers BEFORE you run

State the prediction, with the command and the number, before executing. Use this template:

> **I believe** *X* **because** *Y*; **if true, command** `Z` **shows** *W*; **if it shows** *V*
> **instead, X is wrong.**

Pick the domain-specific measurement so the prediction is falsifiable:

| Domain of change | Predict this number, before running | Instrument (owned by vsa-diagnostics-and-measurement) |
|---|---|---|
| **Egress / storage** fix | The egress or Storage-bytes delta (which URLs stop being served from Supabase) | `docs/supabase-usage-audit.sql`; dry-run `npm run migrate:images:dry` before `:apply` |
| **Performance** change | Lighthouse score delta and/or bundle-size delta (which chunk shrinks, by how much) | `npm run analyze`; Lighthouse/web-vitals procedure |
| **RLS / security** change | **Which specific checks flip** in `scripts/verify-rls-security.mjs` (anon / authenticated / admin sections; PASS↔FAIL) | `node scripts/verify-rls-security.mjs` |
| **Data/leaderboard** change | Row counts or point totals that should/should not move | targeted SQL read-only query |

Worked predictions (fill in your own numbers):

- **Egress:** "I believe migrating event images to public URLs cuts egress because they are currently
  served through Supabase Storage; if true, `docs/supabase-usage-audit.sql` shows Storage egress
  drop and `npm run migrate:images:dry` lists N event rows; if it lists 0, my target set is wrong."
- **RLS:** "I believe adding `public.is_admin_user()` fixes the recursion because the inline EXISTS
  self-queries `user_profiles`; if true, `node scripts/verify-rls-security.mjs` moves the admin
  SELECT check from FAIL to PASS with no anon check regressing; if an anon check flips to FAIL, I
  over-granted."
- **Perf:** "I believe lazy-loading the gallery route trims first load because it currently ships in
  the main chunk; if true, `npm run analyze` shows the main chunk shrink by ~the gallery's size and a
  new async chunk appear; if the main chunk is unchanged, the split didn't take."

A prediction that no available command can check is not yet a hypothesis — make it measurable or
route the "what to measure" question to **vsa-diagnostics-and-measurement**.

---

## 3. The idea lifecycle — as actually practiced here

Development on this repo is heavily multi-agent: branches are prefixed by the model/agent that
authored them. Verify the prefixes and rough counts yourself:

```bash
git branch -r | sed 's|.*origin/||' | awk -F/ 'NF>1{print $1}' | sort | uniq -c | sort -rn
```

As of 2026-07-06 the live prefixes are (counts drift): `codex/` (~49), `claude/` (~41),
`gemini/` (~17), `feat/` (~15), `antigravity/` (~7), plus a few `feature/`, `chore/`, `fix/`. The
takeaway is not the exact numbers — it's that **experiments live on prefixed branches, never on
`main`**, and multiple agents attack the same problem in parallel.

The lifecycle, stage by stage:

| Stage | What it looks like here | Artifact / evidence |
|---|---|---|
| 1. **Idea** | A hunch, usually surfaced by an audit or a seasonal/cost pressure (Section 5). | — |
| 2. **Scoped task prompt** | Write the task against the template so any agent can pick it up cold. | `docs/claude-subagent-task-template.md` (and `docs/codex-subagent-task-template.md`) |
| 3. **Prefixed experiment branch** | Branch named `claude/…`, `codex/…`, `gemini/…`, `antigravity/…`, or `feat/…`. Never `main`. | `git branch -r` |
| 4. **Small PR, conventional-commit title** | One focused change; PR title must match the enforced regex. | `.github/workflows/pr-title.yml` |
| 5. **Adversarial cross-model review** | A *different* model tries to break it; author addresses the findings. | e.g. `1efd0bb5 fix: address Codex review on VSA Wrapped` |
| 6. **Repeated attempts on the same feature** | Hard features get several passes until one clears the bar. | Ask VSA chat overhauls: `6702d529` (#173), `7c0b6005` (#174), `4feabee1` (#175) |
| 7. **Merge — or documented retirement** | Winner merges to `main`; losers become dead branches and get a failure-archaeology entry. | Section on retirement below |

### Conventional-commit PR titles (enforced)

`pr-title.yml` runs this regex on every PR title; a non-matching title fails the check:

```
^(feat|fix|chore|docs|refactor|test|style|perf|ci|build|revert|security)(\([a-z0-9-]+\))?!?: .+
```

Examples that pass: `feat: add Ask VSA suggestions`, `fix(ai): improve Ask VSA chat`,
`security: harden attendance insert policies`. (Branch/PR conventions in full are owned by
**vsa-change-control** — don't duplicate that rulebook; just satisfy the regex.)

### Retirement etiquette — the dead-branch graveyard

Unmerged remote branches are the graveyard of retired directions. List them:

```bash
git branch -r --no-merged origin/main
```

As of 2026-07-06 there are ~116 unmerged remote branches. Most are simply superseded; some encode a
direction that was **tried and rejected** (e.g. the reverted auth redesign, commit `a4b2fca9`
`Revert "Redesign authentication: admin-only sign-in, public browsing…"`). Etiquette:

- When you retire a direction (not just a stale branch, but an *idea that was tested and lost*), add a
  one-entry note to **vsa-failure-archaeology** — symptom → why it was rejected → evidence
  (branch/commit/PR). That is how the next agent avoids re-fighting a settled battle.
- Do **not** silently delete the branch and move on with no record. The branch name is the only cheap
  breadcrumb; the archaeology entry is the durable one.

---

## 4. Assigned adversarial refutation

Adoption requires a **second** agent/model to actively try to break the change — this is the norm
here (Section 3, stage 5). The repo ships a purpose-built read-only reviewer for exactly this:
`.claude/agents/vsa-architecture-guardian.md` (tools: Read, Grep, Glob, Bash; it produces risk
reports and recommends scoped follow-ups, it does not make broad edits).

Assign the refutation to a different model than the author when possible (Codex reviewing a Claude
branch, or vice-versa — that cross-model pattern is what `1efd0bb5` records).

### Copy-paste adversarial-review prompt (tuned to this repo)

```
You are an adversarial reviewer for the VSA website. Your job is to BREAK this change, not to
approve it. Assume the author is wrong until each point is disproven with evidence.

Change under review: <branch / PR # / diff>
Author's claimed mechanism: <one sentence>
Author's predicted numbers: <the Section-2 prediction and command>

Refute each of these, citing files/lines and commands:
1. AGENTS.md "Things to never do": does this change violate any item? Quote the item.
2. RLS implications: does any new policy/view/RPC self-query its own table (recursion risk, cf.
   20260619000000 vs 20260620020000), bypass RLS via SECURITY DEFINER unintentionally, or expose
   a column to anon (check-in codes, emails, is_admin, draft events)? Any new view must
   revoke-all-then-grant-SELECT — verify it does.
3. Protected domains: does it touch attendance import, points calculation, House membership,
   leaderboard, or check-in codes? If so, where are the acceptance criteria and tests?
4. Freeze windows: is this near a House reveal / application open / VCN surface right now?
   (See vsa-seasonal-operations.) If so, it should not ship.
5. Before/after numbers: run the author's prediction command yourself. Do the numbers match the
   claim? Run `node scripts/verify-rls-security.mjs` for security changes and confirm NO check
   regressed. Paste the output.
6. The negative case: name one observation the author's mechanism does NOT explain. If you can't,
   say so explicitly.

Verdict: BLOCK or PASS, with the single strongest reason and the evidence for it.
```

A change that no one seriously tried to break has not been adversarially reviewed — a rubber-stamp
"looks good" does not clear the bar in Section 1.

---

## 5. Where good ideas have historically come from

Empirically, in this repo, the highest-yield source of adopted ideas is **audits**. Ideas also come
from seasonal user needs and from cost/incident pressure, but audits are the reliable well.

| Source | Evidence in this repo | Pattern |
|---|---|---|
| **Audits → fixes** (best yield) | Site-wide audit → `127f7114 Fix mobile layout bugs found in site-wide audit`; compliance/data-rights re-audits → the `antigravity/*compliance*` and `codex/data-rights-*` branch families → PRs in the #147–#158 range; egress audit → the whole image-migration pipeline (`npm run migrate:images:{dry,apply}`, `docs/event-image-migration.md`) | Run a scoped audit; each finding becomes a small scoped-task PR. |
| **Seasonal user needs** | VSA Wrapped (`a3d7ea60` #178) and reveal/launch content built to the academic calendar | Timed to the year; see **vsa-seasonal-operations**. |
| **Cost / incident pressure** | Egress crisis → image pipeline; the RLS recursion and check-in-code incidents → hardening migrations | A production cost or outage forces a targeted fix. |

**Guidance:** audits surface regularly and have the best idea yield here — when you're looking for
the *next* proven improvement, run an audit first (accessibility, egress, RLS exposure, mobile
layout) rather than free-associating. The diagnostic instruments to run those audits live in
**vsa-diagnostics-and-measurement**; the ranked list of *which* frontier to chase lives in
**vsa-research-frontier**.

---

## 6. Lifecycle guardrails

Hard rules for running experiments here. Violating any of these disqualifies the result.

- **Experiments never on `main`.** Always a prefixed branch (Section 3). `main` is production via
  Vercel.
- **Protected domains need owner request before behavior experiments.** Attendance import, points
  calculation, House membership, leaderboard, and RLS are protected. You may *audit* and *measure*
  them freely, but do not run a behavior-changing experiment on them without an owner request — route
  through **vsa-change-control** for the gating rules.
- **DB-touching experiments go read-only / dry-run FIRST.** This is the `vsa-storage-egress`
  pattern: review-only SQL and `npm run migrate:images:dry` before any `:apply`; never delete
  Supabase Storage originals; never let an experiment mutate production data automatically.
- **Label unproven work.** Anything not yet through the evidence bar is `UNVERIFIED` or `candidate` —
  in the PR description, in code comments, and in any doc. Never state an aspiration as an
  implemented fact.
- **New DB views need the revoke-then-grant guard.** Any experiment that adds a view must
  revoke-all-then-grant-SELECT to anon/authenticated (the auto-updatable-view gotcha, owned by
  **vsa-supabase-security-reference**) — verify it in the diff before claiming the experiment is
  safe.

---

## Cross-references

- **vsa-research-frontier** — what to work on (open/candidate problems, ranked).
- **vsa-validation-and-qa** — the routine verification bar (lint/build/test) and acceptance criteria.
- **vsa-change-control** — change classification, protected domains, branch/PR conventions.
- **vsa-failure-archaeology** — the durable record of retired directions and reverts.
- **vsa-diagnostics-and-measurement** — the instruments behind the Section-2 predictions.
- **vsa-supabase-security-reference** — RLS mechanics, SECURITY DEFINER, the view revoke-then-grant pattern.
- **vsa-seasonal-operations** — freeze windows that gate *when* an experiment may ship.

---

## Provenance and maintenance

Sources used (verified 2026-07-06 on branch `feat/vsa-skills-library`):

- `supabase/migrations/20260619000000_emergency_security_hardening.sql` (lines 67–82: the
  "no recursion" comment — the failed hypothesis).
- `supabase/migrations/20260620020000_fix_user_profiles_rls_recursion.sql` (the fix); commit
  `9e0c102e` "Fix user profile RLS recursion (#160)".
- `.github/workflows/pr-title.yml` (conventional-commit regex).
- `.claude/agents/vsa-architecture-guardian.md` (read-only adversarial reviewer).
- `docs/claude-subagent-task-template.md`, `docs/codex-subagent-task-template.md` (scoped task prompt).
- Commits: `1efd0bb5` (address Codex review on VSA Wrapped), `127f7114` (site-wide audit fixes),
  `a4b2fca9` (auth redesign revert), `a3d7ea60` #178 (Wrapped); Ask VSA overhauls `6702d529` #173,
  `7c0b6005` #174, `4feabee1` #175.

Re-verification commands (run these if a fact feels stale):

```bash
# Branch prefixes and counts
git branch -r | sed 's|.*origin/||' | awk -F/ 'NF>1{print $1}' | sort | uniq -c | sort -rn
# Dead-branch graveyard size
git branch -r --no-merged origin/main | wc -l
# RLS recursion fix still present
git log -1 --format='%h %s' 9e0c102e
# PR-title regex unchanged
grep -n 'feat|fix|chore' .github/workflows/pr-title.yml
# Adversarial reviewer still exists and is read-only
sed -n '1,5p' .claude/agents/vsa-architecture-guardian.md
# Egress dry-run script still wired
grep -n 'migrate:images' package.json
# RLS verification instrument present
ls scripts/verify-rls-security.mjs
```
