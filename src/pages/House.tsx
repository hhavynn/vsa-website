import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import { PageTitle } from '../components/common/PageTitle';
import { ProgramContentCallout } from '../components/features/program/ProgramContentCallout';
import { ApplicationCTA } from '../components/common/ApplicationCTA';
import { HOUSE_COLORS, HOUSE_LABELS, HouseName } from '../constants/houses';
import { houseEventsRepository } from '../data/repos/houseEvents';
import { leaderboardRepository } from '../data/repos/leaderboard';
import { getAcademicTermMeta, formatAcademicYear, parseYearSlug } from '../lib/academicTerms';
import { formatDateOnly } from '../lib/dateOnly';
import { formatEventTimeRange } from '../lib/eventTime';
import { getSummerBreakMessage, isSummerBreak } from '../utils/seasonalState';
import { useAcademicTerms } from '../hooks/useAcademicTerms';
import { usePublishedHouseAssets } from '../hooks/useHouseAssets';
import { useProgramContent } from '../hooks/useProgramContent';
import { getSupabaseImageSrcSet, getSupabaseImageUrl } from '../lib/supabaseImages';
import { HouseEvent, HousePageAsset, HouseRecentActivity, HouseYearlyPoints } from '../types';
import { getHousePagePath, houseSlugFromKey } from '../utils/houseSlug';
import { getPublicHousePoints, isHousePointOverrideActive } from '../utils/housePublicPointOverrides';
import { getLegacyHouseArchiveByYear, getLegacyHouseArchiveYears, getVerifiedLegacyHouseYears } from '../data/legacyHouseArchive';
import { HouseYearSelector } from '../components/features/house/HouseYearSelector';

import { isSupabaseUnavailable } from '../utils/isSupabaseUnavailable';
import { DegradedModeBanner } from '../components/common/DegradedModeBanner';

// ─────────────────────────────────────────────────────────────────────────────
// HOUSE PROGRAM CONFIG — Update this section each year.
// ─────────────────────────────────────────────────────────────────────────────

const APPLICATIONS_OPEN = false;
const APPLICATION_LINK = '';
const CYCLE_LABEL = '';

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

interface HouseData {
  house: HouseName;
}

interface HouseParent {
  name: string;
  house: string;
  emoji: string;
  bio: string;
  photo?: string;
}

const HOUSES: HouseData[] = (['Boo', 'Bowser', 'Toad', 'Donkey Kong'] as HouseName[]).map((house) => ({ house }));

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
  { q: 'How do House points work?', a: 'House points count qualifying event attendance. One member checking in at one qualifying event = 1 House point.' },
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

function assetMapByHouse(assets: HousePageAsset[]) {
  return assets.reduce((map, asset) => {
    map.set(asset.house_key ?? asset.house, asset);
    return map;
  }, new Map<string, HousePageAsset>());
}

function getHouseLabel(house: string, asset?: HousePageAsset | null, displayName?: string | null) {
  return displayName || asset?.display_name || HOUSE_LABELS[house as HouseName] || house;
}

function getHouseColor(house: string, asset?: HousePageAsset | null, accentColor?: string | null) {
  return accentColor || asset?.accent_color || HOUSE_COLORS[house as HouseName] || 'var(--brand)';
}

interface AutoBadges {
  mostEvents: HouseYearlyPoints | null;
  mostMembers: HouseYearlyPoints | null;
  mostEfficient: HouseYearlyPoints | null;
}

function computeBadges(standings: HouseYearlyPoints[]): AutoBadges {
  if (standings.length === 0) return { mostEvents: null, mostMembers: null, mostEfficient: null };
  const withPoints = standings.filter((s) => s.total_points > 0);
  if (withPoints.length === 0) return { mostEvents: null, mostMembers: null, mostEfficient: null };

  const mostEvents = [...withPoints].sort((a, b) => b.events_attended - a.events_attended)[0] ?? null;
  const mostMembers = [...withPoints].sort((a, b) => b.unique_members - a.unique_members)[0] ?? null;
  const withEfficiency = withPoints.filter((s) => (s.average_points_per_member ?? 0) > 0);
  const mostEfficient = withEfficiency.length > 0
    ? [...withEfficiency].sort((a, b) => (b.average_points_per_member ?? 0) - (a.average_points_per_member ?? 0))[0]
    : null;

  return { mostEvents, mostMembers, mostEfficient };
}

