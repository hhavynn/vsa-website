import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { EventsSkeleton } from '../components/common/PageSkeletons';
import { PageTitle } from '../components/common/PageTitle';
import { Label } from '../components/ui/Label';
import { OptimizedImage } from '../components/common/OptimizedImage';
import {
  FeaturedEventCard,
  PastEventMemoryCard,
  UpcomingEventRow,
  type EventMemoryStats,
} from '../components/features/events/PublicEventCards';
import { HOUSE_COLORS } from '../constants/houses';
import { houseAssetsRepository } from '../data/repos/houseAssets';
import { houseEventsRepository } from '../data/repos/houseEvents';
import { getAcademicTermMeta } from '../lib/academicTerms';
import { formatDateOnly } from '../lib/dateOnly';
import { getSummerBreakMessage, shouldUseSummerEmptyState } from '../utils/seasonalState';
import { getLosAngelesDateOnly } from '../utils/losAngelesDate';
import { houseSlugFromKey } from '../utils/houseSlug';
import { supabase } from '../lib/supabase';
import { useAcademicTerms } from '../hooks/useAcademicTerms';
import { useLinkedExternalListings } from '../hooks/useExternalEvents';
import {
  useEvents,
  useInfiniteEvents,
  usePublishedPastEventArchiveAvailability,
} from '../hooks/useEvents';
import { AcademicTerm, Event, HouseEvent, HousePageAsset } from '../types';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';
import { useQuery } from 'react-query';

import { isSupabaseUnavailable } from '../utils/isSupabaseUnavailable';
import { DegradedModeBanner } from '../components/common/DegradedModeBanner';
import { ContentUnavailableState } from '../components/common/ContentUnavailableState';
import { FALLBACK_EVENTS, FALLBACK_LINKS } from '../config/publicFallbackContent';

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

type ArchiveTermOption = AcademicTerm | { id: 'unassigned'; label: 'Unassigned Dates' };

function sortTermsByDateDesc(a: AcademicTerm, b: AcademicTerm) {
  const aDate = a.starts_on ? new Date(a.starts_on).getTime() : a.display_order;
  const bDate = b.starts_on ? new Date(b.starts_on).getTime() : b.display_order;
  return bDate - aDate;
}

function HouseEventPreviewCard({ event, house }: { event: HouseEvent; house?: HousePageAsset }) {
  const eventHouses = event.houses && event.houses.length > 0 ? event.houses : house ? [house] : [];
  const primaryHouse = eventHouses[0] || house;
  const color = primaryHouse?.accent_color || HOUSE_COLORS[primaryHouse?.house as keyof typeof HOUSE_COLORS] || 'var(--brand)';
  const imageUrl = event.image_thumbnail_url || event.image_url || primaryHouse?.image_thumbnail_url || primaryHouse?.image_url;
  const href = primaryHouse ? `/house/${houseSlugFromKey(primaryHouse.house_key || primaryHouse.house || primaryHouse.display_name)}` : '/house';

  return (
    <Link to={href} className="scrapbook-paper group/spotlight group relative grid gap-4 overflow-hidden p-4 transition-all duration-300 before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[radial-gradient(circle_at_50%_0%,rgba(59,189,181,0.2),transparent_48%)] before:opacity-55 before:transition-opacity before:duration-300 after:pointer-events-none after:absolute after:inset-0 after:z-0 after:bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.08)_44%,transparent_58%)] after:opacity-0 after:transition-opacity after:duration-300 active:scale-[0.98] active:border-brand-400/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 hover:-translate-y-1 hover:border-brand-400/70 hover:shadow-[0_18px_42px_rgba(15,23,42,0.16)] hover:before:opacity-100 hover:after:opacity-100 sm:grid-cols-[120px_minmax(0,1fr)] sm:before:opacity-0 dark:hover:shadow-[0_18px_42px_rgba(0,0,0,0.34)] [&>*]:relative [&>*]:z-10" style={{ borderColor: `${color}55` }}>
      <div className="relative overflow-hidden rounded bg-[var(--color-surface2)]">
        <OptimizedImage
          src={imageUrl}
          // Thumbnail already covers the 120px (sm+) / full-width (mobile) slot.
          width={320}
          height={240}
          sizes="(min-width: 640px) 120px, 100vw"
          alt={event.title}
          className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
          fallback={
            <div className="flex aspect-[4/3] items-center justify-center">
              <span className="font-serif text-2xl italic" style={{ color }}>VSA</span>
            </div>
          }
        />
      </div>
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="scrapbook-sticker scrapbook-sticker-teal px-2 py-0.5 text-[9px]">House event</span>
          <div className="flex flex-wrap gap-1">
            {eventHouses.map((h) => (
              <span key={h.id} className="rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white" style={{ background: h.accent_color || HOUSE_COLORS[h.house as keyof typeof HOUSE_COLORS] || 'var(--brand)' }}>
                {h.display_name || h.house}
              </span>
            ))}
          </div>
        </div>
        <h3 className="truncate font-sans text-[15px] font-semibold" style={{ color: 'var(--color-text)' }}>{event.title}</h3>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
          {formatDateOnly(event.event_date, 'MMM d, yyyy')}
        </p>
        {event.location && (
          <p className="mt-2 truncate font-sans text-xs" style={{ color: 'var(--color-text3)' }}>{event.location}</p>
        )}
      </div>
    </Link>
  );
}

