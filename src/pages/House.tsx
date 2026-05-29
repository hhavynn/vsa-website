import { type ReactNode, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import { PageTitle } from '../components/common/PageTitle';
import { ProgramContentCallout } from '../components/features/program/ProgramContentCallout';
import { HOUSE_COLORS, HOUSE_LABELS, HouseName } from '../constants/houses';
import { EVENT_TYPE_LABELS } from '../constants/eventTypes';
import { eventsRepository, PublicEventPreview } from '../data/repos/events';
import { galleryRepository, GalleryAlbum } from '../data/repos/gallery';
import { leaderboardRepository } from '../data/repos/leaderboard';
import { getAcademicTermMeta, formatAcademicYear, parseYearSlug, getYearSlug } from '../lib/academicTerms';
import { formatDateOnly } from '../lib/dateOnly';
import { formatEventTime } from '../lib/eventTime';
import { getSummerBreakMessage, isSummerBreak } from '../utils/seasonalState';
import { useAcademicTerms } from '../hooks/useAcademicTerms';
import { usePublishedHouseAssets } from '../hooks/useHouseAssets';
import { useProgramContent } from '../hooks/useProgramContent';
import { PROGRAM_STATUS_LABELS } from '../lib/programContent';
import { getSupabaseImageSrcSet, getSupabaseImageUrl } from '../lib/supabaseImages';
import { HousePageAsset, HouseRecentActivity, HouseYearlyPoints } from '../types';
import { PointsExplainer } from '../components/features/points/PointsExplainer';
import { HouseMemberLeaderboard } from '../components/features/house/HouseMemberLeaderboard';
import { getHousePagePath, houseSlugFromKey } from '../utils/houseSlug';
import { getPublicHousePoints, isHousePointOverrideActive } from '../utils/housePublicPointOverrides';

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
  { num: '01', title: 'Join the Program', desc: "Sign up when applications or sign-ups open each year. Check VSA's Instagram for the latest announcements." },
  { num: '02', title: 'Get Sorted', desc: 'You are placed into one of four houses. A house reveal kicks off the year and introduces you to your new community.' },
  { num: '03', title: 'Meet Your House', desc: 'Connect with your House Parents and fellow house members through socials, bonding events, and activities throughout the year.' },
  { num: '04', title: 'Earn Points & Compete', desc: "Show up, participate, and earn points for your house. The house with the most points at year's end wins a special reward." },
];

const eventTypes = [
  'House Reveal', 'Meet & Greet', 'Game Nights', 'Study Jams',
  'Beach Outings', 'Karaoke', 'House Dinners', 'DIY Activities',
  'Movie Nights', 'Inter-House Collabs', 'Competitions', 'End-of-Year Celebration',
];

