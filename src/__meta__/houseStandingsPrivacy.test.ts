import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (file: string) => readFileSync(resolve(__dirname, '../..', file), 'utf8');
const migration = read('supabase/migrations/20261028073000_embargo_public_house_scores.sql');
const revealBadgeFix = read('supabase/migrations/20261031093000_public_member_house_badge_matches_view.sql');
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
    const archive = read('src/data/legacyHouseArchive.ts');
    expect(archive).not.toMatch(/Gucci won House Spirit Week|414 points|final standings stay in the archive/i);
  });

  it('keeps public individual leaderboard reads available and House badges independent of points', () => {
    const leaderboard = read('src/data/repos/leaderboard.ts');
    expect(leaderboard).toContain(".from('member_yearly_points')");
    expect(leaderboard).toContain(".from('public_members')");
    const badge = leaderboard.slice(leaderboard.indexOf('async getMemberHouseBadge('), leaderboard.indexOf('async getYearsWithData('));
    expect(badge).toContain("badgeClient.rpc('public_member_house_badge'");
    expect(badge).not.toContain(".from('house_member_");
  });
});


describe('House badge follows exact-batch Reveal view (#802)', () => {
  it('sources badge results only from the existing Reveal-gated public view', () => {
    const body = revealBadgeFix.slice(
      revealBadgeFix.indexOf('create or replace function public.public_member_house_badge('),
      revealBadgeFix.indexOf('revoke all on function public.public_member_house_badge('),
    );
    expect(body).toContain('from public.public_house_memberships m');
    expect(body).toContain('security definer set search_path');
    expect(body).toContain("America/Los_Angeles");
    expect(body).not.toContain('from public.house_memberships ');
    expect(body).not.toContain('house_assignment_batches');
    expect(body).not.toMatch(/total_points|member_event_attendance|events_attended|review_note/);
    expect(body).toContain("'academic_year_start', m.academic_year_start");
    expect(body).toContain("'latest_activity_at', null");
  });

  it('preserves public RPC signature, deny-by-default grants, and identity-only return', () => {
    expect(revealBadgeFix).toContain('p_member_id uuid,');
    expect(revealBadgeFix).toContain('p_year integer default null');
    expect(revealBadgeFix).toContain(
      'revoke all on function public.public_member_house_badge(uuid,integer) from public, anon, authenticated;');
    expect(revealBadgeFix).toContain(
      'grant execute on function public.public_member_house_badge(uuid,integer) to anon, authenticated;');
    expect(revealBadgeFix).toContain("'house', m.house_key");
    expect(revealBadgeFix).toContain("'house_profile_id', m.house_profile_id");
    expect(revealBadgeFix).toContain("'display_name', m.display_name");
    expect(revealBadgeFix).toContain("'accent_color', m.accent_color");
    expect(revealBadgeFix).not.toMatch(/grant\s+select\s+on\s+public\.(house_yearly_points|house_member_all_time_points)/i);
  });
});
