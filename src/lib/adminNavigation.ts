// The admin destinations, shared by the sidebar nav, the quick-search, the
// dashboard (quick actions + tool directory), and the page-header breadcrumbs so
// a page added here shows up in all four. Static data: no network, no state.
//
// A nav entry is NOT a permission: access is the <AdminRoute> boundary in
// src/routes/index.tsx plus RLS. adminNavigation.test.ts asserts that every
// route registered there has an entry here (and vice versa), so a page cannot
// silently become unreachable or unlabelled.
import {
  FiActivity,
  FiAward,
  FiBarChart2,
  FiBriefcase,
  FiCalendar,
  FiCamera,
  FiCheckSquare,
  FiClock,
  FiEdit3,
  FiExternalLink,
  FiFileText,
  FiFilm,
  FiFolder,
  FiGitMerge,
  FiGrid,
  FiHeart,
  FiHome,
  FiImage,
  FiList,
  FiMapPin,
  FiMessageCircle,
  FiMessageSquare,
  FiPlayCircle,
  FiRepeat,
  FiRotateCcw,
  FiSettings,
  FiShield,
  FiThumbsUp,
  FiUpload,
  FiUserCheck,
  FiUsers,
  type AdminIcon,
} from './adminIcons';

export interface AdminNavItem {
  to: string;
  label: string;
  /** Extra words quick-search should match, e.g. "big little" for ACE. */
  keywords?: readonly string[];
  /** Path of the page this one sits under, for breadcrumbs (e.g. rollover → cabinet). */
  parent?: string;
  /** One line under the page title when the page does not supply its own. */
  description?: string;
  /** What the tool is for, shown in the dashboard's tool directory. */
  summary?: string;
  /** Public pages this tool changes, shown beside the summary in the directory. */
  affects?: string;
  /** Small icon for the sidebar and the dashboard. */
  icon: AdminIcon;
}

