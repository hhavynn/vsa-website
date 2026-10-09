# Edge Function Security Audit - Issue #229 CORS Slice

Date: 2026-08-01

This audit covers the four current Supabase Edge Functions in `supabase/functions/` and records the historical `secure-ai` removal from issue #353.
It resolves the repository-answerable CORS and response-body secret checks for issue #229, but it is not a complete closure audit.

Issue #353 update: `supabase/functions/secure-ai/` was removed from the repository after re-verifying that repo source had no callers.

Production state was then checked directly against project `sxephkrekdztmkptyzca` on 2026-08-05, which corrected one assumption and closed the other item:

- **`secure-ai` was never deployed.** `supabase functions list` returns exactly four ACTIVE functions — `analytics-proxy`, `vsa-ai-assistant`, `trigger-event-image-migration`, `trigger-house-event-image-migration`. `supabase functions delete secure-ai` was therefore a no-op and was not run.
- **`OPENAI_API_KEY` has been unset** (`supabase secrets unset OPENAI_API_KEY`). Before removal, no deployed function read it: `vsa-ai-assistant` runs on `GEMINI_API_KEY`, and no `Deno.env.get("OPENAI_API_KEY")` exists anywhere under `supabase/functions/`. All four functions remained ACTIVE afterwards.

**Still open, and not repo-actionable:** the exposed key remains valid until it is revoked in the OpenAI dashboard. Unsetting the Supabase secret removes this project's copy; it does not invalidate the credential. Issue #353 stays open until revocation happens.

## Shared CORS Decision

Browser-facing functions now share `supabase/functions/_shared/cors.ts`.
The helper allows these origins only: `https://www.vsaatucsd.com`, `https://vsaatucsd.com`, `http://localhost:3000`, and `http://localhost:5173` (`_shared/cors.ts:1`).
For other origins, it returns the safe default `https://www.vsaatucsd.com` (`_shared/cors.ts:8`, `_shared/cors.ts:21`).
It always emits `Vary: Origin` (`_shared/cors.ts:24`) so caches do not reuse one origin's response for another origin.

Before issue #353, `secure-ai` emitted `Access-Control-Allow-Credentials: true`, but the shared helper only paired credentials with a single concrete origin.
That source directory is now deleted, so `secure-ai` has no current repository CORS posture.
The one-off Vercel preview origin previously hardcoded in `secure-ai` is also gone with the deleted source.
If preview-origin support is needed for a current function, it should be added as an explicit pattern-matching policy in a separate change.

Narrowing `analytics-proxy` from `*` to this allowlist can break a legitimate browser caller if it is not served from one of the allowlisted origins.
The production admin analytics page is expected to run on the production site origin, which is in the allowlist.

## Per-Function Audit

