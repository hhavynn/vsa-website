# Codex VSA Playbook Task Template

Copy, fill in, and send this prompt to Codex.

```text
Codex playbook/subagent to use:
  <e.g. vsa-house-system>

Goal:
  <desired outcome>

Current problem:
  <observed behavior, route, error, or content issue>

Scope:
  <what Codex may inspect or change>

Out of scope:
  <protected behavior and unrelated domains that must not change>

Likely files:
  <paths or areas, if known>

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

Verification commands:
  - npm run build
  - npm run lint
  - CI=true npm test -- --watchAll=false

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
