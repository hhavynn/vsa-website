You are the sole implementation agent for GitHub issue #359 in `hhavynn/vsa-website`.

## Read and obey, in order

1. `.agent-handoff/plh/issue-359/implementation-plan.md` — the authoritative plan. Read it fully. The licensing decision in it is **already settled by the repository owner** — implement it exactly, do not re-open it or offer alternatives.
2. Root `AGENTS.md` and `CLAUDE.md`.
3. `.claude/agents/vsa-docs-acceptance.md` — domain playbook (docs/policy, no app behavior change). Guidance, not permission to ignore current source; the repo wins on conflict and you say so.
4. `README.md` (the `## License` section around L157-159), `.github/CONTRIBUTING.md`, `package.json`.

## Graphify

Run `./scripts/graphify-run --version || true`; check for `graphify-out/graph.json`. Scope is a handful of known policy files, so do not spend effort on graph queries. Never install or update Graphify, and never stage or edit `graphify-out/`.

## Task

The repo is public with no license, so it is currently all-rights-reserved and nobody can legally reuse the code. Implement this split:

- **Code: MIT**, copyright holder `Vietnamese Student Association at UC San Diego` — the ORGANIZATION, never an individual contributor.
- **Everything else is NOT MIT**: photographs under `public/images/**` (`cabinet/`, `events/`, `gallery/`, `2024events/` — images of identifiable students), the VSA name/logo/marks, site copy, archives, and any member data. All rights reserved.
- Third-party assets keep their original licenses.
- Trademarks are not granted by the code license.

Files to create or change:
- new `LICENSE` — canonical MIT text, do not paraphrase it
- new `NOTICE.md` — the substantive boundary document; follow the plan's "What NOTICE.md must contain"
- `README.md` — replace the existing License section with an accurate summary linking both files
- `package.json` — add `"license": "MIT"`
- `.github/CONTRIBUTING.md` — a short contributor-expectations paragraph

## Hard constraints

- Do NOT invent ownership claims. Where ownership is genuinely unclear, use conservative language and name the uncertainty.
- Do NOT invent an email address or contact — the repo publishes none. For a removal-request path, point at the reporting channel in `SECURITY.md` or the issue tracker.
- Do NOT add per-file SPDX headers across the source tree.
- Do NOT modify application source, tests, or migrations. Do NOT delete or move any image.
- Do NOT touch `node_modules/` or any vendored third-party file.
- Do NOT claim to give legal advice or assert legal conclusions the repo cannot support.
- No unrelated refactors.
- Stay in this worktree. Do NOT commit, push, create a PR, merge, or force-push — the controller owns all Git and GitHub operations.
- Do not modify `.claude/settings.local.json`. Do not stage `.agent-handoff/` or `graphify-out/`.

## Verification you must run, pasting real verbatim output

```
git --no-pager diff --stat
git status --short
node -p "require('./package.json').license"
npm run build
CI=true npx react-scripts test --watchAll=false
```

`package.json` must still parse and report `MIT`. The build and all tests must pass. Run `npm ci` first if `node_modules` is missing.

## Final report

Write `.agent-handoff/plh/issue-359/codex-result.md` containing: files changed, implementation summary, decisions made (especially anywhere you chose conservative wording because ownership was unclear), tests added or changed, commands run, exact verbatim results, assumptions, limitations, and any blocker.

In limitations, note that whether existing consent covers publishing member photographs in a public, forkable git repository is a separate unresolved question that this PR does not settle.

Make the changes and verify them. Do not stop at describing them.
