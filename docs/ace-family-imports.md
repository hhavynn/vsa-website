# ACE family tree imports

`data/ace-families/` holds one import file per ACE fam, reconstructed from the
ACE family-tree workbook (generated 2026-09-27: legacy family-tree sheet plus
FA21–SP26 pairing sheets). Each file is in the admin importer's JSON shape and
imports with zero warnings. `src/lib/aceFamilyImport.test.ts` enforces that,
plus the exact member, link and root counts below.

| File | Fam | People | Big → little links | Roots | Confirmed / inferred links |
|---|---|---|---|---|---|
| `underwater.json` | Underwater | 103 | 91 | 12 | 65 / 26 |
| `down.json` | Down | 138 | 133 | 5 | 119 / 14 |
| `moon.json` | Moon | 28 | 23 | 5 | 23 / 0 |
| `bang-mi.json` | Bang Mi | 53 | 50 | 3 | 42 / 8 |
| `nsf.json` | NSF | 144 | 132 | 12 | 105 / 27 |
| `cross.json` | Cross | 82 | 71 | 11 | 57 / 14 |
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

## Source gaps

These sources were not readable when the workbook was built, so pairings
recorded only there are missing: Spring 2022, Fall 2023 and Spring 2024 ACE
responses, and the SP25 official pairings. Nothing earlier than the legacy
family-tree sheet was found.
