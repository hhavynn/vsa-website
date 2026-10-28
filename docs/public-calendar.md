# Public Calendar (`/calendar`)

Public, no-login planning view of everything VSA. Complements `/events`
(archive/detail cards) with time-based discovery: a month board, a list view,
a "This Week" strip, filters, and one-click Google Calendar saving.

## Data sources (all public-safe, no schema changes)

| Source | Table/view | Repo method |
| --- | --- | --- |
| VSA events | `events` (published only) | `eventsRepository.getEvents({ date_from, date_to })` |
| House events | `house_events` (published, public field allowlist) | `houseEventsRepository.getPublicEventsInRange(from, to)` |
| Application windows | `public_application_links` view (URL-masked server-side) | `applicationLinksRepository.getPublicApplicationLinks()` |

Everything is normalized into `CalendarItem` (`src/utils/calendar.ts`), which
carries only public-safe fields. Check-in codes live in a separate table and
are never queried. Application items never surface the (masked) `target_url` —
they link to `/get-involved` instead.

The loaded window spans 3 months back through 9 months ahead; month navigation
is clamped to it.

## Filters

Filters render only when the loaded window contains matching data:

- All / VSA Events / House Events (with Bowser, Donkey Kong, Boo, Toad chips)
- VCN, Wild n' Culture (backed by `events.event_type`)
- Apps & Deadlines (application windows: opens + due markers)
- ⭐ Points eligible toggle (`events.points > 0`)
- List view scopes: Upcoming / This Week / This Month

There are intentionally **no ACE or Intern event filters** — the `events`
schema has no ACE/Intern tag, and faking categories was out of scope. Their
application windows (ACE app, Intern app, etc.) appear under Apps & Deadlines.

## Google Calendar button

`AddToGoogleCalendarLink` (calendar items) follows the same single-button
direction as `events/AddToCalendarButton` (no dropdown). Timed items use
`buildGcalTimedDates` + `ctz=America/Los_Angeles`; date-only items use
all-day format with an exclusive end date (`buildGcalAllDayDatesFromDateOnly`).

## Follow-ups (not in v1)

- UVSA `external_events` on the calendar — excluded because rows carry
  `confidence_level`/`source_notes` (possibly unofficial info); needs a
  publish-confidence policy first.
- Optional admin fields (`host_house`, `audience`, ACE/Intern tags on
  `events`) if programming wants first-party ACE/Intern calendar items.

## Upcoming events on /events and Home (#634)

`src/lib/upcomingEvents.ts` merges regular events and published House events into one list, ordered by Los Angeles start time with the same lifecycle rules as regular events (ongoing kept, ended dropped, overnight handled; ties put the all-VSA event first; an event without a start time follows that day's timed events). Each House event keeps its own id, is listed once even when several Houses host it, shows every host, and links to its card on its year's House page.

- `/events` lists both under Next Up / All Upcoming. **House Events** is a filter (`?type=house`), with **Hosted by** (`&host=<slug>`) when more than one House has events; both stay in the URL. House events are not in the Memory Wall.
- Home's Next Event card shows the next House event first when it happens before the next all-VSA event, otherwise below it, linking to the event's card.
- If House events cannot load, regular events still show, with a notice.
- House events never award VSA attendance points; the page says so.
- Fixed: both pages called the House preview read with the row limit in the academic-year slot, so no House event ever appeared.

## Files

- `src/pages/Calendar.tsx` — page orchestration
- `src/components/features/calendar/` — MonthGrid, ThisWeekStrip,
  CalendarFilters, CalendarItemCard, CalendarDetailModal,
  AddToGoogleCalendarLink, calendarTheme
- `src/utils/calendar.ts` (+ `calendar.test.ts`) — CalendarItem model, date
  math, grid, filters, Google Calendar URLs
