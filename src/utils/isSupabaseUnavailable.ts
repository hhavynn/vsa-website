/**
 * Detects whether a caught error likely indicates a Supabase outage,
 * bandwidth/egress quota exhaustion, or temporary service degradation.
 *
 * Returns true for network failures, HTTP 429/402/503, and known quota
 * error message fragments. Returns false for ordinary data errors (404,
 * empty results, validation failures) that do not indicate an outage.
 */
export function isSupabaseUnavailable(error: unknown): boolean {
  if (!error) return false;

  const err = error as Record<string, unknown>;

  // HTTP status codes that indicate quota or service unavailability
  const status =
    typeof err.status === 'number'
      ? err.status
      : typeof err.statusCode === 'number'
        ? err.statusCode
        : null;

  if (status === 429 || status === 402 || status === 503 || status === 504) {
    return true;
  }

  // Network-level failures (fetch failed, CORS blocked, no response)
  if (err instanceof TypeError) return true;

  const message =
    typeof err.message === 'string' ? err.message.toLowerCase() : '';
  const code =
    typeof err.code === 'string' ? err.code.toLowerCase() : '';

  const unavailableSignals = [
    'fetch failed',
    'failed to fetch',
    'network error',
    'networkerror',
    'quota',
    'egress',
    'bandwidth',
    'over_request_rate_limit',
    'service unavailable',
    'gateway timeout',
    'connection refused',
    'err_network',
    'err_internet_disconnected',
  ];

  for (const signal of unavailableSignals) {
    if (message.includes(signal) || code.includes(signal)) return true;
  }

  return false;
}
