import { type CSSProperties, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { useQuery } from 'react-query';
import { useEvents } from '../../../hooks/useEvents';
import { useAcademicTerms } from '../../../hooks/useAcademicTerms';
import { leaderboardRepository } from '../../../data/repos/leaderboard';
import { supabase } from '../../../lib/supabase';
import { getSupabaseImageUrl } from '../../../lib/supabaseImages';
import { EVENT_TYPE_LABELS } from '../../../constants/eventTypes';
import { HOUSE_COLORS, normalizeHouse } from '../../../constants/houses';
import { FindMyPoints } from '../points/FindMyPoints';
import { Event, HouseYearlyPoints } from '../../../types';

// ─── Mini helpers ──────────────────────────────────────────────────────────────

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
    <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text3)' }}>
      {children}
    </div>
  );
}

// ─── Events card ──────────────────────────────────────────────────────────────

function getWeekRange(now: Date) {
  return {
    start: startOfWeek(now, { weekStartsOn: 1 }),
    end: endOfWeek(now, { weekStartsOn: 1 }),
  };
}

function EventsCard({ events }: { events: Event[] }) {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const { start: weekStart, end: weekEnd } = getWeekRange(now);

  const upcoming = events
    .filter((e) => new Date(e.date) >= oneDayAgo)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const nextEvent = upcoming[0] ?? null;

  const thisWeekEvents = upcoming.filter((e) =>
    isWithinInterval(parseISO(e.date), { start: weekStart, end: weekEnd })
  );

  // Other this-week events after the next one
  const otherThisWeek = thisWeekEvents.filter((e) => e.id !== nextEvent?.id).slice(0, 3);

  const isEmpty = !nextEvent;

  return (
    <div className="scrapbook-paper relative flex flex-col gap-4 p-5 sm:p-6" style={{ minHeight: '200px' }}>
      <TapeStrip color="teal" position="top-left" />
      <SectionLabel>Upcoming Events</SectionLabel>

      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <span className="font-serif text-[28px]" style={{ color: 'var(--text3)' }}>☀️</span>
          <p className="font-sans text-sm" style={{ color: 'var(--text3)' }}>
            No upcoming events posted yet.
          </p>
          <Link to="/events" className="mt-2 font-mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--brand)' }}>
            Check events page →
          </Link>
        </div>
      ) : (
        <>
          {/* Featured next event */}
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}>
            <div className="mb-2 flex items-center gap-2">
              <span className="scrapbook-sticker scrapbook-sticker-teal text-[9px]">
                {EVENT_TYPE_LABELS[nextEvent.event_type] ?? nextEvent.event_type}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
                {format(new Date(nextEvent.date), 'EEE, MMM d · h:mm a')}
              </span>
            </div>
            <h3 className="line-clamp-2 font-serif text-[20px] leading-tight" style={{ color: 'var(--text)' }}>
              {nextEvent.name}
            </h3>
            {nextEvent.location && (
              <p className="mt-1 truncate font-sans text-xs" style={{ color: 'var(--text3)' }}>
                📍 {nextEvent.location}
              </p>
            )}
            <Link to="/events" className="mt-3 inline-block font-mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--brand)' }}>
              Details →
            </Link>
          </div>

          {/* Other this-week events */}
          {otherThisWeek.length > 0 && (
            <div className="space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                Also this week
              </div>
              {otherThisWeek.map((e) => (
                <div key={e.id} className="flex items-center gap-3">
                  <div className="w-[36px] shrink-0 text-center">
                    <div className="font-serif text-[18px] leading-none" style={{ color: 'var(--text)' }}>
                      {format(new Date(e.date), 'd')}
                    </div>
                    <div className="font-mono text-[9px] uppercase" style={{ color: 'var(--text3)' }}>
                      {format(new Date(e.date), 'MMM')}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-sans text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                      {e.name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link to="/events" className="mt-auto font-mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--brand)' }}>
            All events →
          </Link>
        </>
      )}
    </div>
  );
}

// ─── House standings card ─────────────────────────────────────────────────────

const HOUSE_EMOJI: Record<string, string> = {
  Bowser: '🐢',
  'Donkey Kong': '🦍',
  Boo: '👻',
  Toad: '🍄',
};

function HouseStandingsCard({ academicYearStart }: { academicYearStart: number | null }) {
  const { data: standings = [], isLoading } = useQuery<HouseYearlyPoints[]>({
    queryKey: ['house-yearly', academicYearStart],
    queryFn: () =>
      academicYearStart
        ? leaderboardRepository.getYearlyHouseLeaderboard(academicYearStart)
        : Promise.resolve([]),
    enabled: academicYearStart !== null,
    staleTime: 5 * 60 * 1000,
  });

  const topHouse = standings[0] ?? null;

  return (
    <div className="scrapbook-paper relative flex flex-col gap-3 p-5 sm:p-6">
      <TapeStrip color="gold" position="top-right" />
      <SectionLabel>House Standings</SectionLabel>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: 'var(--brand)' }} />
        </div>
      ) : !topHouse || standings.every((s) => s.total_points === 0) ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <span className="font-serif text-[28px]">🏠</span>
          <p className="font-sans text-sm" style={{ color: 'var(--text3)' }}>
            House season hasn't started yet.
          </p>
          <p className="font-sans text-xs" style={{ color: 'var(--text3)' }}>
            Check back once events begin!
          </p>
          <Link to="/leaderboard" className="mt-2 font-mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--brand)' }}>
            View standings →
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
            Current leader
          </div>
          <div
            className="flex items-center gap-3 rounded-lg border-2 p-3"
            style={{
              borderColor: HOUSE_COLORS[normalizeHouse(topHouse.house) ?? 'Boo'] ?? 'var(--border)',
              background: 'var(--surface2)',
            }}
          >
            <span className="text-[28px] leading-none">{HOUSE_EMOJI[topHouse.house] ?? '🏅'}</span>
            <div className="min-w-0">
              <div className="font-serif text-[18px] font-bold leading-tight" style={{ color: 'var(--text)' }}>
                {topHouse.house}
              </div>
              <div className="font-mono text-[11px]" style={{ color: 'var(--text3)' }}>
                {topHouse.total_points.toLocaleString()} pts
              </div>
            </div>
          </div>

          {/* Mini podium for rest */}
          {standings.slice(1).map((s, i) => (
            <div key={s.house} className="flex items-center justify-between gap-2 border-b pb-1 last:border-0" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px]" style={{ color: 'var(--text3)' }}>#{i + 2}</span>
                <span className="font-sans text-[13px]" style={{ color: 'var(--text2)' }}>{s.house}</span>
              </div>
              <span className="font-mono text-[11px]" style={{ color: 'var(--text3)' }}>
                {s.total_points.toLocaleString()} pts
              </span>
            </div>
          ))}

          <Link to="/leaderboard" className="mt-auto font-mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--brand)' }}>
            Full standings →
          </Link>
        </>
      )}
    </div>
  );
}