export interface AdminNavGroup {
  /** Stable key for persisted expand/collapse state. Never shown. */
  id: string;
  /** Null for the ungrouped Dashboard link. */
  group: string | null;
  icon: AdminIcon;
  /** One line about the group, shown in the dashboard's tool directory. */
  intro?: string;
  items: readonly AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: readonly AdminNavGroup[] = [
  {
    id: 'overview',
    group: null,
    icon: FiGrid,
    items: [
      {
        to: '/admin',
        label: 'Dashboard',
        icon: FiGrid,
        keywords: ['overview', 'home', 'operations', 'continue', 'data health', 'warnings', 'diagnostics', 'issues'],
        summary: 'What needs attention, what you were working on, and site health.',
      },
    ],
  },
  {
    id: 'events-attendance',
    group: 'Events & Attendance',
    icon: FiCalendar,
    intro: 'Run events, bring in attendance, and keep member records and points clean.',
    items: [
      {
        to: '/admin/events',
        label: 'Events',
        icon: FiCalendar,
        keywords: ['gbm', 'mixer', 'check-in', 'check in', 'duplicate', 'recaps', 'dates', 'locations', 'images'],
        summary: 'Create and edit events, dates, locations, point values, images, and recap notes.',
        affects: '/events, homepage event previews, Ask VSA event answers',
      },
      {
        to: '/admin/import',
        label: 'Attendance Imports',
        icon: FiUpload,
        keywords: ['upload', 'csv', 'spreadsheet', 'attendance', 'audit', 'logs', 'sheets'],
        summary: 'Import attendance sheets, review matches, and check completed or failed imports.',
        affects: 'Member point records and attendance audit history',
      },
      {
        to: '/admin/members',
        label: 'Members',
        icon: FiUsers,
        keywords: ['people', 'roster', 'aliases', 'records', 'exports'],
        summary: 'Find members, manage aliases and exports, and fix records used by attendance and points.',
        affects: 'Find My Points, attendance matching, and admin member tools',
      },
      {
        to: '/admin/points',
        label: 'Points Tools',
        icon: FiAward,
        keywords: ['leaderboard', 'find my points', 'records'],
        summary: 'Review point records and jump to related member, import, event, and merge tools.',
        affects: '/leaderboard and /points lookups',
      },
      {
        to: '/admin/merge-suggestions',
        label: 'Merge Review',
        icon: FiGitMerge,
        keywords: ['duplicates', 'merge', 'cleanup', 'data health'],
        summary: 'Review duplicate member suggestions so point records stay clean.',
        affects: 'Member records used by attendance and points',
      },
      {
        to: '/admin/photo-requests',
        label: 'Photo Requests',
        icon: FiCamera,
        keywords: ['member photos', 'avatars', 'headshots'],
        summary: 'Review member photo submissions before they appear on the site.',
      },
    ],
  },
  {
    id: 'programs-people',
    group: 'Programs & People',
    icon: FiUsers,
    intro: 'Houses, families, interns, applications, and the Cabinet.',
    items: [
      {
        to: '/admin/houses',
        label: 'Houses',
        icon: FiHome,
        keywords: ['house assignment', 'reveal', 'toad', 'boo', 'membership', 'placement'],
        summary: 'Place members into Houses, then manage House profiles, images, parents, and events.',
        affects: '/house, /house/year/:year, House detail pages, house standings',
      },
      {
        to: '/admin/ace',
        label: 'ACE Families',
        icon: FiHeart,
        keywords: ['big', 'little', 'assignments', 'lineage', 'fam', 'families', 'family'],
        summary: 'Manage ACE family groups, assignments, and member relationships.',
        affects: '/ace and ACE family displays',
      },
      {
        to: '/admin/member-roles',
        label: 'Role Assignment',
        icon: FiUserCheck,
        keywords: ['bulk roles', 'role matcher', 'board member', 'intern', 'canonical member', 'link names'],
        summary: 'Paste names and review safe links to real year-scoped role records.',
        affects: 'Approved Cabinet and Intern identities; source editors own publication',
      },
      {
        to: '/admin/interns',
        label: 'Intern Cohort',
        icon: FiBriefcase,
        keywords: ['internship', 'mentor', 'accepted', 'cohort'],
        summary: 'Prepare the accepted intern cohort privately, then publish it to the Cabinet Interns group.',
        affects: '/intern-program, /cabinet (Interns group), intern avatars',
      },
      {
        to: '/admin/applications',
        label: 'Applications',
        icon: FiFileText,
        keywords: ['forms', 'windows', 'apply', 'interest form'],
        summary: 'Manage application and interest-form links with open and close windows.',
        affects: '/ace, /house, /intern-program, /cabinet, /vcn/current, /wild-n-culture, /get-involved',
      },
      {
        to: '/admin/cabinet',
        label: 'Cabinet',
        icon: FiUserCheck,
        keywords: ['board', 'officers', 'positions', 'profiles'],
        summary: 'Update Cabinet profiles, photos, roles, and Cabinet years.',
        affects: '/cabinet and cabinet archive years',
      },
      {
        to: '/admin/cabinet/rollover',
        label: 'Cabinet Rollover',
        icon: FiRepeat,
        parent: '/admin/cabinet',
        keywords: ['new cabinet', 'roster'],
        summary: 'Prepare next year’s Cabinet roster privately, then publish it.',
      },
    ],
  },
  {
    id: 'content-outreach',
    group: 'Content & Outreach',
    icon: FiEdit3,
    intro: 'Keep public site content, photos, archives, and partner outreach current.',
    items: [
      {
        to: '/admin/content',
        label: 'Homepage & Programs',
        icon: FiEdit3,
        keywords: ['homepage', 'copy', 'photos', 'programs', 'presidents message'],
        summary: 'Update the homepage president’s message, featured photos, and program page content.',
        affects: '/, /get-involved, /intern-program, /vcn, /wild-n-culture',
      },
      {
        to: '/admin/gallery',
        label: 'Gallery',
        icon: FiImage,
        keywords: ['albums', 'memories', 'media', 'photos'],
        summary: 'Upload gallery drops and connect memories to events with albums and covers.',
        affects: '/gallery and event recap links',
      },
      {
        to: '/admin/content-calendar',
        label: 'Content Calendar',
        icon: FiList,
        keywords: ['calendar', 'planning', 'schedule', 'reminders'],
        summary: 'Plan upcoming website updates from events, applications, and terms.',
      },
      {
        to: '/admin/vcn',
        label: 'VCN Archives',
        icon: FiFilm,
        keywords: ['archives', 'archive', 'media', 'culture night'],
        summary: 'Manage VCN archive entries, the current production, media links, and source notes.',
        affects: '/vcn/current and /vcn/archive',
      },
      {
        to: '/admin/resources',
        label: 'Resources Index',
        icon: FiFolder,
        keywords: ['source of truth', 'drive', 'forms', 'docs', 'index', 'links'],
        summary: 'Maintain admin-only Drive, form, and doc links for Cabinet work.',
        affects: 'Admin-only resources and cabinet operations',
      },
      {
        to: '/admin/ai-knowledge',
        label: 'Ask VSA Knowledge',
        icon: FiMessageCircle,
        keywords: ['ai', 'assistant', 'ask vsa', 'snippets', 'faq', 'knowledge'],
        summary: 'Manage the public-safe facts Ask VSA uses when answering member questions.',
        affects: 'Ask VSA assistant responses',
      },
      {
        to: '/admin/external-events',
        label: 'External Events',
        icon: FiExternalLink,
        keywords: ['external', 'externals', 'uvsa', 'partner'],
        summary: 'Manage UVSA and partner events promoted outside regular VSA programming.',
        affects: '/uvsa-network and external event cards',
      },
      {
        to: '/admin/uvsa-schools',
        label: 'UVSA Schools',
        icon: FiMapPin,
        keywords: ['uvsa', 'schools', 'network', 'socal', 'cards'],
        summary: 'Manage the SoCal VSA school cards on the UVSA Network page.',
        affects: '/uvsa-network',
      },
    ],
  },
  {
    id: 'planning-health',
    group: 'Planning & Health',
    icon: FiActivity,
    intro: 'Set up each year, check readiness, and see what changed.',
    items: [
      {
        to: '/admin/years',
        label: 'Years & Terms',
        icon: FiClock,
        keywords: ['academic year', 'quarter', 'terms', 'cabinet years'],
        summary: 'Manage the academic terms and Cabinet years used by events, archives, and points.',
        affects: 'Event grouping, cabinet years, archives, and academic-year filters',
      },
      {
        to: '/admin/year-setup',
        label: 'New Year Setup',
        icon: FiPlayCircle,
        keywords: ['rollover', 'prepare year', 'new year'],
        summary: 'Walk through preparing the next academic year.',
      },
      {
        to: '/admin/launch-checklist',
        label: 'Launch Checklist',
        icon: FiCheckSquare,
        keywords: ['launch', 'readiness', 'pre-launch', 'qa'],
        summary: 'Pre-launch readiness checks for each academic year across the whole site.',
        affects: 'All public-facing sections of the site',
      },
      {
        to: '/admin/content-health',
        label: 'Content Health',
        icon: FiActivity,
        keywords: ['broken', 'dead link', 'stale', 'images', 'issues', 'maintenance', 'needs attention', 'drafts'],
        summary: 'See what public content is missing, stale, hidden, or broken, with links to fix it.',
      },
      {
        to: '/admin/analytics',
        label: 'Analytics',
        icon: FiBarChart2,
        keywords: ['reports', 'activity', 'diagnostics'],
        summary: 'High-level site activity signals.',
      },
      {
        to: '/admin/recent-changes',
        label: 'Recent Changes',
        icon: FiRotateCcw,
        keywords: ['activity', 'history', 'log', 'undo', 'audit'],
        summary: 'See recent edits to ACE, Houses, Cabinet, and Interns, and undo where it is safe.',
      },
    ],
  },
  {
    id: 'settings-feedback',
    group: 'Settings & Feedback',
    icon: FiSettings,
    intro: 'Site-wide settings, feedback, and privacy requests.',
    items: [
      {
        to: '/admin/settings',
        label: 'Site Settings',
        icon: FiSettings,
        keywords: ['settings', 'config', 'site', 'logo', 'theme'],
        summary: 'Update the logo, theme assets, and site-wide content switches.',
        affects: 'Global header, footer, logo, and site settings',
      },
      {
        to: '/admin/feedback',
        label: 'Feedback',
        icon: FiMessageSquare,
        keywords: ['bugs', 'requests', 'support', 'suggestions'],
        summary: 'Triage bugs, feature requests, and suggestions from the public feedback form.',
        affects: '/feedback submissions and admin triage',
      },
      {
        to: '/admin/ai-feedback',
        label: 'Ask VSA Feedback',
        icon: FiThumbsUp,
        keywords: ['ai', 'ask vsa', 'assistant', 'ratings', 'knowledge'],
        summary: 'Review ratings and feedback on Ask VSA answers.',
      },
      {
        to: '/admin/ai-usage',
        label: 'Ask VSA Usage',
        icon: FiBarChart2,
        keywords: ['ai', 'ask vsa', 'usage', 'rate limit', 'cost', 'requests'],
        summary: 'See privacy-safe usage counts and rate-limit impact; no member-level logs or invented cost.',
      },
      {
        to: '/admin/data-rights',
        label: 'Data Rights',
        icon: FiShield,
        keywords: ['privacy', 'requests', 'verification', 'review', 'decisions'],
        summary: 'Track privacy and data requests: intake, identity verification, review, and decision.',
        affects: 'Admin-only request tracking; no member data actions',
      },
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

/** The sidebar group a path lives in, or null for an unknown path. */
export function adminNavGroupFor(path: string): AdminNavGroup | null {
  const item = adminNavItemFor(path);
  return item ? ADMIN_NAV_GROUPS.find((entry) => entry.items.includes(item)) ?? null : null;
}

/**
 * Which destination a pathname highlights. Exact match first; otherwise the
 * longest nav path the pathname sits under, so a future nested route such as
 * /admin/events/123 still lights up Events. The dashboard only matches itself.
 */
export function activeAdminNavPath(pathname: string): string | null {
  const base = basePath(pathname);
  const exact = ADMIN_NAV_ITEMS.find((item) => item.to === base);
  if (exact) return exact.to;
  const nested = ADMIN_NAV_ITEMS.filter((item) => item.to !== '/admin' && base.startsWith(`${item.to}/`)).sort((a, b) => b.to.length - a.to.length)[0];
  return nested?.to ?? null;
}

// ─── Dashboard quick actions ─────────────────────────────────────────────────

export interface AdminQuickAction {
  /** An existing nav destination. The icon comes from that entry. */
  to: string;
  /** Action-oriented label shown on the dashboard. */
  label: string;
  hint: string;
}

/** The six things admins do most. Each `to` must be a nav destination (tested). */
export const ADMIN_QUICK_ACTIONS: readonly AdminQuickAction[] = [
  { to: '/admin/events', label: 'Manage events', hint: 'Create, edit, or publish' },
  { to: '/admin/import', label: 'Import attendance', hint: 'Upload a sheet and review matches' },
  { to: '/admin/members', label: 'Find a member', hint: 'Look up records and points' },
  { to: '/admin/houses', label: 'Manage Houses', hint: 'Assignments, images, events' },
  { to: '/admin/applications', label: 'Manage applications', hint: 'Open and close forms' },
  { to: '/admin/content', label: 'Edit website content', hint: 'Homepage and program pages' },
];

// ─── Favorites ───────────────────────────────────────────────────────────────

export const MAX_ADMIN_FAVORITES = 5;

/** Pinned when an admin has never chosen their own. */
export const DEFAULT_ADMIN_FAVORITES: readonly string[] = ['/admin/events', '/admin/import', '/admin/members', '/admin/houses'];

/**
 * Cleans a persisted favorites list: unknown paths, duplicates, the dashboard
 * (always visible), and anything past the cap are dropped. Returns null when the
 * value is not a list at all, so callers can fall back to the defaults.
 */
export function sanitizeAdminFavorites(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const known = new Set(ADMIN_NAV_ITEMS.map((item) => item.to));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || entry === '/admin' || !known.has(entry) || seen.has(entry)) continue;
    seen.add(entry);
    out.push(entry);
    if (out.length >= MAX_ADMIN_FAVORITES) break;
  }
  return out;
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
