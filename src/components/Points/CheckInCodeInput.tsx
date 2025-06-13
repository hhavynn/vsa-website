import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePointsContext } from '../../context/PointsContext';
import { useEventAttendance } from '../../hooks/useEventAttendance';

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

      // Find the event with this check-in code
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

      // Check if code has expired
      if (event.is_code_expired) {
        setError('This code has expired.');
        return;
      }

      // Check if event is within 24 hours
      const eventDate = new Date(event.date);
      const now = new Date();
      const hoursSinceEvent = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60);
      if (hoursSinceEvent > 24) {
        setError('This event check-in period has ended.');
        return;
      }

      // Attempt to check in
      const success = await checkInWithCode(event.id, code.toUpperCase());
      if (success) {
        setSuccess(`Successfully checked in to ${event.name}!`);
        setCode('');
        // Refresh points after successful check-in
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
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">Check In</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
            Enter Check-in Code
          </label>
          <input
            type="text"
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter code"
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !code.trim()}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {isLoading ? 'Checking in...' : 'Check In'}
        </button>

        {error && (
          <div className="p-4 rounded-lg bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 rounded-lg bg-green-50 text-green-700 text-sm">
            {success}
          </div>
        )}
      </form>
    </div>
  );
} 