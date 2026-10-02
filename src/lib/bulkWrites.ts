import { supabaseRequestGuard } from './supabaseRequestGuard';

/**
 * Wrap a legitimate sequential per-row write loop (one request per member /
 * row) so the Supabase request circuit breaker does not mistake it for a
 * runaway. Writes inside count against a bounded per-operation budget
 * (`REQUEST_GUARD_CONFIG.bulkWriteBudget`) rather than the per-minute burst
 * limit. Prefer batching into one request when the data allows it.
 */
export function runBulkWrites<T>(work: () => Promise<T>): Promise<T> {
  return supabaseRequestGuard.runBulkWrites(work);
}
