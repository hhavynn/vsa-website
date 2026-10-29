# Ask VSA usage observability — partial #240

The site now has a count-only, administrator-gated daily report at
`/admin/ai-usage`. It uses `public.admin_ai_usage_daily(p_days)`
from migration `20261029015612_admin_ai_usage_aggregates.sql`.

## What is counted

The existing service-role Ask VSA usage ledger `ai_chat_usage_logs` records
request outcomes in `metadata.status`: `answered`, `fallback`,
`rate_limited`, and `error`. Older or unusual statuses appear in `other`,
not as a successful answer. Counts are grouped by **America/Los_Angeles
calendar day** (including DST changes), not by student/session or address.

A small number of abandoned reservations can have no completed usage row and
therefore may be missing. Individual rate-limited attempts are attempts, not
distinct people. Do not equate totals with unique students.

The database function returns only the six daily count columns. Hashes,
`matched_knowledge_ids`, raw messages and metadata are not returned. No
broad grants on the private table are required.

## Rollout — explicitly manual and gated

1. In a disposable database or staging, inspect the effective **current**
   `ai_chat_usage_logs` privileges and the definition/privileges of
   `is_admin_user` before applying the migration. The SQL changes only
   the new report RPC; never widen raw log access.
2. Apply the exact migration through the approved Supabase migration process.
   **Do not apply to production from a draft PR.**
3. Verify `has_function_privilege('anon',
   'public.admin_ai_usage_daily(integer)', 'EXECUTE')` is false and
   `has_function_privilege('authenticated',
   'public.admin_ai_usage_daily(integer)', 'EXECUTE')` is true. Confirm a
   logged-in **non-admin** calling the RPC gets SQLSTATE `42501`, while
   an admin gets only aggregate rows; test invalid `p_days` as `22023`.
   Inspect actual returned JSON: no session IDs, IPs, page paths, messages,
   knowledge IDs, or other metadata.
4. Confirm an admin with realistic **synthetic** logged outcomes sees the
   correct days and status counts, including one rate-limited and one error.
   Test 7/30/90-day boundaries, Pacific midnight and a DST change.
5. Test the responsive page in light/dark mode, error/no-migration and
   no-results states, and that non-admin users cannot open the admin route.
6. Only after verifying all previous steps, authorize a separate production
   rollout. A frontend deployment before the RPC degrades to a friendly
   "report unavailable" state and **never** tries to read raw logs.

## Costs and budget

The ledger does **not** include Gemini provider prompt/output token usage or
a billing rate snapshot, so it cannot calculate dollars per request or per
1,000 questions honestly. Use the provider billing dashboard for current costs.
Do not infer costs from request lengths or count every rate-limit failure as a
billable model call.

Follow-up work: collect only token counts through the existing service-role
completion path under a separately reviewed additive migration, attach explicit
model/rate provenance, and add alerting for error spikes. Model pricing,
retention and quotas are separate owner decisions. This PR does not increase
limits or add a third-party analytics/monitoring service.
