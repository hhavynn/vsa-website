## Problem

Five Edge Functions were written at different times and had never been reviewed together. Three are browser-facing and each hand-rolled its own CORS configuration. Two of those three were wrong:

- **`secure-ai`** set `Access-Control-Allow-Origin` to **three origins comma-joined into a single header value**. That is invalid per the Fetch spec — a browser must match ACAO against exactly one origin (or `*`), so this header matched *nothing*. CORS was effectively broken for every origin, including production.
- **`analytics-proxy`** sent `Access-Control-Allow-Origin: '*'` on a privileged endpoint that checks `user_profiles.is_admin` and proxies the GA4 Data API — with a stale `// Adjust in production to specific domains` comment admitting it.

`vsa-ai-assistant` already had the correct implementation: an origin allowlist, a safe default, and `Vary: Origin`.

## Correction to the issue's premise

#229 flags the two `trigger-*` functions as "the sharpest edge" on the theory they may be callable without authorization. **They are not.** Both enforce a shared secret at lines 35–40:

```ts
const expectedSecret = Deno.env.get("IMAGE_MIGRATION_WEBHOOK_SECRET");
const receivedSecret = req.headers.get("x-image-migration-secret");
if (!expectedSecret || receivedSecret !== expectedSecret) {
  return json({ triggered: false, reason: "Unauthorized" }, 401);
}
```

They fail closed when the env var is unset and reject non-POST with 405. An earlier claim to the contrary in #347/#352 came from grepping for `Authorization`/`is_admin`, which misses a custom header name; those issues have been corrected.

## Recommended decision made

**Extract the already-correct `vsa-ai-assistant` pattern into `supabase/functions/_shared/cors.ts` and adopt it in the other two**, rather than writing a third variant. The correct implementation already existed and is proven in production; three hand-rolled configs become one. This is also the first concrete instance of the shared-helper direction in #347.

## Implementation

- **New `supabase/functions/_shared/cors.ts`** — allowlist of the 4 real origins, echoes the request origin only on a match, otherwise the safe default `https://www.vsaatucsd.com`. Always emits `Vary: Origin` so a CDN cannot serve one origin's response to another. Per-function `Allow-Methods`/`Allow-Headers` overrides, and opt-in `Allow-Credentials`.
- **`analytics-proxy`** — `'*'` removed. `jsonResponse` now takes `req` so responses carry per-request CORS.
- **`secure-ai`** — invalid comma-joined ACAO removed. Keeps `Allow-Credentials: true`, but the helper only ever pairs it with a single concrete origin, making the invalid `*`+credentials combination structurally impossible.
- **`vsa-ai-assistant`** — imports the shared helper. **Emitted headers are byte-identical**; this is a pure move.
- **New `docs/edge-function-security-audit.md`** — per-function table of secrets read, privileges used, who may call, the exact enforcement mechanism with line references, CORS posture, and whether a secret can reach a response body.

The one-off Vercel preview origin hardcoded in `secure-ai` was **deliberately dropped** — it matched a single deployment and would never match a future preview. Recorded in the doc; proper preview support needs pattern matching, which is a separate decision.

## Verification performed

| Check | Result |
| --- | --- |
| `git diff` on both `trigger-*` functions | **0 lines** — provably untouched |
| Leftover `Access-Control-Allow-Origin` literals | Exactly one, inside the shared module |
| `analytics-proxy` `jsonResponse` call sites | Enumerated all 3 (`:122`, `:204`, `:234`) — every one threads `req`. Zero missed. |
| `vsa-ai-assistant` header parity | Shared defaults match the original inline values exactly; called with no options so no credentials header, as before |
| No secret in any response body | grep for `err.message`/`error.message`/`String(err)`/`.stack` across all 5 functions → **no matches** |

**`deno check` — read this carefully.** On this branch: 14 errors. On the **unmodified base**: **the same 14 errors**, same category (`SupabaseClient` generic mismatches around `logUsage`, from esm.sh resolving a newer `supabase-js` than the code targets). This branch introduces **zero** new type errors. The failure is pre-existing on `main` and is exactly the gap #296 exists to close. I am not claiming `deno check` passes — it does not, and it did not before.

`npm test` / `npm run lint` / `npm run build` were not run and are not claimed to pass: no `src/` or frontend file changed.

## Why this is a draft

Touches Edge Functions that hold secrets and perform privileged actions. Narrowing CORS **can break a legitimate browser caller**. Before merging, a human should:

1. Deploy to a preview and confirm the **admin analytics page** still loads (this is the `analytics-proxy` caller most at risk from removing `*`).
2. Confirm **Ask VSA** still works end to end (`vsa-ai-assistant` should be unchanged — verifying that is the point).
3. Decide whether `secure-ai` should simply be deleted instead of maintained.

Requires manual `supabase functions deploy`.

## Does NOT close #229

Two acceptance criteria are external blockers and remain open:

- **Live unauthenticated request against the deployed `trigger-*` functions.** The criterion says "test it, don't read it" — and reading is exactly what produced the earlier error, so the demand is well-founded. Source-level evidence is strong but is not the live test.
- **Whether `secure-ai` is still used.** Needs Supabase invocation logs, which are not in the repo.

## Follow-up discovered

`secure-ai` authenticates the caller but does **not** check admin status — any authenticated user can trigger a paid OpenAI call. Cost concern, tracked under #352, and moot if the function is deleted.

Refs #229
