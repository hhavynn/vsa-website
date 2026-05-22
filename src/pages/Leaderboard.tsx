import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FaTrophy, FaMedal, FaAward, FaCrown, FaStar, 
  FaSearch, FaChevronLeft, FaChevronRight, FaBolt, FaArrowTrendUp 
} from 'react-icons/fa6';
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

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & UTILS
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

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
        if (isCurrentRequest) setError('Failed to load leaderboard.');
      } finally {
        if (isCurrentRequest) setLoading(false);
      }
    };

    loadLeaderboard();
    return () => { isCurrentRequest = false; };
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
          .map((house, index) => ({ ...house, rank: index + 1 }))
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

  const refreshSelectedLeaderboard = useCallback(() => {
    if (selectedYear !== null) fetchLeaderboard(selectedYear);
  }, [fetchLeaderboard, selectedYear]);

  useEffect(() => {
    if (selectedYear === 'all') {
      const sub = supabase
        .channel('members_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, refreshSelectedLeaderboard)
        .subscribe();
      return () => { sub.unsubscribe(); };
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
        <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>{error}</p>
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
          <div className="scrapbook-paper relative overflow-hidden p-6 sm:p-10">
            <span className="scrapbook-pin" aria-hidden />
            
            <div className="absolute right-6 top-6 opacity-10 sm:right-10 sm:top-10">
              <FaTrophy className="h-24 w-24 text-[var(--brand)]" />
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
                  onClick={() => setActiveView(view)}
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
                    className={`rounded-full border-2 px-4 py-1.5 font-mono text-[10px] font-bold tracking-wider transition-all ${
                      activeTab === tab 
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-sm' 
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

      <div className="vsa-container py-8">
        {activeView === 'individual' ? (
          <>
            {top3.length >= 3 && <PodiumIndividual top3={top3} activeTab={activeTab} />}

            <div className="mt-12">
              <div className="mb-6 flex items-center gap-3 px-2">
                <div className="h-8 w-2 rounded-full bg-[var(--brand)]" />
                <h3 className="font-serif text-2xl font-bold">Full Standings</h3>
              </div>

              <div className="mb-6 relative">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                <Input
                  className="pl-11 h-12 bg-[var(--surface)] border-2 border-[var(--border)] focus:ring-[var(--brand)]"
                  placeholder="Search for a member..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {filteredEntries.length === 0 ? (
                <div className="scrapbook-empty">
                  <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
                    {searchTerm ? 'No matching members found.' : `No activity recorded for ${selectedYearLabel} yet.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedData.map((entry) => (
                    <div 
                      key={entry.id} 
                      className="group scrapbook-paper flex items-center gap-4 p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      {/* Rank */}
                      <div className="flex w-12 shrink-0 items-center justify-center sm:w-16">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 font-mono font-black transition-colors ${
                          entry.rank <= 3 ? 'border-[var(--brand)] text-[var(--text)]' : 'border-[var(--border)] text-[var(--text3)] group-hover:border-[var(--brand)]/30'
                        }`}>
                          #{entry.rank}
                        </div>
                      </div>

                      {/* Member Info */}
                      <div className="flex flex-1 items-center gap-3 min-w-0">
                        <div className="shrink-0">
                          {entry.user_id ? (
                            <Avatar size="sm" userId={entry.user_id} />
                          ) : (
                            <InitialsAvatar name={`${entry.first_name} ${entry.last_name}`} size={32} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-serif text-[16px] font-bold" style={{ color: 'var(--text)' }}>
                            {entry.first_name} {entry.last_name}
                          </div>
                          <div className="truncate font-sans text-[11px]" style={{ color: 'var(--text3)' }}>
                            {[entry.year, entry.college].filter(Boolean).join(' • ') || 'VSA Member'}
                          </div>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="text-right shrink-0 px-2 sm:px-4">
                        <div className="font-mono text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
                          {activeTab === 'points' ? 'PTS' : 'EVENTS'}
                        </div>
                        <div className="font-mono text-2xl font-black leading-none" style={{ color: 'var(--text)' }}>
                          {activeTab === 'points' ? entry.points.toLocaleString() : entry.events_attended}
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
          <HouseStandingsWall
            standings={houseStandings}
            activity={houseActivity}
            loading={houseLoading}
            selectedYearLabel={selectedYearLabel}
            metric={activeTab}
          />
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function PodiumIndividual({ top3, activeTab }: { top3: LeaderboardEntry[]; activeTab: 'points' | 'events' }) {
  const first = top3[0];
  const second = top3[1];
  const third = top3[2];
  if (!first) return null;

  const cards = [
    { entry: second, rank: 2, order: 'order-2 md:order-1', color: '#94a3b8', icon: FaMedal, rotation: -2, pin: 'secondary' as const },
    { entry: first, rank: 1, order: 'order-1 md:order-2', color: '#d4841a', icon: FaCrown, rotation: 0, pin: 'accent' as const, featured: true },
    { entry: third, rank: 3, order: 'order-3 md:order-3', color: '#b45309', icon: FaAward, rotation: 2, pin: 'primary' as const },
  ];

  return (
    <div className="mt-6">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="h-8 w-2 rounded-full bg-[var(--accent)]" />
        <h3 className="font-serif text-2xl font-bold">Top Performers</h3>
        <FaStar className="text-[var(--accent)]" />
      </div>

      <div className="grid gap-6 md:grid-cols-3 md:items-end">
        {cards.map((card) => {
          if (!card.entry) return null;
          const isFirst = card.rank === 1;
          const value = activeTab === 'points' ? card.entry.points.toLocaleString() : String(card.entry.events_attended);
          const Icon = card.icon;

          return (
            <div 
              key={card.entry.id} 
              className={`${card.order} relative ${isFirst ? 'md:scale-110 md:z-10' : 'md:opacity-90'}`}
              style={{ transform: `rotate(${card.rotation}deg)` }}
            >
              <PushPin color={card.pin} className="left-1/2 top-[-10px] -translate-x-1/2" />
              
              <div className={`scrapbook-paper overflow-hidden p-6 text-center shadow-xl ${
                isFirst 
                  ? 'border-4 border-[var(--accent)] bg-gradient-to-br from-[var(--surface)] to-[var(--surface2)]' 
                  : 'border-2 border-[var(--border)]'
              }`}>
                {isFirst && <div className="absolute top-2 right-2 opacity-20"><FaBolt className="h-6 w-6" /></div>}
                
                {/* Rank Badge */}
                <div className="absolute right-4 top-4">
                  <div 
                    className="flex h-12 w-12 items-center justify-center rounded-full font-mono text-2xl font-black text-white shadow-lg border-2 border-white/50"
                    style={{ background: card.color }}
                  >
                    {card.rank}
                  </div>
                </div>

                {/* Icon */}
                <div className="mb-4 flex justify-center">
                  <div className="rounded-full bg-[var(--surface2)] p-4 shadow-inner" style={{ color: card.color }}>
                    <Icon className="h-10 w-10" />
                  </div>
                </div>

                {/* Avatar */}
                <div className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full border-4 border-white shadow-md dark:border-zinc-800">
                  {card.entry.user_id ? (
                    <Avatar size="md" userId={card.entry.user_id} />
                  ) : (
                    <InitialsAvatar name={`${card.entry.first_name} ${card.entry.last_name}`} size={96} />
                  )}
                </div>

                {/* Name */}
                <div className="mb-4">
                  <div className={`font-serif leading-tight font-bold ${isFirst ? 'text-2xl' : 'text-xl'}`} style={{ color: 'var(--text)' }}>
                    {card.entry.first_name} {card.entry.last_name}
                  </div>
                  <div className="mt-1 font-mono text-[11px] font-bold opacity-60">VSA MEMBER</div>
                </div>

                {/* Score */}
                <div className={`rounded-xl border-2 p-4 ${isFirst ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--border)] bg-[var(--surface2)]'}`}>
                  <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-wider opacity-60">
                    {activeTab === 'points' ? 'POINTS' : 'EVENTS'}
                  </div>
                  <div className={`font-mono font-black ${isFirst ? 'text-4xl text-[var(--accent)]' : 'text-3xl text-[var(--text)]'}`}>
                    {value}
                  </div>
                </div>
              </div>
            </div>
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
        <FaTrophy className="text-[var(--gold-t)]" />
      </div>

      <div className="space-y-8">
        {standings.map((standing, index) => {
          const house = standing.house as HouseName;
          const label = HOUSE_LABELS[house] ?? standing.house;
          const color = HOUSE_COLORS[house] ?? 'var(--brand)';
          const isFirst = standing.rank === 1;
          const rotation = index % 2 === 0 ? -0.5 : 0.5;

          return (
            <div 
              key={standing.house} 
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
                      {isFirst && <FaCrown className="absolute -right-2 -top-2 h-8 w-8 text-[var(--gold-t)] drop-shadow-sm" />}
                    </div>

                    <div className="min-w-0">
                      <h4 className="truncate font-serif text-2xl font-bold sm:text-3xl" style={{ color: 'var(--text)' }}>
                        {label}
                      </h4>
                      <div className="mt-1 flex items-center gap-2 font-mono text-[11px] font-bold opacity-60">
                        <span>{standing.unique_members} MEMBERS</span>
                        <span className="h-1 w-1 rounded-full bg-[var(--text3)]" />
                        <span>{standing.events_attended} CHECK-INS</span>
                      </div>
                    </div>
                  </div>

                  {/* House Progress (Visual only normalizing to highest) */}
                  <div className="my-6 flex-1 md:my-0">
                    <div className="mb-2 flex justify-between font-mono text-[10px] font-bold opacity-60">
                      <span>PROGRESS</span>
                      <span>{Math.round((standing.total_points / standings[0].total_points) * 100)}%</span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-full border-2 border-[var(--border)] bg-[var(--surface2)] p-0.5">
                      <div 
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ background: color, width: `${(standing.total_points / standings[0].total_points) * 100}%` }}
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
                        TOTAL POINTS
                      </div>
                      <div className="font-mono text-4xl font-black sm:text-5xl" style={{ color }}>
                        {standing.total_points.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* House Footer Stats */}
                <div className="border-t-2 border-dashed border-[var(--border)] bg-[var(--surface2)] px-6 py-3 sm:px-8">
                  <div className="flex flex-wrap items-center gap-6 text-[11px] font-bold text-[var(--text3)]">
                    <div className="flex items-center gap-2">
                      <FaArrowTrendUp className="text-[var(--brand)]" />
                      <span>AVG PER MEMBER: <span className="text-[var(--text)]">{standing.average_points_per_member?.toFixed(1) ?? '0.0'}</span></span>
                    </div>
                    {isFirst && (
                      <div className="flex items-center gap-1.5 rounded-full bg-[var(--gold-t)]/10 px-3 py-1 text-[var(--gold-t)]">
                        <FaCrown className="h-3 w-3" />
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
              <FaBolt className="text-[var(--accent)]" />
              <h3 className="font-serif text-xl font-bold">Recent House Activity</h3>
            </div>
            
            <div className="space-y-3">
              {activity.map((item, i) => (
                <div key={`${item.house}-${item.event_id}-${i}`} className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-4 transition-colors hover:border-[var(--brand)]/30">
                  <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--brand)]" />
                  <div className="flex-1 text-sm font-medium" style={{ color: 'var(--text)' }}>
                    <span style={{ color: HOUSE_COLORS[item.house as HouseName] ?? 'var(--brand)' }} className="font-bold">
                      {HOUSE_LABELS[item.house as HouseName] ?? item.house}
                    </span>
                    <span className="mx-2 opacity-60">gained</span>
                    <span className="font-black text-[16px]">{item.total_points}</span>
                    <span className="mx-2 opacity-60">points from</span>
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
