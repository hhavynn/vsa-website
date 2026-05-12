# Yearly Leaderboard System

This document describes the yearly leaderboard system implemented in May 2026.

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

- **System Consolidation**: Currently, there is a secondary points system for authenticated check-ins (`event_attendance` and `user_points`). Future work should consolidate these into the `members` system once `user_id` coverage is verified for all members.
- **Auto-Term Assignment**: New events should automatically be assigned to the current active term to ensure data consistency.
