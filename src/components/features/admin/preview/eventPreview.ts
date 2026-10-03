import { Event } from '../../../../types';
import { isExistingLosAngelesWallClock, losAngelesDateTimeToIso } from '../../../../utils/losAngelesDate';

export const DRAFT_EVENT_PREVIEW_ID = 'draft-preview';

export type EventPreviewResult =
  | { event: Event; error?: undefined }
  | { event?: undefined; error: string };

/**
 * Shapes unsaved admin form values into the `Event` the public page would
 * read back after saving: the same San Diego date/time → ISO conversion as
 * the save path, the draft image (if any) in place of the stored one, and no
 * admin-only fields (anon reads never receive `check_in_form_url`).
 */
export function buildEventPreview({
  draft,
  dateOnly,
  startTime,
  imageUrl,
  thumbnailUrl,
}: {
  draft: Partial<Event>;
  /** San Diego calendar day, YYYY-MM-DD. */
  dateOnly: string;
  /** HH:MM; empty means an all-day event. */
  startTime: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
}): EventPreviewResult {
  if (!dateOnly) return { error: 'Add a start date to preview this event.' };
  const time = startTime || '00:00';
  if (!isExistingLosAngelesWallClock(dateOnly, time)) {
    return { error: "That start time doesn't exist on this date (clocks spring forward)." };
  }

  return {
    event: {
      id: draft.id ?? DRAFT_EVENT_PREVIEW_ID,
      name: draft.name || 'Untitled event',
      description: draft.description || null,
      date: losAngelesDateTimeToIso(dateOnly, time),
      start_time: draft.start_time || null,
      end_time: draft.end_time || null,
      end_date: draft.end_date || null,
      location: draft.location || null,
      points: draft.points ?? 0,
      event_type: draft.event_type ?? 'other',
      image_url: imageUrl || null,
      thumbnail_url: imageUrl ? thumbnailUrl : null,
      is_published: draft.is_published ?? true,
      academic_term_id: draft.academic_term_id ?? null,
      interest_counts: draft.interest_counts ?? null,
    },
  };
}
