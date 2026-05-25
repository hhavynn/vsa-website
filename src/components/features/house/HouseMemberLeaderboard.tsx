import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HOUSE_COLORS, HOUSE_LABELS, HOUSE_OPTIONS, HouseName } from '../../../constants/houses';
import { leaderboardRepository } from '../../../data/repos/leaderboard';
import { HouseMemberRankEntry } from '../../../types';

const HOUSE_EMOJI: Record<HouseName, string> = {
  Bowser: '🐢',
  'Donkey Kong': '🦍',
  Boo: '👻',
  Toad: '🍄',
};

const DEFAULT_VISIBLE = 5;

function InitialsAvatar({ name, color }: { name: string; color: string }) {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : (parts[0]?.[0] ?? '?').toUpperCase();
  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-sans text-[10px] font-bold text-white"
      style={{ background: color }}
    >
      {initials}
    </div>
  );
}

interface Props {
  selectedYear: number | 'all';
  selectedYearLabel: string;
  showLeaderboardLink?: boolean;
}

export function HouseMemberLeaderboard({ selectedYear, selectedYearLabel, showLeaderboardLink = false }: Props) {
  const [byHouse, setByHouse] = useState<Map<string, HouseMemberRankEntry[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedHouses, setExpandedHouses] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    leaderboardRepository
      .getHouseMemberRankings(selectedYear)
      .then((data) => {
        if (!cancelled) {
          setByHouse(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedYear]);

  const toggleHouse = (house: string) => {
    setExpandedHouses((prev) => {
      const next = new Set(prev);
      if (next.has(house)) next.delete(house);
      else next.add(house);
      return next;
    });
  };

  const toggleShowAll = (house: string) => {
    setShowAll((prev) => {
      const next = new Set(prev);
      if (next.has(house)) next.delete(house);
      else next.add(house);
      return next;
    });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="program-eyebrow mb-0">
          House Rankings{selectedYearLabel ? ` · ${selectedYearLabel}` : ''}
        </div>
        {showLeaderboardLink && (
          <Link to="/leaderboard?view=houses" className="font-sans text-xs font-semibold text-brand-600 dark:text-brand-400">
            Full Leaderboard →
          </Link>
        )}
      </div>

      <div className="space-y-3">
        {(HOUSE_OPTIONS as readonly HouseName[]).map((house) => {
          const color = HOUSE_COLORS[house];
          const emoji = HOUSE_EMOJI[house];
          const members = byHouse.get(house) ?? [];
          const isExpanded = expandedHouses.has(house);
          const isShowingAll = showAll.has(house);
          const visible = isShowingAll ? members : members.slice(0, DEFAULT_VISIBLE);
          const hiddenCount = members.length - DEFAULT_VISIBLE;

          return (
            <div
              key={house}
              className="overflow-hidden rounded-xl border-2 transition-colors duration-200"
              style={{ borderColor: isExpanded ? color : 'var(--color-border)' }}
            >
              {/* Header — click to expand */}
              <button
                onClick={() => toggleHouse(house)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--color-surface2)]"
                style={{ background: isExpanded ? `${color}10` : undefined }}
                aria-expanded={isExpanded}
              >
                <div className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />

                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <span className="font-sans text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                    {emoji} {HOUSE_LABELS[house]}
                  </span>
                  {!loading && members.length > 0 && (
                    <span
                      className="rounded-full px-2 py-0.5 font-mono text-[9px] font-bold text-white"
                      style={{ background: color }}
                    >
                      {members.length}
                    </span>
                  )}
                  {!loading && members.length === 0 && (
                    <span className="font-mono text-[9px]" style={{ color: 'var(--color-text3)' }}>
                      No data yet
                    </span>
                  )}
                </div>

                <span
                  className="font-mono text-lg font-bold transition-transform duration-200"
                  style={{
                    color: 'var(--color-text3)',
                    display: 'inline-block',
                    transform: isExpanded ? 'rotate(45deg)' : 'rotate(0deg)',
                  }}
                >
                  +
                </span>
              </button>

              {/* Rankings body */}
              {isExpanded && (
                <div className="border-t" style={{ borderColor: `${color}33` }}>
                  {loading ? (
                    <div className="px-4 py-6 text-center font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
                      Loading rankings...
                    </div>
                  ) : members.length === 0 ? (
                    <div className="px-5 py-6">
                      <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                        No members in {HOUSE_LABELS[house]} for this period yet.
                      </p>
                    </div>
                  ) : (
                    <div>
                      {visible.map((member, idx) => {
                        const rank = idx + 1;
                        const isTop = rank === 1 && member.total_points > 0;
                        const name = `${member.first_name} ${member.last_name}`.trim();
                        const meta = [member.graduation_year, member.college].filter(Boolean).join(' · ');

                        return (
                          <div
                            key={member.member_id}
                            className={`flex items-center gap-3 px-4 py-3 ${idx < visible.length - 1 ? 'border-b' : ''}`}
                            style={{
                              borderColor: 'var(--color-border)',
                              background: isTop ? `${color}08` : undefined,
                            }}
                          >
                            {/* Rank badge */}
                            <div
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-black"
                              style={{
                                background: rank <= 3 ? color : 'var(--color-surface2)',
                                color: rank <= 3 ? 'white' : 'var(--color-text3)',
                                border: rank > 3 ? '1.5px solid var(--color-border)' : undefined,
                              }}
                            >
                              {rank}
                            </div>

                            {/* Avatar */}
                            <InitialsAvatar name={name} color={color} />

                            {/* Name + meta */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-sans text-[13px] font-semibold" style={{ color: 'var(--color-text)' }}>
                                  {name}
                                </span>
                                {isTop && (
                                  <span
                                    className="rounded-full px-2 py-0.5 font-mono text-[8px] font-bold text-white"
                                    style={{ background: color }}
                                  >
                                    🏆 TOP CONTRIBUTOR
                                  </span>
                                )}
                              </div>
                              {meta && (
                                <div className="font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                                  {meta}
                                </div>
                              )}
                            </div>

                            {/* Points */}
                            <div className="shrink-0 text-right">
                              <div className="font-mono text-sm font-black" style={{ color }}>
                                {member.total_points.toLocaleString()}
                              </div>
                              <div className="font-mono text-[9px] uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                                {member.events_attended} events
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Show more / less */}
                      {hiddenCount > 0 && (
                        <div className="border-t px-4 py-3 text-center" style={{ borderColor: 'var(--color-border)' }}>
                          <button
                            onClick={() => toggleShowAll(house)}
                            className="font-sans text-xs font-semibold transition-opacity hover:opacity-70"
                            style={{ color }}
                          >
                            {isShowingAll ? 'Show less ↑' : `Show ${hiddenCount} more ↓`}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
