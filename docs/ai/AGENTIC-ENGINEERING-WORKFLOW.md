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

- **Current vs. desired behavior** — what happens now, and what should happen instead?
- **Desired user-visible outcome** — what does the user actually want to see or be able to do?
- **Actors** — public visitor, authenticated member, or admin?
- **Surface and domain** — which route/page/product area owns the behavior? Investigate the component name; do not ask the user to supply it.
- **Likely data path** — which repository, query, cache, schema, or static source feeds the surface?
- **State & data** — new tables/columns? new repo methods? new schemas? existing analogue?
- **Backend / migration impact** — schema, RLS, grants, Edge Functions?
- **Privacy & security** — does this expose or make discoverable any member data? (§11)
- **Mobile / accessibility / dark mode** — always in scope for UI work.
- **Seasonal / historical behavior** — application windows, House-year mapping, freeze windows? (skill `vsa-seasonal-operations`)
- **Acceptance criteria / tests** — what observable behavior proves it works and stays working?
- **Ambiguity** — can repository evidence resolve it, or would different answers materially change the product, authorization, privacy, or production outcome?

**Natural-language routing contract:** the user is not required to name a skill, playbook, tool, file, test, repository class, table, or subagent. The parent agent infers and selects the internal workflow from the request and repository evidence. Never ask the user whether Graphify, Repomix, a Superpowers skill, or a particular specialist should be used.

**Investigate first.** Ask the user only when two materially different product outcomes remain possible; authorization or privacy cannot be inferred safely; a destructive interpretation is unclear; a required business rule has no repository evidence; or proceeding would cause irreversible or production impact. For ordinary ambiguity, make a grounded assumption, record it in your response, and proceed (§16).

---

## 3. Risk classification (this decides how much process to apply)

Classify every task before working. When in doubt, round **up** one tier.

### Low risk — lightweight
Copy/text changes, isolated styling, docs, a single obviously-scoped non-behavioral edit.
→ Inspect the file, make the change, and run the smallest relevant static, reference, manual, or focused test check. Do not run an application build merely for docs/config. No Graphify rebuild, Repomix pack, subagents, or multi-step plan.

### Medium risk — normal process
New route, new component, new repo method, a significant form, application/UI logic that doesn't touch protected domains.
→ Load the owning skill + relevant playbook, use Graphify when structural ownership or relationships are unclear, Repomix a narrow slice if useful, plan briefly, implement in slices, run targeted + component/integration tests, self-review.

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

### Cross-harness delegation equivalence

The parent chooses playbooks automatically; the user never needs to know the roster.

- **Native subagents available:** dispatch bounded specialists with narrow context. Parallelize only independent concerns with non-overlapping writes; use read-only reviewers for architecture, security, privacy, or protected-domain questions.
- **No native subagents:** execute the same playbooks sequentially as isolated specialist passes. Preserve concern boundaries and separate implementation from review; narrow or reset context where the harness allows it. Never claim that reading a playbook was a concurrently running agent.
- **Capability does not weaken the gate:** lack of native delegation never permits skipping required architecture, privacy, security, or domain review.

---

## 6. Superpowers compatibility and proportional routing

Superpowers supplies methodology; repository governance determines risk, safety, delivery, and how deeply that methodology applies. Start with `using-superpowers` or the available equivalent to identify relevant methods. That orientation does not require every Superpowers skill.

```
Understand → Investigate → Brainstorm (only when design ambiguity is real)
→ Compare tradeoffs → Choose → Plan → Decompose → Implement → Validate → Review → Finish
```

| Task shape | Apply | Normally skip |
|---|---|---|
| Micro/obvious: typo, copy correction, known one-file edit, obvious config fix | Classify, targeted read, direct edit, focused verification | Brainstorming, design approval, committed spec, implementation plan, worktree, subagents, Repomix |
| Bug/regression | `systematic-debugging`; reproduce and gather evidence; `test-driven-development` when a useful behavioral regression test can be added; targeted verification | Product brainstorming unless the fix requires a real product/design choice |
| Medium feature | Brainstorm only for genuine design ambiguity; lightweight plan for multiple dependent steps; one coherent domain implementation; focused review and validation | Formal design approval when repository evidence yields one clear reversible implementation |
| High-risk/cross-cutting | As appropriate: brainstorming, writing plans, worktree isolation, TDD, subagent-driven development, specialist security/architecture review, verification before completion | Shortcuts around change control, privacy review, production safeguards, or independent review |

