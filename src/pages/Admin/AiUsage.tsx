import { useEffect, useMemo, useState } from 'react';
import { PageTitle } from '../../components/common/PageTitle';
import { supabase } from '../../lib/supabase';

/** This is the ENTIRE response contract: no identifiers, messages, or source IDs. */
export interface AiUsageDay {
  day: string;
  answered: number;
  fallback: number;
  rate_limited: number;
  errors: number;
  other: number;
}

type ReportDays = 7 | 30 | 90;
type ReportResult = {
  data: AiUsageDay[] | null;
  error: { message: string } | null;
};

// Keep the generated Database type immutable until the migration has been
// applied and types are regenerated from a verified staging schema.
type UsageReportClient = {
  rpc: (name: 'admin_ai_usage_daily', args: { p_days: ReportDays }) => PromiseLike<ReportResult>;
};

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

export default function AdminAiUsage() {
  const [period, setPeriod] = useState<ReportDays>(30);
  const [rows, setRows] = useState<AiUsageDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const totals = useMemo(() => summarizeAiUsage(rows), [rows]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setRows([]);
    const client = supabase as unknown as UsageReportClient;
    Promise.resolve(client.rpc('admin_ai_usage_daily', { p_days: period }))
      .then(({ data, error: readError }) => {
        if (!active) return;
        if (readError || !Array.isArray(data)) {
          setError(true);
          return;
        }
        setRows(data);
      })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period]);

  return (
    <div className="flex-1">
      <PageTitle title="Ask VSA Usage" />
      <div className="border-b border-[var(--color-border)] bg-surface px-4 py-6 sm:px-8">
        <h1 className="font-serif text-3xl font-bold text-text-primary">Ask VSA Usage</h1>
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
            <p className="text-xs leading-relaxed text-text-secondary">
              Rate-limited counts help identify whether the current 5-per-session daily limit may be affecting students.
              Some older log rows have unknown status and are included in Requests but not the named outcome cards ({totals.other} unknown).
              These are logged attempts, not unique students; unsuccessful quota reservations may not have a completed log entry.
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
