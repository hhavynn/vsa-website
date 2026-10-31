# House payment eligibility, post-payment reruns and the Lock/Reveal gate

Issues #656 (payment tracker), #658 (bulk and checklist), #657 (rerun), #659 (compare drafts) and #660 (payment-cleared gate). Admin only. Protected domain: House membership.

Payment is **placement eligibility only**. It never deletes an application, changes a member, attendance, points or a revealed House. First-come, first-served priority is always the **original application time**; a payment time never changes anyone's place in line.

## CRC workflow

```
Payments tab: create the roster (Fall / Winter / Spring) → set the deadline (Pacific time)
House Assignments: import the applications CSV → choose the roster → Save  ← Draft A (provisional)
Payments tab: mark Paid / Unpaid / Pending / Waived (one, bulk, or checklist CSV)
After the cutoff: open Draft A → "Rerun sorting with eligible applicants" → review the comparison → Save as new draft  ← Draft B (final)
Draft B: link members → Lock → Reveal  (both re-checked by the database)
```

- **Draft A is provisional** and can never be locked or revealed. Once a rerun revises it, the database freezes its rows and refuses to delete it.
- **Identity:** a placement may only reveal its application's *confirmed* member, and never a member who is also linked to an Unpaid, Pending, Unverified or Withdrawn application. Confirm or correct an applicant's member on the Payments tab (recorded with a reason; it makes saved sorts need a rerun).
- **One Reveal per roster.** After a roster is revealed, no other draft for it can be locked or revealed; corrections go through leadership review.
- **Final** means: the cutoff has passed (or an early cutoff was authorized and recorded), nobody is Unverified or Pending, and the draft contains exactly the Paid and Waived applicants at the current **payment version**.
- Every payment change increases the roster's payment version. Any saved sort from an older version shows **"Payments changed since this sort — rerun required"** and the database refuses Lock and Reveal.
- **Late payer before Reveal:** mark them Paid, rerun (they are placed at their original application time), review, save a new draft, lock it. Never insert someone by hand into a full House.
- **After Reveal:** payment changes are allowed and recorded for leadership review. Nobody is removed or moved automatically and no House points change.
  For any owner-approved late addition or transfer, follow [Post-Reveal House membership corrections](house-reveal.md#post-reveal-house-membership-corrections-621--owner-gated). The existing manual-import correction path does **not** enforce the automatic Paid/Waived roster, cutoff or capacity gate: the owner must independently verify eligibility before any correction Lock/Reveal. Do not rerun or reopen the already published payment-gated batch.

## Statuses

| Status | Meaning | Provisional sort | Final sort |
|---|---|---|---|
| Unverified | Default; nobody has checked | included | blocks the final sort |
| Pending | Checked; not settled yet | included | blocks the final sort |
| Paid (verified) | Confirmed paid | included | included |
| Unpaid (confirmed) | Confirmed not paid | excluded | excluded |
| Waived / comped | Authorized; needs a recorded reason | included | included |
| Withdrawn | Left out for a non-payment reason | excluded | excluded |

Unknown is never shown or treated as Paid or Unpaid.

## Checklist import

Headers are detected: **Application row** (best), Email, Name, Status, Notes. An application row, or an email that belongs to the applicant's linked member, matches. A name alone is only a suggestion an admin confirms; two applicants with one name are never merged. Choose whether the file lists people who **paid** or who **did not pay**. For a paid roster, people not on the file stay unchanged unless you explicitly choose "mark Unverified/Pending as Unpaid"; people already Paid are never downgraded. Conflicting rows or unreadable statuses block the whole import. A checklist never reverses an approved waiver. With "absent means Unpaid", the import is refused until every listed row is matched or confirmed, so a nickname or typo can never turn a payer Unpaid. Only an explicit Application row column is read as the application row (a checklist's own "Row" numbering is ignored). The apply step is one versioned, idempotent request: a retry replays, and a preview made before someone else's change is refused as stale.

## What is stored

