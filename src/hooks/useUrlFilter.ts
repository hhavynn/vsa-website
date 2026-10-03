import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ALL_FILTER_KEY, readFilterParam, withParam } from '../lib/adminFilters';

/**
 * A quick-filter choice kept in the URL (`?filter=unlinked`), so a refresh or
 * Back keeps the admin's place. Other params (view, year, cycle…) are kept.
 * Replaces history entries so filtering never fills the Back stack.
 *
 * `defaultKey` is the filter shown when the URL has none ("all" unless a page
 * opens on a queue, like pending photo requests); choosing it removes the param.
 * The URL is the source of truth, so Back/Forward and Admin Overview deep links
 * always land on the filter in the address bar.
 */
export function useUrlFilter(allowed: readonly string[], name = 'filter', defaultKey = ALL_FILTER_KEY) {
  const [params, setParams] = useSearchParams();
  const active = readFilterParam(params, name, allowed, defaultKey);
  const setActive = useCallback(
    (key: string) => setParams((current) => withParam(current, name, key, defaultKey), { replace: true }),
    [name, defaultKey, setParams],
  );
  return [active, setActive] as const;
}

/** A free-form URL param (year, search text) with the same replace behavior. */
export function useUrlParam(name: string) {
  const [params, setParams] = useSearchParams();
  const value = params.get(name);
  const set = useCallback(
    (next: string | null) => setParams((current) => withParam(current, name, next, ''), { replace: true }),
    [name, setParams],
  );
  return [value, set] as const;
}
