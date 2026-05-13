import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { PageTitle } from '../components/common/PageTitle';
import { Label } from '../components/ui/Label';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/features/avatar/Avatar';
import { PageLoader } from '../components/common/PageLoader';
import { usePagination } from '../hooks/usePagination';
import { PaginationControls } from '../components/common/PaginationControls';
import { useAcademicTerms } from '../hooks/useAcademicTerms';
import { useLeaderboardYears } from '../hooks/useLeaderboardYears';
import { leaderboardRepository } from '../data/repos/leaderboard';
import { HOUSE_COLORS, HOUSE_LABELS, HOUSE_OPTIONS, HouseName } from '../constants/houses';
import { HouseRecentActivity } from '../types';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  college: string | null;
  year: string | null;
  points: number;
  events_attended: number;
  user_id: string | null;
}

interface LeaderboardEntry extends Member {
  rank: number;
}

interface HouseStanding {
  house: string;
  rank: number;
  total_points: number;
  events_attended: number;
  unique_events?: number;
  unique_members: number;
  average_points_per_member: number | null;
  latest_activity_at: string | null;
}

type SelectedYear = number | 'all';

interface AcademicYearOption {
  year: number;
  label: string;
  isActive: boolean;
  hasData: boolean;
}

function InitialsAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
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

