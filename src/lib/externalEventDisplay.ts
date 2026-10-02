import { ExternalEvent } from "../types";
import { formatDateOnly } from "./dateOnly";
import { formatEventTime, formatEventTimeRange } from "./eventTime";

/**
 * A flyer URL is safe to render when it is https or a root-relative static
 * asset (events migrated to /images/... keep that shape). Anything else, such
 * as `javascript:`, `data:` or a protocol-relative `//host`, is dropped.
 */
export function getSafeFlyerUrl(url?: string | null): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  try {
    return new URL(trimmed).protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * Flyer URLs to try, in order. A linked listing reuses its normal event's
 * images (thumbnail first, like /events, then the full image) so the flyer is
 * never uploaded twice; the listing's own `image_url` is the flyer for
 * standalone externals and the last resort for a linked one. The school's
 * logo / PFP is never a candidate.
 */
export function getExternalFlyerCandidates(
  event: Pick<ExternalEvent, "image_url" | "source_event">,
): string[] {
  const candidates = [
    event.source_event?.thumbnail_url,
    event.source_event?.image_url,
    event.image_url,
  ]
    .map(getSafeFlyerUrl)
    .filter((url): url is string => url !== null);
  return Array.from(new Set(candidates));
}

/** "Sat, Nov 14 · 6 PM" / "Sat, Nov 14 · 6 – 9 PM"; the time only when the linked event has one. */
export function formatExternalWhen(
  event: Pick<ExternalEvent, "date" | "source_event">,
): string | null {
  if (!event.date) return null;
  const day = formatDateOnly(event.date, "EEE, MMM d");
  const start = event.source_event?.start_time;
  const end = event.source_event?.end_time;
  if (!start) return day;
  return `${day} · ${end ? formatEventTimeRange(start, end) : formatEventTime(start)}`;
}

/** Month and day for the no-flyer fallback tile, e.g. { month: 'NOV', day: '14' }. */
export function getExternalDateTile(
  event: Pick<ExternalEvent, "date">,
): { month: string; day: string } | null {
  if (!event.date) return null;
  return {
    month: formatDateOnly(event.date, "MMM").toUpperCase(),
    day: formatDateOnly(event.date, "d"),
  };
}
