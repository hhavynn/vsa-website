import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { ReviewEntityType, adminReviewRepository } from '../data/repos/adminReview';

/**
 * "Reviewed" marks for a set of draft rows. Advisory only (never gates lock or
 * publish). If the table is not available yet the marks simply read as empty
 * and marking says so, instead of breaking the page.
 */
export function useReviewMarks(entityType: ReviewEntityType, scopeId: string | null, ids: readonly string[], academicYearStart: number | null) {
  const queryClient = useQueryClient();
  const key = useMemo(() => ['admin-review-marks', entityType, scopeId, ids.length] as const, [entityType, scopeId, ids.length]);
  const query = useQuery<Set<string>>({
    queryKey: key,
    queryFn: () => adminReviewRepository.listReviewed(entityType, ids),
    enabled: !!scopeId && ids.length > 0,
    staleTime: 10 * 1000,
    retry: false,
  });
  const reviewed = useMemo(() => query.data ?? new Set<string>(), [query.data]);

  const refresh = useCallback(() => queryClient.invalidateQueries(['admin-review-marks', entityType]), [queryClient, entityType]);
  const mark = useMutation(
    (targets: readonly string[]) => adminReviewRepository.mark(entityType, targets, academicYearStart),
    {
      onSuccess: refresh,
      onError: () => {
        toast.error('Could not save reviewed marks. They may not be available yet.');
      },
    },
  );
  const unmark = useMutation((targets: readonly string[]) => adminReviewRepository.unmark(entityType, targets), { onSuccess: refresh });

  return { reviewed, markReviewed: mark.mutateAsync, clearReviewed: unmark.mutateAsync, marking: mark.isLoading };
}
