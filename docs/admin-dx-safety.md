# Admin DX & safety primitives

Covers the shared building blocks every admin page should use, and the inventory of destructive admin actions with the confirmation tier each one gets. Owning agent: `vsa-admin-workflows`.

## Nav, routes, breadcrumbs, headers

- **Single source:** `src/lib/adminNavigation.ts` (`ADMIN_NAV_GROUPS`) feeds the sidebar (`AdminNav`), Quick Search (`adminSearch.ts`), and breadcrumbs/page headers.
- **Parity guarantee:** `src/lib/adminNavigation.test.ts` reads `src/routes/index.tsx` and fails if a guarded `/admin/*` route has no nav entry, a nav entry has no route, or any admin route sits outside the `<AdminRoute />` boundary. Adding a page is therefore: lazy import + `<Route>` in `routes/index.tsx` **and** one entry in `adminNavigation.ts`; forgetting either fails CI.
- **A nav entry is not a permission.** Access is `AdminRoute` + RLS only.
- **Nested pages:** give the entry a `parent` path (e.g. Cabinet Rollover → `/admin/cabinet`). Optional `description` is the default subtitle.
- **Header:** `<AdminPageHeader />` (`components/features/admin/AdminPageHeader.tsx`) renders breadcrumbs + title + description + an `actions` slot, all derived from the nav config by current path. Pass `detail` for a selected record on a nested view. Keep `<PageTitle>` for the document title. Adopted so far: Events, Gallery, Members, External Events, ACE Families, Cabinet, Cabinet Rollover, Interns, Resources, Applications, UVSA Schools. The remaining pages still use hand-written headers (follow-up).

## Forms

`useAdminForm` (`hooks/useAdminForm.ts`) + `AdminFormShell` / `AdminField` (`components/features/admin/ops/AdminFormShell.tsx`):

- zod schema (in `src/schemas/`) through react-hook-form; inline errors, an announced error summary, focus moves to the first invalid field.
- Lifecycle via `SaveBar`: clean → dirty → saving → saved / error; failed saves keep the values.
- Server errors: `serverErrorToForm` (`lib/adminForm.ts`) maps Postgres constraint names to fields (`constraints` option); unknown errors stay form-level, never swallowed.
- Unsaved-changes guard (`useUnsavedChangesGuard`): tab close/reload and in-app link clicks; follows RHF dirty state, which `reset(values)` clears after a successful save, so save-then-navigate never prompts. In-page transitions use the returned `confirmDiscard`.
- **Client validation is UX only.** DB constraints and RLS remain authoritative; never relax a constraint because the client checks it.
- Adopted by: Add Member modal, Application links form (`src/schemas/applicationLink.ts`). The large legacy forms (Events, Cabinet, ACE, Members edit) still use hand-rolled state + `SaveBar`; migrate opportunistically.

## Destructive actions

`ConfirmDialog` (`components/common/ConfirmDialog.tsx`) is the one confirmation. Two tiers:

| Tier | When | Mechanism |
|---|---|---|
| **standard** | Ordinary deletes | Names the item and what happens, lists real cascading effects, Cancel focused, errors keep the dialog open |
| **typed** | Severe / hard to reverse / cascading (cabinet records, fams with members, events with attendance, year-wide resets, bulk of ≥5) | Admin must type the item's name (`requireText`); case, spacing and dash style are ignored |

Do not overuse typed — it stops meaning anything. `src/lib/adminDestructiveGuard.test.ts` fails if a bare `window.confirm` appears anywhere in non-test `src/` code, except in one allowlisted file (`useUnsavedChangesGuard.ts`, see below). Prompts that only discard local, unsaved state use the standard tier through `useDiscardConfirm` (`hooks/useDiscardConfirm.tsx`): it parks the pending action (the record being opened, the duplicate to apply) and runs it only on Confirm, so Cancel leaves the page exactly as it was.

**Undo:** the chosen approach is *deferred commit* (`useUndoableAction`, `lib/undoableAction.ts`): hide the row, show an Undo toast, run the real delete after ~7s, commit immediately if the admin leaves the page. It needs no schema change and cannot leak "deleted" rows through public reads. Soft delete was deliberately **not** added: every public read path would need to filter it, and a missed filter republishes deleted content. Reversible alternatives that already exist are used instead (Resources → Archive). `useUndoableAction` ships as a primitive; no surface uses it yet because each current delete either cascades, touches storage, or benefits from explanatory copy. It also does not fit the Recovery "Clear staged" action, the one reversible candidate: the hook defers a real write behind an Undo toast, and clearing staged work has no write to defer. Recovery staging already has its own undo stack ("Undo last" restores a clear), so that action uses the standard `ConfirmDialog`.

### Inventory (as of this change)

