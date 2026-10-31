# ACE historical pickup years (#670)

How the academic year each person was picked up into ACE is recovered from
historical sources and matched to the **existing** live family-tree nodes,
without changing any relationship. Schema and display belong to #669; this is
the evidence, reconciliation and review side.

**Status:** reconciliation and review tooling only. No database row has been
written. Applying any year waits on #669's columns, an authorized review, and
the manual production change path.

## The rule that overrides everything

The published website tree is the authority for **who** each person is, their
**fam**, their **Big**, their **Littles** and their node id. Several
relationships there were corrected directly with former members after the
spreadsheets were made, and the AAF archive lineage now lives under Moon.

Historical sources are used for one fact only: the pickup **year**. Nothing in
this workflow proposes a change to `name`, `family_id`, `parent_member_id`,
`member_id`, `photo_url`, `role_label`, `display_order` or `is_published`, or
creates a person. When a source disagrees with the live tree about a Big or a
fam, the live tree wins and the row is held for review.

## Pipeline

| Step | Code | Output |
|---|---|---|
| Snapshot the published tree | anon REST or SQL below | private JSON |
| Adapt sources to `ace-pickup-evidence/v1` | [`aceHistoricalEvidence.ts`](../src/lib/aceHistoricalEvidence.ts) | in memory |
| Match and classify, one row per live node | [`aceHistoricalYears.ts`](../src/lib/aceHistoricalYears.ts) | review sheet + queues |
| Reviewer approves rows | spreadsheet | reviewed CSV |
| Dry-run, ID-keyed plan | [`aceHistoricalYearsPlan.ts`](../src/lib/aceHistoricalYearsPlan.ts) | `backfill_plan.json`, SQL preview ending in `ROLLBACK` |

CLI: [`scripts/ace-historical-years.ts`](../scripts/ace-historical-years.ts)
(`npm run ace:years -- reconcile|plan`). It reads and writes local files only,
never contacts Supabase or Drive, and refuses an output folder git would track.

### 1. Snapshot (read-only)

Only published rows. The two published views are already readable by `anon`,
so no service-role key is needed:

```bash
# from a checkout with .env.local; output goes to a gitignored folder
OUT=scripts/reports/ace-historical-years/live; mkdir -p "$OUT"
curl -sf -H "apikey: $REACT_APP_SUPABASE_ANON_KEY" -H "Authorization: Bearer $REACT_APP_SUPABASE_ANON_KEY" \
  "$REACT_APP_SUPABASE_URL/rest/v1/published_ace_families?select=id,slug,name" -o "$OUT/published_ace_families.json"
curl -sf -H "apikey: $REACT_APP_SUPABASE_ANON_KEY" -H "Authorization: Bearer $REACT_APP_SUPABASE_ANON_KEY" -H "Range: 0-4999" \
  "$REACT_APP_SUPABASE_URL/rest/v1/published_ace_family_members?select=id,family_id,name,parent_member_id,member_id&order=id" \
  -o "$OUT/published_ace_family_members.json"
```

The plan needs current pickup values. Once #669 adds `pickup_term` /
`pickup_academic_year_start`, snapshot them too, from the **base table** with an
admin SQL session if #669's view masks unapproved years (a masked value would
make every guarded update fail). Without those keys `plan` refuses to run
unless given `--pre-669-snapshot yes`, which marks the output a preview that
assumes every current value is blank.

### 2. Reconcile

```bash
R=scripts/reports/ace-historical-years
npm run ace:years -- reconcile \
  --live-families $R/live/published_ace_families.json \
  --live-members  $R/live/published_ace_family_members.json \
  --repo-families data/ace-families \
  --research-package <private>/ace_backfill_evidence.json --package-sections master \
  --evidence <private>/official_pairings.json \
  --max-year 2025 --out-dir $R/out
```

Evidence files use `ace-pickup-evidence/v1`: `sources[]` (`source_id` of
A–Z/0–9/_ only, `kind`, `label`, `term`, `extraction_complete`, and
`authoritative: true` only for a sheet labelled official/final) and `records[]`
(`source_id`, `kind`, `little`, `big`, `term` or `academic_year_start`,
`fam_hint`, `ref`). A pairing source without `authoritative: true` can never
confirm. The research package's own pairing rows are adapted as
non-authoritative (corroboration only); take only its Master cells
(`--package-sections master`) when the sheets have been re-read.

