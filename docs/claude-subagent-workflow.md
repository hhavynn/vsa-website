# Claude Subagent Workflow (VSA Website)

This repo ships project-level **Claude Code subagents** under `.claude/agents/`. Each subagent is a focused persona that guides Claude to work safely within one domain of the production VSA at UCSD website.

## What Claude subagents are here

A subagent is a Markdown file with YAML frontmatter (`name`, `description`, `tools`) plus focused instructions. When you ask Claude to use a subagent, Claude works within that domain's rules, file list, and safety constraints — and only with the tools that subagent is granted.

## When to use a subagent vs. the main conversation

- **Use a subagent** when the task clearly belongs to one domain (Houses, events, points, applications, etc.) and you want Claude to respect that domain's guardrails.
- **Use the main conversation** for quick questions, multi-domain orchestration, or deciding which subagent should own a task. `vsa-architecture-guardian` is a good first stop when a change spans domains.

## How to ask Claude to use a specific subagent

State the subagent name and a scoped goal:

> "Use the `vsa-house-system` subagent to audit why `/house/year/2026-2027` is showing current House data. Report root cause before editing."

## The VSA subagents

See `.claude/agents/README.md` for the full table. Summary:

- `vsa-architecture-guardian` — cross-cutting architecture, route/data-flow safety, PR risk. **Audit/review-only.**
- `vsa-public-content` — homepage, program pages, public copy, fallback content.
- `vsa-admin-workflows` — admin dashboard, navigation, CRUD, admin UX.
- `vsa-events-gallery` — events, recaps, gallery, calendar buttons, publishing.
- `vsa-points-attendance-guardian` — attendance import, points, leaderboard, lookup. **Audit-first / read-only.**
- `vsa-house-system` — House pages, year/archive routing, profiles, standings display.
- `vsa-cabinet-leadership` — cabinet page/archive/admin, president & current-year content.
- `vsa-ai-knowledge` — Ask VSA assistant, AI knowledge base, Edge Function safety.
- `vsa-applications-forms` — admin-managed application windows and form links.
- `vsa-storage-egress` — storage URL audits, egress reduction, migration planning (dry-run/docs).
- `vsa-testing-qa` — build/lint/test failures, route QA, regression tests.
- `vsa-docs-acceptance` — runbooks, QA/PR checklists, scoped task prompts (docs only).

## Audit/review-only vs. edit-capable

- **Audit/review-only (no edits):** `vsa-architecture-guardian`, `vsa-points-attendance-guardian`.
- **Edit-capable, but scoped:** all others. `vsa-storage-egress` writes only dry-run plans / review-only SQL to `docs/`. `vsa-docs-acceptance` edits docs only.

Protected systems (attendance import, points calculation, House membership, leaderboard calculation, RLS, storage originals, admin/private data) should always be approached **audit-first** — report root cause before any edit.

## How to write a good scoped task

A good task names the subagent, the goal, the scope, what's out of scope, and the verification expected.

**Good**

> "Use the `vsa-events-gallery` subagent to inspect the Google Calendar button overflow on event cards. Make the smallest safe UI fix and verify mobile layout."

**Bad**

> "Make events better."

**Good**

> "Use the `vsa-storage-egress` subagent to audit `supabase.co/storage` image URLs and generate review-only SQL. Do not mutate production."

**Bad**

> "Move images."

**Good**

> "Use the `vsa-house-system` subagent to audit why `/house/year/2026-2027` is showing current House data. Report root cause before editing."

**Bad**

> "Fix Houses."

## How to review the subagent's output

1. Confirm the change stayed in the named domain and scope.
2. Read the diff — no app source, schema, RLS, or protected-logic changes unless explicitly requested.
3. Confirm no private data (emails, rosters, check-in codes, payment logs, import/admin notes) reached a public surface.
4. Confirm no secrets, env values, or real application links were hardcoded.
5. Run the verification commands.

## Safety checklist before accepting code changes

- [ ] Change is scoped to the requested domain.
- [ ] No schema / RLS / migration changes (unless explicitly requested with criteria + tests).
- [ ] No changes to attendance import, points, House membership, or leaderboard logic (unless explicitly requested with criteria + tests).
- [ ] No private/admin data exposed on public routes.
- [ ] No secrets, env values, or private URLs added.
- [ ] No fake events, members, points, standings, House assignments, or application links.
- [ ] `npm run build` passes.
- [ ] `npm run lint` passes.
- [ ] `CI=true npm test -- --watchAll=false` passes.
