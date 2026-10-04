// The admin destinations, shared by the sidebar nav, the quick-search, and the
// page-header breadcrumbs so a page added here shows up in all three. Pure data.
//
// A nav entry is NOT a permission: access is the <AdminRoute> boundary in
// src/routes/index.tsx plus RLS. adminNavigation.test.ts asserts that every
// route registered there has an entry here (and vice versa), so a page cannot
// silently become unreachable or unlabelled.

export interface AdminNavItem {
  to: string;
  label: string;
  /** Extra words quick-search should match, e.g. "big little" for ACE. */
  keywords?: readonly string[];
  /** Path of the page this one sits under, for breadcrumbs (e.g. rollover → cabinet). */
  parent?: string;
  /** One line under the page title when the page does not supply its own. */
  description?: string;
}

export interface AdminNavGroup {
  group: string | null;
  items: readonly AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: readonly AdminNavGroup[] = [
  {
    group: null,
    items: [
      { to: '/admin', label: 'Dashboard', keywords: ['overview', 'home', 'operations', 'continue'] },
      { to: '/admin/recent-changes', label: 'Recent Changes', keywords: ['activity', 'history', 'log', 'undo', 'audit'] },
      { to: '/admin/content-calendar', label: 'Content Calendar' },
      {
        to: '/admin/content-health',
        label: 'Content Health',
        keywords: ['broken', 'dead link', 'stale', 'images', 'issues', 'maintenance', 'needs attention', 'drafts'],
      },
    ],
  },
  {
    group: 'Member Experience',
    items: [
      { to: '/admin/events', label: 'Events', keywords: ['gbm', 'mixer', 'check-in', 'duplicate'] },
      { to: '/admin/applications', label: 'Applications', keywords: ['forms', 'windows'] },
      { to: '/admin/houses', label: 'Houses', keywords: ['house assignment', 'reveal', 'toad', 'boo'] },
      { to: '/admin/ace', label: 'ACE Families', keywords: ['big', 'little', 'assignments', 'lineage', 'fam'] },
      { to: '/admin/interns', label: 'Intern Cohort', keywords: ['internship', 'mentor'] },
      { to: '/admin/uvsa-schools', label: 'UVSA Schools' },
      { to: '/admin/external-events', label: 'External Events' },
    ],
  },
  {
    group: 'Content & Media',
    items: [
      { to: '/admin/content', label: 'Homepage & Programs' },
      { to: '/admin/cabinet', label: 'Cabinet', keywords: ['board', 'officers', 'positions'] },
      { to: '/admin/cabinet/rollover', label: 'Cabinet Rollover', parent: '/admin/cabinet', keywords: ['new cabinet', 'roster'] },
      { to: '/admin/gallery', label: 'Gallery' },
      { to: '/admin/vcn', label: 'VCN Archives' },
      { to: '/admin/ai-knowledge', label: 'Ask VSA Knowledge' },
      { to: '/admin/resources', label: 'Resources Index' },
      { to: '/admin/settings', label: 'Site Settings' },
    ],
  },
  {
    group: 'Points & Attendance',
    items: [
      { to: '/admin/import', label: 'Attendance Imports', keywords: ['upload', 'csv', 'spreadsheet'] },
      { to: '/admin/members', label: 'Members', keywords: ['people', 'roster'] },
      { to: '/admin/photo-requests', label: 'Photo Requests' },
      { to: '/admin/points', label: 'Points Tools' },
      { to: '/admin/merge-suggestions', label: 'Merge Review', keywords: ['duplicates', 'merge'] },
      { to: '/admin/years', label: 'Years & Terms', keywords: ['academic year', 'quarter'] },
      { to: '/admin/year-setup', label: 'New Year Setup', keywords: ['rollover', 'prepare year'] },
    ],
  },
  {
    group: 'System',
    items: [
      { to: '/admin/data-rights', label: 'Data Rights' },
      { to: '/admin/launch-checklist', label: 'Launch Checklist' },
      { to: '/admin/analytics', label: 'Analytics' },
      { to: '/admin/feedback', label: 'Feedback' },
      { to: '/admin/ai-feedback', label: 'Ask VSA Feedback' },
    ],
  },
];

function basePath(path: string): string {
  return path.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/admin';
}

/** Every admin destination, flattened in nav order. */
export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((group) => group.items);

export function adminNavItemFor(path: string): AdminNavItem | null {
  const base = basePath(path);
  return ADMIN_NAV_ITEMS.find((entry) => entry.to === base) ?? null;
}

export function adminNavLabelFor(path: string): string | null {
  return adminNavItemFor(path)?.label ?? null;
}

export interface AdminCrumb {
  label: string;
  /** Omitted for the current page and for group labels, which are not pages. */
  to?: string;
}

/**
 * Breadcrumb trail for an admin path, derived from the nav config: Admin ›
 * group › parent pages › this page › optional `detail` (a specific House, fam,
 * or event). Unknown paths return just the Admin root so a new route without a
 * nav entry degrades to a plain header instead of throwing.
 */
export function adminBreadcrumbs(path: string, detail?: string | null): AdminCrumb[] {
  const item = adminNavItemFor(path);
  const trail: AdminCrumb[] = [{ label: 'Admin', to: '/admin' }];
  if (!item) return trail;
  if (item.to === '/admin') return detail ? [trail[0], { label: detail }] : [{ label: 'Admin' }];
  const group = ADMIN_NAV_GROUPS.find((entry) => entry.items.includes(item))?.group;
  if (group) trail.push({ label: group });
  // Walk parents (guarding against a cycle in the config).
  const parents: AdminNavItem[] = [];
  const seen = new Set<string>([item.to]);
  let parent = item.parent ? adminNavItemFor(item.parent) : null;
  while (parent && !seen.has(parent.to)) {
    parents.unshift(parent);
    seen.add(parent.to);
    parent = parent.parent ? adminNavItemFor(parent.parent) : null;
  }
  for (const entry of parents) trail.push({ label: entry.label, to: entry.to });
  trail.push(detail ? { label: item.label, to: item.to } : { label: item.label });
  if (detail) trail.push({ label: detail });
  return trail;
}
