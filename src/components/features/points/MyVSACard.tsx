import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { useQuery } from 'react-query';
import { eventsRepository, PublicEventPreview } from '../../../data/repos/events';
import { type FindMyPointsEntry } from '../../../hooks/useFindMyPoints';
import { HOUSE_COLORS, HOUSE_LABELS, normalizeHouse } from '../../../constants/houses';
import { supabase } from '../../../lib/supabase';
import { getSupabaseImageUrl } from '../../../lib/supabaseImages';
import { Avatar } from '../avatar/Avatar';

// ─── House emoji map ───────────────────────────────────────────────────────────

const HOUSE_EMOJI: Record<string, string> = {
  Bowser: '🐢',
  'Donkey Kong': '🦍',
  Boo: '👻',
  Toad: '🍄',
};

// ─── Badges & Milestones ───────────────────────────────────────────────────────

interface BadgeData {
  label: string;
  color: 'teal' | 'coral' | 'gold' | 'purple';
}

function getBadges(
  entry: FindMyPointsEntry,
  attended: AttendedEvent[],
  allEntries: FindMyPointsEntry[]
): BadgeData[] {
  const badges: BadgeData[] = [];

  if (entry.events_attended >= 1) {
    badges.push({ label: 'First Event', color: 'teal' });
  }

  if (entry.house) {
    badges.push({ label: 'House Member', color: 'coral' });
  }

  const hasRetreat = attended.some((ev) => ev.name.toLowerCase().includes('retreat'));
  if (hasRetreat) {
    badges.push({ label: 'Retreat Attendee', color: 'purple' });
  }

  if (entry.events_attended >= 5) {
    badges.push({ label: 'Regular', color: 'gold' });
  }

  if (entry.rank <= 10) {
    badges.push({ label: 'Top 10', color: 'gold' });
  } else {
    const top10Entry = allEntries[9]; // 10th place
    if (top10Entry && top10Entry.total_points - entry.total_points <= 10) {
      badges.push({ label: 'Top 10 Watch', color: 'purple' });
    }
  }

  return badges;
}

function getTop10Gap(entry: FindMyPointsEntry, allEntries: FindMyPointsEntry[]): string | null {
  if (entry.rank <= 10) return "You're in the Top 10!";
  
  const top10Entry = allEntries[9]; // 10th place
  if (!top10Entry) return null;

  const gap = top10Entry.total_points - entry.total_points + 1;
  return `${gap.toLocaleString()} pt${gap === 1 ? '' : 's'} away from Top 10`;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function InitialsAvatar({ name, size = 52 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
      : (parts[0]?.[0] ?? '?').toUpperCase();
  const hue = (name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 137) % 360;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-sans font-semibold shadow-sm"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `hsl(${hue},45%,88%)`,
        color: `hsl(${hue},55%,38%)`,
      }}
    >
      {initials}
    </div>
  );
}

function StatBox({
  label,
  value,
  accentColor,
}: {
  label: string;
  value: string;
  accentColor?: string;
}) {
  return (
    <div
      className="rounded-xl border-2 p-2.5 text-center transition-transform hover:scale-[1.02]"
      style={{ 
        borderColor: accentColor ? `${accentColor}33` : 'var(--color-border)', 
        background: 'var(--color-surface)' 
      }}
    >
      <div className="font-mono text-[9px] font-bold uppercase tracking-wider opacity-60" style={{ color: 'var(--color-text3)' }}>
        {label}
      </div>
      <div
        className="mt-0.5 font-mono text-lg font-black"
        style={{ color: accentColor || 'var(--color-text)' }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Data Hooks ───────────────────────────────────────────────────────────────

interface AttendedEvent {
  event_id: string;
  points_earned: number;
  name: string;
  date: string;
  event_type: string;
}

function useRecentAttendance(memberId: string) {
  return useQuery<AttendedEvent[]>({
    queryKey: ['member-attendance', memberId],
    enabled: !!memberId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_event_attendance')
        .select('event_id, points_earned, events(id, name, date, event_type)')
        .eq('member_id', memberId);

      if (error) throw error;

      return ((data ?? []) as any[])
        .map((row) => {
          const ev = Array.isArray(row.events) ? row.events[0] : row.events;
          if (!ev) return null;
          return {
            event_id: row.event_id,
            points_earned: row.points_earned ?? 0,
            name: ev.name ?? '',
            date: ev.date ?? '',
            event_type: ev.event_type ?? 'other',
          } as AttendedEvent;
        })
        .filter((r): r is AttendedEvent => r !== null && r.date !== '')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3);
    },
  });
}

function useUpcomingEvents() {
  const today = new Date().toISOString();
  return useQuery<PublicEventPreview[]>({
    queryKey: ['upcoming-events-preview', today],
    queryFn: () => eventsRepository.getPublicUpcomingPreview(today, 2),
    staleTime: 10 * 60 * 1000,
  });
}

const TYPE_STICKER: Record<string, string> = {
  gbm: 'scrapbook-sticker-teal',
  mixer: 'scrapbook-sticker-coral',
  vcn: 'scrapbook-sticker-coral',
  wildn_culture: 'scrapbook-sticker-coral',
  winter_retreat: 'scrapbook-sticker-purple',
  other: 'scrapbook-sticker-gold',
  external_event: 'scrapbook-sticker-gold',
};

function RecentActivity({ memberId }: { memberId: string }) {
  const { data: attended = [], isLoading } = useRecentAttendance(memberId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--color-surface2)]" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--color-surface2)]" />
      </div>
    );
  }

  if (attended.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center">
        <p className="font-sans text-xs italic" style={{ color: 'var(--color-text3)' }}>
          No check-ins yet. Your first event will show up here.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {attended.map((ev) => (
        <li key={ev.event_id} className="flex items-center gap-3 rounded-lg border bg-[var(--color-surface)] p-2 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded bg-[var(--color-surface2)] font-mono">
            <span className="text-[10px] uppercase leading-none opacity-60">{format(parseISO(ev.date), 'MMM')}</span>
            <span className="text-sm font-bold leading-none">{format(parseISO(ev.date), 'd')}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-serif text-[13px] font-bold" style={{ color: 'var(--color-text)' }}>{ev.name}</div>
            <div className="font-mono text-[9px] uppercase tracking-wider opacity-60" style={{ color: 'var(--color-text3)' }}>{ev.event_type}</div>
          </div>
          <div className={`scrapbook-sticker ${TYPE_STICKER[ev.event_type] ?? 'scrapbook-sticker-gold'} px-2 py-0.5 text-[9px]`}>
            +{ev.points_earned}
          </div>
        </li>
      ))}
    </ul>
  );
}