| Function | Secrets read | Privileges used | Who may call it | Enforcement mechanism and source line | CORS posture | Can a secret reach a response body? |
| --- | --- | --- | --- | --- | --- | --- |
| `vsa-ai-assistant` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (`vsa-ai-assistant/index.ts:473`-`474`); `VSA_AI_ASSISTANT_ENABLED` (`:499`); `GEMINI_API_KEY` (`:557`); `GEMINI_MODEL` (`:583`) | Uses the Supabase service role client, so the function body is the security boundary (`vsa-ai-assistant/index.ts:472`-`480`). Calls Gemini server-side only. | Public browser callers may submit assistant questions. | Rejects non-POST methods (`vsa-ai-assistant/index.ts:468`-`469`), validates request body (`:488`-`:492`), blocks safety/private-info requests before provider calls (`:520`-`:537`), and returns approved fallback/error bodies only. | Browser-facing. Uses shared allowlist CORS via `corsHeaders(req)` on JSON responses and preflight (`vsa-ai-assistant/index.ts:117`, `:465`). Emitted headers preserve the prior reference behavior. | No. Missing key and unexpected-error responses are fixed public messages (`vsa-ai-assistant/index.ts:568`-`:578`, `:617`-`:626`). Provider errors are logged but not returned raw. |
| `secure-ai` | None in current source; directory deleted by issue #353. Historically read `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY`. | No current repo code. Historical source used the Supabase service role client, wrote `chat_logs`, and called OpenAI server-side if configured. | No current repo caller. Deleting source does not undeploy any already deployed function. | Historical source required a bearer token but did not check admin status. Current repo remediation removes the source rather than rotating a paid-API secret into it. | Historical only. Current source has no CORS posture because the directory is deleted. | No current response body exists in repo source. Historical source did not return the secret value. |
| `analytics-proxy` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` (`analytics-proxy/index.ts:127`-`:128`); `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GA4_PROPERTY_ID` (`:149`-`:152`). Note: current source reads these Google/GA4 env vars even though the Supabase security reference only listed the Supabase vars; current source is authoritative. | Uses the caller's Supabase JWT through the anon client (`analytics-proxy/index.ts:126`-`:129`) and proxies privileged GA4 Data API calls with server-side OAuth credentials (`:154`-`:199`). | Authenticated admins only. | Resolves the caller with `auth.getUser()` (`analytics-proxy/index.ts:133`-`:136`), reads `user_profiles.is_admin` (`:138`-`:142`), and rejects non-admins (`:144`-`:145`). | Browser-facing privileged admin endpoint. Uses shared allowlist CORS on preflight and JSON responses (`analytics-proxy/index.ts:19`, `:118`). The prior `Access-Control-Allow-Origin: *` and stale production comment are removed. | No secret value is returned. Env failures return curated public configuration messages, not values (`analytics-proxy/index.ts:24`-`:29`, `:149`-`:152`). GA4/OAuth failures return curated `AnalyticsError` messages and codes (`:46`-`:80`, `:234`-`:237`). |
| `trigger-event-image-migration` | `IMAGE_MIGRATION_WEBHOOK_SECRET` (`trigger-event-image-migration/index.ts:36`); `GITHUB_REPOSITORY`, `GITHUB_DISPATCH_TOKEN`, `GITHUB_DISPATCH_EVENT_TYPE` (`:86`-`:89`) | Dispatches a GitHub repository event using a server-side token (`trigger-event-image-migration/index.ts:97`-`:105`). | Server-to-server Supabase Database Webhook only. | Rejects non-POST requests (`trigger-event-image-migration/index.ts:31`-`:33`), then fails closed unless `x-image-migration-secret` matches `IMAGE_MIGRATION_WEBHOOK_SECRET` (`:36`-`:39`). | No CORS, correctly. This is not browser-facing. | No secret value is returned. Missing GitHub env vars return `Server misconfiguration` (`trigger-event-image-migration/index.ts:91`-`:93`); GitHub failures return status-only public messages (`:114`-`:119`). |
| `trigger-house-event-image-migration` | `IMAGE_MIGRATION_WEBHOOK_SECRET` (`trigger-house-event-image-migration/index.ts:36`); `GITHUB_REPOSITORY`, `GITHUB_DISPATCH_TOKEN`, `GITHUB_DISPATCH_EVENT_TYPE_HOUSE` (`:86`-`:89`) | Dispatches a GitHub repository event using a server-side token (`trigger-house-event-image-migration/index.ts:98`-`:106`). | Server-to-server Supabase Database Webhook only. | Rejects non-POST requests (`trigger-house-event-image-migration/index.ts:31`-`:33`), then fails closed unless `x-image-migration-secret` matches `IMAGE_MIGRATION_WEBHOOK_SECRET` (`:36`-`:39`). | No CORS, correctly. This is not browser-facing. | No secret value is returned. Missing GitHub env vars return `Server misconfiguration` (`trigger-house-event-image-migration/index.ts:91`-`:93`); GitHub failures return status-only public messages (`:115`-`:120`). |

## Service-role key in image-migration webhooks (2026-10-08)

**Finding.** Both image-migration Database Webhooks in production embed the project's legacy `service_role` JWT in plain text. Status: **open**. Nothing in production has been changed yet; remediation waits on owner approval. The fix is prepared in `supabase/migrations/20261010120000_vault_backed_image_migration_triggers.sql`, and the owner's step-by-step procedure is [`image-migration-webhook-credential-rotation.md`](image-migration-webhook-credential-rotation.md).

### Evidence

All checks were read-only SQL against project `sxephkrekdztmkptyzca` on 2026-10-08. The queries returned only metadata (the JWT's `role` claim, booleans, lengths) and never a key or secret value.

| Trigger | Table | Fires | Target | `Authorization` header | Embedded JWT `role` / `ref` / `exp` | `x-image-migration-secret` |
| --- | --- | --- | --- | --- | --- | --- |
| `event-image-migration` | `public.events` | `AFTER INSERT OR UPDATE`, enabled | `supabase_functions.http_request` → `/functions/v1/trigger-event-image-migration` | yes, `Bearer <JWT>` | `service_role` / `sxephkrekdztmkptyzca` / 2035-06-11 | present, 64 chars |
| `house-event-image-migration` | `public.house_events` | `AFTER INSERT OR UPDATE`, enabled | `supabase_functions.http_request` → `/functions/v1/trigger-house-event-image-migration` | yes, `Bearer <JWT>` | `service_role` / `sxephkrekdztmkptyzca` / 2035-06-11 | present, 64 chars |

- These are the only two triggers carrying a JWT. No function body (`pg_proc.prosrc`) and no `cron.job` command (one job exists) contains a JWT or an `sb_secret_` key.
- No JWT-shaped string exists in tracked files or anywhere in git history (`git log --all -G`). The repo's migrations never created these webhooks; they were made in the Dashboard. The Dashboard's "Add auth header with service key" button writes exactly this header, which is the likely origin.

**Re-check later on 2026-10-08 (read-only, metadata only):**

- Both triggers were unchanged: enabled, `supabase_functions.http_request`, five arguments, with an `Authorization` header, a JWT, and the `x-image-migration-secret` header.
- None of the 41 versions recorded in `supabase_migrations.schema_migrations` mentions `image-migration` or `supabase_functions.http_request`. That confirms the webhooks are Dashboard-created and untracked.
- `pg_catalog.pg_trigger` carries the ACL entry `=r/supabase_admin`, which is `SELECT` for `PUBLIC`.
- `anon` and `authenticated` both hold `SELECT` on `pg_trigger` and `EXECUTE` on `pg_get_triggerdef(oid)` and `pg_get_triggerdef(oid, boolean)`, as does `authenticator`.
- They also hold `USAGE` on `supabase_functions` and `net`, plus `SELECT` on `supabase_functions.hooks` and `net.http_request_queue`. `hooks` stores only ids and names (173 rows), and the queue was empty.
- Vault (`supabase_vault` 0.3.1) and `pg_net` 0.19.5 are installed. Vault held 0 secrets.
- `anon` and `authenticated` have no `USAGE` on `vault` and no `SELECT` on `vault.decrypted_secrets`. Only `postgres`, `service_role` and `supabase_admin` do.
- The Data API exposed-schemas setting still could not be read from SQL. A planned HTTP probe with the publishable key was not run. The runbook's stage 0 asks the owner to check it in the Dashboard.

### Why the bearer token is unnecessary

- Both functions are deployed with `verify_jwt: false` (confirmed in the live function list, 2026-10-08). The gateway ignores `Authorization` entirely.
- The function code never reads `Authorization`. Its only gate is `x-image-migration-secret` compared with `IMAGE_MIGRATION_WEBHOOK_SECRET` (`trigger-event-image-migration/index.ts:36`-`:39`, `trigger-house-event-image-migration/index.ts:36`-`:39`). The shared contract test already proves `Authorization: Bearer <secret>` alone gets a 401 (`_shared/image-migration-webhook-contract.ts`).
- The webhooks therefore need **no Authorization header at all**. The anon key would only matter if `verify_jwt` were ever turned on.
- Until this change, `supabase/config.toml` did not pin `verify_jwt = false` for these two functions. A plain `supabase functions deploy` would then have defaulted to `verify_jwt = true`, and a header-less webhook would start failing with 401s. The same PR as this audit adds the pin.

### Exposure assessment

- **Who can read it.** Webhook headers live in the trigger definition (`pg_trigger.tgargs`, `pg_get_triggerdef`). Any database session can read `pg_catalog` (`anon` and `authenticated` hold `SELECT` on `pg_trigger`). There is no known path for `anon`/`authenticated` to run arbitrary SQL: `pg_catalog` is not a PostgREST-exposed schema by default, and no `plpgsql` function in `public`/`graphql_public` matched a dynamic-SQL (`EXECUTE <sql>`) pattern. The exposed-schema list is a Dashboard setting and could not be read from SQL, so confirm in the Dashboard's Data API settings that **Exposed schemas** is only `public` and `graphql_public`.
- **Realistic leak paths.** Anyone or anything with database or Dashboard read access sees the key: schema dumps (`supabase db dump`, `pg_dump`), `supabase db diff` output, backups, SQL tooling and AI/MCP sessions that print trigger definitions, and screenshots of the Webhooks page. One dump pasted into an issue or committed to the repo would publish it.
- **Impact if leaked.** The `service_role` JWT bypasses RLS on every table and Storage bucket, and it is valid until 2035. It cannot be revoked on its own (see below).
- **Transient copies.** `pg_net` holds each queued request's headers in `net.http_request_queue` until they are sent (0 rows at audit time). `anon`/`authenticated` hold table `SELECT` and schema `USAGE` on `net` and `supabase_functions` (Supabase defaults), but neither schema is API-exposed. Removing the header removes this copy too.
- **Residual after the fix.** `x-image-migration-secret` itself stays in plain text in the trigger definition; Database Webhooks have no other way to send a header. A leak of that value lets someone fire a `repository_dispatch` with an arbitrary `record.id`. Before this audit's PR, that was **not** low impact: `migrate-event-images.yml` expanded `client_payload.category`/`event_id`/`house_event_id` inline into its shell script (`"${{ github.event.client_payload.event_id }}"`). An id such as `x"; <command>; #` would then run on a runner holding `contents: write` and the service-role key. Found by the Codex review of this PR and fixed in the same PR: the workflow now reads those values only through `env:` and rejects anything that is not an allowlisted category, `true`/`false`, a whole-number limit, or a UUID. With that fix, a leaked webhook secret can only start migration runs for real rows. Rotate the secret anyway, because it has been co-located with the service-role key.

