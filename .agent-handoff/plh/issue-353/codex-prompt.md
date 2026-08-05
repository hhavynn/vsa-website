You are the sole implementation agent for GitHub issue #353 in `hhavynn/vsa-website`. This is a **security incident remediation**.

## Read and obey, in order

1. `.agent-handoff/plh/issue-353/implementation-plan.md` - the authoritative plan. Read it fully. Its "Recommended decision" and "Non-goals" are binding.
2. Root `AGENTS.md` and `CLAUDE.md`.
3. `.claude/agents/vsa-ai-knowledge.md` - domain playbook (Edge Function safety). Guidance, not permission to ignore current source; the repo wins on conflict and you say so.
4. `docs/edge-function-security-audit.md` - you will update this.

## Graphify

Run `./scripts/graphify-run --version || true`; check for `graphify-out/graph.json`. Use a query if it helps confirm `secure-ai` has no inbound references, but verify any finding against actual source. Do not install/update Graphify. Never stage or edit `graphify-out/`.

## Task

An OpenAI API key was exposed in public git history. `OPENAI_API_KEY` has exactly one consumer in this repo: `supabase/functions/secure-ai/`.

That function has **zero references anywhere in the repository** - not in `src/`, not in workflows, not in docs outside its own directory. The only Edge Function invoked from `src/` is `analytics-proxy`. It is dead code whose sole purpose is holding a compromised paid-API credential, and per the #229 audit it does not even check admin status.

**Delete `supabase/functions/secure-ai/` entirely**, then update every doc that references it so the repo tells the truth.

**Before deleting, re-verify independently that nothing references it.** If you find any real reference from application code, a workflow, or deployed config: STOP, do not delete, and report it as a blocker.

## Hard constraints

- **Never print, echo, reconstruct, or quote the actual API key value** - not in code, docs, commit text, logs, or your report. Refer to it only as `OPENAI_API_KEY`.
- Do NOT rewrite git history. Do NOT force-push. Do NOT alter `build/` handling or `.gitignore`.
- Do NOT touch `vsa-ai-assistant`, `analytics-proxy`, or either `trigger-*` function.
- Do NOT change `.env.example` - it is already correct.
- Do NOT add secret-scanning CI tooling - that is issue #348.
- No unrelated refactors.
- Stay in this worktree. Do NOT commit, push, create a PR, merge, or force-push - the controller owns all Git/GitHub operations.
- Do not modify `.claude/settings.local.json`. Do not stage `.agent-handoff/` or `graphify-out/`.

## Verification you must run, pasting real verbatim output

```
git status --short
git --no-pager diff --stat HEAD
grep -rn "secure-ai" --include=*.ts --include=*.tsx --include=*.md --include=*.json --include=*.yml . | grep -v node_modules | grep -v .agent-handoff
grep -rn "OPENAI_API_KEY" . --include=*.ts --include=*.md --include=*.example | grep -v node_modules | grep -v .agent-handoff
npm run build
CI=true npx react-scripts test --watchAll=false
```

`npm run build` must succeed and all tests must still pass. Run `npm ci` first if `node_modules` is missing.

## Final report

Write `.agent-handoff/plh/issue-353/codex-result.md` with: files changed/deleted, implementation summary, decisions, tests, commands run, exact verbatim results, assumptions, limitations, blockers.

**Your report MUST state prominently** that deleting the directory does not undeploy the function, and that a human must still run:

```
supabase functions delete secure-ai
supabase secrets unset OPENAI_API_KEY
```

Make the change and verify it. Do not stop at describing it.
