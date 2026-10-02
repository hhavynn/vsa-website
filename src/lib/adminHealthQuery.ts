// Shared react-query settings for admin health / dashboard scans (Overview
// counts, Operations dashboard). These scans fan out into many Supabase
// requests, so they must never run on their own: no refetch on window focus,
// reconnect, or a timer, and no automatic retries. Staying cached for a minute
// means bouncing back to the Overview reuses the numbers; the Refresh button
// invalidates `ADMIN_HEALTH_QUERY_KEYS.all` to re-scan on demand.

export const ADMIN_HEALTH_QUERY_KEYS = {
  all: 'admin-health',
  overview: ['admin-health', 'overview'],
  operations: ['admin-health', 'operations'],
} as const;

export const HEALTH_QUERY_OPTIONS = {
  staleTime: 60 * 1000,
  cacheTime: 5 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchInterval: false,
  retry: false,
} as const;
