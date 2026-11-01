import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageTitle } from '../../components/common/PageTitle';
import { aiUsageRepository, type AiUsageDay, type ReportDays } from '../../data/repos/aiUsage';
export type { AiUsageDay } from '../../data/repos/aiUsage';

export function summarizeAiUsage(days: AiUsageDay[]) {
  const totals = { answered: 0, fallback: 0, rate_limited: 0, errors: 0, other: 0 };
  for (const row of days) {
    for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
      const value = row[key];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) totals[key] += value;
    }
  }
  return { ...totals, requests: Object.values(totals).reduce((total, count) => total + count, 0) };
}

/**
 * Ratio of logged outcome counts only. Zero recorded attempts do not imply a
 * 0% rate; there is no valid denominator, so return null to show N/A.
 */
export function loggedOutcomePercent(outcome: number, requests: number): string | null {
  if (!Number.isSafeInteger(outcome) || outcome < 0 || !Number.isSafeInteger(requests) || requests <= 0 || outcome > requests) {
    return null;
  }
  return `${((outcome / requests) * 100).toFixed(1)}%`;
}

export default function AdminAiUsage() {
  const [period, setPeriod] = useState<ReportDays>(30);
  const { data: rows = [], isLoading: loading, isError: error } = useQuery({
    queryKey: ['admin-ai-usage', period],
    queryFn: () => aiUsageRepository.getDaily(period),
    retry: false,
    staleTime: 2 * 60 * 1000,
  });
  const totals = useMemo(() => summarizeAiUsage(rows), [rows]);

  return (
    <div className="flex-1">
      <PageTitle title="Ask VSA Usage" />
      <div className="vsa-admin-field vsa-ribbon-bottom border-[var(--color-border)] border-b px-5 py-6 sm:px-8 sm:py-7">
        <h1 className="font-display text-[2rem] font-normal leading-[1.05] tracking-[-0.02em] text-text-primary sm:text-[2.6rem]">Ask VSA Usage</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          Privacy-safe daily request counts from the existing Ask VSA usage ledger. Only administrators can request this report.
          No messages, session identifiers, IP hashes or individual activity are returned.
        </p>
        <label htmlFor="ai-usage-period" className="mt-4 inline-flex items-center gap-3 text-sm text-text-secondary">
          Reporting period
          <select
            id="ai-usage-period"
            value={period}
            onChange={(event) => setPeriod(Number(event.target.value) as ReportDays)}
            className="rounded-md border border-[var(--color-border)] bg-surface px-3 py-2 text-text-primary"
          >
            <option value={7}>Last 7 calendar days</option>
            <option value={30}>Last 30 calendar days</option>
            <option value={90}>Last 90 calendar days</option>
          </select>
        </label>
      </div>
      <div className="max-w-5xl space-y-6 p-4 sm:p-8">
        {loading ? (
          <p role="status" className="text-sm text-text-secondary">Loading daily counts…</p>
        ) : error ? (
          <div role="alert" className="rounded-md border border-[var(--color-border)] p-5">
            <p className="text-sm text-text-primary">Usage report unavailable.</p>
            <p className="mt-2 text-xs text-text-secondary">
              The admin-only reporting migration may not be applied yet, or the request could not be completed.
              No raw usage logs will be loaded as a fallback.
            </p>
          </div>
        ) : (
          <>
            <section aria-label="Ask VSA request totals" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {([
                ['Requests', totals.requests],
                ['Answered', totals.answered],
                ['Fallback', totals.fallback],
                ['Rate-limited', totals.rate_limited],
                ['Errors', totals.errors],
              ] as const).map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[var(--color-border)] bg-surface p-4">
                  <h2 className="text-xs font-semibold text-text-secondary">{label}</h2>
                  <p className="mt-2 font-serif text-3xl text-text-primary">{value.toLocaleString()}</p>
                </div>
              ))}
            </section>
            <section aria-labelledby="ai-usage-outcome-share" className="space-y-3">
              <h2 id="ai-usage-outcome-share" className="font-serif text-xl text-text-primary">Share of recorded attempts</h2>
              <p className="text-xs leading-relaxed text-text-secondary">
                These shares use the {totals.requests.toLocaleString()} logged attempt{totals.requests === 1 ? '' : 's'} in this period,
                including fallback and unknown outcomes in the denominator. They are not percentages of students or of billable model calls.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {([
                  ['Rate-limited', totals.rate_limited, 'Requests rejected by a recorded rate limit.'],
                  ['Errors', totals.errors, 'Requests recorded as an error.'],
                  ['Answered', totals.answered, 'Requests recorded as answered, not necessarily helpful.'],
                ] as const).map(([label, count, hint]) => (
                  <div key={label} className="rounded-lg border border-[var(--color-border)] bg-surface p-4">
                    <h3 className="font-sans text-xs font-semibold text-text-secondary">{label}</h3>
                    <p className="mt-1 font-serif text-2xl tabular-nums text-text-primary">
                      {loggedOutcomePercent(count, totals.requests) ?? 'N/A'}
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {count.toLocaleString()} of {totals.requests.toLocaleString()} logged attempts
                    </p>
                    <p className="mt-2 text-xs text-text-muted">{hint}</p>
                  </div>
                ))}
              </div>
              {totals.rate_limited > 0 && (
                <p className="text-sm text-text-secondary">
                  Recorded rate-limit rejections warrant checking when students encounter limits before considering any quota change.
                  This report cannot identify who was affected or prove a 5-per-session limit was the cause.
                </p>
              )}
              {totals.errors > 0 && (
                <p className="text-sm text-text-secondary">
                  Recorded errors warrant an operations review; the aggregate does not include diagnostic traces or root causes.
                </p>
              )}
            </section>
            <p className="text-xs leading-relaxed text-text-secondary">
              Rate-limited and error shares are directional only. Some older log rows have unknown status ({totals.other} unknown)
              and are included in Requests. These are logged attempts, not unique students; unsuccessful quota reservations
              may have no completed log entry. No new tracking or raw usage-log access was added.
            </p>
            <section aria-labelledby="ai-usage-by-day">
              <h2 id="ai-usage-by-day" className="mb-3 font-serif text-xl text-text-primary">Daily breakdown</h2>
              {rows.length === 0 ? (
                <p className="rounded-md border border-[var(--color-border)] p-5 text-sm text-text-secondary">
                  No recorded Ask VSA attempts in this period.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="bg-surface2 text-text-primary">
                      <tr>
                        {['Pacific day', 'Answered', 'Fallback', 'Rate-limited', 'Errors', 'Other'].map(label => (
                          <th key={label} scope="col" className="px-3 py-3 font-semibold">{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(row => (
                        <tr key={row.day} className="border-t border-[var(--color-border)] text-text-secondary">
                          <th scope="row" className="px-3 py-3 font-medium">{row.day}</th>
                          {[row.answered, row.fallback, row.rate_limited, row.errors, row.other].map((count, index) => (
                            <td key={index} className="px-3 py-3 tabular-nums">{count}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
        <section className="rounded-md border border-[var(--color-border)] p-5" aria-labelledby="ai-usage-cost">
          <h2 id="ai-usage-cost" className="font-serif text-xl text-text-primary">Estimated AI spend</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Not available from existing data. The current usage ledger does not record provider input/output tokens,
            so assigning dollars per request would invent precision. Check the provider billing dashboard for actual costs.
            This page does not alter rate limits or trigger any additional model calls.
          </p>
        </section>
      </div>
    </div>
  );
}
