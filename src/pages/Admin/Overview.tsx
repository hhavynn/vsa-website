import { useMemo } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { FiRefreshCw, FiSearch } from '../../lib/adminIcons';
import { PageTitle } from '../../components/common/PageTitle';
import { formatAcademicYear } from '../../lib/academicTerms';
import { adminOverviewRepository } from '../../data/repos/adminOverview';
import { useOperationsSummary } from '../../hooks/useOperationsSummary';
import { summarizeHealth } from '../../lib/adminHealthAreas';
import { ADMIN_HEALTH_QUERY_KEYS, HEALTH_QUERY_OPTIONS } from '../../lib/adminHealthQuery';
import { AttentionQueue } from '../../components/features/admin/AttentionQueue';
import { ContinueWorking, OperationsDashboard } from '../../components/features/admin/OperationsDashboard';
import { RecentActivityCard } from '../../components/features/admin/RecentActivityCard';
import { useAdminSearchOpener } from '../../components/features/admin/AdminSearchContext';
import { AdminToolDirectory } from '../../components/features/admin/dashboard/AdminToolDirectory';
import { QuickActions } from '../../components/features/admin/dashboard/QuickActions';
import { SiteHealth } from '../../components/features/admin/dashboard/SiteHealth';

const isMac = () => typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

export default function AdminOverview() {
  const queryClient = useQueryClient();
  const openSearch = useAdminSearchOpener();

  // Cached for a minute and never refetched on focus/reconnect or on a timer:
  // revisiting the page reuses the numbers, and "Refresh" is the way to re-scan.
  const overview = useQuery(ADMIN_HEALTH_QUERY_KEYS.overview, () => adminOverviewRepository.load(), HEALTH_QUERY_OPTIONS);
  // Shares the operations scan with Continue working (one request); only its counts are read here.
  const operations = useOperationsSummary();
  const stats = overview.data?.stats ?? null;
  const unavailable = useMemo(() => overview.data?.unavailable ?? [], [overview.data]);
  const loading = overview.isLoading;
  const refreshing = overview.isFetching;

  function refreshHealth() {
    return queryClient.invalidateQueries(ADMIN_HEALTH_QUERY_KEYS.all);
  }

  const health = summarizeHealth({
    loading,
    failed: overview.isError,
    unavailable,
    stats,
    preflight: operations.failed ? 'failed' : operations.loading ? 'loading' : operations.issues,
  });
  // Only a reliably loaded active term gives a year worth naming in the header.
  const yearLabel = stats && !stats.activeTermUnavailable && stats.housesCurrentYearStart ? formatAcademicYear(stats.housesCurrentYearStart) : null;

  return (
    <div className="flex-1">
      <PageTitle title="Admin Dashboard" />

      <header className="border-b border-border-strong bg-surface px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex max-w-5xl flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-serif text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">VSA Admin</h1>
            <p className="mt-1.5 font-sans text-sm text-text-secondary">
              Find a tool, pick up where you left off, and see what needs you.
              {yearLabel && <span className="ml-1 font-mono text-xs text-text-muted">· {yearLabel} academic year</span>}
            </p>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <button
              type="button"
              onClick={refreshHealth}
              disabled={refreshing}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 font-sans text-xs font-semibold text-brand-600 transition-colors hover:bg-[var(--color-surface2)] disabled:opacity-60 dark:text-brand-400"
            >
              <FiRefreshCw aria-hidden className={refreshing ? 'h-3.5 w-3.5 animate-spin motion-reduce:animate-none' : 'h-3.5 w-3.5'} />
              {refreshing ? 'Refreshing…' : 'Refresh counts'}
            </button>
            {overview.dataUpdatedAt > 0 && (
              <p className="font-sans text-[11px] text-text-muted">
                Counts loaded {new Date(overview.dataUpdatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={openSearch}
          aria-label="Search admin"
          className="mt-5 flex min-h-[48px] w-full max-w-2xl items-center gap-3 rounded-lg border border-[var(--color-border)] bg-surface2 px-4 py-3 text-left font-sans text-sm text-text-secondary transition-colors hover:border-brand-600 hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:hover:border-brand-400 dark:focus-visible:outline-brand-400"
        >
          <FiSearch aria-hidden className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Search members, events, pages…</span>
          <kbd className="hidden shrink-0 font-mono text-[11px] text-text-muted sm:inline">{isMac() ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
      </header>

      <div className="max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8">
        <QuickActions />
        <AttentionQueue signals={overview.data?.attention ?? null} loading={loading} failed={overview.isError} />
        <div className="grid gap-6 lg:grid-cols-2">
          <ContinueWorking />
          <RecentActivityCard />
        </div>
        <SiteHealth
          stats={stats}
          health={health}
          unavailable={unavailable}
          failed={overview.isError}
          operationsFailed={operations.failed}
          loading={loading}
          operationsDetails={<OperationsDashboard />}
        />
        <AdminToolDirectory />
      </div>
    </div>
  );
}
