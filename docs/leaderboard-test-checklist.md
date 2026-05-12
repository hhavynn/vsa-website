# Yearly Leaderboard Test Checklist

## Public Leaderboard (/leaderboard)
- [ ] Page loads without errors.
- [ ] Year selector defaults to the active academic year (or most recent).
- [ ] "All-Time" option works and matches previous global standings.
- [ ] Switching academic years updates the rankings correctly.
- [ ] Search works within the selected year view.
- [ ] Pagination works correctly for large lists.

## Admin Points (/admin/points)
- [ ] Year selector is present and works.
- [ ] KPI cards (Total Points, Top Earner) reflect the selected year.
- [ ] Top 10 table reflects the selected year.
- [ ] Recent check-ins list shows most recent activity regardless of year (for audit).

## Admin Import (/admin/import)
- [ ] Event dropdown shows `[Term Label]` for events with terms.
- [ ] Warning appears if an event with no term is selected.
- [ ] Importing attendance correctly attributes points to the event's academic year.

## Admin Members (/admin/members)
- [ ] History modal for a member shows a "Yearly Breakdown" section.
- [ ] Event records in the modal show term labels (e.g., "Fall 2025").
- [ ] Points in the breakdown match the sum of events for that year.
