# ACE pickup years

A person's **pickup year** is the academic year they were picked up as a
Little. It belongs to that person alone: it does not change when they later
pick up Littles, and it is never the fam's year (`ace_families.academic_year_*`
are legacy fam-level columns and are not a source for it).

Migration `20261027190000_ace_member_pickup_year.sql` (#669) adds the storage.
The chronological tree layout is #671; historical backfill is #670; stamping
newly published Littles is #674.

## Term ↔ academic year

UCSD academic years start in Fall. `2023` means 2023–24.

| Term | Academic year | | Term | Academic year |
|---|---|---|---|---|
| FA21 | 2021–22 | | FA23 | 2023–24 |
| WI22 / SP22 | 2021–22 | | WI24 / SP24 | 2023–24 |
| FA22 | 2022–23 | | FA25 | 2025–26 |
| SP23 | 2022–23 | | SP26 | 2025–26 |

`src/lib/acePickupYear.ts` is the only parser. It never guesses:

| Input | Result |
|---|---|
| `FA23`, `fa 23`, `FA2023`, `Fall 2023`, `Spring '24` | exact term |
| `2021-22`, `2021–22`, `2021-2022`, `21-22` | academic year, **no term** |
| `legacy`, blank | unknown |
| `2021` (which academic year?), `SU23`, `FA70`–`FA99` (which century?), anything else | needs review |

Two-digit years 00–69 read as 20xx. Above that the century is ambiguous unless
the caller passes `{ century: 1900 }` because the source itself establishes it.
Four-digit forms (`FA1998`, `1998–99`) are always unambiguous. The parser has no
"not in the future" ceiling (`FA30` reads as 2030); that is acceptable because
a parse only ever produces a pending candidate a reviewer must approve.

## Where values live

| | `ace_family_members.pickup_academic_year_start` / `pickup_term` | `ace_member_pickup_evidence` |
|---|---|---|
| Holds | the **approved** value only | raw source values and unreviewed candidates |
| NULL means | unknown or not yet reviewed | — |
| Who reads | public (via `published_ace_family_members`), admins | admins only (RLS + no anon grant) |
| Who writes | admins, through `set_ace_member_pickup_year` | admins: insert as `pending` only, stamped with themselves; review via the function; no delete |

Database constraints on both: year 1960–2100; term matches `^(FA|WI|SP)[0-9]{2}$`,
needs a year, and must belong to it (the four-digit year settles the term's
century, so `SP00` fits 1999). An evidence row can only be `approved` if it has
a candidate year. Statuses: `pending` → `approved` / `rejected`; an approval the
node's value no longer matches becomes `superseded` automatically.

Never default an unknown year from the Big, the fam, the generation, the
graduation year, the node's `created_at`, or today. `pickupYearOf(row)` reads
any missing, null or invariant-breaking value as `{ status: 'unknown' }`.

## Import

The JSON importer keeps each explicit member's `added_term` exactly as written
and parses it into a candidate. On **Import** it writes one
`ace_member_pickup_evidence` row per person with a written term
(`source_kind = 'import_json'`, `review_status = 'pending'`). It never sets the
node's approved columns. Blank or missing terms record nothing; implicit
littles (named only in a `littles` array) have no term of their own.

Preview warns, without blocking, on a term it cannot place and on a Little
dated before their own Big. The seven reconstructed files still import with
zero warnings (330 exact terms, 205 `legacy`, 53 blank).

If the file has terms but the evidence table is not deployed yet, Import
refuses before writing anything.

The importer only creates fams. Do **not** delete and reimport a live fam to
pick up years — use the backfill below.

## Review and backfill interface (#670, #674)

One function changes a node's approved year:

```sql
select public.set_ace_member_pickup_year(
  p_ace_member_id       => '<ace_family_members.id>',
  p_academic_year_start => 2023,        -- null clears back to unknown
  p_term                => 'FA23',      -- null when only the year is known
  p_evidence_id         => '<evidence id>' -- optional; must belong to the node
);
-- → {"ace_member_id": …, "changed": true,
--    "previous": {"academic_year_start": null, "term": null},
--    "current":  {"academic_year_start": 2023, "term": "FA23"}}
```

From the app: `aceFamiliesRepository.setPickupYear(nodeId, year, term, evidenceId)`.

- **Key:** the stable `ace_family_members.id`. Never match by name.
- **Writes only** `pickup_academic_year_start` and `pickup_term` on that node
  (plus `updated_at` via the existing trigger), and the review stamp on the
  evidence row it approves. Name, parent, fam, `member_id`, photo and
  publication are never touched.
- **Security:** `SECURITY INVOKER`; the caller must be an admin
  (`is_admin_user`), otherwise SQLSTATE 42501. `anon` has no EXECUTE.
- **With evidence:** the given year/term must equal that row's candidate
  exactly (22023 otherwise); the row is stamped `approved` with the reviewer
  and time.
- **Corrections:** when the value changes, earlier `approved` evidence that no
  longer matches it is set to `superseded`, so the history never contradicts
  the live value.
- **Idempotent:** re-applying the current value returns `changed: false` and
  does not update the row. Record `previous` from each result to roll a batch
  back.
- **Unknown stays unknown:** leave a node out of the batch (or pass
  `null`/`null` to clear a wrong value). Do not write a guessed year.

A #670 batch therefore looks like: insert evidence rows with
`on conflict do nothing` (the unique key is node + source kind + label + raw
value, nulls equal), let a reviewer choose, then call the function once per
approved node and keep its results as the change log.

Evidence `source_kind` values: `import_json`, `workbook_year_row`,
`official_pairing`, `assignment_cycle`, `admin_entry`. `source_label` is a
short name, never a link (URLs and Drive references are rejected).

## Public projection

`published_ace_family_members` appends `pickup_academic_year_start` and
`pickup_term` after its existing ten columns, with the same published-node +
published-fam filter. It never joins evidence. Grants stay SELECT-only for
`anon` and `authenticated`.

`membersToTreeNodes()` sets `TreeNode.pickup` (typed) and `cohort` (the label:
`FA23`, or `2021–22` for a year-only value, else nothing). Layout still uses
generation depth until #671.

## Verification

```bash
bash scripts/test-ace-pickup-year.sh   # offline disposable PostgreSQL; never a hosted DB
node scripts/verify-rls-security.mjs   # live anon probes (skips until applied)
```

## Rollout

1. Apply the migration (manually, per `vsa-run-and-operate`); then rename the
   file to the version recorded in `schema_migrations`.
2. Deploy the frontend. It tolerates the columns being absent, but the
   importer's evidence insert needs the table, so apply first.
3. Rollback: `scripts/sql/ace-pickup-year.rollback.sql` (export approved years
   and evidence first).

**Status:** applied to production; 0 of 916 published nodes had a year on 2026-10-30.

## Chronological public tree layout (#671; #675 fixtures)

Published ACE year bands use only verified member pickup academic-year values, never generation number or parent age. A family switches to chronological rows only when at least 25% of its nodes have verified dates. Families with no or sparse verified dates keep generation rows and show no implied time axis. In year mode, undated nodes are placed in a distinct Unknown band above known years, and gap years remain full-height bands even with no nodes. Approved terms determine source labels; siblings can be placed in different pickup-year rows and cousins at different lineage depths can share a row.

Cycle/self-parent/duplicate links are repaired only in the layout graph, never written back to ACE lineage. The admin preview alerts the reviewer; the public tree renders the repaired edges and retains interactions. Reverse-time edges are dashed; long forward edges include a straight drop for lineage animation. The separate year rail, focus insets and accessible labels are scoped to #672. No historical year is manufactured and no production migration is part of this change.

Offline fictional golden fixtures and large-tree tests live in src/lib/__fixtures__/aceTreeFixtures.ts and src/lib/aceTreeLayout.test.ts. The #675 real-device, screenshot, historical coverage and rollout preflight work remain separately tracked. Until browser and live-data checks pass, visual acceptance remains unverified.
