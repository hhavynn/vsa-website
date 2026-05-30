import { Link, useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useMemo, useState } from 'react';
import { PageTitle } from '../components/common/PageTitle';
import { PageLoader } from '../components/common/PageLoader';
import { HOUSE_COLORS, HOUSE_LABELS, HouseName } from '../constants/houses';
import { houseAssetsRepository } from '../data/repos/houseAssets';
import { houseEventsRepository } from '../data/repos/houseEvents';
import { leaderboardRepository } from '../data/repos/leaderboard';
import { useAcademicTerms } from '../hooks/useAcademicTerms';
import { formatAcademicYear, getAcademicTermMeta, parseYearSlug } from '../lib/academicTerms';
import { getSupabaseImageUrl } from '../lib/supabaseImages';
import { HousePageAsset, HouseYearlyPoints } from '../types';
import { matchesHouseSlug } from '../utils/houseSlug';
import { getLosAngelesDateOnly } from '../utils/losAngelesDate';
import { Label } from '../components/ui/Label';
import { HouseEventCard } from '../components/features/house/HouseEventCard';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';
import { getPublicHousePoints, isHousePointOverrideActive } from '../utils/housePublicPointOverrides';

function getCurrentAcademicYearStart() {
  return getAcademicTermMeta(new Date())?.academicYearStart ?? null;
}

function resolveHouseYear(terms: ReturnType<typeof useAcademicTerms>['terms'], yearSlug?: string) {
  if (yearSlug) {
    const parsed = parseYearSlug(yearSlug);
    if (parsed) return parsed;
  }
  const activeTermYear = terms.find((term) => term.is_active)?.academic_year_start;
  if (activeTermYear) return activeTermYear;
  const currentYear = getCurrentAcademicYearStart();
  if (currentYear) return currentYear;
  return terms[0]?.academic_year_start ?? null;
}

function getHouseLabel(asset: HousePageAsset) {
  return asset.display_name || HOUSE_LABELS[asset.house as HouseName] || asset.house_key || asset.house;
}

function getHouseColor(asset: HousePageAsset) {
  return asset.accent_color || HOUSE_COLORS[asset.house as HouseName] || 'var(--brand)';
}

function HouseParentsSection({ house, label, color }: { house: HousePageAsset; label: string; color: string }) {
  const parentImage = house.house_parent_image_url;
  const heading = house.house_parent_heading || 'Meet the House Parents';
  const body = house.house_parent_body || 'The people helping lead this House through the year.';

  return (
    <RevealOnScrollWrapper>
      <section id="house-parents" className="scroll-mt-24">
        <div className="mb-8">
          <Label className="mb-2">House Parents</Label>
          <h2 className="font-serif text-[32px] leading-tight" style={{ color: 'var(--color-text)' }}>{heading}</h2>
          <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
            {body}
          </p>
        </div>

        <div className="scrapbook-paper mx-auto max-w-3xl overflow-hidden p-4 sm:p-5" style={{ borderColor: `${color}55` }}>
          {parentImage ? (
            <div className="rounded border p-3" style={{ borderColor: `${color}33`, background: 'var(--color-surface2)' }}>
              <img
                src={getSupabaseImageUrl(parentImage, { width: 1100, height: 1500, resize: 'contain', quality: 78 })}
                alt={`${label} House Parent announcement`}
                className="mx-auto max-h-[78vh] w-full object-contain"
                loading="lazy"
                decoding="async"
              />
            </div>
          ) : (
            <div className="rounded border px-6 py-12 text-center" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
              <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                House Parent announcements will show up here soon.
              </p>
            </div>
          )}
        </div>
      </section>
    </RevealOnScrollWrapper>
  );
}

