# ACE annual recap: pairings → reviewed trees → recap video

How the ACE Chair goes from the official Big/Little pairing sheet to a private
preview of the expanded family trees and a rendered recap video, and what has
to happen before anything goes public.

**Nothing in this workflow writes to Supabase, publishes ACE nodes, deploys, or
uploads anything.** Real pairings, previews and videos stay in a private folder
outside every git repository. The scripts refuse to write inside a git work
tree.

## Pieces

| Piece | Where | What it does |
|---|---|---|
| Sheet parser | `src/lib/aceRecap/officialPairings.ts` | Reads only the `BIGS` / `LITTLES` columns (`"A + B + C"`), checks `TOTAL` footers, flags co-Bigs, duplicate Littles and anyone who is both a Big and a Little. Rejection columns are never read as candidates. Diffs two exports. |
| Big resolution | `src/lib/aceRecap/bigResolution.ts` | Matches each Big to an existing **published** ACE node: exact name, or a middle-name/initial variant ("Rowan Q Vale" ↔ "Rowan Vale"). Never picks between two candidates, never invents a node. |
| Snapshot builder | `src/lib/aceRecap/recapSnapshot.ts` | Turns resolved pairings into in-memory `draft:` nodes through the same `buildBranchPreview()` the admin Assignments workspace uses, and lays every family out with `layoutTree()`. Produces one review record per Little (the private review snapshot) and, via `toRecapPresentation()`, a presentation-only copy with no review records, candidates, evidence or source revision for the video and player. |
| Timeline | `src/lib/aceRecap/recapTimeline.ts` | Scene plan: hook → hero family → one scene for **every** other growing family → finale. Durations scale with lineage depth and Littles; scenes overlap for transitions; family treatments (`sweep` / `dive` / `rise` / `portrait`) are chosen from each family's real growth and never repeat back to back. |
| Stage | `src/components/features/ace/recap/RecapStage.tsx` | A compositor and a pure function of the frame number: it renders the outgoing scene under the incoming one during an entrance and reveals it through a match, iris or thread-wipe transition. Rendered by Remotion into the MP4 and by `AceRecapPlayer` in the browser. |
| Motion grammar | `src/components/features/ace/recap/motion/` | `easing.ts` (easings, keyframed camera with per-segment easing and holds, drift), `thread.ts` + `ThreadPath.tsx` (the thread: sampled from real edges, partial draw with a moving head, morph into underlines), `Kinetic.tsx` (per-letter/word kinetic type with masks, stagger, tracking, jitter, exits; rolling counters; dashed annotation frames), `Texture.tsx` (night sky with parallax planes, rice paper, grain, vignette). |
| Scenes | `src/components/features/ace/recap/scenes/` | `Hook`, `Hero`, `FamilyMoment` (four treatments), `Finale` (responsive grid for any number of families), `shared` (titles, metrics, callouts). |
| Website components | `src/components/features/ace/recap/` | `AceAnnualRecap` (year tabs + player + per-family text), `AceRecapPlayer`, `AceRecapFamilySequence`, `AceRecapPreview` (private review tool). **None are routed.** |
| Scripts | `scripts/ace-recap/` | `fetch-published-snapshot.ts`, `build-snapshot.ts`, `build-preview.ts`, `make-synthetic-fixture.ts`. |
| Video project | `tools/ace-recap-video/` | Separate Remotion project with its own `package.json`. Not installed by the website build, never in the site bundle. |

## Review rules (why a pairing is held)

A Little is attached in the preview only when its Big resolves to exactly one
node in an active family. Everything else goes to the review queue:

| Status / warning | Meaning | Chair action |
|---|---|---|
| `ambiguous` | Several nodes match (same or different fams) | Name the exact node id |
| `not_found` | No published node has the name or a variant | Find the Big (nickname? not yet on the tree?) — never create one to make it fit |
| `co_big` | The row lists two Bigs | Pick the one Big node |
| `archived_family` | Only match is in a `(Dead)` fam | Confirm identity; archived fams take no new Littles |
| `stale_candidate` | Only match is a legacy (pre-FA21) import row | Likely a namesake; confirm |
| `generation_outlier` | Big node is more than 4 generations above the family's newest generation | Likely an earlier namesake; confirm the node. Tree position only — no year is inferred |
| `rejected_name_match` | Exact name also appears in a rejection section | **Warning only.** The accepted sheet is authoritative; rejection sections are other people/roles, so a namesake never drops an accepted pairing. Confirm identity |
| `rejected_namesake` | A middle-initial variant is on a rejection list | Warning only; confirm different person |
| `little_already_on_tree` / `duplicate_little` | Would duplicate a node | Blocked |

"Middle-name variant" matches and Bigs with no verified member link are
previewed but flagged. A preview is not approval: `approvedForPublication`
is true only for pairings listed in the Chair's approvals file.

## Yearly runbook

Use a private folder outside every repo, for example
`~/Documents/vsa-ace-recap-private-2027/`.

1. **Export the official pairing sheet** (the `Pairings` tab only) as CSV, or
   save its rows as JSON `{ "rows": [[…]], "sourceLabel", "revisionId",
   "retrievedAt" }`. Record which version is authoritative.
2. **Copy the published tree** (public views, anon key only):
   ```bash
   REACT_APP_SUPABASE_URL=… REACT_APP_SUPABASE_ANON_KEY=… \
     npm run ace:recap:fetch -- --out ~/vsa-ace-private-2027/snapshot
   ```
