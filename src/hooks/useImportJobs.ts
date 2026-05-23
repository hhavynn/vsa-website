import { useQuery } from 'react-query';
import { importJobsRepository } from '../data/repos/importJobs';

export function useRecentImportJobs(limit = 8) {
  return useQuery({
    queryKey: ['import-jobs', 'recent', limit],
    queryFn: () => importJobsRepository.getRecentJobs(limit),
    staleTime: 30 * 1000,
  });
}

export function useImportJobRows(importJobId: string | null) {
  return useQuery({
    queryKey: ['import-jobs', importJobId, 'rows'],
    queryFn: () => importJobId ? importJobsRepository.getJobRows(importJobId) : Promise.resolve([]),
    enabled: !!importJobId,
    staleTime: 30 * 1000,
  });
}
