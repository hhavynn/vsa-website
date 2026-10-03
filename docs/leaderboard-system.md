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
| Writers | CSV/Google Form import, Admin Members attendance editor, `smart_merge_members` |
| Recalculation | `sync_member_points` / `recalculate_member_points`; event edits use `sync_attendance_points_on_event_update` |
| Readers | `/points`, `/leaderboard`, House standings, member cards/history, Wrapped, Admin Points |
| Public projections | `member_yearly_points`, `house_member_yearly_points`, House aggregate views, `member_event_history`, `public_members` |
| Authentication | Existing/invited approved admins only; students use public lookup without accounts |

The legacy `event_attendance`, `user_points`, and code-storage tables remain
private archives for retention and data-rights dependencies. The retirement
migration removes client access and legacy execution grants and unregisters
code-generation/account-points triggers. No current point calculation reads them.
Do not write or transfer archive totals into the member ledger.

`pointsModelBoundary.test.ts` exercises every leaderboard repository method and
guards against archive/RPC dependencies. `memberAccountRetirement.test.ts` guards
the application against restoring obsolete APIs, components, hooks, or providers.

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
- A warning is displayed if the selected event has no term assigned.
- Points are automatically attributed to the correct year based on the event's term.
- A matched member's profile `year` advances (never rewinds) when the CSV reports a higher standing. This applies to safe matches and to review rows an admin force-matched; email and college are only filled on safe matches. Review rows left unconfirmed are skipped entirely.

### Member Management

Admins can create a member with first/last name and optional email, year, and college using **Add Member**. House assignment remains on Admin Houses.

Use **History** or **Edit → Manage attendance** to view and edit attendance. Additions read current event points and ignore existing member/event pairs; removal requires confirmation. Database triggers own recalculation; the UI reloads member totals, history, and yearly totals after each mutation. Events need an academic term before attendance can be added.

The Member History modal includes:
- A yearly breakdown of points earned.
- The specific academic term for each attended event.

## Future Considerations

- **Auto-Term Assignment**: New events should automatically be assigned to the current active term to ensure data consistency.

### Live verification limitation

The existing `sync_member_points` / `recalculate_member_points` bodies and attendance trigger registration are not present in tracked migrations. Before merging attendance-removal changes, verify in a non-production admin session that both INSERT and DELETE refresh cached member totals and yearly/House standings. Frontend/repository mock tests cannot certify those live trigger effects; never repair a failure by manually writing cached totals.
