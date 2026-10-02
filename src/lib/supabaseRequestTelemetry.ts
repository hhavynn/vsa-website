// Development-only counter of Supabase requests made by this tab, so a runaway
// loop is obvious while building rather than after deploy.
//
// It is in-memory only: nothing is sent anywhere, nothing is persisted, and
// only a coarse label (the table / function name, never a query string, header
// or token) is ever recorded. In production builds `process.env.NODE_ENV` is
// not 'development', so every method is a no-op and no console handle exists.
//
// In the browser console while running `npm start`:
//   __vsaSupabaseRequests()        // prints and returns the summary
//   __vsaSupabaseRequests.reset()

export interface RequestPathCount {
  path: string;
  count: number;
}

export interface RequestSummary {
  total: number;
  topPaths: RequestPathCount[];
}

export interface RequestTelemetry {
  enabled: boolean;
  record: (url: string) => void;
  summary: (limit?: number) => RequestSummary;
  format: (limit?: number) => string;
  reset: () => void;
}

/** `/rest/v1/events?select=*` -> `events`; other services keep a short prefix (`auth/token`). */
export function labelRequestPath(url: string): string {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return 'unknown';
  }
  const parts = pathname.split('/').filter(Boolean);
  const [service, version, first, second] = parts;
  if (service === 'rest' && version === 'v1') {
    if (first === 'rpc' && second) return `rpc/${second}`;
    return first ?? 'rest';
  }
  if (version === 'v1' && first) {
    return service === 'storage' && second ? `storage/${first}` : `${service}/${first}`;
  }
  return parts.slice(0, 2).join('/') || 'unknown';
}

export function createRequestTelemetry(enabled: boolean): RequestTelemetry {
  const counts = new Map<string, number>();
  let total = 0;

  function summary(limit = 10): RequestSummary {
    const topPaths: RequestPathCount[] = [];
    counts.forEach((count, path) => topPaths.push({ path, count }));
    topPaths.sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
    return { total, topPaths: topPaths.slice(0, limit) };
  }

  return {
    enabled,
    record(url) {
      if (!enabled) return;
      const label = labelRequestPath(url);
      counts.set(label, (counts.get(label) ?? 0) + 1);
      total += 1;
    },
    summary,
    format(limit = 10) {
      const { total: all, topPaths } = summary(limit);
      return [`Supabase requests this session: ${all}`, 'Top paths:', ...topPaths.map(({ path, count }) => `${path}: ${count}`)].join('\n');
    },
    reset() {
      counts.clear();
      total = 0;
    },
  };
}

export const supabaseRequestTelemetry = createRequestTelemetry(process.env.NODE_ENV === 'development');

// Tested against `process.env.NODE_ENV` directly (not `.enabled`) so the bundler
// replaces it with a constant and drops this block from production builds.
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  const inspect = () => {
    console.info(supabaseRequestTelemetry.format());
    return supabaseRequestTelemetry.summary();
  };
  inspect.reset = () => supabaseRequestTelemetry.reset();
  (window as unknown as { __vsaSupabaseRequests: typeof inspect }).__vsaSupabaseRequests = inspect;
}