export function Events() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [selectedArchiveTermId, setSelectedArchiveTermId] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const oneDayAgo = useMemo(() => new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), [now]);

  // 1. Fetch upcoming events
  const { events: unfilteredUpcomingEvents, loading: upcomingLoading, error: upcomingError } = useEvents({
    date_from: oneDayAgo,
    sort_ascending: true
  });

  const upcomingEventsAll = useMemo(
    () => activeFilter === 'all'
      ? unfilteredUpcomingEvents
      : unfilteredUpcomingEvents.filter((event) => event.event_type === activeFilter),
    [activeFilter, unfilteredUpcomingEvents]
  );

  const { terms, loading: termsLoading, error: termsError } = useAcademicTerms();

  const {
    data: archiveAvailability,
    isLoading: archiveAvailabilityLoading,
    error: archiveAvailabilityError,
  } = usePublishedPastEventArchiveAvailability(oneDayAgo);

  // 2. Fetch past events (paginated)
  const publishedPastEventTermIds = useMemo(
    () => new Set(archiveAvailability?.termIds ?? []),
    [archiveAvailability?.termIds]
  );
  const archiveTerms = useMemo(
    () => terms.filter((term) => publishedPastEventTermIds.has(term.id)).sort(sortTermsByDateDesc),
    [publishedPastEventTermIds, terms]
  );
  
  const archiveOptions = useMemo<ArchiveTermOption[]>(() => {
    const options: ArchiveTermOption[] = [...archiveTerms];
    if (archiveAvailability?.hasUnassignedEvents) {
      options.push({ id: 'unassigned', label: 'Unassigned Dates' });
    }
    return options;
  }, [archiveAvailability?.hasUnassignedEvents, archiveTerms]);

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

  // Only external events carry a UVSA Network listing; one batched lookup
  // covers both the upcoming list and the visible archive.
  const externalEventIds = [...unfilteredUpcomingEvents, ...archivedEvents]
    .filter((event) => event.event_type === 'external_event')
    .map((event) => event.id);
  const externalListings = useLinkedExternalListings(externalEventIds);

  const [featured, ...rest] = upcomingEventsAll;
  const useSummerUpcomingEmptyState = shouldUseSummerEmptyState(unfilteredUpcomingEvents.length > 0);
  const summerEventsMessage = getSummerBreakMessage('events');
  const activeTerm = terms.find((term) => term.is_active) ?? terms.find((term) => term.code === getAcademicTermMeta(now.toISOString())?.code);
  const activeYear = activeTerm?.academic_year_start ?? null;
  const todayDateOnly = getLosAngelesDateOnly();
  const { data: houseEventPreviews = [] } = useQuery<HouseEvent[]>({
    queryKey: ['events-page', 'house-event-previews', todayDateOnly],
    queryFn: () => houseEventsRepository.getPublicUpcomingPreview(todayDateOnly, 4),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const { data: houseAssets = [] } = useQuery<HousePageAsset[]>({
    queryKey: ['events-page', 'house-assets', activeYear],
    queryFn: () => activeYear ? houseAssetsRepository.getPublishedAssets(activeYear) : Promise.resolve([]),
    enabled: activeYear !== null,
    staleTime: 10 * 60 * 1000,
    cacheTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const houseAssetsById = useMemo(() => new Map(houseAssets.map((asset) => [asset.id, asset])), [houseAssets]);

  const selectedArchiveTerm = archiveOptions.find((term) => term.id === effectiveArchiveTermId);
  const latestArchiveTerm = archiveOptions[0] ?? null;
  const latestArchiveActionLabel = latestArchiveTerm
    ? `View ${latestArchiveTerm.label} memories`
    : 'View past events';

  const showLatestArchive = () => {
    setActiveFilter('all');
    setSelectedArchiveTermId(latestArchiveTerm?.id ?? null);
  };

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
      // member_event_history, not the raw ledger: anon lost SELECT on
      // member_event_attendance in 20260820000001 (#380). The view carries the
      // same three columns and additionally filters to published events.
      .from('member_event_history')
      .select('event_id, member_id, points_earned')
      .in('event_id', archivedEventIds)
      .then(async ({ data: attendanceRows }) => {
        if (cancelled || !attendanceRows || attendanceRows.length === 0) return;

        const rows = attendanceRows as Array<{ event_id: string; member_id: string; points_earned: number }>;
        const uniqueMemberIds = Array.from(new Set(rows.map((r) => r.member_id)));

        const { data: memberRows } = await supabase
          .from('public_members')
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

  if (
    upcomingLoading ||
    termsLoading ||
    archiveAvailabilityLoading ||
    (pastLoading && archivedEvents.length === 0)
  ) {
    return (
      <>
        <PageTitle title="Events" />
        <EventsSkeleton />
      </>
    );
  }

  const isDegraded =
    isSupabaseUnavailable(upcomingError) ||
    isSupabaseUnavailable(termsError) ||
    isSupabaseUnavailable(archiveAvailabilityError) ||
    isSupabaseUnavailable(pastError);

  if (isDegraded) {
    return (
      <>
        <PageTitle title="Events" />
        <DegradedModeBanner sourceName="events" />
        <div className="vsa-container py-20">
          <ContentUnavailableState
            title={FALLBACK_EVENTS.title}
            message={FALLBACK_EVENTS.message}
            actionLabel="View on Instagram"
            actionHref={FALLBACK_LINKS.instagram}
          />
        </div>
      </>
    );
  }

  if (upcomingError || termsError || archiveAvailabilityError || pastError) {
    return (
      <>
        <PageTitle title="Events" />
        <div className="vsa-container py-20">
          <ContentUnavailableState
            title="Events are temporarily unavailable"
            message="We're having trouble loading the event board right now. Please check back later or use VSA's official channels for the latest updates."
            actionLabel="View on Instagram"
            actionHref={FALLBACK_LINKS.instagram}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle title="Events" />
      {/* Degraded mode check again here in case of partial failure if we still want to show what we have */}

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

          {unfilteredUpcomingEvents.length > 0 && (
            <div className="vsa-filter-bar" role="group" aria-label="Filter events by type">
              {FILTERS.map((filter) => (
                <button
                  type="button"
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  aria-pressed={activeFilter === filter.key}
                  className={`vsa-filter-btn ${activeFilter === filter.key ? 'active' : ''}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="vsa-container py-8 lg:py-10">
        {featured && (
          <>
            <Label className="mb-5 text-brand-600 dark:text-brand-400">Next Up</Label>
            <FeaturedEventCard event={featured} external={externalListings.get(featured.id)} />
          </>
        )}

        {rest.length > 0 && (
          <>
            <Label className="mb-0">All Upcoming</Label>
            <div className="mt-5 mb-10 grid gap-4">
              {rest.map((event: Event) => (
                <UpcomingEventRow key={event.id} event={event} external={externalListings.get(event.id)} />
              ))}
            </div>
          </>
        )}

        {upcomingEventsAll.length === 0 && (
          <div
            className="scrapbook-empty mb-10"
          >
            {useSummerUpcomingEmptyState ? (
              <div className="mx-auto max-w-xl space-y-3 text-center">
                <a
                  href="#memory-wall"
                  onClick={showLatestArchive}
                  className="inline-flex font-mono text-[11px] uppercase tracking-wider text-brand-600 dark:text-brand-400"
                >
                  {latestArchiveActionLabel}
                </a>
                <span className="scrapbook-sticker scrapbook-sticker-gold inline-flex">
                  {summerEventsMessage.badge}
                </span>
                <div>
                  <p className="font-serif text-2xl leading-tight" style={{ color: 'var(--color-text)' }}>
                    {summerEventsMessage.title}
                  </p>
                  <p className="mt-2 font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text3)' }}>
                    {summerEventsMessage.body}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <a
                  href="#memory-wall"
                  onClick={showLatestArchive}
                  className="inline-flex font-mono text-[11px] uppercase tracking-wider text-brand-600 dark:text-brand-400"
                >
                  {latestArchiveActionLabel}
                </a>
                <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                  No upcoming events posted yet. Check back soon.
                </p>
              </div>
            )}
          </div>
        )}

        {houseEventPreviews.length > 0 && (
          <section className="mb-10">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <Label className="mb-2">Upcoming House Events</Label>
                <p className="max-w-xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                  House-specific hangouts and socials are separate from all-VSA events.
                </p>
              </div>
              <Link to="/house-system" className="font-sans text-xs font-semibold text-brand-600 dark:text-brand-400">
                See Houses
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {houseEventPreviews.map((event) => (
                <HouseEventPreviewCard key={event.id} event={event} house={houseAssetsById.get(event.house_profile_id)} />
              ))}
            </div>
          </section>
        )}

        {/* Memory Wall / Past Events Section */}
        <>
          <div className="border-t" style={{ borderColor: 'var(--color-border)' }} />
          <div id="memory-wall" className="mt-7 scroll-mt-24">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Label className="mb-2">Memory Wall</Label>
                <p className="max-w-xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                  Browse previous events by academic term. Photo buttons appear when an album is linked.
                </p>
              </div>
              {archiveOptions.length > 0 && (
                <div className="min-w-[220px]">
                  <label htmlFor="events-archive-term" className="mb-1 block font-sans text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
                    Term
                  </label>
                  <select
                    id="events-archive-term"
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
                role="status"
                className="rounded border p-10 text-center"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
              >
                <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                  No {activeFilter === 'all' ? '' : `${FILTERS.find((filter) => filter.key === activeFilter)?.label ?? ''} `}
                  events found for {selectedArchiveTerm?.label ?? 'this term'}.
                </p>
                {latestArchiveTerm && (
                  <a
                    href="#memory-wall"
                    onClick={showLatestArchive}
                    className="mt-3 inline-flex font-mono text-[11px] uppercase tracking-wider text-brand-600 dark:text-brand-400"
                  >
                    {latestArchiveActionLabel}
                  </a>
                )}
              </div>
            ) : (
              <RevealOnScrollWrapper>
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Past events"
                  className="flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto pb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 [-webkit-overflow-scrolling:touch] md:grid md:snap-none md:grid-cols-2 md:overflow-visible md:pb-0 xl:grid-cols-3"
                >
                  {archivedEvents.map((event: Event, index: number) => (
                    <PastEventMemoryCard
                      key={event.id}
                      event={event}
                      linkedAlbum={linkedAlbums[event.id]}
                      recap={publishedRecaps[event.id]}
                      stats={memoryStats[event.id]}
                      terms={terms}
                      index={index}
                      external={externalListings.get(event.id)}
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