3. **Reconcile and build the snapshot:**
   ```bash
   npm run ace:recap:snapshot -- \
     --pairings ~/vsa-ace-private-2027/pairings.csv \
     --published ~/vsa-ace-private-2027/snapshot \
     --out ~/vsa-ace-private-2027/reconciliation \
     --cycle "Fall 2027" --year 2027 \
     [--compare older-export.csv] [--approvals approvals.json]
   ```
   Read `summary.md` and `review.csv`. Every Little appears exactly once.
4. **Open the private preview** and review family by family (Before/After,
   review queue, recap):
   ```bash
   npm run ace:recap:preview -- \
     --snapshot ~/vsa-ace-private-2027/reconciliation/recap-snapshot.json \
     --out ~/vsa-ace-private-2027/preview
   ```
   Open `preview/index.html` in a browser (or `python3 -m http.server --bind 127.0.0.1`
   in that folder). It is one self-contained file; nothing is served publicly.
5. **Chair resolves the queue and approves.** Record approvals as
   `[{ "littleName": "…", "bigNodeId": "<ace_family_members.id>" }]` and rerun
   step 3 with `--approvals`. An approval resolves a held pairing (ambiguous,
   not found, co-Big, legacy-only or generation outlier) to exactly that node,
   but never overrides the hard checks: the node must be published in an
   active fam, and rejected names, duplicate Littles and Littles already on the
   tree stay blocked (`approval_node_invalid` marks a bad node id).
6. **Publish the tree through the existing process** — Admin → ACE →
   Assignments (draft → lock → preflight → Publish). The recap tooling never
   writes ACE nodes. See [ace-assignments.md](ace-assignments.md).
7. **Regenerate the snapshot from the now-published tree** (steps 2–3). New
   Littles now exist as real nodes, so for the public recap, build the
   snapshot that compares the pre-publish and post-publish trees (see
   "Before public release").
8. **Render the video** (local only):
   ```bash
   cd tools/ace-recap-video && npm ci
   npx remotion browser ensure     # one-time Chrome Headless Shell download
   npx remotion render src/index.ts AceRecap ~/vsa-ace-private-2027/ACE-Recap.mp4 \
     --props=~/vsa-ace-private-2027/reconciliation/recap-video-props.json
   ```
   1920×1080, 30 fps, H.264 (`remotion.config.ts`). Silent by design — add
   only original or properly licensed audio.
9. **An authorized admin decides when to release** the recap (step below).

## Before public release (not done yet)

- Every pairing in the snapshot is Chair-approved and published through Publish.
- A snapshot built from the published tree with `visibility` set to
  `"published"` (today the builder always emits `"private-preview"`; adding a
  `--release` flag that refuses unless every record is approved is the next
  step). `RecapStage` shows the "Private preview" banner and
  `AceAnnualRecap` renders nothing in production for a private snapshot.
- Decide hosting for the MP4 (static asset or storage) and route
  `AceAnnualRecap` on `/ace` behind an admin-controlled switch.
- Re-render the video from the published snapshot (no watermark).
- Remotion license: free for individuals, companies with up to 3 employees and
  non-profit/not-for-profit organizations (see the Remotion `LICENSE.md`).
  A student org very likely qualifies; confirm before public use.

## Motion language (V2)

The recurring object is **the thread**: the line that connects a Big to a
Little. It draws itself along real ancestry, carries a moving highlight,
pulls the camera, peels off into an underline under a Big's name, splits into
new branches, and leads the thread-wipe transitions. Wherever it represents
relationships it is built from the real edge geometry (`lineagePoly`,
`edge.poly`); decorative uses (the hook's ink line, wipes, the finale fork)
never touch tree data.

| Scene | What happens | Data it uses |
|---|---|---|
| Hook (~7 s) | Ink kinetic type on rice paper (ONE BIG / ONE LITTLE / ONE MORE BRANCH) falls into a line that forks; the paper irises down onto the Big dot; night title with the line as its underline | Cycle label only |
| Hero (14–20 s) | The underline morphs into the root edge; the camera chases the thread along the real lineage to the Big (whip through early generations, soft landing), name set large in an annotation frame, last edge morphs into its underline, new branches grow to each Little; the rest of the family blooms as a ripple while the camera pulls out to a dot-level view with callouts and metrics | Hero family, its Big with the most new Littles (then longest lineage) |
| Family moments (5–7 s each) | `sweep` pans the newest generation, blooming as the camera passes; `dive` whips from the root down the lineage; `rise` starts on the new Littles and climbs to the root; `portrait` (≤ 2 Littles) sets the Big and Little on paper, then irises into the real tree | Each growing family |
| Finale (~9–12 s) | Every active family as its own silhouette (separate cells, never cross-linked), then the count, total names, and "Welcome to the family." | All active families; totals |

At camera scales below `LOD_SCALE` the tree switches to a dot form with
callouts for its biggest new branches instead of unreadable labels.

**Privacy:** a `private-preview` presentation always shows the banner;
passing `null` or an empty watermark cannot remove it. The Remotion root
refuses a full review snapshot and accepts only `recap-video-props.json`.
The private preview HTML inlines the fonts and sets a CSP that blocks every
network request.

## Rendering notes

- On some macOS setups Chrome Headless Shell never fires
  `requestAnimationFrame`, which stalls Remotion at "Waiting for root
  component to load". `tools/ace-recap-video/src/rafFallback.ts` races rAF
  against a 50 ms timer in headless renders only.
- `npm run studio` in `tools/ace-recap-video` opens Remotion Studio with the
  fictional fixture (`npm run ace:recap:fixture` regenerates it).
- The video bundle imports the shared stage from `../../src`; its webpack
  config aliases `react` to the video project's copy.
