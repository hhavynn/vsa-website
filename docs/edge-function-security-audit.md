# Edge Function Security Audit - Issue #229 CORS Slice

Date: 2026-08-01

This audit covers the five Supabase Edge Functions in `supabase/functions/`.
It resolves the repository-answerable CORS and response-body secret checks for issue #229, but it is not a complete closure audit.

## Shared CORS Decision

Browser-facing functions now share `supabase/functions/_shared/cors.ts`.
The helper allows these origins only: `https://www.vsaatucsd.com`, `https://vsaatucsd.com`, `http://localhost:3000`, and `http://localhost:5173` (`_shared/cors.ts:1`).
For other origins, it returns the safe default `https://www.vsaatucsd.com` (`_shared/cors.ts:8`, `_shared/cors.ts:21`).
It always emits `Vary: Origin` (`_shared/cors.ts:24`) so caches do not reuse one origin's response for another origin.

`secure-ai` still emits `Access-Control-Allow-Credentials: true`, but the shared helper only ever pairs it with a single concrete origin (`_shared/cors.ts:21`, `_shared/cors.ts:27`).
That makes the invalid `*` plus credentials combination structurally impossible.

The one-off Vercel preview origin previously hardcoded in `secure-ai` was intentionally dropped.
That URL matched one deployment only and would not cover future previews.
If preview-origin support is needed, it should be added as an explicit pattern-matching policy in a separate change.

Narrowing `analytics-proxy` from `*` to this allowlist can break a legitimate browser caller if it is not served from one of the allowlisted origins.
The production admin analytics page is expected to run on the production site origin, which is in the allowlist.

## Per-Function Audit

| Function | Secrets read | Privileges used | Who may call it | Enforcement mechanism and source line | CORS posture | Can a secret reach a response body? |
| --- | --- | --- | --- | --- | --- | --- |
| `vsa-ai-assistant` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (`vsa-ai-assistant/index.ts:473`-`474`); `VSA_AI_ASSISTANT_ENABLED` (`:499`); `GEMINI_API_KEY` (`:557`); `GEMINI_MODEL` (`:583`) | Uses the Supabase service role client, so the function body is the security boundary (`vsa-ai-assistant/index.ts:472`-`480`). Calls Gemini server-side only. | Public browser callers may submit assistant questions. | Rejects non-POST methods (`vsa-ai-assistant/index.ts:468`-`469`), validates request body (`:488`-`:492`), blocks safety/private-info requests before provider calls (`:520`-`:537`), and returns approved fallback/error bodies only. | Browser-facing. Uses shared allowlist CORS via `corsHeaders(req)` on JSON responses and preflight (`vsa-ai-assistant/index.ts:117`, `:465`). Emitted headers preserve the prior reference behavior. | No. Missing key and unexpected-error responses are fixed public messages (`vsa-ai-assistant/index.ts:568`-`:578`, `:617`-`:626`). Provider errors are logged but not returned raw. |
| `secure-ai` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (`secure-ai/index.ts:86`-`87`); `OPENAI_API_KEY` (`:141`) | Uses the Supabase service role client (`secure-ai/index.ts:85`-`:93`) and writes `chat_logs` (`:209`-`:216`). Calls OpenAI server-side if configured. | Authenticated browser users with a bearer token. | Requires an `Authorization` header (`secure-ai/index.ts:97`-`:103`) and validates the token with `auth.getUser(token)` (`:108`-`:117`). It does not check admin status. | Browser-facing. Uses shared allowlist CORS with credentials preserved (`secure-ai/index.ts:7`-`:11`, `:80`). The previous comma-joined `Access-Control-Allow-Origin` value is removed. | No secret value is returned. Missing `OPENAI_API_KEY` returns a fallback assistant message (`secure-ai/index.ts:141`-`:150`). OpenAI provider errors fall back to a basic response (`:180`-`:197`). |
| `analytics-proxy` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` (`analytics-proxy/index.ts:127`-`:128`); `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GA4_PROPERTY_ID` (`:149`-`:152`). Note: current source reads these Google/GA4 env vars even though the Supabase security reference only listed the Supabase vars; current source is authoritative. | Uses the caller's Supabase JWT through the anon client (`analytics-proxy/index.ts:126`-`:129`) and proxies privileged GA4 Data API calls with server-side OAuth credentials (`:154`-`:199`). | Authenticated admins only. | Resolves the caller with `auth.getUser()` (`analytics-proxy/index.ts:133`-`:136`), reads `user_profiles.is_admin` (`:138`-`:142`), and rejects non-admins (`:144`-`:145`). | Browser-facing privileged admin endpoint. Uses shared allowlist CORS on preflight and JSON responses (`analytics-proxy/index.ts:19`, `:118`). The prior `Access-Control-Allow-Origin: *` and stale production comment are removed. | No secret value is returned. Env failures return curated public configuration messages, not values (`analytics-proxy/index.ts:24`-`:29`, `:149`-`:152`). GA4/OAuth failures return curated `AnalyticsError` messages and codes (`:46`-`:80`, `:234`-`:237`). |
| `trigger-event-image-migration` | `IMAGE_MIGRATION_WEBHOOK_SECRET` (`trigger-event-image-migration/index.ts:36`); `GITHUB_REPOSITORY`, `GITHUB_DISPATCH_TOKEN`, `GITHUB_DISPATCH_EVENT_TYPE` (`:86`-`:89`) | Dispatches a GitHub repository event using a server-side token (`trigger-event-image-migration/index.ts:97`-`:105`). | Server-to-server Supabase Database Webhook only. | Rejects non-POST requests (`trigger-event-image-migration/index.ts:31`-`:33`), then fails closed unless `x-image-migration-secret` matches `IMAGE_MIGRATION_WEBHOOK_SECRET` (`:36`-`:39`). | No CORS, correctly. This is not browser-facing. | No secret value is returned. Missing GitHub env vars return `Server misconfiguration` (`trigger-event-image-migration/index.ts:91`-`:93`); GitHub failures return status-only public messages (`:114`-`:119`). |
| `trigger-house-event-image-migration` | `IMAGE_MIGRATION_WEBHOOK_SECRET` (`trigger-house-event-image-migration/index.ts:36`); `GITHUB_REPOSITORY`, `GITHUB_DISPATCH_TOKEN`, `GITHUB_DISPATCH_EVENT_TYPE_HOUSE` (`:86`-`:89`) | Dispatches a GitHub repository event using a server-side token (`trigger-house-event-image-migration/index.ts:98`-`:106`). | Server-to-server Supabase Database Webhook only. | Rejects non-POST requests (`trigger-house-event-image-migration/index.ts:31`-`:33`), then fails closed unless `x-image-migration-secret` matches `IMAGE_MIGRATION_WEBHOOK_SECRET` (`:36`-`:39`). | No CORS, correctly. This is not browser-facing. | No secret value is returned. Missing GitHub env vars return `Server misconfiguration` (`trigger-house-event-image-migration/index.ts:91`-`:93`); GitHub failures return status-only public messages (`:115`-`:120`). |

## Open Items

- The live unauthenticated-call test against both `trigger-*` deployed functions has not been performed. Repository source shows the shared-secret check, but the issue criterion asks for live production requests.
- `secure-ai`'s vestigial status is unresolved. Determining whether it is still used requires Supabase invocation logs or equivalent production telemetry outside this repository.
- This work should not close issue #229. It only resolves the repo-answerable CORS and response-body audit slice.
