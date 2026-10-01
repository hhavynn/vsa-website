import { type CabinetMemberRaw } from '../../../../hooks/useCabinet';
import { buildCabinetPreviewMembers, DRAFT_CABINET_MEMBER_ID } from './cabinetPreview';

function member(overrides: Partial<CabinetMemberRaw>): CabinetMemberRaw {
  return {
    id: 'm',
    name: 'Member',
    role: 'Historian',
    category: 'General Board',
    display_order: 5,
    image_url: null,
    thumbnail_url: null,
    year: null,
    college: null,
    major: null,
    minor: null,
    pronouns: null,
    favorite_snack: null,
    fun_fact: null,
    cabinet_year_id: 'y2026',
    member_id: null,
    ...overrides,
  };
}

const members = [
  member({ id: 'a', name: 'An', display_order: 1 }),
  member({ id: 'b', name: 'Binh', display_order: 3, member_id: 'mem-b', image_url: 'https://cdn.example/b.jpg' }),
  member({ id: 'old', name: 'Old Year', cabinet_year_id: 'y2025' }),
  member({ id: 'legacy', name: 'Legacy', cabinet_year_id: null, display_order: 9 }),
];

const ids = (list: CabinetMemberRaw[]) => list.map((m) => m.id);

describe('buildCabinetPreviewMembers', () => {
  it('adds a new draft to the selected year in public sort order', () => {
    const result = buildCabinetPreviewMembers({
      members,
      draft: { name: 'Chau', role: 'Treasurer', category: 'Executive Board', display_order: 2 },
      yearId: 'y2026',
      includeLegacy: false,
      imageUrl: null,
      thumbnailUrl: null,
    });
    expect(ids(result)).toEqual(['a', DRAFT_CABINET_MEMBER_ID, 'b']);
  });

  it('includes unassigned legacy rows only for the current year, like /cabinet', () => {
    const draft = { name: 'Chau', role: 'Treasurer', display_order: 2 };
    expect(ids(buildCabinetPreviewMembers({ members, draft, yearId: 'y2026', includeLegacy: true, imageUrl: null, thumbnailUrl: null }))).toContain('legacy');
    expect(ids(buildCabinetPreviewMembers({ members, draft, yearId: 'y2025', includeLegacy: false, imageUrl: null, thumbnailUrl: null }))).toEqual([DRAFT_CABINET_MEMBER_ID, 'old']);
  });

  it('replaces the saved row with unsaved edits instead of duplicating it', () => {
    const result = buildCabinetPreviewMembers({
      members,
      draft: { ...members[1], fun_fact: 'Loves boba', display_order: 0 },
      yearId: 'y2026',
      includeLegacy: false,
      imageUrl: members[1].image_url,
      thumbnailUrl: null,
    });
    expect(ids(result)).toEqual(['b', 'a']);
    expect(result[0].fun_fact).toBe('Loves boba');
    expect(result[0].member_id).toBe('mem-b');
  });

  it('drops the linked member photo when the draft renames the member, as saving does', () => {
    const [renamed] = buildCabinetPreviewMembers({
      members,
      draft: { ...members[1], name: 'Someone Else' },
      yearId: 'y2026',
      includeLegacy: false,
      imageUrl: null,
      thumbnailUrl: 'https://cdn.example/b-thumb.jpg',
    }).filter((m) => m.id === 'b');
    expect(renamed.member_id).toBeNull();
    expect(renamed.thumbnail_url).toBeNull();
  });
});
