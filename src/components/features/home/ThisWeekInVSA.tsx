import { type ComponentType, type CSSProperties, useMemo, useState } from 'react';
import { type IconBaseProps } from 'react-icons';
import { FiArrowUpRight, FiStar } from 'react-icons/fi';
import { cn } from '../../../lib/utils';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { eventsRepository, PublicEventPreview } from '../../../data/repos/events';
import { houseEventsRepository } from '../../../data/repos/houseEvents';
import { leaderboardRepository } from '../../../data/repos/leaderboard';
import { galleryRepository } from '../../../data/repos/gallery';
import { useAcademicTerms } from '../../../hooks/useAcademicTerms';
import { supabase } from '../../../lib/supabase';
import { formatDateOnly } from '../../../lib/dateOnly';
import { getPublicHousePoints, isHousePointOverrideActive } from '../../../utils/housePublicPointOverrides';
import { formatEventDateRange, formatEventTime, formatEventTimeRange } from '../../../lib/eventTime';
import { getSupabaseImageUrl } from '../../../lib/supabaseImages';
import { getSummerBreakMessage, shouldUseSummerEmptyState } from '../../../utils/seasonalState';
import { getLosAngelesDateOnly } from '../../../utils/losAngelesDate';
import { EVENT_TYPE_LABELS } from '../../../constants/eventTypes';
import { HOUSE_COLORS, HOUSE_LABELS, HouseName, normalizeHouse } from '../../../constants/houses';
import { Event, HouseEvent, HouseYearlyPoints } from '../../../types';

const ArrowUpRightIcon = FiArrowUpRight as ComponentType<IconBaseProps>;
const StarIcon = FiStar as ComponentType<IconBaseProps>;

function TapeStrip({ color = 'teal', position = 'top' }: { color?: 'teal' | 'coral' | 'gold'; position?: 'top' | 'top-left' | 'top-right' }) {
  const colorVar = color === 'teal' ? 'var(--tape-teal)' : color === 'coral' ? 'var(--tape-coral)' : 'var(--tape-gold)';
  const style: CSSProperties = {
    position: 'absolute',
    width: '48px',
    height: '18px',
    background: colorVar,
    borderRadius: '2px',
    top: '-9px',
    ...(position === 'top' ? { left: '50%', transform: 'translateX(-50%) rotate(-1.5deg)' } : {}),
    ...(position === 'top-left' ? { left: '18px', transform: 'rotate(-2deg)' } : {}),
    ...(position === 'top-right' ? { right: '18px', transform: 'rotate(2deg)' } : {}),
  };
  return <span aria-hidden style={style} />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-primary">
      {children}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-3 py-2" aria-hidden>
      <div className="h-4 w-24 rounded bg-[var(--surface2)]" />
      <div className="h-6 w-3/4 rounded bg-[var(--surface2)]" />
      <div className="h-4 w-1/2 rounded bg-[var(--surface2)]" />
    </div>
  );
}

