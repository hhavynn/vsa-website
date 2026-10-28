import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (file: string) => readFileSync(resolve(__dirname, '../..', file), 'utf8');
const migration = read('supabase/migrations/20261028060000_embargo_public_house_scores.sql');
const privateViews = [
  'house_yearly_points',
  'house_all_time_points',
  'house_recent_activity',
  'house_member_yearly_points',
  'house_member_all_time_points',
];

describe('House standings embargo release invariants (#692)', () => {
  it.each(privateViews)('revokes every client role on %s at the API boundary', (view) => {
    expect(migration).toContain(`revoke all on public.${view} from public, anon, authenticated;`);
    expect(migration).not.toMatch(new RegExp(`grant\\s+select\\s+on\\s+public\\.${view}\\s+to\\s+(?:anon|authenticated)`, 'i'));
  });

  it('keeps private totals behind explicit admin authorization and removes anonymous EXECUTE', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain('public.is_admin_user(auth.uid())');
    expect(migration).toContain('revoke all on function public.admin_private_house_standings(integer) from public, anon, authenticated;');
    expect(migration).toContain('grant execute on function public.admin_private_house_standings(integer) to authenticated;');
  });

  it('limits the public House badge RPC to identity fields, no scores or roster', () => {
    const start = migration.indexOf('create or replace function public.public_member_house_badge(');
    const stop = migration.indexOf('comment on function public.public_member_house_badge', start);
    const badgeFunction = migration.slice(start, stop);
    expect(badgeFunction).toContain("hb.status = 'published'");
    expect(badgeFunction).toContain('hm.member_id = p_member_id');
    expect(badgeFunction).toContain('limit 1;');
    expect(badgeFunction).not.toMatch(/total_points|unique_events|events_attended|member_event_attendance/);
  });

  it.each([
    'src/pages/Leaderboard.tsx',
    'src/pages/House.tsx',
    'src/pages/HouseDetail.tsx',
    'src/components/features/home/ThisWeekInVSA.tsx',
  ])('%s never requests private House standings or contribution views', (path) => {
    expect(read(path)).not.toMatch(/getYearlyHouseLeaderboard|getAllTimeHouseLeaderboard|getTopYearlyHouseStandings|getRecentHouseActivity|getHouseMemberRankings/);
  });

  it('does not ship historical House totals as fallback or override constants', () => {
    expect(read('src/config/publicFallbackContent.ts')).not.toContain('FALLBACK_HOUSE_STANDINGS_2025_2026');
    expect(read('src/utils/housePublicPointOverrides.ts')).not.toContain('PUBLIC_OVERRIDES_2025_2026');
    const wrapped = read('src/components/features/home/WrappedRecapCard.tsx');
    expect(wrapped).not.toContain('Bowser House finished first');
    expect(wrapped).not.toContain('Final Standings');
  });

  it('keeps public individual leaderboard reads available and House badges independent of points', () => {
    const leaderboard = read('src/data/repos/leaderboard.ts');
    expect(leaderboard).toContain(".from('member_yearly_points')");
    expect(leaderboard).toContain(".from('public_members')");
    const badge = leaderboard.slice(leaderboard.indexOf('async getMemberHouseBadge('), leaderboard.indexOf('async getYearsWithData('));
    expect(badge).toContain("supabase.rpc('public_member_house_badge'");
    expect(badge).not.toContain(".from('house_member_");
  });
});
