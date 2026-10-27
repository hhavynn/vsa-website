# Feedback submission boundary (#572)

`submit-feedback` accepts only category, subject, description and optional contact
name/email. Contact fields are self-reported; account attribution comes exclusively
from a verified Auth session, or NULL for an anonymous request. Invalid credentials
fail rather than silently becoming anonymous. Responses contain no stored record.

Bodies are streamed with an 8 KiB ceiling; the server checks required types,
allowed keys and lengths (100 subject/name, 1,000 description, 254 email).
No IP address or client-selected rate-limit key is used or stored.

The service-only `submit_feedback_guarded` RPC serializes quota checks and inserts
in one transaction. Anonymous requests share 20 submissions per UTC hour;
authenticated users get 5 per hour; all requests share 200 per UTC day.
Changing a supplied name, email, header or user agent cannot reset these budgets.
This deliberately trades anonymous per-person fairness for a budget independent
of untrusted proxy headers. Leadership can adjust the bounded values in
`private.feedback_submission_limits` through a separately approved SQL change.
Budget rows are reused; no per-request log or growing daily history is retained.
Database insert failures roll back quota changes. HTTP 429 responses advise
retrying later; the daily ceiling can remain exhausted beyond the one-hour retry.

## Ordered rollout

These files are prepared, **not applied**. Production uses manual per-file
migrations; never use `supabase db push`.

1. Review this PR and run `bash scripts/test-feedback-boundary.sh` on disposable
   PostgreSQL. The script creates its own socket-only cluster and synthetic users.
   It must never be redirected at a linked project. Run the normal RLS checklist
   against staging with dedicated ordinary/admin accounts.
2. Apply **only** `20261027170000_feedback_submission_boundary.sql` through the
   approved per-file mechanism in `vsa-run-and-operate` §3. This is additive and
   leaves the old browser working. SECURITY DEFINER is required to access the
   private budgets and feedback table; an internal service-role guard and explicit
   EXECUTE revocations protect the function.
3. Deploy `submit-feedback` with `verify_jwt=false` as configured. It verifies
   optional sessions itself. Confirm anonymous and authenticated submission on
   staging, including a rejection, before production rollout. Use a genuine
   authorized feedback submission for the production success check; do not create
   synthetic production records or load-test production.
4. Merge/deploy the compatible frontend, then confirm the public form uses
   `submit-feedback` and still reports success/error correctly. New frontend with
   a missing function reports failure and retains input; it never falls back.
5. Only after the compatible endpoint/frontend work, apply
   `20261027170001_feedback_direct_insert_cutover.sql`. This revokes both table
   and column INSERT grants from PUBLIC/anon/authenticated and removes legacy
   INSERT policies and legacy self-read/self-update policies. Administrator
   SELECT/UPDATE policies remain unchanged. Production inspection also found
   `feedback select (self)`, so its removal is covered by an own-row denial test.
   A stale browser then gets an INSERT error and must refresh; it cannot spoof
   another account.
6. Verify browser INSERT/EXECUTE denial, administrator review access, and public
   feedback read denial using catalog checks and the RLS runbook. Record each
   applied file's hash and migration-history version; reconcile versions per
   `vsa-run-and-operate` before regenerating public Database types. The service-only
   RPC is not called by the typed browser client, and generated types must not be
   hand-edited to imply that it is deployed.

The impersonation issue remains open until step 5 and production permission
verification complete. Reverting the frontend after cutover must retain the
server submission path; do not restore unrestricted INSERT to roll back.
