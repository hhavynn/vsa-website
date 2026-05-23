import { format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { PageLoader } from '../components/common/PageLoader';
import { PageTitle } from '../components/common/PageTitle';
import { Badge, BadgeColor } from '../components/ui/Badge';
import { Label } from '../components/ui/Label';
import { AddToCalendarButton } from '../components/features/events/AddToCalendarButton';
import { EVENT_TYPE_LABELS } from '../constants/eventTypes';
import { getAcademicTermMeta } from '../lib/academicTerms';
import { getSupabaseImageSrcSet, getSupabaseImageUrl } from '../lib/supabaseImages';
import { supabase } from '../lib/supabase';
import { useAcademicTerms } from '../hooks/useAcademicTerms';
import { useEvents } from '../hooks/useEvents';
import { AcademicTerm, Event } from '../types';

type FilterKey = 'all' | Event['event_type'];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'gbm', label: 'GBM' },
  { key: 'mixer', label: 'Mixer' },
  { key: 'vcn', label: 'VCN' },
  { key: 'winter_retreat', label: 'Retreat' },
  { key: 'wildn_culture', label: "Wild n' Culture" },
  { key: 'external_event', label: 'External' },
  { key: 'other', label: 'Other' },
];

const TYPE_COLOR: Record<string, BadgeColor> = {
  gbm: 'green',
  mixer: 'blue',
  vcn: 'purple',
  wildn_culture: 'purple',
  winter_retreat: 'blue',
  other: 'gray',
  external_event: 'gray',
};

type ArchiveTermOption = AcademicTerm | { id: 'unassigned'; label: 'Unassigned Dates' };

