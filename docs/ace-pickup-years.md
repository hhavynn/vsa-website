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
`FA23`, or `2021–22` for a year-only value, else nothing). Approved years use the chronological year-row layout from #671, with a synchronized left year rail from #672. Undated legacy families still use honest generation-depth layout and explicitly state the years are being verified.

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

## Public academic-year rail (#672)

Year-mode family sheets show one left-hand `2023–24` rail label and horizontal row guide per actual academic year, including empty years, with an explicit `Unknown pickup year` band. The label and SVG guide both derive their Y position from `bandRect` in `src/lib/aceTreeLayout.ts`, so a 2023–24 Little appears in the same band as a cousin picked up in the same year even at different lineage depths. Undated-only families have **no** academic-year labels; their note is `Rows show generations. Pickup years are still being verified.`

The label rail stays inside the same transformed canvas as the tree, but cancels horizontal panning and inverse-scales the text to keep it readable at 50/100/200% zoom. Responsive rail width reserves space in pan limits and keyboard focus. Node accessible names include their **own approved pickup year**, not their Big's year. The selected-member card says `Picked up: Fall 2023 · 2023–24`, `Picked up: 2023–24 (term unknown)` or `Pickup year unverified`. No source, evidence status, reviewer, pending application or private year guess reaches the public rail.

**Manual validation still required:** 320px iPhone and Android, 768px tablet, desktop, both themes, browser zoom and touch pinch/pan, reduced motion, keyboard navigation and VoiceOver/TalkBack. The #675 browser measurement/screenshot work stays separate. No database migration or publish action is part of the rail.

## Historical pickup-year coverage preflight (#675, no database writes)

The `coverage` command measures reconstructed source terms **separately** from approved years on the published, year-allowlisted view. It never matches a person by name, guesses from a Big or edits any node. Source categories are exact term, year-only, legacy, absent and malformed/needs-review. Published per-fam categories are approved year, approved term and unknown; archived (Graveyard) fams are included. A source term is **not** a verified public pickup date.

```bash
npm run ace:years -- coverage \
  --live-families /restricted/published_ace_families.json \
  --live-members /restricted/published_ace_family_members.json \
  --repo-families data/ace-families \
  --out-dir scripts/reports/ace-historical-years/coverage
```

The two live JSON inputs must be complete, separately authorized exports of the published views; each member MUST include both pickup_academic_year_start and pickup_term keys, even when NULL. Missing #669 columns, empty or partial files, malformed JSON or duplicate IDs **fail the command**. Files written: `coverage.json` and `coverage.md`, containing counts and public family slugs only. `--out-dir` must be gitignored or external; the command refuses tracked outputs. Inspect small-cell counts before copying any aggregate into the public repository. Do not commit the exported snapshots, review sheets, photos or any raw student information.

Owner signoff checklist:

- [ ] Confirm #669 migration is actually deployed to the target database, and RLS/anon projection reveals the two approved pickup columns but no evidence, private family rows or contact information. A green frontend build is not deployment proof.
- [ ] Verify complete read pagination for BOTH published views, published-family/node counts, no hidden terminal page, no read errors reported as an empty family. Confirm Sunshine, Sweatpants and Graveyard families are included.
- [ ] Record the counts of term-approved, year-only and Unknown members by public fam, plus totals. Re-run the report on a fresh snapshot after each approved correction batch. Historical reconstructed `added_term` values remain pending evidence until separately approved.
- [ ] For the exact intended batch, run `scripts/sql/ace-year-only-hash.sql` *before* and *after* the owner-authorized #670 write, compare each family's `stored_nodes` and `shape_hash`; these hashes deliberately exclude both year fields and updated_at, and include member links, parent relationships, names, photos, role labels, order and publication state. **STOP on any difference.**
- [ ] Check #669 term mapping (`FA21` and `SP22` share 2021–22; `FA23` vs `SP23` differ), RLS verifier, publisher cycle year stamping (#674) and complete read/changed count reconciliation. Require explicit reviewer approval; no invented year for legacy nodes.
- [ ] Manual phone/tablet/desktop year-rail, focus, pan/zoom, deep link, light/dark and screen-reader evidence waits for #671 and #672. No screenshot or device signoff is implied by this CLI.

The existing 2026-10-27 counts in `docs/ace-historical-pickup-years-results.md` are historical **review candidates**, not this newly measured approved-year state. Publish only independently reviewed count-only updates there, and keep private evidence outside git.
## Reviewed correction API — #673 backend, staged until owner approval

`correct_ace_member_pickup_year` is a new separate RPC; the legacy `set_ace_member_pickup_year` used for the historical plan remains unchanged. The correction RPC requires the ACE member **UUID**, both exact expected values (including NULL) from the admin editor, next approved year/term, an approved source kind (`official_pairing`, `workbook_year_row`, `import_json`, `admin_entry`), and optional matching evidence UUID. It refuses non-admin users, source mismatches and stale expected values with a refresh message. It never guesses from the Big or family.

