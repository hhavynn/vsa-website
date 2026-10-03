/* eslint-disable testing-library/no-node-access -- reads source files, not the DOM */
import fs from 'fs';
import path from 'path';
import {
  DOCK_ITEMS,
  EXPLORE_LINKS,
  GET_INVOLVED,
  QUICK_LINKS,
} from '../components/layout/navigation/navConfig';
import { FOOTER_GROUPS, FOOTER_LEGAL_LINKS } from '../components/layout/navigation/footerLinks';
import { PUBLIC_ROUTE_DECISIONS } from './publicRouteInventory';

const repoRoot = path.resolve(__dirname, '..', '..');
const read = (relative: string) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const routesSource = read('src/routes/index.tsx');

// Static public route paths declared in the router (admin tree and 404 excluded).
const publicRoutePaths = Array.from(routesSource.matchAll(/path="([^"]+)"/g))
  .map((match) => match[1])
  .filter(
    (routePath) =>
      routePath !== '*' &&
      routePath !== '/admin' &&
      // The admin tree is gated by AdminRoute; the sign-in page itself is public.
      (routePath === '/admin/login' || !routePath.startsWith('/admin/')),
  );

const primaryNavPaths = new Set(
  [...QUICK_LINKS, ...GET_INVOLVED, ...EXPLORE_LINKS].map((link) => link.path),
);
const dockPaths = new Set(DOCK_ITEMS.map((link) => link.path));
const footerPaths = new Set(
  [...FOOTER_GROUPS.flatMap((group) => group.links), ...FOOTER_LEGAL_LINKS].map((link) => link.to),
);

describe('public route discoverability', () => {
  it('has a recorded decision for every public route (and no stale ones)', () => {
    const decided = Object.keys(PUBLIC_ROUTE_DECISIONS).sort();
    expect(Array.from(new Set(publicRoutePaths)).sort()).toEqual(decided);
  });

  it.each(Object.entries(PUBLIC_ROUTE_DECISIONS))('%s: recorded placements are real', (routePath, decision) => {
    const has = (placement: string) => decision.placements.includes(placement as never);
    const problems: string[] = [];

    // '/' is the logo link rather than a nav list entry.
    if (has('primary-nav') && routePath !== '/' && !primaryNavPaths.has(routePath)) {
      problems.push('not in primary nav');
    }
    if (has('dock') && !dockPaths.has(routePath)) problems.push('not in the dock');
    if (has('footer') && !footerPaths.has(routePath)) problems.push('not in the footer');
    if (has('contextual')) {
      const sources = decision.linkedFrom ?? [];
      if (sources.length === 0) problems.push('contextual without linkedFrom');
      if (!sources.some((file) => read(file).includes(routePath))) {
        problems.push('no listed source file links to it');
      }
    }

    expect(problems).toEqual([]);
  });

  it('keeps legal/help pages out of primary navigation and the mobile dock', () => {
    for (const legal of ['/privacy', '/feedback', '/house/archive', '/vcn/current', '/vcn/archive']) {
      expect(primaryNavPaths.has(legal)).toBe(false);
      expect(dockPaths.has(legal)).toBe(false);
    }
  });

  it('leaves the mobile dock at its four deliberate slots', () => {
    expect(DOCK_ITEMS).toHaveLength(4);
  });

  it('does not recreate a standalone /points-explainer route', () => {
    expect(routesSource).not.toContain('points-explainer');
    expect(routesSource).not.toContain('PublicPointsExplainer');
  });

  it('never surfaces admin routes in public navigation or the footer', () => {
    const everyPublicLink = [
      ...Array.from(primaryNavPaths),
      ...Array.from(dockPaths),
      ...Array.from(footerPaths),
    ];
    expect(everyPublicLink.filter((link) => link.startsWith('/admin'))).toEqual([]);
  });

  it('keeps the how-points-work anchor on both pages that embed the explainer', () => {
    expect(read('src/pages/Points.tsx')).toContain('POINTS_HELP_ANCHOR');
    expect(read('src/pages/Leaderboard.tsx')).toContain('id={POINTS_HELP_ANCHOR}');
  });
});