### Remediation plan (owner approval required for every production step)

**Phase A — remove the key from the webhooks and rotate the webhook secret (small, do first).**

1. Merge the PR that pins `verify_jwt = false` in `supabase/config.toml`, so no redeploy can silently re-enable JWT checks.
2. Generate a new secret locally (`openssl rand -hex 32`). Never paste it into chat, PRs, issues, or logs.
3. `supabase secrets set IMAGE_MIGRATION_WEBHOOK_SECRET=<new>`. Secrets are project-wide, so this covers both functions.
4. Right away, in **Database → Webhooks**, edit `event-image-migration` and `house-event-image-migration`. Delete the `Authorization` header, set `x-image-migration-secret` to the new value, and keep `Content-type: application/json`. Change nothing else.
5. Run the metadata-only verification query from `docs/event-image-migration.md` (Phase 3, step 4). All booleans must be `false` for both triggers.
6. Smoke test: a request with a wrong secret returns 401 (this also closes the open item below). The next real image upload logs `triggered: true` in the function logs and starts a `migrate-event-images.yml` run.

Uploads that land between steps 3 and 4 get a 401 and stay on their Storage URL. That is harmless: the scheduled `migrate-images.yml` picks them up, or re-run `migrate-event-images.yml` for the affected row.

**Phase B — retire the exposed `service_role` key.** A legacy `service_role` key is not independently rotatable: it is a JWT signed with the project's legacy JWT secret, the same secret that signs the `anon` key and every user session. Supabase no longer offers a direct "rotate JWT secret" for legacy keys; the supported path is to move to the new API keys and the JWT signing-keys system. Supabase also states that legacy `anon`/`service_role` keys only keep working until the end of 2026, so this migration is due regardless.