// ─── Gallery drop card ────────────────────────────────────────────────────────

interface GalleryAlbum {
  id: string;
  title: string;
  date: string;
  google_photos_url: string;
  cover_image_url: string | null;
  cover_thumbnail_url: string | null;
}

function LatestGalleryCard() {
  const { data: album, isLoading } = useQuery<GalleryAlbum | null>({
    queryKey: ['gallery-latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gallery_events')
        .select('id, title, date, google_photos_url, cover_image_url, cover_thumbnail_url')
        .not('google_photos_url', 'is', null)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return null;
      return data as GalleryAlbum;
    },
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="scrapbook-paper relative flex flex-col gap-3 p-5 sm:p-6">
      <TapeStrip color="coral" position="top" />
      <SectionLabel>Newest Album</SectionLabel>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: 'var(--brand)' }} />
        </div>
      ) : !album ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <span className="font-serif text-[28px]">📷</span>
          <p className="font-sans text-sm" style={{ color: 'var(--text3)' }}>
            No albums yet.
          </p>
          <Link to="/gallery" className="mt-2 font-mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--brand)' }}>
            Gallery →
          </Link>
        </div>
      ) : (
        <>
          <a
            href={album.google_photos_url}
            target="_blank"
            rel="noopener noreferrer"
            className="scrapbook-photo group relative block overflow-hidden"
            style={{ transform: 'rotate(-1deg)' }}
          >
            {(album.cover_thumbnail_url || album.cover_image_url) ? (
              <img
                src={getSupabaseImageUrl(album.cover_thumbnail_url || album.cover_image_url, { width: 480, height: 300, resize: 'cover', quality: 72 })}
                alt={album.title}
                className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                decoding="async"
                onError={(ev) => { ev.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="flex aspect-[16/10] w-full items-center justify-center" style={{ background: 'var(--surface2)' }}>
                <span className="font-serif text-[28px] italic" style={{ color: 'var(--text3)' }}>VSA</span>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/40">
              <span className="font-sans text-xs font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                View Album →
              </span>
            </div>
          </a>

          <div>
            <div className="truncate font-sans text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
              {album.title}
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
              {format(parseISO(album.date), 'MMM d, yyyy')}
            </div>
          </div>

          <Link to="/gallery" className="font-mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--brand)' }}>
            All albums →
          </Link>
        </>
      )}
    </div>
  );
}

// ─── Find My Points card ──────────────────────────────────────────────────────

function FindMyPointsCard() {
  const [open, setOpen] = useState(false);

  return (
    <div className="scrapbook-paper relative flex flex-col p-5 sm:p-6">
      <TapeStrip color="teal" position="top-right" />
      <SectionLabel>Points Lookup</SectionLabel>

      {!open ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4 text-center">
          <p className="max-w-[200px] font-sans text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>
            See where you rank on the leaderboard.
          </p>
          <button
            onClick={() => setOpen(true)}
            className="vsa-btn-primary py-2 text-xs"
          >
            Find My Points
          </button>
          <Link to="/leaderboard" className="font-mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--brand)' }}>
            Full leaderboard →
          </Link>
        </div>
      ) : (
        <div className="mt-2">
          <button
            onClick={() => setOpen(false)}
            className="mb-3 flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider"
            style={{ color: 'var(--text3)' }}
          >
            ← Close
          </button>
          <FindMyPoints variant="panel" showHeader={false} />
        </div>
      )}
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

export function ThisWeekInVSA() {
  const { events } = useEvents();
  const { terms } = useAcademicTerms();

  const activeTerm = terms.find((t) => t.is_active);
  const academicYearStart = activeTerm?.academic_year_start ?? null;

  return (
    <section className="vsa-section scrapbook-board">
      <div className="vsa-container">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="scrapbook-sticker scrapbook-sticker-coral mb-3">Live Updates</span>
            <h2 className="vsa-section-title">
              This Week
              <br />
              <em style={{ color: 'var(--brand)' }}>in VSA.</em>
            </h2>
          </div>
          <p className="max-w-xs font-sans text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>
            What's happening right now — events, standings, and memories.
          </p>
        </div>

        {/* Dashboard grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Events — spans 2 cols on large */}
          <div className="sm:col-span-2 lg:col-span-2">
            <EventsCard events={events} />
          </div>

          {/* House standings */}
          <div>
            <HouseStandingsCard academicYearStart={academicYearStart} />
          </div>

          {/* Gallery */}
          <div>
            <LatestGalleryCard />
          </div>

          {/* Find My Points — spans 2 cols on large */}
          <div className="sm:col-span-1 lg:col-span-2">
            <FindMyPointsCard />
          </div>
        </div>
      </div>
    </section>
  );
}
