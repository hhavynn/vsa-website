# Automatic House placement (Google Forms, first-come, first-served)

Admin → Houses → House Assignments → Sheet Format → **Google Forms — Auto Placement**.

This mode turns the House application form's response sheet into a **private draft batch**. The draft then goes through the existing Review → Preflight → Lock → Reveal workflow ([house-intern-operations.md](house-intern-operations.md)). Nothing becomes public, and no `house_memberships` row is written, until an admin locks the draft and confirms the reveal.

## Policy

**Submission time first, then ranked preferences, within available capacity.**

1. Repeat submissions (same normalized email) keep the **earliest** one. Later ones are ignored and listed, including whether their rankings differ.
2. Applicants are sorted by submission time. Exact ties go to the earlier sheet row, then to a stable id.
3. Each applicant is processed once, in that order, and takes their highest-ranked House that still has room.
4. An earlier applicant is never displaced to improve a later applicant's result or the overall satisfaction score.

There is no lottery, randomness, scoring, personality matching or AI. The same file and capacities always produce the same result. Each row records an explanation built from allocator state, for example *"Assigned to Pinkie Pie (2nd choice). Rarity was full when this applicant was processed."*

Code: `src/lib/housePlacement.ts` (allocator, pure), `src/lib/housePlacementImport.ts` (strict CSV parsing and validation, pure). `suggestBalancing()` is not used: it is a size-based suggestion helper for manual drafts and is hidden for automatic batches.

## Steps

1. **Upload.** In the responses sheet: File → Download → Comma-separated values (.csv). Pick the academic year and effective start date, then upload the file and click **Validate Applications**. The file is read in the browser. It is never uploaded or published, and the sheet does not need to be public.
2. **Review problems.** The counts show submissions, unique applicants, repeat submissions, rows that need a fix, missing timestamps, exclusions and valid applicants. Every blocking row lists the reason, for example a House ranked twice, a blank choice, two Houses in one field, an unknown or inactive House, or a missing or invalid timestamp. Fix the ranking with the four dropdowns, or exclude the row with a written reason. Nothing is repaired or reordered automatically. A fixed ranking keeps the applicant's original place in line. Rows without an email need **Separate applicant** confirmed, because a repeat submission can't be ruled out.
3. **Capacities.** The default is an equal split. With N applicants and H Houses, each House gets ⌊N/H⌋ spots, and the N mod H extra spots go to the Houses with the most valid first-choice demand. Ties go by display order, then id. For example, 155 applicants over 4 Houses gives 39/39/39/38. Capacities can be edited, but the total must equal the number of included applicants. **Reset to Equal Split** restores the default.
4. **Generate Placements.** This only builds a preview, with summary cards, capacity bars and a filterable table showing priority, submission time, choices, assigned House, achieved rank and member match. Generating writes nothing.
5. **Save Private Placement Draft.** This creates one draft batch and opens it in the draft editor. Double-clicking does not create a second draft. If the save fails partway, the half-saved batch is removed and nothing is retried automatically.
6. **Review, lock, reveal** in the editor, as for any other draft.

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

The member directory is loaded in pages (`memberLookupRepository.listHouseImportMembers()`), so directories with more than 1,000 members are matched completely. The same loader now feeds the existing Admin → Houses import and Legacy Backfill.

An unmatched applicant still holds their House spot in the draft. For an automatic batch, **every applicant must be linked to a member before the draft can be locked or revealed**, because skipping people at reveal would break the balanced allocation. Manual imports keep their old behavior: unmatched rows are skipped at reveal.

## Draft editor for automatic batches

- Each row shows its priority number, submission time, sheet row, ranked choices, achieved rank, and whether it was **Automatically assigned** or **Manually overridden**.
- Bulk House assignment, clearing a House, adding or removing rows, and the Balance Helper are hidden, so House counts can't drift from the configured capacities.
- **Override…** moves an applicant only while the draft is unlocked. It requires a reason and shows the old and new House and rank. A move into a full House is rejected unless you pick someone in that House to swap with. When a change breaks first-come, first-served, a warning says so. The allocator's original House stays in `generated_house_profile_id`, the reason goes in `override_reason`, and each change is written to the admin activity log. **Restore automatic** puts a row back in its original House when there is room.
- Exports: the full roster, one House's roster, and a review list (unmatched, review and overridden rows). They are CSV downloads to your device only. They contain the name, assigned House, submission time (Pacific), priority, ranked choices, achieved rank, placement type, override reason and match status. They never contain email, phone or other form answers, and cells are protected against spreadsheet formula injection.

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

The existing tables are reused, with no new table. Migration `supabase/migrations/20261026180000_house_assignment_timestamp_placement.sql` only adds columns:

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

1. Apply the migration manually after staging verification (see `supabase/migrations/MIGRATION_CHECKLIST.md`). **It has not been applied to production.**
2. Deploy the frontend.

If the frontend ships first, manual imports keep working because they never send the new columns. Saving an automatic placement fails cleanly at the batch insert, before any row is written.

**Known limitation:** the stricter automatic-batch checks live in the frontend (`buildBatchPreflight`, re-run by `lockBatch`/`publishBatch` against freshly loaded rows). The database enforces admin-only access and draft-only edits, but not those placement rules. If the frontend were rolled back to a version without this feature while a `timestamp_ranked` draft exists, that old version would treat the draft as a manual batch and skip unmatched rows at reveal. Don't lock or reveal automatic drafts from an older frontend.
