-- Add optional start and end times to events.
-- Stored as SQL time (no time zone) so time-zone shifts from storing full
-- datetimes for local campus events are avoided.
-- Both are nullable; existing events without times continue to work.
alter table events
  add column if not exists start_time time without time zone,
  add column if not exists end_time   time without time zone;