export function HouseDetail() {
  const { yearSlug, houseSlug = '' } = useParams();
  const [showAllPastEvents, setShowAllPastEvents] = useState(false);
  const { terms, loading: termsLoading } = useAcademicTerms();
  
  const activeTermYear = terms.find((term) => term.is_active)?.academic_year_start ?? null;
  const activeYear = resolveHouseYear(terms, yearSlug);
  const activeYearLabel = activeYear ? formatAcademicYear(activeYear) : '';

  // Distinguish past archive years from the current year
  const currentYear = activeTermYear ?? getAcademicTermMeta(new Date())?.academicYearStart ?? 2025;
  const isArchive = activeYear !== null && activeYear < currentYear;
  const isLegacyArchive = activeYear !== null && activeYear < currentYear - 1;

  // Back-link destination: year overview for archive, current overview otherwise
  const backHref = isArchive ? `/house/year/${activeYearLabel}` : '/house';
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

  const { data: rawStandings = [] } = useQuery({
    queryKey: ['house-detail', 'standings', activeYear],
    queryFn: () => activeYear ? leaderboardRepository.getYearlyHouseLeaderboard(activeYear) : Promise.resolve([]),
    enabled: activeYear !== null,
    staleTime: 10 * 60 * 1000,
    cacheTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const standings = useMemo((): HouseYearlyPoints[] => {
    // When the DB has no calculated standings for an override year, inject
    // official placeholder rows keyed to the loaded house assets.
    const base: HouseYearlyPoints[] =
      rawStandings.length === 0 &&
      typeof activeYear === 'number' &&
      isHousePointOverrideActive(activeYear) &&
      houses.length > 0
        ? houses.flatMap((asset) => {
            const pts = getPublicHousePoints({
              houseKey: asset.house_key ?? asset.house,
              houseName: asset.house,
              academicYearStart: activeYear,
              calculatedPoints: 0,
            });
            if (!pts) return [];
            return [{
              house: asset.house_key ?? asset.house,
              house_profile_id: asset.id,
              display_name: asset.display_name ?? asset.house,
              image_url: asset.image_url ?? null,
              accent_color: asset.accent_color ?? null,
              academic_year_start: activeYear,
              academic_year_end: activeYear + 1,
              total_points: pts,
              events_attended: 0,
              unique_events: 0,
              unique_members: 0,
              average_points_per_member: null,
              latest_activity_at: null,
            } as HouseYearlyPoints];
          })
        : rawStandings;

    return base.map((s) => ({
      ...s,
      total_points: getPublicHousePoints({
        houseKey: s.house,
        houseName: s.display_name,
        academicYearStart: s.academic_year_start,
        calculatedPoints: s.total_points,
      }),
    })).sort((a, b) => b.total_points - a.total_points);
  }, [rawStandings, activeYear, houses]);

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
        <div className="vsa-container py-24 text-center">
          <span className="scrapbook-sticker scrapbook-sticker-gold mb-6">404</span>
          <h1 className="font-serif text-[42px] leading-tight" style={{ color: 'var(--color-text)' }}>House page not found</h1>
          <p className="mx-auto mt-4 max-w-md font-sans text-[15px] leading-relaxed" style={{ color: 'var(--color-text3)' }}>
            This House may not be configured for the current year yet, or the URL might be incorrect.
          </p>
          <div className="mt-8">
            <Link to={backHref} className="vsa-btn-primary">
              Back to House Program
            </Link>
          </div>
        </div>
      </>
    );
  }

  const color = getHouseColor(house);
  const label = getHouseLabel(house);
  const standing = standings.find((item) => item.house_profile_id === house.id || item.house === house.house_key);
  const rank = standing ? standings.findIndex((item) => item.house_profile_id === standing.house_profile_id) + 1 : null;
  const heroImage = house.image_thumbnail_url || house.image_url;
  const visiblePastEvents = showAllPastEvents ? pastEvents : pastEvents.slice(0, 8);

  return (
    <>
      <PageTitle title={`${label} House`} />
      <div className="vsa-page-hero">
        <div className="vsa-container relative z-10">
          <Link to={backHref} className="font-mono text-[11px] uppercase tracking-wider text-brand-600 dark:text-brand-400">
            ← Back to House Program
          </Link>
          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="scrapbook-sticker scrapbook-sticker-gold">{activeYearLabel}</span>
                {isArchive && <span className="scrapbook-sticker scrapbook-sticker-gold">Archive</span>}
                {rank && !isArchive && <span className="scrapbook-sticker scrapbook-sticker-coral">Rank #{rank}</span>}
                {standing && !isArchive && <span className="scrapbook-sticker scrapbook-sticker-teal">{standing.total_points.toLocaleString()} house pts</span>}
              </div>
              <h1 className="vsa-page-title">{house.emoji ? `${house.emoji} ` : ''}{label}</h1>
              <p className="mt-5 max-w-2xl font-sans text-[16px] leading-[1.75]" style={{ color: 'var(--text2)' }}>
                {house.description || 'Join your fellow house members for socials, bonding events, and activities throughout the year.'}
              </p>
              <div className="mt-6">
                <span className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: `${color}66`, color }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                  {isArchive ? `${activeYearLabel} House` : 'House Community'}
                </span>
              </div>
            </div>
            <div className="scrapbook-photo overflow-hidden" style={{ borderColor: `${color}66` }}>
              {heroImage ? (
                <img
                  src={getSupabaseImageUrl(heroImage, { width: 720, height: 540, resize: 'cover', quality: 74 })}
                  alt={house.image_alt || label}
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center" style={{ background: `${color}12` }}>
                  <span className="font-serif text-5xl italic" style={{ color }}>{label.slice(0, 2)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="vsa-container py-12 lg:py-16">
        {standing && !isArchive && (
          <div className="mb-12 grid gap-3 sm:grid-cols-3">
            <div className="rounded border p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text3)' }}>Rank</div>
              <div className="mt-1 font-serif text-2xl" style={{ color }}>#{rank}</div>
            </div>
            <div className="rounded border p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text3)' }}>Points</div>
              <div className="mt-1 font-serif text-2xl" style={{ color }}>{standing.total_points.toLocaleString()}</div>
            </div>
            <div className="rounded border p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text3)' }}>Members</div>
              <div className="mt-1 font-serif text-2xl" style={{ color }}>{standing.unique_members.toLocaleString()}</div>
            </div>
          </div>
        )}

        <RevealOnScrollWrapper>
          {!isArchive && (
            <section id="upcoming-events" className="scroll-mt-24">
              <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <Label className="mb-2">House Calendar</Label>
                  <h2 className="font-serif text-[32px] leading-tight" style={{ color: 'var(--color-text)' }}>Upcoming House Events</h2>
                  <p className="mt-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
                    Hangouts and socials exclusive to {label} members.
                  </p>
                </div>
              </div>

              {upcomingLoading ? (
                <div className="py-10 text-center font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                  Loading upcoming events...
                </div>
              ) : upcomingEvents.length === 0 ? (
                <div className="scrapbook-empty py-12 text-center">
                  <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                    No upcoming events for {label} just yet. Check back soon!
                  </p>
                </div>
              ) : (
                <div className="grid gap-6">
                  {upcomingEvents.map((event) => (
                    <HouseEventCard key={event.id} event={event} house={house} isUpcoming />
                  ))}
                </div>
              )}
            </section>
          )}

          {!isArchive && <div className="my-16 border-t" style={{ borderColor: 'var(--color-border)' }} />}

          <HouseParentsSection house={house} label={label} color={color} />

          <div className="my-16 border-t" style={{ borderColor: 'var(--color-border)' }} />

          <section id="past-events" className="scroll-mt-24">
            <div className="mb-8">
              <Label className="mb-2">{isLegacyArchive ? 'Event Archive' : 'Memory Board'}</Label>
              <h2 className="font-serif text-[32px] leading-tight" style={{ color: 'var(--color-text)' }}>
                {isLegacyArchive ? 'Archived House Events' : 'Past House Events'}
              </h2>
              <p className="mt-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
                {isLegacyArchive
                  ? `Events and recaps from the ${activeYearLabel} ${label} House year.`
                  : 'Recaps and memories from our previous socials.'}
              </p>
            </div>

            {pastLoading ? (
              <div className="py-10 text-center font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                Loading events...
              </div>
            ) : pastEvents.length === 0 ? (
              <div className={`scrapbook-empty ${isLegacyArchive ? 'py-8' : 'py-12'} text-center`}>
                <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                  {isLegacyArchive
                    ? 'No archived events have been added for this House yet.'
                    : "Past events will appear here once we've had our first hangout."}
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-6">
                  {visiblePastEvents.map((event) => (
                  <HouseEventCard key={event.id} event={event} house={house} isUpcoming={false} />
                  ))}
                </div>
                {!showAllPastEvents && pastEvents.length > visiblePastEvents.length && (
                  <div className="mt-6 text-center">
                    <button
                      type="button"
                      onClick={() => setShowAllPastEvents(true)}
                      className="vsa-btn-ghost font-sans text-sm"
                    >
                      Show more past events
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </RevealOnScrollWrapper>

        <div className="mt-20 text-center">
          <Link to={backHref} className="vsa-btn-ghost inline-flex items-center gap-2 font-sans text-sm">
            ← View All Houses
          </Link>
        </div>
      </div>
    </>
  );
}