| Surface | Action | Tier | Notes / cascade shown in dialog |
|---|---|---|---|
| Events | Delete event | typed | Cascades to check-ins/attendance (and the points earned from them), check-in code, recap notes, interest counts, linked UVSA listing; gallery albums keep but lose the link. Verified against prod FKs 2026-10-02. Row delete and image/thumbnail Storage cleanup are separate: once the row is gone the UI never says deletion failed; a Storage `{ error }` or throw shows an "event deleted, cleanup failed" warning (no retry). |
| Gallery | Delete album | standard | Removes from public Gallery, event photo buttons, cover image; Google Photos untouched. |
| External Events | Delete listing | standard | Removed from UVSA Network page. |
| ACE Families | Delete fam | typed | Deletes its people; assignment drafts lose Big picks; club member records kept. |
| ACE Families | Remove person from fam | standard | Littles become top-level; photo deleted; drafts lose Big pick. |
| Cabinet | Delete cabinet record | typed | Removes from public Cabinet + year archive; photo deleted; drafts lose the link. |
| Cabinet Rollover | Delete draft roster | standard | Draft only. |
| Cabinet Rollover | Remove one position row | none (quick) | Draft row; now toasts. |
| Interns | Delete draft cohort | standard | Draft only. |
| Cabinet role descriptions | Delete role description | standard | Role text leaves public Cabinet page; people unaffected. |
| Resources | Delete resource | standard | Admin index row only, not the Drive file; offers Archive instead. |
| Applications | Delete application link | standard | Copy varies with open/scheduled state; offers Disable instead. |
| Applications | Save a Drive link | standard (non-danger) | "Is this Drive link public?" check. |
| UVSA Schools | Delete school | standard | Leaves public page; linked external events keep but lose school link; uploaded logo file stays in storage. |
| Year Setup | Reset application windows | typed (year) | Lists exactly which windows are disabled / re-dated; nothing enabled. |
| Photo Requests | Remove approved photo | standard | Clears avatar (if still this photo), deletes thumbnail + upload, member must resubmit. |
| House drafts | Delete draft | standard | Draft only; published assignments unaffected. |
| Members | — | — | Member deletion is already disabled on the page. |
| Recovery | Clear staged decisions | standard | Local staged work only; nothing was written. Dialog says so and points at "Undo last", which restores a clear. |
| Members | Close editor with unsaved edits | standard (discard) | Names the member; Keep editing leaves the edit untouched. |
| Events | Open another event / close editor with unsaved edits | standard (discard) | Names the event being edited and the one being opened. |
| Events | Duplicate over an unsaved Create form | standard (discard) | Names the half-typed event; Cancel keeps the form. |
| Cabinet | Open another member / close editor with unsaved edits | standard (discard) | Names the member being edited and the one being opened. |
| ACE Families | Link a person who is already linked elsewhere | standard (non-danger) | Names the person and every node they are linked to; nothing is written until "Link anyway". |

**Remaining `window.confirm` (documented exception):** only `src/hooks/useUnsavedChangesGuard.ts`, the leave-page guard. `beforeunload` can only ever show the browser's native prompt; the link-click handler has to cancel the click synchronously; and `confirmDiscard` / `confirmLeaveIfUnsaved` return a boolean to callers in `useAdminForm` (Add Member modal), the ACE Families page, Applications, `AdminQuickSearch` and `AdminRoute`. Converting them would mean an async refactor of all of those, so they stay native and are the only entry in the guard test's allowlist. Do not add to that list; use `useDiscardConfirm` for in-page transitions.

**Out of scope / protected:** points, attendance, imports, merges and House membership flows were not changed (UI confirmation swap only on House draft delete and Recovery "Clear staged"; what gets staged or written is untouched). Event delete cascades into attendance by design of the schema — the dialog now says so.

## Bulk actions

- Pure planning: `planBulk` (`lib/adminBulk.ts`). Execution: `runBulk` (`lib/adminBulkRun.ts`, per-item results, small concurrency). UI: `BulkRunDialog` (preview of exactly which items change and what each becomes, skipped items with reasons, progress bar, per-item failure list, retry-failed).
- Partial success: an op whose main write committed but a follow-up failed (e.g. the UVSA listing sync on Events) throws `BulkPartialError`; the item is counted as changed, listed under "needs attention", and not offered for retry. Event days in the preview use `formatEventDay` (San Diego day via `getEventDateOnly` + `formatDateOnly`), never the device timezone. Bulk writes must go through the repository (never a bare `supabase` call) so a row deleted since the preview rejects instead of reporting a zero-row update as success.
- Selection: `useRowSelection` + `lib/adminSelection.ts`. Selection is pruned to the current filter; the dialog states the scope ("All N matching …, including ones not shown on this page").
- Destructive bulk of ≥5 items requires typing the count. No bulk delete exists on any surface.
- Surfaces: Events (publish/unpublish, same write as the editor plus the UVSA listing sync), Resources (archive/restore, same `setArchived` as single). Members, House drafts, ACE assignments and Cabinet/Intern rollover already had `BulkConfirm`-based previews.
- **Forbidden without `vsa-change-control` sign-off and a tested dry run:** bulk on points, attendance, House membership, leaderboard; `/admin/import` and `/admin/merge-suggestions`.
- **Not yet done:** bulk operations are not written to the admin activity log (#216 audit-trail work).

## Styling

New shared admin components use semantic Tailwind tokens (`bg-surface`, `border-border-strong`, `text-text-primary`…), no inline `style` props (enforced for these files by `src/__meta__/noInlineStyles.test.ts`). Older admin pages still carry inline styles from before that rule.
