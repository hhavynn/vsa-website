# Implementation plan — issue #353 (exposed OpenAI key, repo-side remediation)

## The incident

GitHub secret-scanning alert #1: an **OpenAI API Key**, `state: open`, `resolution: null`, `validity: unknown`. Located in `build/static/js/main.681d6be1.js` at commit `724fe074` (2025-09-18). The repo is public, so that commit is world-readable.

## What is ALREADY handled (do not redo)

Commit `344ed5ab` ("SECURITY: Remove build files containing API keys") removed the build output from tracking. `git ls-files build/` returns 0 files and `/build` is gitignored (`.gitignore` L8-9). **The current tree contains no exposed secret.** Confirmed by scan: no `eyJhbGciOiJ`, `sk-`, or `AIza` literals anywhere in tracked source.

Do NOT rewrite git history and do NOT force-push. The repo is public; the old key must be treated as permanently compromised, and rotation - not history surgery - is the remediation. Rewriting 729 commits of public history would break every clone and fork for no security gain.

## The decisive new evidence

`OPENAI_API_KEY` is read by exactly one place in the repo: `supabase/functions/secure-ai/index.ts`.

Verified today:
- `grep -rn "secure-ai" src/` -> **no matches**
- The only Edge Function invoked from `src/` is `analytics-proxy` (`functions.invoke('analytics-proxy')`)
- Searching every tracked `.ts`, `.tsx`, `.md`, `.json`, `.yml` outside `supabase/functions/secure-ai/` for the string `secure-ai` -> **no matches**

So `secure-ai` has **zero references anywhere in the repository**. It is dead code that exists only to hold a compromised paid-API credential.

The #229 audit also found it authenticates a caller but **never checks admin status** - any authenticated user could trigger a paid OpenAI call.

## Recommended decision (DECIDED)

**Delete `supabase/functions/secure-ai/` entirely.**

This is strictly better than rotating the key into it:
- It removes the only consumer of `OPENAI_API_KEY`, so no replacement key ever needs to exist.
- It removes a paid-API surface reachable by any authenticated user.
- It removes a second AI assistant that duplicates the live, well-guarded `vsa-ai-assistant` (which uses Gemini and has rate limits, safety filters, and hashed logging).

Deleting dead code is reversible - it stays in git history and can be restored.

## Non-goals

- Do NOT touch `vsa-ai-assistant`, `analytics-proxy`, or either `trigger-*` function.
- Do NOT rewrite git history, force-push, or alter `build/` handling.
- Do NOT add secret-scanning CI tooling here - that is #348, a separate issue.
- Do NOT print, echo, reconstruct, or reference the actual key value anywhere - not in code, docs, commit text, or the report. Refer to it only as `OPENAI_API_KEY`.
- Do NOT change `.env.example` - it already correctly documents that `OPENAI_API_KEY` is a Supabase Edge Function secret and warns against `REACT_APP_*` secrets.

## Expected files to change

- **Delete:** `supabase/functions/secure-ai/` (the whole directory, including `index.ts` and any sibling files)
- **Update:** `docs/edge-function-security-audit.md` - the `secure-ai` row and the "unresolved" note about its vestigial status, which this change resolves
- **Update:** any doc that lists `secure-ai` as a live function. Search `docs/` and `.claude/` for the string and update factually. If `.claude/skills/vsa-config-and-flags/` documents `OPENAI_API_KEY`, update it to record that the function was removed and the secret is no longer used.

Search first; change only what actually references it.

## Security implications

After this merges, `OPENAI_API_KEY` has no consumer in the repository. The Supabase secret itself still exists until someone unsets it - that is an external action, documented below, not something this PR can do.

## Deployment implications - IMPORTANT

Deleting the directory does **not** undeploy the function. `.github/workflows/deploy.yml` has no `supabase functions deploy` step; Edge Functions are deployed and removed manually. After merge, a human must run:

```
supabase functions delete secure-ai
supabase secrets unset OPENAI_API_KEY
```

State this explicitly in the report. Do not imply the deployed function disappears on merge.

## Tests

No test currently covers `secure-ai`. Deleting dead code needs no new test. Do not invent one.

## Verification Codex must run, pasting real output

```
git status --short
git --no-pager diff --stat HEAD
grep -rn "secure-ai" --include=*.ts --include=*.tsx --include=*.md --include=*.json --include=*.yml . | grep -v node_modules | grep -v .agent-handoff
grep -rn "OPENAI_API_KEY" . --include=*.ts --include=*.md --include=*.example | grep -v node_modules | grep -v .agent-handoff
npm run build
CI=true npx react-scripts test --watchAll=false
```

Required:
- The only remaining `secure-ai` references are historical//documentary ones you deliberately updated to past tense.
- No `OPENAI_API_KEY` reference remains that implies a live consumer.
- `npm run build` succeeds and all tests still pass (they should be entirely unaffected - `secure-ai` is not in the frontend build).

## Rollback

`git revert` restores the directory. The deployed function is unaffected by the repo change either way.

## Blocker conditions

- Discovering any real reference to `secure-ai` from application code, a workflow, or a deployed config. If found, STOP and report instead of deleting.

## Definition of completion

`supabase/functions/secure-ai/` is gone, every doc referencing it is factually updated, no reference implies a live consumer of `OPENAI_API_KEY`, build and tests pass, and the report states the two manual Supabase commands still required.
