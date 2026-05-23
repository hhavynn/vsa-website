-- Link gallery_events albums to events (optional, additive).
-- An album may reference at most one event; deleting the event
-- nulls the link instead of removing the album.

ALTER TABLE gallery_events
    ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS gallery_events_event_id_idx
    ON gallery_events (event_id);
