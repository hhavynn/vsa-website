# VSA Wrapped / Year in Review (`/wrapped`)

Public, logged-out-accessible Spotify-Wrapped-style recap of the 2025–2026
VSA year. Scrapbook-styled chapters: hero, year-by-the-numbers, signature
events, House Cup, photo wall, culture-night highlights, community recap
awards, thank-you, and a closing CTA.

## Data rules (privacy, #692)

The current public Wrapped recap is editorial and contains **no House scoring
totals, ranks, winners or scored activity**. House competition results are
embargoed until the CRC's official GBM announcement workflow approves release.
A database-level view restriction applies to historical years too.
The older dynamic House Cup prototype and its former public `house_yearly_points`
read path must not be mounted on a public route.

| Section | Source | Notes |
| --- | --- | --- |
| Events hosted | `eventsRepository.getEvents` (published, 2025-07-01→2026-06-30) | count only |
| House competition | Curated non-scoring House community copy | No individual or House totals, ranks, winners or scored activity in the public bundle |
| Photo wall | `galleryRepository.getAlbums` | approved public album covers only |
| VCN | `vcnArchivesRepository.getPublishedArchives` | published archives only |
| Cabinet theme | `cabinetYearsRepository.getYears` | label + theme_name |

It deliberately never calls member-level APIs (`getYearlyLeaderboard`,
`getAllTimeLeaderboard`, `getHouseMemberRankings`, attendance rows). No
individual attendance, point histories, rosters, emails, check-in codes, or
admin/import notes are queried or rendered. When an aggregate query fails,
sections fall back to curated copy from `src/data/wrapped2026.ts` — never
fake numbers.

## Curated vs. dynamic

Editorial content (year vibe, fun awards, signature-event blurbs, WNC
highlight, thank-you copy) lives in `src/data/wrapped2026.ts` and is labeled
on-page as a community recap ("editorial, not analytics"). Any future dynamic content must use an approved public read
contract; the previous public House-score view is no longer permitted.

## Future version (not built in this MVP)

An admin generator could produce a Wrapped per year:

1. Admin selects an academic year.
2. Admin picks approved events/photos.
3. System computes private aggregate stats in an approved admin-only context; House scores can only be published via an independently reviewed release policy.
4. Admin edits fun awards/copy in a form (replacing the per-year config file).
5. Preview → publish (e.g. `/wrapped/2026-2027`).

Keeping curated content in one typed per-year config keeps that migration
straightforward: the config shape (`Wrapped2026Config`) is the draft schema
for that future `wrapped_pages` table.
