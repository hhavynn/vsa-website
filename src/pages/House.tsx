import { useState } from 'react';
import { readableInk } from '../lib/readableInk';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import { PageTitle } from '../components/common/PageTitle';
import { PublicBreadcrumbs } from '../components/common/PublicBreadcrumbs';
import { EditorialHero, EditorialHeroScript } from '../components/common/EditorialHero';
import { ProgramContentCallout } from '../components/features/program/ProgramContentCallout';
import { ApplicationCTA } from '../components/common/ApplicationCTA';
import { HOUSE_COLORS, HOUSE_LABELS, HouseName } from '../constants/houses';
import { houseEventsRepository } from '../data/repos/houseEvents';
import { getAcademicTermMeta, formatAcademicYear, parseYearSlug, resolveCurrentAcademicYearStart } from '../lib/academicTerms';
import { formatDateOnly } from '../lib/dateOnly';
import { formatEventTimeRange } from '../lib/eventTime';
import { getSummerBreakMessage, isSummerBreak } from '../utils/seasonalState';
import { useAcademicTerms } from '../hooks/useAcademicTerms';
import { usePublishedHouseAssets } from '../hooks/useHouseAssets';
import { useProgramContent } from '../hooks/useProgramContent';
import { OptimizedImage } from '../components/common/OptimizedImage';
import { PublicHouseEvent, HousePageAsset } from '../types';
import { getHousePagePath, houseSlugFromKey } from '../utils/houseSlug';
import { getLegacyHouseArchiveByYear, getLegacyHouseArchiveYears, getVerifiedLegacyHouseYears } from '../data/legacyHouseArchive';
import { HouseYearSelector } from '../components/features/house/HouseYearSelector';
import { FindMyHouse } from '../components/features/house/FindMyHouse';
import { hasRevealedHouseMemberships } from '../data/repos/houseMemberships';

import { isSupabaseUnavailable } from '../utils/isSupabaseUnavailable';
import { DegradedModeBanner } from '../components/common/DegradedModeBanner';
import { ProfileSpotlightCard } from '../components/ui/ProfileSpotlightCard';
import { RelatedLinks } from '../components/common/RelatedLinks';
import { houseRelatedLinks } from '../lib/relatedLinks';

// ─────────────────────────────────────────────────────────────────────────────
// HOUSE PERSONALITY — Flavor copy per house. Update each cycle as needed.
// ─────────────────────────────────────────────────────────────────────────────

const HOUSE_TAGLINES: Record<HouseName, string> = {
  Bowser: 'Big boss energy. Show up, dominate, repeat.',
  'Donkey Kong': 'Loud, wild, and impossible to ignore.',
  Boo: "Silent… until it's time to go off.",
  Toad: 'Small but mighty. Always ahead of the curve.',
};

const HOUSE_EMOJI: Record<HouseName, string> = {
  Bowser: '🐢',
  'Donkey Kong': '🦍',
  Boo: '👻',
  Toad: '🍄',
};

// ─────────────────────────────────────────────────────────────────────────────
// STATIC DATA
// ─────────────────────────────────────────────────────────────────────────────

interface HouseParent {
  name: string;
  house: string;
  emoji: string;
  bio: string;
  photo?: string;
}

const HOUSE_PARENTS: HouseParent[] = [
  // Example — replace with actual House Parents each year:
  // { name: 'First Last', house: 'Boo', emoji: '', bio: 'Short bio here.' },
];

const steps = [
  { num: '01', title: 'Join the Program', desc: "Sign up when applications or sign-ups open each year." },
  { num: '02', title: 'Get Sorted', desc: 'House Reveal introduces you to your House for the year.' },
  { num: '03', title: 'Meet Your House', desc: 'House Parents and socials help you find your smaller VSA crew.' },
  { num: '04', title: 'Earn Points', desc: 'Check in at qualifying events to help your House climb the board.' },
];

