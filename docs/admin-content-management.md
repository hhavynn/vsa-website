# Admin Content Management

This site is moving toward year-by-year and quarter-by-quarter content management through the admin dashboard.

## Academic Terms

Academic terms live in `academic_terms` and are used to group events for browsing and archive views.

- `code` is the short label used internally, such as `FA25`, `WI26`, or `SP26`.
- `label` is the public/admin label, such as `Fall 2025`.
- `starts_on` and `ends_on` define the practical date range for the term.
- `is_active` marks the current planning term for admins. Only one term should be active.
- Event dates are still the source of truth for whether an event is upcoming or past.

To add a new quarter, go to `/admin/years`, create the academic term, then set it active if it is the current planning term. Events can then be assigned to that term from `/admin/events`.

## Cabinet Years

Cabinet years live in `cabinet_years` and are used to group cabinet members by board year.

- `label` is the public/admin label, such as `2026-2027 Cabinet`.
- `slug` is the URL-safe identifier, such as `2026-2027`.
- `theme_name` is optional and can store a cabinet theme if a board has one.
- `is_active` marks the cabinet year shown by default on the public cabinet page. Only one cabinet year should be active.

To start a new board year, go to `/admin/years`, create the cabinet year, then set it active once the public site should default to that board. Add or edit members from `/admin/cabinet` and assign each person to the correct cabinet year.

## Future Board Workflow

At the start of a quarter:

1. Create the new academic term in `/admin/years`.
2. Mark it active when planning for that term begins.
3. Create events in `/admin/events` and confirm each event has the correct term.

At the start of a board year:

1. Create the new cabinet year in `/admin/years`.
2. Add cabinet members in `/admin/cabinet`.
3. Assign every member to the new cabinet year.
4. Mark the new cabinet year active when it should be the default public cabinet.

## Notes

Rows can safely exist without an assigned term/year while content is being migrated. Public pages keep fallback behavior so older events and cabinet members do not disappear.

Role templates are not automated yet. For a new cabinet year, create the members manually in `/admin/cabinet` using the current board structure. For 2026-2027, the board keeps last year's roles except the two-historian setup becomes one Historian and one Public Relations Chair.
