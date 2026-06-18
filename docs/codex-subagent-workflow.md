# Codex VSA Playbook Workflow

Codex does not natively load `.claude/agents/` as Claude Code subagents. This repository provides the equivalent routing through `AGENTS.md`: each `.claude/agents/<name>.md` file is a source-of-truth VSA domain playbook that Codex reads before handling a matching task.

## Asking Codex to use a playbook

Name the playbook, state whether Codex should audit or edit, and define the smallest acceptable scope.

Examples:

- “Use the `vsa-house-system` playbook. Audit first, no edits yet.”
- “Use the `vsa-events-gallery` playbook to fix Google Calendar button overflow. Smallest safe fix only.”
- “Use `vsa-storage-egress` to audit Supabase Storage URLs. Generate review-only SQL. Do not mutate production.”

For multiple domains, explicitly name each playbook and ask Codex to consolidate the findings. Use `vsa-architecture-guardian` first when ownership or cross-domain risk is unclear.

## Quick reference

| Task type | Playbook |
|---|---|
| Architecture, route tiers, data-flow risk | `vsa-architecture-guardian` |
| Homepage, public copy, programs, fallback content | `vsa-public-content` |
| Admin dashboard, navigation, CRUD, admin UX | `vsa-admin-workflows` |
| Events, recaps, gallery, calendar controls | `vsa-events-gallery` |
| Attendance, points, leaderboard, member lookup | `vsa-points-attendance-guardian` |
| House pages, archives, profiles, standings display | `vsa-house-system` |
| Cabinet, leadership, current-year content | `vsa-cabinet-leadership` |
| Ask VSA and AI knowledge safety | `vsa-ai-knowledge` |
| Application windows and form links | `vsa-applications-forms` |
| Storage URLs, egress, migration planning | `vsa-storage-egress` |
| Build, lint, tests, route and regression QA | `vsa-testing-qa` |
| Runbooks, acceptance criteria, contributor docs | `vsa-docs-acceptance` |

## Audit-first domains

- `vsa-architecture-guardian` is review-only.
- `vsa-points-attendance-guardian` is audit-first/read-only.
- `vsa-storage-egress` starts with a dry run and may produce only reviewable plans or SQL unless the user separately authorizes execution.
- Any task touching points, attendance, House membership, leaderboard calculation, RLS, storage migration, or private data starts in audit-only mode and reports before editing.

## Reviewing Codex output

Check that Codex read the named playbook, stayed inside the requested files, preserved protected systems, and reported verification and manual QA. Review the final diff for accidental app, schema, RLS, dependency, secret, or private-data changes.

Avoid vague prompts such as “fix Houses.” State the observed problem, year or route, allowed files, protected behavior, acceptance criteria, and whether edits are authorized.
