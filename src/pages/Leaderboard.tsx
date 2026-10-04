import { useState, useEffect, useCallback, useMemo, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { PageTitle } from '../components/common/PageTitle';
import { Input } from '../components/ui/Input';
import { AnimatedCounter } from '../components/ui/AnimatedCounter';
import { BottomSheet } from '../components/ui/BottomSheet';
import { Avatar } from '../components/features/avatar/Avatar';
import { PhotoRequestSection } from '../components/features/avatar/PhotoRequestSection';
import { LeaderboardSkeleton } from '../components/common/PageSkeletons';
import { usePagination } from '../hooks/usePagination';
import { PaginationControls } from '../components/common/PaginationControls';
import { useAcademicTerms } from '../hooks/useAcademicTerms';
import { useLeaderboardYears } from '../hooks/useLeaderboardYears';
import { useIndividualLeaderboard, type IndividualLeaderboardMember as Member } from '../hooks/useIndividualLeaderboard';
import { leaderboardRepository } from '../data/repos/leaderboard';
import { useMemberAvatars } from '../hooks/useMemberAvatars';
import type { MemberAvatarMap } from '../lib/memberPhotos';
import { getAvatarInitials, getInitialsAvatarColors } from '../lib/initialsAvatar';
import { getPublicHousePoints, isHousePointOverrideActive } from '../utils/housePublicPointOverrides';
import { HOUSE_COLORS, HOUSE_LABELS, HouseName } from '../constants/houses';
import { EVENT_TYPE_LABELS } from '../constants/eventTypes';
import { formatDateOnly } from '../lib/dateOnly';
import { HouseRecentActivity, MemberEventHistoryEntry, MemberHouseBadge } from '../types';
import { getSummerBreakMessage, isSummerBreak } from '../utils/seasonalState';
import {
  assignTiedRanks,
  compareMemberNames,
  comparePointsThenEvents,
  formatRank,
  getLeaderboardGap,
  isWithinTop,
  LeaderboardGap,
  RankPlacement,
} from '../utils/leaderboardRanking';
import { buildAcademicYearOptions, resolveDefaultLeaderboardYear, type AcademicYearOption } from '../utils/leaderboardYears';

import { PointsExplainer } from '../components/features/points/PointsExplainer';
import { RelatedLinks } from '../components/common/RelatedLinks';
import { leaderboardRelatedLinks, POINTS_HELP_ANCHOR } from '../lib/relatedLinks';
import { HouseMemberLeaderboard } from '../components/features/house/HouseMemberLeaderboard';

import { isSupabaseUnavailable } from '../utils/isSupabaseUnavailable';
import { DegradedModeBanner } from '../components/common/DegradedModeBanner';
import { ContentUnavailableState } from '../components/common/ContentUnavailableState';
import { FALLBACK_HOUSE_STANDINGS_2025_2026 } from '../config/publicFallbackContent';
import { Skeleton } from '../components/ui/Skeleton';
import { readableInk } from '../lib/readableInk';

// ─────────────────────────────────────────────────────────────────────────────
// ICONS (SVG implementations to avoid react-icons type issues)
// ─────────────────────────────────────────────────────────────────────────────

const TrophyIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 576 512" fill="currentColor"><path d="M400 64c0-35.3-28.7-64-64-64H240c-35.3 0-64 28.7-64 64H64C28.7 64 0 92.7 0 128V192c0 88.4 86 160 192 160c5.3 0 10.5-.3 15.6-.8c21.3 27.6 48.3 49.3 79.5 61.2L288 512H192c-17.7 0-32 14.3-32 32s14.3 32 32 32H384c17.7 0 32-14.3 32-32s-14.3-32-32-32H288l1.1-98.7c31.2-11.9 58.2-33.5 79.5-61.2c5.1 .5 10.3 .8 15.6 .8c106 0 192-71.6 192-160V128c0-35.3-28.7-64-64-64H400zM64 128H176V301.9C104.5 282.4 48 238.1 48 192V128H64zm336 173.9V128H512v64c0 46.1-56.5 90.4-128 109.9z"/></svg>
);

const MedalIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 512 512" fill="currentColor"><path d="M223.7 239l136-136c9.4-9.4 24.6-9.4 33.9 0l22.6 22.6c9.4 9.4 9.4 24.6 0 33.9L280.3 295.4c-9.4 9.4-24.6 9.4-33.9 0l-22.6-22.6c-9.4-9.5-9.4-24.7 0-33.8zm256-111.4L440.3 88.2c-18.7-18.7-49.1-18.7-67.9 0L236.1 224.5c-18.7 18.7-18.7 49.1 0 67.9l39.4 39.4c18.7 18.7 49.1 18.7 67.9 0l136.3-136.3c18.7-18.8 18.7-49.1 0-67.9zm-261.2 59.8L121.7 84c-4.7-4.7-12.3-4.7-17 0L82 106.7c-4.7 4.7-4.7 12.3 0 17L185.3 227c4.7 4.7 12.3 4.7 17 0l22.6-22.6c4.7-4.7 4.7-12.3 0-17zM432.5 400.3c-14.7-14.7-38.5-14.7-53.1 0l-22.6 22.6c-14.7 14.7-14.7 38.5 0 53.1l22.6 22.6c14.7 14.7 38.5 14.7 53.1 0l22.6-22.6c14.7-14.7 14.7-38.5 0-53.1l-22.6-22.6z"/></svg>
);

const AwardIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 384 512" fill="currentColor"><path d="M173.5 1.6C121.5 10 80 54.4 80 107.4V270.5c0 14.1 6.5 27.5 17.5 36.2l128 102.4c16.3 13 40.7 1.5 40.7-19.4V107.4c0-53-41.5-97.4-93.5-105.8l-1.3-.2C172.5 1.2 173 1.4 173.5 1.6zM320 270.5c0 14.1 6.5 27.5 17.5 36.2l128 102.4c16.3 13 40.7 1.5 40.7-19.4V107.4c0-53-41.5-97.4-93.5-105.8l-1.3-.2c-.9-.1-.4 .1 .1 .3C361.5 10 320 54.4 320 107.4V270.5z"/></svg>
);

const CrownIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 576 512" fill="currentColor"><path d="M576 136c0 22.1-17.9 40-40 40c-.2 0-.4 0-.6 0l-71 208.6c-4.6 13.5-16.9 22.8-31.2 23.4l-146.4 6c-1.4 0-2.9 0-4.3 0c-1.4 0-2.9 0-4.3 0l-146.4-6c-14.3-.6-26.5-9.9-31.2-23.4L28.6 176c-.3 0-.5 0-.6 0C17.9 176 0 158.1 0 136c0-22.1 17.9-40 40-40c16.3 0 30.5 9.8 36.9 23.8l105.1 36.1c11.9 4.1 25.1-1.3 30.3-12.7L269.1 32.5c8.7-19.2 31-23.9 45.8-9.1c2.1 2.1 3.9 4.6 5.2 7.2l56.8 111.4c5.2 11.4 18.4 16.9 30.3 12.7l105.1-36.1c6.4-2.2 13.1-3.3 19.9-3.3c22.1 0 40 17.9 40 40z"/></svg>
);

const StarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 576 512" fill="currentColor"><path d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.5 7-28.8 18L195 150.3 47.7 171.5c-12.1 1.7-22.1 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.8 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 546.2 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.6-19.9-25.7-21.7L381.2 150.3 316.9 18z"/></svg>
);

const SearchIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 512 512" fill="currentColor"><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/></svg>
);

const BoltIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>
);

const TrendUpIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 576 512" fill="currentColor"><path d="M384 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H544c17.7 0 32-14.3 32-32V64c0-17.7-14.3-32-32-32s-32 14.3-32 32v64.7L443.9 66.8c-12.5-12.5-32.8-12.5-45.3 0L288 177.4l-93.5-93.5c-12.5-12.5-32.8-12.5-45.3 0L7.4 225.4c-9.9 9.9-9.9 26 0 35.9s26 9.9 35.9 0l128-128L264.7 227c12.5 12.5 32.8 12.5 45.3 0L420.7 116.3 544 239.7V160H384z"/></svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL REUSABLE COMPONENTS (Scrapbook Elements)
// ─────────────────────────────────────────────────────────────────────────────

function StickerBadge({ children, rotation = 0, color = 'primary', size = 'md' }: { children: React.ReactNode; rotation?: number; color?: 'primary' | 'accent' | 'gold'; size?: 'sm' | 'md' }) {
  const colorClass = color === 'primary' ? 'scrapbook-sticker-teal' : color === 'accent' ? 'scrapbook-sticker-coral' : 'scrapbook-sticker-gold';
  return (
    <span 
      className={`scrapbook-sticker ${colorClass} ${size === 'sm' ? 'px-2 py-1 text-[9px]' : ''}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {children}
    </span>
  );
}

function PushPin({ color = 'accent', className = '' }: { color?: 'primary' | 'accent' | 'gold' | 'secondary'; className?: string }) {
  const bgColor = color === 'primary' ? 'var(--brand)' : color === 'accent' ? 'var(--accent)' : color === 'gold' ? 'var(--gold-t)' : 'var(--text3)';
  return (
    <div 
      className={`absolute z-10 h-3.5 w-3.5 rounded-full border-2 border-white/40 shadow-sm ${className}`}
      style={{ background: bgColor, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
    />
  );
}

function TapeAccent({ position = 'top-left', color = 'primary' }: { position?: 'top-left' | 'top-right'; color?: 'primary' | 'accent' | 'gold' }) {
  const bg = color === 'primary' ? 'var(--tape-teal)' : color === 'accent' ? 'var(--tape-coral)' : 'var(--tape-gold)';
  const rotation = position === 'top-left' ? '-15deg' : '15deg';
  return (
    <div
      className={`absolute z-10 h-5 w-16 opacity-60 ${position === 'top-left' ? 'left-[-12px] top-0' : 'right-[-12px] top-0'}`}
      style={{ background: bg, transform: `rotate(${rotation})`, borderRadius: '2px' }}
    />
  );
}

// Small "distance to the rank above" caption, purely derived from the
// already-fetched, already-ranked entries array — reads entry.rank and the
// neighboring entry's already-computed points/events_attended, no new
// queries or sorting. Tied members get the size of their tie instead. An
// untied member sits at index rank - 1, so the entry above is the last
// member of the group ahead of it.
function RankGapNote({
  entries,
  entry,
  metric,
}: {
  entries: LeaderboardEntry[];
  entry: LeaderboardEntry;
  metric: 'points' | 'events';
}) {
  if (entry.tiedCount > 1) {
    return (
      <div className="mt-0.5 font-mono text-[10px] font-semibold sm:whitespace-nowrap" style={{ color: 'var(--brand)' }}>
        {entry.tiedCount.toLocaleString()}-way tie
      </div>
    );
  }

  if (entry.rank <= 1) return null;
  const above = entries[entry.rank - 2];
  if (!above) return null;

  const gap = getLeaderboardGap(above, entry, metric);
  if (gap.metric === 'tie') return null;

  return (
    <div className="mt-0.5 font-mono text-[10px] font-semibold sm:whitespace-nowrap" style={{ color: 'var(--text3)' }}>
      {getGapCaption(gap, `to ${formatRank(above)}`)}
    </div>
  );
}

function getGapCaption(
  gap: Exclude<LeaderboardGap, { metric: 'tie' }>,
  label: string,
  eventTiebreakDirection: 'more' | 'fewer' = 'fewer'
) {
  if (gap.metric === 'events') {
    return `${gap.value.toLocaleString()} ${eventTiebreakDirection} event${gap.value === 1 ? '' : 's'} — tiebreaker`;
  }

  return `+${gap.value.toLocaleString()} ${label}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & UTILS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The member's name is the real <button>; its ::after stretches the hit area
 * over the whole (relatively positioned) card. The accessible name
 * "Open profile for <name>" therefore contains the button's visible text
 * (WCAG 2.5.3 Label in Name) and nothing is nested inside a role="button" div.
 */
function ProfileOpener({
  name,
  onOpen,
  className,
  children,
}: {
  name: string;
  onOpen: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={`Open profile for ${name}`}
      onClick={onOpen}
      className={`block min-w-0 cursor-pointer text-inherit after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[var(--brand)] ${className ?? ''}`}
    >
      {children}
    </button>
  );
}

type LeaderboardEntry = Member & RankPlacement;

function compareMembersForDisplay(a: Member, b: Member) {
  return compareMemberNames(a, b) || a.id.localeCompare(b.id);
}

interface HouseStanding {
  house: string;
  house_profile_id?: string;
  display_name?: string;
  image_url?: string | null;
  accent_color?: string | null;
  emoji?: string | null;
  academic_year_start?: number;
  academic_year_end?: number;
  rank: number;
  total_points: number;
  events_attended: number;
  unique_events?: number;
  unique_members: number;
  average_points_per_member: number | null;
  latest_activity_at: string | null;
}

type SelectedYear = number | 'all';

function InitialsAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = getAvatarInitials(name);
  const colors = getInitialsAvatarColors(name);

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-sans font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: colors.background,
        color: colors.foreground,
      }}
    >
      {initials}
    </div>
  );
}

