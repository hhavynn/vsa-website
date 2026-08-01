You are the sole implementation agent for GitHub issue #219 in the repository `hhavynn/vsa-website`.

## Read and obey, in this order

1. `.agent-handoff/public-launch/issue-219/implementation-plan.md` — **the authoritative plan for this task.** Read it completely before editing anything.
2. The applicable `AGENTS.md` files (root, and any nested one covering `docs/`).
3. `CLAUDE.md` (root) and `.claude/CLAUDE.md`.
4. `.claude/agents/vsa-docs-acceptance.md` — your domain playbook for this issue. It is **guidance, not permission to ignore current source**. Where the playbook and the actual repository disagree, the repository wins and you say so in your report.
5. `docs/security-headers-and-csp.md` — the file you are changing.
6. `vercel.json` — **read-only reference. Do not edit it.**

## Graphify

Run `./scripts/graphify-run --version || true` and check whether `graphify-out/graph.json` exists. Per the plan, this issue's scope is already located with certainty (two known files), so do **not** spend effort on graph queries — this is an explicit exception recorded in the plan, not an oversight. Do not install or update Graphify. Do not stage, edit, or commit anything under `graphify-out/`.

## The task in one line

Issue #219 assumes `vercel.json`'s `Strict-Transport-Security: max-age=0` is a bug. **It is not.** It was set deliberately by merged PR #187 (commit `ac484dbd`, 2026-07-08) to stop cached HSTS from breaking UCSD campus captive-portal Wi-Fi. Your job is to make `docs/security-headers-and-csp.md` tell the truth — **not** to change the header.

The plan's "THE CRITICAL FINDING" and "What the change must contain" sections are binding. Follow them.

## Hard constraints

- **Do not modify `vercel.json`.** Not one character. `git diff -- vercel.json` must be empty when you finish. This is the single most important constraint in this task.
- Change exactly one file: `docs/security-headers-and-csp.md`.
- Do not add `preload` to any header or recommend it.
- Do not fix the doc's stale "legacy `routes` array" wording — that belongs to issue #220, not this one.
- Do not touch the CSP sections.
- Do not reformat, reflow, or restructure unrelated parts of the document.
- Implement only issue #219. No unrelated refactors.
- Remain inside this worktree.
- Do not commit, push, create a PR, merge, force-push, tag, or modify any production system. The controller owns all Git and GitHub operations.
- Do not expose secrets or use real applicant/member data.
- Do not modify `.claude/settings.local.json`.
- Do not apply migrations to anything.

## Verification you must run

```
git --no-pager diff --stat
git --no-pager diff -- vercel.json
git status --short
```

Required results:
- `git diff --stat` shows exactly one changed file: `docs/security-headers-and-csp.md`
- `git diff -- vercel.json` is **empty**
- No unexpected untracked files (anything under `.agent-handoff/` is fine)

Run these and paste the real output. Do not describe what you expect them to print.

## Final report

Write your report to `.agent-handoff/public-launch/issue-219/codex-result.md` containing:

- Files changed (exact paths)
- Implementation summary
- Decisions made (especially any wording or placement judgment call)
- Tests added or updated (expected: none — say so explicitly)
- Commands run
- Exact results of each command, pasted verbatim
- Assumptions
- Remaining limitations
- Any blocker

Do not stop after describing the implementation. Make the change, verify it, and write the report.