function getTodayDateOnly(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getEventTimeLabel(event: Pick<Event, 'start_time' | 'end_time'>): string | null {
  if (event.start_time && event.end_time) return formatEventTimeRange(event.start_time, event.end_time);
  if (event.start_time) return formatEventTime(event.start_time);
  return null;
}

function NextEventCard() {
  const today = getTodayDateOnly();
  const { data: events = [], isLoading } = useQuery<PublicEventPreview[]>({
    queryKey: ['home', 'upcoming-event-preview', today],
    queryFn: () => eventsRepository.getPublicUpcomingPreview(today, 4),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const todayDateOnly = getLosAngelesDateOnly();
  const { data: houseEvents = [] } = useQuery<HouseEvent[]>({
    queryKey: ['home', 'upcoming-house-event-preview', todayDateOnly],
    queryFn: () => houseEventsRepository.getPublicUpcomingPreview(todayDateOnly, 1),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const stack = events.slice(0, 3);
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = stack.length > 0 ? Math.min(activeIndex, stack.length - 1) : 0;
  const nextEvent = stack[safeIndex] ?? null;
  const nextHouseEvent = houseEvents[0] ?? null;
  const timeLabel = nextEvent ? getEventTimeLabel(nextEvent) : null;
  const useSummerEmptyState = shouldUseSummerEmptyState(Boolean(nextEvent || nextHouseEvent));
  const summerMessage = getSummerBreakMessage('homepage');
  const shouldReduceMotion = useReducedMotion();

  const goToIndex = (i: number) => {
    if (stack.length === 0) return;
    setActiveIndex(((i % stack.length) + stack.length) % stack.length);
  };
  const goNext = () => goToIndex(safeIndex + 1);

  return (
    <div className="scrapbook-paper relative flex min-h-[250px] flex-col gap-4 p-5 sm:p-6">
      <TapeStrip color="teal" position="top-left" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionLabel>Next up</SectionLabel>
          <h3 className="mt-1 font-serif text-[24px] leading-tight" style={{ color: 'var(--text)' }}>
            Next Event
          </h3>
        </div>
        {nextEvent && (
          <span className="scrapbook-sticker scrapbook-sticker-teal shrink-0">
            {EVENT_TYPE_LABELS[nextEvent.event_type] ?? nextEvent.event_type}
          </span>
        )}
      </div>

      {isLoading ? (
        <CardSkeleton />
      ) : !nextEvent ? (
        <div className="flex flex-1 flex-col justify-center">
          {useSummerEmptyState && (
            <span className="scrapbook-sticker scrapbook-sticker-gold mb-3 w-fit">
              {summerMessage.badge}
            </span>
          )}
          <p className="font-serif text-xl leading-tight" style={{ color: 'var(--text)' }}>
            {useSummerEmptyState ? summerMessage.title : 'No upcoming events listed yet'}
          </p>
          <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--text3)' }}>
            {nextHouseEvent
              ? 'No all-VSA event is posted next, but there is a House event coming up.'
              : useSummerEmptyState
              ? summerMessage.body
              : 'Check back soon or follow VSA channels for updates.'}
          </p>
          {nextHouseEvent && (
            <Link to="/house-system" className="mt-4 rounded-lg border p-3 transition-colors hover:bg-[var(--surface2)]" style={{ borderColor: 'var(--border)' }}>
              <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                {nextHouseEvent.houses && nextHouseEvent.houses.length > 1
                  ? `${nextHouseEvent.houses.map(h => h.display_name || h.house).join(' + ')} event`
                  : 'House event'} / {formatDateOnly(nextHouseEvent.event_date, 'MMM d')}
              </div>
              <div className="mt-1 truncate font-sans text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                {nextHouseEvent.title}
              </div>
            </Link>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            {useSummerEmptyState && (
              <Link to="/points" className="font-mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--brand)' }}>
                Find My Points
              </Link>
            )}
            <Link to="/events" className="font-mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--brand)' }}>
              {useSummerEmptyState ? 'View past events' : 'See events'}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="relative">
            {/* Ghost cards peeking out behind the active one — only when there's
                more than one upcoming event to stack. Decorative, aria-hidden. */}
            {stack.length > 2 && (
              <div
                aria-hidden
                className="absolute inset-x-3 top-1 h-full rounded-lg border"
                style={{ borderColor: 'var(--border)', background: 'var(--surface2)', transform: 'rotate(2deg)', opacity: 0.45 }}
              />
            )}
            {stack.length > 1 && (
              <div
                aria-hidden
                className="absolute inset-x-1.5 top-0.5 h-full rounded-lg border"
                style={{ borderColor: 'var(--border)', background: 'var(--surface2)', transform: 'rotate(-1.5deg)', opacity: 0.7 }}
              />
            )}

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={nextEvent.id}
                initial={shouldReduceMotion ? false : { opacity: 0, x: 20, rotate: 1.5 }}
                animate={{ opacity: 1, x: 0, rotate: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -16, rotate: -2, scale: 0.97 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="relative overflow-hidden rounded-lg border border-border-strong bg-surface2"
              >
                {(nextEvent.thumbnail_url || nextEvent.image_url) && (
                  <img
                    src={getSupabaseImageUrl(nextEvent.thumbnail_url || nextEvent.image_url, { width: 480, resize: 'contain', quality: 80 })}
                    alt={`${nextEvent.name} event poster`}
                    className="h-52 w-full border-b border-border-strong object-contain p-3"
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <div className="p-4">
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-text-primary">
                    {formatEventDateRange(nextEvent.date, nextEvent.end_date, nextEvent.start_time)}
                    {timeLabel ? ` / ${timeLabel}` : ''}
                  </div>
                  <h4 className="line-clamp-2 font-serif text-[24px] leading-tight" style={{ color: 'var(--text)' }}>
                    {nextEvent.name}
                  </h4>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-sans text-xs text-text-primary">
                    {nextEvent.location && <span>{nextEvent.location}</span>}
                    {nextEvent.points > 0 && <span>{nextEvent.points} {nextEvent.points === 1 ? 'point' : 'points'}</span>}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {stack.length > 1 && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5" role="group" aria-label="Upcoming events">
                {stack.map((event, i) => (
                  <button
                    key={event.id}
                    type="button"
                    aria-current={i === safeIndex ? 'true' : undefined}
                    aria-label={`Show event ${i + 1} of ${stack.length}: ${event.name}`}
                    onClick={() => goToIndex(i)}
                    className="flex h-11 w-8 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                  >
                    <span aria-hidden className={cn('h-1.5 rounded-full', i === safeIndex ? 'w-4 bg-brand-600 dark:bg-brand-400' : 'w-1.5 bg-text-secondary')} />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={goNext}
                className="min-h-[44px] font-mono text-[11px] uppercase tracking-wider transition-opacity duration-150 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                style={{ color: 'var(--brand)' }}
              >
                Next event →
              </button>
            </div>
          )}

          <span className="sr-only" aria-live="polite">
            {stack.length > 1 ? `Showing event ${safeIndex + 1} of ${stack.length}: ${nextEvent.name}` : ''}
          </span>

          {nextHouseEvent && (
            <Link to="/house-system" className="rounded-lg border p-3 transition-colors hover:bg-[var(--surface2)]" style={{ borderColor: 'var(--border)' }}>
              <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                Next House event / {formatDateOnly(nextHouseEvent.event_date, 'MMM d')}
              </div>
              <div className="mt-1 truncate font-sans text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                {nextHouseEvent.title}
              </div>
            </Link>
          )}

          <Link to="/events" className="mt-auto font-mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--brand)' }}>
            View event
          </Link>
        </>
      )}
    </div>
  );
}

function HouseStandingsCard({ academicYearStart }: { academicYearStart: number | null }) {
  const { data: rawStandings = [], isLoading } = useQuery<HouseYearlyPoints[]>({
    queryKey: ['home', 'house-standings-preview', academicYearStart],
    queryFn: () =>
      academicYearStart
        ? leaderboardRepository.getTopYearlyHouseStandings(academicYearStart, 3)
        : Promise.resolve([]),
    enabled: academicYearStart !== null,
    staleTime: 10 * 60 * 1000,
    cacheTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const standings = useMemo(() => {
    // When the DB has no standings for an override year, inject official placeholder rows
    const base: HouseYearlyPoints[] =
      rawStandings.length === 0 &&
      typeof academicYearStart === 'number' &&
      isHousePointOverrideActive(academicYearStart)
        ? (['Bowser', 'Donkey Kong', 'Toad', 'Boo'] as HouseName[]).map((houseName) => ({
            house: houseName,
            house_profile_id: '',
            display_name: houseName,
            image_url: null,
            accent_color: HOUSE_COLORS[houseName] as string | null,
            academic_year_start: academicYearStart,
            academic_year_end: academicYearStart + 1,
            total_points: 0,
            events_attended: 0,
            unique_events: 0,
            unique_members: 0,
            average_points_per_member: null,
            latest_activity_at: null,
          }))
        : rawStandings;

    return base.map((s) => ({
      ...s,
      total_points: getPublicHousePoints({
        houseKey: s.house,
        houseName: s.display_name,
        academicYearStart,
        calculatedPoints: s.total_points,
      }),
    })).sort((a, b) => b.total_points - a.total_points);
  }, [rawStandings, academicYearStart]);

  const hasStandings = standings.some((house) => house.total_points > 0);
  const useSummerEmptyState = shouldUseSummerEmptyState(hasStandings);
  const summerMessage = getSummerBreakMessage('houseStandings');

  return (
    <div className="scrapbook-paper relative flex min-h-[250px] flex-col gap-4 p-5 sm:p-6">
      <TapeStrip color="gold" position="top-right" />
      <div>
        <SectionLabel>House standings</SectionLabel>
        <h3 className="mt-1 font-serif text-[24px] leading-tight" style={{ color: 'var(--text)' }}>
          Current House Standings
        </h3>
        <p className="mt-2 font-sans text-sm" style={{ color: 'var(--text2)' }}>
          {hasStandings ? 'See which House is leading this week.' : 'A new year of House memories is ahead.'}
        </p>
      </div>

      {isLoading ? (
        <CardSkeleton />
      ) : !hasStandings ? (
        <>
          <div className="my-auto rounded-lg border border-gold-500/40 bg-gold-400/10 p-5">
            <span className="mb-3 inline-flex rounded-sm bg-surface px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-label text-text-primary">
              {useSummerEmptyState ? summerMessage.badge : 'Coming soon'}
            </span>
            <p className="font-serif text-3xl leading-tight text-text-primary">
              {useSummerEmptyState ? summerMessage.title : 'Standings will be back soon'}
            </p>
            <p className="mt-3 font-sans text-sm leading-relaxed text-text-primary">
              {useSummerEmptyState ? summerMessage.body : 'We’ll update this space as House announcements and points are released. Check back for the first standings!'}
            </p>
          </div>
          <Link to="/leaderboard?view=houses" className="mt-auto font-mono text-[11px] uppercase tracking-wider text-brand-700 dark:text-brand-400">
            Full standings
          </Link>
        </>
      ) : (
        <>
          <div className="space-y-2">
            {standings.map((standing, index) => {
              const houseKey = normalizeHouse(standing.house);
              const houseLabel = houseKey ? HOUSE_LABELS[houseKey] : standing.display_name || standing.house;
              const houseColor = houseKey ? HOUSE_COLORS[houseKey] : standing.accent_color || 'var(--border)';

              return (
                <div key={standing.house_profile_id || standing.house} className="flex items-center justify-between gap-3 rounded-lg border p-3" style={{ borderColor: index === 0 ? houseColor : 'var(--border)', background: 'var(--surface2)' }}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold" style={{ background: houseColor, color: 'var(--surface)' }}>
                      {index + 1}
                    </span>
                    <span className="truncate font-sans text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                      {houseLabel}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-[11px]" style={{ color: 'var(--text3)' }}>
                    {standing.total_points.toLocaleString()} house pts
                  </span>
                </div>
              );
            })}
          </div>
          <Link to="/leaderboard?view=houses" className="mt-auto font-mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--brand)' }}>
            Full standings
          </Link>
        </>
      )}
    </div>
  );
}

type LatestMemory =
  | {
      kind: 'recap';
      title: string;
      date: string | null;
      label: string;
      thumbnailUrl: string | null;
      href: string;
      cta: string;
    }
  | {
      kind: 'gallery';
      title: string;
      date: string | null;
      label: string;
      thumbnailUrl: string | null;
      href: string;
      cta: string;
    };

async function getLatestMemory(): Promise<LatestMemory | null> {
  const { data: recapRows } = await supabase
    .from('event_recaps')
    .select('event_id, public_highlight, updated_at, gallery_event_id')
    .eq('is_public_highlight_published', true)
    .not('public_highlight', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1);

  const recap = recapRows?.[0] as { event_id: string; public_highlight: string | null; updated_at: string; gallery_event_id: string | null } | undefined;
  if (recap) {
    const { data: event } = await supabase
      .from('events')
      .select('id, name, date, image_url, thumbnail_url')
      .eq('id', recap.event_id)
      .eq('is_published', true)
      .single();

    if (event) {
      return {
        kind: 'recap',
        title: event.name,
        date: event.date,
        label: recap.public_highlight || 'Event recap',
        thumbnailUrl: event.thumbnail_url || event.image_url || null,
        href: '/events',
        cta: 'View recap',
      };
    }
  }

  const albums = await galleryRepository.getAlbums({ limit: 1 });
  const album = albums[0];
  if (!album) return null;

  return {
    kind: 'gallery',
    title: album.title,
    date: album.date,
    label: album.event ? `From ${album.event.name}` : 'Gallery drop',
    thumbnailUrl: album.cover_thumbnail_url || album.cover_image_url,
    href: '/gallery',
    cta: 'View gallery',
  };
}

function LatestMemoryCard() {
  const { data: memory = null, isLoading } = useQuery<LatestMemory | null>({
    queryKey: ['home', 'latest-memory-preview'],
    queryFn: getLatestMemory,
    staleTime: 10 * 60 * 1000,
    cacheTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const useSummerEmptyState = shouldUseSummerEmptyState(Boolean(memory));
  const summerMessage = getSummerBreakMessage('gallery');

  return (
    <div className="scrapbook-paper relative flex min-h-[250px] flex-col gap-4 p-5 sm:p-6">
      <TapeStrip color="coral" position="top" />
      <div>
        <SectionLabel>Latest memory</SectionLabel>
        <h3 className="mt-1 font-serif text-[24px] leading-tight" style={{ color: 'var(--text)' }}>
          Recent Photo or Recap Drop
        </h3>
      </div>

      {isLoading ? (
        <CardSkeleton />
      ) : !memory ? (
        <div className="flex flex-1 flex-col justify-center">
          {useSummerEmptyState && (
            <span className="scrapbook-sticker scrapbook-sticker-gold mb-3 w-fit">
              {summerMessage.badge}
            </span>
          )}
          <p className="font-serif text-xl leading-tight" style={{ color: 'var(--text)' }}>
            {useSummerEmptyState ? summerMessage.title : 'New photos and recaps soon'}
          </p>
          <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--text3)' }}>
            {useSummerEmptyState ? summerMessage.body : 'New photos and recaps will show up here after events.'}
          </p>
          <Link to="/gallery" className="mt-4 font-mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--brand)' }}>
            See memories
          </Link>
        </div>
      ) : (
        <>
          <Link to={memory.href} className="scrapbook-photo group relative block overflow-hidden" style={{ transform: 'rotate(-1deg)' }}>
            {memory.thumbnailUrl ? (
              <img
                src={getSupabaseImageUrl(memory.thumbnailUrl, { width: 520, height: 330, resize: 'cover', quality: 72 })}
                alt={memory.title}
                className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                decoding="async"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="flex aspect-[16/10] w-full items-center justify-center" style={{ background: 'var(--surface2)' }}>
                <span className="font-serif text-[28px] italic" style={{ color: 'var(--text3)' }}>VSA</span>
              </div>
            )}
          </Link>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
              {memory.date ? formatDateOnly(memory.date, 'MMM d, yyyy') : memory.kind === 'recap' ? 'Recap' : 'Gallery'}
            </div>
            <h4 className="mt-1 truncate font-sans text-[14px] font-semibold" style={{ color: 'var(--text)' }}>
              {memory.title}
            </h4>
            <p className="mt-1 line-clamp-2 font-sans text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
              {memory.label}
            </p>
          </div>
          <Link to={memory.href} className="mt-auto font-mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--brand)' }}>
            {memory.cta}
          </Link>
        </>
      )}
    </div>
  );
}

function FindMyPointsCard() {
  return (
    <div className="scrapbook-paper relative flex min-h-[250px] flex-col gap-5 p-5 sm:p-6">
      <TapeStrip color="teal" position="top-right" />
      <div>
        <SectionLabel>Your VSA journey</SectionLabel>
        <h3 className="mt-1 font-serif text-3xl leading-tight text-text-primary">
          Find My Points
        </h3>
      </div>
      <div className="my-auto rounded-lg border border-brand-600/30 bg-brand-50 p-5 dark:border-brand-400/30 dark:bg-brand-950">
        <StarIcon className="mb-5 h-8 w-8 text-brand-700 dark:text-brand-400" aria-hidden />
        <p className="font-serif text-4xl leading-tight text-text-primary">Every event adds up.</p>
        <p className="mt-3 font-sans text-sm leading-relaxed text-text-primary">
          Revisit the events you’ve been part of and see the points you’ve earned along the way.
        </p>
        <Link to="/points" className="mt-6 inline-flex min-h-[44px] w-full items-center justify-between gap-2 rounded bg-brand-700 px-4 py-3 font-sans text-sm font-semibold text-brand-50 hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 dark:bg-brand-400 dark:text-brand-950 dark:hover:bg-brand-300">
          Find My Points <ArrowUpRightIcon className="h-4 w-4 shrink-0" aria-hidden />
        </Link>
      </div>
      <Link to="/leaderboard" className="mt-auto font-mono text-[11px] uppercase tracking-wider text-brand-700 dark:text-brand-400">
        Explore the leaderboard →
      </Link>
    </div>
  );
}

export function ThisWeekInVSA() {
  const { terms } = useAcademicTerms();
  const activeTerm = terms.find((term) => term.is_active);
  const academicYearStart = activeTerm?.academic_year_start ?? null;

  return (
    <section className="vsa-section scrapbook-board" aria-labelledby="this-week-in-vsa-title">
      <div className="vsa-container">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="scrapbook-sticker scrapbook-sticker-coral mb-3">Weekly Check-In</span>
            <h2 id="this-week-in-vsa-title" className="vsa-section-title">
              This Week
              <br />
              <em style={{ color: 'var(--brand)' }}>in VSA.</em>
            </h2>
          </div>
          <p className="max-w-sm font-sans text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>
            Your quick check-in for events, points, Houses, and recent memories.
          </p>
        </div>

        <div className="snap-rail-container">
          <div className="snap-rail grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <NextEventCard />
            <HouseStandingsCard academicYearStart={academicYearStart} />
            <LatestMemoryCard />
            <FindMyPointsCard />
          </div>
        </div>
      </div>
    </section>
  );
}
