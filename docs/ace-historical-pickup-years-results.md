# ACE historical pickup years: run of 2026-10-27 (aggregate)

Counts only. Row-level review files are private and are not in the repo.
Method: [ace-historical-pickup-years.md](ace-historical-pickup-years.md).
**No year has been written to the database;** these are review candidates.

## Live tree (read-only snapshot of the published views)

- **916** published nodes in **16** published fams. Every node and fam is
  published; no node's parent is missing or unpublished; no node has a parent in
  another fam.
- 167 nodes link a canonical member; no canonical member is linked to two nodes.
- Roots: one per fam except Bang Mi (2), Underwater (2), (Dead) Ho (2) and
  (Dead) Royals (3).
- Same-name groups inside one fam: Cross, Down, NSF and Sunshine have one each.
  38 names appear in more than one fam (treated as different people).
- The live site has **no AAF fam**: the AAF archive lineage is published under
  Moon (63 nodes, one root). AAF-labelled evidence therefore reaches Moon, and
  is noted on every such row.
- #669's pickup columns do not exist yet, so existing year coverage is 0.

## Result

| Fam | Live nodes | Confirmed | Strong | Suspected | Conflicting | Unknown | Master agrees* |
|---|---|---|---|---|---|---|---|
| Bang Mi | 52 | 12 | 27 | 11 | 0 | 2 | – |
| Cross | 81 | 27 | 22 | 25 | 1 | 6 | – |
| Down | 139 | 37 | 27 | 0 | 1 | 74 | no Master rows |
| Moon | 63 | 18 | 11 | 21 | 11 | 2 | 9/18 |
| NSF | 146 | 50 | 25 | 49 | 16 | 6 | 0/7 |
| Sunshine | 102 | 30 | 5 | 43 | 23 | 1 | 32/53 |
| Sweatpants | 107 | 24 | 11 | 37 | 32 | 3 | 22/53 |
| Underwater | 104 | 23 | 20 | 28 | 31 | 2 | 2/29 |
| (Dead) Bad Decisions | 34 | 4 | 0 | 0 | 0 | 30 | – |
| (Dead) Cup Noodle | 6 | 0 | 0 | 0 | 0 | 6 | – |
| (Dead) Cute and Cocky | 20 | 0 | 0 | 0 | 0 | 20 | – |
| (Dead) Ho | 10 | 0 | 0 | 0 | 0 | 10 | – |
| (Dead) Royals | 16 | 2 | 1 | 0 | 0 | 13 | – |
| (Dead) SLOTH | 15 | 3 | 2 | 0 | 1 | 9 | – |
| (Dead) SNACC | 16 | 1 | 0 | 0 | 0 | 15 | – |
| (Dead) VWA | 5 | 0 | 0 | 0 | 0 | 5 | – |
| **Total** | **916** | **231** | **151** | **214** | **116** | **204** | |

\* Nodes dated by an official pairing or repo term that also have a Master
year row, and how many of those Master rows give the same year. Sweatpants and
Underwater (under 50%, at least 10 compared) get `MASTER_UNRELIABLE_IN_FAM` on
their Master-only rows; NSF's 0/7 is below the 10-row threshold but points the
same way. Underwater's Master rows run 1–3 years late, consistent with
generation rows read as years.

- **Confirmed** by term: FA21 45, SP22 5, FA22 45, FA23 65, SP25 2, FA25 66,
  SP26 3.
- **Strong**: 74 rest on the repo's FA24 term alone (no FA24 pairing sheet
  survives), 14 on the unlabelled SP23 list, the rest on looser spellings of an
  official row or a repo term.
- **Suspected** (Master only, year without term): 2015–16 through 2025–26.
- **Conflicting** (116): 71 are held only because a Master row disagrees with an
  official/repo year (63 of them have an exact official pairing; 42 are in
  Sweatpants/Underwater), a likely batch for quick review.
