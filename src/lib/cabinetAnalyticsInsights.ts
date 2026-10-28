/**
 * Cabinet-oriented questions answerable from the existing, consent-gated GA4
 * proxy. Its `topPages` list is a truncated ranking, not all site traffic:
 * these are directional counts, never conversions or complete audience shares.
 *
 * Never export raw GA paths (which might contain a query string or a private
 * identifier). This allowlist groups known public routes into safe labels.
 */
export interface CabinetTrafficSnapshot {
  summary: { users: number; sessions: number; pageViews: number; newUsers: number };
  trend: Array<{ date: string; users: number; pageViews: number }>;
  topPages: Array<{ path: string; views: number }>;
}

export const CABINET_PAGE_AREAS = [
  { key: 'events', label: 'Events and calendar', routes: ['/events', '/calendar'] },
  { key: 'tools', label: 'Points and leaderboard', routes: ['/points', '/leaderboard'] },
  { key: 'programs', label: 'Program discovery', routes: ['/get-involved', '/intern', '/vcn', '/wild-n-culture', '/uvsa-network'] },
  { key: 'memories', label: 'Gallery and memories', routes: ['/gallery'] },
] as const;

export interface CabinetAreaInsight {
  key: string;
  label: string;
  views: number;
}

function validCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function normalizePublicPath(raw: string): string | null {
  if (!raw || !raw.trim()) return null;
  try {
    const url = new URL(raw, 'https://vsaatucsd.com');
    if (url.origin !== 'https://vsaatucsd.com') return null;
    const path = url.pathname.replace(/\/+$/, '').toLowerCase() || '/';
    if (!/^\/[a-z0-9/_-]*$/.test(path)) return null;
    // The report must never turn dynamic individual routes or admin URLs into
    // downloadable labels. Only the exact known public route roots are useful.
    return path;
  } catch {
    return null;
  }
}

export function buildCabinetAreaInsights(snapshot: CabinetTrafficSnapshot): CabinetAreaInsight[] {
  const totals = new Map<string, number>(
    CABINET_PAGE_AREAS.map(({ key }) => [key, 0])
  );
  for (const page of snapshot.topPages) {
    const path = normalizePublicPath(page.path);
    if (!path) continue;
    const area = CABINET_PAGE_AREAS.find(({ routes }) =>
      routes.some((route) => path === route || path.startsWith(`${route}/`))
    );
    if (area) totals.set(area.key, (totals.get(area.key) ?? 0) + validCount(page.views));
  }

  return CABINET_PAGE_AREAS.map(({ key, label }) => ({
    key,
    label,
    views: totals.get(key) ?? 0,
  }));
}

/** Only predefined labels and validated aggregate numbers leave the browser. */
export function buildCabinetAnalyticsCsv(snapshot: CabinetTrafficSnapshot, periodLabel: string): string {
  const rows: Array<[string, string, number]> = [
    ['Summary', 'Users (consented GA4 sample)', validCount(snapshot.summary.users)],
    ['Summary', 'New users (consented GA4 sample)', validCount(snapshot.summary.newUsers)],
    ['Summary', 'Sessions (consented GA4 sample)', validCount(snapshot.summary.sessions)],
    ['Summary', 'Page views (consented GA4 sample)', validCount(snapshot.summary.pageViews)],
    ...buildCabinetAreaInsights(snapshot).map((area): [string, string, number] =>
      ['Listed top pages only', area.label, area.views]
    ),
  ];
  const safePeriod = ['7daysAgo', '30daysAgo', '90daysAgo'].includes(periodLabel) ? periodLabel : 'unknown';
  return [
    'period,scope,metric,value',
    ...rows.map(([scope, metric, value]) => `${safePeriod},${scope},${metric},${value}`),
  ].join('\r\n') + '\r\n';
}
