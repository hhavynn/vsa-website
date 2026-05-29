import { Link, useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useMemo } from 'react';
import { PageTitle } from '../components/common/PageTitle';
import { PageLoader } from '../components/common/PageLoader';
import { HOUSE_COLORS, HOUSE_LABELS, HouseName } from '../constants/houses';
import { houseAssetsRepository } from '../data/repos/houseAssets';
import { houseEventsRepository } from '../data/repos/houseEvents';
import { leaderboardRepository } from '../data/repos/leaderboard';
import { useAcademicTerms } from '../hooks/useAcademicTerms';
import { formatAcademicYear, getAcademicTermMeta, parseYearSlug } from '../lib/academicTerms';
import { getSupabaseImageUrl } from '../lib/supabaseImages';
import { HousePageAsset } from '../types';
import { matchesHouseSlug } from '../utils/houseSlug';
import { getLosAngelesDateOnly } from '../utils/losAngelesDate';
import { Label } from '../components/ui/Label';
import { HouseEventCard } from '../components/features/house/HouseEventCard';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';
import { getPublicHousePoints } from '../utils/housePublicPointOverrides';

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

export function HouseDetail() {
  const { yearSlug, houseSlug = '' } = useParams();
  const { terms, loading: termsLoading } = useAcademicTerms();
  
  const activeTermYear = terms.find((term) => term.is_active)?.academic_year_start ?? null;
  const activeYear = resolveHouseYear(terms, yearSlug);
  const activeYearLabel = activeYear ? formatAcademicYear(activeYear) : '';
  const isArchive = activeYear !== null && activeYear !== activeTermYear;
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

  const standings = useMemo(() => {
    return rawStandings.map((s) => ({
      ...s,
      total_points: getPublicHousePoints({
        houseKey: s.house,
        houseName: s.display_name,
        academicYearStart: s.academic_year_start,
        calculatedPoints: s.total_points,
      }),
    })).sort((a, b) => b.total_points - a.total_points);
  }, [rawStandings]);

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
            <Link to="/house-system" className="vsa-btn-primary">
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

  return (
    <>
      <PageTitle title={`${label} House`} />
      <div className="vsa-page-hero">
        <div className="vsa-container relative z-10">
          <Link to="/house-system" className="font-mono text-[11px] uppercase tracking-wider text-brand-600 dark:text-brand-400">
            ← Back to House Program
          </Link>
          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="scrapbook-sticker scrapbook-sticker-gold">{activeYearLabel}</span>
                {isArchive && <span className="scrapbook-sticker scrapbook-sticker-gold">Archive</span>}
                {rank && <span className="scrapbook-sticker scrapbook-sticker-coral">Rank #{rank}</span>}
                {standing && <span className="scrapbook-sticker scrapbook-sticker-teal">{standing.total_points.toLocaleString()} house pts</span>}
              </div>
              <h1 className="vsa-page-title">{label}</h1>
              <p className="mt-5 max-w-2xl font-sans text-[16px] leading-[1.75]" style={{ color: 'var(--text2)' }}>
                {house.description || 'Join your fellow house members for socials, bonding events, and activities throughout the year.'}
              </p>
              <div className="mt-6">
                <span className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: `${color}66`, color }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                  House Community
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
        <RevealOnScrollWrapper>
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

          <div className="my-16 border-t" style={{ borderColor: 'var(--color-border)' }} />

          <section id="past-events" className="scroll-mt-24">
            <div className="mb-8">
              <Label className="mb-2">Memory Board</Label>
              <h2 className="font-serif text-[32px] leading-tight" style={{ color: 'var(--color-text)' }}>Past House Events</h2>
              <p className="mt-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
                Recaps and memories from our previous socials.
              </p>
            </div>

            {pastLoading ? (
              <div className="py-10 text-center font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                Loading past events...
              </div>
            ) : pastEvents.length === 0 ? (
              <div className="scrapbook-empty py-12 text-center">
                <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                  Past events will appear here once we've had our first hangout.
                </p>
              </div>
            ) : (
              <div className="grid gap-6">
                {pastEvents.map((event) => (
                  <HouseEventCard key={event.id} event={event} house={house} isUpcoming={false} />
                ))}
              </div>
            )}
          </section>
        </RevealOnScrollWrapper>

        <div className="mt-20 text-center">
          <Link to="/house-system" className="vsa-btn-ghost inline-flex items-center gap-2 font-sans text-sm">
            ← View All Houses
          </Link>
        </div>
      </div>
    </>
  );
}
