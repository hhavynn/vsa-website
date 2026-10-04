import { format } from 'date-fns';
import { motion, useReducedMotion } from 'framer-motion';
import { Badge, BadgeColor } from '../../ui/Badge';
import { AddToCalendarButton } from './AddToCalendarButton';
import { EventInterestButtons } from './EventInterestButtons';
import { EVENT_TYPE_LABELS } from '../../../constants/eventTypes';
import { HOUSE_COLORS, HOUSE_LABELS, normalizeHouse } from '../../../constants/houses';
import { readableInk } from '../../../lib/readableInk';
import { getAcademicTermMeta } from '../../../lib/academicTerms';
import { formatEventDateRange, formatEventTimeRange, getEventDateOnly } from '../../../lib/eventTime';
import { parseDateOnly } from '../../../lib/dateOnly';
import { OptimizedImage } from '../../common/OptimizedImage';
import { AcademicTerm, Event, ExternalEvent } from '../../../types';
import { ExternalEventLinks, ExternalHostedBy } from './ExternalEventHost';
import { eventAnchorId } from '../../../lib/eventGalleryLinks';

// Public event renderers shared by the /events page and the admin
// "Preview As Public" dialog, so a draft is drawn by the exact same markup.

export const TYPE_COLOR: Record<string, BadgeColor> = {
  gbm: 'green',
  mixer: 'blue',
  vcn: 'purple',
  wildn_culture: 'purple',
  winter_retreat: 'blue',
  other: 'gray',
  external_event: 'gray',
};

const HOUSE_EMOJI: Record<string, string> = {
  Bowser: '🐢',
  'Donkey Kong': '🦍',
  Boo: '👻',
  Toad: '🍄',
};

export interface EventMemoryStats {
  totalPoints: number;
  memberCount: number;
  topHouse: string | null;
  topHouseCount: number;
}

// The San Diego calendar day of an event, as a local-midnight Date for
// date-fns formatting. Formatting the raw timestamp would use the viewer's
// timezone and shift evening events to the next day outside Pacific time.
export function eventDay(event: Pick<Event, 'date' | 'start_time'>): Date {
  return parseDateOnly(getEventDateOnly(event.date, event.start_time)) ?? new Date(event.date);
}

function getEventTerm(event: Event, terms: AcademicTerm[]) {
  const assignedTerm = event.academic_term_id
    ? terms.find((term) => term.id === event.academic_term_id)
    : null;

  if (assignedTerm) return assignedTerm;

  const inferredTerm = getAcademicTermMeta(event.date);
  if (!inferredTerm) return null;

  return terms.find((term) => term.code === inferredTerm.code) ?? null;
}

function getEventTermLabel(event: Event, terms: AcademicTerm[]) {
  const term = getEventTerm(event, terms);
  if (term) return term.label;
  return getAcademicTermMeta(event.date)?.label ?? 'Unassigned';
}

function getEventTermCode(event: Event, terms: AcademicTerm[]) {
  const term = getEventTerm(event, terms);
  if (term) return term.code;
  return getAcademicTermMeta(event.date)?.code ?? 'TERM';
}

export function EventImage({
  event,
  className,
  titleClassName,
  imageWidth = 720,
  imageHeight = 432,
  priority = false,
  resize = 'cover',
  sizes = '(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw',
}: {
  event: Event;
  className: string;
  titleClassName: string;
  imageWidth?: number;
  imageHeight?: number;
  priority?: boolean;
  resize?: 'cover' | 'contain';
  sizes?: string;
}) {
  // Thumbnail (720w) is what these slots already render; keep it rather than
  // adding the 1200w full file as a srcset candidate (more egress, little gain).
  const imageUrl = event.thumbnail_url || event.image_url;

  return (
    <OptimizedImage
      src={imageUrl}
      width={imageWidth}
      height={imageHeight}
      sizes={sizes}
      widths={[Math.round(imageWidth / 2), imageWidth]}
      resize={resize}
      alt={event.name}
      className={className}
      priority={priority}
      fallback={
        <div
          className={`scrapbook-note flex items-center justify-center border ${className}`}
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}
        >
          <span className={titleClassName} style={{ color: 'var(--color-text2)' }}>
            {event.name}
          </span>
        </div>
      }
    />
  );
}

