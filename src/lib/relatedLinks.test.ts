import {
  houseRelatedLinks,
  leaderboardRelatedLinks,
  pointsRelatedLinks,
  POINTS_HELP_ANCHOR,
  programRelatedLinks,
} from './relatedLinks';

const targets = (links: { to: string }[]) => links.map((link) => link.to);

describe('related link sets', () => {
  it('/points offers the leaderboard and events, and nothing more', () => {
    expect(targets(pointsRelatedLinks())).toEqual(['/leaderboard', '/events']);
  });

  it('/leaderboard offers Find My Points and the in-page explainer, keeping the current URL state', () => {
    expect(targets(leaderboardRelatedLinks('/leaderboard', ''))).toEqual([
      '/points',
      `/leaderboard#${POINTS_HELP_ANCHOR}`,
    ]);
    expect(targets(leaderboardRelatedLinks('/leaderboard', '?view=houses'))[1]).toBe(
      `/leaderboard?view=houses#${POINTS_HELP_ANCHOR}`,
    );
  });

  it('never points at a standalone /points-explainer page', () => {
    const all = [
      ...pointsRelatedLinks(),
      ...leaderboardRelatedLinks('/leaderboard', ''),
      ...houseRelatedLinks('current'),
      ...houseRelatedLinks('archive'),
      ...programRelatedLinks(),
    ];
    expect(targets(all).some((to) => to.includes('points-explainer'))).toBe(false);
  });

  it('current-year House pages link the leaderboard, the points explainer and the archive', () => {
    expect(targets(houseRelatedLinks('current'))).toEqual([
      '/leaderboard?view=houses',
      `/points#${POINTS_HELP_ANCHOR}`,
      '/house/archive',
    ]);
  });

  it('archive House pages link back to the current year and stay within the archive', () => {
    expect(targets(houseRelatedLinks('archive'))).toEqual([
      '/house',
      '/house/archive',
      '/leaderboard?view=houses',
    ]);
  });

  it('program pages compare programs via the Get Involved hub and carry no application URL', () => {
    const links = programRelatedLinks();
    expect(targets(links)).toEqual(['/get-involved#programs']);
    expect(JSON.stringify(links)).not.toMatch(/https?:|forms\.gle|docs\.google|drive\.google/);
  });
});
