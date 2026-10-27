# Privileged Edge Function limits (#352, #347, #350)

Both image-migration receivers retain `x-image-migration-secret` authentication.
They validate bounded JSON (16 KiB), operation/table/schema, UUID and image URL
types before quota admission. Local, external and unchanged images remain no-ops.
Only HTTPS Storage URLs in this Supabase project can reach GitHub dispatch.
The Vault-backed SQL trigger payload remains compatible. No JWT requirement is
added to these machine-to-machine receivers.

Analytics verifies the bearer session with Auth, then calls the existing
caller-bound `is_admin_user` RPC using that session. Authentication failures,
non-admin users, invalid dates/fields, and disallowed browser origins cannot
consume Google quota. Reports accept 1 KiB of JSON, ordered date ranges up to
366 days, and the existing relative-date syntax. Google requests have deadlines,
report row limits and controlled error responses. Existing summary/trend/topPages
response fields remain unchanged. CORS is separate from backend authorization.

`_shared/privileged-runtime.ts` owns this admin check and persistent quota wiring.
Future privileged browser functions should reuse it or the same verified-session
plus caller-bound admin RPC check, before performing external work. Machine
receivers retain their explicit secret check rather than impersonating an admin.

## Budgets

| Function | Caller ceiling | Global ceiling | Optional Edge secrets |
|---|---|---|---|
| Both image receivers together | 6/minute for the verified machine principal | 50/day shared across both receivers | `IMAGE_MIGRATION_CALLER_PER_MINUTE`, `IMAGE_MIGRATION_GLOBAL_PER_DAY` |
| Analytics | 12/minute per verified administrator | 500/day | `ANALYTICS_CALLER_PER_MINUTE`, `ANALYTICS_GLOBAL_PER_DAY` |

Minute/day windows use UTC. Overrides must be integers in 1–120/minute and
1–10,000/day; invalid configuration fails closed. The occasional admin image
migration workflow normally needs far fewer than 50 daily dispatches. Counters
use HMAC identifiers based on verified principals; client payloads and IP headers
cannot select or reset their quota. No raw IPs or per-request payloads are stored.

The service-only `reserve_privileged_edge_quota` RPC uses a transaction lock per
scope to check and increment caller/global counters atomically across isolates.
Rows are reused across windows. Rejected requests change no counters and perform
no upstream work. Admissions remain charged when an upstream call fails, so
retries cannot bypass the resource budget. There is no automatic retry/duplicate
dispatch loop; unchanged-image suppression remains in place. A 429 advises a
60-second retry, but an exhausted daily limit can last until the next UTC day.

## Rollout and evidence

1. Review and apply only `20261027160000_privileged_edge_quotas.sql` through
   the approved per-file migration path. No automated production migration is
   included. It creates one RLS-protected counter table and one service-only RPC;
   it changes no members, events, House assignments, points or AI limiter.
2. Verify PUBLIC/anon/authenticated cannot execute the RPC or read/write its
   table, and the internal guard rejects non-service claims. Use the normal RLS
   checklist with dedicated staging accounts. Regenerate the generated public
   Database types after deployment; no browser code consumes this service-only
   RPC and its undeployed types must not be fabricated by hand.
3. Deploy only `trigger-event-image-migration`,
   `trigger-house-event-image-migration`, and `analytics-proxy`. Missing admission
   schema/configuration returns 503 and dispatches nothing; apply schema first.
4. Verify normal authorized workflows on staging with mocked external services.
   For production, use existing legitimate administrative work; do not dispatch
   workflows or exhaust Google/GitHub quotas for negative tests. Keep these issues
   open until production deployment and permissions are verified.

Run `bash scripts/test-privileged-edge-quotas.sh` for disposable PostgreSQL role,
window and 20-session concurrency checks. Deno boundary/runtime tests mock
Supabase, GitHub and Google, including authorization failures before quota,
malformed/oversized inputs, quota rejection, controlled upstream failures and
the successful report contract. They certify code behavior, not deployment.
