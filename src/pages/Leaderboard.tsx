import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PageTitle } from '../components/common/PageTitle';
import { usePointsContext } from '../context/PointsContext';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';
import { Avatar } from '../components/features/avatar/Avatar';
import { PageLoader } from '../components/common/PageLoader';

interface LeaderboardEntry {
  id: string;
  first_name: string;
  last_name: string;
  totalPoints: number;
  eventsAttended: number;
  rank: number;
  avatar_url: string | null;
}

interface UserProfile {
  first_name: string;
  last_name: string;
  is_admin: boolean;
  avatar_url: string | null;
}

interface LeaderboardResponse {
  user_id: string;
  total_points: number;
  events_attended: number;
  user_profiles: UserProfile;
}

const rankMedal = (i: number) => {
  if (i === 0) return '🥇';
  if (i === 1) return '🥈';
  if (i === 2) return '🥉';
  return String(i + 1);
};

export function Leaderboard() {
  const [pointsEntries, setPointsEntries] = useState<LeaderboardEntry[]>([]);
  const [eventsEntries, setEventsEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'points' | 'events'>('points');
  const { refreshPoints } = usePointsContext();

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_points')
        .select(`
          user_id,
          total_points,
          user_profiles!inner (
            first_name,
            last_name,
            is_admin,
            avatar_url
          )
        `)
        .order('total_points', { ascending: false });

      if (error) throw error;

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('event_attendance')
        .select('user_id, event_id')
        .not('user_id', 'is', null);

      if (attendanceError) throw attendanceError;

      const eventsCount = attendanceData.reduce((acc: { [key: string]: number }, curr) => {
        acc[curr.user_id] = (acc[curr.user_id] || 0) + 1;
        return acc;
      }, {});

      const leaderboardEntries = (data as unknown as LeaderboardResponse[])
        .filter(entry => !entry.user_profiles.is_admin)
        .map((entry, index) => ({
          id: entry.user_id,
          first_name: entry.user_profiles.first_name,
          last_name: entry.user_profiles.last_name,
          totalPoints: entry.total_points,
          eventsAttended: eventsCount[entry.user_id] || 0,
          rank: index + 1,
          avatar_url: entry.user_profiles.avatar_url,
        }));

      setPointsEntries(leaderboardEntries);
      setEventsEntries(
        [...leaderboardEntries]
          .sort((a, b) => b.eventsAttended - a.eventsAttended)
          .map((e, i) => ({ ...e, rank: i + 1 }))
      );
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError('Failed to fetch leaderboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const pointsSubscription = supabase
      .channel('points_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_points' },
        () => { fetchLeaderboard(); refreshPoints(); }
      )
      .subscribe();
    return () => { pointsSubscription.unsubscribe(); };
  }, [refreshPoints]);

  if (loading) return <PageLoader message="Loading leaderboard..." />;
  if (error) return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center">
      <p className="text-red-400">{error}</p>
    </div>
  );

  const entries = activeTab === 'points' ? pointsEntries : eventsEntries;

  return (
    <>
      <PageTitle title="Leaderboard" />
      <div className="max-w-3xl mx-auto px-4 py-12">

        <RevealOnScrollWrapper>
          <div className="text-center mb-10">
            <h1 className="font-heading font-bold text-4xl text-white mb-2">Leaderboard</h1>
            <p className="text-slate-400 text-sm">{pointsEntries.length} members ranked</p>
          </div>
        </RevealOnScrollWrapper>

        {/* Tab toggle */}
        <RevealOnScrollWrapper>
          <div className="flex justify-center mb-8">
            <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800/80 gap-1">
              {(['points', 'events'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    activeTab === tab
                      ? 'bg-indigo-600 text-white shadow-glow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {tab === 'points' ? '⭐ Points' : '🎫 Events'}
                </button>
              ))}
            </div>
          </div>
        </RevealOnScrollWrapper>

        {/* Top 3 podium */}
        {entries.length >= 3 && (
          <RevealOnScrollWrapper>
            <div className="flex items-end justify-center gap-3 mb-8">
              {[1, 0, 2].map(i => {
                const e = entries[i];
                const heights = ['h-24', 'h-32', 'h-20'];
                return (
                  <div key={e.id} className="flex flex-col items-center gap-2 flex-1 max-w-[120px]">
                    <Avatar size="sm" userId={e.id} avatarUrl={e.avatar_url} />
                    <p className="text-white text-xs font-semibold text-center truncate w-full px-1">
                      {e.first_name} {e.last_name}
                    </p>
                    <p className="text-indigo-400 text-xs font-bold">
                      {activeTab === 'points' ? `${e.totalPoints} pts` : `${e.eventsAttended} events`}
                    </p>
                    <div className={`w-full ${heights[i]} rounded-t-xl flex items-center justify-center text-2xl ${
                      i === 0 ? 'bg-amber-500/20 border border-amber-500/30' :
                      i === 1 ? 'bg-slate-400/10 border border-slate-500/30' :
                      'bg-orange-800/20 border border-orange-700/30'
                    }`}>
                      {rankMedal(i)}
                    </div>
                  </div>
                );
              })}
            </div>
          </RevealOnScrollWrapper>
        )}

        {/* Full table */}
        <RevealOnScrollWrapper>
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800/80">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-16">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Member</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {activeTab === 'points' ? 'Points' : 'Events'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {entries.map((entry, index) => (
                  <tr
                    key={entry.id}
                    className={`transition-colors duration-100 hover:bg-slate-800/30 ${index < 3 ? 'bg-indigo-500/5' : ''}`}
                  >
                    <td className="px-4 py-3.5 text-center text-sm font-medium text-slate-400">
                      {rankMedal(index)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar size="sm" userId={entry.id} avatarUrl={entry.avatar_url} />
                        <span className="text-white text-sm font-medium">
                          {entry.first_name} {entry.last_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`text-sm font-semibold ${index < 3 ? 'text-indigo-400' : 'text-slate-300'}`}>
                        {activeTab === 'points' ? entry.totalPoints : entry.eventsAttended}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RevealOnScrollWrapper>
      </div>
    </>
  );
}
