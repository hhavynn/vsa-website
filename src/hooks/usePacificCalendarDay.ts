import { useEffect, useState } from 'react';
import { getLosAngelesDateOnly } from '../utils/losAngelesDate';

/**
 * Keep a long-open public calendar aligned with San Diego's local date.
 * The clock tick changes no server data by itself; consumers' date-scoped
 * query keys determine whether fresh public results are needed.
 */
export function usePacificCalendarDay(): string {
  const [today, setToday] = useState(() => getLosAngelesDateOnly());

  useEffect(() => {
    const refresh = () => {
      const current = getLosAngelesDateOnly();
      setToday((previous) => previous === current ? previous : current);
    };
    const interval = window.setInterval(refresh, 60_000);
    // Hidden tabs may throttle timers past midnight. Refresh immediately
    // when a visitor returns, without polling the network.
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return today;
}
