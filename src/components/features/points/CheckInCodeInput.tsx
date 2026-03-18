import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { usePointsContext } from '../../../context/PointsContext';
import { useEventAttendance } from '../../../hooks/useEventAttendance';

interface CheckInCodeInputProps {
  onPointsAdded?: () => void;
}

export function CheckInCodeInput({ onPointsAdded }: CheckInCodeInputProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { checkInWithCode } = useEventAttendance();
  const { refreshPoints } = usePointsContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('check_in_code', code.toUpperCase())
        .single();

      if (eventError) throw eventError;
      if (!event) {
        setError('Invalid code. Please try again.');
        return;
      }

      if (event.is_code_expired) {
        setError('This code has expired.');
        return;
      }

      const eventDate = new Date(event.date);
      const now = new Date();
      const hoursSinceEvent = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60);
      if (hoursSinceEvent > 24) {
        setError('This event check-in period has ended.');
        return;
      }

      const checkedIn = await checkInWithCode(event.id, code.toUpperCase());
      if (checkedIn) {
        setSuccess(`Successfully checked in to ${event.name}!`);
        setCode('');
        await refreshPoints();
        onPointsAdded?.();
      }
    } catch (err) {
      console.error('Error submitting code:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] rounded-md p-6">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight mb-4">Check In</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="code" className="block text-xs font-medium text-zinc-500 uppercase tracking-widest mb-1">
            Enter Check-in Code
          </label>
          <input
            type="text"
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter code"
            className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !code.trim()}
          className="w-full px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded text-sm font-semibold transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Checking in...' : 'Check In'}
        </button>

        {error && (
          <div className="p-3 rounded border border-red-900/40 bg-red-950/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded border border-emerald-500/30 bg-emerald-950/20 text-emerald-400 text-sm">
            {success}
          </div>
        )}
      </form>
    </div>
  );
}
