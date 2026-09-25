import { useState, useEffect } from 'react';
import { eventsRepository, type EventInterestAction } from '../../../data/repos/events';
import { EventInterestCounts } from '../../../types';
import toast from 'react-hot-toast';

interface EventInterestButtonsProps {
  eventId: string;
  initialCounts: EventInterestCounts | null;
  compact?: boolean;
}

const STORAGE_KEY_PREFIX = 'vsa:event-interest:';

export function EventInterestButtons({ eventId, initialCounts, compact = false }: EventInterestButtonsProps) {
  const [counts, setCounts] = useState<EventInterestCounts | null>(initialCounts);
  const [userSignal, setUserSignal] = useState<'interested' | 'going' | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${eventId}`);
    if (saved === 'interested' || saved === 'going') {
      setUserSignal(saved as 'interested' | 'going');
    }
  }, [eventId]);

  const handleSignal = async (signal: 'interested' | 'going') => {
    if (loading) return;

    let action: EventInterestAction;
    if (userSignal === signal) {
      action = signal === 'interested' ? 'clear_interested' : 'clear_going';
    } else if (userSignal === null) {
      action = signal;
    } else {
      action = signal === 'interested' ? 'switch_to_interested' : 'switch_to_going';
    }

    setLoading(true);
    try {
      await eventsRepository.recordInterest(eventId, action);
      if (userSignal === signal) {
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}${eventId}`);
        setUserSignal(null);
      } else {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${eventId}`, signal);
        setUserSignal(signal);
      }

      const interestedAdded = action === 'interested' || action === 'switch_to_interested';
      const interestedRemoved = action === 'clear_interested' || action === 'switch_to_going';
      const goingAdded = action === 'going' || action === 'switch_to_going';
      const goingRemoved = action === 'clear_going' || action === 'switch_to_interested';

      setCounts(prev => ({
        event_id: eventId,
        interested_count: Math.max(0, (prev?.interested_count || 0) + Number(interestedAdded) - Number(interestedRemoved)),
        going_count: Math.max(0, (prev?.going_count || 0) + Number(goingAdded) - Number(goingRemoved)),
        updated_at: new Date().toISOString()
      }));

      if (userSignal === signal) {
        toast.success('Removed your response.');
      } else {
        toast.success(signal === 'interested' ? 'Marked as interested!' : 'Marked as going!');
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to record interest. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const interestedCount = counts?.interested_count || 0;
  const goingCount = counts?.going_count || 0;

  return (
    <div className={`${compact ? 'mt-1' : 'mt-5 border-t pt-5'}`} style={{ borderColor: 'var(--color-border)' }}>
      {!compact && (
        <p className="mb-3 font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text3)' }}>
          Community Interest
        </p>
      )}
      <div className={`flex flex-wrap gap-2 ${compact ? 'lg:justify-end' : ''}`}>
        <button
          type="button"
          onClick={() => handleSignal('interested')}
          disabled={loading}
          aria-pressed={userSignal === 'interested'}
          className={`flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
            userSignal === 'interested'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text2)] hover:bg-[var(--color-surface2)]'
          }`}
        >
          <span aria-hidden>⭐</span>
          <span>Interested {interestedCount > 0 && `(${interestedCount})`}</span>
        </button>

        <button
          type="button"
          onClick={() => handleSignal('going')}
          disabled={loading}
          aria-pressed={userSignal === 'going'}
          className={`flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
            userSignal === 'going'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text2)] hover:bg-[var(--color-surface2)]'
          }`}
        >
          <span aria-hidden>✅</span>
          <span>Going {goingCount > 0 && `(${goingCount})`}</span>
        </button>
      </div>
      {!compact && (
        <p className="mt-3 font-sans text-[10px] leading-relaxed" style={{ color: 'var(--color-text3)' }}>
          Helps VSA estimate interest. This does not count for attendance or points.
        </p>
      )}
    </div>
  );
}
