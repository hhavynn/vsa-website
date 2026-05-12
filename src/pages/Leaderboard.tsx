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
import { leaderboardRepository } from '../data/repos/leaderboard';

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
  const [byPoints, setByPoints] = useState<LeaderboardEntry[]>([]);
  const [byEvents, setByEvents] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'points' | 'events'>('points');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(() => {
    // We'll set the actual default in an effect once terms load
    return 'all';
  });

  // Group terms by academic year for the selector
  const academicYears = useMemo(() => {
    const years = new Map<number, string>();
    terms.forEach((term) => {
      if (!years.has(term.academic_year_start)) {
        years.set(term.academic_year_start, `${term.academic_year_start}-${term.academic_year_end}`);
      }
    });
    return Array.from(years.entries()).sort((a, b) => b[0] - a[0]);
  }, [terms]);

  // Set default year to active year or most recent year
  useEffect(() => {
    if (terms.length > 0 && selectedYear === 'all') {
      const activeTerm = terms.find((t) => t.is_active);
      if (activeTerm) {
        setSelectedYear(activeTerm.academic_year_start);
      } else {
        setSelectedYear(terms[0].academic_year_start);
      }
    }
  }, [terms, selectedYear]);

  const fetchLeaderboard = useCallback(async () => {
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
  }, [selectedYear]);

  useEffect(() => {
    if (selectedYear !== 'all' || terms.length > 0) {
      fetchLeaderboard();
    }
  }, [fetchLeaderboard, selectedYear, terms.length]);

  useEffect(() => {
    // Only subscribe to changes if viewing all-time or if we want real-time updates for yearly too.
    // For now, let's keep it simple and refresh on changes if it's all-time.
    // Real-time for yearly is trickier because it involves multiple tables.
    if (selectedYear === 'all') {
      const sub = supabase
        .channel('members_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, fetchLeaderboard)
        .subscribe();
      return () => {
        sub.unsubscribe();
      };
    }
  }, [fetchLeaderboard, selectedYear]);

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

  if (termsLoading && loading) return <PageLoader message="Loading leaderboard..." />;
  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-20 text-center">
        <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
          {error}
        </p>
      </div>
    );
  }

  const selectedYearLabel = selectedYear === 'all' ? 'All-Time' : academicYears.find(([y]) => y === selectedYear)?.[1] || '';

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

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="h-9 rounded-md border bg-transparent px-3 font-sans text-xs font-medium outline-none transition-colors hover:border-zinc-400 focus:border-zinc-500"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            >
              <option value="all">All-Time</option>
              {academicYears.map(([year, label]) => (
                <option key={year} value={year}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {top3.length >= 3 && (
        <div className="border-b px-5 py-8 sm:px-8 lg:px-[52px]" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
          <Label className="mb-5">Top Performers</Label>
          <div className="grid gap-4 md:grid-cols-3 md:gap-0">
            {top3.map((entry, index) => (
              <div
                key={entry.id}
                className={`flex items-center gap-3.5 rounded-md border p-4 md:rounded-none md:border-0 md:p-0 ${index < 2 ? 'md:mr-8 md:border-r md:pr-8' : ''}`}
                style={{
                  borderColor: 'var(--color-border)',
                }}
              >
                <span
                  className="shrink-0 font-serif leading-none"
                  style={{ fontSize: 40, color: index === 0 ? 'var(--color-text)' : 'var(--color-text3)' }}
                >
                  #{entry.rank}
                </span>
                {entry.user_id ? (
                  <Avatar size="sm" userId={entry.user_id} />
                ) : (
                  <InitialsAvatar name={`${entry.first_name} ${entry.last_name}`} size={32} />
                )}
                <div className="min-w-0">
                  <div className="truncate font-sans text-sm font-semibold tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>
                    {entry.first_name} {entry.last_name}
                  </div>
                  {entry.college && (
                    <div className="mt-0.5 truncate font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                      {entry.college}
                    </div>
                  )}
                </div>
                <span
                  className="ml-auto shrink-0 font-serif"
                  style={{ fontSize: 22, color: index === 0 ? 'var(--color-text)' : 'var(--color-text2)' }}
                >
                  {activeTab === 'points' ? entry.points.toLocaleString() : entry.events_attended}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="vsa-container py-6 lg:pb-8">
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
              {searchTerm ? 'No matching members.' : 'No members yet.'}
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
  );
}
