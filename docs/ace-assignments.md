# ACE Big/Little assignments

Admin → ACE → **Assignments** is where the upcoming Big/Little sorting is
prepared privately, locked, checked, and then revealed on the public ACE tree.
Drafts never touch `ace_family_members` until **Publish**.

## Lifecycle

| Status | Editable | Public | Notes |
|---|---|---|---|
| `draft` | yes | no | Add, import, link members, pick Bigs. |
| `locked` | no | no | Frozen for final review. **Unlock to edit** is always available. |
| `published` | no | yes | Littles now exist on the tree. Can only be archived. |
| `archived` | no | n/a | Frees the academic year for a fresh cycle. |

The preflight panel shows before Lock and again before Publish.

**Blocks Publish:** an unassigned Little, a Big that no longer exists, the same
Little twice (case, spacing and diacritics ignored), one canonical member
assigned twice, a draft that already created a node, a Little already on the tree
under that Big.

**Warnings only:** ambiguous member matches, obvious matches not linked yet,
Littles with no member record, a member who already appears elsewhere on the tree,
and everything from the [eligibility check](#eligibility) (who is short, who
cannot be checked yet, no saved minimums).

## Eligibility

While the cycle is `draft` or `locked`, the **Eligibility check** panel shows
whether each Little and each Big meets the VSA attendance minimums: a Little
must have attended enough qualifying events to be picked up, and a Big enough to
pick one up. After publish, the older published-cycle review (#791) takes over.

### The saved policy

Per cycle, the ACE Chair saves:

| Field | Stored in | Notes |
|---|---|---|
| Little minimum | `ace_assignment_cycles.little_min_events` | 1–20; null until saved |
| Big minimum | `ace_assignment_cycles.big_min_events` | 1–20; null until saved |
| Qualifying events | `ace_assignment_cycle_events` (`cycle_id`, `event_id`) | up to 100; one row per event |

- The form pre-fills **4** (Littles) and **3** (Bigs) for a new cycle. Nothing is
  checked until the Chair clicks Save; the database has no default.
- The event picker lists the cycle year's events from the attendance status
  check ([attendance-readiness.md](attendance-readiness.md)). Only completed,
  dated, published events are offered. **Select all completed events this
  year** fills the list in one click.
- The database enforces the same rule: an event must be published, dated, in
  the past, and in a term of the cycle's academic year.
- The policy is editable only while the cycle is `draft`. Locking freezes it,
  like the drafts; **Unlock to edit** to change it. Published and archived
  cycles keep it frozen. Deleting an event still removes it from a frozen
  policy.
- Saving goes through `save_ace_eligibility_policy`, which replaces both
  minimums and the event set in one transaction.

### Statuses

| Status | Meaning |
|---|---|
| Meets | Attended at least the minimum, counting only verified events. |
| Short | Below the minimum. Shows attended vs required and how many remain. |
| Unknown | A selected event's import is not verified yet (Houses → Attendance status), and those events could still close the gap. |
| Needs identity review | A Little with no linked member, or a Big whose ACE node has no linked member (or who is no longer on the tree). Never shown as Short. |

- Littles use `little_member_id`. Littles with no Big yet are still checked.
- Bigs resolve `big_ace_member_id` → `ace_family_members.member_id` and are
  counted once, however many Littles they take.
- An event counts once its import is verified (the same rule as #791,
  `isAceEventAttendanceVerified`). Credits at unverified events never count
  toward meeting a minimum. Someone who already meets it on verified events is
  Meets. Someone who could not reach it even if every unverified event counted
  is Short.
- A saved event that stops qualifying (unpublished, moved to the future, or no
  longer in the year) is listed and ignored, and is removed on the next save.
- The panel shows counts at the top and filters by status, role and name.

### Warnings, not blockers

Short people, Unknown people, identity reviews, a missing policy, saved events
that stopped counting, and a minimum larger than the number of counted events
(nobody could meet it) appear in
the preflight before Lock and before Publish as **warnings**, and the publish
confirmation repeats how many people are short. They never disable Lock or
Publish: mutual requests and approved exceptions exist, and the ACE Chair keeps
the final say.

### Privacy

Admin-only and read-only apart from the policy. Eligibility is computed in the
admin's browser from `member_event_attendance` and is never stored, published,
exposed through a `published_*` view or turned into points. No emails are read,
shown or stored.

## What Publish writes

One `ace_family_members` row per Little:

| Column | Value |
|---|---|
| `family_id` | the selected Big's `family_id` |
| `parent_member_id` | the selected Big's node id (public lineage is unchanged) |
| `member_id` | the Little's `members.id` when linked, else null |
| `name` | the Little's name |
| `role_label` | `Little` (the importer's convention) |
| `is_published` | `true` (the fam must also be live to show publicly) |
| `pickup_academic_year_start` / `pickup_term` | null (unknown) for now; stamping the cycle's term is #674. The Big's own pickup year is never changed. See [ace-pickup-years.md](ace-pickup-years.md). |

The new node id is stamped on the draft (`published_ace_member_id`). Existing
nodes, including the Big's own `role_label`, are never edited. A Big who was a
`Little` keeps that label, exactly as the importer leaves it.

`publish_ace_assignment_cycle(cycle_id)` does all of this in one transaction,
locking the cycle row first. It re-checks every hard blocker server-side,
refuses a cycle that is not locked, and returns `created: 0` for a cycle that is
already published, so a second click cannot duplicate anyone.

## Importing Littles

Paste CSV or TSV. Recognized columns: `name`, `first name`, `last name`,
`email`, `big` / `big name`, `notes`. A header row is optional (then column 1 is
the name).

- An email matching exactly one `members` row links that member. **Emails are
  used only for that match and are never stored.**
- A `big` that matches exactly one existing ACE node assigns that Big. Anything
  else is kept in the draft's notes ("Requested Big: … (not found)").
- Name-only matches are never auto-linked on import. Use **Link N obvious member
  matches** (unique exact names only) or the per-row picker.

## Checking mutual requests

**Check mutual requests** takes a paste of the "ACE Mutual Request" Google Form
responses, header row included. Logic: `src/lib/aceMutualRequests.ts`.

- "Requesting a Big" means the respondent is a Little. Repeat submissions are
  keyed on UCSD email (a bare username means `@ucsd.edu`); the latest
  timestamp wins, and someone who answered as both roles is flagged.
- Requested names are pulled out of free text and resolved against the
  opposite role only: full name, then first + last, then preferred name +
  last, then a first name that is unique. A near spelling is only a *possible*
  match until the chair accepts it. Ties are never guessed.
- A pair counts only when both people requested each other. One-sided
  requests, unresolved names, and conflicts (a Little mutually matched with
  several Bigs, or both roles) are listed separately; conflicts stay out of
  the confirmed pairs. **Download follow-ups CSV** has names and request text
  only.
- **Add N confirmed pairs to draft** uses the same import path as above: the
  member links only by a unique email match, the Big is assigned only when
  exactly one tree node has that name (otherwise the note says
  `Mutual Big: … (not on tree)`), and Littles already in the draft are skipped.
- The paste lives only in the panel's state. Phone, social and personal-email
  columns are never read, and nothing is saved before the draft rows.

## Application answers while sorting

**Load application answers** (draft or locked cycles) takes a paste of the ACE
application responses from Google Sheets and shows the matching-relevant
answers beside each row: year and warning chips, an expandable profile for the
Little and the chosen Big, the Big's planned number of Littles against their
load in this draft, and, for an unassigned Little, up to three suggested Bigs.
Applicants that matched no draft row or tree node are listed so names can be
fixed.

- **In memory only.** The answers live in React state for this browser tab.
  Nothing is written to a table, browser storage, logs, toasts, or analytics,
  and nothing goes into a draft's notes. Leaving or refreshing clears them.
- Only whitelisted columns are read (`src/lib/aceApplicationProfiles.ts`);
  contact details, birthdays, hometowns, allergies, housing, car access, sizes,
  gift wishes, major/minor, and events attended are ignored.
- Littles attach to rows by the linked member's email (looked up once, never
  stored), then by normalized name or preferred + last name; Bigs attach to
  tree nodes by normalized name. Ambiguous matches are left alone.
- Checks (gender preference, capacity, year preference, substance comfort,
  do-not-pair) and the suggestion score are **advisory**. They never block
  Lock or Publish. Picking a suggestion just sets the Big like the picker does.
- The application-answer panel also highlights **potential two-way named preferences** when each applicant explicitly names the other in the general form's role-specific "Any preferences for Bigs/Littles?" answer. Duplicate full/first names are never guessed; a unique first-name-only mention is flagged for identity review. Separate do-not-pair answers suppress the positive signal. This is not the separate mutual form, an approved guarantee, an assigned Big, or a publish gate. No answer text or review decision is saved.

## Database

Migration `20261001213356_ace_assignment_workspace.sql` adds
`ace_assignment_cycles` and `ace_assignment_drafts` (admin-only RLS via
`is_admin_user`, no `anon` access), the lifecycle guard triggers, and the
publish function. It is additive. Apply it **before** deploying the frontend; do
not apply it to production from a PR.

**Status:** applied to production on 2026-10-01 (recorded as version `20261001213356`); the filename matches the recorded version.

Migration `20261030184936_ace_assignment_eligibility_policy.sql` adds the
eligibility policy: the two minimum columns, `ace_assignment_cycle_events`
(admin-only RLS via `is_admin_user`, no `anon` access, no UPDATE grant), the
freeze triggers and `save_ace_eligibility_policy` (SECURITY INVOKER). It is
additive and repeatable.

**Status:** not applied to production. Apply it manually (one file,
`apply_migration`, per `supabase/migrations/MIGRATION_CHECKLIST.md`) **before**
deploying the frontend. Until then the panel says the check is unavailable and
the preflight shows one warning; nothing else changes.

Verify on a local or staging database (rolled back, prints `PASS:` per check):

```bash
psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f scripts/verify-ace-assignments.sql
```

Or offline, on a disposable PostgreSQL cluster that applies the real ACE
migrations first (needs `initdb`, `pg_ctl` and `psql` on `PATH`; run as a
non-root user):

```bash
scripts/test-ace-assignments.sh
```