const faqs = [
  { q: 'What is the House Program?', a: "The House Program is a year-long community experience within VSA. Members are placed into one of four houses and participate in socials, bonding activities, and VSA events to earn points and build friendships throughout the year." },
  { q: 'Do I need to already know people in VSA to join?', a: "Not at all. The program is meant to help members meet new people and feel more connected, especially if you are newer to VSA or looking for a smaller group within the org." },
  { q: 'What kinds of events are part of the program?', a: 'Events vary by house and cycle but may include house reveals, meet-and-greets, bonding socials, study jams, beach outings, karaoke, DIY activities, movie nights, inter-house collaborations, and competitions.' },
  { q: 'What do House Parents do?', a: 'House Parents lead their house throughout the year. They plan socials and bonding activities, communicate with members, encourage participation, and help create a welcoming environment for everyone in the house.' },
  { q: 'Is there competition between houses?', a: 'Yes. Houses earn points through participation in events and activities across the year. At the end of the year, the house with the most points receives a special reward.' },
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
    if (parsed) return parsed;
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

const EVENT_TYPE_SHORT: Record<string, string> = {
  gbm: 'GBM',
  mixer: 'Mixer',
  winter_retreat: 'Retreat',
  vcn: 'VCN',
  wildn_culture: 'Wild n\' Culture',
  external_event: 'External',
  other: 'Event',
};

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
      <div className="program-eyebrow mb-3">{title}</div>
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
      footer={<Link to="/leaderboard?view=houses" className="font-sans text-xs font-semibold text-brand-600 dark:text-brand-400">See full standings</Link>}
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

function HouseShoutoutsPulse({
  standings,
  loading,
  hasLiveStandings,
  assetsByHouse,
}: {
  standings: HouseYearlyPoints[];
  loading: boolean;
  hasLiveStandings: boolean;
  assetsByHouse: Map<string, HousePageAsset>;
}) {
  const withPoints = standings.filter((standing) => standing.total_points > 0);
  const leader = withPoints[0] ?? null;
  const second = withPoints[1] ?? null;
  const mostMembers = withPoints.length > 0 ? [...withPoints].sort((a, b) => b.unique_members - a.unique_members)[0] : null;

  const shoutouts = [
    leader && {
      label: 'Currently leading',
      house: leader,
      detail: `${leader.total_points.toLocaleString()} points on the board`,
    },
    second && leader && {
      label: leader.total_points === second.total_points ? 'Tied near the top' : 'Close behind',
      house: second,
      detail: leader.total_points === second.total_points
        ? `${second.total_points.toLocaleString()} points`
        : `${(leader.total_points - second.total_points).toLocaleString()} points back`,
    },
    mostMembers && {
      label: 'Showing up deep',
      house: mostMembers,
      detail: `${mostMembers.unique_members.toLocaleString()} members have contributed`,
    },
  ].filter(Boolean) as Array<{ label: string; house: HouseYearlyPoints; detail: string }>;

  return (
    <HousePulseCard title="House shoutouts">
      {loading ? (
        <PulseLoading />
      ) : !hasLiveStandings || shoutouts.length === 0 ? (
        <PulseEmpty>House shoutouts are coming soon.</PulseEmpty>
      ) : (
        <div className="space-y-3">
          {shoutouts.slice(0, 3).map((shoutout) => {
            const asset = assetsByHouse.get(shoutout.house.house);
            const color = getHouseColor(shoutout.house.house, asset, shoutout.house.accent_color);
            const label = getHouseLabel(shoutout.house.house, asset, shoutout.house.display_name);
            const emoji = HOUSE_EMOJI[shoutout.house.house as HouseName] ?? '';
            return (
              <div key={`${shoutout.label}-${shoutout.house.house}`} className="rounded-lg border p-3" style={{ borderColor: `${color}66`, background: `${color}12` }}>
                <div className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
                  {shoutout.label}
                </div>
                <div className="mt-1 font-serif text-xl leading-tight" style={{ color: 'var(--color-text)' }}>
                  {emoji} {label}
                </div>
                <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
                  {shoutout.detail}
                </p>
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

function HouseMemoriesPulse({
  albums,
  loading,
}: {
  albums: GalleryAlbum[];
  loading: boolean;
}) {
  return (
    <HousePulseCard
      title="Latest House memories"
      footer={<Link to="/gallery" className="font-sans text-xs font-semibold text-brand-600 dark:text-brand-400">See gallery</Link>}
    >
      {loading ? (
        <PulseLoading />
      ) : albums.length === 0 ? (
        <PulseEmpty>Photos and recaps will appear here after events are added.</PulseEmpty>
      ) : (
        <div className="space-y-4">
          {albums.slice(0, 2).map((album) => {
            const coverUrl = album.cover_thumbnail_url || album.cover_image_url;
            return (
              <Link key={album.id} to="/gallery" className="group grid gap-3 sm:grid-cols-[120px_1fr]">
                <div className="scrapbook-photo overflow-hidden">
                  {coverUrl ? (
                    <img
                      src={getSupabaseImageUrl(coverUrl, { width: 320, height: 220, resize: 'cover', quality: 72 })}
                      alt={album.title}
                      className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center" style={{ background: 'var(--color-surface2)' }}>
                      <span className="font-serif text-xl italic" style={{ color: 'var(--color-text3)' }}>VSA</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                    {formatDateOnly(album.date, 'MMM d, yyyy')}
                  </div>
                  <div className="mt-1 truncate font-sans text-[13px] font-semibold" style={{ color: 'var(--color-text)' }}>
                    {album.title}
                  </div>
                  <p className="mt-1 line-clamp-2 font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                    Recent VSA memories from events Houses show up to.
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </HousePulseCard>
  );
}

function HousePulseSection({
  standings,
  standingsLoading,
  hasLiveStandings,
  recentActivity,
  recentActivityLoading,
  memories,
  memoriesLoading,
  assetsByHouse,
}: {
  standings: HouseYearlyPoints[];
  standingsLoading: boolean;
  hasLiveStandings: boolean;
  recentActivity: HouseRecentActivity[];
  recentActivityLoading: boolean;
  memories: GalleryAlbum[];
  memoriesLoading: boolean;
  assetsByHouse: Map<string, HousePageAsset>;
}) {
  return (
    <section className="program-section" aria-labelledby="house-pulse-title">
      <div className="program-section-inner">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="program-eyebrow">House Pulse</div>
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
          <HouseShoutoutsPulse standings={standings} loading={standingsLoading} hasLiveStandings={hasLiveStandings} assetsByHouse={assetsByHouse} />
          <LatestShowingPulse activity={recentActivity} loading={recentActivityLoading} assetsByHouse={assetsByHouse} />
          <HouseMemoriesPulse albums={memories} loading={memoriesLoading} />
        </div>
      </div>
    </section>
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
  const statusLabel = cycleContent ? PROGRAM_STATUS_LABELS[cycleContent.status] : '';
  const today = getTodayDateOnly();

  const activeTermYear = terms.find((term) => term.is_active)?.academic_year_start ?? null;
  const activeYear = resolveHouseYear(terms, yearSlug);
  const activeYearLabel = activeYear ? formatAcademicYear(activeYear) : '';
  const isArchive = activeYear !== null && activeYear !== activeTermYear;

  const { data: availableYears = [] } = useQuery({
    queryKey: ['house-years-with-data'],
    queryFn: () => leaderboardRepository.getYearsWithData(),
    staleTime: 60 * 60 * 1000,
  });

  const { data: upcomingEvents = [] } = useQuery<PublicEventPreview[]>({
    queryKey: ['house', 'upcoming-event-preview', today],
    queryFn: () => eventsRepository.getPublicUpcomingPreview(today, 4),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !isArchive,
  });
  const { data: memoryAlbums = [], isLoading: memoriesLoading } = useQuery<GalleryAlbum[]>({
    queryKey: ['house', 'memory-albums'],
    queryFn: () => galleryRepository.getAlbums({ limit: 3 }),
    staleTime: 10 * 60 * 1000,
    cacheTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { assets: houseAssets } = usePublishedHouseAssets(activeYear);
  const houseAssetsByName = assetMapByHouse(houseAssets);
  const displayedHouses = houseAssets.length > 0
    ? houseAssets.map((asset) => ({ house: asset.house_key ?? asset.house, asset }))
    : isArchive 
      ? [] 
      : HOUSES.map(({ house }) => ({ house, asset: houseAssetsByName.get(house) }));

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!activeYear) {
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
  }, [activeYear]);

  const hasLiveStandings = standings.length > 0 && standings.some((s) => s.total_points > 0);
  const leader = hasLiveStandings ? standings[0] : null;
  const maxPoints = hasLiveStandings ? standings[0].total_points : 1;
  const badges = computeBadges(standings);
  const summerBreak = isSummerBreak();
  const summerHouseMessage = getSummerBreakMessage('house');

  const showSummerTransition = summerBreak && !isArchive && houseAssets.length === 0;

  return (
    <>
      <PageTitle title={isArchive ? `House Archive ${activeYearLabel}` : 'House Program'} />

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
              {!isArchive && cycleContent && statusLabel && cycleContent.status !== 'hidden' && (
                <span className="scrapbook-sticker scrapbook-sticker-teal">
                  {statusLabel}{cycleContent.title ? ` · ${cycleContent.title}` : ''}
                </span>
              )}
              {!cycleContent && APPLICATIONS_OPEN && CYCLE_LABEL && (
                <span className="scrapbook-sticker scrapbook-sticker-teal">Applications Open · {CYCLE_LABEL}</span>
              )}
              {activeYearLabel && <span className="scrapbook-sticker scrapbook-sticker-gold">{activeYearLabel}</span>}
              {leader && (
                <span className="scrapbook-sticker scrapbook-sticker-coral">
                  {HOUSE_EMOJI[leader.house as HouseName] ?? '🏆'} {getHouseLabel(leader.house, houseAssetsByName.get(leader.house), leader.display_name)} leading
                </span>
              )}
              {summerBreak && (
                <span className="scrapbook-sticker scrapbook-sticker-gold">Summer break</span>
              )}
            </div>
          </div>
          <div className="program-watermark">houses</div>
        </section>

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

        {/* ── About ── */}
        <section className="program-section">
          <div className="program-section-inner program-section-narrow">
            <div className="program-eyebrow">About the Program</div>
            <p className="program-body">
              The House Program is a year-long community experience within VSA. Members are placed into one of four houses and participate in socials, bonding activities, and VSA events to earn points and build friendships. At the end of the year, the house with the most points wins.
            </p>
          </div>
        </section>

        {/* ── Four House Cards ── */}
        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-eyebrow">The Four Houses</div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {displayedHouses.map(({ house, asset }, index) => {
                const color = getHouseColor(house, asset);
                const standing = standings.find((s) => s.house === house);
                const rank = standing && hasLiveStandings ? standings.indexOf(standing) + 1 : null;
                const emoji = HOUSE_EMOJI[house as HouseName] ?? '';
                const label = getHouseLabel(house, asset, standing?.display_name);
                const imageUrl = asset?.image_thumbnail_url || asset?.image_url;
                const tagline = asset?.description || HOUSE_TAGLINES[house as HouseName] || 'Show up, earn points, and help your house climb the board.';

                // Deterministic rotation
                const rotationClass = index % 2 === 0 ? 'scrapbook-rotate-sm-left' : 'scrapbook-rotate-sm-right';

                const detailHref = isArchive 
                  ? `/house/archive/${activeYearLabel}/${houseSlugFromKey(asset?.house_key || asset?.house || label)}`
                  : getHousePagePath({
                    house_key: asset?.house_key ?? house,
                    house: asset?.house ?? house,
                    display_name: label,
                  });

                return (
                  <Link
                    key={house}
                    to={detailHref}
                    className={`program-feature-card block overflow-hidden p-0 transition-all scrapbook-hover-tilt hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 ${rotationClass}`}
                    style={{ 
                      borderColor: `${color}55`,
                      '--tw-ring-color': color 
                    } as any}
                    aria-label={`View ${label} house page`}
                  >

                    <span className="scrapbook-pin" aria-hidden />
                    {/* Image area */}
                    <div
                      className="relative aspect-[4/3] overflow-hidden"
                      style={{ background: `linear-gradient(135deg, ${color}22, var(--color-surface2))` }}
                    >
                      {imageUrl ? (
                        <img
                          src={getSupabaseImageUrl(imageUrl, { width: 520, height: 390, resize: 'cover', quality: 72 })}
                          srcSet={getSupabaseImageSrcSet(imageUrl, [320, 520, 720], { resize: 'cover', quality: 72 })}
                          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
                          alt={asset.image_alt || label}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <span className="font-serif text-5xl">{emoji || label.slice(0, 2).toUpperCase()}</span>
                        </div>
                      )}

                      {/* Rank badge overlay */}
                      {rank !== null && (
                        <div
                          className="absolute top-2.5 left-2.5 flex h-9 w-9 items-center justify-center rounded-full font-mono text-sm font-black text-white shadow-md"
                          style={{ background: color }}
                        >
                          #{rank}
                        </div>
                      )}

                      {/* Points overlay */}
                      {standing && standing.total_points > 0 && (
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
                      <span
                        className="mt-4 inline-flex font-mono text-[10px] font-bold uppercase tracking-wider transition-opacity group-hover:opacity-80"
                        style={{ color }}
                      >
                        View House page →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Live Standings ── */}
        <section className="program-section">
          <div className="program-section-inner">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="program-eyebrow mb-0">
                Live Scoreboard{activeYearLabel ? ` / ${activeYearLabel}` : ''}
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
              </div>
            </div>

            <div className="program-scoreboard-card">
              {standingsLoading ? (
                <div className="py-10 text-center font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                  Loading standings...
                </div>
              ) : standings.length === 0 ? (
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
                  {standings.map((standing, index) => {
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

        <HousePulseSection
          standings={standings}
          standingsLoading={standingsLoading}
          hasLiveStandings={hasLiveStandings}
          recentActivity={recentActivity}
          recentActivityLoading={recentActivityLoading}
          memories={memoryAlbums}
          memoriesLoading={memoriesLoading}
          assetsByHouse={houseAssetsByName}
        />

        {/* ── House Member Rankings ── */}
        {activeYear && (
          <section className="program-section">
            <div className="program-section-inner">
              <HouseMemberLeaderboard
                selectedYear={activeYear}
                selectedYearLabel={activeYearLabel}
                showLeaderboardLink
              />
            </div>
          </section>
        )}

        {/* ── Archive Browsing ── */}
        {availableYears.length > 1 && (
          <section className="program-section">
            <div className="program-section-inner">
              <div className="program-eyebrow">Relive the Memories</div>
              <div className="flex flex-wrap gap-3">
                {availableYears.map((year) => {
                  const isCurrent = year === activeYear;
                  return (
                    <Link
                      key={year}
                      to={year === activeTermYear ? '/house' : `/house/archive/${getYearSlug(year)}`}
                      className={`vsa-btn-ghost text-xs ${isCurrent ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      {formatAcademicYear(year)} {year === activeTermYear ? '(Current)' : 'Archive'}
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Points explainer ── */}
        {!isArchive && (
          <section className="program-section">
            <div className="program-section-inner">
              <PointsExplainer />
            </div>
          </section>
        )}

        {/* ── Upcoming Events ── */}
        {upcomingEvents.length > 0 && (
          <section className="program-section">
            <div className="program-section-inner">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                <div className="program-eyebrow mb-0">Earn Points at These Events</div>
                <Link to="/events" className="font-sans text-xs font-semibold text-brand-600 dark:text-brand-400">
                  All Events →
                </Link>
              </div>
              <p className="mb-5 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
                Qualifying events can help your House score when you are an active House member. Check the event details for points.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="scrapbook-note flex items-start gap-4 px-4 py-4"
                  >
                    {/* Date stamp */}
                    <div className="w-12 shrink-0 text-center">
                      <div className="font-mono text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                        {formatDateOnly(event.date, 'MMM')}
                      </div>
                      <div className="font-serif text-[28px] leading-none" style={{ color: 'var(--color-text)' }}>
                        {formatDateOnly(event.date, 'd')}
                      </div>
                    </div>

                    {/* Event info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="scrapbook-sticker scrapbook-sticker-teal px-2 py-0.5 text-[9px]">
                          {EVENT_TYPE_SHORT[event.event_type] ?? EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
                        </span>
                        {event.points > 0 && (
                          <span className="scrapbook-sticker scrapbook-sticker-coral px-2 py-0.5 text-[9px]">
                            +{event.points} pts
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 truncate font-sans text-[13px] font-semibold" style={{ color: 'var(--color-text)' }}>
                        {event.name}
                      </div>
                      {event.location && (
                        <div className="mt-0.5 truncate font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                          📍 {event.location}{event.start_time ? ` / ${formatEventTime(event.start_time)}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-center">
                <Link to="/events" className="vsa-btn-ghost font-sans text-sm">
                  See All Upcoming Events →
                </Link>
              </div>
            </div>
          </section>
        )}

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

        {/* ── How It Works ── */}
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

        {/* ── What You'll Do ── */}
        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-eyebrow">What You'll Do</div>
            <div className="flex flex-wrap gap-2">
              {eventTypes.map((e) => (
                <span key={e} className="scrapbook-sticker">{e}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
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
