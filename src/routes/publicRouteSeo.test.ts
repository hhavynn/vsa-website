/**
 * The public route manifest is the source of truth for the sitemap and for every
 * route's share metadata (#573). These checks stop a private, administrative,
 * parameterized or duplicated route from slipping into it, and keep it in step
 * with the discoverability inventory and public/robots.txt.
 */
import fs from 'fs';
import path from 'path';

import {
  INDEXABLE_PUBLIC_PATHS,
  NON_INDEXABLE_PUBLIC_PATHS,
  PUBLIC_ROUTE_SEO,
  findPublicRouteSeo,
  isNonIndexablePublicPath,
} from './publicRouteSeo';
import { PUBLIC_ROUTE_DECISIONS } from './publicRouteInventory';

const robots = fs.readFileSync(path.resolve(process.cwd(), 'public/robots.txt'), 'utf8');

const PRIVATE_PREFIXES = ['/admin', '/profile', '/points', '/feedback'];

describe('public route manifest', () => {
  it('lists only canonical, parameter-free paths', () => {
    PUBLIC_ROUTE_SEO.forEach((route) => {
      expect(route.path.startsWith('/')).toBe(true);
      expect(route.path).not.toMatch(/[:*?]/);
      expect(route.path === '/' || !route.path.endsWith('/')).toBe(true);
      expect(route.path).toBe(route.path.toLowerCase());
    });
  });

  it('lists every route once', () => {
    const paths = PUBLIC_ROUTE_SEO.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('never lists a private, administrative or non-indexable path', () => {
    PUBLIC_ROUTE_SEO.forEach((route) => {
      PRIVATE_PREFIXES.forEach((prefix) => {
        expect(route.path === prefix || route.path.startsWith(`${prefix}/`)).toBe(false);
      });
      expect(isNonIndexablePublicPath(route.path)).toBe(false);
    });
  });

  it('does not advertise unpublished House standings in static SEO previews (#692)', () => {
    for (const path of ['/leaderboard', '/house']) {
      const route = findPublicRouteSeo(path);
      expect(route?.description).toMatch(/House standings.*announced at general body meetings/i);
      expect(route?.description).not.toMatch(/see how.*Houses rank|live House rankings/i);
    }
  });

  it('gives every route a unique title and description', () => {
    const titles = PUBLIC_ROUTE_SEO.map((route) => route.title);
    const descriptions = PUBLIC_ROUTE_SEO.map((route) => route.description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);

    PUBLIC_ROUTE_SEO.forEach((route) => {
      expect(route.title.trim().length).toBeGreaterThan(0);
      expect(route.description.trim().length).toBeGreaterThan(40);
      expect(route.description.length).toBeLessThanOrEqual(200);
    });
  });

  it('only lists routes the router actually serves', () => {
    PUBLIC_ROUTE_SEO.forEach((route) => {
      expect(Object.keys(PUBLIC_ROUTE_DECISIONS)).toContain(route.path);
    });
  });

  it('covers every public route that is meant to be indexable', () => {
    const indexablePlacements = new Set(['primary-nav', 'dock', 'footer', 'contextual']);
    const disqualifyingPlacements = new Set(['alias', 'redirect', 'deep-link', 'unlinked']);

    Object.entries(PUBLIC_ROUTE_DECISIONS).forEach(([routePath, decision]) => {
      const isIndexable =
        decision.placements.some((placement) => indexablePlacements.has(placement)) &&
        !decision.placements.some((placement) => disqualifyingPlacements.has(placement));
      if (!isIndexable) return;

      const listed = INDEXABLE_PUBLIC_PATHS.includes(routePath);
      const explicitlyExcluded = (NON_INDEXABLE_PUBLIC_PATHS as readonly string[]).includes(
        routePath
      );

      expect({
        routePath,
        inManifestOrExcluded: listed || explicitlyExcluded,
      }).toEqual({ routePath, inManifestOrExcluded: true });
    });
  });

  it('finds a route by its exact path only', () => {
    expect(findPublicRouteSeo('/events')?.path).toBe('/events');
    expect(findPublicRouteSeo('/events/extra')).toBeNull();
    expect(findPublicRouteSeo('/admin')).toBeNull();
  });
});

describe('non-indexable public paths', () => {
  it('covers the paths robots.txt disallows', () => {
    const disallowed = Array.from(robots.matchAll(/^Disallow:\s*(\S+)/gm)).map((match) => match[1]);
    expect(disallowed.length).toBeGreaterThan(0);
    disallowed.forEach((path) => {
      expect((NON_INDEXABLE_PUBLIC_PATHS as readonly string[]).includes(path)).toBe(true);
    });
  });

  it('points robots.txt at the generated sitemap', () => {
    expect(robots).toContain('Sitemap: https://www.vsaatucsd.com/sitemap.xml');
  });

  it('matches a path and its children, but not a sibling with the same prefix', () => {
    expect(isNonIndexablePublicPath('/admin')).toBe(true);
    expect(isNonIndexablePublicPath('/admin/members')).toBe(true);
    expect(isNonIndexablePublicPath('/points')).toBe(true);
    expect(isNonIndexablePublicPath('/feedback')).toBe(true);
    expect(isNonIndexablePublicPath('/points-explainer')).toBe(false);
    expect(isNonIndexablePublicPath('/events')).toBe(false);
  });
});
