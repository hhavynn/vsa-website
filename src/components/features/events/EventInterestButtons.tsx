import { useState, useEffect } from 'react';
import { eventsRepository } from '../../../data/repos/events';
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
    if (userSignal || loading) return;

    setLoading(true);
    try {
      await eventsRepository.recordInterest(eventId, signal);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${eventId}`, signal);
      setUserSignal(signal);
      
      // Optimistic update
      setCounts(prev => ({
        event_id: eventId,
        interested_count: (prev?.interested_count || 0) + (signal === 'interested' ? 1 : 0),
        going_count: (prev?.going_count || 0) + (signal === 'going' ? 1 : 0),
        updated_at: new Date().toISOString()
      }));

      toast.success(signal === 'interested' ? "Marked as interested!" : "Marked as going!");
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
          onClick={() => handleSignal('interested')}
          disabled={!!userSignal || loading}
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
            userSignal === 'interested'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text2)] hover:bg-[var(--color-surface2)]'
          }`}
        >
          <span aria-hidden>⭐</span>
          <span>Interested {interestedCount > 0 && `(${interestedCount})`}</span>
        </button>

        <button
          onClick={() => handleSignal('going')}
          disabled={!!userSignal || loading}
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
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
