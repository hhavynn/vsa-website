# ACE family tree imports

`data/ace-families/` holds one import file per ACE fam, reconstructed from the
ACE family-tree workbook (generated 2026-09-27: legacy family-tree sheet plus
FA21–SP26 pairing sheets) and then repaired with the owner's lineage
corrections (2026-09-28, [below](#lineage-corrections-2026-09-28)). Each file is in the admin importer's JSON shape and
imports with zero warnings. `src/lib/aceFamilyImport.test.ts` enforces that,
plus the exact member, link and root counts below.

| File | Fam | People | Big → little links | Roots | Confirmed / inferred links |
|---|---|---|---|---|---|
| `underwater.json` | Underwater | 104 | 99 | 5 | 75 / 24 |
| `down.json` | Down | 139 | 135 | 4 | 121 / 14 |
| `moon.json` | Moon | 30 | 25 | 5 | 25 / 0 |
| `bang-mi.json` | Bang Mi | 52 | 49 | 3 | 43 / 6 |
| `nsf.json` | NSF | 145 | 139 | 6 | 114 / 25 |
| `cross.json` | Cross | 81 | 75 | 6 | 61 / 14 |
| `dead-attractive-af-aaf.json` | Attractive AF (AAF), graveyard | 37 | 34 | 3 | 18 / 16 |

Sweatpants and Sunshine are already in the database and are not included.

## Importing

1. Admin → ACE Families → **Import JSON**.
2. Paste one file's contents and click **Preview**. It should show the people
   count above and **no warnings**.
3. Optionally set a theme color, choose whether to publish, then **Import**.
4. Repeat per fam.

Import each file **once**. Fam slugs are not unique in the database, so a second
import creates a duplicate fam; delete the extra one in the admin page if that
happens. After import, a fam replaces its "coming soon" slot on `/ace` (matched
by slug). AAF's `(Dead)` prefix puts it in the Fam Graveyard.

## Data decisions

- **Links kept:** every confirmed and inferred edge in the workbook. Inferred
  links are unlabeled pairings whose big was already established in that fam
  (`confidence: "inferred-high"`), or ones resolved from strong descendant
  evidence (`"inferred-medium"`). Each member records its link's
  `added_term` and `confidence`; the importer ignores both.
- **Links left out:** the workbook's 21 `candidate-low` rows (Needs Review
  sheet). They have too little family evidence to place.
- **AAF / Moon split:** AAF is an archive fam ending SP23. Moon starts FA23 and
  does not show AAF ancestry, so its five FA23 roots also appear in AAF as
  littles.
- **Bang Mi** lists `GBM` as an alias (the FA23 sheet's name for the fam).
- **Same name, different people** (kept apart with `id_hint`):
  - Down, Alex Nguyen: one under Danny Tran, one under Mei Fu Lee (the legacy
    sheet lists an ERC and a Marshall Alex Nguyen). Sabrina Lin and Joyce Yuan
    are placed under **Danny Tran's** Alex: the legacy sheet orders the
    next-generation rows "Alex's littles, then Laura Tran's", matching Danny's
    "Alex, Laura". **Unconfirmed** — move them in the admin page if wrong.
  - NSF, Jenny Nguyen: legacy (under Jonathan Kwok) and FA22 (under Joseph
    Luu). Her four legacy littles go under the legacy Jenny.
  - Cross, Khanh Le: legacy (under Kevin Huynh) and FA25 (under Johanna Q
    Nguyen). Neither has littles.
  A little under one of these uses `big_id_hint` to name the right big.
- **Fam heads' spelling:** tree nodes use the heads' own spelling:
  `Anhthu Vo` → `Anh Thu Vo`, `Katherine M Chen` → `Katherine Chen`,
  `Jonas Nicolai Truong` → `Jonas Truong`. Moon head **An Nguyen** does not
  appear in the Moon data.
- Other names are kept as the sources wrote them, including middle initials
  (e.g. `Andy G.A. Vu`). Tidy them in the admin page after import if wanted.

## Lineage corrections (2026-09-28)

The first import left false roots where one person appeared under two
spellings, or where a known big was missing. These owner-confirmed fixes are
applied to the files and marked in each member's `notes`. Identities are joined
**only inside the named fam**, never across fams.

| Fam | Same person (alias → kept name) | Links added | New people | Roots |
|---|---|---|---|---|
| Underwater | Tiffany Lu → Tiffany Luu; Spencer → Spencer Ho; Anh Nguyen → Anh T Nguyen; Phuong Nguyen → Grace Phuong Nguyen | Jenny Nguyen → Kelly Nguyen; Jason Le → Grace Nguyen → Anthony Dang → Jennifer Ho; Grace Phuong Nguyen → Amy Q. Tran | Jason Le; Amy Q. Tran's older littles Clarkson Phan, Eric Pham, Ashley Nguyen (a different person from NSF's legacy Ashley Nguyen) | 12 → 5 |
| Down | Arianna Pham → Arianna Phan (already fixed live) | Larry Nguyen → Arianna Phan; Tram Le → Giale Le; Elizabeth Hoang → Larry Nguyen | Tram Le, Elizabeth Hoang | 5 → 4 |
| NSF | Kim Tran → Kim D. Tran; Tracy Vu → Tracy T Vu; Aidan C Nguyen → Aidan Nguyen-Tran; Mailan N Doan → Mailan Doan; Sam Do's Henry Nguyen → HenryPV Nguyen | Jamie Doan → Joseph Luu → Kim D. Tran → Tracy T Vu → Aidan Nguyen-Tran now one chain; Vivian Dang → Darren Nguyen, Edward B Vo; Steven Nguyen → Emily Dinh; Leilani Ma → Eleanor Nguyen → Katrina Dinh; My Nguyen → Xuan-Mai Nguyen → Paige Kwan | Vivian Dang, Steven Nguyen, Leilani Ma, Eleanor Nguyen, My Nguyen, Xuan-Mai Nguyen | 12 → 6 |
| Cross | Tyana Lai → Tyana T Lai; Catherine M Hoang → Catherine Hoang; Preston J Shin → Preston Shin; Alexandre Nguyen → Alex Nguyen | Angelina Phan → Fatima Dong, Harrison Nguyen; Wilson Nguyen → Trinity Bui; Jeffrey Ha → Alex Nguyen → Vy Do (Vicky) | Angelina Phan, Wilson Nguyen | 11 → 6 |
| Bang Mi | — (the SP25 sheet's "Deric Chu" is Deric Chau) | Deric Chau → Zihan Liu (SP25); removed the inferred Tracy Nguyen → Helen Tran → Tien Vo branch, which is Sweatpants' Helen Tran → Tien Vo | Zihan Liu | 3 → 3 |
| Moon | — | Codie Yeung → Kenny Le, Patrick Woo (both SP25, siblings) | Kenny Le, Patrick Woo | 5 (intentional FA23 roots) |

Each alias was a leaf whose term leads straight into the kept person's own
littles (e.g. Kim Tran FA22 → Kim D. Tran's FA23 littles), so every join keeps
time moving forward. Links with no known term have no `added_term`.

Two joins were confirmed after a second review: Cross's legacy **Alexandre
Nguyen** is Vy Do (Vicky)'s big **Alex Nguyen**, and Bang Mi's inferred
**Helen Tran → Tien Vo** is Sweatpants' Helen Tran → Tien Vo (already in the
Sweatpants tree), so it was removed from Bang Mi.

### Left open (needs owner confirmation)

- **Bang Mi — FA23 same-term rows.** The FA23 official sheet lists Thomas T
  Nguyen and Tiffany T Thai as Vivian Chau's littles *and* as bigs of FA23
  littles (Nhi H Trinh, Tina Le, Mina N. Ho, Amy Nguyen). The links are
  confirmed; Thomas's and Tiffany's own term is likely earlier than FA23.

## Updating fams that are already imported

The importer only creates fams. To apply a corrected file to a fam that is
already live, in Admin → ACE Families:

1. Note the fam's theme color, then delete the fam (its members go with it).
2. Import the corrected file (Preview should show no warnings), tick
   **Publish immediately**, and re-enter the theme color.

Member photos and manual edits made after the first import are lost, so
check for them first (none existed as of 2026-09-28). AAF did not change.

## Source gaps

These sources were not readable when the workbook was built, so pairings
recorded only there are missing: Spring 2022, Fall 2023 and Spring 2024 ACE
responses, and the SP25 official pairings. Nothing earlier than the legacy
family-tree sheet was found.