function UpcomingActivity() {
  const { data: upcoming = [], isLoading } = useUpcomingEvents();

  if (isLoading) return null;
  if (upcoming.length === 0) {
    return (
      <p className="font-sans text-xs italic" style={{ color: 'var(--color-text3)' }}>
        No upcoming events listed yet. Check back soon.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {upcoming.map((ev) => (
          <li key={ev.id} className="group relative flex items-center gap-3 overflow-hidden rounded-lg border bg-[var(--color-surface)] p-2 transition-colors hover:border-[var(--brand)]" style={{ borderColor: 'var(--color-border)' }}>
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-[var(--color-surface2)]">
              {ev.thumbnail_url || ev.image_url ? (
                <img 
                  src={getSupabaseImageUrl(ev.thumbnail_url || ev.image_url || '', { width: 80, height: 80, resize: 'cover' })} 
                  alt="" 
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-[var(--color-text3)]">VSA</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-serif text-[13px] font-bold" style={{ color: 'var(--color-text)' }}>{ev.name}</div>
              <div className="font-sans text-[10px]" style={{ color: 'var(--color-text3)' }}>
                {format(new Date(ev.date), 'EEEE, MMM d')}
              </div>
            </div>
            <div className="shrink-0">
               <Link to="/events" className="rounded-full bg-[var(--color-surface2)] p-1 text-[var(--color-text3)] transition-colors group-hover:bg-[var(--brand)] group-hover:text-white">
                 <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
               </Link>
            </div>
          </li>
        ))}
      </ul>
      <Link to="/events" className="inline-flex font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--brand)] transition-opacity hover:opacity-80">
        See all events →
      </Link>
    </div>
  );
}

function ShareButton({ entry, yearLabel }: { entry: FindMyPointsEntry; yearLabel: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'done'>('idle');

  const shareText = `I'm ranked #${entry.rank} in VSA with ${entry.total_points.toLocaleString()} pts (${yearLabel})! 🎉`;
  const shareUrl = `${window.location.origin}/leaderboard`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My VSA Snapshot', text: shareText, url: shareUrl });
        setState('done');
        setTimeout(() => setState('idle'), 2000);
      } catch {
        // user cancelled or error — silent
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setState('copied');
      setTimeout(() => setState('idle'), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="flex items-center gap-1.5 rounded-full border-2 border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-all hover:border-[var(--brand)] hover:text-[var(--brand)]"
      style={{ color: 'var(--color-text2)' }}
    >
      {state === 'copied' ? (
        <>✓ Copied!</>
      ) : state === 'done' ? (
        <>✓ Shared!</>
      ) : (
        <>📤 Share snapshot</>
      )}
    </button>
  );
}

// ─── Main card ─────────────────────────────────────────────────────────────────

export interface MyVSACardProps {
  entry: FindMyPointsEntry;
  allEntries: FindMyPointsEntry[];
  yearLabel: string;
  isAllTime: boolean;
  ambiguous: boolean;
  onReset: () => void;
  avatarUrl?: string | null;
}

const CORRECTION_HREF = '/feedback?type=event&title=Points%20correction';

export function MyVSACard({
  entry,
  allEntries,
  yearLabel,
  isAllTime,
  ambiguous,
  onReset,
  avatarUrl,
}: MyVSACardProps) {
  const { data: attended = [] } = useRecentAttendance(entry.member_id);
  
  const houseKey = normalizeHouse(entry.house);
  const houseLabel = houseKey ? HOUSE_LABELS[houseKey] : null;
  const houseColor = houseKey ? HOUSE_COLORS[houseKey] : null;
  const houseEmoji = houseKey ? (HOUSE_EMOJI[houseKey] ?? '🏠') : null;

  const subline = [entry.graduation_year, entry.college].filter(Boolean).join(' • ');
  const top10Gap = getTop10Gap(entry, allEntries);
  const badges = useMemo(() => getBadges(entry, attended, allEntries), [entry, attended, allEntries]);

  const cardAccentColor = houseColor ?? 'var(--brand)';

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
      {/* ── The Snapshot Card ── */}
      <div
        className="relative overflow-hidden rounded-2xl border-4 bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface2)] shadow-xl"
        style={{ borderColor: cardAccentColor }}
      >
        {/* Decorative corner tape */}
        <div className="absolute -right-8 -top-8 h-16 w-32 rotate-45 bg-[var(--brand)]/10" />

        {/* Header section */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                <Avatar size="lg" avatarUrl={avatarUrl} />
              ) : (
                <InitialsAvatar name={entry.full_name || 'VSA Member'} size={64} />
              )}
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider opacity-60" style={{ color: 'var(--color-text3)' }}>
                  Your VSA Snapshot
                </p>
                <h3 className="truncate font-serif text-2xl font-bold leading-tight" style={{ color: 'var(--color-text)' }}>
                  {entry.full_name || 'VSA Member'}
                </h3>
                {subline && (
                  <div className="mt-0.5 truncate font-sans text-[12px] opacity-70" style={{ color: 'var(--color-text3)' }}>
                    {subline}
                  </div>
                )}
              </div>
            </div>

            {houseKey && houseColor && houseLabel && (
              <Link to={`/house/${houseKey.toLowerCase().replace(/\s+/g, '-')}`} className="group flex items-center gap-2 rounded-full border-2 px-3 py-1.5 transition-all hover:scale-105 active:scale-95" style={{ borderColor: `${houseColor}44`, background: `${houseColor}11` }}>
                <span className="text-lg leading-none">{houseEmoji}</span>
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider" style={{ color: houseColor }}>{houseLabel}</span>
              </Link>
            )}
          </div>

          {/* Badges row */}
          {badges.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {badges.map((badge, i) => (
                <span 
                  key={badge.label} 
                  className={`scrapbook-sticker scrapbook-sticker-${badge.color} px-2.5 py-1 text-[10px]`}
                  style={{ transform: `rotate(${(i % 2 === 0 ? 1 : -1) * (i + 1)}deg)` }}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 px-6 sm:grid-cols-4">
          <StatBox label="Total Points" value={entry.total_points.toLocaleString()} accentColor={cardAccentColor} />
          <StatBox label="Yearly Rank" value={`#${entry.rank}`} />
          <StatBox label="Check-ins" value={String(entry.events_attended)} />
          <StatBox label="All-Time" value={entry.all_time_points.toLocaleString()} />
        </div>

        {/* Actionable insight */}
        {top10Gap && (
          <div className="mx-6 mt-4 flex items-center gap-2.5 rounded-lg border-2 border-dashed px-4 py-2" style={{ borderColor: `${cardAccentColor}44`, background: `${cardAccentColor}08` }}>
            <span className="text-base">🚀</span>
            <p className="font-mono text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text2)' }}>
              {top10Gap}
            </p>
          </div>
        )}

        <div className="grid gap-6 p-6 sm:grid-cols-2">
          {/* Recent Activity */}
          <div>
            <h4 className="mb-3 font-mono text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--color-text3)' }}>
              Recent Check-ins
            </h4>
            <RecentActivity memberId={entry.member_id} />
          </div>

          {/* Upcoming Events */}
          <div>
            <h4 className="mb-3 font-mono text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--color-text3)' }}>
              Coming Up Next
            </h4>
            <UpcomingActivity />
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface2)]/50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <ShareButton entry={entry} yearLabel={yearLabel} />
          {ambiguous && (
            <button
              type="button"
              onClick={onReset}
              className="rounded-full border-2 border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-all hover:border-[var(--brand)] hover:text-[var(--brand)]"
              style={{ color: 'var(--color-text2)' }}
            >
              Not me
            </button>
          )}
        </div>
        <Link
          to={CORRECTION_HREF}
          className="font-mono text-[10px] font-bold uppercase tracking-wider underline underline-offset-4 opacity-60 transition-opacity hover:opacity-100"
          style={{ color: 'var(--color-text3)' }}
        >
          Request correction
        </Link>
      </div>
    </div>
  );
}