Generic methodology must not silently override repository-specific safety or Git/delivery rules. Explicit user approval remains necessary for destructive, irreversible, gated, genuinely ambiguous, or production decisions. Routine reversible work must not stall for ceremonial approval. Do not stop after investigation or planning when safe implementation is authorized (§16).

---

## 7. Context acquisition — cheapest sufficient path first

Default order, but **skip straight to a direct read when you already know the exact file** — the goal is token efficiency, not ritual:

1. Governing instructions (already in context) + owning skill (§4) + relevant playbook (§5).
2. **Graphify** for structural questions — uncertain ownership, broad architecture, callers/callees, impact radius, data flow, authorization paths, or unfamiliar module relationships — before any broad grep. Ask specific questions, e.g.:
   - `./scripts/graphify-run query "what renders the public leaderboard?"`
   - `./scripts/graphify-run query "what code path calculates House standings?"`
   - `./scripts/graphify-run path "src/context/AuthContext.tsx" "src/pages/Leaderboard.tsx"`
   - `./scripts/graphify-run explain "eventsRepository"`
   Direct reads are preferred when the exact file is known, the user names an obviously owned page/component, you are reading instructions/config, you are verifying an identified source location, or the task is low-risk and narrow. Graphify is for **navigation**, not final truth — verify implementation-critical claims against source before editing. Do not require a graph query before every read. Check freshness with `.claude/skills/vsa-diagnostics-and-measurement/scripts/check-graph-freshness.sh`; only refresh if the relevant area actually changed. Never rebuild the graph inside a feature PR.
3. **Repomix** — only *after* scope is narrowed, to pack one coherent slice (route + hook + repo + types + closest analogue + tests). Run via `npx repomix` (it is not a repo dependency). Ask yourself: *what exact uncertainty will this pack resolve?* Never dump the whole repo; never include secrets, `node_modules`, `build/`, `graphify-out/`, or unrelated migrations.
4. **Direct source reads** to verify exact code before editing.
5. Targeted `grep`/`glob` for a specific string.
6. Broad repository search only as a last resort.

---

## 8. Find the closest existing analogue before inventing

Before writing a new route, card, form, repo method, modal, loading state, admin flow, migration, hook, or animation, find the nearest current analogue (via Graphify → targeted read). Match its patterns. **But check whether the analogue is modern or legacy** (`vsa-failure-archaeology` documents the known-bad patterns) — do not reproduce a known-bad approach just because it exists.

---

## 9. Subagent / playbook delegation

The parent automatically delegates bounded work when specialization, safety, independent review, or genuinely parallel progress materially improves the result. Typical uses: architecture or RLS/privacy review; protected points/attendance/House/member work; cross-cutting features with independent concerns; and parallel read-only investigations. Do not delegate a typo, one-line config correction, known single-component bug, or one coherent subsystem change merely because subagents exist.

**Decompose at independent concern and ownership boundaries, not by file count or implementation-step count.** A link, assertion, or integration edge that naturally belongs to a coherent concern is not a separate task.

Every delegated task receives only:

- objective and owning domain/playbook;
- owned files or subsystem, plus files/systems it must not touch;
- relevant architecture invariants and privacy/security constraints;
- targeted Graphify findings and targeted direct-read or Repomix excerpts;
- acceptance criteria and expected focused verification;
- expected deliverable format and write permission (`read-only` or `edit`).

Do not automatically provide the entire parent transcript, repository, skill library, playbook roster, unrelated history, or another implementer's reasoning. A reviewer receives the diff, acceptance criteria, relevant invariants, and verification evidence—not the implementer's full reasoning unless one unresolved issue requires it.

