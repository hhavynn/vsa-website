// The admin sidebar's destinations, shared by the nav and the quick-search so a
// page added here shows up in both. Pure data.

export interface AdminNavItem {
  to: string;
  label: string;
  /** Extra words quick-search should match, e.g. "big little" for ACE. */
  keywords?: readonly string[];
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
      { to: '/admin/cabinet/rollover', label: 'Cabinet Rollover', keywords: ['new cabinet', 'roster'] },
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

export function adminNavLabelFor(path: string): string | null {
  const base = path.split('?')[0].replace(/\/+$/, '') || '/admin';
  for (const group of ADMIN_NAV_GROUPS) {
    const item = group.items.find((entry) => entry.to === base);
    if (item) return item.label;
  }
  return null;
}
