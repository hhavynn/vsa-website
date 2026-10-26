import { houseParentsRepository } from './houseParents';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

it('lists one year\u2019s House Parents in House order, then slot order', async () => {
  supabaseMock.queueResult('house_page_assets', {
    data: [
      { id: 'p-rarity', display_name: 'Rarity', house_key: 'rarity', display_order: 3 },
      { id: 'p-twilight', display_name: 'Twilight Sparkle', house_key: 'twilight-sparkle', display_order: 0 },
    ],
    error: null,
  });
  supabaseMock.queueResult('house_parents', {
    data: [
      { id: 'a', house_profile_id: 'p-rarity', display_name: 'Jonas Truong', member_id: null, review_note: null, display_order: 1, created_at: '', updated_at: '' },
      { id: 'b', house_profile_id: 'p-twilight', display_name: 'Kent Nguyen', member_id: 'm-kent', review_note: null, display_order: 1, created_at: '', updated_at: '' },
      { id: 'c', house_profile_id: 'p-twilight', display_name: 'Timothy (Tim) Huynh', member_id: 'm-tim', review_note: null, display_order: 0, created_at: '', updated_at: '' },
    ],
    error: null,
  });
  const parents = await houseParentsRepository.listForYear(2026);
  expect(parents.map((parent) => [parent.houseLabel, parent.display_name])).toEqual([
    ['Twilight Sparkle', 'Timothy (Tim) Huynh'],
    ['Twilight Sparkle', 'Kent Nguyen'],
    ['Rarity', 'Jonas Truong'],
  ]);
  expect(supabaseMock.filtersFor('house_page_assets')).toContainEqual(['academic_year_start', 2026]);
  expect(supabaseMock.queriesFor('members')).toHaveLength(0);
});

it('links and unlinks only the house_parents row, never memberships', async () => {
  supabaseMock.setDefault('house_parents', { data: null, error: null });
  await houseParentsRepository.setMember('hp1', 'm-1');
  await houseParentsRepository.setMember('hp1', null);
  const updates = supabaseMock.queriesFor('house_parents').flatMap((query) => query.calls).filter((call) => call.method === 'update');
  expect(updates.map((call) => call.args[0])).toEqual([
    { member_id: 'm-1', review_note: null },
    { member_id: null, review_note: 'Unlinked by an admin. Link the right member record.' },
  ]);
  expect(supabaseMock.queriesFor('house_memberships')).toHaveLength(0);
});
