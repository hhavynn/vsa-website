# Claude Subagent Workflow (VSA Website)

This repo ships project-level **Claude Code subagents** under `.claude/agents/`. Each subagent is a focused persona that guides Claude to work safely within one domain of the production VSA at UCSD website.

## What Claude subagents are here

A subagent is a Markdown file with YAML frontmatter (`name`, `description`, `tools`) plus focused instructions. Claude infers the relevant domain from the user's request and invokes a bounded specialist when it materially improves safety, specialization, independent review, or parallel progress.

## When to use a subagent vs. the main conversation

- **Use a subagent** for bounded domain implementation, audit-first protected work, independent architecture/privacy/security review, or independent non-overlapping investigations.
- **Use the parent directly** for micro work and one coherent, already-scoped concern. The parent always owns multi-domain orchestration, integration, final verification, and delivery.

## Automatic selection

The user describes the product outcome; the parent selects the playbook from `.claude/agents/README.md`. Internal delegation uses `docs/claude-subagent-task-template.md` and canonical workflow §9. Users never need to provide a playbook name, file list, tool choice, or subagent strategy.

Do not invoke every playbook ceremonially. Do not parallelize overlapping writes. When a harness lacks native subagents, apply the same playbook as a sequential specialist pass per canonical workflow §5.

## The VSA subagents

See `.claude/agents/README.md` for the one canonical roster. Do not copy the roster into helper docs.

## Audit/review-only vs. edit-capable

- **Audit/review-only (no edits):** `vsa-architecture-guardian`, `vsa-points-attendance-guardian`.
- **Edit-capable, but scoped:** all others. `vsa-storage-egress` writes only dry-run plans / review-only SQL to `docs/`. `vsa-docs-acceptance` edits docs only.

Protected systems (attendance import, points calculation, House membership, leaderboard calculation, RLS, storage originals, admin/private data) should always be approached **audit-first** — report root cause before any edit.

## How the parent writes a scoped task

A good internal task names the playbook, objective, owned and forbidden files/systems, relevant invariants, acceptance criteria, focused verification, write permission, and deliverable. It contains targeted Graphify/source/Repomix context—not the parent transcript or entire repository.

**Good**

> "Use the `vsa-events-gallery` subagent to inspect the Google Calendar button overflow on event cards. Make the smallest safe UI fix and verify mobile layout."

**Good**

> "Use the `vsa-storage-egress` subagent to audit `supabase.co/storage` image URLs and generate review-only SQL. Do not mutate production."

**Good**

> "Use the `vsa-house-system` subagent to audit why `/house/year/2026-2027` is showing current House data. Report root cause before editing."

These are parent-to-specialist prompts, not user requirements. A user may say "make events better" or "fix Houses"; the parent investigates and constructs the scoped internal task.

## How to review the subagent's output

1. Confirm the change stayed in the named domain and scope.
2. Read the diff — no app source, schema, RLS, or protected-logic changes unless explicitly requested.
3. Confirm no private data (emails, rosters, check-in codes, payment logs, import/admin notes) reached a public surface.
4. Confirm no secrets, env values, or real application links were hardcoded.
5. Inspect focused verification evidence; rerun only for a concrete unanswered doubt.

## Safety checklist before accepting code changes

- [ ] Change is scoped to the requested domain.
- [ ] No schema / RLS / migration changes (unless explicitly requested with criteria + tests).
- [ ] No changes to attendance import, points, House membership, or leaderboard logic (unless explicitly requested with criteria + tests).
- [ ] No private/admin data exposed on public routes.
- [ ] No secrets, env values, or private URLs added.
- [ ] No fake events, members, points, standings, House assignments, or application links.
- [ ] Focused implementer evidence answers the owned behavior.
- [ ] Parent integration and final-gate checks follow canonical workflow §13 without duplicate confidence work.
