# Admin operations quality-of-life

Phase 4 of the yearly-operations system (after ACE assignments, House/Intern drafts, and the Cabinet rollover / New Year Setup / Operations dashboard in [`yearly-operations.md`](yearly-operations.md)). It makes common admin work take fewer clicks and makes mistakes easier to catch and recover from. **It changes no points, attendance, House standings, ACE lineage, or member-privacy behavior**, and no public page.

## What admins get

| Feature | Where | Notes |
|---|---|---|
| **Quick Search** (⌘K / Ctrl+K) | Admin shell, sidebar "Search admin…" | Members, ACE people, Cabinet, Interns, House draft rows, Events, admin pages. Results show a type line ("ACE · Sweatpants") and destination ("→ ACE"). Records open **by canonical id**: `?member=<id>`, `?family=&node=`, `?cycle=&row=`, `?batch=&row=`, `?event=`. Loads nothing until opened; admin shell only. |
| **Quick filters with counts** | ACE assignments + family editor, Houses, Cabinet rollover, Interns, Members | Only the filters relevant to each domain (`src/lib/adminQueues.ts`). Choice lives in `?filter=`, so refresh and Back keep the admin's place. |
| **Bulk actions** | Same pages | Checkbox selection, sticky bulk bar. Link selected *exact* matches (ACE), assign / clear House (Houses), set mentor / track (Interns), set board (Cabinet), mark reviewed, clear review flag (Members). Ambiguous identities are **never** bulk-resolved; skipped rows say why. Destructive bulk actions (clear House, remove mentor) confirm with the affected count. |
| **Unsaved-changes protection** | ACE fam form, Events create/edit, Cabinet create/edit, Members editor, pasted imports | `Unsaved changes` label, Save disabled until something changed, warning on tab close, in-app link clicks, and switching records; a failed save keeps the form. |
| **Recent Changes** | Admin → Recent Changes, Overview card | Append-only `admin_activity_log` (who, what, when). Filter by ACE / Houses / Cabinet / Interns / Members / Year Setup. |
| **Practical undo** | Recent Changes, Overview | Only for a changed **House** on a draft row, **ACE Big**, **ACE node link**, **intern mentor**. Compare-and-set: refused if the value changed again or the batch/cycle is no longer a draft. Publication, reveal, Cabinet publication, year setup, deletions, and bulk edits are never offered one-click undo. |
| **Import review** | ACE, House, Cabinet, Intern pastes, attendance import | Input → Parsed → Matched → Needs Review → Ready, a summary (`82 rows · 71 ready · 7 need review · 3 unmatched · 1 invalid`), show only problems, download / copy problem rows (CSV is formula-safe). Each problem row says why. |
| **Duplicate / conflict flags** | Same pages | Same member twice, same ACE Little twice, one person in two Houses, accidental Cabinet duplicate slots, intern imported twice, lookalike names. Flags only; real merges stay in **Merge Review**. |
| **Duplicate Event** | Admin → Events → Manage | Copies name (suffixed "(copy)"), description, type, points, times, venue. Always a Draft, needs a new date, never copies attendance, check-in code, image, RSVPs, or term. |
| **Copy position structure** | Cabinet rollover | "Copy missing positions from 2026–27": roles, boards, order only, never people; idempotent. |
| **Next-step banners** | After import, last-link, lock, roster complete, year setup | Replaces dead-end toasts with the logical next action. |
| **Unified preflight** | ACE, Houses, Cabinet, Interns | `Ready to Publish` / `Not Ready` + `N blockers · M warnings`; each issue has severity, why, affected count, and a fix action. Warnings are never promoted to blockers (`src/lib/adminPreflight.ts`). |
| **Previews** | Cabinet roster, Intern cohort, House reveal, ACE publish confirm | Reuse the Preview As Public frame, labelled **ADMIN PREVIEW — NOT PUBLIC**. Read-only; publishing is a separate button. |
| **Workflow progress header** | ACE, Houses, Cabinet, Interns | `Import ✓ Linking ✓ Assignments 42 / 47 Preflight ⚠ Locked — Published —`, with "Next up". Derived from persisted state only. |
| **Year context** | Every yearly surface | `2026–27 · Current year` or `Viewing archived 2025–26 data`. Uses the active term / academic-year helpers. |
| **Continue working** | Admin Overview | Derived from the same persisted cycle/batch status the dashboard already loads. No per-user tracking. |

