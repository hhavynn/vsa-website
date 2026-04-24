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

interface LeaderboardEntry extends Member { rank: number; }

function InitialsAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : (parts[0]?.[0] ?? '?').toUpperCase();
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 137 % 360;
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center font-sans font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.36, background: `hsl(${hue},45%,88%)`, color: `hsl(${hue},55%,38%)` }}
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
      setByPoints(members.sort((a, b) => b.points - a.points).map((m, i) => ({ ...m, rank: i + 1 })));
      setByEvents([...members].sort((a, b) => b.events_attended - a.events_attended).map((m, i) => ({ ...m, rank: i + 1 })));
    } catch (err) {
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
    return () => { sub.unsubscribe(); };
  }, [fetchLeaderboard]);

  const entries = activeTab === 'points' ? byPoints : byEvents;
  const searchTerm = searchQuery.trim().toLowerCase();
  const filteredEntries = entries.filter(e =>
    !searchTerm ||
    `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchTerm) ||
    (e.college ?? '').toLowerCase().includes(searchTerm) ||
    (e.year ?? '').toLowerCase().includes(searchTerm)
  );

  const resetKey = `${activeTab}|${searchQuery}`;
  const { page, totalPages, rowsPerPage, setRowsPerPage, setCurrentPage, pageStartLabel, pageEndLabel, paginatedData } =
    usePagination(filteredEntries, { defaultRowsPerPage: 25, resetKey });

  const top3 = filteredEntries.slice(0, 3);

  if (loading) return <PageLoader message="Loading leaderboard..." />;
  if (error) return (
    <div className="max-w-4xl mx-auto px-8 py-20 text-center">
      <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>{error}</p>
    </div>
  );

  return (
    <>
      <PageTitle title="Leaderboard" />

      {/* ── Page header ──────────────────────────────────── */}
      <div className="border-b flex justify-between items-end" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', padding: '36px 52px 28px' }}>
        <div>
          <h1 className="font-serif leading-none tracking-[-0.03em]" style={{ fontSize: 44, color: 'var(--color-text)' }}>Leaderboard</h1>
          <p className="font-sans text-sm mt-2" style={{ color: 'var(--color-text2)' }}>{byPoints.length} members · current season</p>
        </div>
        {/* Tab toggle */}
        <div className="inline-flex border rounded overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
          {(['points','events'] as const).map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="font-sans text-xs transition-colors duration-150"
              style={{
                padding: '7px 16px',
                fontWeight: activeTab === tab ? 500 : 400,
                background: activeTab === tab ? 'var(--color-surface2)' : 'transparent',
                color: activeTab === tab ? 'var(--color-text)' : 'var(--color-text2)',
                borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none',
                cursor: 'pointer',
              }}
            >
              {tab === 'points' ? 'Points' : 'Events'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Top 3 — open typographic grid ──────────────── */}
      {top3.length >= 3 && (
        <div className="border-b" style={{ background: 'var(--color-surface2)', borderColor: 'var(--color-border)', padding: '32px 52px' }}>
          <Label className="mb-5">Top Performers</Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
            {top3.map((entry, i) => (
              <div
                key={entry.id}
                className="flex items-center gap-3.5"
                style={{
                  paddingRight: i < 2 ? 32 : 0,
                  borderRight: i < 2 ? '1px solid var(--color-border)' : 'none',
                  marginRight: i < 2 ? 32 : 0,
                }}
              >
                <span
                  className="font-serif leading-none shrink-0"
                  style={{ fontSize: 40, color: i === 0 ? 'var(--color-text)' : 'var(--color-text3)' }}
                >
                  #{entry.rank}
                </span>
                {entry.user_id
                  ? <Avatar size="sm" userId={entry.user_id} />
                  : <InitialsAvatar name={`${entry.first_name} ${entry.last_name}`} size={32} />
                }
                <div className="min-w-0">
                  <div className="font-sans text-sm font-semibold truncate tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>
                    {entry.first_name} {entry.last_name}
                  </div>
                  {entry.college && (
                    <div className="font-sans text-[11px] mt-0.5 truncate" style={{ color: 'var(--color-text3)' }}>{entry.college}</div>
                  )}
                </div>
                <span
                  className="font-serif ml-auto shrink-0"
                  style={{ fontSize: 22, color: i === 0 ? 'var(--color-text)' : 'var(--color-text2)' }}
                >
                  {activeTab === 'points' ? entry.points.toLocaleString() : entry.events_attended}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Search + table ───────────────────────────────── */}
      <div style={{ padding: '24px 52px 32px' }}>
        <div className="mb-3.5">
          <Input
            placeholder="Search by name, college, or year…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {filteredEntries.length === 0 ? (
          <div className="border rounded py-16 text-center" style={{ borderColor: 'var(--color-border)' }}>
            <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
              {searchTerm ? 'No matching members.' : 'No members yet.'}
            </p>
          </div>
        ) : (
          <div className="border rounded overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            {/* Table header */}
            <div
              className="grid border-b"
              style={{ gridTemplateColumns: '44px 1fr 150px 64px 80px', padding: '9px 20px', borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}
            >
              {['', 'Member', 'College', activeTab === 'points' ? 'Events' : 'Points', activeTab === 'points' ? 'Points' : 'Events'].map((h, i) => (
                <Label key={i}>{h}</Label>
              ))}
            </div>

            {paginatedData.map(entry => (
              <div
                key={entry.id}
                className="grid items-center border-b"
                style={{ gridTemplateColumns: '44px 1fr 150px 64px 80px', padding: '11px 20px', borderColor: 'var(--color-border)' }}
              >
                {/* Rank */}
                <div
                  className="font-mono text-xs font-semibold text-center"
                  style={{ color: entry.rank <= 3 ? 'var(--color-text)' : 'var(--color-text3)' }}
                >
                  {entry.rank <= 3 ? ['①','②','③'][entry.rank - 1] : `${entry.rank}`}
                </div>

                {/* Member */}
                <div className="flex items-center gap-2.5">
                  {entry.user_id
                    ? <Avatar size="sm" userId={entry.user_id} />
                    : <InitialsAvatar name={`${entry.first_name} ${entry.last_name}`} size={28} />
                  }
                  <div>
                    <div className="font-sans text-[13.5px] font-medium tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>
                      {entry.first_name} {entry.last_name}
                    </div>
                    {entry.year && (
                      <div className="font-sans text-[11px] mt-0.5" style={{ color: 'var(--color-text3)' }}>{entry.year}</div>
                    )}
                  </div>
                </div>

                {/* College */}
                <div className="font-sans text-xs" style={{ color: 'var(--color-text2)' }}>{entry.college ?? '—'}</div>

                {/* Secondary stat */}
                <div className="font-sans text-xs text-center" style={{ color: 'var(--color-text2)' }}>
                  {activeTab === 'points' ? entry.events_attended : entry.points}
                </div>

                {/* Primary stat */}
                <div
                  className="font-serif text-right"
                  style={{ fontSize: 17, color: entry.rank <= 3 ? 'var(--color-text)' : 'var(--color-text2)' }}
                >
                  {activeTab === 'points' ? entry.points : entry.events_attended}
                </div>
              </div>
            ))}

            <PaginationControls
              page={page} totalPages={totalPages}
              rowsPerPage={rowsPerPage} onPageChange={setCurrentPage} onRowsPerPageChange={setRowsPerPage}
              pageStartLabel={pageStartLabel} pageEndLabel={pageEndLabel} totalCount={filteredEntries.length}
              theme="zinc"
            />
          </div>
        )}
      </div>
    </>
  );
}
