import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { adminActivityRepository } from '../data/repos/adminActivity';
import { undoActivity } from '../data/repos/adminUndo';
import { ActivityEntry, ActivityFilterKey, isUndoable, undoneEntryIds } from '../lib/adminActivity';

export const ADMIN_ACTIVITY_QUERY_KEY = 'admin-activity';

/** Recent admin changes, newest first. Short stale time: this is a "what just happened" view. */
export function useAdminActivity(options: { filter?: ActivityFilterKey; limit?: number; academicYearStart?: number | null } = {}) {
  const queryClient = useQueryClient();
  const { filter = 'all', limit = 50, academicYearStart = null } = options;
  const query = useQuery<ActivityEntry[]>({
    queryKey: [ADMIN_ACTIVITY_QUERY_KEY, filter, limit, academicYearStart],
    queryFn: () => adminActivityRepository.list({ filter, limit, academicYearStart }),
    staleTime: 15 * 1000,
    refetchOnMount: 'always',
  });
  const entries = useMemo(() => query.data ?? [], [query.data]);
  // Undo entries sit next to the originals they point at, in the same window.
  const undone = useMemo(() => undoneEntryIds(entries), [entries]);
  const canUndo = useCallback((entry: ActivityEntry) => isUndoable(entry, { undoneIds: undone }), [undone]);

  const undo = useMutation(
    async (entry: ActivityEntry) => {
      const result = await undoActivity(entry, { undoneIds: undone });
      if (!result.ok) throw new Error(result.reason);
    },
    {
      onSuccess: () => {
        toast.success('Change undone.');
        void queryClient.invalidateQueries(ADMIN_ACTIVITY_QUERY_KEY);
        // The edited rows live in other pages' caches.
        void queryClient.invalidateQueries();
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Could not undo.');
      },
    },
  );

  return { entries, loading: query.isLoading, error: query.isError, undone, canUndo, undo: undo.mutate, undoing: undo.isLoading };
}