`--max-year` is the latest academic year whose pickups are public. A source
year after it (a 2026–27 Master row before that Reveal) is never proposed.

Outputs (all private except `summary.*`): `review_sheet.csv` (every live node),
`queue_conflicting_years.csv`, `queue_ambiguous_identity.csv`,
`queue_chronology.csv`, `queue_roots.csv`, `queue_missing_evidence.csv`, `unmatched_evidence.csv`
(source rows that reach no live node), `summary.json` / `summary.md`
(counts only). `scripts/ace-historical-years-workbook.py <out> <file.xlsx>`
turns a run into a reviewer workbook (it also refuses a tracked path). Only its
"All nodes" tab is editable; queue tabs are protected copies.

### 3. Review

ACE Chair or Webmaster fills, per row: `reviewer_decision`,
`reviewer_confirmed_year` (`2021–22`; a bare `2021` is rejected because it is
ambiguous), `reviewer_confirmed_term` (`FA21`; blank when only the year is
known, which keeps a term already recorded for that same year; `CLEAR` to
remove one) and `approved_for_backfill` (`yes`). Identity and existing-value
columns are read-only in spirit: the plan rejects a row whose name, fam, Big,
Big's name or existing year/term no longer matches the live tree.

### 4. Plan (dry run)

```bash
npm run ace:years -- plan --live-families ... --live-members ... \
  --review <reviewed review_sheet.csv> --batch-label FA26-reviewed-historical-pass-1 \
  --out-dir $R/plan
```

A row is planned only if it is approved, the node is still published, its fam,
Big, Big's name, own name and existing year/term still match what the reviewer
saw (so a later correction is never overwritten), the year parses and is not
after `--max-year`, and any term falls inside that year (`FA23` with `2022–23`
is rejected; `SP23` with `2022–23` is fine). One node approved twice rejects
every copy. Rows already at the approved values are reported as unchanged, so
the same plan run after it was applied plans **zero** updates. The plan
records the sheet's confidence class as written; it is reviewer-editable, so
re-run `reconcile` before applying to confirm it.

`backfill_preview.sql` updates **only** `pickup_term` and
`pickup_academic_year_start` on existing ACE nodes, guarded by live
`family_id`, `parent_member_id`, and reviewed previous values. Every
successful year update also inserts a deduplicated approved evidence claim
(source category, generic label, approved term/year; no personal data), and
one counts-only `ace.pickup_backfill` admin activity entry per affected
family is appended **after** every node passes. Any failure is transactional,
and the generated SQL still ends in `ROLLBACK`. The human operator must
explicitly authorize and verify a separate application.

`--batch-label` is required for post-#669 plans; it must be a generic,
URL-free 1–200 character audit label. Pre-#669 preview-only snapshots can omit
it, and do not generate evidence or activity statements. Do not call
`set_ace_member_pickup_year` from the SQL editor or migration role: it
requires an authenticated admin `auth.uid()` and returns 42501 without it. Applying it for
real is a separate owner-approved step (below).

## Evidence classes

| Class | Meaning |
|---|---|
| `CONFIRMED_YEAR` | An authoritative official pairing sheet, read in full, names this Little under the **live** Big by exact name, and no other credible source (or existing live value) disagrees. |
| `STRONG_CANDIDATE` | An explicit repo `added_term` on the link that matches the live Little and Big, or an official pairing that matches only through a looser spelling, comes from a source not read in full or not labelled official, or names no Big for a root. |
| `SUSPECTED_YEAR` | Only a Master workbook year row, matched by name inside the live fam. |
| `CONFLICTING_EVIDENCE` | Credible years disagree, a source names a different Big, the row fits several people, the year is after the latest Reveal, or a Little would predate their Big. Every candidate is kept. |
| `UNKNOWN` | No usable year. `legacy` terms land here (flag `LEGACY_TERM_ONLY`). |

