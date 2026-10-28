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

- **Draft A is provisional** and can never be locked or revealed. It stays exactly as saved; Draft A cannot be deleted while a revision exists.
- **Final** means: the cutoff has passed (or an early cutoff was authorized and recorded), nobody is Unverified or Pending, and the draft contains exactly the Paid and Waived applicants at the current **payment version**.
- Every payment change increases the roster's payment version. Any saved sort from an older version shows **"Payments changed since this sort — rerun required"** and the database refuses Lock and Reveal.
- **Late payer before Reveal:** mark them Paid, rerun (they are placed at their original application time), review, save a new draft, lock it. Never insert someone by hand into a full House.
- **After Reveal:** payment changes are allowed and recorded for leadership review. Nobody is removed or moved automatically and no House points change.

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

Headers are detected: **Application row** (best), Email, Name, Status, Notes. An application row, or an email that belongs to the applicant's linked member, matches. A name alone is only a suggestion an admin confirms; two applicants with one name are never merged. Choose whether the file lists people who **paid** or who **did not pay**. For a paid roster, people not on the file stay unchanged unless you explicitly choose "mark Unverified/Pending as Unpaid"; people already Paid are never downgraded. Conflicting rows or unreadable statuses block the whole import. A checklist never reverses an approved waiver. The apply step is one versioned, idempotent request: a retry replays, and a preview made before someone else's change is refused as stale.

## What is stored

`house_applicants` keeps only what a rerun needs: name as typed, submission instant, sheet row, ranked House ids, an optional member link, payment status, evidence category, a short reference/note, and a withdrawal reason. **No email, phone, amount, account number, payment method or receipt.** Exports are admin-only, RFC 4180, formula-safe.

## Server enforcement (`20261028000000_house_payment_eligibility.sql`)

- New tables: RLS on, all client privileges revoked, admin-only `select`; status and version are not client-writable (column grants); no client `delete`; audit is append-only.
- `admin_set_house_applicant_payments` (status/withdrawal), `admin_register_house_applicants` (snapshot; refuses a changed application) and `admin_begin_house_batch_publish` are `SECURITY DEFINER`, `search_path = ''`, `is_admin_user` checked, `EXECUTE` revoked from `anon`.
- `house_batch_payment_blockers(batch)` lists why a draft may not be locked or revealed. The batch status trigger refuses `draft → locked` and `locked → published` while any blocker exists. A timestamp draft that is not linked to a roster in a year that has one can never be locked.
- Reveal must start with `admin_begin_house_batch_publish`, which re-checks the gate under a row lock and freezes the roster's payments and deadline until the batch is published or reopened. `house_memberships` rows sourced from a gated batch are refused outside that window, for anyone not Paid/Waived, or for a House other than the draft's.
- Manual imports and timestamp drafts in years without a roster behave exactly as before.

Offline proof (synthetic people, disposable cluster, includes a two-admin race):

```bash
bash scripts/test-house-payments.sh
```

## Deploying

1. Owner approval, then apply `20261028000000_house_payment_eligibility.sql` to production verbatim (manual path; see `vsa-run-and-operate`) and record its version. Production had no House assignment batches when it was written (checked read-only 2026-10-28).
2. Ship the frontend. Before the migration exists the Payments tab says it is unavailable and placement saves work as before.
3. Post-apply check: the four new tables have RLS on and no `anon` grants; the three RPCs report `EXECUTE` false for `anon`; the guard trigger functions report `EXECUTE` false for `authenticated`.

## Code map

| Concern | Files |
|---|---|
| Pure logic (statuses, cutoff, checklist, rerun, comparison, exports) | `src/lib/housePayments.ts` |
| Repository | `src/data/repos/housePayments.ts`; gate in `houseAssignments.ts` (`loadSnapshot`, `publishBatch`) |
| Payments tab | `HousePaymentsPanel.tsx`, `HousePaymentChecklistImport.tsx` |
| Rerun, comparison, gate card | `HouseRerunPanel.tsx`, `HouseDraftComparison.tsx`, `HousePaymentGateCard.tsx` |
