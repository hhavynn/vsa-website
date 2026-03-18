import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { PageTitle } from '../components/common/PageTitle';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';
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


/** Initials avatar for members without a linked account */
function InitialsAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : (parts[0]?.[0] ?? '?').toUpperCase();
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div className={`${dim} rounded-full bg-zinc-700 border border-zinc-600 flex items-center justify-center font-semibold text-zinc-200 flex-shrink-0`}>
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

      setByPoints(
        members
          .sort((a, b) => b.points - a.points)
          .map((m, i) => ({ ...m, rank: i + 1 }))
      );
      setByEvents(
        [...members]
          .sort((a, b) => b.events_attended - a.events_attended)
          .map((m, i) => ({ ...m, rank: i + 1 }))
      );
    } catch (err) {
      console.error('Leaderboard error:', err);
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
  const filteredEntries = entries.filter(entry => {
    if (!searchTerm) return true;

    const fullName = `${entry.first_name} ${entry.last_name}`.toLowerCase();
    const college = (entry.college ?? '').toLowerCase();
    const year = (entry.year ?? '').toLowerCase();

    return fullName.includes(searchTerm) || college.includes(searchTerm) || year.includes(searchTerm);
  });

  const resetKey = `${activeTab}|${searchQuery}`;
  const {
    page, totalPages, rowsPerPage, setRowsPerPage, setCurrentPage,
    pageStartLabel, pageEndLabel,
    paginatedData: paginatedEntries,
  } = usePagination(filteredEntries, { defaultRowsPerPage: 25, resetKey });

  if (loading) return <PageLoader message="Loading leaderboard..." />;
  if (error) return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center">
      <p className="text-brand-400">{error}</p>
    </div>
  );

  return (
    <>
      <PageTitle title="Leaderboard" />
      <div className="max-w-3xl mx-auto px-4 py-12">

        <RevealOnScrollWrapper>
          <div className="text-center mb-10">
            <h1 className="font-sans font-bold text-4xl text-white mb-2 tracking-tight">Leaderboard</h1>
            <p className="text-zinc-500 text-sm">{byPoints.length} members ranked</p>
          </div>
        </RevealOnScrollWrapper>

        <RevealOnScrollWrapper>
          <div className="flex justify-center mb-8">
            <div className="inline-flex p-1 rounded-md bg-zinc-900 border border-zinc-800 gap-1">
              {(['points', 'events'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2 rounded text-sm font-medium transition-all duration-150 ${
                    activeTab === tab
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
                  }`}>
                  {tab === 'points' ? 'Points' : 'Events'}
                </button>
              ))}
            </div>
          </div>
        </RevealOnScrollWrapper>

        {filteredEntries.length >= 3 && (
          <RevealOnScrollWrapper>
            <div className="flex flex-wrap sm:flex-nowrap items-end justify-center gap-3 mb-8">
              {[1, 0, 2].map(i => {
                const entry = filteredEntries[i];
                const podiumHeight = i === 0 ? 'h-44' : i === 1 ? 'h-28' : 'h-16';
                const orderClass = i === 0 ? 'order-1 sm:order-2'
                  : i === 1 ? 'order-2 sm:order-1'
                  : 'order-3 sm:order-3';

                return (
                  <div key={entry.id} className={`flex flex-col items-center gap-2 flex-1 max-w-[120px] ${orderClass}`}>
                    {entry.user_id
                      ? <Avatar size="sm" userId={entry.user_id} />
                      : <InitialsAvatar name={`${entry.first_name} ${entry.last_name}`} />}
                    <p className="text-white text-xs font-semibold text-center truncate w-full px-1">
                      {entry.first_name} {entry.last_name}
                    </p>
                    {entry.college && (
                      <p className="text-zinc-500 text-[10px] text-center truncate w-full px-1 -mt-1">
                        {entry.college}
                      </p>
                    )}
                    <p className="text-brand-400 text-xs font-bold">
                      {activeTab === 'points' ? `${entry.points} pts` : `${entry.events_attended} events`}
                    </p>
                    <div className={`w-full ${podiumHeight} rounded-t-md flex items-center justify-center text-sm font-bold text-zinc-400 ${
                      i === 0 ? 'bg-accent-500/20 border border-accent-500/30 text-accent-400' :
                      i === 1 ? 'bg-zinc-700/30 border border-zinc-600/30' :
                                'bg-zinc-800/30 border border-zinc-700/30'
                    }`}>
                      #{i + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          </RevealOnScrollWrapper>
        )}

        <RevealOnScrollWrapper>
          <div className="rounded-md bg-zinc-900 border border-zinc-800 overflow-hidden">
            <div className="border-b border-zinc-800 px-4 py-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-label text-zinc-500 mb-1.5">
                  Search Members
                </label>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by name, college, or year"
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                />
              </div>
              <div className="mt-3 text-xs text-zinc-500">
                {filteredEntries.length === 0
                  ? 'No matching members.'
                  : `Showing ${pageStartLabel}–${pageEndLabel} of ${filteredEntries.length} result${filteredEntries.length !== 1 ? 's' : ''}`}
              </div>
            </div>

            {filteredEntries.length === 0 ? (
              <div className="py-16 text-center text-zinc-500">
                <p className="text-base">{searchTerm ? 'No matching members.' : 'No members yet.'}</p>
                <p className="text-sm mt-1">
                  {searchTerm ? 'Try a different name, college, or year.' : 'Import a sign-in sheet to populate the leaderboard.'}
                </p>
              </div>
            ) : (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/80">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-label w-16">Rank</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-label">Member</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-zinc-500 uppercase tracking-label">
                        {activeTab === 'points' ? 'Points' : 'Events'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {paginatedEntries.map(entry => (
                      <tr key={entry.id}
                        className={`transition-colors duration-100 hover:bg-zinc-800/40 ${entry.rank <= 3 ? 'bg-zinc-800/20' : ''}`}>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`text-sm font-semibold ${
                            entry.rank === 1 ? 'text-accent-400' :
                            entry.rank <= 3 ? 'text-zinc-300' :
                            'text-zinc-500'
                          }`}>
                            #{entry.rank}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            {entry.user_id
                              ? <Avatar size="sm" userId={entry.user_id} />
                              : <InitialsAvatar name={`${entry.first_name} ${entry.last_name}`} />}
                            <div>
                              <p className="text-white text-sm font-medium leading-tight">
                                {entry.first_name} {entry.last_name}
                              </p>
                              {(entry.college || entry.year) && (
                                <p className="text-zinc-500 text-xs mt-0.5">
                                  {[entry.year, entry.college].filter(Boolean).join(' · ')}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={`text-sm font-semibold ${entry.rank <= 3 ? 'text-brand-400' : 'text-zinc-300'}`}>
                            {activeTab === 'points' ? entry.points : entry.events_attended}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <PaginationControls
                  page={page} totalPages={totalPages}
                  rowsPerPage={rowsPerPage} onPageChange={setCurrentPage} onRowsPerPageChange={setRowsPerPage}
                  pageStartLabel={pageStartLabel} pageEndLabel={pageEndLabel} totalCount={filteredEntries.length}
                  theme="zinc"
                />
              </>
            )}
          </div>
        </RevealOnScrollWrapper>
      </div>
    </>
  );
}
