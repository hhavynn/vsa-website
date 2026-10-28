# House events: safe saves (#631)

Admin → Houses → House Events creates and edits `house_events` and their host Houses (`house_event_houses`).

- **No default House.** The form starts with no House chosen and refuses to save without one. The first House picked is the **primary host** (shown on the form); more Houses make a collab. Switching year drops any House that is not that year's.
- **Draft by default.** "Publish now" starts unchecked, and the database default for `house_events.is_published` is now `false`. Public pages show published events only.
- **One transaction.** Saves go through `admin_save_house_event` (migration `20261028080000`): the event and its host Houses change together or not at all. A failed update leaves the event and its hosts exactly as they were.
- **Server-side rules.** At least one host; no repeats; every host is a House profile of the event's academic year; the primary host is among them; only known fields. A trigger enforces the same-year rule for any direct write to `house_event_houses` too.
- **Retries and two editors.** A create retried with the same form session returns the same event (no duplicate). An update is refused if someone else saved the event after it was opened ("reload and try again").
- **Before the migration** the editor falls back to the previous two-step save, with the new no-default and draft-default form behavior.

## In Admin → Events (#630)

Create Event starts with a category: **General VSA Event**, **External Event** (the External Event type and its UVSA listing) or **House Event**. House Event opens the same House event editor, so a House event is saved only as a House event: never as a regular VSA event, and it never awards attendance points. A House social that should also count for points needs a separate, deliberately created regular event. Manage Events lists the year's House events (hosts, draft or published) from the same records Admin → Houses shows, with a button to open the editor.

## Dashboard (#636)

The right side of Admin → Houses → House Events is the year's event dashboard (admin only; drafts are visible only here).

- **Views:** Needs attention, Drafts, Upcoming (published), Past (published), each with a count, plus a **Host House** filter and per-House counts (live / drafts). A collab event is listed once and appears under each of its hosts. **This week** lists the next seven days, drafts included.
- **Checks** are prompts, not verdicts: an inactive (not yet public) or other-year host profile, an RSVP or image link that is not a web address, a draft whose date is near or past, a missing time or location. A missing RSVP is only a note.
- **Actions:** Edit, Duplicate as draft (fills the form as a new, unpublished event with the same details and hosts, without the image; nothing is saved until you save), Preview (the public card; drafts are labelled as not public), Publish / Unpublish (always confirmed; both keep the host Houses. Publish refuses an event with no host and, with migration `20261028080000`, re-checks the hosts and refuses if someone changed the event since the list loaded. Unpublish is a plain update that only hides the event, so it works even when the hosts need fixing), Delete (confirmed; Unpublish is the reversible option), and Public page for published events.
- Unsaved form edits are never replaced without asking. If the list fails to load, the form keeps what you typed and the list offers Try again. The list reads at most 500 events per year and says so if it stops there.
- This dashboard is not a House Parent login: no new accounts or permissions (#654 owns any read-only House Parent view).

Offline proof: `bash scripts/test-house-event-save.sh`.

**Migration status:** `20261028080000_house_event_atomic_save.sql` is verified applied to production (2026-10-28).
