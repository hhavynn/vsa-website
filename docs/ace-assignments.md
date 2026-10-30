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
Littles with no member record, a member who already appears elsewhere on the tree.

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

## Database

Migration `20261001213356_ace_assignment_workspace.sql` adds
`ace_assignment_cycles` and `ace_assignment_drafts` (admin-only RLS via
`is_admin_user`, no `anon` access), the lifecycle guard triggers, and the
publish function. It is additive. Apply it **before** deploying the frontend; do
not apply it to production from a PR.

**Status:** applied to production on 2026-10-01 (recorded as version `20261001213356`); the filename matches the recorded version.

Verify on a local or staging database (rolled back, prints `PASS:` per check):

```bash
psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f scripts/verify-ace-assignments.sql
```
