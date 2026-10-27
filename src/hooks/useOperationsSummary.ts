import { useMemo } from 'react';
import { useQuery } from 'react-query';
import { adminOperationsRepository } from '../data/repos/adminOperations';
import {
  OperationsInputs,
  OperationsSummary,
  buildOperationsPreflight,
  buildOperationsSummary,
  countPreflightIssues,
} from '../lib/adminOperations';
import { ADMIN_HEALTH_QUERY_KEYS, HEALTH_QUERY_OPTIONS } from '../lib/adminHealthQuery';

/**
 * The cross-program operations scan behind "Continue working" and the health
 * section's operations details. Every caller shares one react-query entry
 * (ADMIN_HEALTH_QUERY_KEYS.operations), so mounting several of them on the
 * dashboard still costs a single scan, and the dashboard's Refresh button
 * re-runs it for all of them. Cached and never auto-refetched; see
 * lib/adminHealthQuery.ts.
 */
export function useOperationsSummary(loadInputs: () => Promise<OperationsInputs> = () => adminOperationsRepository.loadInputs()) {
  const query = useQuery(ADMIN_HEALTH_QUERY_KEYS.operations, loadInputs, {
    ...HEALTH_QUERY_OPTIONS,
    onError: (error) => console.error(error),
  });
  const inputs = query.data ?? null;
  const summary: OperationsSummary | null = useMemo(() => (inputs ? buildOperationsSummary(inputs) : null), [inputs]);
  const preflight = useMemo(() => (summary ? buildOperationsPreflight(summary) : []), [summary]);
  return {
    summary,
    preflight,
    issues: countPreflightIssues(preflight),
    loading: !summary && !query.isError,
    failed: query.isError,
  };
}
