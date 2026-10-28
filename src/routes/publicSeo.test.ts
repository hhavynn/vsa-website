import { PUBLIC_ROUTE_DECISIONS } from './publicRouteInventory';
import { getSitemapPaths, getSharePreviewPages, makeSitemapXml, renderSharePreviewHtml } from './publicSeo';

describe('public sitemap and share previews (#573)', () => {
  it('lists canonical static public pages but not lookup, admin, aliases or dynamic routes', () => {
    const paths = getSitemapPaths();

    expect(paths).toContain('/');
    expect(paths).toContain('/events');
    expect(paths).toContain('/house/archive');
    expect(paths).not.toContain('/points');
    expect(paths).not.toContain('/feedback');
    expect(paths).not.toContain('/admin/login');
    expect(paths).not.toContain('/house-system');
    expect(paths).not.toContain('/signin');
    expect(paths).not.toContain('/house/:houseSlug');
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.every((path) => Object.hasOwnProperty.call(PUBLIC_ROUTE_DECISIONS, path))).toBe(true);
  });

  it('writes absolute HTTPS canonical URLs and no sensitive routes into XML', () => {
    const xml = makeSitemapXml();

    expect(xml).toContain('<loc>https://www.vsaatucsd.com/</loc>');
    expect(xml).toContain('<loc>https://www.vsaatucsd.com/events</loc>');
    expect(xml).not.toContain('/points');
    expect(xml).not.toContain('/feedback');
    expect(xml).not.toContain('/admin');
    expect(xml).not.toContain(':yearSlug');
  });

  it('provides unique nonempty descriptions and titles for top-level previews', () => {
    const previews = getSharePreviewPages();

    expect(previews.map((page) => page.path)).toEqual(getSitemapPaths());
    expect(previews.map((page) => page.path)).toEqual(expect.arrayContaining([
      '/events', '/calendar', '/leaderboard', '/cabinet', '/gallery', '/get-involved', '/house', '/vcn',
    ]));
    expect(new Set(previews.map((page) => page.title)).size).toBe(previews.length);
    expect(new Set(previews.map((page) => page.description)).size).toBe(previews.length);
    expect(previews.every((page) => page.title.length > 5 && page.description.length > 30)).toBe(true);
    expect(previews.every((page) => getSitemapPaths().includes(page.path))).toBe(true);
  });

  it('does not advertise confidential live House standings in share previews (#692)', () => {
    const leaderboard = getSharePreviewPages().find((page) => page.path === '/leaderboard');
    expect(leaderboard?.description).toMatch(/House standings are announced at general body meetings/i);
    expect(leaderboard?.description).not.toMatch(/see member rankings and House standings/i);
    expect(PUBLIC_ROUTE_DECISIONS['/leaderboard'].description).toMatch(/announcements/i);
  });

  it('sets static metadata in the initial HTML for a direct social preview fetch', () => {
    const template = '<html><head><title>VSA at UCSD</title><meta name="vsa-seo-start" content="1"/><meta name="description" content="generic"/><meta name="vsa-seo-end" content="1"/></head><body><div id="root"></div></body></html>';
    const view = renderSharePreviewHtml(template, {
      path: '/events',
      title: 'Events | VSA at UCSD',
      description: 'Find upcoming VSA events, gatherings, and activities at UC San Diego.',
    });

    expect(view).toContain('<title>Events | VSA at UCSD</title>');
    expect(view).toContain('name="description" content="Find upcoming VSA events');
    expect(view).toContain('property="og:title" content="Events | VSA at UCSD"');
    expect(view).toContain('property="og:url" content="https://www.vsaatucsd.com/events"');
    expect(view).toContain('name="twitter:description" content="Find upcoming VSA events');
    expect(view).toContain('rel="canonical" href="https://www.vsaatucsd.com/events"');
    expect(view).toContain('<div id="root"></div>');
    expect(view).not.toContain('content="generic"');
  });
});
