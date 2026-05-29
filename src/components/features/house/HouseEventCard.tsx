import { HouseEvent, HousePageAsset } from '../../../types';
import { HOUSE_COLORS, HOUSE_LABELS, HouseName } from '../../../constants/houses';
import { formatDateOnly } from '../../../lib/dateOnly';
import { buildGcalTimedDates, formatEventTimeRange } from '../../../lib/eventTime';
import { getSupabaseImageUrl } from '../../../lib/supabaseImages';

function nextDateOnly(dateOnly: string): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function datePart(dateOnly: string): string {
  return dateOnly.replace(/-/g, '');
}

function buildHouseEventCalendarUrl(event: HouseEvent, houseLabel: string) {
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', `${houseLabel}: ${event.title}`);

  if (event.start_time && event.end_time) {
    url.searchParams.set('dates', buildGcalTimedDates(event.event_date, event.start_time, event.end_time));
    url.searchParams.set('ctz', 'America/Los_Angeles');
  } else {
    url.searchParams.set('dates', `${datePart(event.event_date)}/${nextDateOnly(event.event_date)}`);
  }

  if (event.description) url.searchParams.set('details', event.description);
  if (event.location) url.searchParams.set('location', event.location);
  return url.toString();
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 shrink-0" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="2.5" width="12" height="10.5" rx="1.5" />
      <path d="M1 6h12" strokeLinecap="round" />
      <path d="M4.5 1v3M9.5 1v3" strokeLinecap="round" />
    </svg>
  );
}

interface HouseEventCardProps {
  event: HouseEvent;
  house: HousePageAsset;
  isUpcoming: boolean;
}

export function HouseEventCard({
  event,
  house,
  isUpcoming,
}: HouseEventCardProps) {
  const eventHouses = event.houses && event.houses.length > 0 ? event.houses : [house];
  const color = house.accent_color || HOUSE_COLORS[house.house as HouseName] || 'var(--brand)';
  const imageUrl = event.image_thumbnail_url || event.image_url || house.image_thumbnail_url || house.image_url;
  const timeLabel = event.start_time && event.end_time ? formatEventTimeRange(event.start_time, event.end_time) : null;

  return (
    <article
      className="scrapbook-paper overflow-hidden transition-all hover:shadow-md"
      style={{ borderColor: `${color}55` }}
    >
      <div className="grid gap-0 sm:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Image Area */}
        <div className="relative min-h-[200px] bg-[var(--color-surface2)] sm:min-h-0">
          {imageUrl ? (
            <img
              src={getSupabaseImageUrl(imageUrl, { width: 480, height: 360, resize: 'cover', quality: 72 })}
              alt={event.title}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full min-h-[200px] items-center justify-center">
              <span className="font-serif text-3xl italic" style={{ color }}>VSA</span>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex min-w-0 flex-col p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="scrapbook-sticker scrapbook-sticker-teal px-2 py-0.5 text-[9px]">House Event</span>
            <div className="flex flex-wrap gap-1.5">
              {eventHouses.map((h) => {
                const hColor = h.accent_color || HOUSE_COLORS[h.house as HouseName] || 'var(--brand)';
                const hLabel = h.display_name || HOUSE_LABELS[h.house as HouseName] || h.house_key || h.house;
                return (
                  <span
                    key={h.id}
                    className="rounded-sm px-[7px] py-[2px] font-mono text-[10px] font-bold uppercase tracking-wider text-white"
                    style={{ background: hColor }}
                  >
                    {hLabel}
                  </span>
                );
              })}
            </div>
          </div>

          <h3 className="font-serif text-2xl leading-tight" style={{ color: 'var(--color-text)' }}>
            {event.title}
          </h3>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="font-mono text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
              {formatDateOnly(event.event_date, 'MMM d, yyyy')}
              {timeLabel ? ` / ${timeLabel}` : ''}
            </p>
            {event.location && (
              <p className="font-sans text-[12px] font-medium" style={{ color: 'var(--color-text2)' }}>
                📍 {event.location}
              </p>
            )}
          </div>

          {event.description && (
            <p className="mt-4 line-clamp-3 font-sans text-[13px] leading-relaxed" style={{ color: 'var(--color-text2)' }}>
              {event.description}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {isUpcoming && event.google_calendar_enabled && (
              <a
                href={buildHouseEventCalendarUrl(event, eventHouses.map(h => h.display_name || h.house_key).join(' + '))}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors hover:bg-[var(--color-surface2)]"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
              >
                <CalendarIcon />
                Add to Calendar
              </a>
            )}
            {event.rsvp_url && (
              <a
                href={event.rsvp_url}
                target="_blank"
                rel="noopener noreferrer"
                className="vsa-btn-primary px-4 py-2 text-[11px]"
              >
                RSVP Now
              </a>
            )}
            {event.gallery_url && (
              <a
                href={event.gallery_url}
                target="_blank"
                rel="noopener noreferrer"
                className="vsa-btn-ghost px-3 py-2 text-[11px]"
              >
                View Gallery
              </a>
            )}
            {event.recap_url && (
              <a
                href={event.recap_url}
                target="_blank"
                rel="noopener noreferrer"
                className="vsa-btn-ghost px-3 py-2 text-[11px]"
              >
                Read Recap
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
