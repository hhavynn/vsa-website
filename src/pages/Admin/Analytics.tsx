import { useEffect, useState } from 'react';
import { PageTitle } from '../../components/common/PageTitle';
import { supabase } from '../../lib/supabase';
import { buildCabinetAnalyticsCsv, buildCabinetAreaInsights } from '../../lib/cabinetAnalyticsInsights';

interface AnalyticsData {
  summary: {
    users: number;
    sessions: number;
    pageViews: number;
    newUsers: number;
  };
  trend: Array<{
    date: string;
    users: number;
    pageViews: number;
  }>;
  topPages: Array<{
    path: string;
    views: number;
  }>;
}

type AnalyticsErrorBody = {
  error?: string;
  message?: string;
  code?: string;
};

function isAnalyticsData(value: unknown): value is AnalyticsData {
  const candidate = value as AnalyticsData;

  return Boolean(
    candidate &&
    typeof candidate === 'object' &&
    candidate.summary &&
    typeof candidate.summary.users === 'number' &&
    typeof candidate.summary.sessions === 'number' &&
    typeof candidate.summary.pageViews === 'number' &&
    typeof candidate.summary.newUsers === 'number' &&
    Array.isArray(candidate.trend) &&
    Array.isArray(candidate.topPages)
  );
}

async function getAnalyticsErrorMessage(error: any): Promise<string> {
  const response = error?.context;

  if (response instanceof Response) {
    if (response.status === 404) {
      return 'Analytics Edge Function is not deployed or unreachable';
    }

    try {
      const body = await response.clone().json() as AnalyticsErrorBody;
      const message = body.error || body.message;

      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    } catch {
      // Fall back to Supabase's error message below.
    }
  }

  if (typeof error?.message === 'string') {
    if (error.message.includes('Failed to send a request')) {
      return 'Analytics Edge Function is not deployed or unreachable';
    }

    if (error.message === 'Edge Function returned a non-2xx status code') {
      return 'Analytics Edge Function returned an error. Check Supabase function logs.';
    }

    return error.message;
  }

  return 'Failed to load analytics data.';
}

function StatCard({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <div className="scrapbook-note flex flex-col justify-center px-4 py-4 sm:px-5">
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>
        {label}
      </p>
      <p className="font-serif text-[32px] leading-none" style={{ color: 'var(--color-text)' }}>
        {value}
      </p>
      <p className="mt-3 font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
        {detail}
      </p>
    </div>
  );
}

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30daysAgo');

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      setError(null);
      try {
        const { data: result, error: fetchError } = await supabase.functions.invoke('analytics-proxy', {
          body: { startDate: dateRange, endDate: 'today' }
        });

        if (fetchError) {
          console.error('Edge Function Error:', fetchError);
          throw new Error(await getAnalyticsErrorMessage(fetchError));
        }

        if (!isAnalyticsData(result)) {
          throw new Error('Unexpected analytics response format');
        }

        setData(result);
      } catch (err: any) {
        console.error('Analytics Request Failed:', err);
        setError(err.message || 'Failed to load analytics data.');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [dateRange]);

  const maxTrendValue = data ? Math.max(...data.trend.map(d => d.pageViews), 1) : 1;
  const areaInsights = data ? buildCabinetAreaInsights(data) : [];

  function exportCabinetSummary() {
    if (!data) return;
    const csv = buildCabinetAnalyticsCsv(data, dateRange);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vsa-cabinet-analytics-' + dateRange + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Website Analytics" />

      <div className="border-b px-6 py-6 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-8 sm:py-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="mb-4 sm:mb-0">
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>
            Analytics
          </h1>
          <p className="mt-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
            Website traffic and engagement metrics from Google Analytics 4.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="analytics-date-range">Analytics time range</label>
        <select
          id="analytics-date-range"
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="text-xs border rounded px-2 py-1 bg-transparent font-sans"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
        >
          <option value="7daysAgo">Last 7 Days</option>
          <option value="30daysAgo">Last 30 Days</option>
          <option value="90daysAgo">Last 90 Days</option>
        </select>
        <button
          type="button"
          onClick={exportCabinetSummary}
          disabled={loading || !data}
          className="rounded-md border border-[var(--color-border)] px-3 py-2 font-sans text-xs font-semibold text-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-300"
        >
          Export cabinet summary (CSV)
        </button>
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--color-text3)' }}>
            Loading analytics data...
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-sm text-red-500 mb-2">{error}</p>
            <p className="text-xs" style={{ color: 'var(--color-text3)' }}>
              Make sure the GA4 credentials are configured in Supabase.
            </p>
          </div>
        ) : data ? (
          <div className="space-y-8">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total Users" value={data.summary.users} detail="Unique users who visited." />
              <StatCard label="New Users" value={data.summary.newUsers} detail="Users who visited for the first time." />
              <StatCard label="Sessions" value={data.summary.sessions} detail="Total number of visits." />
              <StatCard label="Page Views" value={data.summary.pageViews} detail="Total pages viewed." />
            </div>

            <section aria-labelledby="cabinet-analytics-questions" className="rounded-md border p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              <h2 id="cabinet-analytics-questions" className="font-serif text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
                What are visitors looking at?
              </h2>
              <p className="mt-2 max-w-3xl font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                Visits to these public areas, summed only from the top-page list returned by GA4. Pages not in that list are not counted here; the categories are not a complete breakdown of traffic.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {areaInsights.map((area) => (
                  <div key={area.key} className="rounded border border-[var(--color-border)] bg-[var(--color-surface2)] p-4">
                    <h3 className="font-sans text-xs font-semibold" style={{ color: 'var(--color-text2)' }}>{area.label}</h3>
                    <p className="mt-2 font-serif text-2xl" style={{ color: 'var(--color-text)' }}>{area.views.toLocaleString()}</p>
                    <p className="mt-1 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>Views in listed top pages</p>
                  </div>
                ))}
              </div>
              <h3 className="mt-5 font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>What can we conclude?</h3>
              <p className="mt-1 font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                These numbers show directional interest among consenting visitors, not total VSA participation.
                We cannot calculate application conversions, on-site search failures, event attendance, admin adoption or mobile-versus-desktop usage from this response.
                Declined analytics consent is never overridden. Compare date ranges cautiously because different windows can contain different campaigns and event schedules.
              </p>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-md border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
                  <h2 className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Traffic Trend (Page Views)
                  </h2>
                </div>
                <div className="p-5 h-[200px] flex items-end gap-1">
                  {data.trend.map((d, i) => (
                    <div 
                      key={i} 
                      className="flex-1 bg-brand-500 dark:bg-brand-600 rounded-t-sm transition-all group relative"
                      style={{ height: `${(d.pageViews / maxTrendValue) * 100}%` }}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                        {d.date}: {d.pageViews} views
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-5 pb-4 flex justify-between text-[10px]" style={{ color: 'var(--color-text3)' }}>
                  <span>{data.trend[0]?.date}</span>
                  <span>{data.trend[Math.floor(data.trend.length / 2)]?.date}</span>
                  <span>{data.trend[data.trend.length - 1]?.date}</span>
                </div>
              </div>

              <div className="rounded-md border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
                  <h2 className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Top Pages
                  </h2>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {data.topPages.map((page) => (
                    <div key={page.path} className="px-5 py-3 flex justify-between items-center">
                      <span className="text-xs truncate mr-4 font-sans" style={{ color: 'var(--color-text2)' }} title={page.path}>
                        {page.path}
                      </span>
                      <span className="text-xs font-medium font-sans" style={{ color: 'var(--color-text)' }}>
                        {page.views.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
