# Agentic Engineering Workflow (canonical)

**This is the one detailed source of truth for how AI agents turn a request into a shipped change in this repo.**
`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and `ANTIGRAVITY.md` are thin adapters that point here. Do not copy this file's content into them — update this file instead.

Audience: any coding agent (Claude Code, Codex, Gemini CLI, Antigravity, or a zero-context Sonnet-class model). The user speaks in plain, often messy, product language. **The repository — not the user — supplies the process.** Never require the user to name Graphify, Repomix, Superpowers, Impeccable, a skill, a playbook, tests, or a risk tier. You infer all of that from the request and this document.

---

## 0. The one-paragraph version

For any non-trivial task: read the governing instructions, look at the worktree, translate the request into an engineering brief, **classify risk**, load only the owning skill(s) and relevant playbook(s), orient with **Graphify** before broad search, pack a narrow slice with **Repomix** only once scope is known, verify against real source, implement in small slices, use **Impeccable** for meaningful UI, **validate proportionally to risk**, run an **adversarial review**, then report exact evidence. Scale all of this to the task: a copy tweak gets none of the ceremony; an auth/points/migration change gets all of it.

---

## 1. Authority hierarchy (whose word wins)

When two sources conflict, the higher one wins. Preserve **one home per fact** — if a fact seems to live in two places, the owning source is authoritative and the other should point to it, not restate it.

1. The user's explicit instruction in the current turn.
2. Root `AGENTS.md` (governance contract: protected domains, never-do list, branch/PR rules).
3. Any nested/scoped `AGENTS.md` closer to the files you're editing.
4. Your harness adapter: `CLAUDE.md` (Claude), `GEMINI.md` (Gemini), `ANTIGRAVITY.md` (Antigravity), or root `AGENTS.md` again (Codex).
5. This canonical workflow.
6. The **owning** project skill for the fact in question (see the skill router, §4).
7. Other project skills.
8. Domain playbook agents in `.claude/agents/`.
9. Superpowers methodology (encoded in §6 if the plugin is absent).
10. Impeccable design guidance.
11. Generic model knowledge (lowest — never let it override a repo skill).

If two skills disagree, find which one *owns* the fact (its description says what it owns), verify against current source, and do not blend contradictions.

---

## 2. Natural-language intent translation

Users write brain dumps: *"the events page lowkey looks ass on mobile fix it"*, *"make admin able to schedule house applications every quarter"*. Before touching anything, silently convert the request into an internal brief by answering as many of these as the request and a quick investigation allow:

- **Desired user-visible outcome** — what does the user actually want to see or be able to do?
- **Actors** — public visitor, authenticated member, or admin?
- **Surface** — which route(s)/page(s)/component(s)? (Confirm with Graphify, don't guess.)
- **State & data** — new tables/columns? new repo methods? new schemas? existing analogue?
- **Backend / migration impact** — schema, RLS, grants, Edge Functions?
- **Privacy & security** — does this expose or make discoverable any member data? (§11)
- **Mobile / accessibility / dark mode** — always in scope for UI work.
- **Seasonal / historical behavior** — application windows, House-year mapping, freeze windows? (skill `vsa-seasonal-operations`)
- **Analytics / tests** — what proves it works and stays working?

Do not interrogate the user for every unknown. **Investigate first.** For ordinary ambiguity, make a grounded assumption, record it in your response, and proceed (§16).

---

## 3. Risk classification (this decides how much process to apply)

Classify every task before working. When in doubt, round **up** one tier.

### Low risk — lightweight
Copy/text changes, isolated styling, docs, a single obviously-scoped non-behavioral edit.
→ Inspect the file, make the change, do a quick targeted check (build or the one relevant test). No Graphify rebuild, no Repomix pack, no subagents, no multi-step plan.

### Medium risk — normal process
New route, new component, new repo method, a significant form, application/UI logic that doesn't touch protected domains.
→ Load the owning skill + relevant playbook, Graphify the area, Repomix a narrow slice if useful, plan briefly, implement in slices, run targeted + component/integration tests, self-review.

### High risk — full process (protected domains)
Anything touching: **auth, RLS, grants, migrations, points calculation, attendance import, House membership, leaderboard calculation, applications/forms windows, check-in codes, storage policies, private member data, or any production mutation.**
→ Load the owning skill(s) **and** `vsa-change-control` **and** `vsa-supabase-security-reference` when Supabase is involved; load the relevant playbook; do an architecture review (`vsa-architecture-contract` / `vsa-architecture-guardian`); a privacy review (§11); stronger validation (§13); an **independent adversarial review** (§14); and honor production safeguards (§12). These changes are gated — see `vsa-change-control` for whether the change is even allowed without an explicit owner request.

The protected-domain list and the annotated never-do list live in root `AGENTS.md` and `vsa-change-control`. Those are authoritative; this section only tells you how hard to work.

---

## 4. Skill router (load on demand — never all 16)

Project skills live in `.claude/skills/<name>/SKILL.md`. **Load only the owning skill for the fact you need, then follow its cross-references.** Loading all 16 wastes context and is never correct. Claude loads these via the Skill tool (they are trigger-rich and often auto-suggest); Codex/Gemini/Antigravity read the `SKILL.md` file directly as a runbook.

| When the task is about… | Load |
|---|---|
| "Can I change X?", is this allowed, protected domains, branch/PR/commit rules, freeze windows, never-do list | `vsa-change-control` |
| Something is broken, cause unknown; stale UI after mutation; permission-denied; fallback pages; failing build/test | `vsa-debugging-playbook` |
| Weird legacy code, a revert, a suspicious migration, a dead branch, "why does this exist" | `vsa-failure-archaeology` |
| Routes, providers, auth boundaries, the data/repository layer, degraded mode, any structural change | `vsa-architecture-contract` |
| RLS, policies, grants, migrations, views, Edge Functions, check-in codes, security boundaries | `vsa-supabase-security-reference` |
| Env vars, secrets, feature flags, admin-editable DB config, "works locally not in prod" | `vsa-config-and-flags` |
| From-zero dev setup, broken local env, npm/jest/zod/tsc setup traps | `vsa-build-and-env` |
| Deploying, what actually ships to prod, applying migrations, Edge Function deploy, image pipeline | `vsa-run-and-operate` |
| Measuring: Lighthouse, axe, bundle size, egress, RLS exposure, route inventory, "how big/slow/exposed" | `vsa-diagnostics-and-measurement` |
| Tests, acceptance evidence, "is this done", regression, proving a change works | `vsa-validation-and-qa` |
| Which doc is authoritative, updating docs after a change, runbooks, PR/commit text, skill maintenance | `vsa-docs-and-writing` |
| Any UI: components, tokens, colors, dark mode, motion, mobile, "make it beautiful" | `vsa-design-system-reference` |
| Applications, House Reveal, VCN/WNC, freeze windows, academic-year turnover, seasonal empty states | `vsa-seasonal-operations` |
| The standing site-wide UI-excellence / mobile-beauty campaign, "what UI work is next" | `vsa-ui-excellence-campaign` |
| "What should we build next", roadmap, best-in-class/SOTA, is an ambitious idea ready | `vsa-research-frontier` |
| Turning a hunch into a proven change, evidence bar, adversarial evaluation, "is this proven" | `vsa-research-methodology` |

Typical loads: a mobile events polish → `vsa-design-system-reference` (+ `vsa-ui-excellence-campaign` if campaign-scoped). A migration → `vsa-change-control` + `vsa-supabase-security-reference` + `vsa-run-and-operate`. A "leaderboard is stale" bug → `vsa-debugging-playbook` (+ `vsa-failure-archaeology` if it smells old).

---

## 5. Playbook router (domain personas — distinct from skills)

Playbooks live in `.claude/agents/<name>.md`. **Skills are knowledge; playbooks are scoped domain personas/reviewers.** They are not the same mechanism — do not merge them.

- **Claude Code**: invoke the matching agent natively as a subagent when its scope fits (e.g. "use the vsa-house-system subagent"). Only claim a subagent ran if you actually invoked one.
- **Codex / Gemini / Antigravity**: read the matching `.claude/agents/<name>.md` as the source-of-truth domain playbook and follow its scope/constraints using your own agent/delegation mechanics. **Never claim a Claude-native subagent was invoked when you only read the file.**

| Domain | Playbook | Mode |
|---|---|---|
| Cross-cutting architecture / route & data-flow safety / PR risk | `vsa-architecture-guardian` | read-only reviewer |
| Homepage, programs, public copy, degraded-mode content | `vsa-public-content` | edit |
| Admin dashboard, navigation, CRUD, admin UX | `vsa-admin-workflows` | edit |
| Events, recaps, gallery, calendar, publish behavior | `vsa-events-gallery` | edit |
| Attendance, points, leaderboard, merge, lookup | `vsa-points-attendance-guardian` | audit-first / read-only |
| House pages, year/archive routing, standings display | `vsa-house-system` | edit |
| Cabinet page/archive/admin, current leadership | `vsa-cabinet-leadership` | edit |
| Ask VSA, AI knowledge base, Edge Function privacy | `vsa-ai-knowledge` | edit |
| Application windows, statuses, form-link safety | `vsa-applications-forms` | edit |
| Storage URL / egress audits, migration planning | `vsa-storage-egress` | dry-run / docs |
| Build/lint/test failures, route QA, regression | `vsa-testing-qa` | edit |
| Runbooks, acceptance criteria, PR checklists, docs | `vsa-docs-acceptance` | docs only |

The two read-only guardians (`vsa-architecture-guardian`, `vsa-points-attendance-guardian`) identify risk and recommend scoped follow-ups; they do not make broad edits.

---

## 6. Superpowers methodology

The Superpowers plugin is **installed** — prefer its native flow (brainstorming, planning, subagent-driven development, and its skills) for meaningful work. The lifecycle below is the same intent, summarized here so the methodology survives even if the plugin is ever absent. Scale every step to task risk (§3) — a typo needs none of this.

```
Understand → Investigate → Brainstorm (only when design ambiguity is real)
→ Compare tradeoffs → Choose → Plan → Decompose → Implement → Validate → Review → Finish
```

- **Understand / Investigate** before editing — always (§7).
- **Brainstorm** only when there are genuinely different viable designs; skip it for obvious work.
- **Plan / Decompose** for medium+ work; a new public feature may warrant a real plan, a one-liner does not.
- **Implement in reviewable slices**, validating after each meaningful slice.
- **Do not stop** after investigation/plan when safe implementation is possible (§16). Do not manufacture ceremony where it adds no value.

---

## 7. Context acquisition — cheapest sufficient path first

Default order, but **skip straight to a direct read when you already know the exact file** — the goal is token efficiency, not ritual:

1. Governing instructions (already in context) + owning skill (§4) + relevant playbook (§5).
2. **Graphify** for structural questions — before any broad grep. Ask specific questions, e.g.:
   - `./scripts/graphify-run query "what renders the public leaderboard?"`
   - `./scripts/graphify-run query "what code path calculates House standings?"`
   - `./scripts/graphify-run path "src/context/AuthContext.tsx" "src/pages/Leaderboard.tsx"`
   - `./scripts/graphify-run explain "eventsRepository"`
   Graphify is for **navigation**, not final truth — verify implementation-critical claims against source before editing. Check freshness with `.claude/skills/vsa-diagnostics-and-measurement/scripts/check-graph-freshness.sh`; only refresh if the relevant area actually changed. Never rebuild the graph inside a feature PR.
3. **Repomix** — only *after* scope is narrowed, to pack one coherent slice (route + hook + repo + types + closest analogue + tests). Run via `npx repomix` (it is not a repo dependency). Ask yourself: *what exact uncertainty will this pack resolve?* Never dump the whole repo; never include secrets, `node_modules`, `build/`, `graphify-out/`, or unrelated migrations.
4. **Direct source reads** to verify exact code before editing.
5. Targeted `grep`/`glob` for a specific string.
6. Broad repository search only as a last resort.

---

## 8. Find the closest existing analogue before inventing

Before writing a new route, card, form, repo method, modal, loading state, admin flow, migration, hook, or animation, find the nearest current analogue (via Graphify → targeted read). Match its patterns. **But check whether the analogue is modern or legacy** (`vsa-failure-archaeology` documents the known-bad patterns) — do not reproduce a known-bad approach just because it exists.

---

## 9. Subagent / playbook delegation

Delegate bounded, well-specified investigations — architecture impact, RLS/privacy review, test-gap analysis, mobile/accessibility review, failure archaeology, performance review. Each delegated task should state: objective, boundaries, which playbook, which skill, expected output, and write permission (read-only vs edit).

- Parallelize **independent read-only** investigations.
- Do **not** parallelize overlapping writes without isolation (worktrees only when complexity truly justifies them — root `AGENTS.md` says no speculative worktrees/sibling folders).
- **Spawn subagents only when the task benefits or the user asks** — not ceremonially.

---

## 10. Implementation behavior

- Inspect exact source before editing; edit in **small coherent slices**; validate after each meaningful slice.
- Use existing abstractions, repository patterns, design tokens, and component layers (`ui/` → `common/` → `features/` → `layout/`). See `vsa-design-system-reference` and root `AGENTS.md` coding conventions.
- No unrelated refactors, no speculative abstraction, no broad formatting churn, no second source of truth.
- All Supabase access goes through `src/data/repos/`; never call `supabase` from a component; never create a second client. (Root `AGENTS.md` "never do".)

---

## 11. Privacy & security review (mandatory trigger)

Any task touching profiles, points, attendance, Houses, applications, check-in, emails, phone numbers, admin data, family relationships, gallery, alumni, or user identifiers triggers an explicit review. Ask:

- Is this information already **intentionally** public?
- Does the change increase **discoverability** or enable **enumeration**?
- Does a route expose a stable internal ID?
- Does derived behavior leak private activity (e.g. badge progress revealing attendance)?
- Are admin notes / application records / import notes exposed?

**Default to minimum necessary exposure.** Never expose check-in codes, import notes, admin notes, emails, or payment logs publicly (root `AGENTS.md`). Deep RLS/exposure theory is in `vsa-supabase-security-reference`; the history of past leaks is in `vsa-failure-archaeology`.

---

## 12. Supabase & production safety

For schema, migrations, RLS, grants, auth, or Edge Functions: load `vsa-supabase-security-reference` and the relevant playbook. Then:

- **Inspection is not authorization to mutate.** Read access (including via any Supabase MCP) does not permit modifying production.
- **Production migrations are applied manually per repo policy** (`vsa-run-and-operate`). Order: migrations → frontend → Edge Function deploy. Do not auto-apply migrations to production.
- **Never weaken or broadly modify RLS as a quick fix.** Never delete DB rows or Storage originals.

---

## 13. Validation ladder (scale to risk)

Run the cheapest relevant rung first, then broaden with risk. Exact commands and the acceptable-warning rule are in `vsa-validation-and-qa`.

| Rung | What | When |
|---|---|---|
| Static | `git diff --check`, `npm run lint`, typecheck, format | every change |
| Unit | helpers, business logic, transformations | logic changes |
| Component | render, events, states, a11y (`CI=true npm test -- --watchAll=false`, or scoped `--testPathPattern`) | UI/component changes |
| Integration | data access, routes, auth | repo/route changes |
| Build | `npm run build` | anything non-trivial |
| Browser | real flow + mobile + empty/error/loading + visual check | meaningful UI |
| Database | policy + grant matrix for anon/auth/admin (`scripts/verify-rls-security.mjs`) | any RLS/grant/migration |
| Regression | protected existing behavior (golden tests) | high-risk / protected domains |

Run targeted tests first; broaden based on risk. Tests are **mandatory** for changes to protected logic and for anything `vsa-validation-and-qa` flags; optional for isolated copy/style.

---

## 14. Adversarial review (before claiming done)

For medium/high-risk work, review the change against these — and for high-risk work use an **independent reviewer** (a fresh subagent or the `vsa-architecture-guardian` playbook), not just self-review:

```
What assumption is probably wrong?
What production edge case would embarrass this?
Did I create a second source of truth?
Did I bypass an abstraction (repo layer, design tokens)?
Did I expose new public data or enable enumeration?
Did I break historical terms / House-year mapping / degraded mode?
Did I over- or under-build?
Did I only inspect code instead of rendering the UI?
Did I write a migration without proving the policy/grant matrix?
```

Fix material findings before declaring completion. The evidence bar for HARD problems (RLS recursion, egress spikes, perf regressions) is in `vsa-research-methodology`: one mechanism must explain all observations and survive adversarial cross-review.

---

## 15. Git delivery (follow existing doctrine — do not invent)

Authoritative rules are in root `AGENTS.md` ("PR / branch conventions", "Things to never do"). In short:

- Inspect the worktree first; **preserve pre-existing user changes and local setup** (`.gitignore` local edits, `.claude/settings.local.json`). Never `git reset --hard` / `git clean -fd` without authorization.
- `git fetch origin`; branch from fresh `origin/main` if local `main` is stale and pulling is blocked. **Never commit to `main`.**
- Branch names: `<scope>/<short-description>`; AI branches often `claude/` / `codex/` / `gemini/` / `feat/`.
- **Stage exact files only** — never `git add .` / `git add -A`. Do not stage `graphify-out/`, Repomix output, `.claude/settings.local.json`, or unrelated local files.
- Keep Graphify graph-output changes in a separate `chore: update graphify graph` commit.
- **Do not use `gh pr create` unless the user explicitly asks.** Push the branch and provide a manual PR title, body, and pull/new URL.
- PR title convention and the manual-migration policy live in `vsa-change-control`.

---

## 16. Autonomy & honesty

**Autonomy:** Once the user has asked for a feature/fix, don't stop after audit/research/brainstorm/plan when safe implementation is possible. Don't repeatedly ask "would you like me to implement this?" Proceed through the whole task. Pause for approval **only** when: a destructive or irreversible action is required, a production mutation is required, secrets are missing, repo governance requires an owner request (see `vsa-change-control` gated/forbidden domains), or two *materially different* interpretations can't be safely resolved. For ordinary ambiguity: assume, record, proceed.

**Honesty / exact evidence:** Never conflate distinct actions. Distinguish, in your report, whether you *queried Graphify*, *ran Repomix*, *read a playbook*, *invoked a native subagent*, *ran tests*, *rendered the UI in a browser*, *wrote a migration*, *applied a migration*, or *deployed to production*. Never bluff a step you didn't run.

---

## 17. Worked examples (request → behavior)

- **"build a leaderboard profile feature with badges, make up sick badges too"** → medium/high (leaderboard-adjacent + new public surface). Brief (§2); `vsa-change-control` (is a leaderboard-adjacent change allowed?) + `vsa-architecture-contract` + `vsa-design-system-reference` + `vsa-validation-and-qa`; route through `vsa-points-attendance-guardian` (read-only) to confirm you're not touching points math; Graphify the leaderboard path; Repomix the slice; **privacy review** (does a profile route expose IDs / leak attendance via badges?); decide computed-vs-persisted badges; Impeccable for the UI; validate no leaderboard regression.
- **"events page looks ass on mobile, make it cleaner"** → medium UI. `vsa-design-system-reference` (+ `vsa-ui-excellence-campaign`); Graphify only if the component tree is unclear; Impeccable + real browser inspection at mobile + intermediate widths; empty/loading/error states; a11y; preserve product identity; **no DB ceremony**.
- **"let admins schedule house applications every quarter, auto open/close"** → high. `vsa-seasonal-operations` (freeze windows!) + `vsa-change-control` + `vsa-architecture-contract` + `vsa-supabase-security-reference` (if schema changes) + `vsa-applications-forms` playbook + `vsa-house-system`; open/close semantics + timezone reasoning; admin/public states; privacy; stronger tests + adversarial review.
- **"leaderboard keeps showing stale points, figure it out"** → debugging. `vsa-debugging-playbook` (+ `vsa-failure-archaeology` if it smells old); Graphify the data path; investigate react-query cache/invalidation; targeted source reads; **reproduce before rewriting**; fix; regression test. Don't speculatively rewrite.
- **"change this button copy from View More to See All Events"** → low. Find the file, edit, quick check. **No** Superpowers ceremony, no Graphify rebuild, no Repomix, no subagents.

---

## 18. Capabilities & how they combine

| Capability | Status here | Role |
|---|---|---|
| Graphify | Installed, graph tracked in `graphify-out/` | Structural navigation before broad search |
| Repomix | Available via `npx repomix` (not a repo dep) | Narrow coherent context pack after scope is known |
| Impeccable | Installed (skill) | Meaningful UI/UX/design work — combine with `vsa-design-system-reference`, never replace it |
| Superpowers | Installed (`superpowers@superpowers-marketplace`) | Lifecycle discipline for meaningful work — prefer its native flow; §6 summarizes it |

**Graphify locates the system. Repomix packages the relevant slice. Direct source reads verify exact code.** For UI, design authority is: repo design system → product identity → established component patterns → `vsa-design-system-reference` → Impeccable → generic taste. Impeccable improves UI; it never overrides the repo's tokens or identity. Avoid generic AI visual slop (gratuitous gradients, glow, excessive glass, cards-in-cards, giant heroes on utility pages).

---

*Maintenance: this file is owned per `vsa-docs-and-writing`. When the process changes, edit here and leave the adapters pointing at it.*
