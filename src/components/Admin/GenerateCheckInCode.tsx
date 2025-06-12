import { useState } from 'react';
import { supabase } from '../../lib/supabase';

type EventType = 'general_event' | 'wildn_culture' | 'vcn_dance_practice' | 'vcn_attendance';

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'general_event', label: 'General Event' },
  { value: 'wildn_culture', label: 'Wildn Culture' },
  { value: 'vcn_dance_practice', label: 'VCN Dance Practice' },
  { value: 'vcn_attendance', label: 'VCN Attendance' }
];

export function GenerateCheckInCode() {
  const [eventType, setEventType] = useState<EventType>('general_event');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateCode = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setGeneratedCode(null);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('User not authenticated');

      // Generate a random 6-character code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Get points for the event type
      const { data: pointsData, error: pointsError } = await supabase
        .rpc('get_event_points', { event_type: eventType });

      if (pointsError) throw pointsError;

      // Calculate expiration time (6 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 6);

      // Insert the code
      const { error: insertError } = await supabase
        .from('check_in_codes')
        .insert({
          code,
          event_type: eventType,
          points: pointsData,
          created_by: user.id,
          expires_at: expiresAt.toISOString()
        });

      if (insertError) throw insertError;

      setGeneratedCode(code);
    } catch (err) {
      console.error('Error generating code:', err);
      setError('Failed to generate code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4 text-white">Generate Check-in Code</h2>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="eventType" className="block text-sm font-medium text-gray-700">
            Event Type
          </label>
          <select
            id="eventType"
            value={eventType}
            onChange={(e) => setEventType(e.target.value as EventType)}
            className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {EVENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={generateCode}
          disabled={isLoading}
          className="w-full flex justify-center py-2 px-4 border border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
        >
          {isLoading ? 'Generating...' : 'Generate Code'}
        </button>

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        {generatedCode && (
          <div className="mt-4 p-4 bg-gray-700 rounded-md">
            <p className="text-sm text-gray-300">Generated Code:</p>
            <p className="text-2xl font-mono font-bold text-indigo-400">{generatedCode}</p>
            <p className="text-sm text-gray-400 mt-2">Expires in 6 hours</p>
          </div>
        )}
      </div>
    </div>
  );
} 