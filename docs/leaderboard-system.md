# Yearly Leaderboard System

This document describes the yearly leaderboard system implemented in May 2026.

## ⚠️ Read first: there are two points systems, and they are not reconciled

This is the canonical explanation (#310). `AGENTS.md`, the agentic workflow doc and the
`vsa-architecture-contract` skill point here.

| | **Leaderboard system** (public standings) | **Check-in system** (signed-in accounts) |
|---|---|---|
| **Stores points in** | `member_event_attendance` (one row per member per event, `points_earned`), totals cached on `members` | `event_attendance` (one row per user per event) and `user_points` (one total per auth user) |
| **Keyed by** | `members.id`: a roster person, whether or not they have an account | `auth.users.id`: a signed-in account |
| **Written by** | Admin attendance import (`src/pages/Admin/Import.tsx`), admin Members / Points pages, `smart_merge_members`; triggers `sync_attendance_points_on_event_update` (on `events`) and `sync_member_points` (on `member_event_attendance`, recalculates `members` totals via `recalculate_member_points`) | Only the `check_in_to_event` RPC (server-authoritative since #145; client writes are blocked by RLS, re-confirmed in #422), plus `handle_new_user_points`, which creates the `user_points` row when an account signs up |
| **Read by** | `/leaderboard`, `/points` (Find My Points), House standings, member profiles and event history, via `member_yearly_points`, `house_member_yearly_points`, `house_*_points` and `member_event_history` (`src/data/repos/leaderboard.ts`) | The signed-in header points badge and dashboard (`src/data/repos/points.ts`, `usePoints`, `PointsContext`, `MemberDashboard`) |
| **Authoritative for** | **Every public number**: leaderboard, House standings, Find My Points, Wrapped | Only a signed-in account's own check-in history. Member accounts are currently parked (#233) |

**Easy to confuse:** `user_points` (check-in total per account) and `member_yearly_points`
(leaderboard view per roster member per year) are different systems despite the similar names.

**Never** fix a leaderboard number by writing to `event_attendance` or `user_points`; the leaderboard
never reads them, so the numbers will just disagree permanently. Fix the attendance record in
`member_event_attendance` (via the import or admin tools) instead.

**Status: OPEN.** Consolidation is future work that needs its own design and owner sign-off. Neither
system is "the wrong one to be deleted": the leaderboard system is the public source of truth, and
the check-in system is the only server-authoritative self-service path. A guard test
(`src/data/repos/pointsSystemsBoundary.test.ts`) fails if either repository starts reading the other
system's tables.

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
- The event dropdown now shows the academic term for each event.
- A warning is displayed if the selected event has no term assigned.
- Points are automatically attributed to the correct year based on the event's term.

### Member Management

The Member History modal in the admin panel now includes:
- A yearly breakdown of points earned.
- The specific academic term for each attended event.

## Future Considerations

- **System Consolidation (OPEN)**: see "two points systems" at the top of this document. Consolidating the check-in system (`event_attendance`, `user_points`) into the `members` system depends on verified `user_id` coverage for all members, and needs its own design and owner sign-off.
- **Auto-Term Assignment**: New events should automatically be assigned to the current active term to ensure data consistency.
