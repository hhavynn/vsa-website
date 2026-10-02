# Yearly operations: New Year Setup, Cabinet rollover, Operations dashboard

A future President should be able to start a school year and manage the transition without touching Supabase. This is the one workflow that ties the private draft → lock → publish systems together.

```
Start New Year  →  prepare rosters  →  resolve warnings  →  lock  →  publish / reveal  →  operate from the Admin dashboard
(/admin/year-setup)  (ACE, Cabinet,      (preflights)                  (explicit,          (/admin Operations section)
                      Interns, Houses)                                  confirmed)
```

Every domain keeps its own tables and its own publish step. Nothing in this workflow is a second public source of truth, and **nothing here changes points, attendance, House standings math, or privacy rules.**

## Shared vocabulary

Every workflow says **Draft · Locked · Published · Archived** (`src/lib/operationalStatus.ts`, `StatusBadge`).

- **Draft** is private and editable. **Locked** is private and frozen for final review (reopen to edit). **Published** is live. **Archived** is kept for the record.
- Locking never writes anything public. Publishing is always its own confirmed action.
- Reusable admin UI lives in `src/components/features/admin/ops/`: `StatusBadge`, `PreflightSummary` / `PreflightItem` (passed / blocking / needs-attention lines), `ProgressCount`, `OperationsCard`.

## 1. New Year Setup (`/admin/year-setup`)

Linked from Years & Terms, the Admin nav, and the Operations section ("Start 2027–28").

The wizard **previews before it writes**. Nothing is created until **Create Setup**.

| Step | What it does | What it never does |
|---|---|---|
| Academic year | Reports everywhere the year already exists (terms, Cabinet year/roster, ACE cycle, Intern cohort, House profiles/batch) | Duplicate an existing record |
| Academic terms | Fall / Winter / Spring (Summer optional, off by default) with editable dates, via the existing `academicTermsRepository` | Activate a term. Terms are created inactive |
| Cabinet year | Creates the inactive `YYYY-YYYY` Cabinet year if missing; offers **Create Cabinet Rollover Draft** | Activate the year |
| ACE | Creates an empty ACE assignment cycle if none exists | Copy any past Big/Little assignment |
| Interns | Creates the Intern cohort cycle if none exists (needs the Cabinet year) | |
| Houses | Does nothing by default ("House reveal intentionally not configured"). Once House profiles exist for the year it can create an **empty** assignment batch | Copy previous-year assignments, create profiles, or reveal anything |
| Applications | A separate, explicit **reset**: disable the windows you pick and replace past timing with a disabled placeholder | Enable a window, touch a `target_url`, or invent a link. Windows open right now start unselected |
| Summary | "2027–28 Setup" checklist: ✓ ready, ○ will be created / intentionally off | |

**Idempotent.** Create Setup re-reads what exists immediately before writing and executes only the missing pieces, so a stale preview or a second admin cannot cause a duplicate. Re-running reports what exists. A failed step is reported, its dependents are skipped, earlier writes are kept, and the whole thing is safe to run again.

**Application reset detail.** `application_links.open_at/due_at` are `NOT NULL`, so "clear" means replace: a past window gets a disabled placeholder (Sept 1 of the target year). The row stays `disabled`, so its URL stays masked in `public_application_links`. Add real dates and links in Admin → Applications before enabling anything. House Fall/Winter/Spring windows, the freeze-window policy, and the 9 keys are unchanged (`vsa-seasonal-operations`).

## 2. Cabinet rollover (`/admin/cabinet/rollover`)

- **Create Cabinet draft**: pick the Cabinet year and a source year. The copy writes **role, category, display_order only**. Names, member links, photos, and bios never carry over. Interns are excluded (they have their own cohort).
- **Paste the roster** as `Name, Role` lines (tab or ` | ` also work). Each person fills the first empty position with that role, or adds a position. A member is linked only on one exact, unclaimed name match (diacritics and case ignored); near-misses and ambiguous names are shown in the shared `MemberLinkPicker` for review, never auto-linked. Renaming a position clears its member link.
- Header summary: `19 positions · 17 member links · 2 need review · 15 photos available`. Approved photos keep flowing through `member_id` (`public_member_avatars`).
- **Preflight.** Blockers (lock and publish refuse): no positions, an empty position, the same member linked twice. Warnings: unresolved links, missing approved photos (a photo is **never** required to publish), the same name on several positions, a role used more than twice or the same person twice in one role. (Real boards repeat roles such as Co-President and Media Director, so duplicate-role is a warning, not a blocker.)
- **Lock** keeps it private. **Publish** (confirmed) calls one database function, `publish_cabinet_roster_cycle`, which does everything in a single transaction behind a row lock on the cycle: it re-checks the blockers, writes `cabinet_members` for the roster's Cabinet year, records each row's id on its draft, and marks the roster published. Any error rolls back every write, so a failure never leaves a partial Cabinet public, and two admins publishing at once serialize (the second sees "published" and writes nothing). It is idempotent: it adopts an existing row for the same member (or same name, if unlinked), updates in place on retry, never deletes existing rows, never touches Interns or photo columns, and an update only writes fields the draft actually has (a blank draft field never erases a bio or link already on the public row). Publishing makes the year appear in the public Cabinet year picker.
- **Activation is separate.** After publishing, **Make 2027–28 the active Cabinet** (confirmed) is the only thing that changes the current Cabinet. Publishing never does.

