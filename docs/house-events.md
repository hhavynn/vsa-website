# House events: safe saves (#631)

Admin → Houses → House Events creates and edits `house_events` and their host Houses (`house_event_houses`).

- **No default House.** The form starts with no House chosen and refuses to save without one. The first House picked is the **primary host** (shown on the form); more Houses make a collab. Switching year drops any House that is not that year's.
- **Draft by default.** "Publish now" starts unchecked, and the database default for `house_events.is_published` is now `false`. Public pages show published events only.
- **One transaction.** Saves go through `admin_save_house_event` (migration `20261028080000`): the event and its host Houses change together or not at all. A failed update leaves the event and its hosts exactly as they were.
- **Server-side rules.** At least one host; no repeats; every host is a House profile of the event's academic year; the primary host is among them; only known fields. A trigger enforces the same-year rule for any direct write to `house_event_houses` too.
- **Retries and two editors.** A create retried with the same form session returns the same event (no duplicate). An update is refused if someone else saved the event after it was opened ("reload and try again").
- **Before the migration** the editor falls back to the previous two-step save, with the new no-default and draft-default form behavior.

Offline proof: `bash scripts/test-house-event-save.sh`.

**Migration status:** `20261028080000_house_event_atomic_save.sql` is **not applied**; it needs owner approval and staging first.
