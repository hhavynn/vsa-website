import { type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { eventsRepository, PublicEventPreview } from '../../../data/repos/events';
import { leaderboardRepository } from '../../../data/repos/leaderboard';
import { galleryRepository } from '../../../data/repos/gallery';
import { useAcademicTerms } from '../../../hooks/useAcademicTerms';
import { supabase } from '../../../lib/supabase';
import { formatDateOnly } from '../../../lib/dateOnly';
import { formatEventDateRange, formatEventTime, formatEventTimeRange } from '../../../lib/eventTime';
import { getSupabaseImageUrl } from '../../../lib/supabaseImages';
import { getSummerBreakMessage, shouldUseSummerEmptyState } from '../../../utils/seasonalState';
import { EVENT_TYPE_LABELS } from '../../../constants/eventTypes';
import { HOUSE_COLORS, HOUSE_LABELS, normalizeHouse } from '../../../constants/houses';
import { Event, HouseYearlyPoints } from '../../../types';

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
    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text3)' }}>
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

  const nextEvent = events[0] ?? null;
  const otherEvents = events.slice(1, 3);
  const timeLabel = nextEvent ? getEventTimeLabel(nextEvent) : null;
  const useSummerEmptyState = shouldUseSummerEmptyState(Boolean(nextEvent));
  const summerMessage = getSummerBreakMessage('homepage');

  return (
    <div className="scrapbook-paper relative flex min-h-[250px] flex-col gap-4 p-5 sm:p-6">
      <TapeStrip color="teal" position="top-left" />
      <div className="flex items-start justify-between gap-4">
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
            {useSummerEmptyState
              ? summerMessage.body
              : 'Check back soon or follow VSA channels for updates.'}
          </p>
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
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
              {formatEventDateRange(nextEvent.date, nextEvent.end_date)}
              {timeLabel ? ` / ${timeLabel}` : ''}
            </div>
            <h4 className="line-clamp-2 font-serif text-[24px] leading-tight" style={{ color: 'var(--text)' }}>
              {nextEvent.name}
            </h4>
            <div className="mt-3 flex flex-wrap gap-2 font-sans text-xs" style={{ color: 'var(--text3)' }}>
              {nextEvent.location && <span>{nextEvent.location}</span>}
              {nextEvent.points > 0 && <span>{nextEvent.points} pts</span>}
            </div>
          </div>

          {otherEvents.length > 0 && (
            <div className="space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                Later soon
              </div>
              {otherEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0" style={{ borderColor: 'var(--border)' }}>
                  <span className="truncate font-sans text-[13px] font-medium" style={{ color: 'var(--text2)' }}>
                    {event.name}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] uppercase" style={{ color: 'var(--text3)' }}>
                    {formatDateOnly(event.date, 'MMM d')}
                  </span>
                </div>
              ))}
            </div>
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
  const { data: standings = [], isLoading } = useQuery<HouseYearlyPoints[]>({
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
          See which House is leading this week.
        </p>
      </div>

      {isLoading ? (
        <CardSkeleton />
      ) : !hasStandings ? (
        <div className="flex flex-1 flex-col justify-center">
          {useSummerEmptyState && (
            <span className="scrapbook-sticker scrapbook-sticker-gold mb-3 w-fit">
              {summerMessage.badge}
            </span>
          )}
          <p className="font-serif text-xl leading-tight" style={{ color: 'var(--text)' }}>
            {useSummerEmptyState ? summerMessage.title : 'House standings are still being updated'}
          </p>
          <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--text3)' }}>
            {useSummerEmptyState ? summerMessage.body : 'Check back soon.'}
          </p>
          <Link to="/leaderboard?view=houses" className="mt-4 font-mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--brand)' }}>
            Full standings
          </Link>
        </div>
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
                    {standing.total_points.toLocaleString()} pts
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
    <div className="scrapbook-paper relative flex min-h-[250px] flex-col gap-4 p-5 sm:p-6">
      <TapeStrip color="teal" position="top-right" />
      <div>
        <SectionLabel>Points lookup</SectionLabel>
        <h3 className="mt-1 font-serif text-[24px] leading-tight" style={{ color: 'var(--text)' }}>
          Find My Points
        </h3>
      </div>
      <div className="flex flex-1 flex-col justify-center">
        <p className="max-w-[280px] font-sans text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>
          Check your points without logging in.
        </p>
        <Link to="/points" className="mt-5 w-fit vsa-btn-primary py-2 text-xs">
          Find My Points
        </Link>
      </div>
      <Link to="/leaderboard" className="font-mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--brand)' }}>
        Full leaderboard
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

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <NextEventCard />
          <HouseStandingsCard academicYearStart={academicYearStart} />
          <LatestMemoryCard />
          <FindMyPointsCard />
        </div>
      </div>
    </section>
  );
}
