// "Duplicate Event": copies the shape of an event, never its history. The copy
// is always a Draft, needs a new date before it can be created, and carries no
// attendance, image, recap, RSVP counts, or term.
import type { Event } from '../types';

export interface DuplicateEventDraft {
  name: string;
  description: string;
  event_type: Event['event_type'];
  points: number;
  location: string;
  check_in_form_url: string;
  start_time: string | null;
  end_time: string | null;
  end_date: null;
  /** Must be chosen again: the original's date is never reused. */
  date: '';
  is_published: false;
  academic_term_id: null;
}

export const DUPLICATE_NAME_SUFFIX = ' (copy)';

/**
 * Copied: name (marked as a copy), description, event type, point value, and
 * the time-of-day shape (start/end time). Location is copied because
 * recurring events usually repeat their venue. Everything else starts blank.
 */
export function buildDuplicateEventDraft(source: Pick<Event, 'name' | 'description' | 'event_type' | 'points' | 'location' | 'start_time' | 'end_time'>): DuplicateEventDraft {
  return {
    name: `${source.name}${DUPLICATE_NAME_SUFFIX}`,
    description: source.description ?? '',
    event_type: source.event_type,
    points: source.points ?? 0,
    location: source.location ?? '',
    check_in_form_url: '',
    start_time: source.start_time ?? null,
    end_time: source.end_time ?? null,
    end_date: null,
    date: '',
    is_published: false,
    academic_term_id: null,
  };
}

/** Fields that must never travel with a duplicate; the test pins this list. */
export const NEVER_COPIED_EVENT_FIELDS = [
  'id',
  'date',
  'end_date',
  'image_url',
  'thumbnail_url',
  'check_in_form_url',
  'interest_counts',
  'academic_term_id',
] as const;
