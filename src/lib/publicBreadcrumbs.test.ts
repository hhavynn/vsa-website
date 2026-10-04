import { buildPublicBreadcrumbs, type Crumb } from './publicBreadcrumbs';

const labels = (crumbs: Crumb[]) => crumbs.map((crumb) => crumb.label);
const links = (crumbs: Crumb[]) => crumbs.map((crumb) => crumb.to);

describe('buildPublicBreadcrumbs: where hierarchy exists', () => {
  it('draws no trail for flat top-level pages, the home page, or the House alias', () => {
    for (const path of ['/', '/events', '/gallery', '/leaderboard', '/house', '/vcn', '/house-system', '/points']) {
      expect(buildPublicBreadcrumbs(path)).toEqual([]);
    }
  });

  it('draws no trail for unknown or admin paths (it never invents a crumb)', () => {
    expect(buildPublicBreadcrumbs('/vcn/2019')).toEqual([]);
    expect(buildPublicBreadcrumbs('/nope/nothing')).toEqual([]);
    expect(buildPublicBreadcrumbs('/admin/members')).toEqual([]);
  });

  it('builds VCN current and archive trails from route metadata, with the page last and unlinked', () => {
    const current = buildPublicBreadcrumbs('/vcn/current');
    expect(labels(current)).toEqual(['Home', 'VCN', 'This year’s show']);
    expect(links(current)).toEqual(['/', '/vcn', undefined]);

    const archive = buildPublicBreadcrumbs('/vcn/archive');
    expect(labels(archive)).toEqual(['Home', 'VCN', 'Archive']);
    expect(links(archive)).toEqual(['/', '/vcn', undefined]);
  });

  it('keeps archive and current unmistakably different for VCN', () => {
    expect(labels(buildPublicBreadcrumbs('/vcn/current')).at(-1)).not.toBe(labels(buildPublicBreadcrumbs('/vcn/archive')).at(-1));
  });

  it('builds the House archive index trail', () => {
    const trail = buildPublicBreadcrumbs('/house/archive');
    expect(labels(trail)).toEqual(['Home', 'House', 'Archive']);
    expect(links(trail)).toEqual(['/', '/house', undefined]);
  });

  it('ignores case and a trailing slash, like the router', () => {
    expect(labels(buildPublicBreadcrumbs('/VCN/Archive/'))).toEqual(['Home', 'VCN', 'Archive']);
  });
});

describe('buildPublicBreadcrumbs: House years', () => {
  const ctx = { currentYear: 2025 };

  it('puts a past year under "Archive", with the year formatted from the slug', () => {
    const trail = buildPublicBreadcrumbs('/house/year/2023-2024', ctx);
    expect(labels(trail)).toEqual(['Home', 'House', 'Archive', '2023–24']);
    expect(links(trail)).toEqual(['/', '/house', '/house/archive', undefined]);
  });

  it('treats /house/archive/<year> the same as /house/year/<year>', () => {
    expect(labels(buildPublicBreadcrumbs('/house/archive/2023-2024', ctx))).toEqual(labels(buildPublicBreadcrumbs('/house/year/2023-2024', ctx)));
  });

  it('accepts a bare start-year slug', () => {
    expect(labels(buildPublicBreadcrumbs('/house/year/2024', ctx))).toEqual(['Home', 'House', 'Archive', '2024–25']);
  });

  it('decides archive vs current from the year, not the URL prefix', () => {
    const trail = buildPublicBreadcrumbs('/house/archive/2025-2026', ctx);
    expect(labels(trail)).toEqual(['Home', 'House', '2025–26']);
    expect(trail.at(-1)?.badge).toBe('Current');
    expect(labels(trail)).not.toContain('Archive');
  });

  it('marks the live year Current and a future year with no archive claim', () => {
    expect(buildPublicBreadcrumbs('/house/year/2025-2026', ctx).at(-1)?.badge).toBe('Current');
    const future = buildPublicBreadcrumbs('/house/year/2026-2027', ctx);
    expect(labels(future)).toEqual(['Home', 'House', '2026–27']);
    expect(future.at(-1)?.badge).toBeUndefined();
  });

  it('adds the House under its year, linking the year to its overview and not the page itself', () => {
    const trail = buildPublicBreadcrumbs('/house/year/2023-2024/dragon', { ...ctx, houseLabel: 'Dragon' });
    expect(labels(trail)).toEqual(['Home', 'House', 'Archive', '2023–24', 'Dragon']);
    expect(links(trail)).toEqual(['/', '/house', '/house/archive', '/house/year/2023-2024', undefined]);
  });

  it('uses the page-supplied House name, else a title-cased slug', () => {
    expect(labels(buildPublicBreadcrumbs('/house/archive/2023-2024/ca-phe-sua-da', ctx)).at(-1)).toBe('Ca Phe Sua Da');
    expect(labels(buildPublicBreadcrumbs('/house/archive/2023-2024/ca-phe-sua-da', { ...ctx, houseLabel: 'Cà Phê' })).at(-1)).toBe('Cà Phê');
  });

  it('shows a current House (no year in the URL) directly under House', () => {
    const trail = buildPublicBreadcrumbs('/house/dragon', { houseLabel: 'Dragon' });
    expect(labels(trail)).toEqual(['Home', 'House', 'Dragon']);
    expect(links(trail)).toEqual(['/', '/house', undefined]);
  });

  it('draws no trail for an invalid year or a malformed House path', () => {
    expect(buildPublicBreadcrumbs('/house/year/not-a-year', ctx)).toEqual([]);
    expect(buildPublicBreadcrumbs('/house/year', ctx)).toEqual([]);
    expect(buildPublicBreadcrumbs('/house/year/2024-2025/a/b', ctx)).toEqual([]);
  });

  it('is display-only: it never changes the year it is given', () => {
    // The slug's end year is not trusted or rewritten; only the start year is read, as the House pages do.
    expect(labels(buildPublicBreadcrumbs('/house/year/2024-2030', ctx)).at(-1)).toBe('2024–25');
  });

  it('falls back to the calendar when the page cannot supply the current year', () => {
    expect(buildPublicBreadcrumbs('/house/year/2001-2002').map((crumb) => crumb.label)).toContain('Archive');
  });
});