Precedence (official > repo term > Master) decides only which year is **shown**
first. It never resolves a disagreement: a contradiction holds the row.

Academic years: `FA21` → 2021–22; `WI22` and `SP22` → 2021–22; `FA23` →
2023–24 but `SP23` → 2022–23. A Master row gives a year, never a term. Years are
never inferred from a Big's year, generation depth, standing, graduation or node
creation time; a person's own year does not change when they later take Littles.

## Matching rules

- **Names** fold case, accents (`Đ` → `d`), punctuation and spacing.
  Parenthetical nicknames are dropped for the exact key. Dropping middle
  initials or using the nickname as a first name is a *looser* match, never
  enough to confirm.
- **Official pairings** match on the Little **and** the live Big together,
  across all fams, so an obsolete fam label (the FA23 sheet's, `GBM`) still
  confirms the live node, flagged `SOURCE_FAM_LABEL_DIFFERS`. If the labelled
  fam has its own node with that Little's name, the row is ambiguous for both.
  Several matching pairs are narrowed by the fam label, else held as ambiguous.
  An ambiguous row that gives a different year holds every candidate node.
- **Repo `added_term`** matches within the file's fam on Little + live Big.
- **Master cells** carry no Big: they match a name only inside the live fam, and
  a name shared by two nodes in that fam is never guessed.
- A Little found under a **different** Big is reported (`SOURCE_BIG_DIFFERS`),
  never re-parented. A name in two fams is two people unless the evidence pair
  says otherwise.
- **Fam aliases:** `NO SEX FAM` → NSF, `GBM`/`Bang Mi` → Bang Mi, `swp` →
  Sweatpants, `sun` → Sunshine, `under` → Underwater, graveyard `(Dead) …` fams by
  base slug. **AAF → Moon** only when no AAF fam is live (the documented split);
  with both live, AAF evidence never reaches Moon.
- Header cells that leak into extracted rows (`LITTLE`, `BIG`) are not people.
- **Chronology:** a Little earlier than their live Big (by year, then FA < WI <
  SP within a year) holds the side whose year rests on weaker evidence (both when
  equal), regardless of either row's other holds. The same term as the Big is a
  warning only.
- Matched rows whose term is not FA/WI/SP or `legacy` are flagged
  `UNPARSEABLE_TERM`; years outside 2005–2069 are rejected.
- **Master calibration:** for each fam, how often its Master rows agree with
  official/repo years on the same nodes. With at least 10 comparisons and under
  50% agreement, Master-only rows get `MASTER_UNRELIABLE_IN_FAM`. This measures;
  it never shifts a year.

## Applying approved years (later, gated)

Only after #669's columns are in production, and only through the manual
production path in `vsa-change-control` / `vsa-run-and-operate`:

1. Re-snapshot (with the pickup columns), re-run `plan` with the reviewed sheet,
   and check the update count against what was approved.
2. Back up the old values of exactly the planned ids into a table in a schema
   the API does not expose (a new table in `public` gets anon grants).
3. Run the preview on staging with `ROLLBACK` replaced by `COMMIT` only after the
   statements run clean; confirm `parent_member_id`, `family_id`, `member_id`,
   `name` and `photo_url` are byte-identical before and after (`md5` of those
   columns over the fam).
4. Production: same statements, owner-approved, in batches by fam.
5. Rollback is restoring the two columns from the backup; nothing else changed.

#670 also asks for an admin-only audit of applied changes; that table belongs
with #669's schema and is not created here.

Later corrections are the same flow with the new reviewed year: the plan marks
them `overwrites_existing_value` and never touches ancestry.

## Privacy

Source workbooks, the snapshot, the review sheet, queues, unmatched rows,
plans and SQL previews hold real names: keep them in
`scripts/reports/` (gitignored) or outside the repo, never in a PR, issue, CI
artifact or log. `summary.json` / `summary.md` are counts only and are the
only outputs safe to publish. Tests use fictional people. No contact details,
application answers or Drive links are read by the code.

## Results and gaps

See [ace-historical-pickup-years-results.md](ace-historical-pickup-years-results.md)
for the aggregate run, the sources inspected and the open historical gaps.
