import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { useQuery } from 'react-query';
import { useEvents } from '../../../hooks/useEvents';
import { type FindMyPointsEntry } from '../../../hooks/useFindMyPoints';
import { HOUSE_COLORS, HOUSE_LABELS, normalizeHouse } from '../../../constants/houses';
import { supabase } from '../../../lib/supabase';

// ─── House emoji map ───────────────────────────────────────────────────────────

const HOUSE_EMOJI: Record<string, string> = {
  Bowser: '🐢',
  'Donkey Kong': '🦍',
  Boo: '👻',
  Toad: '🍄',
};

// ─── Milestone computation ─────────────────────────────────────────────────────

interface Milestone {
  text: string;
  celebrating: boolean;
}

function getMilestone(
  rank: number,
  points: number,
  allEntries: FindMyPointsEntry[]
): Milestone | null {
  if (rank === 1) return { text: "You're #1 in VSA! 🏆", celebrating: true };
  if (rank <= 3) return { text: "You're in the Top 3! 🏆", celebrating: true };
  if (rank <= 10) return { text: "You're in the Top 10! ✨", celebrating: true };
  if (rank <= 25) return { text: "You're in the Top 25! ⭐", celebrating: true };

  const above = allEntries.find((e) => e.rank === rank - 1);
  const gapToNext = above ? above.total_points - points + 1 : null;

  // If within 5 pts of the next rank, that's the most actionable milestone
  if (gapToNext !== null && gapToNext > 0 && gapToNext <= 5) {
    return {
      text: `${gapToNext} pt${gapToNext === 1 ? '' : 's'} behind #${rank - 1} — almost there!`,
      celebrating: false,
    };
  }

  // Otherwise, show distance to the next tier
  const nextTierRank = rank > 25 ? 25 : rank > 10 ? 10 : 3;
  const tierEntry = allEntries.find((e) => e.rank === nextTierRank);
  const gapToTier = tierEntry ? tierEntry.total_points - points + 1 : null;

  if (gapToTier !== null && gapToTier > 0) {
    return {
      text: `${gapToTier.toLocaleString()} pt${gapToTier === 1 ? '' : 's'} away from Top ${nextTierRank}`,
      celebrating: false,
    };
  }

  // Fallback: any gap to next rank
  if (gapToNext !== null && gapToNext > 0) {
    return {
      text: `${gapToNext} pt${gapToNext === 1 ? '' : 's'} behind #${rank - 1}`,
      celebrating: false,
    };
  }

  return null;
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
      className="flex shrink-0 items-center justify-center rounded-full font-sans font-semibold"
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
  accent,
  accentColor,
  large,
}: {
  label: string;
  value: string;
  accent?: boolean;
  accentColor?: string;
  large?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border-2 p-3 text-center ${
        accent ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--border)] bg-[var(--surface)]'
      }`}
      style={accentColor ? { borderColor: `${accentColor}66`, background: `${accentColor}12` } : undefined}
    >
      <div className="font-mono text-[10px] font-bold uppercase tracking-wider opacity-60" style={{ color: accent ? 'var(--accent)' : 'var(--text3)' }}>
        {label}
      </div>
      <div
        className={`mt-1 font-mono font-black ${large ? 'text-[28px] leading-none' : 'text-xl'}`}
        style={accentColor ? { color: accentColor } : { color: accent ? 'var(--accent)' : 'var(--text)' }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Recent events attended ────────────────────────────────────────────────────

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
        .slice(0, 4);
    },
  });
}

const TYPE_STICKER: Record<string, string> = {
  gbm: 'scrapbook-sticker-teal',
  mixer: 'scrapbook-sticker-coral',
  vcn: 'scrapbook-sticker-coral',
  wildn_culture: 'scrapbook-sticker-coral',
  winter_retreat: 'scrapbook-sticker-coral',
  other: 'scrapbook-sticker-gold',
  external_event: 'scrapbook-sticker-gold',
};

function RecentEventsSection({ memberId }: { memberId: string }) {
  const { data: attended = [], isLoading } = useRecentAttendance(memberId);

  if (isLoading) {
    return (
      <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
        <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--text3)' }}>
          Recent Events
        </div>
        <div className="h-4 w-32 animate-pulse rounded" style={{ background: 'var(--border)' }} />
      </div>
    );
  }

  if (attended.length === 0) return null;

  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
      <div className="mb-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--text3)' }}>
        Recent Events
      </div>
      <ul className="space-y-1.5">
        {attended.map((ev) => (
          <li key={ev.event_id} className="flex items-center gap-2.5">
            <span className="w-[38px] shrink-0 text-center">
              <span className="font-serif text-[15px] leading-none" style={{ color: 'var(--text)' }}>
                {format(parseISO(ev.date), 'd')}
              </span>
              <span className="block font-mono text-[9px] uppercase" style={{ color: 'var(--text3)' }}>
                {format(parseISO(ev.date), 'MMM')}
              </span>
            </span>
            <span className="min-w-0 flex-1 truncate font-sans text-[12px]" style={{ color: 'var(--text2)' }}>
              {ev.name}
            </span>
            <span className={`scrapbook-sticker ${TYPE_STICKER[ev.event_type] ?? 'scrapbook-sticker-gold'} shrink-0 px-2 py-0.5 text-[9px]`}>
              +{ev.points_earned}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NextEventCTA() {
  const { events } = useEvents();
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const nextEvent = events
    .filter((e) => new Date(e.date) >= oneDayAgo)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null;

  if (!nextEvent) {
    return (
      <Link
        to="/events"
        className="flex-1 rounded-xl border-2 border-[var(--brand)] bg-[var(--brand)] px-4 py-2.5 text-center font-mono text-[11px] font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
      >
        View Events →
      </Link>
    );
  }

  return (
    <Link
      to="/events"
      className="flex-1 rounded-xl border-2 border-[var(--brand)] bg-[var(--brand)] px-4 py-2.5 text-center font-mono text-[11px] font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
      title={nextEvent.name}
    >
      Come to {format(new Date(nextEvent.date), 'MMM d')} →
    </Link>
  );
}

function ShareButton({ entry, yearLabel }: { entry: FindMyPointsEntry; yearLabel: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'done'>('idle');

  const shareText = `I'm ranked #${entry.rank} in VSA with ${entry.total_points.toLocaleString()} pts (${yearLabel})! 🎉`;
  const shareUrl = `${window.location.origin}/leaderboard`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My VSA Points Card', text: shareText, url: shareUrl });
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
      className="flex items-center gap-1.5 rounded-full border-2 border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-all hover:border-[var(--brand)] hover:text-[var(--brand)]"
      style={{ color: 'var(--text2)' }}
    >
      {state === 'copied' ? (
        <>✓ Copied!</>
      ) : state === 'done' ? (
        <>✓ Shared!</>
      ) : (
        <>📤 Share my card</>
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
}

const CORRECTION_HREF = '/feedback?type=event&title=Points%20correction';

export function MyVSACard({
  entry,
  allEntries,
  yearLabel,
  isAllTime,
  ambiguous,
  onReset,
}: MyVSACardProps) {
  const houseKey = normalizeHouse(entry.house);
  const houseLabel = houseKey ? HOUSE_LABELS[houseKey] : null;
  const houseColor = houseKey ? HOUSE_COLORS[houseKey] : null;
  const houseEmoji = houseKey ? (HOUSE_EMOJI[houseKey] ?? '🏠') : null;

  const subline = [entry.graduation_year, entry.college].filter(Boolean).join(' • ');
  const milestone = getMilestone(entry.rank, entry.total_points, allEntries);

  const cardBorderColor = houseColor ?? 'var(--accent)';

  return (
    <div className="space-y-3">
      {/* ── The card ── */}
      <div
        className="relative overflow-hidden rounded-2xl border-4 bg-gradient-to-br from-[var(--surface)] to-[var(--surface2)] shadow-lg"
        style={{ borderColor: cardBorderColor }}
      >
        {/* Header strip */}
        <div
          className="flex items-center justify-between gap-2 px-5 py-2.5"
          style={{ background: `${cardBorderColor}18` }}
        >
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--text3)' }}>
            My VSA Card · {yearLabel}
          </span>
          {houseKey && houseColor && houseLabel && houseEmoji && (
            <span
              className="rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ background: houseColor }}
            >
              {houseEmoji} {houseLabel}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-4 sm:px-6">
          {/* Avatar + name */}
          <div className="mb-5 flex items-center gap-4">
            <InitialsAvatar name={entry.full_name || 'VSA Member'} size={56} />
            <div className="min-w-0">
              <div className="truncate font-serif text-[22px] font-bold leading-tight" style={{ color: 'var(--text)' }}>
                {entry.full_name || 'VSA Member'}
              </div>
              {subline && (
                <div className="mt-0.5 truncate font-sans text-[12px]" style={{ color: 'var(--text3)' }}>
                  {subline}
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <StatBox
              label={isAllTime ? 'Points' : `${yearLabel} pts`}
              value={entry.total_points.toLocaleString()}
              accent
              large
            />
            <StatBox label="Rank" value={`#${entry.rank}`} />
            <StatBox label="Events" value={String(entry.events_attended)} />
          </div>

          {/* All-time pts (if not all-time view and they differ) */}
          {!isAllTime && entry.all_time_points !== entry.total_points && (
            <p className="mt-2.5 font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
              All-time: <span style={{ color: 'var(--text)' }}>{entry.all_time_points.toLocaleString()} pts</span>
            </p>
          )}

          {/* Recent events attended */}
          <RecentEventsSection memberId={entry.member_id} />

          {/* Milestone */}
          {milestone && (
            <div
              className={`mt-4 rounded-xl border-2 px-4 py-2.5 ${
                milestone.celebrating
                  ? 'border-[var(--accent)] bg-[var(--accent)]/8'
                  : 'border-[var(--border)] bg-[var(--surface)]'
              }`}
            >
              <p className={`font-mono text-[11px] font-bold ${milestone.celebrating ? '' : 'uppercase tracking-wider'}`} style={{ color: milestone.celebrating ? 'var(--accent)' : 'var(--text2)' }}>
                {milestone.celebrating ? milestone.text : `💡 ${milestone.text}`}
              </p>
              {!milestone.celebrating && (
                <p className="mt-0.5 font-sans text-[11px]" style={{ color: 'var(--text3)' }}>
                  Come to the next event to climb the board.
                </p>
              )}
            </div>
          )}

          {/* CTAs */}
          <div className="mt-4 flex flex-wrap gap-2">
            <NextEventCTA />
            <Link
              to="/leaderboard"
              className="flex-1 rounded-xl border-2 border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-center font-mono text-[11px] font-bold uppercase tracking-wider transition-colors hover:border-[var(--brand)]"
              style={{ color: 'var(--text2)', minWidth: '120px' }}
            >
              Full Standings →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--surface2)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <ShareButton entry={entry} yearLabel={yearLabel} />
          {ambiguous && (
            <button
              type="button"
              onClick={onReset}
              className="rounded-full border-2 border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors hover:border-[var(--brand)]"
              style={{ color: 'var(--text2)' }}
            >
              Not me
            </button>
          )}
        </div>
        <Link
          to={CORRECTION_HREF}
          className="rounded-full border-2 border-[var(--accent)] bg-[var(--accent)] px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
        >
          Request correction
        </Link>
      </div>
    </div>
  );
}
