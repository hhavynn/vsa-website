import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (file: string) => readFileSync(resolve(__dirname, '../..', file), 'utf8');

describe('#704 public House cache privacy', () => {
  const events = read('src/pages/Events.tsx');
  const memoryCard = read('src/components/features/events/PublicEventCards.tsx');
  const migration = read('supabase/migrations/20261028083000_restrict_public_members_house_cache.sql');

  it('never fetches member identity, cache Houses, or roster data for event memory stats', () => {
    expect(events).not.toContain(".from('public_members')");
    expect(events).not.toContain('houseByMember');
    expect(events).not.toContain('houseCounts');
    expect(events).not.toContain('topHouse');
    expect(events).toContain(".select('event_id, points_earned')");
    expect(events).not.toContain(".select('event_id, member_id, points_earned')");
  });

  it('renders published events with no House leaderboard surrogate, even in admin public-preview card', () => {
    expect(memoryCard).not.toContain('topHouseCount');
    expect(memoryCard).not.toContain('topHouse');
    expect(memoryCard).not.toContain('houseLabel} led');
    expect(memoryCard).toContain('{stats.memberCount} members attended');
    expect(memoryCard).toContain('View Photos');
  });

  it('removes table grants and grants only individual points and display-safe member columns', () => {
    expect(migration).toContain('revoke all on public.public_members from public, anon, authenticated;');
    expect(migration).toMatch(/grant select \(id, first_name, last_name, college, year, points, events_attended\)/);
    expect(migration).toContain("has_column_privilege(v_role, 'public.public_members', 'house', 'SELECT')");
    expect(migration).toContain("has_column_privilege(v_role, 'public.public_members', 'points', 'SELECT')");
    expect(migration).not.toMatch(/grant select\s*\([^)]*\bhouse\b/);
  });

  it('preserves member and House write-path model while denying client cache reads', () => {
    const writer = read('src/data/repos/houseMembershipWrites.ts');
    // The old House cache remains internal during a staged migration. It must
    // never be made public again, including between batch insert and Publish.
    expect(writer).toContain(".update({ house: input.houseCacheLabel, updated_at: now })");
    expect(migration).toContain('public_house_memberships');
    expect(read('src/data/repos/leaderboard.ts')).toContain(".from('public_members')");
  });
});
