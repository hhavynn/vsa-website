import type { RelatedLink } from '../components/common/RelatedLinks';

// The "next step" links offered on public pages, kept in one place so the
// relationships are reviewable and testable. Primary navigation stays in
// navConfig.ts; these are contextual, 1-3 per page, and never a second nav.
//
// Application windows are intentionally NOT modeled here: apply buttons and
// their URLs only ever come from the public application-link model (see
// ApplicationCTA), never from a static list.

/** `id` of the existing How-points-work explainer wrapper on /points and /leaderboard. */
export const POINTS_HELP_ANCHOR = 'how-points-work';

export const GET_INVOLVED_PROGRAMS_PATH = '/get-involved#programs';

export function pointsRelatedLinks(): RelatedLink[] {
  return [
    { to: '/leaderboard', label: 'Leaderboard', description: 'See where everyone stands this year.' },
    { to: '/events', label: 'Earn more points', description: 'Upcoming events that count toward your total.' },
  ];
}

/**
 * `pathname` + `search` are passed through so the same-page jump to the
 * explainer keeps the current view (`?view=houses`).
 */
export function leaderboardRelatedLinks(pathname: string, search: string): RelatedLink[] {
  return [
    { to: '/points', label: 'Find My Points', description: 'Look up your own total and events.' },
    {
      to: `${pathname}${search}#${POINTS_HELP_ANCHOR}`,
      label: 'How points work',
      description: 'What counts, and how years and Houses are scored.',
    },
  ];
}

export type HouseRelatedMode = 'current' | 'archive';

export function houseRelatedLinks(mode: HouseRelatedMode): RelatedLink[] {
  const leaderboard: RelatedLink = {
    to: '/leaderboard?view=houses',
    label: 'Leaderboard',
    description: 'House standings and member rankings.',
  };
  const archive: RelatedLink = {
    to: '/house/archive',
    label: 'House archive',
    description: 'Past Houses and eras.',
  };

  if (mode === 'archive') {
    return [
      { to: '/house', label: 'Current Houses', description: 'This year’s Houses and live standings.' },
      archive,
      leaderboard,
    ];
  }

  return [
    leaderboard,
    {
      to: `/points#${POINTS_HELP_ANCHOR}`,
      label: 'How points work',
      description: 'How House points are counted.',
    },
    archive,
  ];
}

export function programRelatedLinks(): RelatedLink[] {
  return [
    {
      to: GET_INVOLVED_PROGRAMS_PATH,
      label: 'Compare programs',
      description: 'Every way to get involved, side by side.',
    },
  ];
}
