import fs from 'fs';
import path from 'path';
import {
  ADMIN_NAV_GROUPS,
  ADMIN_NAV_ITEMS,
  adminBreadcrumbs,
  adminNavItemFor,
  adminNavLabelFor,
} from './adminNavigation';

const routesSource = fs.readFileSync(path.resolve(__dirname, '../routes/index.tsx'), 'utf8');

// Admin <Route path="/admin/..."> declarations, in source order, with the
// character offset so we can check which boundary they sit inside.
function adminRoutes(): Array<{ path: string; offset: number }> {
  const found: Array<{ path: string; offset: number }> = [];
  const pattern = /<Route\s+path="(\/admin[^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(routesSource))) found.push({ path: match[1], offset: match.index });
  return found;
}

// The sign-in page lives under /admin but is deliberately outside AdminRoute.
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login']);

describe('admin navigation ↔ router parity', () => {
  const routes = adminRoutes();
  const guardStart = routesSource.indexOf('<Route element={<AdminRoute />}>');
  const guardEnd = routesSource.indexOf('{/* 404 Route */}');

  it('finds the AdminRoute boundary and the admin routes', () => {
    expect(guardStart).toBeGreaterThan(-1);
    expect(guardEnd).toBeGreaterThan(guardStart);
    expect(routes.length).toBeGreaterThan(20);
  });

  it('gives every guarded admin route a nav entry (no unreachable pages)', () => {
    const navPaths = new Set(ADMIN_NAV_ITEMS.map((item) => item.to));
    const missing = routes.map((route) => route.path).filter((p) => !PUBLIC_ADMIN_PATHS.has(p) && !navPaths.has(p));
    expect(missing).toEqual([]);
  });

  it('gives every nav entry a registered route (no dead links)', () => {
    const routePaths = new Set(routes.map((route) => route.path));
    const dead = ADMIN_NAV_ITEMS.map((item) => item.to).filter((to) => !routePaths.has(to));
    expect(dead).toEqual([]);
  });

  it('keeps every admin route inside the AdminRoute boundary (a nav entry is not a permission)', () => {
    const outside = routes
      .filter((route) => !PUBLIC_ADMIN_PATHS.has(route.path))
      .filter((route) => route.offset < guardStart || route.offset > guardEnd)
      .map((route) => route.path);
    expect(outside).toEqual([]);
  });

  it('has no duplicate destinations, and every parent resolves', () => {
    const paths = ADMIN_NAV_ITEMS.map((item) => item.to);
    expect(new Set(paths).size).toBe(paths.length);
    for (const item of ADMIN_NAV_ITEMS) {
      if (item.parent) expect(adminNavItemFor(item.parent)).not.toBeNull();
    }
  });

  it('keeps the established group names and order', () => {
    expect(ADMIN_NAV_GROUPS.map((group) => group.group)).toEqual([
      null,
      'Member Experience',
      'Content & Media',
      'Points & Attendance',
      'System',
    ]);
  });
});

describe('adminNavLabelFor / adminNavItemFor', () => {
  it('ignores query strings, hashes, and trailing slashes', () => {
    expect(adminNavLabelFor('/admin/events?tab=manage')).toBe('Events');
    expect(adminNavLabelFor('/admin/events/')).toBe('Events');
    expect(adminNavLabelFor('/admin/events#top')).toBe('Events');
  });

  it('returns null for unknown paths', () => {
    expect(adminNavLabelFor('/admin/nope')).toBeNull();
  });
});

describe('adminBreadcrumbs', () => {
  it('shows Admin › group › page for a top-level page, with only Admin linked', () => {
    expect(adminBreadcrumbs('/admin/events')).toEqual([
      { label: 'Admin', to: '/admin' },
      { label: 'Member Experience' },
      { label: 'Events' },
    ]);
  });

  it('puts parents between the group and the page', () => {
    expect(adminBreadcrumbs('/admin/cabinet/rollover')).toEqual([
      { label: 'Admin', to: '/admin' },
      { label: 'Content & Media' },
      { label: 'Cabinet', to: '/admin/cabinet' },
      { label: 'Cabinet Rollover' },
    ]);
  });

  it('links the page itself once a detail crumb follows it', () => {
    expect(adminBreadcrumbs('/admin/ace', 'Smith fam')).toEqual([
      { label: 'Admin', to: '/admin' },
      { label: 'Member Experience' },
      { label: 'ACE Families', to: '/admin/ace' },
      { label: 'Smith fam' },
    ]);
  });

  it('omits the group for ungrouped pages and handles the dashboard', () => {
    expect(adminBreadcrumbs('/admin/recent-changes')).toEqual([
      { label: 'Admin', to: '/admin' },
      { label: 'Recent Changes' },
    ]);
    expect(adminBreadcrumbs('/admin')).toEqual([{ label: 'Admin' }]);
  });

  it('degrades to the Admin root for an unknown path', () => {
    expect(adminBreadcrumbs('/admin/unknown')).toEqual([{ label: 'Admin', to: '/admin' }]);
  });
});
