import { useEffect, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  EventLifecycleCandidate,
  getNextEventLifecycleTransition,
} from '../lib/eventLifecycle';

/**
 * Provides a lightweight clock synchronized with event lifecycle boundaries.
 * Instead of continuous polling or interval ticks, a single timer is scheduled
 * for the exact moment when the next event starts, ends, or midnight rolls over
 * in San Diego. When that boundary crosses (or when the tab is refocused after
 * backgrounding past the boundary), the clock advances and specified queries
 * are invalidated.
 */
export function useEventLifecycleTimer(
  events: EventLifecycleCandidate[],
  invalidateQueryKeys: unknown[][] = []
): Date {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());

  const nextBoundary = useMemo(
    () => getNextEventLifecycleTransition(events, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, now.getTime()]
  );

  const queryKeysJson = useMemo(
    () => JSON.stringify(invalidateQueryKeys),
    [invalidateQueryKeys]
  );

  useEffect(() => {
    if (!nextBoundary) return;

    const delayMs = Math.max(0, nextBoundary.getTime() - Date.now() + 500);
    // 2147483647 is max 32-bit int (~24.8 days)
    const safeDelay = Math.min(delayMs, 2147483647);

    const timer = setTimeout(() => {
      setNow(new Date());
      try {
        const keys: unknown[][] = JSON.parse(queryKeysJson);
        for (const key of keys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      } catch {
        // Safe fallback
      }
    }, safeDelay);

    return () => clearTimeout(timer);
  }, [nextBoundary, queryClient, queryKeysJson]);

  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        const current = new Date();
        setNow(current);
        if (nextBoundary && current.getTime() >= nextBoundary.getTime()) {
          try {
            const keys: unknown[][] = JSON.parse(queryKeysJson);
            for (const key of keys) {
              queryClient.invalidateQueries({ queryKey: key });
            }
          } catch {
            // Safe fallback
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [nextBoundary, queryClient, queryKeysJson]);

  return now;
}
