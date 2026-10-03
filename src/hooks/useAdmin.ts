// NOT a security boundary. This hook controls what renders in the browser (UX gate).
// Real enforcement is Postgres RLS on the underlying tables — see docs/auth-model.md.
// Never rely on this hook alone to protect sensitive data or API access.
import { useQuery } from 'react-query';
import { authRepository } from '../data/repos/auth';
import { useAuth } from './useAuth';

// Admin status almost never changes, so one lookup is shared by every consumer
// (the admin route guard, the user menu, the sign-in page) instead of one per
// mount. The window below bounds how long a demoted admin keeps seeing the
// admin shell in an already-open tab; it re-checks on tab focus after that.
// RLS already denies their data in the meantime.
const ADMIN_STATUS_STALE_MS = 10 * 60 * 1000;

/**
 * Keyed by user id, never by the `user` object. supabase-js re-emits SIGNED_IN
 * with a fresh object on every tab refocus, and keying on that identity made
 * the admin shell flash its loader and remount (losing unsaved form state)
 * each time. A different id is a different cache entry, so one user's
 * `isAdmin: true` can never be read as another's.
 */
export const adminStatusQuery = (userId: string) => ({
  queryKey: ['admin-status', userId] as const,
  queryFn: () => authRepository.isUserAdmin(userId),
});

export function useAdmin() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const { data, isLoading } = useQuery({
    ...adminStatusQuery(userId ?? ''),
    enabled: userId !== null,
    staleTime: ADMIN_STATUS_STALE_MS,
    cacheTime: ADMIN_STATUS_STALE_MS,
    refetchOnWindowFocus: true,
    // Failing closed needs no retry, and a retry loop during an outage only
    // adds traffic (see the db.retry note in lib/supabase.ts).
    retry: false,
    onError: (error) => {
      console.error('Error checking admin status:', error);
    },
  });

  return {
    // Fail closed: only an explicit `true` for the signed-in user counts. No
    // user, a failed first lookup, and a lookup still in flight are all
    // `false`. A failed background re-check keeps the last verified answer
    // instead of ejecting an admin mid-edit over a network blip; RLS is what
    // actually stops a demoted admin, and the next successful check corrects
    // the UI.
    isAdmin: userId !== null && data === true,
    // Only a signed-in user waits on a lookup, so AdminRoute never spins for an
    // anonymous visitor and never shows content before the answer arrives.
    loading: userId !== null && isLoading,
  };
}
