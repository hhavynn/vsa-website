import { format, parseISO } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { PageLoader } from '../components/common/PageLoader';
import { PageTitle } from '../components/common/PageTitle';
import { Badge, BadgeColor } from '../components/ui/Badge';
import { Label } from '../components/ui/Label';
import { AddToCalendarButton } from '../components/features/events/AddToCalendarButton';
import { EVENT_TYPE_LABELS } from '../constants/eventTypes';
import { HOUSE_COLORS, HOUSE_LABELS, normalizeHouse } from '../constants/houses';
import { getAcademicTermMeta } from '../lib/academicTerms';
import { getSupabaseImageSrcSet, getSupabaseImageUrl } from '../lib/supabaseImages';
import { supabase } from '../lib/supabase';
import { useAcademicTerms } from '../hooks/useAcademicTerms';
import { useEvents, useInfiniteEvents } from '../hooks/useEvents';
import { AcademicTerm, Event } from '../types';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';
import { motion } from 'framer-motion';

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

const HOUSE_EMOJI: Record<string, string> = {
  Bowser: '🐢',
  'Donkey Kong': '🦍',
  Boo: '👻',
  Toad: '🍄',
};

interface EventMemoryStats {
  totalPoints: number;
  memberCount: number;
  topHouse: string | null;
  topHouseCount: number;
}

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
  const imageUrl = event.thumbnail_url || event.image_url;

  if (imageUrl) {
    return (
      <img
        src={getSupabaseImageUrl(imageUrl, {
          width: imageWidth,
          height: imageHeight,
          resize: 'cover',
          quality: 72,
        })}
        srcSet={getSupabaseImageSrcSet(imageUrl, [Math.round(imageWidth / 2), imageWidth], {
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

function PastEventMemoryCard({
  event,
  linkedAlbum,
  recap,
  stats,
  terms,
  index,
}: {
  event: Event;
  linkedAlbum?: string;
  recap?: string;
  stats?: EventMemoryStats;
  terms: AcademicTerm[];
  index: number;
}) {
  const d = parseISO(event.date);
  const termCode = getEventTermCode(event, terms);
  const termLabel = getEventTermLabel(event, terms);
  const houseKey = stats?.topHouse ? normalizeHouse(stats.topHouse) : null;
  const houseLabel = houseKey ? HOUSE_LABELS[houseKey] : null;
  const houseColor = houseKey ? HOUSE_COLORS[houseKey] : null;
  const houseEmoji = houseKey ? (HOUSE_EMOJI[houseKey] ?? '') : '';
  const hasPoints = event.points > 0;
  const hasTotalPoints = stats && stats.totalPoints > 0;

  // Deterministic rotation
  const rotationClass = index % 3 === 0 ? 'scrapbook-rotate-sm-left' : index % 3 === 1 ? 'scrapbook-rotate-sm-right' : '';

  return (
    <motion.div 
      whileHover={{ y: -4, rotate: 0 }}
      transition={{ duration: 0.2 }}
      className={`scrapbook-photo overflow-hidden transition-all scrapbook-hover-tilt ${rotationClass}`}
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
            {houseKey && houseLabel && houseColor && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white"
                style={{ background: houseColor }}
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

export function Events() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [selectedArchiveTermId, setSelectedArchiveTermId] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const oneDayAgo = useMemo(() => new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), [now]);

  // 1. Fetch upcoming events
  const { events: upcomingEventsAll, loading: upcomingLoading, error: upcomingError } = useEvents({
    date_from: oneDayAgo,
    event_type: activeFilter === 'all' ? undefined : activeFilter,
    sort_ascending: true
  });

  const { terms } = useAcademicTerms();

  // 2. Fetch past events (paginated)
  const archiveTerms = useMemo(
    () => terms.filter(t => !t.is_active).sort(sortTermsByDateDesc),
    [terms]
  );
  
  const archiveOptions: ArchiveTermOption[] = useMemo(() => [
    ...archiveTerms,
    { id: 'unassigned', label: 'Unassigned Dates' }
  ], [archiveTerms]);

  const effectiveArchiveTermId =
    selectedArchiveTermId && archiveOptions.some((term) => term.id === selectedArchiveTermId)
      ? selectedArchiveTermId
      : archiveOptions[0]?.id ?? null;

  const {
    data: pastEventsData,
    isLoading: pastLoading,
    error: pastError,
    hasNextPage: hasMorePast,
    fetchNextPage: fetchMorePast,
    isFetchingNextPage: fetchingMorePast
  } = useInfiniteEvents({
    date_to: oneDayAgo,
    event_type: activeFilter === 'all' ? undefined : activeFilter,
    academic_term_id: effectiveArchiveTermId === 'unassigned' ? null : effectiveArchiveTermId,
    sort_ascending: false
  });

  const archivedEvents = useMemo(() => {
    return pastEventsData?.pages.flatMap(page => page) ?? [];
  }, [pastEventsData]);

  const [linkedAlbums, setLinkedAlbums] = useState<Record<string, string>>({});
  const [publishedRecaps, setPublishedRecaps] = useState<Record<string, string>>({});
  const [memoryStats, setMemoryStats] = useState<Record<string, EventMemoryStats>>({});

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
            map[row.event_id] = row.google_photos_url;
          }
        }
        setLinkedAlbums(map);
      });
    return () => { cancelled = true; };
  }, []);

  const [featured, ...rest] = upcomingEventsAll;
  const activeTerm = terms.find((term) => term.is_active) ?? terms.find((term) => term.code === getAcademicTermMeta(now.toISOString())?.code);

  const selectedArchiveTerm = archiveOptions.find((term) => term.id === effectiveArchiveTermId);

  // Batch-fetch published recaps + attendance stats for currently visible archived events.
  const archivedEventIds = archivedEvents.map((e) => e.id);
  const archivedEventIdsKey = archivedEventIds.join(',');

  useEffect(() => {
    if (archivedEventIds.length === 0) return;
    let cancelled = false;

    // 1. Published recap highlights
    supabase
      .from('event_recaps')
      .select('event_id, public_highlight')
      .in('event_id', archivedEventIds)
      .eq('is_public_highlight_published', true)
      .not('public_highlight', 'is', null)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setPublishedRecaps((prev) => {
          const next = { ...prev };
          for (const row of data as Array<{ event_id: string; public_highlight: string }>) {
            if (row.event_id && row.public_highlight) next[row.event_id] = row.public_highlight;
          }
          return next;
        });
      });

    // 2. Attendance stats
    supabase
      .from('member_event_attendance')
      .select('event_id, member_id, points_earned')
      .in('event_id', archivedEventIds)
      .then(async ({ data: attendanceRows }) => {
        if (cancelled || !attendanceRows || attendanceRows.length === 0) return;

        const rows = attendanceRows as Array<{ event_id: string; member_id: string; points_earned: number }>;
        const uniqueMemberIds = Array.from(new Set(rows.map((r) => r.member_id)));

        const { data: memberRows } = await supabase
          .from('members')
          .select('id, house')
          .in('id', uniqueMemberIds);

        if (cancelled) return;

        const houseByMember = new Map<string, string | null>();
        for (const m of (memberRows ?? []) as Array<{ id: string; house: string | null }>) {
          houseByMember.set(m.id, m.house ?? null);
        }

        const agg: Record<string, { totalPoints: number; memberCount: number; houseCounts: Record<string, number> }> = {};
        for (const r of rows) {
          if (!agg[r.event_id]) agg[r.event_id] = { totalPoints: 0, memberCount: 0, houseCounts: {} };
          agg[r.event_id].totalPoints += r.points_earned;
          agg[r.event_id].memberCount++;
          const house = houseByMember.get(r.member_id);
          if (house) agg[r.event_id].houseCounts[house] = (agg[r.event_id].houseCounts[house] ?? 0) + 1;
        }

        const stats: Record<string, EventMemoryStats> = {};
        for (const [eventId, data] of Object.entries(agg)) {
          const sorted = Object.entries(data.houseCounts).sort((a, b) => b[1] - a[1]);
          stats[eventId] = {
            totalPoints: data.totalPoints,
            memberCount: data.memberCount,
            topHouse: sorted[0]?.[0] ?? null,
            topHouseCount: sorted[0]?.[1] ?? 0,
          };
        }

        setMemoryStats((prev) => ({ ...prev, ...stats }));
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivedEventIdsKey]);

  if (upcomingLoading || (pastLoading && archivedEvents.length === 0)) {
    return (
      <>
        <PageTitle title="Events" />
        <PageLoader message="Loading events..." />
      </>
    );
  }

  if (upcomingError || pastError) {
    return (
      <>
        <PageTitle title="Events" />
        <div className="mx-auto max-w-4xl px-8 py-20 text-center">
          <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
            Error loading events: {(upcomingError as any)?.message || (pastError as any)?.message || 'Unknown error'}
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
            Keep up with GBMs, mixers, cultural programs, and VSA traditions.
          </p>
          {activeTerm && (
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--text3)' }}>
              Current term / {activeTerm.label}
            </p>
          )}

          <div className="vsa-filter-bar">
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={`vsa-filter-btn ${activeFilter === filter.key ? 'active' : ''}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="vsa-container py-8 lg:py-10">
        {featured && (
          <>
            <Label className="mb-5 text-brand-600 dark:text-brand-400">Next Up</Label>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
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
            </motion.div>
          </>
        )}

        {rest.length > 0 && (
          <>
            <Label className="mb-0">All Upcoming</Label>
            <div className="mt-5 mb-10 grid gap-4">
              {rest.map((event: Event) => (
                <motion.div
                  key={event.id}
                  whileHover={{ y: -2 }}
                  className="scrapbook-paper grid gap-4 p-4 sm:grid-cols-[88px_minmax(0,1fr)] lg:grid-cols-[88px_200px_minmax(0,1fr)_auto]"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <span className="scrapbook-pin" aria-hidden />
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
                </motion.div>
              ))}
            </div>
          </>
        )}

        {upcomingEventsAll.length === 0 && (
          <div
            className="scrapbook-empty mb-10"
          >
            <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
              No upcoming events - check back soon.
            </p>
          </div>
        )}

        {/* Memory Wall / Past Events Section */}
        <>
          <div className="border-t" style={{ borderColor: 'var(--color-border)' }} />
          <div className="mt-7">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Label className="mb-2">Memory Wall</Label>
                <p className="max-w-xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                  Browse previous events by academic term. Photo buttons appear when an album is linked.
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

            {archivedEvents.length === 0 && !pastLoading ? (
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
              <RevealOnScrollWrapper>
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {archivedEvents.map((event: Event, index: number) => (
                    <PastEventMemoryCard
                      key={event.id}
                      event={event}
                      linkedAlbum={linkedAlbums[event.id]}
                      recap={publishedRecaps[event.id]}
                      stats={memoryStats[event.id]}
                      terms={terms}
                      index={index}
                    />
                  ))}
                </div>
                
                {hasMorePast && (
                  <div className="mt-12 flex justify-center">
                    <button
                      onClick={() => fetchMorePast()}
                      disabled={fetchingMorePast}
                      className="vsa-btn-outline group relative min-w-[200px] overflow-hidden"
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {fetchingMorePast ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Loading...
                          </>
                        ) : (
                          'Load More Past Events'
                        )}
                      </span>
                    </button>
                  </div>
                )}
              </RevealOnScrollWrapper>
            )}
          </div>
        </>
      </div>
    </>
  );
}