## 3. Operations dashboard (`/admin`)

The first section is **"2026–27 VSA Operations"** (the active term's year): Members, ACE (assignment status, `42 / 47 assigned`, `68 / 73 current nodes linked`), Houses (status, assigned, unresolved, balance `31 / 32 / 32 / 31`), Cabinet (`19 / 19 positions filled`, linked, need review, rollover in progress), Interns, Events (next event, missing info). Each card links to the tool that owns it. The existing tool search and Content Health dashboard are unchanged.

Below the cards is the **Operations Preflight**: per program, what needs attention, each line linking to the tool that fixes it (ACE unassigned → `/admin/ace?view=assignments`, Cabinet unlinked → `/admin/cabinet`, upcoming event missing location → `/admin/events`, …).

**Diagnostic only.** The dashboard and preflight only read. Following a link repairs nothing. Each domain loads independently: a failed query shows "could not load", never a misleading zero. House numbers come from the assignment batch; ACE nodes are the current year's `ace_families`; Cabinet is the active Cabinet year's public rows; events count published events from one day back.

## Migrations

1. `supabase/migrations/20261001222903_create_cabinet_roster_cycles.sql` adds `cabinet_roster_cycles` and `cabinet_roster_drafts`.
2. `supabase/migrations/20261001222905_revoke_phase2_guard_function_execute.sql` revokes client `EXECUTE` on the six Phase 2 House assignment and Intern cohort guard trigger functions, which had been callable by `anon` and `authenticated` (SECURITY INVOKER, so nothing was exposed, but it broke the trigger-function convention set by `20260928005621`). It changes no table, policy, row, or function body.

3. `supabase/migrations/20261002030000_publish_cabinet_roster_cycle.sql` adds `publish_cabinet_roster_cycle(uuid)`: admin-only (`is_admin_user`), `SECURITY DEFINER` with `search_path = ''`, `EXECUTE` revoked from `public, anon` and granted to `authenticated`. It changes no table or policy.

**Status:** migrations 1 and 2 are applied to production (2026-10-01, recorded as versions `20261001222903` and `20261001222905`; the filenames match). **Migration 3 is not applied yet and needs owner approval; apply it before deploying this frontend**, because the Cabinet rollover's Publish button calls it. Post-apply check for 1 and 2 on production: RLS enabled on both new tables, 8 admin-only policies, no `anon` grants, 5 triggers, and all nine guard functions report `EXECUTE` false for `anon` and `authenticated`.

Migration 1 is additive: RLS enabled, `revoke all` from `anon, authenticated`, admin-only policies via `is_admin_user()`, one live roster per Cabinet year, lifecycle triggers (legal transitions; a locked roster is immutable except the publish step stamping `published_cabinet_member_id`; only drafts can be deleted), and trigger-function `EXECUTE` revoked from clients.

Verify the roster migrations on a local or staging database (rolled back, prints `PASS:` per check, including a forced mid-publish failure that must leave nothing behind):

```bash
psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f scripts/verify-cabinet-roster.sql
```

## Code map

| Concern | Files |
|---|---|
| Status / preflight vocabulary | `src/lib/operationalStatus.ts`, `src/components/features/admin/ops/` |
| Cabinet rollover | `src/lib/cabinetRoster.ts`, `src/data/repos/cabinetRoster.ts`, `src/pages/Admin/CabinetRollover.tsx` |
| New Year Setup | `src/lib/yearSetup.ts`, `src/data/repos/yearSetup.ts`, `src/pages/Admin/YearSetup.tsx`, `HouseAssignmentsRepository.createEmptyBatch` |
| Operations dashboard / preflight | `src/lib/adminOperations.ts`, `src/data/repos/adminOperations.ts`, `src/components/features/admin/OperationsDashboard.tsx` |
| Admin quality-of-life (search, filters, bulk, history, undo) | See [`admin-operations-qol.md`](admin-operations-qol.md) |
