import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PageTitle } from '../components/PageTitle';

interface LeaderboardEntry {
  id: string;
  first_name: string;
  last_name: string;
  points: number;
  rank: number;
}

interface UserProfile {
  first_name: string;
  last_name: string;
  is_admin: boolean;
}

interface LeaderboardResponse {
  user_id: string;
  points: number;
  user_profiles: UserProfile;
}

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data, error } = await supabase
          .from('user_points')
          .select(`
            user_id,
            points,
            user_profiles!inner (
              first_name,
              last_name,
              is_admin
            )
          `)
          .order('points', { ascending: false });

        if (error) throw error;

        const leaderboardEntries = (data as unknown as LeaderboardResponse[])
          .filter(entry => !entry.user_profiles.is_admin)
          .map((entry, index) => ({
            id: entry.user_id,
            first_name: entry.user_profiles.first_name,
            last_name: entry.user_profiles.last_name,
            points: entry.points,
            rank: index + 1
          }));

        setEntries(leaderboardEntries);
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        setError('Failed to fetch leaderboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <>
      <PageTitle title="Leaderboard" />
      <div className="flex justify-center items-start bg-gray-950">
        <div className="w-full max-w-6xl px-4 py-4">
          <h1 className="text-4xl font-bold text-white mb-6 text-center">Leaderboard</h1>
          
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-700">
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                    >
                      RANK
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Points
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-900 divide-y divide-gray-700">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-800">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        #{entry.rank}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {entry.first_name} {entry.last_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {entry.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}