- **Flags across all rows**: 43 `CHILD_EARLIER_THAN_BIG`, 21
  `SOURCE_BIG_DIFFERS` (a source names a different Big; live kept), 12
  `AMBIGUOUS_IDENTITY`, 8 `SAME_NAME_IN_FAM`, 5 `FUTURE_OR_UNREVEALED_YEAR`
  (2026–27 Master rows).
- **Unknown** (204): 108 are in graveyard fams; 75 rows carry only a `legacy`
  term (70 in Down, where the Master has no year rows).
- Identity: 477 nodes resolved by Little + live Big, 230 by name inside the live
  fam (Master only), 202 matched no source.
- Review queues: conflicting years 116, missing evidence 204, chronology 47,
  ambiguous identity 35. The four documented Bang Mi FA23 same-term rows surface
  as `SAME_TERM_AS_BIG`.

## Sources inspected

| Source | Kind | Rows | Reached a live node | Notes |
|---|---|---|---|---|
| FA21 official pairings (tab `ACE Pairings`) | official | 102 | 76 | Archive copy made in the 2025 Drive migration. No fam column. Trolling and contact tabs ignored. |
| SP22 final pairings | official | 15 | 13 | **New** this run. |
| FA22 official pairings (tab `ACE Official Pairings` in a workbook titled "Troll Pairings") | official | 123 | 84 | **New.** Term from the standalone "FA22 ACE PAIRINGS" sheet in the same folder, which agrees except one row; one duplicated row. |
| SP23 pairings | official, **unlabelled** | 16 | 14 | **New.** Not labelled official/final, so it can only produce Strong candidates. |
| FA23 official pairings (tab `Pairings`) | official | 119 | 113 | Fam column stale. The research package's 120 included a leaked header row; the per-Big counts, per-fam totals and the reveal-day workbook all give 119. |
| SP25 official pairings | official | 7 | 7 | **New.** |
| FA25 official pairings (tab `OFFICIAL PAIRINGS`) | official | 102 | 98 | Troll tab ignored; footer and fam subtotals match. |
| SP26 official pairings | official | 4 | 4 | |
| `data/ace-families/*.json` `added_term` | repo term | 535 | 534 | Seven reconstructed files (AAF's one leaf did not reach Moon). |
| Master ACE workbook, variants A / B / C | Master year cells | 353 / 495 / 399 | 340 / 393 / 388 | Same layout; B is newest and extends NSF to 2026–27. 4 multi-name cells skipped. |

Official pairing sheets were re-read in full from exports, independently of the
research package. 206 source rows reach no live node (listed privately for
follow-up): mostly FA21/FA22 Littles who are not on the published tree or are
spelled differently there, and Master variant B cells.

## Gaps and unresolved cases

- **No official pairing source** was found for FA24, SP24 or any winter term.
  An "FA24 reveal check-in" sheet lists Littles without Bigs and is not evidence.
  FA24 years rest on the repo reconstruction (Strong, not Confirmed).
- **Down**: the Master's Down tab has no name-level year rows. 74 Down nodes are
  Unknown, most with a `legacy` term only.
- **Graveyard fams** (122 nodes): no Master or repo data; only a few official
  pairings reach them. 108 Unknown.
- **Master generation-only rows** (Underwater X–XII, some Bang Mi/Sweatpants
  rows) and unlabelled bottom rows cannot be dated; the Master's "dead fams" tab
  has no year labels.
- **Spellings**: owner-confirmed aliases (e.g. Down's renamed node) are not
  joined automatically, so those official rows sit in the unmatched list for a
  reviewer. Looser matches (middle initials, nicknames) never confirm.
- **SP23** stays capped at Strong unless an owner confirms that list was final.
- **Moon / AAF**: Moon rows dated by AAF-labelled evidence are noted; 11 Moon
  rows conflict, several on the FA23 split boundary.

## Depends on #669

Persisting any approved year needs #669's `pickup_term` and
`pickup_academic_year_start` on `ace_family_members` and in the published view.
The plan format here targets exactly those two columns. Until then the review
can proceed, and `plan` runs as a dry run against a snapshot without them.
