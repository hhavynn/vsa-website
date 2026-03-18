import { useState } from 'react';
import { supabase } from '../../../lib/supabase';

type EventType = 'general_event' | 'wildn_culture' | 'vcn_dance_practice' | 'vcn_attendance';

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'general_event',      label: 'General Event' },
  { value: 'wildn_culture',      label: 'Wild n Culture' },
  { value: 'vcn_dance_practice', label: 'VCN Dance Practice' },
  { value: 'vcn_attendance',     label: 'VCN Attendance' },
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

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('User not authenticated');

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { data: pointsData, error: pointsError } = await supabase
        .rpc('get_event_points', { event_type: eventType });
      if (pointsError) throw pointsError;

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 6);

      const { error: insertError } = await supabase
        .from('check_in_codes')
        .insert({ code, event_type: eventType, points: pointsData, created_by: user.id, expires_at: expiresAt.toISOString() });
      if (insertError) throw insertError;

      setGeneratedCode(code);
    } catch (err) {
      console.error('Error generating code:', err);
      setError('Failed to generate code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border border-zinc-200 dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-md p-6">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Generate Check-in Code</h2>

      <div className="space-y-4">
        <div>
          <label htmlFor="eventType" className="block text-xs font-medium text-zinc-500 uppercase tracking-label mb-1.5">
            Event type
          </label>
          <select
            id="eventType"
            value={eventType}
            onChange={e => setEventType(e.target.value as EventType)}
            className="block w-full rounded border border-zinc-700 bg-zinc-950 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
          >
            {EVENT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={generateCode}
          disabled={isLoading}
          className="w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-sm font-medium rounded transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Generating...' : 'Generate Code'}
        </button>

        {error && (
          <div className="p-3 rounded border border-red-900/40 bg-red-950/20 text-red-400 text-sm">{error}</div>
        )}

        {generatedCode && (
          <div className="mt-2 p-4 border border-zinc-200 dark:border-[#27272a] bg-zinc-50 dark:bg-zinc-900/60 rounded">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-label mb-1">Generated code</p>
            <p className="text-2xl font-mono font-bold text-zinc-900 dark:text-zinc-50 tracking-widest">{generatedCode}</p>
            <p className="text-xs text-zinc-400 mt-2">Expires in 6 hours</p>
          </div>
        )}
      </div>
    </div>
  );
}