export function Leaderboard() {
  const { terms, loading: termsLoading } = useAcademicTerms();
  const { yearsWithData, loading: yearsWithDataLoading } = useLeaderboardYears();
  const [byPoints, setByPoints] = useState<LeaderboardEntry[]>([]);
  const [byEvents, setByEvents] = useState<LeaderboardEntry[]>([]);
  const [houseStandings, setHouseStandings] = useState<HouseStanding[]>([]);
  const [houseActivity, setHouseActivity] = useState<HouseRecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [houseLoading, setHouseLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'individual' | 'houses'>('individual');
  const [activeTab, setActiveTab] = useState<'points' | 'events'>('points');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<SelectedYear | null>(null);
  const [hasUserSelectedYear, setHasUserSelectedYear] = useState(false);

  const academicYears = useMemo<AcademicYearOption[]>(() => {
    const years = new Map<number, AcademicYearOption>();

    terms.forEach((term) => {
      const existing = years.get(term.academic_year_start);
      if (existing) {
        existing.isActive = existing.isActive || term.is_active;
        return;
      }

      years.set(term.academic_year_start, {
        year: term.academic_year_start,
        label: `${term.academic_year_start}-${term.academic_year_end}`,
        isActive: term.is_active,
        hasData: false,
      });
    });

    yearsWithData.forEach((year) => {
      const existing = years.get(year);
      if (existing) {
        existing.hasData = true;
      } else {
        years.set(year, {
          year,
          label: `${year}-${year + 1}`,
          isActive: false,
          hasData: true,
        });
      }
    });

    return Array.from(years.values()).sort((a, b) => b.year - a.year);
  }, [terms, yearsWithData]);

  const resolvedDefaultYear = useMemo<SelectedYear | null>(() => {
    if (academicYears.length === 0) return null;

    const activeYear = academicYears.find((year) => year.isActive);
    if (activeYear?.hasData) return activeYear.year;

    const mostRecentYearWithData = academicYears.find((year) => year.hasData);
    if (mostRecentYearWithData) return mostRecentYearWithData.year;

    if (activeYear) return activeYear.year;

    return academicYears[0].year;
  }, [academicYears]);

  const defaultYearReady = !termsLoading && !yearsWithDataLoading;
  const initialSelectedYear = defaultYearReady ? resolvedDefaultYear ?? 'all' : null;

  useEffect(() => {
    if (hasUserSelectedYear || selectedYear !== null || initialSelectedYear === null) {
      return;
    }

    setSelectedYear(initialSelectedYear);
  }, [hasUserSelectedYear, initialSelectedYear, selectedYear]);

  const fetchLeaderboard = useCallback(async (year: SelectedYear) => {
    try {
      setLoading(true);
      let members: Member[] = [];

      if (year === 'all') {
        const data = await leaderboardRepository.getAllTimeLeaderboard();
        members = data as Member[];
      } else {
        const data = await leaderboardRepository.getYearlyLeaderboard(year);
        members = data.map((m) => ({
          id: m.member_id,
          first_name: m.first_name,
          last_name: m.last_name,
          college: m.college,
          year: m.graduation_year,
          points: m.total_points,
          events_attended: m.events_attended,
          user_id: m.user_id,
        }));
      }

      setByPoints(members.sort((a, b) => b.points - a.points).map((member, index) => ({ ...member, rank: index + 1 })));
      setByEvents(
        [...members]
          .sort((a, b) => b.events_attended - a.events_attended)
          .map((member, index) => ({ ...member, rank: index + 1 }))
      );
    } catch {
      setError('Failed to load leaderboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedYear === null) return;

    let isCurrentRequest = true;

    const loadLeaderboard = async () => {
      try {
        setLoading(true);
        let members: Member[] = [];

        if (selectedYear === 'all') {
          const data = await leaderboardRepository.getAllTimeLeaderboard();
          members = data as Member[];
        } else {
          const data = await leaderboardRepository.getYearlyLeaderboard(selectedYear);
          members = data.map((m) => ({
            id: m.member_id,
            first_name: m.first_name,
            last_name: m.last_name,
            college: m.college,
            year: m.graduation_year,
            points: m.total_points,
            events_attended: m.events_attended,
            user_id: m.user_id,
          }));
        }

        if (!isCurrentRequest) return;

        setByPoints(members.sort((a, b) => b.points - a.points).map((member, index) => ({ ...member, rank: index + 1 })));
        setByEvents(
          [...members]
            .sort((a, b) => b.events_attended - a.events_attended)
            .map((member, index) => ({ ...member, rank: index + 1 }))
        );
        setError(null);
      } catch {
        if (isCurrentRequest) {
          setError('Failed to load leaderboard.');
        }
      } finally {
        if (isCurrentRequest) {
          setLoading(false);
        }
      }
    };

    loadLeaderboard();

    return () => {
      isCurrentRequest = false;
    };
  }, [selectedYear]);

  useEffect(() => {
    if (selectedYear === null) return;

    let isCurrentRequest = true;

    const loadHouseStandings = async () => {
      try {
        setHouseLoading(true);
        const data = selectedYear === 'all'
          ? await leaderboardRepository.getAllTimeHouseLeaderboard()
          : await leaderboardRepository.getYearlyHouseLeaderboard(selectedYear);

        if (!isCurrentRequest) return;

        const ranked = data
          .map((house, index) => ({
            ...house,
            rank: index + 1,
          }))
          .sort((a, b) => b.total_points - a.total_points)
          .map((house, index) => ({ ...house, rank: index + 1 }));

        setHouseStandings(ranked);

        if (selectedYear === 'all') {
          setHouseActivity([]);
        } else {
          const activity = await leaderboardRepository.getRecentHouseActivity(selectedYear, 8);
          if (isCurrentRequest) setHouseActivity(activity);
        }
      } catch {
        if (isCurrentRequest) {
          setHouseStandings([]);
          setHouseActivity([]);
        }
      } finally {
        if (isCurrentRequest) {
          setHouseLoading(false);
        }
      }
    };

    loadHouseStandings();

    return () => {
      isCurrentRequest = false;
    };
  }, [selectedYear]);

  const handleSelectedYearChange = (value: string) => {
    setHasUserSelectedYear(true);
    setSelectedYear(value === 'all' ? 'all' : Number(value));
  };

  const refreshSelectedLeaderboard = useCallback(() => {
    if (selectedYear !== null) {
      fetchLeaderboard(selectedYear);
    }
  }, [fetchLeaderboard, selectedYear]);

  useEffect(() => {
    // Only subscribe to changes if viewing all-time or if we want real-time updates for yearly too.
    // For now, let's keep it simple and refresh on changes if it's all-time.
    // Real-time for yearly is trickier because it involves multiple tables.
    if (selectedYear === 'all') {
      const sub = supabase
        .channel('members_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, refreshSelectedLeaderboard)
        .subscribe();
      return () => {
        sub.unsubscribe();
      };
    }
  }, [refreshSelectedLeaderboard, selectedYear]);

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

  const waitingForInitialYear = selectedYear === null && !defaultYearReady;

  if ((waitingForInitialYear || loading) && selectedYear === null) return <PageLoader message="Loading leaderboard..." />;
  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-20 text-center">
        <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
          {error}
        </p>
      </div>
    );
  }

  const selectedYearLabel =
    selectedYear === 'all'
      ? 'All-Time'
      : academicYears.find((year) => year.year === selectedYear)?.label || (selectedYear ? `${selectedYear}-${selectedYear + 1}` : '');

  return (
    <>
      <PageTitle title="Leaderboard" />

      <div className="vsa-page-hero">
        <div className="vsa-container relative z-10">
          <h1 className="vsa-page-title">Leaderboard</h1>
          <p className="mt-3 max-w-2xl font-sans text-[15px] leading-[1.8]" style={{ color: 'var(--text2)' }}>
            {selectedYear === 'all'
              ? 'All-time standings for our members. Track points and events attended across all years.'
              : `Standings for the ${selectedYearLabel} academic year. Track points, events attended, and your next spot to climb.`}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div className="vsa-filter-bar">
              {(['individual', 'houses'] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setActiveView(view)}
                  className={`vsa-filter-btn ${activeView === view ? 'active' : ''}`}
                >
                  {view === 'individual' ? 'Individual Leaderboard' : 'House Standings'}
                </button>
              ))}
            </div>

            {activeView === 'individual' && (
              <div className="vsa-filter-bar">
                {(['points', 'events'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`vsa-filter-btn ${activeTab === tab ? 'active' : ''}`}
                  >
                    {tab === 'points' ? 'Points' : 'Events'}
                  </button>
                ))}
              </div>
            )}

            <div className="w-full max-w-xs sm:w-64">
              <label
                className="mb-1 block font-sans text-[10px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: 'var(--color-text3)' }}
              >
                Academic Year
              </label>
              <select
                value={selectedYear ?? ''}
                onChange={(e) => handleSelectedYearChange(e.target.value)}
                className="w-full rounded border px-3 py-2 font-sans text-sm"
                style={{
                  borderColor: 'var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                }}
              >
                <option value="all">All-Time</option>
                {academicYears.map((year) => (
                  <option key={year.year} value={year.year}>
                    {year.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="vsa-container py-6 lg:pb-8">
        {activeView === 'individual' ? (
          <>
            {top3.length >= 3 && <PodiumTop3 top3={top3} activeTab={activeTab} />}

            <div className={top3.length >= 3 ? 'mt-8' : ''}>
              <div className="mb-3.5">
                <Input
                  placeholder="Search by name, college, or year..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {filteredEntries.length === 0 ? (
                <div className="rounded border py-16 text-center" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                    {searchTerm ? 'No matching members.' : `No points recorded for ${selectedYearLabel} yet.`}
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="divide-y md:hidden" style={{ borderColor: 'var(--color-border)' }}>
              {paginatedData.map((entry) => (
                <div key={entry.id} className="space-y-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="font-mono text-xs font-semibold" style={{ color: entry.rank <= 3 ? 'var(--color-text)' : 'var(--color-text3)' }}>
                      #{entry.rank}
                    </div>
                    {entry.user_id ? (
                      <Avatar size="sm" userId={entry.user_id} />
                    ) : (
                      <InitialsAvatar name={`${entry.first_name} ${entry.last_name}`} size={28} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-sans text-[13.5px] font-medium tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>
                        {entry.first_name} {entry.last_name}
                      </div>
                      <div className="mt-0.5 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                        {[entry.year, entry.college].filter(Boolean).join(' / ') || 'Member'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-serif text-[18px]" style={{ color: 'var(--color-text)' }}>
                        {activeTab === 'points' ? entry.points : entry.events_attended}
                      </div>
                      <div className="font-sans text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
                        {activeTab}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
                    <div>
                      <div className="font-sans text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
                        College
                      </div>
                      <div className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
                        {entry.college ?? '-'}
                      </div>
                    </div>
                    <div>
                      <div className="font-sans text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
                        {activeTab === 'points' ? 'Events' : 'Points'}
                      </div>
                      <div className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
                        {activeTab === 'points' ? entry.events_attended : entry.points}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="hidden border-b md:grid"
              style={{
                gridTemplateColumns: '44px 1fr 150px 64px 80px',
                padding: '9px 20px',
                borderColor: 'var(--color-border)',
                background: 'var(--color-surface2)',
              }}
            >
              {['', 'Member', 'College', activeTab === 'points' ? 'Events' : 'Points', activeTab === 'points' ? 'Points' : 'Events'].map(
                (heading, index) => (
                  <Label key={index}>{heading}</Label>
                )
              )}
            </div>

            {paginatedData.map((entry) => (
              <div
                key={entry.id}
                className="hidden items-center border-b md:grid"
                style={{
                  gridTemplateColumns: '44px 1fr 150px 64px 80px',
                  padding: '11px 20px',
                  borderColor: 'var(--color-border)',
                }}
              >
                <div
                  className="text-center font-mono text-xs font-semibold"
                  style={{ color: entry.rank <= 3 ? 'var(--color-text)' : 'var(--color-text3)' }}
                >
                  {entry.rank <= 3 ? ['①', '②', '③'][entry.rank - 1] : `${entry.rank}`}
                </div>

                <div className="flex items-center gap-2.5">
                  {entry.user_id ? (
                    <Avatar size="sm" userId={entry.user_id} />
                  ) : (
                    <InitialsAvatar name={`${entry.first_name} ${entry.last_name}`} size={28} />
                  )}
                  <div>
                    <div className="font-sans text-[13.5px] font-medium tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>
                      {entry.first_name} {entry.last_name}
                    </div>
                    {entry.year && (
                      <div className="mt-0.5 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                        {entry.year}
                      </div>
                    )}
                  </div>
                </div>

                <div className="font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
                  {entry.college ?? '-'}
                </div>

                <div className="text-center font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
                  {activeTab === 'points' ? entry.events_attended : entry.points}
                </div>

                <div
                  className="text-right font-serif"
                  style={{ fontSize: 17, color: entry.rank <= 3 ? 'var(--color-text)' : 'var(--color-text2)' }}
                >
                  {activeTab === 'points' ? entry.points : entry.events_attended}
                </div>
              </div>
            ))}

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
              )}
            </div>
          </>
        ) : (
          <HouseStandingsPanel
            standings={houseStandings}
            activity={houseActivity}
            loading={houseLoading}
            selectedYearLabel={selectedYearLabel}
          />
        )}
      </div>
    </>
  );
}

function PodiumTop3({ top3, activeTab }: { top3: LeaderboardEntry[]; activeTab: 'points' | 'events' }) {
  const first = top3[0];
  const second = top3[1];
  const third = top3[2];
  if (!first || !second || !third) return null;

  const order: { entry: LeaderboardEntry; rank: 1 | 2 | 3 }[] = [
    { entry: second, rank: 2 },
    { entry: first, rank: 1 },
    { entry: third, rank: 3 },
  ];

  const tierColor = (rank: 1 | 2 | 3) =>
    rank === 1 ? 'var(--color-gold, #d4841a)' : rank === 2 ? 'var(--color-text2)' : 'var(--color-accent, #e8623a)';
  const tierSoft = (rank: 1 | 2 | 3) =>
    rank === 1
      ? 'rgba(232, 168, 56, 0.10)'
      : rank === 2
        ? 'rgba(106, 154, 148, 0.08)'
        : 'rgba(240, 120, 88, 0.10)';
  const tierRing = (rank: 1 | 2 | 3) =>
    rank === 1
      ? 'rgba(232, 168, 56, 0.45)'
      : rank === 2
        ? 'rgba(106, 154, 148, 0.35)'
        : 'rgba(240, 120, 88, 0.40)';

  return (
    <div
      className="overflow-hidden rounded border px-4 py-8 sm:px-6"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-7 flex items-center gap-2.5">
          <span
            className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: 'var(--color-accent, #e8623a)' }}
          >
            Top Performers
          </span>
          <span className="h-px flex-1" style={{ background: 'var(--color-accent, #e8623a)', opacity: 0.25 }} />
        </div>

        <div className="grid grid-cols-3 items-end gap-2.5 sm:gap-4">
          {order.map(({ entry, rank }) => {
            const isFirst = rank === 1;
            const color = tierColor(rank);
            const soft = tierSoft(rank);
            const ring = tierRing(rank);
            const value = activeTab === 'points' ? entry.points.toLocaleString() : String(entry.events_attended);

            return (
              <div
                key={entry.id}
                className={`relative overflow-hidden rounded-xl border ${isFirst ? 'pb-5 pt-6 sm:pt-7' : 'pb-4 pt-5'} px-2 text-center sm:px-3`}
                style={{
                  borderColor: isFirst ? ring : 'var(--color-border)',
                  background: `radial-gradient(120% 80% at 50% 0%, ${soft} 0%, transparent 70%), linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface2) 100%)`,
                  boxShadow: isFirst ? `0 12px 32px ${soft}` : undefined,
                }}
              >
                {isFirst && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 font-serif leading-none"
                    style={{ top: -2, fontSize: 18, color }}
                  >
                    ♔
                  </div>
                )}

                <div
                  className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full font-sans text-[11px] font-semibold leading-none"
                  style={{ background: color, color: 'var(--color-bg)' }}
                >
                  {rank}
                </div>

                <div className="mx-auto mb-2.5 mt-1" style={{ width: isFirst ? 56 : 40, height: isFirst ? 56 : 40 }}>
                  <div className="grid h-full w-full place-items-center rounded-full" style={{ padding: 2, background: color }}>
                    <div
                      className="grid h-full w-full place-items-center overflow-hidden rounded-full"
                      style={{ background: 'var(--color-surface)' }}
                    >
                      {entry.user_id ? (
                        <Avatar size={isFirst ? 'md' : 'sm'} userId={entry.user_id} />
                      ) : (
                        <InitialsAvatar name={`${entry.first_name} ${entry.last_name}`} size={isFirst ? 48 : 32} />
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className="truncate font-sans text-[12.5px] font-semibold tracking-[-0.01em] sm:text-[13.5px]"
                  style={{ color: 'var(--color-text)' }}
                >
                  {entry.first_name} {entry.last_name}
                </div>
                {entry.college && (
                  <div className="mt-0.5 truncate font-sans text-[10.5px] sm:text-[11px]" style={{ color: 'var(--color-text2)' }}>
                    {entry.college}
                  </div>
                )}

                <div className="mt-2.5 font-serif leading-none sm:mt-3" style={{ fontSize: isFirst ? 36 : 28, color }}>
                  {value}
                </div>
                <div
                  className="mt-1.5 font-sans text-[9.5px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: 'var(--color-text3)' }}
                >
                  {activeTab === 'points' ? 'Points' : 'Events'}
                </div>

                <div className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: color }} aria-hidden />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const HOUSE_MARKS: Record<HouseName, string> = {
  Bowser: 'BW',
  'Donkey Kong': 'DK',
  Boo: 'BO',
  Toad: 'TD',
};

function getHouseName(value: string): HouseName | null {
  return HOUSE_OPTIONS.includes(value as HouseName) ? (value as HouseName) : null;
}

function hexToRgba(hex: string, alpha: number) {
  const match = hex.match(/^#([0-9a-f]{6})$/i);
  if (!match) return `rgba(232, 98, 58, ${alpha})`;

  const value = match[1];
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function HousePodiumTop3({ top3 }: { top3: HouseStanding[] }) {
  const first = top3[0];
  const second = top3[1];
  const third = top3[2];
  if (!first || !second || !third) return null;

  const order: { standing: HouseStanding; rank: 1 | 2 | 3 }[] = [
    { standing: second, rank: 2 },
    { standing: first, rank: 1 },
    { standing: third, rank: 3 },
  ];

  return (
    <div
      className="overflow-hidden rounded border px-4 py-8 sm:px-6"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-7 flex items-center gap-2.5">
          <span
            className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: 'var(--color-accent, #e8623a)' }}
          >
            Top Houses
          </span>
          <span className="h-px flex-1" style={{ background: 'var(--color-accent, #e8623a)', opacity: 0.25 }} />
        </div>

        <div className="grid grid-cols-3 items-end gap-2.5 sm:gap-4">
          {order.map(({ standing, rank }) => {
            const house = getHouseName(standing.house);
            const label = house ? HOUSE_LABELS[house] : standing.house;
            const color = house ? HOUSE_COLORS[house] : 'var(--color-accent, #e8623a)';
            const soft = house ? hexToRgba(HOUSE_COLORS[house], rank === 1 ? 0.14 : 0.09) : 'rgba(240, 120, 88, 0.10)';
            const ring = house ? hexToRgba(HOUSE_COLORS[house], rank === 1 ? 0.45 : 0.28) : 'rgba(240, 120, 88, 0.35)';
            const isFirst = rank === 1;

            return (
              <div
                key={standing.house}
                className={`relative overflow-hidden rounded-xl border ${isFirst ? 'pb-5 pt-6 sm:pt-7' : 'pb-4 pt-5'} px-2 text-center sm:px-3`}
                style={{
                  borderColor: isFirst ? ring : 'var(--color-border)',
                  background: `radial-gradient(120% 80% at 50% 0%, ${soft} 0%, transparent 70%), linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface2) 100%)`,
                  boxShadow: isFirst ? `0 12px 32px ${soft}` : undefined,
                }}
              >
                {isFirst && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 font-serif leading-none"
                    style={{ top: -2, fontSize: 18, color }}
                  >
                    ♔
                  </div>
                )}

                <div
                  className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full font-sans text-[11px] font-semibold leading-none"
                  style={{ background: color, color: 'var(--color-bg)' }}
                >
                  {rank}
                </div>

                <div
                  className="mx-auto mb-2.5 mt-1 grid place-items-center rounded-full border font-sans font-semibold"
                  style={{
                    width: isFirst ? 56 : 40,
                    height: isFirst ? 56 : 40,
                    borderColor: ring,
                    background: soft,
                    color,
                    fontSize: isFirst ? 17 : 13,
                  }}
                >
                  {house ? HOUSE_MARKS[house] : standing.house.slice(0, 2).toUpperCase()}
                </div>

                <div
                  className="truncate font-sans text-[12.5px] font-semibold tracking-[-0.01em] sm:text-[13.5px]"
                  style={{ color: 'var(--color-text)' }}
                >
                  {label}
                </div>
                <div className="mt-0.5 truncate font-sans text-[10.5px] sm:text-[11px]" style={{ color: 'var(--color-text2)' }}>
                  {standing.unique_members} members / {standing.events_attended} check-ins
                </div>

                <div className="mt-2.5 font-serif leading-none sm:mt-3" style={{ fontSize: isFirst ? 36 : 28, color }}>
                  {standing.total_points.toLocaleString()}
                </div>
                <div
                  className="mt-1.5 font-sans text-[9.5px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: 'var(--color-text3)' }}
                >
                  Points
                </div>

                <div className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: color }} aria-hidden />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HouseStandingsPanel({
  standings,
  activity,
  loading,
  selectedYearLabel,
}: {
  standings: HouseStanding[];
  activity: HouseRecentActivity[];
  loading: boolean;
  selectedYearLabel: string;
}) {
  if (loading) {
    return <div className="rounded border py-16 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)' }}>Loading house standings...</div>;
  }

  if (standings.length === 0) {
    return (
      <div className="rounded border py-16 text-center" style={{ borderColor: 'var(--color-border)' }}>
        <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
          No house points recorded for {selectedYearLabel} yet.
        </p>
      </div>
    );
  }

  const orderedStandings = [
    ...standings,
    ...HOUSE_OPTIONS
      .filter((house) => !standings.some((standing) => standing.house === house))
      .map((house) => ({
        house,
        rank: standings.length + 1,
        total_points: 0,
        events_attended: 0,
        unique_events: 0,
        unique_members: 0,
        average_points_per_member: 0,
        latest_activity_at: null,
      })),
  ];

  return (
    <div className="space-y-8">
      {standings.length >= 3 && <HousePodiumTop3 top3={standings.slice(0, 3)} />}

      <div className="overflow-hidden rounded border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="hidden border-b md:grid" style={{ gridTemplateColumns: '64px 1fr 120px 120px 120px 120px', padding: '9px 20px', borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
          {['Rank', 'House', 'Points', 'Members', 'Check-ins', 'Avg/member'].map((heading) => (
            <Label key={heading}>{heading}</Label>
          ))}
        </div>

        {orderedStandings.map((standing, index) => {
          const house = standing.house as HouseName;
          return (
            <div
              key={standing.house}
              className="grid grid-cols-[56px_minmax(0,1fr)_96px] items-center gap-3 border-b px-4 py-4 md:grid-cols-[64px_minmax(0,1fr)_120px_120px_120px_120px] md:px-5"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="font-serif text-3xl leading-none" style={{ color: index < 3 ? 'var(--color-text)' : 'var(--color-text3)' }}>
                #{index + 1}
              </div>
              <div className="min-w-0">
                <div className="font-sans text-sm font-semibold tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>
                  {HOUSE_LABELS[house] ?? standing.house}
                </div>
                <div className="mt-1 flex flex-wrap gap-3 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                  <span>{standing.unique_members} contributing members</span>
                  <span>{standing.events_attended} check-ins</span>
                  {standing.unique_events !== undefined && <span>{standing.unique_events} events</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="font-serif text-2xl leading-none" style={{ color: 'var(--color-text)' }}>{standing.total_points.toLocaleString()}</div>
                <div className="mt-1 font-sans text-[10px] uppercase tracking-[0.08em] md:hidden" style={{ color: 'var(--color-text3)' }}>
                  {standing.average_points_per_member ?? 0} avg
                </div>
              </div>
              <div className="hidden text-center font-sans text-sm md:block" style={{ color: 'var(--color-text2)' }}>{standing.unique_members}</div>
              <div className="hidden text-center font-sans text-sm md:block" style={{ color: 'var(--color-text2)' }}>{standing.events_attended}</div>
              <div className="hidden text-right font-sans text-sm md:block" style={{ color: 'var(--color-text2)' }}>{standing.average_points_per_member ?? 0}</div>
            </div>
          );
        })}
      </div>

      {activity.length > 0 && (
        <div>
          <Label className="mb-3">Recent House Activity</Label>
          <div className="overflow-hidden rounded border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            {activity.map((item) => (
              <div key={`${item.house}-${item.event_id}`} className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <p className="font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    {HOUSE_LABELS[item.house as HouseName] ?? item.house} gained {item.total_points} points
                  </p>
                  <p className="mt-0.5 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>{item.event_name}</p>
                </div>
                <span className="shrink-0 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
                  {item.contributing_members} member{item.contributing_members !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