### Deliberate scope choices

- **No partial publish.** "Publish selected safe records" is not offered: ACE publish, House reveal, Cabinet and Intern publish are atomic database transactions by design. The preflight shows what blocks them instead.
- **Reviewed marks are advisory.** They only remove a row from the *Needs Review* filter; they never gate lock, publish, or reveal.
- **Inline edits keep saving per field** (ACE / House / Cabinet / Intern workspaces already persist each edit to the draft record). There is no aggressive background autosave.
- Browser Back is not intercepted (the app uses a plain `BrowserRouter`); tab close, reload, in-app links, and in-page record switches are.

## Data

Migration `supabase/migrations/20261002040000_admin_activity_log_and_review_marks.sql` (additive, admin-only RLS via `is_admin_user`, no `anon` grants):

- `admin_activity_log` — `id, actor_user_id (default auth.uid()), action, entity_type, entity_id, academic_year_start, summary, metadata jsonb, created_at`. **Append-only**: SELECT and INSERT policies only. Size/shape check constraints are a backstop; the client stores concise facts only (names, a before/after label, ids) and `sanitizeMetadata` drops email/phone/token-like keys.
- `admin_review_marks` — one row per reviewed draft row (`entity_type` limited to the four draft tables), unique per row.

**Status: not applied to production. It needs owner approval and a manual apply** (see `supabase/migrations/MIGRATION_CHECKLIST.md`). The frontend degrades safely without it: activity writes are best-effort and never block an edit, Recent Changes says it may not be available yet, and "mark reviewed" reports that it could not be saved. Apply it for history, undo, and reviewed marks to work.

Verify on a local or staging database (rolled back; prints `PASS:` per check, 27 checks including append-only, actor-spoofing, size limits, and review-mark uniqueness). Never run it against production:

```bash
psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f scripts/verify-admin-activity-log.sql
```

Post-apply check: RLS enabled on both tables; `admin_activity_log` has exactly two policies (select, insert), `admin_review_marks` three (select, insert, delete); no grants to `anon`.

## Code map

| Concern | Files |
|---|---|
| Quick Search | `src/lib/adminSearch.ts`, `src/lib/adminNavigation.ts`, `src/data/repos/adminSearch.ts`, `src/hooks/useAdminSearch.ts`, `src/components/features/admin/AdminQuickSearch.tsx` |
| Filters / bulk / dirty | `src/lib/adminFilters.ts`, `src/lib/adminQueues.ts`, `src/lib/adminBulk.ts`, `src/lib/adminDirty.ts`, `src/hooks/useUrlFilter.ts`, `src/hooks/useUnsavedChangesGuard.ts` |
| Activity / undo | `src/lib/adminActivity.ts`, `src/data/repos/adminActivity.ts`, `src/data/repos/adminUndo.ts`, `src/hooks/useAdminActivity.ts`, `src/pages/Admin/RecentChanges.tsx` |
| Import review / conflicts | `src/lib/adminImportReview.ts`, `src/lib/adminConflicts.ts`, `ops/ImportReviewPanel.tsx`, `ops/PossibleDuplicates.tsx` |
| Preflight / progress / next steps | `src/lib/adminPreflight.ts`, `src/lib/adminProgress.ts`, `src/lib/adminNextSteps.ts`, `src/lib/adminContinue.ts`, `src/lib/adminYearContext.ts` |
| Duplication helpers / previews | `src/lib/adminEventDuplicate.ts`, `src/lib/adminStructureCopy.ts`, `src/lib/adminPreviewMappers.ts`, `preview/CohortPreviewDialogs.tsx`, `preview/HouseRevealPreviewDialog.tsx` |
| Shared UI | `src/components/features/admin/ops/` (`FilterChips`, `BulkActionBar`, `SaveBar`, `ReadinessPanel`, `WorkflowProgress`, `EmptyState`, `NextStepBanner`, `ActivityList`, `YearContextBadge`) |
