import { MutationCache, QueryCache, QueryClient } from 'react-query';
import { handleRequestError } from './sessionExpiry';

/**
 * The app's react-query client. Defaults are unchanged from when this lived in
 * App.tsx; the caches additionally report every failed query and mutation to
 * the session-expiry handler so an expired JWT is noticed wherever it happens
 * instead of in each page.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: handleRequestError }),
    mutationCache: new MutationCache({ onError: handleRequestError }),
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000, // 5 minutes default
        cacheTime: 10 * 60 * 1000,
      },
    },
  });
}