One database transaction locks that node, validates the expected year/term, creates a deduplicated pending admin-year evidence row if no evidence was chosen, asks the existing #669 setter to approve and write only the year fields, then appends a protected `admin_activity_log` entry **only if the approved value changed**. The audit stores the old and new year/term and selected source kind only; no notes, contacts, student names or Drive links. An audit failure rolls back the node change and evidence. The activity year column is deliberately NULL (1998 and earlier ACE year corrections do not satisfy the activity-log 2000 minimum).

**The later #673 per-node admin editor is on a separate stacked PR, not part of the backend migration.** Never call the old setter from that editor; the only permitted writer is the audited compare-and-swap RPC.

**Status:** applied to production 2026-10-31 as version 20261031080736, with no staging run because no staging project exists. The admin correction UI is being introduced in a separate, review-gated PR; this migration note does not attest to its deployment.

Migration `20261031080736_ace_pickup_year_correction.sql` must be applied **after** `20261002040000_admin_activity_log_and_review_marks.sql` and `20261027190000_ace_member_pickup_year.sql`. Owner first confirms both prerequisites exist on staging, then manually applies the correction migration. Never run `supabase db push` or apply production SQL from an agent. If an RPC is absent, the client correction must fail closed; never fall back to the unaudited setter.

Verification: run `bash scripts/test-ace-pickup-year.sh` for the existing rollback suite and new `ace-year-correction.test.sql` section in a disposable local cluster. On authorized staging, validate a conflict between two admin browser tabs, approved and Unknown values, evidence review history, activity entry, and anon/nonadmin EXECUTE denial; compare node identity, Big, children, role, avatar, publication before/after. These hosted checks and production application have **not been performed**.

## Admin pickup-year review queue (#673, read-only frontend foundation)

The ACE admin family editor now checks two private, family-scoped sources: all admin ACE
nodes for the selected family, and the paginated `ace_member_pickup_evidence` review
projection. Both must load successfully before the queue shows counts or names. A
failed evidence read is **unavailable**, not zero conflicts; selecting another family
changes the admin query key. The private evidence cache is never reused on `/ace`.

A review-only **Needs year review** filter and node-ID-based queue identify missing
approved years, pending or conflicting dated sources, same-term and reverse-time
Big/Little dates, gaps of six or more academic years, and duplicate names/member
links. A year-only source does not fabricate a Fall/Winter/Spring term; past sources
marked rejected/superseded are not promoted back to approved dates. The queue
offers direct navigation to the existing ACE node editor, **not** an automatic fix,
bulk date assignment or lineage change. A clean queue is not proof of historical
source completeness.

## Per-node reviewed pickup-year correction editor (#673, stacked PR)

Each node's dedicated **Review pickup year** accordion has its own form, independent
of the ordinary member Save. The form requires an explicit whole academic-year
span such as `2023–24`; bare `2023`, blank and `legacy` never become
approved years. The season selector is optional: keep it empty if the source
establishes only the academic year. When selected, Fall/Winter/Spring becomes
the canonical term `FA23`/`WI24`/`SP24` for that 2023–24 year. No current
date, family start date, generation depth or Big's pickup date is ever a default.

The editor displays Fam, exact node ID, approved year, Big and each recorded
Little with their own approved years. It previews this node's old → proposed
year and chronology warnings. It can fill a candidate from private **pending**
evidence (preserving exact academic year, term, source_kind and evidence UUID);
changing that draft clears the evidence UUID. Older superseded approvals remain
visible as a count, not editable records. A sourced candidate still requires a
confirmation dialog and the atomic server-side audit to become approved.

To save, the admin explicitly confirms the target node and source category.
A confirmed overwrite or **Set to Unknown** also requires explicit confirmation.
`correctPickupYear` sends the node's **currently approved** year and term as the
expected compare-and-swap values and changes only the year columns. A competing
edit surfaces `Someone else changed this pickup year. Refresh and try again.`,
re-fetches the member data and **never** retries with overwritten expectations.
A correction committed successfully remains committed even if subsequent
refresh fails; the UI instructs the admin to reload rather than resubmit.

The normal member Save still excludes the two pickup columns and cannot undo
this correction. Do not auto-reimport a Fam or bulk-move year bands to fix
historical dates. Office-handoff rule: approve only source-grounded academic
years, leave Unknown if historical evidence is ambiguous, reconcile after
Reveal through this audited correction path (not by republishing) and verify the
approved year in the public projection once the authorized rollout has completed.

**Remaining before issue closure:** exact-head CI; staging/hosted anon and
non-admin denial of the correction RPC and private evidence, two-admin-tab CAS
rehearsal, activity history integrity, 320px and keyboard/screen-reader checks,
and a before/after hash proving Big/Little edges, membership links, avatars and
publication fields are unchanged. No bulk edits or live data changes are authorized.

