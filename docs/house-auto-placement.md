# Automatic House placement (Google Forms, first-come, first-served)

Admin → Houses → House Assignments → **Import House Applications**. This is the default, primary workflow for every year: there is no format to choose.

It turns the House application form's response sheet into a **private draft batch**. The draft then goes through the existing Review → Preflight → Lock → Reveal workflow ([house-intern-operations.md](house-intern-operations.md)). Nothing becomes public, and no `house_memberships` row is written, until an admin locks the draft and confirms the reveal.

## Policy

**Submission time first, then ranked preferences, within available capacity.**

1. Repeat submissions (same normalized email) keep the **earliest** one. Later ones are ignored and listed, including whether their rankings differ.
2. Applicants are sorted by submission time. Exact ties go to the earlier sheet row, then to a stable id.
3. Each applicant is processed once, in that order, and takes their highest-ranked House that still has room.
4. An earlier applicant is never displaced to improve a later applicant's result or the overall satisfaction score.

There is no lottery, randomness, scoring, personality matching or AI. The same file and capacities always produce the same result. Each row records an explanation built from allocator state, for example *"Assigned to Pinkie Pie (2nd choice). Rarity was full when this applicant was processed."*

Code: `src/lib/housePlacement.ts` (allocator, pure), `src/lib/housePlacementImport.ts` (strict CSV parsing and validation, pure). `suggestBalancing()` is not used: it is a size-based suggestion helper for manual drafts and is hidden for automatic batches.

## Steps