1. **Create new keys** in **Settings → API Keys**: a publishable key (`sb_publishable_…`) and one secret key (`sb_secret_…`) per consumer, so each can be revoked alone. Suggested split: `github-actions-image-migration`, `github-actions-content-link-check`, `local-scripts`.
2. **Move every service-role consumer** to a secret key:
   - GitHub Actions secret `SUPABASE_SERVICE_ROLE_KEY`, used by `migrate-images.yml`, `migrate-event-images.yml`, `content-link-check.yml`. Scripts pass the value to `createClient`, which accepts `sb_secret_` keys; no script decodes the key as a JWT.
   - Edge Functions `vsa-ai-assistant` (`index.ts:96`) and `member-photo-upload` (`index.ts:5`) read the auto-injected `SUPABASE_SERVICE_ROLE_KEY`. A code PR must switch them to the platform's `SUPABASE_SECRET_KEYS` before legacy keys are disabled.
   - Local `.env.local` copies used by `scripts/*` (`migrate-supabase-images-to-public.ts`, `check-content-links.ts`, `audit-storage-backed-content.ts`, `audit-anon-exposure.mjs`, `cleanup-stale-photo-requests.mjs`), and the `RLS_TEST_*`/service-role env of anyone who runs `scripts/verify-rls-security.mjs`.
   - Confirm that Vercel project env holds **no** service-role key (expected: only `REACT_APP_*`). Not verified in this audit.
