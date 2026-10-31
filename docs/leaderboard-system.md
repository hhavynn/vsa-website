# Yearly Leaderboard System

This document describes the yearly leaderboard system implemented in May 2026.

## One active points and attendance model

Owner decision dated 2026-10-02: member accounts and code-based check-in are
formally retired (#233). This is not a temporary pause or a points-system merge.
See [the retirement decision and rollout](./member-account-retirement.md).

| Concern | Active model |
|---|---|
| Identity | `members.id`, independent of Supabase Auth |
| Ledger | `member_event_attendance`, one member/event pair with `points_earned` |
| Writers | CSV/Google Form import, Admin Members attendance editor, `smart_merge_members`, Historical Recovery (`admin_recover_import_row`) |
| Recalculation | Statement triggers `trg_sync_member_points_{insert,update,delete}` → `recalculate_members_points` (locks members, then recalculates); `trg_attendance_points_from_event` stores the event's current points; event edits use `sync_attendance_points_on_event_update` |
| Readers | `/points`, `/leaderboard`, House standings, member cards/history, Wrapped, Admin Points |
| Public projections | `member_yearly_points`, `member_event_history`, `public_members`; published House identity is a *single-member* badge RPC (never House scores) |
| Authentication | Existing/invited approved admins only; students use public lookup without accounts |

The legacy `event_attendance`, `user_points`, and code-storage tables remain
private archives for retention and data-rights dependencies. The retirement
migration removes client access and legacy execution grants and unregisters
code-generation/account-points triggers. No current point calculation reads them.
Do not write or transfer archive totals into the member ledger.

`pointsModelBoundary.test.ts` exercises every leaderboard repository method and
guards against archive/RPC dependencies. `memberAccountRetirement.test.ts` guards
the application against restoring obsolete APIs, components, hooks, or providers.

## House scoring privacy / GBM-only announcements (#692)

The House competition remains computed by the **unchanged** source-of-truth
attendance ledger, effective-dated House memberships and authoritative House
views. However, House-wide and member House-contribution scores, ranks, recent
scored activity, winners and all-time standings are **not public**, including
older school years. The previous published 2025–26 numeric fallbacks and
public override constants are intentionally removed from browser JavaScript.

The five private views `house_yearly_points`,
`house_all_time_points`, `house_recent_activity`,
`house_member_yearly_points`, and `house_member_all_time_points`
have anonymous/ordinary-authenticated SELECT privileges revoked by migration
`20261028073000_embargo_public_house_scores.sql`. Approved admins can obtain
live aggregate scores through a permission-checked
`admin_private_house_standings(p_year)` RPC after the migration is deployed.
This RPC is **not** an automatic public snapshot or House Parent grant.
The `public_member_house_badge` RPC exposes just one approved published
House identity, gated on Reveal, not a House point value or member ranking.
The ordinary individual points leaderboard remains unchanged.

All House competition official standings are announced at GBMs by authorized
House leadership; the reviewed, private GBM snapshot/export lifecycle is
separate issue #693. **No public online standings for any year** until explicit
cabinet approval and a separately reviewed release path.

See [the release and privacy checklist](./house-standings-embargo.md). A PR
containing this migration is not evidence that it was applied in staging or
production. Real API/RLS and inference review must pass before merge and rollout.

## Overview

The VSA website now supports filtering leaderboard points by academic year. This allows for seasonal competitions and better historical tracking of member involvement.

## Data Source

The primary source of truth for the public and admin leaderboards is the `member_event_attendance` table, joined through `events` to `academic_terms`.

### Key Tables & Views

- **`members`**: Stores global/all-time points and events attended (legacy/summary fields).
- **`member_event_attendance`**: Individual records of points earned per event.
- **`events`**: Each event is assigned to an `academic_term_id`.
- **`academic_terms`**: Defines the quarter and academic year (e.g., Fall 2025).
- **`member_yearly_points` (View)**: An aggregate view that calculates totals per member per academic year.

## Calculation Logic

Yearly points are calculated by summing `points_earned` in `member_event_attendance` where the associated event belongs to the selected academic year.

**Important**: Events MUST have an `academic_term_id` assigned to be counted in yearly totals. If an event has no term, its points will only appear in the "All-Time" view.

## Admin Operations

### Attendance Import

When importing attendance via CSV:
- Choose a local `.csv` file or a CSV/Google Sheets URL; both use the same parsing, column mapping, matching, preview, review, and import flow. Local file audit entries use `manual` with no source URL.
- The event dropdown now shows the academic term for each event.
- The file is parsed as RFC 4180 CSV (`src/lib/csvParse.ts`): quoted commas, escaped quotes, multiline answers, a UTF-8 BOM and any line ending are handled, blank rows are dropped, and a repeated header keeps every column ("Email (2)"). Columns are detected from common Google Forms headers (`src/lib/attendanceCsv.ts`) and every mapping, including an optional second email column, can be changed before re-running matching. A file with no mapped name column is refused rather than producing nameless rows.
- Matching reads the complete member roster and the event's complete attendance with keyset pages (`src/data/repos/memberIdentity.ts`). Any failed page blocks the preview and the import; a partial or failed read is never treated as "no members", which would turn existing members into new duplicates. (Before this, the importer and Merge Suggestions read one unpaged request and silently saw at most 1,000 members; production had 1,227 on 2026-10-25.)
- A warning is displayed if the selected event has no term assigned.
- Points are automatically attributed to the correct year based on the event's term.
- **Rollout.** The identity system below is behind `REACT_APP_ATTENDANCE_IDENTITY_V2` (`src/lib/identityRollout.ts`), off by default. While it is off, Admin → Import is the Stage A importer (`src/pages/Admin/LegacyImport.tsx`: complete roster reads and RFC 4180 parsing, the earlier email-then-exact-name matcher, direct writes) and nothing reads the identity tables. To enable: (1) apply `20261026075912_member_identity_aliases.sql` to production (manual path, after `bash scripts/test-member-identity.sh` passes) — **done 2026-10-26**: applied verbatim (sha256 `d334afaa…`) and recorded as `20261026075912`, backfilling 997 aliases and 1,150 year estimates; it works with the current row-level points trigger and with the statement triggers of `20261029021759` (formerly `20261010000000`, applied 2026-10-28), in either order; (2) run `scripts/verify-rls-security.mjs` — the identity checks must pass, not skip; (3) set `REACT_APP_ATTENDANCE_IDENTITY_V2=true` in Vercel (Production) and redeploy; (4) import one small sheet and check Recent Imports. To roll back the frontend, unset the variable and redeploy; the migration can stay. If the flag is on before the migration, the importer refuses to match and says so. The same flag hides the Members editor's "Emails that identify this member" panel and keeps Merge Suggestions and Historical Recovery from reading aliases or years, so with it off those pages behave as they did before the identity change.
- **One identity, many clues.** `members.id` is the person. Email, name, college and standing are evidence (`src/lib/identityResolution.ts`). Confirmed addresses live in the private `member_identity_emails` table (unique per address, so an address names one member); `members.email` stays the preferred contact address, and changing it never removes an alias. Migration `20261026075912_member_identity_aliases.sql` adds the tables, the backfill and the import function.
- **Automatic matches** (no admin needed), each shown with its evidence:
  - *Matched by known email*: a row address confirmed for exactly one member, with the same name (a middle name or a shortened first name allowed) and a standing that does not contradict them. A merely similar name on a known address (An / Anh on a family email) goes to review.
  - *Matched by name + college + year*: the only member with this exact name (accents, case, spacing and middle initials ignored), the same college, and a standing that fits the event's academic year. A different email does not block this, unless both are different `@ucsd.edu` addresses.
  - *Matched by name + college*: the same, when the standing is missing or unrecognized.
  - *Matched by unique exact name*: the only member with this name and nothing on file against it (no other email, college or standing).
  - *Matched by first/last name + college + year*: the only member whose first and last name match with a middle name added or left out, with the same college, a fitting standing and no other email.
- **Review** (Match Existing / Create New Member / Skip / Undo): two or more members with the name, any contradiction (another college, a standing that does not fit, another school email, an address that belongs to someone else or to several members), shortened first names (Alex / Alexander), reordered or merely similar names. Candidates are listed best first with their evidence and never preselected. Spelling closeness only orders suggestions; there is no fuzzy auto-match and no confidence percentage.
- **New member**: nobody credible. If every look-alike is ruled out by college or school email, the row is created (the look-alikes stay listed and can still be matched on purpose).
- **Standing is compared in time** (`src/lib/yearStanding.ts`): `member_year_observations` records the standing reported for an academic year (plus one migration estimate per member). "2nd Year" in 2025-26 fits "3rd Year" in 2026-27; transfers get one extra year of slack; alumni/graduate wording never contradicts. A profile year only advances forward, from an official label, and never from an event older than the member's latest observation, so a backfill never rewinds current standing. Nobody is promoted because time passed.
- **Aliases are only remembered on confirmed evidence**: a name + college + fitting year match, a second address on a row already identified by a known email (never a second school address that contradicts the member's), or an admin's Match Existing ("Remember this email" is on by default only when the names match exactly, opt-in otherwise). Matches by name alone, or name + college, credit the member but remember nothing. Review rows left undecided remember nothing. An address planned for two people in one file is remembered for neither. A member with no contact email gets the row's address as their contact email only on a name + college + year match (the contact email also becomes an alias).
- **Repeats in one file**: the same submission, a second row that resolves to the same member by a known email or by name + college + year (for example once with Gmail and once with UCSD), or the same new person submitted twice count once; the later row's address joins the member. A second row matching the same member by name alone goes to review. Two new rows are one person only when one has no email, or they pair a personal and a school address with the same college and year; two different personal or two different school emails stay separate people. If the first row is skipped, its repeat comes back for a decision instead of disappearing.
- **One atomic write.** Confirming sends the plan to `admin_apply_attendance_import`, which locks the event and members, rechecks the preview (event points and term unchanged; credited members not deleted, merged or edited; the address behind a known-email match still identifies only that member; addresses still free; no member with a new member's name, or with an automatically matched name, that the preview did not see — imports touching one name queue on a name lock, so this also holds across events) and writes new members, attendance, profile fills, the year (only if it is still what the preview saw, and never from an event older than the member's latest observation), aliases and observations in one transaction, or writes nothing and lists what changed. The admin re-runs matching. A retry after a lost response reuses the request id and replays the first result. Attendance inserts ignore existing member/event pairs; database triggers recalculate points.
- The preview summary is the exact write plan: automatic vs. admin-confirmed matches, new members, already recorded, duplicate rows, unresolved, skipped, invalid, profiles whose year will advance, email aliases to add, and email conflicts.
- Audit rows record `manual_decision`, `suggested_member_id`, `match_reason`, the evidence and candidate evidence, and a `final_reason` (`skipped_by_admin`, `skipped_unresolved_review`, `invalid_row_no_name`). `match_method` keeps the `email` / `exact_name` / `fuzzy_name` vocabulary `importHistoryAudit.ts` reads. To recover skipped rows, import the same sheet again.

### Historical Recovery

Admin → Import → Historical Recovery fixes audited import rows one at a time: credit a confirmed existing member, create a separate member, credit the correct member for a wrong match (the original credit is kept and flagged for investigation, never deleted), dismiss, or hold for more information. Every write goes through the `admin_recover_import_row` database function in one transaction. It only inserts attendance, with `ON CONFLICT DO NOTHING`, and leaves recalculation to `trg_sync_member_points`. A confirmed wrong credit is removed in Admin Members, then the finding is resolved. Details: [import-history-audit.md](./import-history-audit.md).

### Member Management

Admins can create a member with first/last name and optional email, year, and college using **Add Member**. House assignment remains on Admin Houses.

Use **History** or **Edit → Manage attendance** to view and edit attendance. Additions read current event points and ignore existing member/event pairs; removal requires confirmation. Database triggers own recalculation; the UI reloads member totals, history, and yearly totals after each mutation. Events need an academic term before attendance can be added.

The member editor lists **Emails that identify this member** (`member_identity_emails`): how each was confirmed, an Add field (an admin's own confirmation) and a two-step Remove for an address remembered for the wrong person. Removing an address never touches attendance or points.

**Merge Suggestions** uses the importer's name folding and evidence (`src/lib/duplicateMembers.ts`): a shared confirmed email, the same name and college (accents, case and middle initials ignored), the same first and last name with a middle name added or left out in one college, or the same name, each with its evidence (different colleges, years that do or do not line up). Similar names are never suggested, and nothing merges without an admin. `smart_merge_members` keeps the target's id, moves attendance without crediting an event twice, moves every email alias (recording where it came from) and year observation, keeps the more recently observed year, moves House history for years the target has none, and repoints import audit rows, photo requests and ACE / Cabinet / workspace links instead of nulling them. Cached totals are recalculated by the triggers. If both records have a House membership in the same year, the source's row is dropped with the source. A merge takes both members' locks first (the same keys imports and Historical Recovery use), so an import crediting either member either finishes first and its credit is moved, or waits and then finds the source gone and writes nothing.

The Member History modal includes:
- A yearly breakdown of points earned.
- The specific academic term for each attended event.

## Future Considerations

- **Auto-Term Assignment**: New events should automatically be assigned to the current active term to ensure data consistency.

### Points integrity and concurrency

`members.points` and `members.events_attended` are a cache of the ledger
(`member_event_attendance`). House and yearly standings are live views over
the ledger and never drift. Migration
`20261029021759_serialize_member_points_recalculation.sql` makes the cache safe
under concurrent writers:

- Every statement that changes attendance recalculates its affected members
  once, from statement-level triggers (old and new owners on update, FK
  cascades included). The recalculation first locks those `members` rows
  `FOR NO KEY UPDATE` in id order, then sums the ledger in a separate statement,
  whose fresh snapshot includes every writer that committed before it.
  Before this, two writers for one member could leave a total that missed the
  other's credit.
- Inserting a credit (or moving it to another event) locks the event row
  `FOR SHARE` and stores the event's current points, so a concurrent points
  edit either lands first or cascades to the new credit.
- Within a statement, members are locked in ascending id, so two imports can
  no longer deadlock on members. Writers for different members never wait for
  each other. The migration header lists each writer's lock order. The deadlocks
  that remain need two multi-step transactions crossing those orders (for
  example, a merge racing a points edit on an event both members attended).
  PostgreSQL detects them and rolls one transaction back whole, so they surface
  as a retryable error, never as wrong totals.
- Rule: a credit is stored at its event's current points, whatever the writer
  sends. The importer, Admin Members and Historical Recovery already send that
  value. `smart_merge_members` copies the source's stored value, so a source
  credit stored off its event's value is stored at the event's value on the
  merged member.
- Rollback: `scripts/sql/points-recalculation-rollback.sql` (one transaction;
  keeps the locking recalculation, restores the row trigger).

Proof is offline: `bash scripts/test-points-concurrency.sh` (production
trigger bodies as the baseline, which must reproduce each race; the fixed
schema, which must pass every round; and mutants with one protection removed,
which must fail). It also runs `scripts/test-attendance-recovery.sh` with the
migration applied.

Read-only check, safe against production: `scripts/sql/points-integrity-check.sql`
reports members whose cached totals differ from the ledger, and credits whose
stored value differs from the event's current points. Never repair a finding by
writing cached totals; fix the ledger and let the triggers recalculate.

### House points reconciliation (read-only, #622)

`scripts/sql/house-points-reconciliation.sql` measures how one academic year's ledger credits reach the House views, and never writes. Run it against production in a read-only transaction (it rolls back):

```bash
psql "$DATABASE_URL" -v year=2026 -f scripts/sql/house-points-reconciliation.sql
```

It prints counts and House names only (no member names, emails or notes). **Expected, not discrepancies:** `credits_member_has_no_house_this_year`, `credits_outside_membership_interval`, `credits_before_house_start` (attendance before a member's effective House start keeps its individual points and earns no House points), `credits_event_without_term_near_year`, `members_transferred_this_year`, `future_dated_memberships`. **Investigate:** `house_member_vs_house_total_mismatch` and `recomputed_vs_view_mismatch` (the two views, or the views and the script's own attribution, disagree), `overlapping_memberships`, `credits_attributed_to_two_houses`, `credits_on_inactive_house_profile`, and `pacific_vs_utc_boundary_credits`.

**In the admin site:** Admin → Houses → **Points check** runs the same measurement through `admin_house_points_reconciliation(year)` (migration `20261028070000`, read-only, admin-only, UTC pinned; **not yet applied**). Each finding explains whether it is expected by rule or needs investigating and links to the page that fixes it. It never changes points.

**Time zone rule.** The views cast each event's instant to a date in the database session's time zone. Production serves them in UTC (server and API roles, checked 2026-10-28), so an event after 4–5 PM Pacific counts as the next calendar day. An evening event the night before a member's effective start date therefore earns that House a point. `pacific_vs_utc_boundary_credits` counts those credits. Changing the rule to Pacific dates would be a protected scoring change needing its own owner-approved PR; this script only reports it.

Offline proof (synthetic people, production view definitions, every category with an exact expected count):

```bash
bash scripts/test-house-points-reconciliation.sh
```

Production baseline (read-only, 2026-10-28): 2025–26 has 2,281 credits and **0** `house_memberships` rows, so the views show no 2025–26 House points and the public 2025–26 standings come from the static public overrides. 2026–27 has no memberships yet (no Reveal). Every House view check is 0.

## Public role projection — #623 Cabinet/Intern foundation

The public role source is a single bounded POST RPC, public_member_roles(p_year, p_member_ids), created by additive migration 20261031070305_public_member_roles.sql. It returns only member_id, kind, label, academic_year_start, source_type and related_key. It reads only the already-public Cabinet/Intern roster with a stored member_id. Board plus all distinct Cabinet positions, Intern alone, co-chairs and simultaneous Intern/Board roles are preserved. Unlinked, draft-category, invalid-year and preloaded future-year roles never qualify.

The RPC enforces 200 IDs per call, one Cabinet-year record and the active academic year. A missing active term produces no roles. The client bounds selection to 2,000 canonical IDs, batches in 200s, and rejects any returned year or member that was not requested. The public React Query cache key includes visibility, selected year and sorted IDs. All-Time deliberately has no dated leadership titles; a hidden badge is not evidence of no role.

**Rollout status:** applied to production 2026-10-31 as version 20261031070305. **Mandatory rollout order for later arms:** the owner applies the migration manually before frontend cutover. Do not merge or deploy the client first, since missing RPC access would show 'Member roles are temporarily unavailable'. The owner runs the read-only hosted anon verifier with RLS_MEMBER_ROLES_PHASE=post-migration, checks actual field names, records the applied migration version, and then flips the repository variable. Never use a service-role key or automatic production migration. The offline fixture is bash scripts/test-public-member-roles.sh. Full manual browser QA is pending.

House Parent (#624), ACE Fam Head (#625) and VCN production (#683) require separately reviewed forward migrations that extend the SAME function, and #627 owns the remaining badges and UI. Cabinet canonical links remain owned by #626. House affiliation stays a separate Reveal-gated source and cannot imply a House Parent title. No House points, attendance, leaderboards' ranking logic or Reveal workflow changes here.

**Manual signoff:** after the authorized migration and client deployment, inspect /leaderboard rank 4+, phone and desktop podium, opened modal, year switch and All-Time at 320px/light/dark. Confirm on the network that RPC JSON contains exactly the six allowlisted fields and no names/notes. Real member badges require canonical-link review, not display-name matching.