function sortTermsByDateDesc(a: AcademicTerm, b: AcademicTerm) {
  const aDate = a.starts_on ? new Date(a.starts_on).getTime() : a.display_order;
  const bDate = b.starts_on ? new Date(b.starts_on).getTime() : b.display_order;
  return bDate - aDate;
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

function eventMatchesTerm(event: Event, term: AcademicTerm, terms: AcademicTerm[]) {
  return getEventTerm(event, terms)?.id === term.id;
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

function EventImage({
  event,
  className,
  titleClassName,
  imageWidth = 720,
  imageHeight = 432,
  priority = false,
}: {
  event: Event;
  className: string;
  titleClassName: string;
  imageWidth?: number;
  imageHeight?: number;
  priority?: boolean;
}) {
  if (event.image_url) {
    return (
      <img
        src={getSupabaseImageUrl(event.image_url, {
          width: imageWidth,
          height: imageHeight,
          resize: 'cover',
          quality: 72,
        })}
        srcSet={getSupabaseImageSrcSet(event.image_url, [Math.round(imageWidth / 2), imageWidth], {
          resize: 'cover',
          quality: 72,
        })}
        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
        alt={event.name}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />
    );
  }

  return (
    <div
      className={`scrapbook-note flex items-center justify-center border ${className}`}
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}
    >
      <span className={titleClassName} style={{ color: 'var(--color-text2)' }}>
        {event.name}
      </span>
    </div>
  );
}

export function Events() {
  const { events, loading, error } = useEvents();
  const { terms } = useAcademicTerms();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [selectedArchiveTermId, setSelectedArchiveTermId] = useState<string | null>(null);
  // Map of event_id -> google_photos_url for events that have a linked album.
  // Lightweight side fetch so we don't have to grow EventsRepository for this MVP.
  const [linkedAlbums, setLinkedAlbums] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('gallery_events')
      .select('event_id, google_photos_url')
      .not('event_id', 'is', null)
      .not('google_photos_url', 'is', null)
      .then(({ data, error: err }) => {
        if (cancelled || err || !data) return;
        const map: Record<string, string> = {};
        for (const row of data as Array<{ event_id: string | null; google_photos_url: string | null }>) {
          if (row.event_id && row.google_photos_url && !map[row.event_id]) {
            // First album per event wins (MVP: single album link).
            map[row.event_id] = row.google_photos_url;
          }
        }
        setLinkedAlbums(map);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const upcomingAll = events
    .filter((event: Event) => new Date(event.date) >= oneDayAgo)
    .sort((a: Event, b: Event) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const pastAll = events
    .filter((event: Event) => new Date(event.date) < oneDayAgo)
    .sort((a: Event, b: Event) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filterFn = (event: Event) => activeFilter === 'all' || event.event_type === activeFilter;
  const upcomingEvents = upcomingAll.filter(filterFn);
  const pastEvents = pastAll.filter(filterFn);
  const [featured, ...rest] = upcomingEvents;
  const activeTerm = terms.find((term) => term.is_active) ?? terms.find((term) => term.code === getAcademicTermMeta(now)?.code);

  const archiveTerms = useMemo(
    () =>
      terms
        .filter((term) => pastAll.some((event) => eventMatchesTerm(event, term, terms)))
        .sort(sortTermsByDateDesc),
    [pastAll, terms]
  );
  const hasUnassignedPastEvents = pastAll.some((event) => !getEventTerm(event, terms));
  const archiveOptions: ArchiveTermOption[] = hasUnassignedPastEvents
    ? [...archiveTerms, { id: 'unassigned', label: 'Unassigned Dates' }]
    : archiveTerms;
  const effectiveArchiveTermId =
    selectedArchiveTermId && archiveOptions.some((term) => term.id === selectedArchiveTermId)
      ? selectedArchiveTermId
      : archiveOptions[0]?.id ?? null;
  const selectedArchiveTerm = archiveOptions.find((term) => term.id === effectiveArchiveTermId);
  const archivedEvents = effectiveArchiveTermId
    ? pastEvents.filter((event) => {
        if (effectiveArchiveTermId === 'unassigned') return !getEventTerm(event, terms);
        const term = terms.find((item) => item.id === effectiveArchiveTermId);
        return term ? eventMatchesTerm(event, term, terms) : false;
      })
    : pastEvents;

  if (loading) {
    return (
      <>
        <PageTitle title="Events" />
        <PageLoader message="Loading events..." />
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageTitle title="Events" />
        <div className="mx-auto max-w-4xl px-8 py-20 text-center">
          <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
            Error loading events: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle title="Events" />

      <div className="vsa-page-hero">
        <div className="vsa-container relative z-10">
          <span className="scrapbook-sticker scrapbook-sticker-coral mb-4">Flyer Board</span>
          <h1 className="vsa-page-title">Events</h1>
          <p className="mt-3 max-w-2xl font-sans text-[15px] leading-[1.8]" style={{ color: 'var(--text2)' }}>
            Keep up with GBMs, mixers, cultural programs, and VSA traditions. {upcomingAll.length} upcoming / {pastAll.length} past.
          </p>
          {activeTerm && (
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--text3)' }}>
              Current term / {activeTerm.label}
            </p>
          )}

          <div className="vsa-filter-bar">
            {FILTERS.filter((filter) => filter.key === 'all' || events.some((event) => event.event_type === filter.key)).map(
              (filter) => (
                <button
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  className={`vsa-filter-btn ${activeFilter === filter.key ? 'active' : ''}`}
                >
                  {filter.label}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <div className="vsa-container py-8 lg:py-10">
        {featured && (
          <>
            <Label className="mb-5 text-brand-600 dark:text-brand-400">Next Up</Label>
            <div
              className="scrapbook-paper mb-9 flex flex-col-reverse overflow-hidden lg:grid lg:grid-cols-[1fr_0.75fr]"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <span className="scrapbook-pin" aria-hidden />
              <div className="p-6 sm:p-8 lg:border-r" style={{ borderColor: 'var(--color-border)' }}>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <Badge
                    label={EVENT_TYPE_LABELS[featured.event_type] ?? featured.event_type}
                    color={TYPE_COLOR[featured.event_type] ?? 'gray'}
                  />
                  <span className="font-mono text-[11px] uppercase tracking-[.04em]" style={{ color: 'var(--color-text3)' }}>
                    {format(new Date(featured.date), 'MMM d / EEEE / h:mm a')}
                  </span>
                </div>
                <h2 className="mb-4 font-serif text-[32px] leading-[1.05] tracking-[-0.03em] sm:text-[42px]" style={{ color: 'var(--color-text)' }}>
                  {featured.name}
                </h2>
                {featured.description && (
                  <p className="mb-6 line-clamp-4 font-sans text-[15px] leading-[1.75]" style={{ color: 'var(--color-text2)' }}>
                    {featured.description}
                  </p>
                )}
                {featured.location && (
                  <div className="mb-7 flex items-center gap-2 font-sans text-sm uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                    {featured.location}
                  </div>
                )}
                <AddToCalendarButton event={featured} variant="ghost" align="left" />
              </div>

              <div className="relative flex flex-col justify-center bg-[var(--color-surface2)] p-6 sm:p-10 lg:p-12">
                <div className="scrapbook-photo relative mx-auto w-full max-w-[400px] rotate-[1deg] transition-transform hover:rotate-0">
                  <EventImage
                    event={featured}
                    className="max-h-[340px] w-full object-contain lg:max-h-none"
                    titleClassName="px-8 text-center font-serif italic leading-[1.04] tracking-[-0.03em] text-[38px]"
                    imageWidth={800}
                    imageHeight={1000}
                    priority
                  />
                </div>
                <div
                  className="absolute top-6 right-6 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md lg:bottom-12 lg:right-12 lg:top-auto"
                  style={{ borderColor: 'rgba(255,255,255,0.25)', background: 'rgba(5, 9, 18, 0.45)' }}
                >
                  <div className="font-serif leading-none tracking-[-0.04em] text-brand-400" style={{ fontSize: 44 }}>
                    {format(new Date(featured.date), 'd')}
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[.1em] text-white/80">
                    {format(new Date(featured.date), 'MMMM yyyy')}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {rest.length > 0 && (
          <>
            <Label className="mb-0">All Upcoming</Label>
            <div className="mt-5 mb-10 grid gap-4">
              {rest.map((event: Event) => (
                <div
                  key={event.id}
                  className="scrapbook-paper grid gap-4 p-4 sm:grid-cols-[88px_minmax(0,1fr)] lg:grid-cols-[88px_200px_minmax(0,1fr)_auto]"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="relative order-1 bg-[var(--color-surface2)] p-2 sm:order-none">
                    <EventImage
                      event={event}
                      className="aspect-[4/5] max-h-[280px] w-full object-contain sm:max-h-none"
                      titleClassName="px-4 text-center font-serif italic leading-[1.08] tracking-[-0.03em] text-[24px]"
                      imageWidth={400}
                      imageHeight={500}
                    />
                  </div>

                  <div className="order-2 border-b pb-4 text-center sm:order-none sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="font-mono text-[10px] uppercase tracking-[.08em]" style={{ color: 'var(--color-text3)' }}>
                      {format(new Date(event.date), 'MMM')}
                    </div>
                    <div className="mt-1 font-serif text-[38px] leading-none" style={{ color: 'var(--color-text)' }}>
                      {format(new Date(event.date), 'd')}
                    </div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[.08em]" style={{ color: 'var(--color-text3)' }}>
                      {format(new Date(event.date), 'EEE')}
                    </div>
                  </div>

                  <div className="order-3 min-w-0 sm:col-span-2 sm:order-none lg:col-auto lg:py-1">
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <Badge
                        label={EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
                        color={TYPE_COLOR[event.event_type] ?? 'gray'}
                      />
                      <span className="font-mono text-[11px] uppercase tracking-[.04em]" style={{ color: 'var(--color-text3)' }}>
                        {format(new Date(event.date), 'MMM d / h:mm a')}
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
                  </div>

                  <div className="order-4 flex items-start pt-1 sm:col-span-2 sm:order-none lg:col-auto lg:justify-end">
                    <AddToCalendarButton event={event} align="right" />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {upcomingEvents.length === 0 && (
          <div
            className="scrapbook-empty mb-10"
          >
            <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
              No upcoming events - check back soon.
            </p>
          </div>
        )}

        {pastEvents.length > 0 && (
          <>
            <div className="border-t" style={{ borderColor: 'var(--color-border)' }} />
            <div className="mt-7" style={{ opacity: 0.72 }}>
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <Label className="mb-2">Past Events Archive</Label>
                  <p className="max-w-xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                    Browse previous events by academic term. Events without a saved term are matched by date when possible.
                  </p>
                </div>
                {archiveOptions.length > 0 && (
                  <div className="min-w-[220px]">
                    <label className="mb-1 block font-sans text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
                      Term
                    </label>
                    <select
                      value={effectiveArchiveTermId ?? ''}
                      onChange={(event) => setSelectedArchiveTermId(event.target.value || null)}
                      className="scrapbook-select"
                    >
                      {archiveOptions.map((term) => (
                        <option key={term.id} value={term.id}>
                          {term.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {archivedEvents.length === 0 ? (
                <div
                  className="rounded border p-10 text-center"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                >
                  <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                    No {activeFilter === 'all' ? '' : `${FILTERS.find((filter) => filter.key === activeFilter)?.label ?? ''} `}
                    events found for {selectedArchiveTerm?.label ?? 'this term'}.
                  </p>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {archivedEvents.map((event: Event) => (
                    <div
                      key={event.id}
                      className="scrapbook-photo overflow-hidden"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                    >
                      <EventImage
                        event={event}
                        className="aspect-[5/3] w-full object-cover"
                        titleClassName="px-5 text-center font-serif italic leading-[1.08] tracking-[-0.03em] text-[22px]"
                        imageWidth={520}
                        imageHeight={312}
                      />
                      <div className="px-2 py-3">
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-sans text-sm" style={{ color: 'var(--color-text)' }}>
                            {event.name}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] tracking-[.04em]" style={{ color: 'var(--color-text3)' }}>
                            {format(new Date(event.date), 'MMM d')}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
                            {getEventTermCode(event, terms)}
                          </span>
                          <span className="font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                            {getEventTermLabel(event, terms)}
                          </span>
                        </div>
                        {linkedAlbums[event.id] && (
                          <a
                            href={linkedAlbums[event.id]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="scrapbook-sticker scrapbook-sticker-coral mt-3 inline-flex items-center gap-1.5"
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
