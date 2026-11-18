import { focusManager, MutationCache, onlineManager, QueryCache, QueryClient } from '@tanstack/react-query';

// TanStack Query v4 and v5 changed several defaults from the react-query v3
// behavior this app was built and load-tested against. Everything below keeps
// the v3 behavior on purpose; drop an item only as its own reviewed change.

class AppQueryClient extends QueryClient {
  // An invalidation joins a fetch that is already running. The v5 default
  // cancels and resends it, and repos ignore the abort signal, so repeated
  // invalidations would become repeated identical GETs and could trip the
  // per-tab request guard in lib/supabaseRequestGuard.ts. An observer's
  // refetch() has the same default, so call sites pass cancelRefetch: false.
  invalidateQueries(...[filters, options]: Parameters<QueryClient['invalidateQueries']>) {
    return super.invalidateQueries(filters, { cancelRefetch: false, ...options });
  }
}

const logFailure = (error: unknown) => console.error(error);

export function createQueryClient() {
  return new AppQueryClient({
    // Failed requests stay visible in the browser console; v5 no longer logs them.
    queryCache: new QueryCache({ onError: logFailure }),
    mutationCache: new MutationCache({ onError: logFailure }),
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000, // 5 minutes default
        gcTime: 10 * 60 * 1000,
        // Retries never pause for navigator.onLine. A paused query is neither
        // loading nor failed, so a page can read it as settled and empty; an
        // error reaches degraded mode instead.
        networkMode: 'always',
        // Render on every result change rather than only for properties read
        // during render.
        notifyOnChangeProps: 'all',
      },
      mutations: {
        networkMode: 'offlineFirst',
      },
    },
  });
}

// v5 listens to visibilitychange only and refetches while offline; the admin
// status check relies on the window focus event, and only when online.
export function listenForWindowFocus() {
  focusManager.setEventListener((handleFocus) => {
    const listener = () => {
      if (onlineManager.isOnline()) handleFocus();
    };
    window.addEventListener('visibilitychange', listener, false);
    window.addEventListener('focus', listener, false);
    return () => {
      window.removeEventListener('visibilitychange', listener);
      window.removeEventListener('focus', listener);
    };
  });
}