function getMemberDisplayName(member: Pick<Member, 'first_name' | 'last_name'>) {
  return `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() || 'VSA Member';
}

// Secondary profile detail (event-type breakdown, attendance history) is
// collapsed behind a thumb-sized header on phones so the sheet opens on the
// member's name, rank and totals; from `sm` up it starts expanded as before.
function startsExpanded() {
  return typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? true
    : !window.matchMedia('(max-width: 639px)').matches;
}

function ProfileSection({
  title,
  summary,
  children,
}: {
  title: string;
  summary?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(startsExpanded);

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
      >
        <h3 className="font-serif text-base font-bold text-[var(--text)]">{title}</h3>
        <span className="flex shrink-0 items-center gap-2 font-mono text-[11px] font-bold text-[var(--text3)]">
          {summary}
          <svg
            className={`h-4 w-4 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {open && <div className="pb-1 pt-1">{children}</div>}
    </div>
  );
}

function PublicMemberProfileModal({
  member,
  avatarUrl,
  activeTab,
  selectedYear,
  onClose,
}: {
  member: LeaderboardEntry;
  avatarUrl: string | null;
  activeTab: 'points' | 'events';
  selectedYear: SelectedYear | null;
  onClose: () => void;
}) {
  const displayName = getMemberDisplayName(member);
  const meta = [member.year, member.college].filter(Boolean).join(' • ') || 'VSA Member';
  const primaryMetric = activeTab === 'points' ? member.points.toLocaleString() : member.events_attended.toLocaleString();
  const secondaryMetric = activeTab === 'points' ? member.events_attended.toLocaleString() : member.points.toLocaleString();
  const primaryLabel = activeTab === 'points' ? 'Points' : 'Events';
  const secondaryLabel = activeTab === 'points' ? 'Events attended' : 'Points';
  const avgPointsPerEvent = member.events_attended > 0 ? member.points / member.events_attended : 0;

  const [eventHistory, setEventHistory] = useState<MemberEventHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [houseBadge, setHouseBadge] = useState<MemberHouseBadge | null>(null);

  // Individual event history + House badge are separate, additive fetches
  // against public-safe views -- neither reads nor writes points/ranking data.
  useEffect(() => {
    let isCurrent = true;
    setLoadingHistory(true);
    setHistoryError(false);

    const yearFilter = selectedYear === 'all' || selectedYear === null ? undefined : selectedYear;
    leaderboardRepository
      .getMemberEventHistory(member.id, yearFilter)
      .then((history) => { if (isCurrent) setEventHistory(history); })
      .catch(() => { if (isCurrent) setHistoryError(true); })
      .finally(() => { if (isCurrent) setLoadingHistory(false); });

    leaderboardRepository
      .getMemberHouseBadge(member.id, selectedYear ?? 'all')
      .then((badge) => { if (isCurrent) setHouseBadge(badge); })
      .catch(() => { if (isCurrent) setHouseBadge(null); });

    return () => { isCurrent = false; };
  }, [member.id, selectedYear]);

  const typeBreakdown = useMemo(() => {
    const counts = new Map<MemberEventHistoryEntry['event_type'], number>();
    eventHistory.forEach((entry) => {
      counts.set(entry.event_type, (counts.get(entry.event_type) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [eventHistory]);

  return (
    <BottomSheet
      onClose={onClose}
      ariaLabel={`${displayName} member profile`}
      className="border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-20 w-20 rounded-full border-4 border-white object-cover shadow-md dark:border-zinc-800"
                />
              ) : (
                <InitialsAvatar name={displayName} size={80} />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="break-words font-serif text-2xl font-bold leading-tight text-[var(--text)]">{displayName}</h2>
              <p className="mt-1 break-words font-sans text-xs text-[var(--text2)]">{meta}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {isWithinTop(member, 3) && <StickerBadge color="gold" size="sm">TOP {member.rank}</StickerBadge>}
                <StickerBadge color="primary" size="sm">{primaryLabel.toUpperCase()}</StickerBadge>
                {houseBadge && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wide"
                    style={{
                      borderColor: houseBadge.accent_color ?? 'var(--border)',
                      color: houseBadge.accent_color ?? 'var(--text2)',
                    }}
                  >
                    {houseBadge.display_name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] shrink-0 rounded-full border border-[var(--border)] px-4 font-sans text-xs text-[var(--text2)] transition-colors hover:bg-[var(--surface2)]"
            aria-label="Close member profile"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface2)] p-3">
            <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--text3)]">{primaryLabel}</p>
            <p className="mt-1 font-mono text-2xl font-black text-[var(--text)]">{primaryMetric}</p>
          </div>
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface2)] p-3">
            <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--text3)]">{secondaryLabel}</p>
            <p className="mt-1 font-mono text-2xl font-black text-[var(--text)]">{secondaryMetric}</p>
          </div>
        </div>

        {member.events_attended > 0 && (
          <p className="mt-2 font-mono text-[11px] font-semibold text-[var(--text3)]">
            avg {avgPointsPerEvent.toFixed(1)} pts/event
          </p>
        )}

        {typeBreakdown.length > 0 && (
          <ProfileSection title="By event type" summary={`${typeBreakdown.length}`}>
            <div className="flex flex-wrap gap-1.5">
              {typeBreakdown.map(([type, count]) => (
                <span
                  key={type}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--text2)]"
                >
                  {EVENT_TYPE_LABELS[type] ?? type} × {count}
                </span>
              ))}
            </div>
          </ProfileSection>
        )}

        <ProfileSection
          title="Events attended"
          summary={loadingHistory || historyError ? undefined : `${eventHistory.length}`}
        >
          {loadingHistory ? (
            <div className="space-y-2" aria-hidden>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : historyError ? (
            <p className="font-sans text-xs text-[var(--text3)]">Couldn't load event history right now.</p>
          ) : eventHistory.length === 0 ? (
            <p className="font-sans text-xs text-[var(--text3)]">No events recorded for this view yet.</p>
          ) : (
            <ul className="space-y-2">
              {eventHistory.map((entry) => (
                <li
                  key={entry.event_id}
                  className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface2)] p-3"
                >
                  <div className="min-w-0">
                    <p className="break-words font-sans text-sm font-semibold text-[var(--text)]">{entry.event_name}</p>
                    <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-[var(--text3)]">
                      {formatDateOnly(entry.event_date, 'MMM d, yyyy')}
                      {' · '}
                      {EVENT_TYPE_LABELS[entry.event_type] ?? entry.event_type}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-bold text-[var(--brand)]">
                    +{entry.points_earned}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ProfileSection>

        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <PhotoRequestSection
            matchedMemberId={member.id}
            selectedMemberName={displayName}
            buttonLabel={avatarUrl ? 'Update photo' : 'Request photo'}
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-[48px] w-full rounded-lg border border-[var(--border)] bg-[var(--surface2)] font-sans text-sm font-semibold text-[var(--text)] sm:hidden"
        >
          Close
        </button>
    </BottomSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function Leaderboard() {
  const { terms, loading: termsLoading } = useAcademicTerms();
  const { yearsWithData, loading: yearsWithDataLoading } = useLeaderboardYears();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [pointsHelpOpen, setPointsHelpOpen] = useState(false);
  const [byPoints, setByPoints] = useState<LeaderboardEntry[]>([]);
  const [byEvents, setByEvents] = useState<LeaderboardEntry[]>([]);
  const [houseStandings, setHouseStandings] = useState<HouseStanding[]>([]);
  const [houseActivity, setHouseActivity] = useState<HouseRecentActivity[]>([]);
  const [houseLoading, setHouseLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [isDegradedMode, setIsDegradedMode] = useState(false);
  const [activeView, setActiveView] = useState<'individual' | 'houses'>(
    searchParams.get('view') === 'houses' ? 'houses' : 'individual'
  );
  const [activeTab, setActiveTab] = useState<'points' | 'events'>('points');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<SelectedYear | null>(null);
  const [hasUserSelectedYear, setHasUserSelectedYear] = useState(false);
  const [selectedMember, setSelectedMember] = useState<LeaderboardEntry | null>(null);

  // Keep the view toggle in sync with the URL so a link to ?view=houses lands
  // on the right tab, and switching tabs updates the URL for sharing.
  const setView = useCallback(
    (view: 'individual' | 'houses') => {
      setActiveView(view);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (view === 'houses') {
            next.set('view', 'houses');
          } else {
            next.delete('view');
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'houses' && activeView !== 'houses') {
      setActiveView('houses');
    } else if (view !== 'houses' && activeView !== 'individual') {
      setActiveView('individual');
    }
    // Only react to external URL changes (e.g. back/forward, shared links);
    // setView already updates activeView directly on user interaction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // "How points work" links (#how-points-work) must land on an open explainer.
  useEffect(() => {
    if (location.hash === `#${POINTS_HELP_ANCHOR}`) setPointsHelpOpen(true);
  }, [location.hash]);

  // Clicking the link while the hash is already #how-points-work (after the user
  // collapsed the explainer) changes no URL part, so the effect above and the
  // scroll manager never rerun. Reopen and scroll directly.
  const revealPointsHelp = useCallback(() => {
    setPointsHelpOpen(true);
    window.requestAnimationFrame(() => {
      document.getElementById(POINTS_HELP_ANCHOR)?.scrollIntoView({ block: 'start', behavior: 'auto' });
    });
  }, []);

  const academicYears = useMemo<AcademicYearOption[]>(
    () => buildAcademicYearOptions(terms, yearsWithData),
    [terms, yearsWithData]
  );

  const resolvedDefaultYear = useMemo<SelectedYear | null>(
    () => resolveDefaultLeaderboardYear(academicYears),
    [academicYears]
  );

  const defaultYearReady = !termsLoading && !yearsWithDataLoading;
  const initialSelectedYear = defaultYearReady ? resolvedDefaultYear ?? 'all' : null;

  useEffect(() => {
    if (hasUserSelectedYear || selectedYear !== null || initialSelectedYear === null) {
      return;
    }
    setSelectedYear(initialSelectedYear);
  }, [hasUserSelectedYear, initialSelectedYear, selectedYear]);

  // Approved member avatars (member_id → thumbnail URL) from the shared cached
  // query. Fail-soft: initials remain the fallback.
  const memberAvatars = useMemberAvatars();

  const { data: members, isLoading: loading, error: leaderboardError } = useIndividualLeaderboard(selectedYear);

  useEffect(() => {
    if (leaderboardError) {
      setError(leaderboardError);
      if (isSupabaseUnavailable(leaderboardError)) setIsDegradedMode(true);
      return;
    }
    if (!members) return;

    setByPoints(assignTiedRanks(members, comparePointsThenEvents, compareMembersForDisplay));
    setByEvents(
      assignTiedRanks(members, (a, b) => b.events_attended - a.events_attended, compareMembersForDisplay)
    );
    setError(null);
  }, [members, leaderboardError]);

  useEffect(() => {
    if (selectedYear === null) return;
    let isCurrentRequest = true;

    const loadHouseStandings = async () => {
      try {
        setHouseLoading(true);
        const rawData = selectedYear === 'all'
          ? await leaderboardRepository.getAllTimeHouseLeaderboard()
          : await leaderboardRepository.getYearlyHouseLeaderboard(selectedYear);

        if (!isCurrentRequest) return;

        // When the DB has no calculated standings for an override year, inject
        // official placeholder rows so getPublicHousePoints can fill in the totals.
        const data =
          rawData.length === 0 &&
          selectedYear !== 'all' &&
          isHousePointOverrideActive(selectedYear as number)
            ? (['Bowser', 'Donkey Kong', 'Toad', 'Boo'] as HouseName[]).map((houseName) => ({
                house: houseName,
                house_profile_id: '',
                display_name: houseName,
                image_url: null as null,
                accent_color: HOUSE_COLORS[houseName] as string | null,
                academic_year_start: selectedYear as number,
                academic_year_end: (selectedYear as number) + 1,
                total_points: 0,
                events_attended: 0,
                unique_events: 0,
                unique_members: 0,
                average_points_per_member: null as null,
                latest_activity_at: null as null,
              }))
            : rawData;

        // Apply official public point overrides for 2025-2026
        const standingsWithOverrides = data.map((s) => ({
          ...s,
          total_points: getPublicHousePoints({
            houseKey: s.house,
            houseName: s.display_name,
            academicYearStart: s.academic_year_start,
            calculatedPoints: s.total_points,
          }),
        }));

        // Sort by house points
        const ranked = standingsWithOverrides
          .sort((a, b) => b.total_points - a.total_points)
          .map((house, index) => ({ ...house, rank: index + 1 }));

        setHouseStandings(ranked);

        if (selectedYear === 'all') {
          setHouseActivity([]);
        } else {
          const activity = await leaderboardRepository.getRecentHouseActivity(selectedYear, 8);
          if (isCurrentRequest) setHouseActivity(activity);
        }
      } catch (err) {
        if (isCurrentRequest) {
          setError(err);
          if (isSupabaseUnavailable(err)) {
            setIsDegradedMode(true);
            
            // Fallback for 2025-2026 if live query fails
            if (selectedYear === 2025) {
              const fallbackStandings: HouseStanding[] = FALLBACK_HOUSE_STANDINGS_2025_2026.map((s, idx) => ({
                house: s.name.toLowerCase().replace(/\s+/g, '-'),
                display_name: s.name,
                emoji: s.emoji,
                total_points: s.points,
                accent_color: s.accentColor,
                rank: idx + 1,
                events_attended: 0,
                unique_members: 0,
                average_points_per_member: null,
                latest_activity_at: null,
              }));
              setHouseStandings(fallbackStandings);
            } else {
              setHouseStandings([]);
            }
          } else {
            setHouseStandings([]);
          }
          setHouseActivity([]);
        }
      } finally {
        if (isCurrentRequest) setHouseLoading(false);
      }
    };

    loadHouseStandings();
    return () => { isCurrentRequest = false; };
  }, [selectedYear]);

  const handleSelectedYearChange = (value: string) => {
    setHasUserSelectedYear(true);
    setSelectedYear(value === 'all' ? 'all' : Number(value));
  };

  const entries = activeTab === 'points' ? byPoints : byEvents;
  const searchTerm = searchQuery.trim().toLowerCase();
  const filteredEntries = entries.filter(
    (entry) =>
      !searchTerm ||
      `${entry.first_name} ${entry.last_name}`.toLowerCase().includes(searchTerm) ||
      (entry.college ?? '').toLowerCase().includes(searchTerm) ||
      (entry.year ?? '').toLowerCase().includes(searchTerm)
  );

  const resetKey = `${activeTab}|${searchQuery}|${selectedYear}`;
  const {
    page,
    totalPages,
    rowsPerPage,
    setRowsPerPage,
    setCurrentPage,
    pageStartLabel,
    pageEndLabel,
    paginatedData,
  } = usePagination(filteredEntries, { defaultRowsPerPage: 25, resetKey });

  const top3 = filteredEntries.slice(0, 3);
  // Skip the podium when a tie spills past 3rd place: there's no fair way to
  // pick which tied members get the last podium spots.
  const showPodium = top3.length >= 3 && top3.every((entry) => isWithinTop(entry, 3));
  const waitingForInitialYear = selectedYear === null && !defaultYearReady;

  if ((waitingForInitialYear || loading) && selectedYear === null) return <LeaderboardSkeleton />;
  if (error && !isDegradedMode) {
    return (
      <>
        <PageTitle title="Leaderboard" />
        <div className="vsa-container py-20">
          <ContentUnavailableState
            title="Leaderboard temporarily unavailable"
            message="We're having trouble loading the leaderboard right now. Please check back later."
            showLinks={false}
          />
        </div>
      </>
    );
  }

  const selectedYearLabel =
    selectedYear === 'all'
      ? 'All-Time'
      : academicYears.find((year) => year.year === selectedYear)?.label || (selectedYear ? `${selectedYear}-${selectedYear + 1}` : '');
  const summerBreak = isSummerBreak();
  const summerPointsMessage = getSummerBreakMessage('points');

  return (
    <>
      <PageTitle title="Leaderboard" />
      {isDegradedMode && <DegradedModeBanner sourceName="leaderboard" />}

      <div className="vsa-page-hero">
        <div className="vsa-container relative z-10">
          <div className="scrapbook-paper relative overflow-hidden p-6 sm:p-10">
            <span className="scrapbook-pin" aria-hidden />
            
            <div className="absolute right-6 top-6 opacity-10 sm:right-10 sm:top-10">
              <TrophyIcon className="h-24 w-24 text-[var(--brand)]" />
            </div>

            <div className="relative z-10">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <StickerBadge rotation={-2} color="accent">VSA SCOREBOARD</StickerBadge>
                <StickerBadge rotation={1} color="primary" size="sm">{selectedYearLabel}</StickerBadge>
              </div>
              
              <h1 className="vsa-page-title mb-4">Leaderboard</h1>
              <p className="max-w-2xl font-sans text-[15px] leading-[1.8]" style={{ color: 'var(--text2)' }}>
                {selectedYear === 'all'
                  ? 'All-time standings for our members. Track points and events attended across all years.'
                  : `Celebrate VSA's most active members for the ${selectedYearLabel} academic year. Track points, events, and your climb to the top.`}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            {/* Main View Toggle */}
            <div className="vsa-filter-bar mt-0">
              {(['individual', 'houses'] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setView(view)}
                  aria-pressed={activeView === view}
                  className={`vsa-filter-btn px-6 py-2.5 font-bold transition-all ${activeView === view ? 'active scale-105 shadow-md' : ''}`}
                >
                  {view === 'individual' ? 'Individual' : 'House'}
                </button>
              ))}
            </div>

            {/* Metric Toggle */}
            {activeView === 'individual' && (
              <div className="flex gap-2">
                {(['points', 'events'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    aria-pressed={activeTab === tab}
                    className={`chip-check min-h-[40px] touch:min-h-11 rounded-full border-2 px-4 py-1.5 font-mono text-[11px] font-bold tracking-wider transition-all ${
                      activeTab === tab 
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-[color:var(--color-on-accent)] shadow-sm'
                        : 'border-[var(--border)] bg-[var(--surface2)] text-[var(--text3)] hover:border-[var(--accent)]'
                    }`}
                  >
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>
            )}

            {/* Year Selector */}
            <div className="ml-auto w-full max-w-[180px] sm:w-auto">
              <select
                value={selectedYear ?? ''}
                onChange={(e) => handleSelectedYearChange(e.target.value)}
                aria-label="Select academic year"
                className="scrapbook-select bg-[var(--surface)] font-mono text-xs font-bold"
              >
                <option value="all">ALL-TIME</option>
                {academicYears.map((year) => (
                  <option key={year.year} value={year.year}>{year.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="vsa-container pt-8">
        <RelatedLinks
          heading="Looking for…?"
          links={leaderboardRelatedLinks(location.pathname, location.search).map((link) =>
            link.to.endsWith(`#${POINTS_HELP_ANCHOR}`) ? { ...link, onClick: revealPointsHelp } : link,
          )}
        />
        {summerBreak && (
          <div className="mt-4 rounded border px-4 py-3 font-sans text-xs leading-relaxed" style={{ borderColor: 'var(--border)', background: 'var(--surface2)', color: 'var(--text3)' }}>
            <span className="font-semibold" style={{ color: 'var(--text)' }}>{summerPointsMessage.title}.</span>{' '}
            {summerPointsMessage.body}
          </div>
        )}
      </div>

      <div className="vsa-container py-8">
        {activeView === 'individual' ? (
          <>
          {showPodium && (
            <PodiumIndividual
              top3={top3}
              activeTab={activeTab}
              memberAvatars={memberAvatars}
              onSelectMember={setSelectedMember}
            />
          )}

            <div className="mt-8 md:mt-12">
              <div className="mb-4 flex items-center gap-3 px-2 md:mb-6">
                <div className="h-8 w-2 rounded-full bg-[var(--brand)]" />
                <h3 className="font-serif text-2xl font-bold">Full Standings</h3>
              </div>

              <div className="mb-6 relative">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text3)]" />
                <Input
                  className="pl-11 h-12 bg-[var(--surface)] border-2 border-[var(--border)] text-[16px] focus:ring-[var(--brand)] sm:text-sm"
                  placeholder="Search for a member..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {filteredEntries.length === 0 ? (
                <div className="scrapbook-empty">
                  {isDegradedMode ? (
                    <ContentUnavailableState
                      title="Individual standings unavailable"
                      message="We're having trouble loading the live member leaderboard. Your points are still being tracked safely in the database."
                    />
                  ) : (
                    <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                      {searchTerm ? 'No matching members found.' : `No activity recorded for ${selectedYearLabel} yet.`}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
              {paginatedData.map((entry) => (
                <div
                  key={entry.id}
                  className="group scrapbook-paper flex items-center gap-3 p-3 transition-all sm:gap-4 sm:p-4 hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                      {/* Rank */}
                      <div className="flex shrink-0 items-center justify-center sm:w-16">
                        <div className={`flex h-9 min-w-[2.25rem] items-center justify-center rounded-xl border-2 px-1 font-mono text-sm font-black transition-colors sm:h-10 sm:min-w-[2.5rem] sm:text-base ${
                          isWithinTop(entry, 3) ? 'border-[var(--brand)] text-[var(--text)]' : 'border-[var(--border)] text-[var(--text3)] group-hover:border-[var(--brand)]/30'
                        }`}>
                          {formatRank(entry)}
                        </div>
                      </div>

                      {/* Member Info */}
                      <div className="flex flex-1 items-center gap-3 min-w-0">
                        <div className="shrink-0">
                          {memberAvatars.get(entry.id) ? (
                            <Avatar size="sm" avatarUrl={memberAvatars.get(entry.id)} />
                          ) : (
                            <InitialsAvatar name={`${entry.first_name} ${entry.last_name}`} size={32} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <ProfileOpener
                            name={getMemberDisplayName(entry)}
                            onOpen={() => setSelectedMember(entry)}
                            className="max-w-full text-left"
                          >
                            <span className="line-clamp-2 block break-words font-serif text-[15px] font-bold leading-tight sm:truncate sm:text-[16px]" style={{ color: 'var(--text)' }}>
                              {entry.first_name} {entry.last_name}
                            </span>
                          </ProfileOpener>
                          <div className="truncate font-sans text-[11px]" style={{ color: 'var(--text3)' }}>
                            {[entry.year, entry.college].filter(Boolean).join(' • ') || 'VSA Member'}
                          </div>
                          {/* On phones the gap caption lives under the name so it can
                              wrap instead of squeezing the name/score columns. */}
                          <div className="sm:hidden">
                            <RankGapNote entries={entries} entry={entry} metric={activeTab} />
                          </div>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="shrink-0 text-right sm:px-4">
                        <div className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
                          {activeTab === 'points' ? 'PTS' : 'EVENTS'}
                        </div>
                        <div className="font-mono text-2xl font-black leading-none" style={{ color: 'var(--text)' }}>
                          <AnimatedCounter value={activeTab === 'points' ? entry.points : entry.events_attended} />
                        </div>
                        <div className="hidden sm:block">
                          <RankGapNote entries={entries} entry={entry} metric={activeTab} />
                        </div>
                      </div>

                      {/* Secondary Stat (Desktop Only) */}
                      <div className="hidden text-right shrink-0 border-l px-6 sm:block" style={{ borderColor: 'var(--border)' }}>
                        <div className="font-mono text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
                          {activeTab === 'points' ? 'EVENTS' : 'POINTS'}
                        </div>
                        <div className="font-mono text-lg font-bold opacity-60">
                          {activeTab === 'points' ? entry.events_attended : entry.points.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="scrapbook-paper mt-8 p-4">
                    <PaginationControls
                      page={page}
                      totalPages={totalPages}
                      rowsPerPage={rowsPerPage}
                      onPageChange={setCurrentPage}
                      onRowsPerPageChange={setRowsPerPage}
                      pageStartLabel={pageStartLabel}
                      pageEndLabel={pageEndLabel}
                      totalCount={filteredEntries.length}
                      theme="zinc"
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <HouseStandingsWall
              standings={houseStandings}
              activity={houseActivity}
              loading={houseLoading}
              selectedYearLabel={selectedYearLabel}
              metric={activeTab}
            />
            {selectedYear !== null && (
              <div className="mt-12">
                <HouseMemberLeaderboard
                  selectedYear={selectedYear}
                  selectedYearLabel={selectedYearLabel}
                />
              </div>
            )}
          </>
        )}

        <details
          id={POINTS_HELP_ANCHOR}
          open={pointsHelpOpen}
          onToggle={(event) => setPointsHelpOpen(event.currentTarget.open)}
          className="group mt-12 scroll-mt-24 rounded-xl border-2 border-[var(--border)] bg-[var(--surface)] md:mt-16"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-4 transition-colors hover:bg-[var(--surface2)] sm:px-6">
            <div>
              <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--text)' }}>
                How points work
              </h2>
              <p className="mt-1 font-sans text-sm" style={{ color: 'var(--text2)' }}>
                Learn how individual points, academic years, and House standings are counted.
              </p>
            </div>
            <svg
              className="h-5 w-5 shrink-0 text-[var(--text3)] transition-transform group-open:rotate-180"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="border-t border-[var(--border)] p-4 sm:p-6">
            <PointsExplainer showCorrectionCta={false} />
          </div>
        </details>
      </div>
      {selectedMember && (
        <PublicMemberProfileModal
          member={selectedMember}
          avatarUrl={memberAvatars.get(selectedMember.id) ?? null}
          activeTab={activeTab}
          selectedYear={selectedYear}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const PODIUM_TIERS = {
  1: { color: '#d4841a', icon: CrownIcon, pin: 'accent' as const, riser: 96 },
  2: { color: '#94a3b8', icon: MedalIcon, pin: 'secondary' as const, riser: 64 },
  3: { color: '#b45309', icon: AwardIcon, pin: 'primary' as const, riser: 40 },
};

function PodiumIndividual({
  top3,
  activeTab,
  memberAvatars,
  onSelectMember,
}: {
  top3: LeaderboardEntry[];
  activeTab: 'points' | 'events';
  memberAvatars: MemberAvatarMap;
  onSelectMember: (member: LeaderboardEntry) => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const first = top3[0];
  const second = top3[1];
  const third = top3[2];
  if (!first) return null;

  // Medal styling follows the member's (possibly shared) rank, not their
  // podium slot, so two members tied at T1 both get gold.
  const tierFor = (entry: LeaderboardEntry) => PODIUM_TIERS[Math.min(entry.rank, 3) as 1 | 2 | 3];

  const cards = [
    {
      entry: second, order: 'order-2 md:order-1', rotation: -2, revealDelay: 0.15,
      gap: first && second ? getLeaderboardGap(first, second, activeTab) : null, gapLabel: `to pass ${formatRank(first)}`, eventTiebreakDirection: 'fewer' as const,
    },
    {
      entry: first, order: 'order-1 md:order-2', rotation: 0, revealDelay: 0.3,
      gap: first && second ? getLeaderboardGap(first, second, activeTab) : null, gapLabel: second ? `ahead of ${formatRank(second)}` : '', eventTiebreakDirection: 'more' as const,
    },
    {
      entry: third, order: 'order-3 md:order-3', rotation: 2, revealDelay: 0,
      gap: second && third ? getLeaderboardGap(second, third, activeTab) : null, gapLabel: second ? `to pass ${formatRank(second)}` : '', eventTiebreakDirection: 'fewer' as const,
    },
  ];

  // Phones get a compact three-row podium (rank, name, score on one line each)
  // so the full standings start on the first screen; md+ keeps the staged cards.
  const compactRows = [cards[1], cards[0], cards[2]].filter((card) => card.entry);

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center gap-3 px-2 md:mb-8">
        <div className="h-8 w-2 rounded-full bg-[var(--accent)]" />
        <h3 className="font-serif text-2xl font-bold">Top Performers</h3>
        <StarIcon className="h-5 w-5 text-[color:var(--color-accent-text)]" />
      </div>

      <div className="space-y-2 md:hidden">
        {compactRows.map((card) => {
          const entry = card.entry;
          const tier = tierFor(entry);
          const name = getMemberDisplayName(entry);
          const avatarUrl = memberAvatars.get(entry.id);
          const value = activeTab === 'points' ? entry.points : entry.events_attended;
          const rankLabel = entry.tiedCount > 1 ? `T${entry.rank}` : entry.rank;

          return (
            <div
              key={entry.id}
              className="scrapbook-paper flex items-center gap-3 border-2 p-3"
              style={{ borderColor: tier.color }}
            >
              <div
                className="flex h-10 min-w-[2.5rem] shrink-0 items-center justify-center rounded-full px-1 font-mono text-base font-black"
                style={{ background: tier.color, color: readableInk(tier.color) }}
              >
                {rankLabel}
              </div>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  loading="lazy"
                  className="h-11 w-11 shrink-0 rounded-full border-2 border-white object-cover dark:border-zinc-800"
                />
              ) : (
                <InitialsAvatar name={name} size={44} />
              )}
              <div className="min-w-0 flex-1">
                <ProfileOpener name={name} onOpen={() => onSelectMember(entry)} className="max-w-full text-left">
                  <span className="line-clamp-2 block break-words font-serif text-base font-bold leading-tight" style={{ color: 'var(--text)' }}>
                    {name}
                  </span>
                </ProfileOpener>
                {card.gap !== null && (
                  <div className="mt-0.5 font-mono text-[10px] font-semibold" style={{ color: 'var(--text3)' }}>
                    {card.gap.metric === 'tie'
                      ? 'tied'
                      : getGapCaption(card.gap, card.gapLabel, card.eventTiebreakDirection)}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
                  {activeTab === 'points' ? 'PTS' : 'EVENTS'}
                </div>
                <div className="font-mono text-2xl font-black leading-none" style={{ color: 'var(--text)' }}>
                  <AnimatedCounter value={value} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden gap-6 md:grid md:grid-cols-3 md:items-end">
        {cards.map((card) => {
          if (!card.entry) return null;
          const tier = tierFor(card.entry);
          const isFirst = card.entry.rank === 1;
          const rankLabel = card.entry.tiedCount > 1 ? `T${card.entry.rank}` : card.entry.rank;
          const value = activeTab === 'points' ? card.entry.points : card.entry.events_attended;
          const Icon = tier.icon;

          return (
            <motion.div
              key={card.entry.id}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.5,
                delay: shouldReduceMotion ? 0 : card.revealDelay,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={`${card.order} relative ${isFirst ? 'md:scale-110 md:z-10' : ''} md:rotate-[var(--podium-rotate)]`}
              style={{ '--podium-rotate': `${card.rotation}deg` } as CSSProperties}
            >
              <PushPin color={tier.pin} className="left-1/2 top-[-10px] -translate-x-1/2" />

              <div
                className={`scrapbook-paper overflow-hidden p-6 text-center shadow-xl transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                  isFirst
                    ? 'border-4 border-[var(--accent)] bg-gradient-to-br from-[var(--surface)] to-[var(--surface2)]'
                    : 'border-2 border-[var(--border)]'
                }`}
              >
                {isFirst && <div className="absolute top-2 right-2 opacity-20"><BoltIcon className="h-6 w-6" /></div>}
                
                {/* Rank Badge */}
                <div className="absolute right-4 top-4">
                  <div 
                    className="flex h-12 w-12 items-center justify-center rounded-full font-mono text-2xl font-black shadow-lg border-2 border-white/50"
                    style={{ background: tier.color, color: readableInk(tier.color) }}
                  >
                    {rankLabel}
                  </div>
                </div>

                {/* Icon */}
                <div className="mb-4 flex justify-center">
                  <div className="rounded-full bg-[var(--surface2)] p-4 shadow-inner" style={{ color: tier.color }}>
                    <Icon className="h-10 w-10" />
                  </div>
                </div>

                {/* Avatar */}
                <div className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full border-4 border-white shadow-md dark:border-zinc-800">
                  {memberAvatars.get(card.entry.id) ? (
                    <img
                      src={memberAvatars.get(card.entry.id)}
                      alt={`${card.entry.first_name} ${card.entry.last_name}`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <InitialsAvatar name={`${card.entry.first_name} ${card.entry.last_name}`} size={96} />
                  )}
                </div>

                {/* Name */}
                <div className="mb-4">
                  <ProfileOpener name={getMemberDisplayName(card.entry)} onOpen={() => onSelectMember(card.entry)}>
                    <span className={`block break-words font-serif leading-tight font-bold ${isFirst ? 'text-2xl' : 'text-xl'}`} style={{ color: 'var(--text)' }}>
                      {card.entry.first_name} {card.entry.last_name}
                    </span>
                  </ProfileOpener>
                  <div className="mt-1 font-mono text-[11px] font-bold opacity-60">VSA MEMBER</div>
                </div>

                {/* Score */}
                <div className={`rounded-xl border-2 p-4 ${isFirst ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--border)] bg-[var(--surface2)]'}`}>
                  <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-wider opacity-60">
                    {activeTab === 'points' ? 'POINTS' : 'EVENTS'}
                  </div>
                  <div className={`font-mono font-black ${isFirst ? 'text-4xl text-[var(--accent)]' : 'text-3xl text-[var(--text)]'}`}>
                    <AnimatedCounter value={value} />
                  </div>
                  {card.gap !== null && (
                    <div
                      className="mt-1.5 font-mono text-[10px] font-bold uppercase tracking-wide"
                      style={{ color: isFirst ? 'var(--color-accent-text)' : 'var(--text3)' }}
                    >
                      {card.gap.metric === 'tie'
                        ? 'tied'
                        : getGapCaption(card.gap, card.gapLabel, card.eventTiebreakDirection)}
                    </div>
                  )}
                </div>
              </div>

              {/* Riser — gives the podium real elevation instead of three
                  same-height cards in a row. Desktop only; on a single mobile
                  column there's no "side by side height" to stage. */}
              <div
                aria-hidden
                className="relative hidden overflow-hidden rounded-b-lg border-2 border-t-0 md:flex md:items-center md:justify-center"
                style={{ height: tier.riser, borderColor: tier.color, background: `${tier.color}12` }}
              >
                <span className="font-mono text-5xl font-black opacity-15" style={{ color: tier.color }}>
                  {rankLabel}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function HouseStandingsWall({
  standings,
  activity,
  loading,
  selectedYearLabel,
  metric
}: {
  standings: HouseStanding[];
  activity: HouseRecentActivity[];
  loading: boolean;
  selectedYearLabel: string;
  metric: 'points' | 'events';
}) {
  if (loading) return <div className="scrapbook-empty text-sm">Loading house standings...</div>;
  if (standings.length === 0) {
    return (
      <div className="scrapbook-empty">
        <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>No house points recorded for {selectedYearLabel} yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="flex items-center gap-3 px-2">
        <div className="h-8 w-2 rounded-full bg-[var(--gold-t)]" />
        <h3 className="font-serif text-2xl font-bold">House Competition</h3>
        <TrophyIcon className="h-6 w-6 text-[color:var(--color-gold-text)]" />
      </div>

      <div className="space-y-8">
        {standings.map((standing, index) => {
          const house = standing.house as HouseName;
          const label = standing.display_name ?? HOUSE_LABELS[house] ?? standing.house;
          const color = standing.accent_color ?? HOUSE_COLORS[house] ?? 'var(--brand)';
          const isFirst = standing.rank === 1;
          const rotation = index % 2 === 0 ? -0.5 : 0.5;
          const maxPoints = Math.max(standings[0]?.total_points ?? 0, 1);
          const pct = Math.round((standing.total_points / maxPoints) * 100);

          return (
            <div 
              key={standing.house_profile_id ?? `${standing.house}-${standing.academic_year_start ?? 'all'}`}
              className="group relative transition-transform hover:scale-[1.01]"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              {isFirst && (
                <>
                  <TapeAccent position="top-left" color="gold" />
                  <TapeAccent position="top-right" color="primary" />
                </>
              )}
              
              <div className="scrapbook-paper overflow-hidden bg-[var(--surface)]">
                {/* House Accent Strip */}
                <div className="absolute left-0 top-0 h-full w-2" style={{ background: color }} />
                
                <div className="flex flex-col p-6 sm:p-8 md:flex-row md:items-center md:gap-8">
                  {/* House Rank & Identity */}
                  <div className="flex items-center gap-5 md:flex-1">
                    <div className="relative shrink-0">
                      <div 
                        className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 shadow-md transition-transform group-hover:scale-110 sm:h-20 sm:w-20"
                        style={{ borderColor: color, background: `${color}15` }}
                      >
                        <span className="font-mono text-3xl font-black sm:text-4xl" style={{ color }}>{standing.rank}</span>
                      </div>
                      {isFirst && <CrownIcon className="absolute -right-2 -top-2 h-8 w-8 text-[color:var(--color-gold-text)] drop-shadow-sm" />}
                    </div>

                    <div className="min-w-0">
                      <h4 className="truncate font-serif text-2xl font-bold sm:text-3xl" style={{ color: 'var(--text)' }}>
                        {standing.emoji ? `${standing.emoji} ` : ''}{label}
                      </h4>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] font-bold opacity-60">
                        <span>{standing.unique_members} MEMBERS</span>
                        <span className="h-1 w-1 rounded-full bg-[var(--text3)]" />
                      <span>{standing.events_attended} CHECK-INS</span>
                      {standing.academic_year_start && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-[var(--text3)]" />
                          <span>{standing.academic_year_start}-{standing.academic_year_end}</span>
                        </>
                      )}
                      </div>
                    </div>
                  </div>

                  {/* House Progress (Visual only normalizing to highest) */}
                  <div className="my-6 flex-1 md:my-0">
                    <div className="mb-2 flex justify-between font-mono text-[10px] font-bold opacity-60">
                      <span>PROGRESS</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-full border-2 border-[var(--border)] bg-[var(--surface2)] p-0.5">
                      <div 
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ background: color, width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* House Score */}
                  <div className="shrink-0 text-right md:w-48">
                    <div 
                      className="inline-flex flex-col items-end rounded-2xl border-2 px-6 py-3 shadow-sm sm:py-4"
                      style={{ borderColor: `${color}40`, background: `${color}08` }}
                    >
                      <div className="font-mono text-[10px] font-bold uppercase tracking-wider opacity-60">
                        HOUSE POINTS
                      </div>
                      <div className="font-mono text-4xl font-black sm:text-5xl" style={{ color }}>
                        <AnimatedCounter value={standing.total_points} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* House Footer Stats */}
                <div className="border-t-2 border-dashed border-[var(--border)] bg-[var(--surface2)] px-6 py-3 sm:px-8">
                  <div className="flex flex-wrap items-center gap-6 text-[11px] font-bold text-[var(--text3)]">
                    <div className="flex items-center gap-2">
                      <TrendUpIcon className="h-3 w-3 text-[var(--brand)]" />
                      <span>AVG CHECK-INS PER MEMBER: <span className="text-[var(--text)]">{standing.average_points_per_member?.toFixed(1) ?? '0.0'}</span></span>
                    </div>
                    {isFirst && (
                      <div className="flex items-center gap-1.5 rounded-full bg-[var(--gold-t)]/10 px-3 py-1 text-[color:var(--color-gold-text)]">
                        <CrownIcon className="h-3 w-3" />
                        <span>1ST PLACE CHAMPIONS</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activity.length > 0 && (
        <div className="relative mt-12 pt-8">
          <PushPin color="primary" className="left-10 top-2" />
          <div className="scrapbook-paper p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <BoltIcon className="h-5 w-5 text-[color:var(--color-accent-text)]" />
              <h3 className="font-serif text-xl font-bold">Recent House Activity</h3>
            </div>
            
            <div className="space-y-3">
              {activity.map((item, i) => (
                <div key={`${item.house}-${item.event_id}-${i}`} className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-4 transition-colors hover:border-[var(--brand)]/30">
                  <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--brand)]" />
                  <div className="flex-1 text-sm font-medium" style={{ color: 'var(--text)' }}>
                    <span style={{ color: HOUSE_COLORS[item.house as HouseName] ?? 'var(--brand)' }} className="font-bold">
                      {item.display_name ?? HOUSE_LABELS[item.house as HouseName] ?? item.house}
                    </span>
                    <span className="mx-2 opacity-60">gained</span>
                    <span className="font-black text-[16px]">{item.total_points}</span>
                    <span className="mx-2 opacity-60">house points from</span>
                    <span className="italic">{item.event_name}</span>
                  </div>
                  <div className="shrink-0 font-mono text-[10px] font-bold opacity-40">
                    {item.contributing_members} MEMBER{item.contributing_members !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
