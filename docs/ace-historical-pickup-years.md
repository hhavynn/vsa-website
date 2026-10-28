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

Once #669 adds `pickup_term` / `pickup_academic_year_start` to the view, add
them to the `select`: the plan then compares against the current values and
repeats become no-ops.

### 2. Reconcile

```bash
R=scripts/reports/ace-historical-years
npm run ace:years -- reconcile \
  --live-families $R/live/published_ace_families.json \
  --live-members  $R/live/published_ace_family_members.json \
  --repo-families data/ace-families \
  --research-package <private>/ace_backfill_evidence.json \
  --evidence <private>/official_pairings.json \
  --max-year 2025 --out-dir $R/out
```

`--max-year` is the latest academic year whose pickups are public. A source
year after it (a 2026–27 Master row before that Reveal) is never proposed.

Outputs (all private except `summary.*`): `review_sheet.csv` (every live node),
`queue_conflicting_years.csv`, `queue_ambiguous_identity.csv`,
`queue_chronology.csv`, `queue_missing_evidence.csv`, `unmatched_evidence.csv`
(source rows that reach no live node), `summary.json` / `summary.md`
(counts only). `scripts/ace-historical-years-workbook.py <out> <file.xlsx>`
turns a run into a reviewer workbook with one tab per queue.

### 3. Review

ACE Chair or Webmaster fills, per row: `reviewer_decision`,
`reviewer_confirmed_year` (`2021–22` or `2021`), `reviewer_confirmed_term`
(`FA21`, or blank when only the year is known) and `approved_for_backfill`
(`yes`). Identity columns are read-only in spirit: the plan rejects a row whose
name, fam or Big no longer matches the live tree.

### 4. Plan (dry run)

```bash
npm run ace:years -- plan --live-families ... --live-members ... \
  --review <reviewed review_sheet.csv> --out-dir $R/plan
```

A row is planned only if it is approved, the node is still published, its fam,
Big and name still match, the year parses and is not after `--max-year`, and
any term falls inside that year (`FA23` with `2022` is rejected; `SP23` with
`2022` is fine). One node approved twice rejects every copy. Rows already at
the approved values are reported as unchanged, so the same plan run after it
was applied plans **zero** updates.

`backfill_preview.sql` sets only `pickup_term` and
`pickup_academic_year_start`, guards each update on the node's live
`family_id`, `parent_member_id` and reviewed previous values, raises with the
node id unless exactly one row changes, and ends in `ROLLBACK`. Applying it for
real is a separate owner-approved step (below).

## Evidence classes

| Class | Meaning |
|---|---|
| `CONFIRMED_YEAR` | An official pairing sheet, read in full, names this Little under the **live** Big by exact name, and no other credible source disagrees. |
| `STRONG_CANDIDATE` | An explicit repo `added_term` on the link that matches the live Little and Big, or an official pairing that matches only through a looser spelling (middle initial, nickname) or comes from a source not read in full. |
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
  confirms the live node and is noted. Several matching pairs are narrowed by the
  fam label, else held as ambiguous.
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
- **Chronology:** a Little earlier than their live Big holds the weaker-classed
  side (both when equal). The same term as the Big is a warning only.
- **Master calibration:** for each fam, how often its Master rows agree with
  official/repo years on the same nodes. With at least 10 comparisons and under
  50% agreement, Master-only rows get `MASTER_UNRELIABLE_IN_FAM`. This measures;
  it never shifts a year.

## Applying approved years (later, gated)

Only after #669's columns are in production, and only through the manual
production path in `vsa-change-control` / `vsa-run-and-operate`:

1. Re-snapshot (with the pickup columns), re-run `plan` with the reviewed sheet,
   and check the update count against what was approved.
2. Back up the old values of exactly the planned ids into a private table.
3. Run the preview on staging with `ROLLBACK` replaced by `COMMIT` only after the
   statements run clean; confirm `parent_member_id`, `family_id`, `member_id`,
   `name` and `photo_url` are byte-identical before and after (`md5` of those
   columns over the fam).
4. Production: same statements, owner-approved, in batches by fam.
5. Rollback is restoring the two columns from the backup; nothing else changed.

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