`house_applicants` keeps only what a rerun needs: name as typed, submission instant, sheet row, ranked House ids, an optional member link, payment status, evidence category, a short reference/note, and a withdrawal reason. **No email, phone, amount, account number, payment method or receipt.** Exports are admin-only, RFC 4180, formula-safe.

## Server enforcement (`20261028050216_house_payment_eligibility.sql`)

- New tables: RLS on, all client privileges revoked, admin-only `select`; status and version are not client-writable (column grants); no client `delete`; audit is append-only.
- `admin_set_house_applicant_payments` (status/withdrawal), `admin_register_house_applicants` (snapshot; refuses a changed application) and `admin_begin_house_batch_publish` are `SECURITY DEFINER`, `search_path = ''`, `is_admin_user` checked, `EXECUTE` revoked from `anon`.
- `house_batch_payment_blockers(batch)` lists why a draft may not be locked or revealed. The batch status trigger refuses `draft → locked` and `locked → published` while any blocker exists. A timestamp draft that is not linked to a roster in a year that has one can never be locked.
- Reveal must start with `admin_begin_house_batch_publish`, which re-checks the gate under row locks (batch, then roster) and freezes the roster's payments, deadline and identities until the batch is published or reopened. A `house_memberships` row with source `house_assignment_batch` must name an existing batch; for a gated batch it is refused (on insert, or on an update that changes its House, source or batch) outside that window, for a member who is not that row's cleared placement, for a member linked to an uncleared application, or for a different House than the draft. Updating `member_id` alone stays allowed so member merges keep working. Memberships written by other sources (Admin → Houses manual changes) are not payment-checked.
- The deadline cannot be set when a roster is created; any change that ends payments now, or moves a passed deadline, needs a recorded reason. Only status and withdrawal changes make saved sorts stale; a note or evidence edit does not.
- Applicant member links change only through `admin_link_house_applicant_member` (audited, refused during a Reveal, bumps the payment version).
- Manual imports and timestamp drafts in years without a roster behave exactly as before.

Offline proof (synthetic people, disposable cluster, includes a two-admin race):

```bash
bash scripts/test-house-payments.sh
```

## Deploying

**Status:** applied to production 2026-10-28 as version `20261028050216` (renamed from `20261028000000`; the 12 function bodies were verified identical to this file by md5). Staging first: Supabase branching is unavailable on the Free plan, so it was verified in a disposable `supabase/postgres:17.6.1.006` container (the production image) with production's schema restored from a schema-only dump. Production post-apply checks matched staging: RLS on the 4 new tables, no `anon` grants, `house_payment_requests` with no client privileges, RPCs `SECURITY DEFINER` with `search_path = ''` and `EXECUTE` false for `anon`, guard trigger functions not client-callable. Supabase's security advisor reports only the expected items (an RLS table with no policy for the idempotency table, and the admin RPCs in the "signed-in users can execute" list, like every other admin RPC).

Ship the frontend after the migration. To check again later, run the queries in the post-apply section of PR #696, read-only.

## Known follow-up

`smart_merge_members` repoints `house_assignment_drafts.member_id` but not `house_applicants.member_id`; when the merged-away member is deleted, the application's link is cleared (`on delete set null`). Nothing unsafe follows (an unlinked application needs identity review and cannot be revealed until confirmed), but the link must be re-confirmed. Fixing it means redefining the protected merge function in its own reviewed migration.

## Code map

| Concern | Files |
|---|---|
| Pure logic (statuses, cutoff, checklist, rerun, comparison, exports) | `src/lib/housePayments.ts` |
| Repository | `src/data/repos/housePayments.ts`; gate in `houseAssignments.ts` (`loadSnapshot`, `publishBatch`) |
| Payments tab | `HousePaymentsPanel.tsx`, `HousePaymentChecklistImport.tsx` |
| Rerun, comparison, gate card | `HouseRerunPanel.tsx`, `HouseDraftComparison.tsx`, `HousePaymentGateCard.tsx` |
