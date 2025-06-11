import { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface CheckInCodeInputProps {
  onPointsAdded?: () => void;
}

export function CheckInCodeInput({ onPointsAdded }: CheckInCodeInputProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('User not authenticated');

      // Get the check-in code
      const { data: codeData, error: codeError } = await supabase
        .from('check_in_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();

      if (codeError) throw codeError;
      if (!codeData) {
        setError('Invalid code. Please try again.');
        return;
      }

      // Check if code has expired
      if (new Date(codeData.expires_at) < new Date()) {
        setError('This code has expired.');
        return;
      }

      // Check if user has already used this code
      const { data: usageData, error: usageError } = await supabase
        .from('check_in_code_usage')
        .select('*')
        .eq('code_id', codeData.id)
        .eq('used_by', user.id)
        .single();

      if (usageError && usageError.code !== 'PGRST116') throw usageError;
      if (usageData) {
        setError('You have already used this code.');
        return;
      }

      // Record code usage
      const { error: usageInsertError } = await supabase
        .from('check_in_code_usage')
        .insert({
          code_id: codeData.id,
          used_by: user.id
        });

      if (usageInsertError) throw usageInsertError;

      // Get current points
      const { data: currentPoints, error: pointsError } = await supabase
        .from('user_points')
        .select('points')
        .eq('user_id', user.id)
        .single();

      if (pointsError && pointsError.code !== 'PGRST116') throw pointsError;

      const newPoints = (currentPoints?.points || 0) + codeData.points;

      // Update or insert points
      const { error: upsertError } = await supabase
        .from('user_points')
        .upsert({
          user_id: user.id,
          points: newPoints,
          last_updated: new Date().toISOString()
        });

      if (upsertError) throw upsertError;

      setSuccess(`Successfully added ${codeData.points} points!`);
      setCode('');
      
      // Call the callback to refresh points
      onPointsAdded?.();
    } catch (err) {
      console.error('Error submitting code:', err);
      setError('Failed to submit code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">Enter Check-in Code</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-700">
            Code
          </label>
          <input
            type="text"
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter code"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !code.trim()}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isLoading ? 'Submitting...' : 'Submit Code'}
        </button>

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        {success && (
          <div className="text-green-600 text-sm">{success}</div>
        )}
      </form>
    </div>
  );
} 