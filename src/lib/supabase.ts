import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database';
import { supabaseRequestGuard } from './supabaseRequestGuard';
import { createSessionExpiryFetch, refreshOrEndSession } from './sessionExpiry';

// Singleton pattern for Supabase client
let supabaseClient: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseClient) {
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

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
      // Per-tab circuit breaker for Data API (/rest/v1) calls (see
      // supabaseRequestGuard.ts), wrapped so a server-side "JWT expired" on any
      // request triggers one refresh (see sessionExpiry.ts).
      global: {
        fetch: createSessionExpiryFetch({
          fetch: supabaseRequestGuard.fetch,
          refresh: async () => {
            if (supabaseClient) await refreshOrEndSession(supabaseClient);
          },
        }),
      },
    });
  }

  return supabaseClient;
}

// Export the client for direct usage when needed
export const supabase = getSupabaseClient();