const RANK_MEDALS = ['🥇', '🥈', '🥉', '4️⃣'];

function getTodayDateOnly(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function HousePulseCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="scrapbook-paper flex min-h-[280px] flex-col p-5 sm:p-6">
      <h3 className="program-eyebrow mb-3">{title}</h3>
      <div className="min-h-0 flex-1">{children}</div>
      {footer && <div className="mt-5 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>{footer}</div>}
    </div>
  );
}

function PulseLoading() {
  return (
    <div className="space-y-3 py-2" aria-hidden>
      <div className="h-4 w-24 rounded bg-[var(--color-surface2)]" />
      <div className="h-5 w-4/5 rounded bg-[var(--color-surface2)]" />
      <div className="h-4 w-2/3 rounded bg-[var(--color-surface2)]" />
    </div>
  );
}

function PulseEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-[150px] items-center">
      <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text3)' }}>
        {children}
      </p>
    </div>
  );
}

function RecentActivityPulse({
  activity,
  loading,
  assetsByHouse,
}: {
  activity: HouseRecentActivity[];
  loading: boolean;
  assetsByHouse: Map<string, HousePageAsset>;
}) {
  return (
    <HousePulseCard
      title="Recent activity"
      footer={<Link to="/leaderboard?view=houses" className="font-sans text-xs font-semibold text-brand-600 dark:text-brand-400">Full leaderboard →</Link>}
    >
      {loading ? (
        <PulseLoading />
      ) : activity.length === 0 ? (
        <PulseEmpty>House activity will show up here after events are processed.</PulseEmpty>
      ) : (
        <div className="space-y-3">
          {activity.slice(0, 5).map((item) => {
            const asset = assetsByHouse.get(item.house);
            const color = getHouseColor(item.house, asset, item.accent_color);
            const label = getHouseLabel(item.house, asset, item.display_name);
            const emoji = HOUSE_EMOJI[item.house as HouseName] ?? '';
            return (
              <div key={`${item.event_id}-${item.house}`} className="flex gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-[13px] font-semibold leading-snug" style={{ color: 'var(--color-text)' }}>
                    {emoji} {label} earned {item.total_points.toLocaleString()} points at {item.event_name}.
                  </p>
                  <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                    {formatDateOnly(item.event_date, 'MMM d')}
                    {item.contributing_members > 0 ? ` / ${item.contributing_members} members` : ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </HousePulseCard>
  );
}

function LatestShowingPulse({
  activity,
  loading,
  assetsByHouse,
}: {
  activity: HouseRecentActivity[];
  loading: boolean;
  assetsByHouse: Map<string, HousePageAsset>;
}) {
  const latestEventId = activity[0]?.event_id ?? null;
  const latestShowing = latestEventId
    ? activity.filter((item) => item.event_id === latestEventId).sort((a, b) => b.contributing_members - a.contributing_members || b.total_points - a.total_points)
    : [];
  const eventName = latestShowing[0]?.event_name ?? '';
  const eventDate = latestShowing[0]?.event_date ?? '';

  return (
    <HousePulseCard title="Latest showing">
      {loading ? (
        <PulseLoading />
      ) : latestShowing.length === 0 ? (
        <PulseEmpty>Streaks will appear once Houses have a few events logged.</PulseEmpty>
      ) : (
        <div>
          <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
            {eventName}
            {eventDate ? ` / ${formatDateOnly(eventDate, 'MMM d')}` : ''}
          </p>
          <div className="mt-4 space-y-2">
            {latestShowing.slice(0, 4).map((item) => {
              const asset = assetsByHouse.get(item.house);
              const color = getHouseColor(item.house, asset, item.accent_color);
              const label = getHouseLabel(item.house, asset, item.display_name);
              return (
                <div key={`${item.event_id}-${item.house}-showing`} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
                  <span className="truncate font-sans text-[13px] font-semibold" style={{ color: 'var(--color-text)' }}>
                    {label}
                  </span>
                  <span className="shrink-0 font-mono text-[11px]" style={{ color }}>
                    {item.contributing_members} members / {item.total_points} pts
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text3)' }}>
            This uses the latest processed House event activity.
          </p>
        </div>
      )}
    </HousePulseCard>
  );
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

function HousePulseSection({
  recentActivity,
  recentActivityLoading,
  assetsByHouse,
}: {
  recentActivity: HouseRecentActivity[];
  recentActivityLoading: boolean;
  assetsByHouse: Map<string, HousePageAsset>;
}) {
  return (
    <section id="activity" className="program-section scroll-mt-24" aria-labelledby="house-pulse-title">
      <div className="program-section-inner">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="house-pulse-title" className="font-serif text-4xl leading-none tracking-[-0.03em] sm:text-5xl" style={{ color: 'var(--color-text)' }}>
              House Pulse
            </h2>
          </div>
          <p className="max-w-sm font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
            See what each House has been up to lately.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <RecentActivityPulse activity={recentActivity} loading={recentActivityLoading} assetsByHouse={assetsByHouse} />
          <LatestShowingPulse activity={recentActivity} loading={recentActivityLoading} assetsByHouse={assetsByHouse} />
        </div>
      </div>
    </section>
  );
}

function HouseAnchorNav() {
  const items = [
    { href: '#houses', label: 'Houses' },
    { href: '#standings', label: 'Standings' },
    { href: '#activity', label: 'Activity' },
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
              className="shrink-0 rounded-full px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors hover:bg-[var(--color-surface2)]"
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

function getHouseEventHousesLabel(event: HouseEvent) {
  const houses = event.houses && event.houses.length > 0 ? event.houses : [];
  if (houses.length === 0) return 'House event';
  return houses.map((house) => house.display_name || house.house_key || house.house).join(' + ');
}

function HouseEventPreviewCard({ event }: { event: HouseEvent }) {
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
          <img
            src={getSupabaseImageUrl(imageUrl, { width: 128, height: 128, resize: 'cover', quality: 70 })}
            alt={event.title}
            className="-mt-16 h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="scrapbook-sticker scrapbook-sticker-teal px-2 py-0.5 text-[9px]">
            House Event
          </span>
          <span className="rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white" style={{ background: color }}>
            {housesLabel}
          </span>
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
  const [standings, setStandings] = useState<HouseYearlyPoints[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<HouseRecentActivity[]>([]);
  const [recentActivityLoading, setRecentActivityLoading] = useState(true);
  const [isDegradedMode, setIsDegradedMode] = useState(false);
  const today = getTodayDateOnly();

  const activeTermYear = terms.find((term) => term.is_active)?.academic_year_start ?? null;
  const invalidYearSlug = !!yearSlug && parseYearSlug(yearSlug) === null;
  const activeYear = resolveHouseYear(terms, yearSlug);
  const activeYearLabel = activeYear ? formatAcademicYear(activeYear) : '';

  // Determine the "real" current year even when terms haven't loaded yet
  const currentYear = activeTermYear ?? getAcademicTermMeta(new Date())?.academicYearStart ?? 2025;
  const isArchive = activeYear !== null && activeYear < currentYear;
  const isPastYear = activeYear !== null && activeYear === currentYear - 1;
  const isLegacyArchive = activeYear !== null && activeYear < currentYear - 1;
  const isFutureYear = activeYear !== null && activeYear > currentYear;
  const legacyArchiveEntry = activeYearLabel ? getLegacyHouseArchiveByYear(activeYearLabel) : null;

  const { data: upcomingHouseEvents = [] } = useQuery<HouseEvent[]>({
    queryKey: ['house', 'upcoming-house-event-preview', today, activeYear],
    queryFn: () => houseEventsRepository.getPublicUpcomingPreview(today, activeYear, 3),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !invalidYearSlug && !isArchive && !isFutureYear && activeYear !== null,
  });

  const { data: pastHouseEvents = [] } = useQuery<HouseEvent[]>({
    queryKey: ['house', 'past-house-event-preview', today, activeYear],
    queryFn: () => houseEventsRepository.getPublicPastEventsForYear(today, activeYear!, 4),
    staleTime: 10 * 60 * 1000,
    cacheTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !isArchive && !isFutureYear && activeYear !== null,
  });

  const { data: archiveEvents = [], isLoading: archiveEventsLoading } = useQuery<HouseEvent[]>({
    queryKey: ['house', 'archive-events-for-year', activeYear],
    queryFn: () => houseEventsRepository.getPublicEventsForYear(activeYear!, 12),
    staleTime: 10 * 60 * 1000,
    cacheTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: isArchive && activeYear !== null,
  });

  const { assets: houseAssets } = usePublishedHouseAssets(activeYear);
  const houseAssetsByName = assetMapByHouse(houseAssets);
  const displayedHouses = isFutureYear
    ? []
    : houseAssets.length > 0
      ? houseAssets.map((asset) => ({ house: asset.house_key ?? asset.house, asset }))
      : isArchive
        ? (legacyArchiveEntry?.houses ?? []).map((house) => ({ house, asset: undefined }))
        : HOUSES.map(({ house }) => ({ house, asset: houseAssetsByName.get(house) }));

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (invalidYearSlug || !activeYear) {
        setStandingsLoading(false);
        setRecentActivityLoading(false);
        return;
      }
      setStandingsLoading(true);
      setRecentActivityLoading(true);
      
      try {
        const [rawStandings, activityData] = await Promise.all([
          leaderboardRepository.getYearlyHouseLeaderboard(activeYear),
          leaderboardRepository.getRecentHouseActivity(activeYear, 6)
        ]);
        
        // Apply official public point overrides for 2025-2026
        const standingsData = rawStandings.map((s) => ({
          ...s,
          total_points: getPublicHousePoints({
            houseKey: s.house,
            houseName: s.display_name,
            academicYearStart: s.academic_year_start,
            calculatedPoints: s.total_points,
          }),
        })).sort((a, b) => b.total_points - a.total_points);

        if (isMounted) {
          setStandings(standingsData);
          setRecentActivity(activityData);
        }
      } catch (err) {
        console.error('Error loading house data:', err);
        if (isMounted) {
          setStandings([]);
          setRecentActivity([]);
          if (isSupabaseUnavailable(err)) {
            setIsDegradedMode(true);
          }
        }
      } finally {
        if (isMounted) {
          setStandingsLoading(false);
          setRecentActivityLoading(false);
        }
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [activeYear, invalidYearSlug]);

  // When the DB returns no calculated standings for an override year, inject
  // official placeholder rows keyed to the published house assets so that
  // getPublicHousePoints can fill in the correct totals.
  const displayStandings = useMemo<HouseYearlyPoints[]>(() => {
    if (standingsLoading || standings.length > 0) return standings;
    if (!isHousePointOverrideActive(activeYear)) return standings;
    const fallback = houseAssets.flatMap((asset) => {
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
        academic_year_start: activeYear!,
        academic_year_end: (activeYear ?? 0) + 1,
        total_points: pts,
        events_attended: 0,
        unique_events: 0,
        unique_members: 0,
        average_points_per_member: null,
        latest_activity_at: null,
      } as HouseYearlyPoints];
    }).sort((a, b) => b.total_points - a.total_points);
    return fallback.length > 0 ? fallback : standings;
  }, [standings, standingsLoading, houseAssets, activeYear]);

  const hasLiveStandings = displayStandings.length > 0 && displayStandings.some((s) => s.total_points > 0);
  const leader = hasLiveStandings ? displayStandings[0] : null;
  const maxPoints = hasLiveStandings ? displayStandings[0].total_points : 1;
  const badges = computeBadges(displayStandings);
  const summerBreak = isSummerBreak();
  const summerHouseMessage = getSummerBreakMessage('house');

  const showSummerTransition = summerBreak && !isArchive && !isFutureYear && houseAssets.length === 0;

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
        <div className="program-app">
          <section className="program-hero">
            <div className="program-hero-grain" />
            <div className="program-hero-inner">
              <span className="program-hero-kicker">Not announced yet</span>
              <h1 className="program-title">
                House <span className="program-title-script">{activeYearLabel}</span>
              </h1>
              <p className="program-hero-meta">
                {activeYearLabel} Houses have not been announced yet. Check back after House Reveal for the official theme, assignments, standings, and House Parent updates.
              </p>
              <div className="program-hero-actions">
                <span className="scrapbook-sticker scrapbook-sticker-gold">Check back after House Reveal</span>
              </div>
            </div>
            <div className="program-watermark">houses</div>
          </section>

          {/* Year selector */}
          <div className="program-section py-4">
            <div className="program-section-inner">
              <HouseYearSelector activeStartYear={activeYear} />
            </div>
          </div>

          {/* Placeholder card */}
          <section className="program-section">
            <div className="program-section-inner">
              <div className="scrapbook-paper mx-auto max-w-xl p-8 text-center">
                <span className="scrapbook-sticker mb-6 inline-block">🏠</span>
                <h2 className="mt-4 font-serif text-[28px] leading-tight" style={{ color: 'var(--color-text)' }}>
                  {activeYearLabel} Houses have not been announced yet
                </h2>
                <p className="mt-4 font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                  Current House information will be updated once assignments are finalized. Follow <a href="https://www.instagram.com/vsaatucsd/" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline" style={{ color: 'var(--brand)' }}>@vsaatucsd</a> on Instagram for official House Reveal announcements.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Link to="/house" className="vsa-btn-primary font-sans text-sm">
                    View 2025-2026 Houses →
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
      {isDegradedMode && <DegradedModeBanner sourceName="house" />}

      <div className="program-app">

        {/* ── Hero ── */}
        <section className="program-hero">
          <div className="program-hero-grain" />
          <div className="program-hero-inner">
            <span className="program-hero-kicker">
              {isArchive ? `Archived / ${activeYearLabel}` : 'House Board'}
            </span>
            <h1 className="program-title">
              House <span className="program-title-script">{isArchive ? 'Archive' : 'Program'}</span>
            </h1>
            <p className="program-hero-meta">
              {isArchive 
                ? `Exploring the memories, standings, and houses from the ${activeYearLabel} school year.`
                : 'Year-long community competition inside VSA at UCSD. Get sorted, meet your house, show up for qualifying events, and help your team climb the board.'}
            </p>
            <div className="program-hero-actions">
              {isArchive && (
                <Link to="/house" className="scrapbook-sticker scrapbook-sticker-gold">
                  ← Back to Current Year
                </Link>
              )}
              {activeYearLabel && <span className="scrapbook-sticker scrapbook-sticker-gold">{activeYearLabel}</span>}
              {summerBreak && !isArchive ? (
                <span className="scrapbook-sticker scrapbook-sticker-gold">Summer break</span>
              ) : leader && (
                <span className="scrapbook-sticker scrapbook-sticker-coral">
                  {HOUSE_EMOJI[leader.house as HouseName] ?? '🏆'} {getHouseLabel(leader.house, houseAssetsByName.get(leader.house), leader.display_name)} leading
                </span>
              )}
            </div>
          </div>
          <div className="program-watermark">houses</div>
        </section>

        {/* ── Year Selector ── */}
        <div className="program-section py-4">
          <div className="program-section-inner">
            <HouseYearSelector activeStartYear={activeYear} />
          </div>
        </div>

        {/* ── Program callout ── */}
        {(cycleContent || (APPLICATIONS_OPEN && APPLICATION_LINK)) && (
          <section className="program-section">
            <div className="program-section-inner">
              {cycleContent ? (
                <ProgramContentCallout
                  content={cycleContent}
                  defaultTitle="House Program updates"
                  defaultLinkLabel="Apply Now"
                />
              ) : (
                <div className="scrapbook-note flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="min-w-0 font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    Applications are now open{CYCLE_LABEL ? ` · ${CYCLE_LABEL}` : ''}
                  </div>
                  <a href={APPLICATION_LINK} target="_blank" rel="noopener noreferrer" className="program-cta-link rounded border border-brand-600 px-4 py-2 font-sans text-sm font-medium text-brand-600 transition-colors duration-150 hover:bg-brand-600 hover:text-white dark:border-brand-400 dark:text-brand-400 dark:hover:bg-brand-400 dark:hover:text-zinc-950">
                    Apply Now →
                  </a>
                </div>
              )}
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
                const standing = standings.find((s) => s.house === house);
                const rank = standing && hasLiveStandings ? standings.indexOf(standing) + 1 : null;
                const emoji = asset?.emoji || HOUSE_EMOJI[house as HouseName] || '';
                const label = getHouseLabel(house, asset, standing?.display_name);
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
                        <img
                          src={getSupabaseImageUrl(imageUrl, { width: 520, height: 390, resize: 'cover', quality: 72 })}
                          srcSet={getSupabaseImageSrcSet(imageUrl, [320, 520, 720], { resize: 'cover', quality: 72 })}
                          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
                          alt={asset.image_alt || label}
                          className="absolute inset-0 h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}

                      {/* Rank badge overlay */}
                      {rank !== null && !isArchive && (
                        <div
                          className="absolute top-2.5 left-2.5 flex h-9 w-9 items-center justify-center rounded-full font-mono text-sm font-black text-white shadow-md"
                          style={{ background: color }}
                        >
                          #{rank}
                        </div>
                      )}

                      {/* Points overlay */}
                      {standing && standing.total_points > 0 && !isArchive && (
                        <div className="absolute bottom-2.5 right-2.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-right backdrop-blur-sm">
                          <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-white/60">house pts</div>
                          <div className="font-mono text-lg font-black leading-none text-white">
                            {standing.total_points.toLocaleString()}
                          </div>
                        </div>
                      )}
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

                      {/* Live mini stats */}
                      {!isArchive && (
                        <>
                          {standing && standing.total_points > 0 ? (
                            <div className="mt-3 flex gap-4 border-t pt-3" style={{ borderColor: `${color}33` }}>
                              <div className="text-center">
                                <div className="font-mono text-[14px] font-black" style={{ color }}>{standing.unique_members}</div>
                                <div className="font-mono text-[9px] uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>members</div>
                              </div>
                              {standing.average_points_per_member !== null && (
                                <div className="text-center">
                                  <div className="font-mono text-[14px] font-black" style={{ color }}>
                                    {standing.average_points_per_member.toFixed(1)}
                                  </div>
                                  <div className="font-mono text-[9px] uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>avg/member</div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="mt-3 border-t pt-3" style={{ borderColor: `${color}33` }}>
                              <p className="font-mono text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                                Season not yet started
                              </p>
                            </div>
                          )}

                          {/* House color bar */}
                          <div className="mt-3 h-1.5 rounded-full" style={{ background: `${color}55` }}>
                            {hasLiveStandings && standing && (
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${Math.round((standing.total_points / maxPoints) * 100)}%`,
                                  background: color,
                                }}
                              />
                            )}
                          </div>
                        </>
                      )}
                      <span
                        className="mt-4 inline-flex font-mono text-[10px] font-bold uppercase tracking-wider transition-opacity group-hover:opacity-80"
                        style={{ color }}
                      >
                        {detailHref ? (isArchive ? 'View Archive →' : 'Explore →') : 'Archive summary'}
                      </span>
                    </div>
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
                    >
                      <span className="program-faq-question">{faq.q}</span>
                      <span className={`program-faq-plus ${openFaq === i ? 'is-open' : ''}`}>+</span>
                    </button>
                    {openFaq === i && (
                      <div className="program-faq-answer">{faq.a}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Live Standings ── */}
        {!isArchive && (
          <section id="standings" className="program-section scroll-mt-24">
            <div className="program-section-inner">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="program-eyebrow mb-1">
                    Live Scoreboard{activeYearLabel ? ` / ${activeYearLabel}` : ''}
                  </div>
                  <p className="max-w-xl font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text3)' }}>
                    House points count qualifying event attendance. One member checking in at one qualifying event = 1 House point.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="hidden font-sans text-[10px] font-medium opacity-60 sm:inline" style={{ color: 'var(--color-text)' }}>
                    {isHousePointOverrideActive(activeYear) 
                      ? "Totals reflect official public count for the year" 
                      : "House points = qualifying event attendance count"}
                  </span>
                  <Link
                    to={isArchive ? `/leaderboard?year=${activeYear}` : "/leaderboard"}
                    className="font-sans text-xs font-semibold text-brand-600 dark:text-brand-400"
                  >
                    Full Leaderboard →
                  </Link>
                  <Link
                    to="/leaderboard?view=houses"
                    className="font-sans text-xs font-semibold text-brand-600 dark:text-brand-400"
                  >
                    Full member rankings →
                  </Link>
                </div>
              </div>

              <div className="program-scoreboard-card">
                {standingsLoading ? (
                  <div className="py-10 text-center font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                    Loading standings...
                  </div>
                ) : displayStandings.length === 0 ? (
                  <div className="scrapbook-empty mx-4 my-4 font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                    {showSummerTransition ? (
                      <div className="mx-auto max-w-xl space-y-2 text-center">
                        <p className="font-serif text-2xl leading-tight" style={{ color: 'var(--color-text)' }}>
                          {summerHouseMessage.title}
                        </p>
                        <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text3)' }}>
                          New standings will appear once fall events start.
                        </p>
                      </div>
                    ) : houseAssets.length > 0 ? (
                      <>
                        <p style={{ color: 'var(--color-text2)' }}>
                          House profiles exist, but no members have been assigned yet.
                        </p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>
                          House standings are still being updated for this year. Check back soon.
                        </p>
                      </>
                    ) : (
                      <>
                        <p style={{ color: 'var(--color-text2)' }}>
                          House standings are still being updated for this year. Check back soon.
                        </p>
                        {activeYearLabel && (
                          <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>
                            No house points recorded for {activeYearLabel}.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    {summerBreak && !isArchive && (
                      <div className="border-b px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
                        <p className="font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text3)' }}>
                          Summer note: House activity is paused until the next school year.
                        </p>
                      </div>
                    )}
                    {displayStandings.map((standing, index) => {
                      const asset = houseAssetsByName.get(standing.house);
                      const houseKey = standing.house as HouseName;
                      const color = getHouseColor(standing.house, asset, standing.accent_color);
                      const label = getHouseLabel(standing.house, asset, standing.display_name);
                      const emoji = HOUSE_EMOJI[houseKey] ?? '';
                      const pct = maxPoints > 0 ? Math.round((standing.total_points / maxPoints) * 100) : 0;
                      const houseBadges: string[] = [];
                      if (badges.mostEvents?.house === standing.house && standing.total_points > 0) houseBadges.push('Most Events');
                      if (badges.mostMembers?.house === standing.house && standing.total_points > 0) houseBadges.push('Most Members');
                      if (badges.mostEfficient?.house === standing.house && standing.total_points > 0) houseBadges.push('Most Efficient');

                      return (
                        <div
                          key={standing.house_profile_id ?? standing.house}
                          className="group border-b last:border-0"
                          style={{ borderColor: 'var(--color-border)' }}
                        >
                          <div className="flex items-center gap-3 px-4 py-4 sm:gap-4">
                            {/* Rank medal */}
                            <div className="flex w-10 shrink-0 items-center justify-center">
                              <span className="text-xl" title={`#${index + 1}`}>{RANK_MEDALS[index] ?? `#${index + 1}`}</span>
                            </div>

                            {/* House info + progress */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-sans text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                                  {emoji} {label}
                                </span>
                                {houseBadges.map((badge) => (
                                  <span
                                    key={badge}
                                    className="rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white"
                                    style={{ background: color }}
                                  >
                                    {badge}
                                  </span>
                                ))}
                              </div>
                              <div className="mt-1 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                                {standing.unique_members} members · {standing.events_attended} check-ins
                              </div>
                              {/* Progress bar */}
                              <div className="mt-2 h-1.5 w-full rounded-full" style={{ background: 'var(--color-border)' }}>
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${pct}%`, background: color }}
                                />
                              </div>
                            </div>

                            {/* Points */}
                            <div className="shrink-0 text-right">
                              <div className="font-serif leading-none" style={{ fontSize: 26, color: 'var(--color-text)' }}>
                                {standing.total_points.toLocaleString()}
                              </div>
                              <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider" style={{ color: 'var(--color-text3)' }}>
                                pts
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {!isArchive && (
          <HousePulseSection
            recentActivity={recentActivity}
            recentActivityLoading={recentActivityLoading}
            assetsByHouse={houseAssetsByName}
          />
        )}

        {/* ── Archive Events ── */}
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
                <Link to="/events" className="font-sans text-xs font-semibold text-brand-600 dark:text-brand-400">
                  See all events →
                </Link>
              </div>
              <p className="mb-5 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
                Check in at qualifying events to earn points for your House.
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
