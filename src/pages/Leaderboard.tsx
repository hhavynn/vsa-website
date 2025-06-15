import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PageTitle } from '../components/PageTitle';
import { usePointsContext } from '../context/PointsContext';
import { RevealOnScrollWrapper } from '../components/RevealOnScrollWrapper';
import { Avatar } from '../components/Avatar/Avatar';

interface LeaderboardEntry {
  id: string;
  first_name: string;
  last_name: string;
  points: number;
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
  points: number;
  events_attended: number;
  user_profiles: UserProfile;
}

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
          points,
          user_profiles!inner (
            first_name,
            last_name,
            is_admin,
            avatar_url
          )
        `)
        .order('points', { ascending: false });

      if (error) throw error;

      // Get events attended count for each user
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('event_attendance')
        .select('user_id, event_id')
        .not('user_id', 'is', null);

      if (attendanceError) throw attendanceError;

      // Count events per user
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
          points: entry.points,
          eventsAttended: eventsCount[entry.user_id] || 0,
          rank: index + 1,
          avatar_url: entry.user_profiles.avatar_url
        }));

      setPointsEntries(leaderboardEntries);

      // Create events leaderboard by sorting the same entries by events attended
      const eventsLeaderboard = [...leaderboardEntries]
        .sort((a, b) => b.eventsAttended - a.eventsAttended)
        .map((entry, index) => ({
          ...entry,
          rank: index + 1
        }));

      setEventsEntries(eventsLeaderboard);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError('Failed to fetch leaderboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    // Set up real-time subscription for points changes
    const pointsSubscription = supabase
      .channel('points_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'user_points' },
        () => {
          fetchLeaderboard();
          refreshPoints();
        }
      )
      .subscribe();

    return () => {
      pointsSubscription.unsubscribe();
    };
  }, [refreshPoints]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <>
      <PageTitle title="Leaderboard" />
      <div className="flex justify-center items-start bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
        <div className="w-full max-w-6xl px-4 py-4">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6 text-center">Leaderboard</h1>
          
          {/* Tab Navigation */}
          <RevealOnScrollWrapper>
            <div className="flex justify-center mb-8">
              <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-1 bg-white dark:bg-gray-800">
                <button
                  onClick={() => setActiveTab('points')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                    activeTab === 'points'
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Points
                </button>
                <button
                  onClick={() => setActiveTab('events')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                    activeTab === 'events'
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Events Attended
                </button>
              </div>
            </div>
          </RevealOnScrollWrapper>
          
          <RevealOnScrollWrapper>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th scope="col" className="w-20 px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Rank
                      </th>
                      <th scope="col" className="w-20 px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Avatar
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Name
                      </th>
                      <th scope="col" className="w-32 px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {activeTab === 'points' ? 'Points' : 'Events Attended'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {(activeTab === 'points' ? pointsEntries : eventsEntries).map((entry, index) => (
                      <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                          <div className="flex justify-center">
                            <Avatar size="sm" userId={entry.id} />
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {entry.first_name} {entry.last_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                          {activeTab === 'points' ? entry.points : entry.eventsAttended}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </RevealOnScrollWrapper>
        </div>
      </div>
    </>
  );
}