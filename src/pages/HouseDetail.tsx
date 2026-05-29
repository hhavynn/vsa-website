import { Link, useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import { PageTitle } from '../components/common/PageTitle';
import { PageLoader } from '../components/common/PageLoader';
import { HOUSE_COLORS, HOUSE_LABELS, HouseName } from '../constants/houses';
import { houseAssetsRepository } from '../data/repos/houseAssets';
import { houseEventsRepository } from '../data/repos/houseEvents';
import { leaderboardRepository } from '../data/repos/leaderboard';
import { useAcademicTerms } from '../hooks/useAcademicTerms';
import { formatAcademicYear, getAcademicTermMeta } from '../lib/academicTerms';
import { formatDateOnly } from '../lib/dateOnly';
import { buildGcalTimedDates, formatEventTimeRange } from '../lib/eventTime';
import { getSupabaseImageUrl } from '../lib/supabaseImages';
import { HouseEvent, HousePageAsset } from '../types';
import { matchesHouseSlug } from '../utils/houseSlug';
import { getLosAngelesDateOnly } from '../utils/losAngelesDate';

function resolveHouseYear(terms: ReturnType<typeof useAcademicTerms>['terms']) {
  const activeTermYear = terms.find((term) => term.is_active)?.academic_year_start;
  if (activeTermYear) return activeTermYear;
  return getAcademicTermMeta(new Date())?.academicYearStart ?? terms[0]?.academic_year_start ?? null;
}

function getHouseLabel(asset: HousePageAsset) {
  return asset.display_name || HOUSE_LABELS[asset.house as HouseName] || asset.house_key || asset.house;
}

function getHouseColor(asset: HousePageAsset) {
  return asset.accent_color || HOUSE_COLORS[asset.house as HouseName] || 'var(--brand)';
}

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

function HouseEventCard({
  event,
  house,
  isUpcoming,
}: {
  event: HouseEvent;
  house: HousePageAsset;
  isUpcoming: boolean;
}) {
  const color = getHouseColor(house);
  const houseLabel = getHouseLabel(house);
  const imageUrl = event.image_thumbnail_url || event.image_url || house.image_thumbnail_url || house.image_url;
  const timeLabel = event.start_time && event.end_time ? formatEventTimeRange(event.start_time, event.end_time) : null;

  return (
    <article className="scrapbook-paper overflow-hidden" style={{ borderColor: `${color}55` }}>
      <div className="grid gap-0 sm:grid-cols-[160px_minmax(0,1fr)]">
        <div className="relative min-h-[180px] bg-[var(--color-surface2)] sm:min-h-0">
          {imageUrl ? (
            <img
              src={getSupabaseImageUrl(imageUrl, { width: 420, height: 300, resize: 'cover', quality: 72 })}
              alt={event.title}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full min-h-[180px] items-center justify-center">
              <span className="font-serif text-3xl italic" style={{ color }}>VSA</span>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="scrapbook-sticker scrapbook-sticker-teal px-2 py-0.5 text-[9px]">House event</span>
            <span className="rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white" style={{ background: color }}>
              {houseLabel}
            </span>
          </div>
          <h3 className="font-serif text-2xl leading-tight" style={{ color: 'var(--color-text)' }}>
            {event.title}
          </h3>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
            {formatDateOnly(event.event_date, 'MMM d, yyyy')}
            {timeLabel ? ` / ${timeLabel}` : ''}
          </p>
          {event.location && (
            <p className="mt-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
              {event.location}
            </p>
          )}
          {event.description && (
            <p className="mt-3 line-clamp-3 font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
              {event.description}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {isUpcoming && event.google_calendar_enabled && (
              <a href={buildHouseEventCalendarUrl(event, houseLabel)} target="_blank" rel="noopener noreferrer" className="vsa-btn-ghost py-2 text-xs">
                Add to Google Calendar
              </a>
            )}
            {event.rsvp_url && (
              <a href={event.rsvp_url} target="_blank" rel="noopener noreferrer" className="vsa-btn-primary py-2 text-xs">
                RSVP
              </a>
            )}
            {event.gallery_url && (
              <a href={event.gallery_url} target="_blank" rel="noopener noreferrer" className="vsa-btn-ghost py-2 text-xs">
                Gallery
              </a>
            )}
            {event.recap_url && (
              <a href={event.recap_url} target="_blank" rel="noopener noreferrer" className="vsa-btn-ghost py-2 text-xs">
                Recap
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function HouseDetail() {
  const { houseSlug = '' } = useParams();
  const { terms, loading: termsLoading } = useAcademicTerms();
  const activeYear = resolveHouseYear(terms);
  const activeYearLabel = activeYear ? formatAcademicYear(activeYear) : '';
  const today = getLosAngelesDateOnly();

  const { data: houses = [], isLoading: housesLoading } = useQuery({
    queryKey: ['house-detail', 'published-assets', activeYear],
    queryFn: () => activeYear ? houseAssetsRepository.getPublishedAssets(activeYear) : Promise.resolve([]),
    enabled: activeYear !== null,
    staleTime: 10 * 60 * 1000,
    cacheTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const house = houses.find((asset) =>
    matchesHouseSlug(asset.house_key, houseSlug) ||
    matchesHouseSlug(asset.house, houseSlug) ||
    matchesHouseSlug(asset.display_name, houseSlug)
  ) ?? null;

  const { data: standings = [] } = useQuery({
    queryKey: ['house-detail', 'standings', activeYear],
    queryFn: () => activeYear ? leaderboardRepository.getYearlyHouseLeaderboard(activeYear) : Promise.resolve([]),
    enabled: activeYear !== null,
    staleTime: 10 * 60 * 1000,
    cacheTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: upcomingEvents = [], isLoading: upcomingLoading } = useQuery({
    queryKey: ['house-detail', 'upcoming-events', house?.id, today],
    queryFn: () => house ? houseEventsRepository.getPublicUpcomingForHouse(house.id, today, 12) : Promise.resolve([]),
    enabled: !!house,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: pastEvents = [], isLoading: pastLoading } = useQuery({
    queryKey: ['house-detail', 'past-events', house?.id, today],
    queryFn: () => house ? houseEventsRepository.getPublicPastForHouse(house.id, today, 24) : Promise.resolve([]),
    enabled: !!house,
    staleTime: 10 * 60 * 1000,
    cacheTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (termsLoading || housesLoading) {
    return <PageLoader message="Loading House page..." />;
  }

  if (!house) {
    return (
      <>
        <PageTitle title="House Not Found" />
        <div className="vsa-container py-20 text-center">
          <p className="font-serif text-3xl" style={{ color: 'var(--color-text)' }}>House page not found</p>
          <p className="mt-3 font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
            This House may not be configured for the current year yet.
          </p>
          <Link to="/house-system" className="mt-6 inline-flex vsa-btn-primary">
            Back to House Program
          </Link>
        </div>
      </>
    );
  }

  const color = getHouseColor(house);
  const label = getHouseLabel(house);
  const standing = standings.find((item) => item.house_profile_id === house.id || item.house === house.house_key);
  const rank = standing ? standings.findIndex((item) => item.house_profile_id === standing.house_profile_id) + 1 : null;
  const heroImage = house.image_thumbnail_url || house.image_url;

  return (
    <>
      <PageTitle title={`${label} House`} />
      <div className="vsa-page-hero">
        <div className="vsa-container relative z-10">
          <Link to="/house-system" className="font-mono text-[11px] uppercase tracking-wider text-brand-600 dark:text-brand-400">
            Back to House Program
          </Link>
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div>
              <span className="scrapbook-sticker scrapbook-sticker-gold mb-4">{activeYearLabel}</span>
              <h1 className="vsa-page-title">{label}</h1>
              <p className="mt-4 max-w-2xl font-sans text-[15px] leading-[1.8]" style={{ color: 'var(--text2)' }}>
                {house.description || 'A mini event board for upcoming House hangouts, memories, and recaps.'}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {rank && <span className="scrapbook-sticker scrapbook-sticker-coral">Rank #{rank}</span>}
                {standing && <span className="scrapbook-sticker scrapbook-sticker-teal">{standing.total_points.toLocaleString()} pts</span>}
                <span className="rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: color }}>
                  House events
                </span>
              </div>
            </div>
            <div className="scrapbook-photo overflow-hidden" style={{ borderColor: `${color}66` }}>
              {heroImage ? (
                <img
                  src={getSupabaseImageUrl(heroImage, { width: 640, height: 480, resize: 'cover', quality: 74 })}
                  alt={house.image_alt || label}
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center" style={{ background: `${color}18` }}>
                  <span className="font-serif text-5xl italic" style={{ color }}>{label.slice(0, 2)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="vsa-container space-y-14 py-10">
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="vsa-section-label">House calendar</div>
              <h2 className="font-serif text-3xl leading-tight" style={{ color: 'var(--color-text)' }}>Upcoming House Events</h2>
            </div>
          </div>
          {upcomingLoading ? (
            <div className="scrapbook-empty text-sm">Loading House events...</div>
          ) : upcomingEvents.length === 0 ? (
            <div className="scrapbook-empty">
              <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>No upcoming House events yet. Check back soon.</p>
            </div>
          ) : (
            <div className="grid gap-5">
              {upcomingEvents.map((event) => <HouseEventCard key={event.id} event={event} house={house} isUpcoming />)}
            </div>
          )}
        </section>

        <section>
          <div className="mb-5">
            <div className="vsa-section-label">Memory board</div>
            <h2 className="font-serif text-3xl leading-tight" style={{ color: 'var(--color-text)' }}>Past House Events</h2>
          </div>
          {pastLoading ? (
            <div className="scrapbook-empty text-sm">Loading past House events...</div>
          ) : pastEvents.length === 0 ? (
            <div className="scrapbook-empty">
              <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>Past House events will show up here after they happen.</p>
            </div>
          ) : (
            <div className="grid gap-5">
              {pastEvents.map((event) => <HouseEventCard key={event.id} event={event} house={house} isUpcoming={false} />)}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