The parent must prevent overlapping file ownership, wait for relevant specialists, reconcile disagreements against source evidence, integrate the final result, ensure abstractions were not bypassed, and retain accountability for final verification and delivery. Parallelize independent read-only work or non-overlapping isolated writes only; never allow concurrent agents to mutate shared files.

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

## 13. Verification ownership and validation ladder

Before running a check, state the question it answers. Do not rerun unchanged scope when successful evidence already answers the same question and no relevant semantic change occurred. Formatting-only or whitespace-only changes do not invalidate broader evidence.

- **Implementer:** prove owned behavior with the smallest meaningful scope: a changed unit/test file, focused component test, or focused manual reproduction. Broaden only for shared infrastructure, an unprovable focused scope, a concrete regression risk, or an explicit assignment.
- **Reviewer:** read-only by default. Inspect diff, acceptance criteria, invariants, and implementer evidence. Rerun only when a concrete doubt remains; crossing an agent boundary is not a reason to repeat checks.
- **Parent/controller:** accept valid focused evidence. Run integration checks only when completed concerns interact, and integrate the result itself.
- **Final gate:** after semantic edits and formatting are complete, run in this order: format → lint/static analysis → focused integration tests → broader relevant tests once → build if runtime behavior changed → RLS/security checks if relevant → manual/browser checks if relevant → final review.

The complete Jest suite is normally a final-gate check for cross-cutting/high-risk application changes, a CI clean-environment check, or a justified shared-infrastructure test. It is not a default for docs-only work, agent configuration, isolated copy, a narrow test change, or each subagent task.

Run the cheapest relevant rung first, then broaden with risk. Exact commands and the acceptable-warning rule are in `vsa-validation-and-qa`.

| Rung | What | When |
|---|---|---|
| Static | `git diff --check`, format, documentation/config validation, lint/typecheck where affected | every change, scoped to changed artifact types |
| Unit | helpers, business logic, transformations | logic changes |
| Component | render, events, states, a11y (`CI=true npm test -- --watchAll=false`, or scoped `--testPathPattern`) | UI/component changes |
| Integration | data access, routes, auth | repo/route changes |
| Build | `npm run build` | application/runtime/config/dependency changes |
| Browser | real flow + mobile + empty/error/loading + visual check | meaningful UI |
| Database | policy + grant matrix for anon/auth/admin (`scripts/verify-rls-security.mjs`) | any RLS/grant/migration |
| Regression | protected existing behavior (golden tests) | high-risk / protected domains |

Run targeted tests first; broaden based on risk and ownership. Tests are **mandatory** for changes to protected logic and for anything `vsa-validation-and-qa` flags; optional for isolated copy/style/docs when they would not answer a new question.

---

## 14. Adversarial review (before claiming done)

Default review depth is main-agent self-review plus one independent final review when risk warrants it. A third review is justified only for a distinct high-risk question involving authentication/authorization, RLS/security, destructive migration, production integration, private data, or physical/external operations; each review must answer a different question.

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

### Tool portability and honest fallback

- Use official user-level/global installation for development helpers; do not add Superpowers, Graphify, Repomix, `rtk`, or GitHub CLI to application runtime dependencies merely to satisfy an agent session.
- `rtk` is an optional token-reduction wrapper. Use it when available; if `command -v rtk` fails, run the ordinary underlying command and report the fallback rather than blocking work.
- If Graphify is unavailable, use targeted `rg`/direct reads and report that it was skipped. Do not claim a query ran.
- Repomix is optional and invoked through `npx repomix` only when a bounded pack resolves a named uncertainty; otherwise use targeted source reads.
- If native subagents or Superpowers are unavailable, use the sequential/equivalent methods in §§5–6 without pretending the missing capability ran.
- If GitHub CLI is unavailable, push with Git and provide the manual PR URL/title/body; never claim a PR was created.

---

*Maintenance: this file is owned per `vsa-docs-and-writing`. When the process changes, edit here and leave the adapters pointing at it.*
