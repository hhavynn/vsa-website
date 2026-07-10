# VSA Website Skill Library

A set of **16 project-specific skills** that let a zero-context engineer or a smaller (Sonnet-class) AI model debug, extend, validate, and advance this codebase at a high standard — without a resident expert. Each skill is a self-contained runbook: verified commands, tables, checklists, and the *why* behind the project's rules.

This README is the front door. Read it once; after that, load individual skills on demand.

---

## How skills work (30-second version)

- Each skill lives at `.claude/skills/<name>/SKILL.md` with YAML frontmatter: a `name` and a **trigger-rich `description`**.
- **AI sessions (Claude Code):** skills load *automatically* when your task matches a skill's `description`. You don't have to name them. You can also load one explicitly with the Skill tool, e.g. *"use the vsa-change-control skill."*
- **Other AI tools (Codex, Gemini, etc.):** these do **not** auto-load `.claude/skills/`. Point them at the file in the task prompt — e.g. *"read `.claude/skills/vsa-change-control/SKILL.md` before making changes"* — the same way `AGENTS.md` routes them to the `.claude/agents/` playbooks.
- **Humans:** open the `SKILL.md` and read it top-to-bottom, or jump to the section header you need — every skill is written to be skimmed.
- **One home per fact.** A fact is explained in exactly one skill; the others cross-reference it by name. If two skills seem to disagree, the one that *owns* the fact (see table below) wins, and it's a bug to file.

### Not the same as the 12 playbook agents
`.claude/agents/*.md` holds **12 domain playbook agents** (e.g. `vsa-points-attendance-guardian`, `vsa-storage-egress`). Those are *personas you delegate a scoped task to*. The things here in `.claude/skills/` are *knowledge you load*. When a skill says "playbook agent `vsa-…`", it means the agent, not a loadable skill.

---

## Pick a skill by what you're doing

| I want to… | Load |
|---|---|
| Know if a change is allowed / how it's gated / how to open the PR | **vsa-change-control** |
| Debug something broken (fallback pages, permission errors, stale UI, build/test fails) | **vsa-debugging-playbook** |
| Understand why an odd migration/revert/dead-branch exists before re-fighting it | **vsa-failure-archaeology** |
| Make a structural change (routes, providers, data layer, auth, degraded mode) | **vsa-architecture-contract** |
| Write/review a migration, RLS policy, view, or Edge Function | **vsa-supabase-security-reference** |
| Find or add an env var, secret, or admin-editable setting | **vsa-config-and-flags** |
| Set up the dev environment from scratch (or fix a setup that broke) | **vsa-build-and-env** |
| Deploy, apply a migration to prod, or run the image pipeline | **vsa-run-and-operate** |
| Measure something (RLS exposure, egress, bundle size, Lighthouse, a11y) | **vsa-diagnostics-and-measurement** |
| Prove a change is actually done, or add a test | **vsa-validation-and-qa** |
| Update a doc of record, write a runbook, or add a skill | **vsa-docs-and-writing** |
| Build/restyle any UI (tokens, dark mode, motion, mobile patterns) | **vsa-design-system-reference** |
| Do anything calendar-driven (House Reveal, applications, VCN, freeze windows, yearly turnover) | **vsa-seasonal-operations** |
| Execute the mobile/UI-excellence campaign, one gated phase at a time | **vsa-ui-excellence-campaign** |
| Decide what ambitious thing to build next | **vsa-research-frontier** |
| Turn a hunch into a proven, adopted change (evidence bar, adversarial review) | **vsa-research-methodology** |

Every skill also has a **"When NOT to use this skill"** block pointing to the right sibling, so a wrong entry point self-corrects.

---

## Fact ownership (where each thing is authoritatively documented)

If you need to *change* a documented fact, change it in its owning skill and let the cross-references stand.

| Fact / topic | Owning skill |
|---|---|
| Change gating, never-do list + rationale, PR/branch rules, freeze-window pointer | vsa-change-control |
| Incident narratives (egress crisis, RLS recursion, reverts, dead branches) | vsa-failure-archaeology |
| Invariants, provider hierarchy, route tiers, known-weak points | vsa-architecture-contract |
| RLS theory, revoke-then-grant, check-in design, recursion fix | vsa-supabase-security-reference |
| Env vars / secrets / admin-editable config catalog | vsa-config-and-flags |
| Deploy path, migration ordering, image pipeline | vsa-run-and-operate |
| Test inventory, evidence bar, QA runbooks | vsa-validation-and-qa |
| Design tokens, components, motion, mobile patterns | vsa-design-system-reference |
| Seasonal state machine, freeze windows, yearly turnover | vsa-seasonal-operations |
| Doc authority order, templates, skill-library maintenance | vsa-docs-and-writing |

---

## The two non-negotiables baked into every skill

1. **Nothing routes around `AGENTS.md` or change-control.** `AGENTS.md` (repo root) is the manifest and overrides everything here. Protected domains (attendance import, points calculation, House membership, leaderboard, RLS) require an explicit owner request; migrations are applied to production **manually**; freeze windows halt changes to House/application/VCN surfaces. A skill that seems to let you skip a gate is wrong — trust `AGENTS.md`.
2. **Ground truth over memory.** Every command, path, and citation was verified against the repo at authoring time. Facts that drift are **date-stamped**, and every skill ends with a **`Provenance and maintenance`** section listing one-line re-verification commands.

---

## Maintaining the library

When you touch the codebase, keep the skills honest:

- **Run the re-verification commands** in a skill's `Provenance and maintenance` section; if reality changed, fix the skill text and re-date-stamp it. (`vsa-docs-and-writing` owns the full maintenance protocol and a known-drift table.)
- **New incident resolved?** Add an entry to `vsa-failure-archaeology` (and a one-line trap pointer in `vsa-debugging-playbook` if it cost debugging time).
- **New env var / secret / config?** Update `vsa-config-and-flags` and `.env.example`.
- **Adding a skill?** One home per fact, a trigger-rich `description`, a "When NOT to use" block, and a `Provenance and maintenance` section. Keep to the existing house style (single-line `description:`, imperative runbook voice). **Also add a row to this README's "Pick a skill" table** — it drifts silently otherwise.

Quick health check:

```bash
# All 16 skills present with frontmatter + provenance (expect "1 name, yes provenance" per row;
# body text may legitimately mention these strings, so check only the frontmatter head):
for f in .claude/skills/vsa-*/SKILL.md; do
  echo "$(basename $(dirname $f)): $(head -3 $f | grep -c '^name:') name, $(grep -q 'Provenance and maintenance' $f && echo yes || echo NO) provenance"
done

# Diagnostics helpers still run:
node .claude/skills/vsa-diagnostics-and-measurement/scripts/route-inventory.mjs | tail -1
bash .claude/skills/vsa-diagnostics-and-measurement/scripts/check-graph-freshness.sh
```

`PLAN.md` in this directory is the build/review changelog for how the library was created and reviewed — historical context, safe to keep or delete.

---

*Library built and reviewed 2026-07-07 (author pass + three-reviewer factual/doctrine/usability pass + fixer). See `PLAN.md` for the build record.*
