import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePointsContext } from '../../context/PointsContext';

interface CheckInCodeInputProps {
  onPointsAdded?: () => void;
}

export function CheckInCodeInput({ onPointsAdded }: CheckInCodeInputProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { addPoints } = usePointsContext();

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

      // Add points using the context
      await addPoints(codeData.points);

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
    <div className="bg-gray-800 rounded-2xl shadow-xl p-8">
      <h2 className="text-3xl font-bold text-white mb-6 text-center">
        Enter Check-in Code
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-300 mb-2">
            Code
          </label>
          <input
            type="text"
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter your code here"
            className="block w-full px-4 py-3 rounded-lg border border-gray-700 bg-gray-900 text-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg transition-colors duration-200"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !code.trim()}
          className="w-full flex justify-center items-center px-6 py-3 border border-transparent text-lg font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Submitting...
            </>
          ) : (
            'Submit Code'
          )}
        </button>

        {error && (
          <div className="p-4 rounded-lg bg-red-900/20 text-red-400 text-sm flex items-center">
            <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 rounded-lg bg-green-900/20 text-green-400 text-sm flex items-center">
            <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {success}
          </div>
        )}
      </form>
    </div>
  );
} 