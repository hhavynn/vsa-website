/**
 * #639 release-rehearsal SOURCE guards. They are not substitutes for staging
 * anon/RLS probes, simulated timed cutoff, device screenshots or signoffs.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (path: string) => readFileSync(resolve(__dirname, '../..', path), 'utf8');

describe('2026–27 House release journey privacy and evidence contract (#639)', () => {
  it('keeps a concrete H01-H12 manual matrix with accountable signoffs instead of declaring an automatic launch', () => {
    const doc = read('docs/house-release-rehearsal-2026-27.md');
    for (let i=1; i<=12; i++) expect(doc).toContain('H' + String(i).padStart(2,'0'));
    expect(doc).toContain('Status: staging rehearsal and signoffs NOT performed');
    expect(doc).toContain('BLOCKED');
    expect(doc).toContain('President/designated final launch owner');
    expect(doc).toContain('Independent privacy reviewer');
    expect(doc).toContain('320/375/390px');
  });

  it('puts the manual staging and privacy gate directly in Admin Launch Checklist', () => {
    const page = read('src/pages/Admin/LaunchChecklist.tsx');
    expect(page).toContain('docs/house-release-rehearsal-2026-27.md');
    expect(page).toContain('green automated Launch Checklist is not approval');
    expect(page).toContain('target="_blank"');
    expect(page).toContain('rel="noopener noreferrer"');
  });

  it.each([
    'src/pages/House.tsx',
    'src/pages/HouseArchive.tsx',
    'src/pages/HouseDetail.tsx',
    'src/pages/Leaderboard.tsx',
    'src/pages/Points.tsx',
    'src/components/features/home/ThisWeekInVSA.tsx',
  ])('%s must not call public House score-read methods', (path) => {
    expect(read(path)).not.toMatch(/getYearlyHouseLeaderboard|getAllTimeHouseLeaderboard|getTopYearlyHouseStandings|getRecentHouseActivity|getHouseMemberRankings/);
  });

  it('preserves the approved public House identity projection separate from private House scores', () => {
    const source=read('src/data/repos/houseMemberships.ts');
    expect(source).toContain(".from('public_house_memberships')");
    expect(source).not.toContain(".from('house_member_yearly_points')");
    expect(source).not.toContain(".from('house_yearly_points')");
    const embargo=read('supabase/migrations/20261028073000_embargo_public_house_scores.sql');
    for(const view of ['house_yearly_points','house_all_time_points','house_recent_activity',
      'house_member_yearly_points','house_member_all_time_points']) {
      expect(embargo).toContain('revoke all on public.' + view + ' from public, anon, authenticated;');
    }
  });

  it('requires year-specific Reveal readiness and explicit payment/publication checks', () => {
    const readiness=read('src/lib/houseRevealReadiness.ts');
    expect(readiness).toContain('payment');
    expect(readiness).toContain('applications');
    expect(readiness).toContain('profiles');
    const tests=read('src/lib/houseRevealReadiness.test.ts');
    expect(tests).toContain('canReveal');
    const fixture=read('scripts/sql/public-house-memberships.test.sql');
    expect(fixture).toContain('public_house_memberships');
  });
});
