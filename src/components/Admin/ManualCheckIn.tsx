import { useState } from 'react';
import { useEventAttendance } from '../../hooks/useEventAttendance';
import { supabase } from '../../lib/supabase';

interface ManualCheckInProps {
  eventId: string;
  onSuccess?: () => void;
}

export function ManualCheckIn({ eventId, onSuccess }: ManualCheckInProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [points, setPoints] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { manuallyCheckIn } = useEventAttendance();

  const handleSearch = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSearchResults([]);

      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          id,
          first_name,
          last_name,
          email
        `)
        .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(5);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error('Error searching users:', err);
      setError('Failed to search users. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!selectedUser) return;

    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      const success = await manuallyCheckIn(eventId, selectedUser.id, points);
      if (success) {
        setSuccess(`Successfully checked in ${selectedUser.first_name} ${selectedUser.last_name}`);
        setSelectedUser(null);
        setPoints(0);
        onSuccess?.();
      }
    } catch (err) {
      console.error('Error checking in user:', err);
      setError(err instanceof Error ? err.message : 'Failed to check in user. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl p-6">
      <h2 className="text-2xl font-bold mb-4 text-white">Manual Check-in</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Search User
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email"
              className="flex-1 px-4 py-2 rounded-lg border border-gray-700 bg-gray-900 text-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isLoading}
            />
            <button
              onClick={handleSearch}
              disabled={isLoading || !searchQuery.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              Search
            </button>
          </div>
        </div>

        {searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={`w-full text-left p-3 rounded-lg border ${
                  selectedUser?.id === user.id
                    ? 'border-indigo-500 bg-indigo-900/20'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <p className="text-white font-medium">
                  {user.first_name} {user.last_name}
                </p>
                <p className="text-sm text-gray-400">{user.email}</p>
              </button>
            ))}
          </div>
        )}

        {selectedUser && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Points to Award
              </label>
              <input
                type="number"
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                min="0"
                className="w-full px-4 py-2 rounded-lg border border-gray-700 bg-gray-900 text-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <button
              onClick={handleCheckIn}
              disabled={isLoading || points <= 0}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Check In User
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-red-900/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 rounded-lg bg-green-900/20 text-green-400 text-sm">
            {success}
          </div>
        )}
      </div>
    </div>
  );
} 