1. **Upload.** In the responses sheet: File → Download → Comma-separated values (.csv). In the **Import House Applications** card, pick the academic year and effective start date (and optionally a draft label), then upload the file and click **Validate Applications**. The file is read in the browser. It is never uploaded or published, and the sheet does not need to be public.
2. **Review problems.** The counts show submissions, unique applicants, repeat submissions, rows that need a fix, missing timestamps, exclusions and valid applicants. Every blocking row lists the reason, for example a House ranked twice, a blank choice, two Houses in one field, an unknown or inactive House, or a missing or invalid timestamp. Fix the ranking with the four dropdowns, or exclude the row with a written reason. Nothing is repaired or reordered automatically. A fixed ranking keeps the applicant's original place in line. Rows without an email need **Separate applicant** confirmed, because a repeat submission can't be ruled out.
3. **Capacities.** The default is an equal split. With N applicants and H Houses, each House gets ⌊N/H⌋ spots, and the N mod H extra spots go to the Houses with the most valid first-choice demand. Ties go by display order, then id. For example, 155 applicants over 4 Houses gives 39/39/39/38. Capacities can be edited, but the total must equal the number of included applicants. **Reset to Equal Split** restores the default.
4. **Generate Placements.** This only builds a preview, with summary cards, capacity bars and a filterable table showing priority, submission time, choices, assigned House, achieved rank and member match. Generating writes nothing.
   The preview can already be exported for Google Sheets (see [Exports](#exports-for-google-sheets)); preview files are named `…-preview-…` and carry no draft row IDs.
5. **Save Private Placement Draft.** This creates one draft batch and opens it in the draft editor. Double-clicking does not create a second draft. If the save fails partway, the half-saved batch is removed and nothing is retried automatically.
6. **Review, lock, reveal** in the editor, as for any other draft.

**Saved drafts** sit next to the upload card, for the year chosen there. Each one says **Automatic placement** or **Manual import** and its status, and opens in the draft editor. To reach an earlier year's drafts (for example the 2025–2026 Super Mario batches), choose that year in the same card. Opening, reviewing and managing historical and manual batches works as before; nothing about them was removed.

## Historical / Advanced Import (legacy formats)

The older **wide** (one column per House) and **long** (`name,email,house`) sheet importers are kept, collapsed at the bottom of the page under **Historical / Advanced Import**. They exist only to re-import a sort that was already decided by hand, such as an earlier year's sheet or a manual correction. They **do not** use timestamp-priority placement: no submission order, no capacities and none of the automatic-batch checks below; each person's House is imported as written, and the batch is saved as `assignment_method = 'manual'`. The optional public CSV URL loader lives only there. Nothing defaults to these formats for any year. The parsing code (`src/lib/houseAssignmentImport.ts`) and every saved batch are unchanged.

## Houses

Choices are matched to the selected year's **active** `house_page_assets` rows by House key, display name, or display name with a trailing parenthetical removed (for example "Rarity (Kirsten & Jonas)" becomes Rarity). A parenthetical is stripped only when the rest matches exactly one House. When the name itself doesn't match, the parenthetical's House Parent names can identify the House. The 2026 form spells "Pinky Pie (Ingyin & Martin)", and Ingyin and Martin are Pinkie Pie's House Parents in `house_parents`, so it resolves to **Pinkie Pie**. Every name listed must be a House Parent (full name, first name or nickname) of exactly one active House. A name and House Parents that point at different Houses count as ambiguous. Options recognized this way are listed under **Recognized by House Parent names** with a House select, so you can correct them. An option that matches no House or several Houses is listed under **Unrecognized House options** and must be mapped by hand. Mapped options stay in their list so the mapping can be changed. If the year has no active Houses, the page blocks and points to Profiles & Images. Houses are never created, and another year's Houses are never used. `src/constants/houses.ts` is not involved.

## Form format

The 2026 form's headers are recognized as they are: `Timestamp`, `Name (First, Middle Initial, Last)`, `Email`, and `House Rank [First Choice ]` through `House Rank [Forth Choice ]` (with the form's misspelling). Conventional headers such as `First choice`, `Fourth Choice` and `Preference 2` work too. When a column is missing or ambiguous (for example two email columns), the page asks you to choose it.

Timestamps are parsed explicitly as `M/D/YYYY HH:MM:SS` (optionally with AM/PM) or `YYYY-MM-DD HH:MM:SS`, in **America/Los_Angeles**, the sheet's time zone. They are stored as the UTC instant (`submission_timestamp`, timestamptz). Invalid dates and times that don't exist (the spring-forward gap) are flagged and never guessed.

**Daylight-saving rollback:** a CSV timestamp has no UTC offset, so a time in the hour that repeats when clocks fall back (for example 1:30 AM on 11/1/2026) could be either occurrence. Such a row **blocks placement** until an admin picks *First (PDT)* or *Second (PST)* for it. The sheet row order around it shows which one: Forms appends rows in submission order, so a time that goes backwards marks the switch. The chosen instant sets the row's priority.

## Members

Placement uses form applicants. Linking to canonical `members` happens afterwards and **never changes anyone's place in line**:

- A unique exact normalized email is a match.
- Otherwise, a unique exact normalized name is a match. It goes to review instead if that member record has a different email.
- A name that matches only once the middle initial is ignored is sent to review.
- Several candidates, or none, are sent to review or left unmatched. Nothing is guessed, there is no fuzzy matching, and no member is created.
- **Confirmed alternate emails** from `member_identity_emails` (admin-only; every row is a confirmed address, and an address belongs to at most one member) count like a member's main email. An applicant whose form email is a unique member's alias is a match ("Matched by a confirmed alternate email."). If the address is one member's main email and another member's alias, it goes to review; nothing is picked. Aliases whose member is not in the directory are ignored. If the alias table can't be loaded, the page says so and matches on main emails only.

The member directory is loaded in pages (`memberLookupRepository.listHouseImportMembers()`), so directories with more than 1,000 members are matched completely. The same loader now feeds the existing Admin → Houses import and Legacy Backfill.

An unmatched applicant still holds their House spot in the draft. For an automatic batch, **every applicant must be linked to a member before the draft can be locked or revealed**, because skipping people at reveal would break the balanced allocation. Manual imports keep their old behavior: unmatched rows are skipped at reveal.

## Draft editor for automatic batches

- Each row shows its priority number, submission time, sheet row, ranked choices, achieved rank, and whether it was **Automatically assigned** or **Manually overridden**.
- Bulk House assignment, clearing a House, adding or removing rows, and the Balance Helper are hidden, so House counts can't drift from the configured capacities.
- **Override…** moves an applicant only while the draft is unlocked. It requires a reason and shows the old and new House and rank. A move into a full House is rejected unless you pick someone in that House to swap with. When a change breaks first-come, first-served, a warning says so. The allocator's original House stays in `generated_house_profile_id`, the reason goes in `override_reason`, and each change is written to the admin activity log. **Restore automatic** puts a row back in its original House when there is room.
- **Atomic moves and swaps.** Both rows of a swap change in one database transaction through `admin_apply_house_placement_override` (migration `20261027120000_house_placement_override_rpc.sql`): either every row changes or none does, and the function re-checks draft status, the batch's capacities and the reason rule server-side. If the call fails for any reason, the editor reloads the saved rows and the message says so ("…The rows were reloaded from the saved draft."), so a half-applied swap is never shown. **Until that migration is applied**, a single move still works (one row update is atomic on its own) but a swap is refused with a message naming the migration; nothing is changed.
- **Export for Google Sheets** is on the saved draft too, built from the rows as they are now (overrides and member links included). See below.

## Exports for Google Sheets

Code: `src/lib/housePlacementExport.ts` (pure CSV builders) and `HousePlacementExportPanel`, shared by the unsaved preview and the saved draft.

| Export | File name | Rows |
|---|---|---|
| Full roster | `vsa-house-placement-2026-2027-full-roster.csv` | every placed applicant |
| One per active House | `vsa-house-placement-2026-2027-<house>-roster.csv` (e.g. `pinkie-pie`) | that House's applicants |
| Needs review | `vsa-house-placement-2026-2027-needs-review.csv` | unmatched or review member links, manual overrides, missing House, House outside the ranking; in the unsaved preview also rankings an admin corrected |

Preview files add `-preview-` after the year. Rows are always in **priority** (first-come, first-served) order, not alphabetical; sort or filter in Sheets as you like.

Columns: Priority, Sheet row, Applicant name (as typed in the form), Linked member, Submitted (Pacific), Submitted (UTC ISO), 1st–4th choice, Generated House, Assigned House, Achieved rank, Placement (Automatic / Manual override), Override reason, Member match (Matched / Needs review / Unmatched), Needs review (Yes/No), Review reason, Draft row ID (blank in a preview).

**Never included:** email, phone, birthday, allergies, or any other form answer, and no draft notes. Every cell is quoted per RFC 4180, and a cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return (after leading spaces) is prefixed with `'` so Sheets shows it as text instead of running it.

**Open in Google Sheets:** download the file, then in Google Sheets choose **File → Import → Upload**, pick the CSV, and choose *Insert new sheet* or *Replace spreadsheet* (or open the file from Google Drive). No Google sign-in or integration is involved; the download never leaves your device until you upload it.

**An edited sheet is not a change to the draft.** Exports are read-only copies, and nothing reads a CSV back into the draft. Make changes in the draft editor (Override…), which enforces reasons, capacity and priority checks and logs each change.

### Possible follow-up: reviewed write-back (not built)

If importing edits from a sheet is ever wanted, it should be a separate, explicit feature, never a generic overwrite:

1. Match rows only by the stable **Draft row ID** (never by name or position) and only for the same batch, still in `draft` status.
2. Accept only the **Assigned House** and **Override reason** columns; ignore every other cell.
3. Show a preview of every change (old → new House, achieved rank, priority warning) before anything is written, and require a reason for each row that leaves its generated House.
4. Apply all accepted changes in one transaction that re-checks capacities, draft status and reasons (an extension of `admin_apply_house_placement_override`), and log each change.
5. Never lock or publish as part of the import.

### Stricter preflight (automatic batches only)

These checks run in the browser and again against freshly loaded database rows in `lockBatch()` and `publishBatch()`. Each one blocks locking and revealing:

- An applicant is not linked to a confirmed member, or two applicants are linked to the same member.
- An applicant is missing a House, or has a House that is not an active profile for this year.
- The saved capacities don't match the year's active Houses, don't add up to the number of applicants, or a House is over or under its capacity.
- Ranked preferences are missing or malformed.
- Submission priority metadata (timestamp, sheet row, order, original placement) is missing or out of order.
- A row was moved without a recorded override reason.
- A dated membership interval conflicts (the existing check).

An override that breaks timestamp priority is shown as a warning, because it is allowed as an explicit, documented human decision. The legacy preflight rules are unchanged.

## Data stored

The existing tables are reused, with no new table. Migration `supabase/migrations/20261026230757_house_assignment_timestamp_placement.sql` only adds columns:

| Table | Column | Meaning |
|---|---|---|
| `house_assignment_batches` | `assignment_method` | `manual` (default) or `timestamp_ranked` |
| | `capacity_config` | `{ house_page_assets.id: capacity }` |
| | `excluded_applicants` | `[{ source_row_number, name, reason }]`: rows left out by an admin, plus ignored repeat submissions |
| `house_assignment_drafts` | `submission_timestamp` | original submission instant (UTC) |
| | `source_row_number` | 1-based sheet row |
| | `generated_house_profile_id` | the allocator's House |
| | `override_reason` | why an admin moved the row |

For automatic rows, `source_order` holds the priority order, `preferences` holds the ranked House profile UUIDs, and `notes` holds the placement explanation. No email, phone number, birthday, allergy, hobby or other form answer is stored or logged. The admin-only RLS and draft-only edit guards from `20261001213414` cover the new columns unchanged.

## Deploying

1. Apply the migration manually after staging verification (see `supabase/migrations/MIGRATION_CHECKLIST.md`). Applied to production 2026-10-26 as version `20261026230757`.
2. Deploy the frontend.

**Override RPC (`20261027120000_house_placement_override_rpc.sql`) — not yet applied; needs owner approval.** It adds one function and nothing else: SECURITY INVOKER (admin-only RLS and the draft-only guard trigger still apply), `search_path = ''`, its own `is_admin_user(auth.uid())` check, EXECUTE revoked from `public`/`anon` and granted to `authenticated`. It updates only `house_assignment_drafts.house_profile_id` / `override_reason`; it never touches `house_memberships`, members, points, attendance or leaderboard views. It was exercised on a throwaway local Postgres 16 with synthetic rows (swap, over-capacity rollback, a second change failing after the first, reason rule, restore to generated House, other batch's row, locked and manual batches, non-admin and anon callers). Order: apply it, then rename the file to the recorded version if it differs (vsa-run-and-operate §3). The frontend can ship before or after it: before, swaps are refused with a clear message and single moves still work.

If the frontend ships first, manual imports keep working because they never send the new columns. Saving an automatic placement fails cleanly at the batch insert, before any row is written.

**Known limitation:** the stricter automatic-batch checks live in the frontend (`buildBatchPreflight`, re-run by `lockBatch`/`publishBatch` against freshly loaded rows). The database enforces admin-only access and draft-only edits, but not those placement rules. If the frontend were rolled back to a version without this feature while a `timestamp_ranked` draft exists, that old version would treat the draft as a manual batch and skip unmatched rows at reveal. Don't lock or reveal automatic drafts from an older frontend.