export function PastEventMemoryCard({
  event,
  linkedAlbum,
  recap,
  stats,
  terms,
  index,
  external,
}: {
  event: Event;
  linkedAlbum?: string;
  recap?: string;
  stats?: EventMemoryStats;
  terms: AcademicTerm[];
  index: number;
  /** The UVSA Network listing for an external event, when it has one. */
  external?: ExternalEvent | null;
}) {
  const d = eventDay(event);
  const termCode = getEventTermCode(event, terms);
  const termLabel = getEventTermLabel(event, terms);
  const houseKey = stats?.topHouse ? normalizeHouse(stats.topHouse) : null;
  const houseLabel = houseKey ? HOUSE_LABELS[houseKey] : stats?.topHouse?.trim() || null;
  const houseColor = houseKey ? HOUSE_COLORS[houseKey] : houseLabel ? 'var(--brand)' : null;
  const houseEmoji = houseKey ? (HOUSE_EMOJI[houseKey] ?? '') : '';
  const hasPoints = event.points > 0;
  const hasTotalPoints = stats && stats.totalPoints > 0;

  // Deterministic rotation
  const rotationClass = index % 3 === 0 ? 'scrapbook-rotate-sm-left' : index % 3 === 1 ? 'scrapbook-rotate-sm-right' : '';

  return (
    <motion.div
      id={eventAnchorId(event.id)}
      whileHover={{ y: -4, rotate: 0 }}
      transition={{ duration: 0.2 }}
      className={`scrapbook-photo group/spotlight relative scroll-mt-24 min-w-[82vw] snap-start overflow-hidden transition-all duration-300 before:pointer-events-none before:absolute before:inset-0 before:z-10 before:bg-[radial-gradient(circle_at_50%_0%,rgba(59,189,181,0.22),transparent_46%)] before:opacity-55 before:transition-opacity before:duration-300 after:pointer-events-none after:absolute after:inset-0 after:z-10 after:bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.1)_44%,transparent_58%)] after:opacity-0 after:transition-opacity after:duration-300 active:scale-[0.98] active:border-brand-400/80 hover:border-brand-400/70 hover:shadow-[0_18px_42px_rgba(15,23,42,0.18)] hover:before:opacity-100 hover:after:opacity-100 sm:before:opacity-0 md:min-w-0 dark:hover:shadow-[0_18px_42px_rgba(0,0,0,0.38)] scrapbook-hover-tilt ${rotationClass}`}
    >
      {/* Image with optional gallery overlay */}
      <div className="relative">
        <EventImage
          event={event}
          className="aspect-[5/3] w-full object-cover"
          titleClassName="px-5 text-center font-serif italic leading-[1.08] tracking-[-0.03em] text-[22px]"
          imageWidth={520}
          imageHeight={312}
        />
        {linkedAlbum && (
          <a
            href={linkedAlbum}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm transition-opacity hover:bg-black/80"
            aria-label={`View photos from ${event.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            View Photos
          </a>
        )}
      </div>

      {/* Caption */}
      <div className="px-3 py-3">
        {/* Name + date */}
        <div className="flex items-start justify-between gap-2">
          <span className="font-sans text-sm font-semibold leading-snug" style={{ color: 'var(--color-text)' }}>
            {event.name}
          </span>
          <span className="shrink-0 font-mono text-[10px] tracking-[.04em]" style={{ color: 'var(--color-text3)' }}>
            {format(d, 'MMM d, yyyy')}
          </span>
        </div>

        {/* Term sticker + type */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="scrapbook-sticker scrapbook-sticker-gold px-2 py-0.5 text-[9px]">{termCode}</span>
          <span className="font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>{termLabel}</span>
          <span className="font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>·</span>
          <span className="font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
            {EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
          </span>
        </div>

        {external && (
          <div className="mt-2.5">
            <ExternalHostedBy listing={external} compact />
          </div>
        )}

        {/* Stats row */}
        {(hasPoints || hasTotalPoints || houseKey) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {(hasPoints || hasTotalPoints) && (
              <span className="scrapbook-sticker scrapbook-sticker-teal px-2 py-0.5 text-[9px]">
                {hasPoints ? `+${event.points} pts each` : ''}
                {hasPoints && hasTotalPoints ? ' · ' : ''}
                {hasTotalPoints ? `${stats!.totalPoints.toLocaleString()} total` : ''}
              </span>
            )}
            {houseLabel && houseColor && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider"
                style={{ background: houseColor, color: readableInk(houseColor) }}
                title={`${houseLabel} had the most members attend`}
              >
                {houseEmoji} {houseLabel} led
              </span>
            )}
          </div>
        )}

        {/* Public recap highlight */}
        {recap && (
          <blockquote
            className="mt-2.5 border-l-2 pl-2.5 font-serif text-[12px] italic leading-relaxed line-clamp-3"
            style={{ borderColor: 'var(--accent)', color: 'var(--color-text2)' }}
          >
            "{recap}"
          </blockquote>
        )}

        {/* Attendance count */}
        {stats && stats.memberCount > 0 && (
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
            {stats.memberCount} members attended
          </p>
        )}
      </div>
    </motion.div>
  );
}

/** The large "Next Up" flyer for the soonest upcoming event. */
export function FeaturedEventCard({ event, external }: { event: Event; external?: ExternalEvent | null }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="scrapbook-paper mb-9 flex flex-col-reverse overflow-hidden lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,1.08fr)]"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <span className="scrapbook-pin" aria-hidden />
      <div className="p-6 sm:p-8 lg:border-r" style={{ borderColor: 'var(--color-border)' }}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Badge
            label={EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
            color={TYPE_COLOR[event.event_type] ?? 'gray'}
          />
          <span className="font-mono text-[11px] uppercase tracking-[.04em]" style={{ color: 'var(--color-text3)' }}>
            {event.start_time && event.end_time
              ? `${format(eventDay(event), 'MMM d / EEEE')} / ${formatEventTimeRange(event.start_time, event.end_time)}`
              : event.end_date && event.end_date !== getEventDateOnly(event.date, event.start_time)
                ? formatEventDateRange(event.date, event.end_date, event.start_time)
                : format(eventDay(event), 'MMM d / EEEE')}
          </span>
        </div>
        <h2 className="mb-4 font-serif text-[32px] leading-[1.05] tracking-[-0.03em] sm:text-[42px]" style={{ color: 'var(--color-text)' }}>
          {event.name}
        </h2>
        {event.description && (
          <p className="mb-6 line-clamp-4 font-sans text-[15px] leading-[1.75]" style={{ color: 'var(--color-text2)' }}>
            {event.description}
          </p>
        )}
        {event.location && (
          <div className="mb-7 flex items-center gap-2 font-sans text-sm uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            {event.location}
          </div>
        )}
        {external && (
          <div className="mb-7 space-y-4">
            <ExternalHostedBy listing={external} />
            <ExternalEventLinks listing={external} />
          </div>
        )}
        <div className="flex flex-col gap-6">
          <AddToCalendarButton event={event} variant="ghost" align="left" />
          <EventInterestButtons eventId={event.id} initialCounts={event.interest_counts || null} />
        </div>
      </div>

      <div className="relative flex min-h-[320px] flex-col justify-center bg-[var(--color-surface2)] p-4 sm:min-h-[380px] sm:p-6 lg:min-h-[460px] lg:p-7">
        <div className="scrapbook-photo relative mx-auto flex h-full min-h-[280px] w-full max-w-none rotate-[1deg] items-center justify-center overflow-hidden bg-[var(--color-surface)] transition-transform hover:rotate-0 sm:min-h-[340px] lg:min-h-[400px]">
          <EventImage
            event={event}
            className="h-full w-full object-contain"
            titleClassName="px-8 text-center font-serif italic leading-[1.04] tracking-[-0.03em] text-[38px]"
            imageWidth={1100}
            imageHeight={900}
            resize="contain"
            sizes="(min-width: 1024px) 48vw, 100vw"
            priority
          />
        </div>
        <div
          className="absolute top-6 right-6 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md lg:bottom-12 lg:right-12 lg:top-auto"
          style={{ borderColor: 'rgba(255,255,255,0.25)', background: 'rgba(5, 9, 18, 0.45)' }}
        >
          <div className="font-serif leading-none tracking-[-0.04em] text-brand-400" style={{ fontSize: 44 }}>
            {format(eventDay(event), 'd')}
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[.1em] text-white/80">
            {format(eventDay(event), 'MMMM yyyy')}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/** One row in the "All Upcoming" list. */
export function UpcomingEventRow({ event, external }: { event: Event; external?: ExternalEvent | null }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      className="scrapbook-paper grid gap-4 p-4 sm:grid-cols-[104px_minmax(0,1fr)] lg:grid-cols-[88px_240px_minmax(0,1fr)_auto]"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <span className="scrapbook-pin" aria-hidden />
      <div className="relative order-1 overflow-hidden rounded bg-[var(--color-surface2)] p-2 sm:order-2">
        <EventImage
          event={event}
          className="aspect-[4/3] max-h-[260px] w-full object-cover sm:max-h-none"
          titleClassName="px-4 text-center font-serif italic leading-[1.08] tracking-[-0.03em] text-[24px]"
          imageWidth={560}
          imageHeight={420}
          sizes="(min-width: 1024px) 240px, 100vw"
        />
      </div>

      <div className="order-2 border-b pb-4 text-center sm:order-1 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4" style={{ borderColor: 'var(--color-border)' }}>
        <div className="font-mono text-[10px] uppercase tracking-[.08em]" style={{ color: 'var(--color-text3)' }}>
          {format(eventDay(event), 'MMM')}
        </div>
        <div className="mt-1 font-serif text-[38px] leading-none" style={{ color: 'var(--color-text)' }}>
          {format(eventDay(event), 'd')}
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[.08em]" style={{ color: 'var(--color-text3)' }}>
          {format(eventDay(event), 'EEE')}
        </div>
      </div>

      <div className="order-3 min-w-0 sm:col-span-2 sm:order-3 lg:col-auto lg:py-1">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Badge
            label={EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
            color={TYPE_COLOR[event.event_type] ?? 'gray'}
          />
          <span className="font-mono text-[11px] uppercase tracking-[.04em]" style={{ color: 'var(--color-text3)' }}>
            {event.start_time && event.end_time
              ? `${format(eventDay(event), 'MMM d')} / ${formatEventTimeRange(event.start_time, event.end_time)}`
              : event.end_date && event.end_date !== getEventDateOnly(event.date, event.start_time)
                ? formatEventDateRange(event.date, event.end_date, event.start_time)
                : format(eventDay(event), 'MMM d')}
          </span>
        </div>
        <h3 className="font-sans text-[18px] font-semibold tracking-[-0.02em]" style={{ color: 'var(--color-text)' }}>
          {event.name}
        </h3>
        {event.description && (
          <p className="mt-2 line-clamp-3 max-w-2xl font-sans text-sm leading-[1.7]" style={{ color: 'var(--color-text2)' }}>
            {event.description}
          </p>
        )}
        {event.location && (
          <p className="mt-2 font-sans text-xs uppercase tracking-[.06em]" style={{ color: 'var(--color-text3)' }}>
            {event.location}
          </p>
        )}
        {external && (
          <div className="mt-4 space-y-3">
            <ExternalHostedBy listing={external} />
            <ExternalEventLinks listing={external} />
          </div>
        )}
      </div>

      <div className="order-4 flex flex-col items-start gap-4 pt-1 sm:col-span-2 sm:order-4 lg:col-auto lg:items-end lg:justify-start">
        <AddToCalendarButton event={event} align="right" />
        <div className="w-full lg:w-auto">
          <EventInterestButtons eventId={event.id} initialCounts={event.interest_counts || null} compact />
        </div>
      </div>
    </motion.div>
  );
}
