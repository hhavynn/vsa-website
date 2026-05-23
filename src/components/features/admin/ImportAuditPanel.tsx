import { useEffect, useMemo, useState } from 'react';
import { ImportJobWithEvent } from '../../../data/repos/importJobs';
import { ImportRowDecision } from '../../../types/database';
import { useImportJobRows, useRecentImportJobs } from '../../../hooks/useImportJobs';

function formatDateTime(value: string | null): string {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatEventDate(value?: string): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function jobLabel(job: ImportJobWithEvent): string {
  return job.event?.name ?? 'Unknown event';
}

function decisionLabel(decision: ImportRowDecision): string {
  const labels: Record<ImportRowDecision, string> = {
    matched: 'Matched',
    created: 'Created',
    skipped_duplicate: 'Skipped',
    review: 'Review',
    error: 'Error',
  };
  return labels[decision];
}

function decisionClass(decision: ImportRowDecision): string {
  const classes: Record<ImportRowDecision, string> = {
    matched: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    created: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    skipped_duplicate: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
    review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };
  return classes[decision];
}

function statusClass(status: ImportJobWithEvent['status']): string {
  return status === 'completed'
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
}

export function ImportAuditPanel() {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const { data: jobs = [], isLoading, error } = useRecentImportJobs();
  const selectedJob = useMemo(
    () => jobs.find(job => job.id === selectedJobId) ?? jobs[0] ?? null,
    [jobs, selectedJobId]
  );
  const { data: rows = [], isLoading: rowsLoading } = useImportJobRows(selectedJob?.id ?? null);

  useEffect(() => {
    if (!selectedJobId && jobs[0]) {
      setSelectedJobId(jobs[0].id);
    }
  }, [jobs, selectedJobId]);

  return (
    <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
      <>
      <div className="border-b border-[var(--color-border)] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-sans text-base font-semibold tracking-[-0.01em] text-[var(--color-text)]">
              Recent Imports
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text2)]">
              Completed and failed attendance imports recorded for admins.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--color-surface2)] px-2.5 py-1 text-xs font-medium text-[var(--color-text3)]">
            Audit only
          </span>
        </div>
      </div>

      {isLoading && (
        <div className="px-5 py-8 text-sm text-[var(--color-text3)]">Loading recent imports...</div>
      )}

      {error && (
        <div className="px-5 py-4 text-sm text-red-600 dark:text-red-300">
          Unable to load import audit records.
        </div>
      )}

      {!isLoading && !error && jobs.length === 0 && (
        <div className="px-5 py-8 text-sm text-[var(--color-text3)]">
          No import audit records yet. New imports will appear here after completion.
        </div>
      )}

      {jobs.length > 0 && (
        <div className="grid gap-0 lg:grid-cols-[minmax(260px,340px)_1fr]">
          <div className="border-b border-[var(--color-border)] lg:border-b-0 lg:border-r">
            <div className="max-h-[420px] overflow-y-auto p-2">
              {jobs.map(job => {
                const active = selectedJob?.id === job.id;
                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => setSelectedJobId(job.id)}
                    className={`w-full rounded px-3 py-3 text-left transition-colors ${
                      active ? 'bg-[var(--color-surface2)]' : 'hover:bg-[var(--color-surface2)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[var(--color-text)]">
                          {jobLabel(job)}
                        </div>
                        <div className="mt-1 text-xs text-[var(--color-text3)]">
                          {formatDateTime(job.completed_at ?? job.created_at)}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${statusClass(job.status)}`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <Metric label="Rows" value={job.total_rows} />
                      <Metric label="New" value={job.created_members} />
                      <Metric label="Skip" value={job.skipped_duplicate_rows} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 p-5">
            {selectedJob && (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text)]">{jobLabel(selectedJob)}</h3>
                    <p className="mt-1 text-xs text-[var(--color-text3)]">
                      {formatEventDate(selectedJob.event?.date)}
                      {selectedJob.source_type !== 'unknown' ? ` · ${selectedJob.source_type.replace(/_/g, ' ')}` : ''}
                    </p>
                  </div>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusClass(selectedJob.status)}`}>
                    {selectedJob.status}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <DetailMetric label="Rows" value={selectedJob.total_rows} />
                  <DetailMetric label="Matched" value={selectedJob.matched_rows} />
                  <DetailMetric label="Created" value={selectedJob.created_members} />
                  <DetailMetric label="Attendance" value={selectedJob.created_attendance_count} />
                  <DetailMetric label="Skipped" value={selectedJob.skipped_duplicate_rows} />
                  <DetailMetric label="Review" value={selectedJob.review_rows} />
                  <DetailMetric label="Errors" value={selectedJob.error_count} />
                  <DetailMetric label="Completed" value={formatDateTime(selectedJob.completed_at)} />
                </div>

                {selectedJob.error_message && (
                  <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                    {selectedJob.error_message}
                  </div>
                )}

                <div className="mt-5 overflow-hidden rounded-md border border-[var(--color-border)]">
                  <div className="border-b border-[var(--color-border)] bg-[var(--color-surface2)] px-3 py-2 text-xs font-semibold uppercase tracking-label text-[var(--color-text3)]">
                    Row decisions
                  </div>
                  <div className="max-h-[360px] overflow-auto">
                    {rowsLoading ? (
                      <div className="px-3 py-6 text-sm text-[var(--color-text3)]">Loading rows...</div>
                    ) : rows.length === 0 ? (
                      <div className="px-3 py-6 text-sm text-[var(--color-text3)]">No row details recorded.</div>
                    ) : (
                      <table className="min-w-full divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                        <thead className="bg-[var(--color-surface)]">
                          <tr>
                            {['Row', 'Name', 'Decision', 'Points', 'Match'].map(header => (
                              <th key={header} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-label text-[var(--color-text3)]">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {rows.map(row => (
                            <tr key={row.id}>
                              <td className="whitespace-nowrap px-3 py-2 text-xs text-[var(--color-text3)]">
                                {row.source_row_index + 1}
                              </td>
                              <td className="min-w-[180px] px-3 py-2">
                                <div className="font-medium text-[var(--color-text)]">{row.display_name || 'Unnamed row'}</div>
                                <div className="mt-0.5 text-xs text-[var(--color-text3)]">{row.csv_email || row.csv_college || 'No contact details'}</div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${decisionClass(row.decision)}`}>
                                  {decisionLabel(row.decision)}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-xs text-[var(--color-text2)]">
                                {row.points_earned ?? '-'}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-xs text-[var(--color-text2)]">
                                {row.score !== null ? `${row.score}%` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      </>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-mono text-sm font-semibold text-[var(--color-text)]">{value}</div>
      <div className="text-[10px] uppercase tracking-label text-[var(--color-text3)]">{label}</div>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 py-2">
      <div className="text-sm font-semibold text-[var(--color-text)]">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-label text-[var(--color-text3)]">{label}</div>
    </div>
  );
}