const faqs = [
  { q: 'Do I need to already know people in VSA to join?', a: "Not at all. The program is meant to help members meet new people and feel more connected, especially if you are newer to VSA or looking for a smaller group within the org." },
  { q: 'What kinds of events are part of the program?', a: 'Events vary by house and cycle but may include reveals, bonding socials, study jams, karaoke, movie nights, and inter-House collaborations.' },
  { q: 'What do House Parents do?', a: 'House Parents lead their house throughout the year. They plan socials and bonding activities, communicate with members, encourage participation, and help create a welcoming environment for everyone in the house.' },
  { q: 'How do House points work?', a: 'A confirmed check-in at a qualifying VSA event earns one House competition point for an eligible House member. Only attendance credited under the current academic-year rules counts; public standings are announced at GBMs, not updated live online.' },
  { q: 'Are my personal VSA points the same as House points?', a: 'No. Your individual VSA points follow the events and their point values. House competition points are a separate attendance-based measure: a qualifying event can count once toward an eligible House membership, regardless of the event\'s individual point value.' },
  { q: 'Do House socials automatically award House points?', a: 'No. House socials are for meeting and bonding with your House. Attending one does not automatically earn competition points; only events confirmed as qualifying under VSA\'s current rules count.' },
  { q: 'What happens if I join or switch Houses during the year?', a: 'House credit depends on your official effective membership dates. Attendance before your membership started does not retroactively count for your new House, and changing Houses does not transfer earlier credit.' },
  { q: 'What if I checked in twice or my points look missing?', a: 'Multiple check-ins for the same member at the same event do not award extra House credit. Attendance needs to be verified and imported by VSA before it can count. If a record seems missing, reach out to VSA leadership with the event details.' },
  { q: 'When can I see the House standings?', a: 'House standings are tracked privately and officially announced at general body meetings (GBMs). The website does not display live House rankings, member House contributions or competition totals.' },
  { q: 'When do sign-ups or applications open?', a: "Sign-up timelines are announced at the start of each year through VSA's official channels. Follow @vsaatucsd on Instagram to stay up to date." },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getCurrentAcademicYearStart() {
  return getAcademicTermMeta(new Date())?.academicYearStart ?? null;
}

function resolveHouseYear(terms: ReturnType<typeof useAcademicTerms>['terms'], yearSlug?: string) {
  if (yearSlug) {
    const parsed = parseYearSlug(yearSlug);
    return parsed ?? null;
  }
  const activeTermYear = terms.find((term) => term.is_active)?.academic_year_start;
  if (activeTermYear) return activeTermYear;
  const currentYear = getCurrentAcademicYearStart();
  if (currentYear) return currentYear;
  return terms[0]?.academic_year_start ?? null;
}

function getHouseLabel(house: string, asset?: HousePageAsset | null, displayName?: string | null) {
  return displayName || asset?.display_name || HOUSE_LABELS[house as HouseName] || house;
}

function getHouseColor(house: string, asset?: HousePageAsset | null, accentColor?: string | null) {
  return accentColor || asset?.accent_color || HOUSE_COLORS[house as HouseName] || 'var(--brand)';
}

function getTodayDateOnly(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function HouseLegacyPreview() {
  const archiveYears = getLegacyHouseArchiveYears();
  const verifiedYears = getVerifiedLegacyHouseYears();
  const previewYears = archiveYears.filter((entry) => entry.status !== 'current').slice(0, 2);

  return (
    <section id="archive" className="program-section scroll-mt-24">
      <div className="program-section-inner">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <div>
            <div className="program-eyebrow">House Legacy</div>
            <h2 className="font-serif text-[34px] leading-tight sm:text-[42px]" style={{ color: 'var(--color-text)' }}>
              Houses reset every year, but the lore sticks around.
            </h2>
            <p className="mt-4 max-w-xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
              Every year brings a new theme. Here is a look back at the House eras we could verify from the archives.
            </p>
            <p className="mt-3 max-w-xl font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text3)' }}>
              {verifiedYears.length} confirmed eras, one archive gap, and a few names older members might remember.
            </p>
            <Link to="/house/archive" className="vsa-btn-primary mt-6 inline-flex font-sans text-sm">
              Explore House Archive
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {previewYears.map((entry) => (
              <Link
                key={entry.academicYear}
                to="/house/archive"
                className="scrapbook-paper group p-4 transition-transform hover:-translate-y-1"
                style={{ borderColor: entry.status === 'unconfirmed' ? 'var(--tape-gold)' : 'var(--color-border)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--color-text3)' }}>
                    {entry.academicYear}
                  </span>
                  <span className="scrapbook-sticker px-2 py-0.5 text-[9px]">
                    {entry.status === 'current' ? 'Current' : entry.status === 'unconfirmed' ? 'Mystery' : 'Verified'}
                  </span>
                </div>
                <h3 className="mt-3 font-serif text-xl leading-tight" style={{ color: 'var(--color-text)' }}>
                  {entry.title}
                </h3>
                <p className="mt-1 font-sans text-xs font-semibold" style={{ color: 'var(--color-text2)' }}>
                  {entry.theme}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {entry.houses.length > 0 ? (
                    entry.houses.slice(0, 4).map((house) => (
                      <span key={house} className="rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)' }}>
                        {house}
                      </span>
                    ))
                  ) : (
                    <span className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>No confirmed Houses yet</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HouseAnchorNav() {
  const items = [
    { href: '#houses', label: 'Houses' },
    { href: '#standings', label: 'Standings' },
    { href: '#archive', label: 'Archive' },
  ];

  return (
    <nav className="program-section py-0" aria-label="House page sections">
      <div className="program-section-inner">
        <div className="flex gap-2 overflow-x-auto rounded-full border p-1" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex touch:min-h-11 items-center shrink-0 rounded-full px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors hover:bg-[var(--color-surface2)]"
              style={{ color: 'var(--color-text2)' }}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}

function getHouseEventHousesLabel(event: PublicHouseEvent) {
  const houses = event.houses && event.houses.length > 0 ? event.houses : [];
  if (houses.length === 0) return 'House event';
  return houses.map((house) => house.display_name || house.house_key || house.house).join(' + ');
}

function HouseEventPreviewCard({ event }: { event: PublicHouseEvent }) {
  const housesLabel = getHouseEventHousesLabel(event);
  const timeLabel = event.start_time && event.end_time ? formatEventTimeRange(event.start_time, event.end_time) : '';
  const house = event.houses?.[0];
  const color = house?.accent_color || HOUSE_COLORS[house?.house as HouseName] || 'var(--brand)';
  const imageUrl = event.image_thumbnail_url || event.image_url;

  return (
    <div className="scrapbook-note flex items-start gap-4 px-4 py-4">
      <div className="w-12 shrink-0 text-center">
        <div className="font-mono text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
          {formatDateOnly(event.event_date, 'MMM')}
        </div>
        <div className="font-serif text-[28px] leading-none" style={{ color: 'var(--color-text)' }}>
          {formatDateOnly(event.event_date, 'd')}
        </div>
      </div>

      {imageUrl && (
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded border scrapbook-photo-sm" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex h-full w-full items-center justify-center bg-[var(--color-surface2)]">
            <span className="font-serif text-lg italic" style={{ color }}>VSA</span>
          </div>
          <OptimizedImage
            src={imageUrl}
            alt={event.title}
            width={128}
            height={128}
            widths={[64, 128]}
            sizes="64px"
            quality={70}
            className="-mt-16 h-full w-full object-cover"
          />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="scrapbook-sticker scrapbook-sticker-teal px-2 py-0.5 text-[9px]">
            House Event
          </span>
          {event.houses && event.houses.length > 0 && (
            <span className="rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider" style={{ background: color, color: readableInk(color) }}>
              {housesLabel}
            </span>
          )}
        </div>
        <div className="mt-1.5 truncate font-sans text-[13px] font-semibold" style={{ color: 'var(--color-text)' }}>
          {event.title}
        </div>
        {(event.location || timeLabel) && (
          <div className="mt-0.5 truncate font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
            {[event.location, timeLabel].filter(Boolean).join(' / ')}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function House() {
  const { yearSlug } = useParams();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { terms } = useAcademicTerms();
  const { content: cycleContent } = useProgramContent('house');
  const today = getTodayDateOnly();

  const activeTermYear = terms.find((term) => term.is_active)?.academic_year_start ?? null;
  const invalidYearSlug = !!yearSlug && parseYearSlug(yearSlug) === null;
  const activeYear = resolveHouseYear(terms, yearSlug);
  const activeYearLabel = activeYear ? formatAcademicYear(activeYear) : '';

  // Determine the "real" current year even when terms haven't loaded yet
  const currentYear = resolveCurrentAcademicYearStart(activeTermYear, new Date());
  const isArchive = activeYear !== null && activeYear < currentYear;
  const isPastYear = activeYear !== null && activeYear === currentYear - 1;
  const isLegacyArchive = activeYear !== null && activeYear < currentYear - 1;
  const isFutureYear = activeYear !== null && activeYear > currentYear;
  const legacyArchiveEntry = activeYearLabel ? getLegacyHouseArchiveByYear(activeYearLabel) : null;

  const { data: upcomingHouseEvents = [] } = useQuery<PublicHouseEvent[]>({
    queryKey: ['house', 'upcoming-house-event-preview', today, activeYear],
    queryFn: () => houseEventsRepository.getPublicUpcomingPreview(today, activeYear, 3),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !invalidYearSlug && !isArchive && !isFutureYear && activeYear !== null,
  });

  const { data: pastHouseEvents = [] } = useQuery<PublicHouseEvent[]>({
    queryKey: ['house', 'past-house-event-preview', today, activeYear],
    queryFn: () => houseEventsRepository.getPublicPastEventsForYear(today, activeYear!, 4),
    staleTime: 10 * 60 * 1000,
    cacheTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !isArchive && !isFutureYear && activeYear !== null,
  });

  const { data: archiveEvents = [], isLoading: archiveEventsLoading } = useQuery<PublicHouseEvent[]>({
    queryKey: ['house', 'archive-events-for-year', activeYear],
    queryFn: () => houseEventsRepository.getPublicEventsForYear(activeYear!, 12),
    staleTime: 10 * 60 * 1000,
    cacheTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: isArchive && activeYear !== null,
  });

  const { assets: houseAssets, loading: houseAssetsLoading, error: houseAssetsError } = usePublishedHouseAssets(activeYear);
  // An empty list while loading (or after a failed request) is not evidence
  // that the Houses are unannounced; only say so once the query has succeeded.
  // An anonymous, bounded read from the already Reveal-gated score-free view.
  // Never show the identity search before public House memberships exist.
  const { data: hasPublishedHouseMembers = false } = useQuery<boolean>({
    queryKey: ['house', 'find-my-house-revealed', activeYear],
    queryFn: () => hasRevealedHouseMemberships(activeYear as number),
    enabled: !!activeYear && !isArchive && !isFutureYear && houseAssets.length > 0,
    staleTime: 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const houseAssetsSettled = !houseAssetsLoading && !houseAssetsError;
  const isDegradedMode = isSupabaseUnavailable(houseAssetsError);
  const displayedHouses = isFutureYear
    ? []
    : houseAssets.length > 0
      ? houseAssets.map((asset) => ({ house: asset.house_key ?? asset.house, asset }))
      : isArchive
        ? (legacyArchiveEntry?.houses ?? []).map((house) => ({ house, asset: undefined }))
        : [];

  // Live House standings are private. Never request aggregates from a public page.
  const summerBreak = isSummerBreak();
  const summerHouseMessage = getSummerBreakMessage('house');

  const showSummerTransition = summerBreak && !isArchive && !isFutureYear && houseAssetsSettled && houseAssets.length === 0;

  if (invalidYearSlug) {
    return (
      <>
        <PageTitle title="House Year Not Found" />
        <div className="vsa-container py-24 text-center">
          <span className="scrapbook-sticker scrapbook-sticker-gold mb-6">404</span>
          <h1 className="font-serif text-[42px] leading-tight" style={{ color: 'var(--color-text)' }}>House year not found</h1>
          <p className="mx-auto mt-4 max-w-md font-sans text-[15px] leading-relaxed" style={{ color: 'var(--color-text3)' }}>
            This House archive year is not available. Choose a year from the House archive instead.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/house" className="vsa-btn-primary">Current Houses</Link>
            <Link to="/house/archive" className="vsa-btn-ghost">House Archive</Link>
          </div>
        </div>
      </>
    );
  }

  // Future year — show a coming-soon placeholder instead of the normal page
  if (isFutureYear && activeYear !== null) {
    return (
      <>
        <PageTitle title={`House Program ${activeYearLabel}`} />
        <PublicBreadcrumbs context={{ currentYear }} />
        <div className="program-app">
          <EditorialHero
            eyebrow="Not announced yet"
            title={<>House <EditorialHeroScript><span className="whitespace-nowrap">{activeYearLabel}</span></EditorialHeroScript></>}
            meta={`${activeYearLabel} Houses have not been announced yet. Check back after House Reveal for the official theme, assignments, and House Parent updates.`}
            watermark="houses"
            actions={<span className="scrapbook-sticker scrapbook-sticker-gold">Check back after House Reveal</span>}
          />

          {/* Year selector */}
          <div className="program-section py-4">
            <div className="program-section-inner">
              <HouseYearSelector activeStartYear={activeYear} currentYear={currentYear} />
            </div>
          </div>

          {/* Placeholder card */}
          <section className="program-section">
            <div className="program-section-inner">
              <div className="scrapbook-paper p-6 text-center sm:p-8">
                <span className="scrapbook-sticker mb-6 inline-block">🏠</span>
                <h2 className="mx-auto mt-4 max-w-xl font-serif text-[28px] leading-tight" style={{ color: 'var(--color-text)' }}>
                  {activeYearLabel} Houses have not been announced yet
                </h2>
                <p className="mx-auto mt-4 max-w-xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                  Current House information will be updated once assignments are finalized. Follow <a href="https://www.instagram.com/vsaatucsd/" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline" style={{ color: 'var(--brand)' }}>@vsaatucsd</a> on Instagram for official House Reveal announcements.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Link to="/house" className="vsa-btn-primary font-sans text-sm">
                    View Current House Program →
                  </Link>
                  <Link to="/house/archive" className="vsa-btn-ghost font-sans text-sm">
                    Explore House Archive
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle title={isArchive ? `House Archive ${activeYearLabel}` : 'House Program'} />
      <PublicBreadcrumbs context={{ currentYear }} />
      {isDegradedMode && <DegradedModeBanner sourceName="house" />}

      <div className="program-app">

        {/* ── Hero ── */}
        <EditorialHero
          eyebrow={isArchive ? `Archived / ${activeYearLabel}` : 'House Board'}
          title={<>House <EditorialHeroScript>{isArchive ? 'Archive' : 'Program'}</EditorialHeroScript></>}
          meta={isArchive
            ? `Exploring the House memories and communities from the ${activeYearLabel} school year.`
            : 'Year-long community competition inside VSA at UCSD. Get sorted, meet your house, show up for qualifying events, and help your team climb the board.'}
          watermark="houses"
          actions={
            <>
              {isArchive && (
                <Link to="/house" className="scrapbook-sticker scrapbook-sticker-gold">
                  ← Back to Current Year
                </Link>
              )}
              {activeYearLabel && <span className="scrapbook-sticker scrapbook-sticker-gold">{activeYearLabel}</span>}
              {summerBreak && !isArchive ? (
                <span className="scrapbook-sticker scrapbook-sticker-gold">Summer break</span>
              ) : null}
            </>
          }
        />

        {/* ── Year Selector ── */}
        <div className="program-section py-4">
          <div className="program-section-inner">
            <HouseYearSelector activeStartYear={activeYear} currentYear={currentYear} />
          </div>
        </div>

        {/* ── Program callout ── */}
        {cycleContent && (
          <section className="program-section">
            <div className="program-section-inner">
              <ProgramContentCallout
                content={cycleContent}
                defaultTitle="House Program updates"
                defaultLinkLabel="Apply Now"
              />
            </div>
          </section>
        )}

        {/* ── House applications (fall / winter / spring) ── */}
        {!isArchive && (
          <section className="program-section">
            <div className="program-section-inner">
              <div className="program-eyebrow">House Applications</div>
              <ApplicationCTA
                applicationKeys={['house_fall', 'house_winter', 'house_spring']}
                fallback={{
                  not_open: 'House applications reopen next quarter.',
                  closed: 'House applications reopen next quarter.',
                }}
              />
            </div>
          </section>
        )}

        {!isArchive && hasPublishedHouseMembers && activeYear !== null && (
          <section className="program-section">
            <div className="program-section-inner">
              <FindMyHouse academicYearStart={activeYear} />
            </div>
          </section>
        )}

        {!isArchive && <HouseAnchorNav />}

        {/* ── About ── */}
        <section id="houses" className="program-section scroll-mt-24">
          <div className="program-section-inner program-section-narrow">
            <div className="program-eyebrow">
              {isArchive ? `About ${activeYearLabel}` : 'About the Program'}
            </div>
            <p className="program-body">
              {isArchive && legacyArchiveEntry?.status === 'unconfirmed'
                ? `No confirmed public House archive has been found for ${activeYearLabel}. This year is kept as an archive gap until VSA can verify the House names from public records or alumni memory.`
                : isArchive
                ? `The House Program in ${activeYearLabel} was a year-long community experience. Members were placed into houses to participate in socials, bonding activities, and VSA events, building friendships and competing for the top spot on the leaderboard.`
                : 'The House Program is a year-long community experience within VSA. Members are placed into one of four houses and participate in socials, bonding activities, and VSA events to earn points and build friendships. At the end of the year, the house with the most points wins.'}
            </p>
            {isLegacyArchive && !archiveEventsLoading && archiveEvents.length === 0 && (
              <p className="mt-4 font-sans text-xs italic" style={{ color: 'var(--color-text3)' }}>
                No event archive has been added for this year yet.
              </p>
            )}
          </div>
        </section>

        {/* ── Four House Cards ── */}
        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-eyebrow">
              {isArchive ? `${activeYearLabel} Houses` : 'The Four Houses'}
            </div>
            {displayedHouses.length === 0 && !isArchive && houseAssetsSettled && (
              <div className="scrapbook-empty mb-5 p-6 text-center">
                {showSummerTransition ? (
                  <>
                    <span className="scrapbook-sticker scrapbook-sticker-gold inline-flex mb-2">
                      {summerHouseMessage.badge}
                    </span>
                    <p className="font-serif text-2xl leading-tight" style={{ color: 'var(--color-text)' }}>
                      {summerHouseMessage.title}
                    </p>
                    <p className="mx-auto mt-2 max-w-lg font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text3)' }}>
                      {summerHouseMessage.body}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-serif text-2xl leading-tight" style={{ color: 'var(--color-text)' }}>
                      {activeYearLabel} Houses have not been announced yet
                    </p>
                    <p className="mx-auto mt-2 max-w-lg font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text3)' }}>
                      Check back after House Reveal for the official theme, assignments, and House Parents. Follow{' '}
                      <a href="https://www.instagram.com/vsaatucsd/" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline" style={{ color: 'var(--brand)' }}>@vsaatucsd</a>{' '}
                      on Instagram for announcements.
                    </p>
                  </>
                )}
                <Link to={`/house/year/${formatAcademicYear(currentYear - 1)}`} className="vsa-btn-ghost mt-5 inline-flex font-sans text-sm">
                  View {formatAcademicYear(currentYear - 1)} Houses →
                </Link>
              </div>
            )}
            {displayedHouses.length === 0 && isArchive && (
              <div className="scrapbook-empty mb-5 p-6 text-center">
                <p className="font-serif text-2xl leading-tight" style={{ color: 'var(--color-text)' }}>
                  No confirmed Houses yet
                </p>
                <p className="mx-auto mt-2 max-w-lg font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text3)' }}>
                  This archive year is intentionally left blank until the House names can be verified.
                </p>
              </div>
            )}
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {displayedHouses.map(({ house, asset }, index) => {
                const color = getHouseColor(house, asset);
                const emoji = asset?.emoji || HOUSE_EMOJI[house as HouseName] || '';
                const label = getHouseLabel(house, asset);
                const imageUrl = asset?.image_thumbnail_url || asset?.image_url;
                const tagline = asset?.description || HOUSE_TAGLINES[house as HouseName] || 'Show up, earn points, and help your house climb the board.';

                // Deterministic rotation
                const rotationClass = index % 2 === 0 ? 'scrapbook-rotate-sm-left' : 'scrapbook-rotate-sm-right';

                const hasPublishedDetail = !isArchive || !!asset;
                const detailHref = hasPublishedDetail
                  ? isArchive
                    ? `/house/year/${activeYearLabel}/${houseSlugFromKey(asset?.house_key || asset?.house || label)}`
                    : getHousePagePath({
                      house_key: asset?.house_key ?? house,
                      house: asset?.house ?? house,
                      display_name: label,
                    })
                  : null;

                const HouseCard = (detailHref ? Link : 'article') as any;

                return (
                  <HouseCard
                    key={house}
                    {...(detailHref ? { to: detailHref } : {})}
                    className={`program-feature-card block overflow-hidden p-0 transition-all ${detailHref ? 'scrapbook-hover-tilt hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2' : ''} ${rotationClass}`}
                    style={{ 
                      borderColor: `${color}55`,
                      '--tw-ring-color': color 
                    } as any}
                    aria-label={detailHref ? `View ${label} house page` : `${label} archive summary`}
                  >
                    <ProfileSpotlightCard className="h-full w-full bg-transparent overflow-visible">
                      <span className="scrapbook-pin" aria-hidden />
                      {/* Image area */}
                      <div
                        className="relative aspect-[4/3] overflow-hidden"
                        style={{ background: `linear-gradient(135deg, ${color}22, var(--color-surface2))` }}
                      >
                        <div className="flex h-full items-center justify-center">
                          <span className="font-serif text-5xl">{emoji || label.slice(0, 2).toUpperCase()}</span>
                        </div>
                        {imageUrl ? (
                          <OptimizedImage
                            src={imageUrl}
                            width={520}
                            height={390}
                            widths={[320, 520, 720]}
                            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
                            alt={asset.image_alt || label}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : null}

                      </div>

                      {/* Card body */}
                      <div className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{emoji}</span>
                          <div className="program-card-title leading-tight">{label}</div>
                        </div>

                        <p className="mt-1.5 font-sans text-[12px] leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                          {tagline}
                        </p>

                        <span
                          className="mt-4 inline-flex font-mono text-[10px] font-bold uppercase tracking-wider transition-opacity group-hover:opacity-80"
                          style={{ color }}
                        >
                          {detailHref ? (isArchive ? 'View Archive →' : 'Explore →') : 'Archive summary'}
                        </span>
                      </div>
                    </ProfileSpotlightCard>
                  </HouseCard>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        {!isArchive && (
          <section className="program-section">
            <div className="program-section-inner">
              <div className="program-eyebrow">How It Works</div>
              <div className="program-step-grid">
                {steps.map((step) => (
                  <div key={step.num} className="program-step-card program-feature-card">
                    <div className="program-step-number mb-3 font-serif leading-none" style={{ fontSize: 34, color: 'var(--color-text3)' }}>
                      {step.num}
                    </div>
                    <div className="program-card-title">{step.title}</div>
                    <p className="program-card-copy">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── FAQ ── */}
        {!isArchive && (
          <section className="program-section">
            <div className="program-section-inner">
              <div className="program-eyebrow">FAQ</div>
              <div className="program-faq-card">
                {faqs.map((faq, i) => (
                  <div key={i} className="program-faq-row">
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="program-faq-button"
                      aria-expanded={openFaq === i}
                      aria-controls={`house-faq-answer-${i}`}
                    >
                      <span className="program-faq-question">{faq.q}</span>
                      <span aria-hidden="true" className={`program-faq-plus ${openFaq === i ? 'is-open' : ''}`}>+</span>
                    </button>
                    <div id={`house-faq-answer-${i}`} className="program-faq-answer" hidden={openFaq !== i}>
                      {faq.a}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section id="standings" className="program-section scroll-mt-24">
          <div className="program-section-inner">
            <div className="scrapbook-paper p-6 sm:p-8">
              <h2 className="font-serif text-2xl font-bold" style={{ color: 'var(--color-text)' }}>House standings are announced at GBMs</h2>
              <p className="mt-3 max-w-2xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                House competition points are still tracked privately. Official standings are announced by House leadership during general body meetings.
              </p>
            </div>
          </div>
        </section>

        {/* ── Archive Events ── */}        {/* ── Archive Events ── */}
        {isArchive && (archiveEvents.length > 0 || isPastYear || archiveEventsLoading) && (
          <section className="program-section">
            <div className="program-section-inner">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="program-eyebrow mb-1">
                    {isLegacyArchive ? 'Archived House Events' : `House Events / ${activeYearLabel}`}
                  </div>
                  <h2 className="font-serif text-[32px] leading-tight" style={{ color: 'var(--color-text)' }}>
                    Events from {activeYearLabel}
                  </h2>
                  <p className="mt-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
                    {isLegacyArchive 
                      ? `Events saved from the ${activeYearLabel} House year.`
                      : `House events that ran during the ${activeYearLabel} school year.`}
                  </p>
                </div>
              </div>
              {archiveEventsLoading ? (
                <div className="py-10 text-center font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                  Loading events…
                </div>
              ) : archiveEvents.length === 0 ? (
                <div className="scrapbook-empty py-8 text-center">
                  <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                    No published House events found for {activeYearLabel}.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {archiveEvents.map((event) => (
                    <HouseEventPreviewCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Upcoming House Events ── */}
        {!isArchive && (
          <section className="program-section">
            <div className="program-section-inner">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                <div className="program-eyebrow mb-0">Upcoming House Events</div>
                <Link to="/events" className="inline-flex touch:min-h-11 items-center font-sans text-xs font-semibold text-brand-600 dark:text-brand-400">
                  See all events →
                </Link>
              </div>
              <p className="mb-5 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
                House socials are about community, not automatic competition points. Only attendance at qualifying VSA events counts toward House points.
              </p>
              {upcomingHouseEvents.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {upcomingHouseEvents.map((event) => (
                    <HouseEventPreviewCard key={event.id} event={event} />
                  ))}
                </div>
              ) : (
                <div className="scrapbook-empty py-8 text-center">
                  <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                    Check back for upcoming House hangouts.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Recent House Events (Current Year) ── */}
        {!isArchive && pastHouseEvents.length > 0 && (
          <section className="program-section">
            <div className="program-section-inner">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                <div className="program-eyebrow mb-0">Recent House Events</div>
              </div>
              <p className="mb-5 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
                Recaps and memories from our latest socials.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {pastHouseEvents.map((event) => (
                  <HouseEventPreviewCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          </section>
        )}

        <HouseLegacyPreview />

        {/* ── House Parents ── */}
        {HOUSE_PARENTS.length > 0 && (
          <section className="program-section">
            <div className="program-section-inner">
              <div className="program-eyebrow">House Parents</div>
              <div className="program-four-grid">
                {HOUSE_PARENTS.map((hp) => (
                  <div key={hp.name} className="program-feature-card">
                    {hp.photo && <img src={hp.photo} alt={hp.name} className="mb-3 aspect-square w-full rounded object-cover" loading="lazy" />}
                    <div className="program-card-title">{hp.emoji ? `${hp.emoji} ` : ''}{hp.name}</div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>{hp.house}</div>
                    {hp.bio && <p className="program-card-copy">{hp.bio}</p>}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="program-section">
          <div className="program-section-inner">
            <RelatedLinks links={houseRelatedLinks(isArchive ? 'archive' : 'current')} />
          </div>
        </section>

        {/* ── Footer ── */}
        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-footer-actions-rich">
              <a href="https://www.instagram.com/vsaatucsd/" target="_blank" rel="noopener noreferrer" className="vsa-btn-primary font-sans text-sm font-medium">
                Follow @vsaatucsd
              </a>
              <Link to="/get-involved" className="vsa-btn-ghost font-sans text-sm">
                ← All Programs
              </Link>
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
