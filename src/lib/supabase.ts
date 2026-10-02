import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database';
import { createRequestGuard } from './supabaseRequestGuard';
import { supabaseRequestTelemetry } from './supabaseRequestTelemetry';

// Singleton pattern for Supabase client
let supabaseClient: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseClient) {
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    // Per-tab circuit breaker for Data API (/rest/v1) calls. See supabaseRequestGuard.ts.
    // Request telemetry is wired in development only; production keeps just the breaker.
    const isDevelopment = process.env.NODE_ENV === 'development';
    const requestGuard = createRequestGuard({
      onRequest: isDevelopment ? ({ url }) => supabaseRequestTelemetry.record(url) : undefined,
      onTrip: isDevelopment ? () => console.info(supabaseRequestTelemetry.format()) : undefined,
    });

    supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      // supabase-js retries idempotent PostgREST reads (GET/HEAD) on transient
      // failures by default. During an outage or loop that silently multiplies
      // traffic, so prefer one failed request and normal UI error handling.
      // This is PostgREST only; Auth token refresh has its own logic.
      db: {
        retry: false,
      },
      global: {
        fetch: requestGuard.fetch,
      },
    });
  }

  return supabaseClient;
}

// Export the client for direct usage when needed
export const supabase = getSupabaseClient();
