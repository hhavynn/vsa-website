import { useState } from 'react';
import { useEventAttendance } from '../../../hooks/useEventAttendance';
import { supabase } from '../../../lib/supabase';

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
        .select('id, first_name, last_name, email')
        .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(5);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error('Error searching users:', err);
      setError('Failed to search users.');
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

      const ok = await manuallyCheckIn(eventId, selectedUser.id, points);
      if (ok) {
        setSuccess(`Checked in ${selectedUser.first_name} ${selectedUser.last_name}`);
        setSelectedUser(null);
        setPoints(0);
        onSuccess?.();
      }
    } catch (err) {
      console.error('Error checking in user:', err);
      setError(err instanceof Error ? err.message : 'Failed to check in user.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border border-zinc-200 dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-md p-6">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Manual Check-in</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-label mb-1.5">
            Search member
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Name or email"
              className="flex-1 px-3 py-2 rounded border border-zinc-700 bg-zinc-950 text-zinc-100 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              disabled={isLoading}
            />
            <button
              onClick={handleSearch}
              disabled={isLoading || !searchQuery.trim()}
              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-sm rounded transition-colors disabled:opacity-50"
            >
              Search
            </button>
          </div>
        </div>

        {searchResults.length > 0 && (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded">
            {searchResults.map(user => (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={`w-full text-left px-3 py-2.5 transition-colors ${
                  selectedUser?.id === user.id
                    ? 'bg-zinc-800 border-l-2 border-l-zinc-400'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {user.first_name} {user.last_name}
                </p>
                <p className="text-xs text-zinc-500">{user.email}</p>
              </button>
            ))}
          </div>
        )}

        {selectedUser && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-label mb-1.5">
                Points to award
              </label>
              <input
                type="number"
                value={points}
                onChange={e => setPoints(Number(e.target.value))}
                min="0"
                className="w-full px-3 py-2 rounded border border-zinc-700 bg-zinc-950 text-zinc-100 text-sm focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
            </div>
            <button
              onClick={handleCheckIn}
              disabled={isLoading || points <= 0}
              className="w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-sm font-medium rounded transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Checking in...' : 'Confirm Check-in'}
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 rounded border border-red-900/40 bg-red-950/20 text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 rounded border border-emerald-900/40 bg-emerald-950/20 text-emerald-400 text-sm">
            {success}
          </div>
        )}
      </div>
    </div>
  );
}
