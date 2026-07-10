# Codex Internal Specialist Task Template

The parent agent fills this template only when delegation or a sequential specialist pass is justified. Users provide the product request and do not need to name playbooks, files, tools, or subagents.

```text
Codex playbook/subagent to use:
  <e.g. vsa-house-system>

Goal:
  <desired outcome>

Current problem:
  <observed behavior, route, error, or content issue>

Owned files or subsystem:
  <exact ownership boundary>

Forbidden files or systems:
  <shared files, protected behavior, and unrelated domains that must not change>

Likely files:
  <paths or areas, if known>

Relevant invariants and constraints:
  <only the architecture, privacy, security, and domain rules this concern needs>

Targeted context:
  <specific Graphify findings and source/Repomix excerpts; never the full transcript or repository>

Permission:
  <read-only or edit>

Safety rules:
  - Do not expose secrets or private/admin data.
  - Do not invent events, members, points, standings, links, or House assignments.
  - Do not change schema, migrations, RLS, or protected calculations unless explicitly authorized.
  - Preserve unrelated local changes.

Audit-first instructions:
  <audit only and report before editing, or explain why scoped edits are authorized>

Acceptance criteria:
  - <observable result 1>
  - <observable result 2>

Focused verification:
  - <smallest test/reproduction proving the owned behavior>
  - <broader check only when this concern owns the question>

Expected deliverable:
  <diff/report, evidence, concerns, and exact files touched>

Manual QA checklist:
  - <route/state/device to inspect>
  - <privacy or degraded-mode check>
  - Confirm no unrelated behavior changed.

Final response format:
  - Root cause or audit findings
  - Files changed
  - Safety confirmations
  - Verification results
  - Manual QA and remaining risks
```

If the task touches points, attendance, House membership, leaderboard calculation, RLS, storage migration, or private data, start in audit-only mode and report before editing.
