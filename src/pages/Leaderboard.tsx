import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { PageTitle } from '../components/common/PageTitle';
import { Label } from '../components/ui/Label';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/features/avatar/Avatar';
import { PageLoader } from '../components/common/PageLoader';
import { usePagination } from '../hooks/usePagination';
import { PaginationControls } from '../components/common/PaginationControls';

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
  const [byPoints, setByPoints] = useState<LeaderboardEntry[]>([]);
  const [byEvents, setByEvents] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'points' | 'events'>('points');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('members')
        .select('id, first_name, last_name, college, year, points, events_attended, user_id')
        .order('points', { ascending: false });
      if (err) throw err;
      const members = (data ?? []) as Member[];
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
    fetchLeaderboard();
    const sub = supabase
      .channel('members_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, fetchLeaderboard)
      .subscribe();
    return () => {
      sub.unsubscribe();
    };
  }, [fetchLeaderboard]);

  const entries = activeTab === 'points' ? byPoints : byEvents;
  const searchTerm = searchQuery.trim().toLowerCase();
  const filteredEntries = entries.filter(
    (entry) =>
      !searchTerm ||
      `${entry.first_name} ${entry.last_name}`.toLowerCase().includes(searchTerm) ||
      (entry.college ?? '').toLowerCase().includes(searchTerm) ||
      (entry.year ?? '').toLowerCase().includes(searchTerm)
  );

  const resetKey = `${activeTab}|${searchQuery}`;
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

  if (loading) return <PageLoader message="Loading leaderboard..." />;
  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-20 text-center">
        <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
          {error}
        </p>
      </div>
    );
  }

  return (
    <>
      <PageTitle title="Leaderboard" />

      <div className="border-b px-5 py-8 sm:px-8 lg:px-[52px]" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-serif leading-none tracking-[-0.03em]" style={{ fontSize: 44, color: 'var(--color-text)' }}>
              Leaderboard
            </h1>
            <p className="mt-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
              {byPoints.length} members / current season
            </p>
          </div>

          <div className="inline-flex overflow-hidden rounded border" style={{ borderColor: 'var(--color-border)' }}>
            {(['points', 'events'] as const).map((tab, index) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="font-sans text-xs transition-colors duration-150"
                style={{
                  padding: '7px 16px',
                  fontWeight: activeTab === tab ? 500 : 400,
                  background: activeTab === tab ? 'var(--color-surface2)' : 'transparent',
                  color: activeTab === tab ? 'var(--color-text)' : 'var(--color-text2)',
                  borderLeft: index > 0 ? '1px solid var(--color-border)' : 'none',
                  cursor: 'pointer',
                }}
              >
                {tab === 'points' ? 'Points' : 'Events'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {top3.length >= 3 && (
        <div className="border-b px-5 py-8 sm:px-8 lg:px-[52px]" style={{ background: 'var(--color-surface2)', borderColor: 'var(--color-border)' }}>
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

      <div className="px-5 py-6 sm:px-8 lg:px-[52px] lg:pb-8">
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
                        {entry.college ?? '—'}
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
                  {entry.college ?? '—'}
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
