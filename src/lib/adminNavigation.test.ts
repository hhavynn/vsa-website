import fs from 'fs';
import path from 'path';
import {
  ADMIN_NAV_GROUPS,
  ADMIN_NAV_ITEMS,
  ADMIN_QUICK_ACTIONS,
  DEFAULT_ADMIN_FAVORITES,
  MAX_ADMIN_FAVORITES,
  activeAdminNavPath,
  adminBreadcrumbs,
  adminNavGroupFor,
  adminNavItemFor,
  adminNavLabelFor,
  sanitizeAdminFavorites,
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
    const unresolved = ADMIN_NAV_ITEMS.filter((item) => item.parent && !adminNavItemFor(item.parent)).map((item) => item.to);
    expect(unresolved).toEqual([]);
  });

  it('groups destinations by the job being done, in this order', () => {
    expect(ADMIN_NAV_GROUPS.map((group) => group.group)).toEqual([
      null,
      'Events & Attendance',
      'Programs & People',
      'Content & Outreach',
      'Planning & Health',
      'Settings & Feedback',
    ]);
  });

  it('keeps all 33 destinations, each in exactly one group, with unique group ids', () => {
    expect(ADMIN_NAV_ITEMS).toHaveLength(33);
    const grouped = ADMIN_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.to));
    expect(new Set(grouped).size).toBe(33);
    const ids = ADMIN_NAV_GROUPS.map((group) => group.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('places the tools where the redesign says they live', () => {
    const labels = (name: string) => ADMIN_NAV_GROUPS.find((group) => group.group === name)?.items.map((item) => item.label);
    expect(labels('Events & Attendance')).toEqual(['Events', 'Attendance Imports', 'Members', 'Points Tools', 'Merge Review', 'Photo Requests']);
    expect(labels('Programs & People')).toEqual(['Houses', 'ACE Families', 'Role Assignment', 'Intern Cohort', 'Applications', 'Cabinet', 'Cabinet Rollover']);
    expect(labels('Content & Outreach')).toEqual([
      'Homepage & Programs', 'Gallery', 'Content Calendar', 'VCN Archives', 'Resources Index', 'Ask VSA Knowledge', 'External Events', 'UVSA Schools',
    ]);
    expect(labels('Planning & Health')).toEqual(['Years & Terms', 'New Year Setup', 'Launch Checklist', 'Content Health', 'Analytics', 'Recent Changes']);
    expect(labels('Settings & Feedback')).toEqual(['Site Settings', 'Feedback', 'Ask VSA Feedback', 'Ask VSA Usage', 'Data Rights']);
  });

  it('gives every destination an icon and every group an icon', () => {
    for (const item of ADMIN_NAV_ITEMS) expect(item.icon).toBeDefined();
    for (const group of ADMIN_NAV_GROUPS) expect(group.icon).toBeDefined();
  });

  it('points every dashboard quick action at a real destination', () => {
    expect(ADMIN_QUICK_ACTIONS).toHaveLength(6);
    for (const action of ADMIN_QUICK_ACTIONS) expect(adminNavItemFor(action.to)).not.toBeNull();
  });
});

describe('activeAdminNavPath / adminNavGroupFor', () => {
  it('matches exact paths and ignores query strings and trailing slashes', () => {
    expect(activeAdminNavPath('/admin/houses')).toBe('/admin/houses');
    expect(activeAdminNavPath('/admin/houses/')).toBe('/admin/houses');
    expect(activeAdminNavPath('/admin/events?event=abc')).toBe('/admin/events');
  });

  it('prefers the most specific nav path for nested routes', () => {
    expect(activeAdminNavPath('/admin/cabinet/rollover')).toBe('/admin/cabinet/rollover');
    expect(activeAdminNavPath('/admin/events/123')).toBe('/admin/events');
    expect(activeAdminNavPath('/admin/cabinet/other')).toBe('/admin/cabinet');
  });

  it('only lights the dashboard on /admin itself', () => {
    expect(activeAdminNavPath('/admin')).toBe('/admin');
    expect(activeAdminNavPath('/admin/unknown')).toBeNull();
  });

  it('finds the group holding a path', () => {
    expect(adminNavGroupFor('/admin/import')?.group).toBe('Events & Attendance');
    expect(adminNavGroupFor('/admin/cabinet/rollover')?.group).toBe('Programs & People');
    expect(adminNavGroupFor('/admin/nope')).toBeNull();
  });
});

describe('sanitizeAdminFavorites', () => {
  it('keeps valid paths in order', () => {
    expect(sanitizeAdminFavorites(['/admin/houses', '/admin/events'])).toEqual(['/admin/houses', '/admin/events']);
  });

  it('drops unknown paths, non-strings, duplicates, and the always-visible dashboard', () => {
    expect(sanitizeAdminFavorites(['/admin/nope', 42, null, '/admin/events', '/admin/events', '/admin'])).toEqual(['/admin/events']);
  });

  it('caps the list', () => {
    const many = ADMIN_NAV_ITEMS.map((item) => item.to).filter((to) => to !== '/admin');
    expect(sanitizeAdminFavorites(many)).toHaveLength(MAX_ADMIN_FAVORITES);
  });

  it('returns null when the value is not a list, so callers use the defaults', () => {
    expect(sanitizeAdminFavorites('nope')).toBeNull();
    expect(sanitizeAdminFavorites({})).toBeNull();
    expect(sanitizeAdminFavorites(undefined)).toBeNull();
  });

  it('only defaults to real destinations', () => {
    expect(sanitizeAdminFavorites([...DEFAULT_ADMIN_FAVORITES])).toEqual([...DEFAULT_ADMIN_FAVORITES]);
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
      { label: 'Events & Attendance' },
      { label: 'Events' },
    ]);
  });

  it('puts parents between the group and the page', () => {
    expect(adminBreadcrumbs('/admin/cabinet/rollover')).toEqual([
      { label: 'Admin', to: '/admin' },
      { label: 'Programs & People' },
      { label: 'Cabinet', to: '/admin/cabinet' },
      { label: 'Cabinet Rollover' },
    ]);
  });

  it('links the page itself once a detail crumb follows it', () => {
    expect(adminBreadcrumbs('/admin/ace', 'Smith fam')).toEqual([
      { label: 'Admin', to: '/admin' },
      { label: 'Programs & People' },
      { label: 'ACE Families', to: '/admin/ace' },
      { label: 'Smith fam' },
    ]);
  });

  it('includes the group for former top-level pages and handles the dashboard', () => {
    expect(adminBreadcrumbs('/admin/recent-changes')).toEqual([
      { label: 'Admin', to: '/admin' },
      { label: 'Planning & Health' },
      { label: 'Recent Changes' },
    ]);
    expect(adminBreadcrumbs('/admin')).toEqual([{ label: 'Admin' }]);
  });

  it('degrades to the Admin root for an unknown path', () => {
    expect(adminBreadcrumbs('/admin/unknown')).toEqual([{ label: 'Admin', to: '/admin' }]);
  });
});
