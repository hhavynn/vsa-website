import { useEffect, useState } from 'react';
import { PageTitle } from '../../components/common/PageTitle';
import { supabase } from '../../lib/supabase';

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

function StatCard({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <div className="rounded-md border px-5 py-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
        {label}
      </p>
      <p className="font-serif text-[34px] leading-none" style={{ color: 'var(--color-text)' }}>
        {value}
      </p>
      <p className="mt-2 text-xs" style={{ color: 'var(--color-text2)' }}>
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
        console.log('Fetching analytics from analytics-proxy...');
        const { data: result, error: fetchError } = await supabase.functions.invoke('analytics-proxy', {
          body: { startDate: dateRange, endDate: 'today' }
        });

        if (fetchError) {
          console.error('Edge Function Error:', fetchError);
          throw fetchError;
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

  return (
    <>
      <PageTitle title="Website Analytics" />

      <div className="border-b flex items-center justify-between" style={{ padding: '20px 28px 16px', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div>
          <h1 className="font-sans text-base font-semibold tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>
            Analytics
          </h1>
          <p className="mt-0.5 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
            Website traffic and engagement metrics from Google Analytics 4.
          </p>
        </div>
        
        <select 
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="text-xs border rounded px-2 py-1 bg-transparent font-sans"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
        >
          <option value="7daysAgo">Last 7 Days</option>
          <option value="30daysAgo">Last 30 Days</option>
          <option value="90daysAgo">Last 90 Days</option>
        </select>
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
    </>
  );
}