3. **Move every anon-key consumer** to the publishable key: Vercel `REACT_APP_SUPABASE_ANON_KEY` (rebuild and redeploy; the key is compiled into the bundle), the GitHub secret of the same name, and local `.env.local`.
   - **Blocker to resolve first:** Ask VSA calls `vsa-ai-assistant` with `Authorization: Bearer <anon key>` (`src/components/features/ai/VsaAiAssistant.tsx:252`-`:258`), and that function runs with `verify_jwt: true`. A publishable key is not a JWT, so anonymous visitors would get a gateway 401. Before the switch, that function needs `verify_jwt = false` plus its own `apikey` check (Supabase's documented pattern), in a separate gated PR.
   - **`analytics-proxy` also depends on the legacy anon key:** it builds its client from the auto-injected `SUPABASE_ANON_KEY` (`supabase/functions/analytics-proxy/index.ts:126`-`:129`) and runs with `verify_jwt: true` (no `config.toml` stanza). Move it to the publishable key (`SUPABASE_PUBLISHABLE_KEYS`) before step 4, or every admin analytics request fails.
4. **Disable the legacy `anon` and `service_role` API keys** (Settings → API Keys → Legacy). From then on, the leaked JWT is refused as an `apikey`.
5. **Migrate to JWT signing keys and revoke the legacy JWT secret** (Settings → JWT Keys). Disabling the legacy API keys alone is not enough: while the legacy secret is still trusted, the leaked JWT stays cryptographically valid as a bearer token. Sequence it as Supabase documents:
   - Before rotating, turn off the gateway's **Verify JWT** on every function that still has it (`vsa-ai-assistant`, `analytics-proxy`) and verify inside the function instead (`supabase.auth.getClaims()`/`getUser()`). Supabase warns that the gateway check can break after rotation.
   - Rotate to the new signing key. Auth immediately issues new access tokens with it, and non-expired legacy-signed tokens keep working, so nobody is signed out.
   - Wait at least the access-token lifetime plus 15 minutes (1 h 15 min at the default 1-hour expiry), then revoke the legacy secret. Active users have refreshed by then and are not signed out.
   - Revoke immediately only if the key is believed to be actively abused. That trades a forced sign-out of active sessions (mostly admins since #510) for closing the window.
   - Schedule outside any freeze window (`vsa-seasonal-operations`).

Blast radius: steps 4 and 5 affect **every** consumer of the legacy keys at once, not only service-role users. That includes the production frontend, CI, scripts, and Edge Functions (`vsa-ai-assistant`, `member-photo-upload`, `analytics-proxy`), so every item in steps 2 and 3 must be done and verified first. Rollback: until step 5, re-enabling the legacy keys restores the old state. After step 5, a revoked key can be moved back to standby and rotated to, per Supabase's signing-keys docs.

**Phase C — replace the Dashboard webhooks with tracked, Vault-backed triggers (prepared, not applied).** `supabase/migrations/20261010120000_vault_backed_image_migration_triggers.sql` does three things:

- It adds `private.request_image_migration()`. This `SECURITY DEFINER` trigger function, with `search_path = ''`, reads `image_migration_functions_url` and `image_migration_webhook_secret` from Vault at fire time and queues one `net.http_post` with only `Content-Type` and `x-image-migration-secret`.
- It drops both Dashboard webhooks.
- It creates `request_event_image_migration` and `request_house_event_image_migration` (`AFTER INSERT OR UPDATE OF image_url`).

After it is applied, `pg_trigger` holds only a function name and `pg_proc.prosrc` holds only Vault secret *names*. Supabase's own API-key migration guide recommends this pattern: store `pg_net`/webhook credentials in Vault, never inline.

How it behaves:

- **Unconfigured production:** it aborts if the Dashboard webhooks exist but the Vault secrets do not, so a working webhook is never replaced by a no-op.
- **Never blocks a write:** missing secrets or a `pg_net` error become a `WARNING` with SQLSTATE only.
- **Same payload:** the Edge Functions receive the payload shape they already parse, so the functions are unchanged and need no redeploy.

Verified against a synthetic stub database (`scripts/sql/image-migration-triggers.test.sh`, 37 checks), not against a hosted Supabase project.

This replaces Phase A's Dashboard edit: Phase A steps 2–3 (new secret) still apply, but instead of step 4 the owner applies this migration. The runbook combines both. Phase B is unchanged and is still what invalidates the leaked JWT.

## Open Items

- **2026-10-08, open:** both image-migration webhooks embed the `service_role` JWT (re-confirmed later the same day). As soon as the owner approves, run stage 1 of [`image-migration-webhook-credential-rotation.md`](image-migration-webhook-credential-rotation.md): Vault secrets, new webhook secret, then migration `20261010120000`. Then schedule stage 2 (Phase B) before the end-of-2026 legacy-key cutoff.
- **2026-10-08, open:** confirm in the Dashboard that the Data API exposes only `public` and `graphql_public` (runbook stage 0, step 4).
- The live unauthenticated-call test against both `trigger-*` deployed functions has not been performed. Repository source shows the shared-secret check, but the issue criterion asks for live production requests.
- `secure-ai`'s vestigial status is fully resolved. Source search found no callers, the directory was removed, and a direct production check on 2026-08-05 confirmed the function was never deployed. `OPENAI_API_KEY` has been unset from the project's secrets. The remaining incident-response steps for #353 are outside the repo and the Supabase project, and none should be skipped: revoke the exposed key in the OpenAI dashboard, review OpenAI usage for the exposure window, confirm the GitHub secret-scanning alert is closed as revoked (0 open alerts as of 2026-09-28), decide whether to rewrite git history, and scan history for other credentials.
- This work should not close issue #229. It only resolves the repo-answerable CORS and response-body audit slice.
