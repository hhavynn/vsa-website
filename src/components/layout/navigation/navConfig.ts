// Single source of truth for site navigation, shared by the desktop Explore
// panel, the mobile quick-dock, and the mobile drawer — replaces four
// previously independent, hand-written destination lists.

export interface NavLink {
  path: string;
  label: string;
  emoji?: string;
  description?: string;
}

export const QUICK_LINKS: NavLink[] = [
  { path: '/events', label: 'Events', emoji: '📅' },
  { path: '/calendar', label: 'Calendar', emoji: '🗓️' },
  { path: '/points', label: 'Find My Points', emoji: '🎯' },
  { path: '/leaderboard', label: 'Leaderboard', emoji: '⭐' },
];

export const GET_INVOLVED: NavLink[] = [
  { path: '/get-involved', label: 'Start Here', emoji: '👋', description: 'New to VSA? This is your entry point.' },
  { path: '/house', label: 'House', emoji: '🏠', description: 'Join a house fam and compete through the year.' },
  { path: '/ace', label: 'ACE', emoji: '🌱', description: 'Big/Little mentorship and fam bonds.' },
  { path: '/intern-program', label: 'Intern Program', emoji: '📋', description: 'Learn cabinet work and help run VSA.' },
  { path: '/vcn', label: 'VCN', emoji: '🎭', description: 'Vietnamese Cultural Night performing arts.' },
  { path: '/wild-n-culture', label: "Wild N' Culture", emoji: '🎉', description: 'Cultural showcase and performance.' },
];

export const EXPLORE_LINKS: NavLink[] = [
  { path: '/#wrapped', label: "Wrapped '25–'26", emoji: '🎁' },
  { path: '/gallery', label: 'Gallery', emoji: '📷' },
  { path: '/cabinet', label: 'Cabinet', emoji: '🗂️' },
  { path: '/uvsa-network', label: 'UVSA Network', emoji: '🌐' },
];

// Mobile quick-dock — deliberately distinct from Leaderboard. Fixes the bug
// where the dock's "Points" slot routed to /leaderboard instead of the real
// personal lookup at /points.
export const DOCK_ITEMS: NavLink[] = [
  { path: '/', label: 'Home' },
  { path: '/events', label: 'Events' },
  { path: '/house', label: 'House' },
  { path: '/points', label: 'Find My Points' },
];

export const INVOLVEMENT_PREFIXES = GET_INVOLVED.map((l) => l.path);

export function isRouteActive(pathname: string, path: string) {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(path + '/');
}
