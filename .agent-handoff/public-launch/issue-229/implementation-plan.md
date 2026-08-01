# Implementation plan — issue #229 (CORS slice)

**Title:** Audit Edge Function secret handling and CORS across all 5 functions
**Branch:** `codex/issue-229-cors-audit`
**Worktree:** `C:/Users/xiate/Documents/CS/vsa-worktrees/issue-229`
**Base:** `origin/main` @ `dd2d585c`
**Parent epic:** #206

## Scope decision (read first)

#229 has five acceptance criteria. Two of them **cannot be satisfied from the repository** and are external blockers:

- *"Verify both `trigger-*` functions reject unauthenticated/non-admin callers — test it, don't read it"* — requires issuing live requests to deployed production Edge Functions. The controller will not do that autonomously.
- *"Determine whether `secure-ai` is still used"* — requires Supabase function invocation logs, which are not in the repo.

This PR delivers the three that **are** repo-answerable:

1. Per-function documentation of secrets, privileges, who may call, and how it is enforced.
2. CORS reviewed per function; no permissive `*` on a privileged function. **← the code change**
3. No secret returned in a response body or error message.

**This PR must NOT close #229.** Reference it only. The two blocked criteria stay open.

## Correction carried into this plan

An earlier claim that the `trigger-*` functions have no inbound authorization was **wrong** (it came from grepping for `Authorization`/`is_admin`, which misses a custom header name). Both enforce a shared secret at lines 35–40 via `x-image-migration-secret`, return 401 on mismatch, fail closed when the env var is unset, and reject non-POST with 405. Do not "fix" a problem that does not exist.

## Verified current state

| Function | CORS today | Verdict |
| --- | --- | --- |
| `vsa-ai-assistant` | `allowedOrigins` Set, echoes matching origin, safe default, sends `Vary: Origin` | ✅ **Correct. This is the reference pattern.** |
| `secure-ai` | `ACAO` = `'https://www.vsaatucsd.com,https://vsa-website-…vercel.app,http://localhost:3000'` — three origins comma-joined into one header value | ❌ **Broken.** ACAO must be a single origin or `*`. A comma-joined list is invalid per the Fetch spec and browsers reject it, so CORS currently fails for *every* origin. Also pairs `Allow-Credentials: 'true'` with it. |
| `analytics-proxy` | `ACAO: '*'` with a stale `// Adjust in production to specific domains` comment (line 5) | ❌ **Over-permissive** on a function that performs a privileged admin action (`user_profiles.is_admin` check, proxies the GA4 Data API). |
| `trigger-event-image-migration` | none | ✅ Correct — server-to-server webhook, never browser-called. Adding CORS would be wrong. |
| `trigger-house-event-image-migration` | none | ✅ Same. |

Error-body check: a grep for `err.message` / `error.message` / `String(err)` / `.stack` across `supabase/functions/*/index.ts` returns **no matches**. No function interpolates a raw error into a response body. Confirm and record this rather than changing anything.

## Recommended decision (DECIDED)

**Extract the `vsa-ai-assistant` origin-allowlist pattern into a shared module and adopt it in `secure-ai` and `analytics-proxy`.**

Rationale: the correct implementation already exists in this repo and is proven in production. Three hand-rolled CORS configs become one. This is also the concrete first instance of the shared-helper direction in #347.

## Non-goals

- Do **not** add CORS headers to either `trigger-*` function.
- Do **not** add rate limiting (that is #352).
- Do **not** delete `secure-ai` — its vestigial status is unresolved and deletion needs owner sign-off.
- Do **not** change any authorization logic, secret handling, or business logic.
- Do **not** touch `vsa-ai-assistant`'s behavior. You may only *move* its CORS logic into the shared module and have it import it — its emitted headers must remain byte-identical.
- No frontend changes. No migrations.

## Files expected to change

- **New:** `supabase/functions/_shared/cors.ts`
- `supabase/functions/secure-ai/index.ts`
- `supabase/functions/analytics-proxy/index.ts`
- `supabase/functions/vsa-ai-assistant/index.ts` (import the shared helper; **zero behavior change**)
- **New:** `docs/edge-function-security-audit.md`

## What the shared module must do

Mirror the existing `vsa-ai-assistant` implementation:

- Export an allowlist containing at minimum `https://www.vsaatucsd.com`, `https://vsaatucsd.com`, `http://localhost:3000`, `http://localhost:5173`.
- Export `corsHeaders(req: Request)` returning `Access-Control-Allow-Origin` set to the request origin **only if** it is in the allowlist, otherwise the safe default `https://www.vsaatucsd.com`.
- Always include `Vary: Origin`. This is mandatory — without it a CDN can cache one origin's response and serve it to another.
- Allow per-function `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers`, since they legitimately differ.
- **Preserve `secure-ai`'s `Access-Control-Allow-Credentials: 'true'`** — but only ever alongside a single concrete origin, never `*`. Note in the doc that `*` plus credentials is invalid and that this is now structurally impossible.
- The Vercel preview origin currently hardcoded in `secure-ai` (`https://vsa-website-ee2odt0xc-havyn-nguyens-projects.vercel.app`) is a one-off deployment URL that will not match future previews. Do **not** carry it into the shared allowlist. Record the drop and the reason in the doc — if preview-origin support is wanted, it needs a pattern match, which is a separate decision.

## The audit document

`docs/edge-function-security-audit.md`, dated 2026-08-01, with a row per function covering: secrets read, privileges used, who may call it, how that is enforced (exact mechanism and line), CORS posture, and whether any secret can reach a response body.

It must state plainly, as open items, that (a) the live unauthenticated-call test against the `trigger-*` functions has **not** been performed, and (b) `secure-ai`'s vestigial status is **unresolved**. Do not imply the audit is complete.

## Security considerations

- Never print, log, or embed a secret value. Refer to env vars by name only.
- Do not weaken any existing authorization check.
- Narrowing CORS can break a legitimate caller. `analytics-proxy` is called from the admin analytics page on the production origin, which is in the allowlist. Call out the risk in the report.
- The repo is public — write the doc for an external reader and include no internal URLs beyond what is already committed.

## Verification Codex must run

```
git --no-pager diff --stat
git status --short
deno check supabase/functions/secure-ai/index.ts supabase/functions/analytics-proxy/index.ts supabase/functions/vsa-ai-assistant/index.ts supabase/functions/_shared/cors.ts
git --no-pager diff -- supabase/functions/trigger-event-image-migration/index.ts supabase/functions/trigger-house-event-image-migration/index.ts
```

Required:
- The two `trigger-*` diffs are **empty**.
- `deno check` passes on all four files. If `deno` is not installed, say so explicitly and do not claim it passed.
- No file outside the expected list is modified.

## Definition of completion

Shared CORS module exists and is used by all three browser-facing functions; no `*` remains on a privileged function; `secure-ai`'s invalid comma-joined ACAO is gone; `vsa-ai-assistant`'s emitted headers are unchanged; both `trigger-*` files are untouched; the audit doc exists and is honest about the two unresolved criteria; `codex-result.md` written.
