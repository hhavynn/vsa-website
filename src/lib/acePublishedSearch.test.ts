import type { AceFamily, AceFamilyMember } from '../types';
import {
  foldAceName,
  publishedAceNodePath,
  resolvePublishedAceLink,
  searchPublishedAceNodes,
} from './acePublishedSearch';

const fam = (id: string, published = true): AceFamily => ({
  id, slug: id, name: id === 'active' ? 'Moon Fam' : 'Archived Fam',
  is_published: published,
}) as AceFamily;

const member = (
  id: string, familyId: string, name: string,
  parent: string | null = null, isPublished = true,
  pickup: number | null = null,
): AceFamilyMember => ({
  id, family_id: familyId, name, parent_member_id: parent,
  is_published: isPublished, pickup_academic_year_start: pickup,
  pickup_term: null,
}) as AceFamilyMember;

const families = [fam('active'), fam('archive'), fam('private', false)];
const members = [
  member('big', 'active', 'Grandbig', null, true, 2021),
  member('same-1', 'active', 'Đặng Ánh', 'big', true, 2023),
  member('same-2', 'archive', 'Dang Anh', null, true, 2022),
  member('hidden', 'active', 'Dang Hidden', null, false, 2026),
  member('private-node', 'private', 'Dang Secret', null, true, 2026),
  member('orphan', 'active', 'Unknown Friend', 'unpublished-parent'),
];

describe('public ACE discovery and deep links (#666)', () => {
  it('folds Vietnamese accents and đ, case and extra spaces', () => {
    expect(foldAceName('  ĐẶNG  ÁNH ')).toBe('dang anh');
    expect(foldAceName('Nguyễn  Văn')).toBe('nguyen van');
  });

  it('shows distinct same-name public nodes with published Big and year context', () => {
    const found = searchPublishedAceNodes(families, members, 'dang anh');
    expect(found.total).toBe(2);
    expect(new Set(found.matches.map((x) => x.member.id))).toEqual(new Set(['same-1', 'same-2']));
    expect(found.matches.find((x) => x.member.id === 'same-1')).toMatchObject({
      bigName: 'Grandbig', pickupLabel: '2023–24',
    });
    expect(found.matches.find((x) => x.member.id === 'same-2')?.family.slug).toBe('archive');
  });

  it('filters unpublished families and nodes, never guesses an unpublished parent', () => {
    expect(searchPublishedAceNodes(families, members, 'Dang').matches.map((x) => x.member.id))
      .toEqual(expect.arrayContaining(['same-1', 'same-2']));
    expect(searchPublishedAceNodes(families, members, 'Dang').matches).toHaveLength(2);
    expect(searchPublishedAceNodes(families, members, 'Unknown').matches[0].bigName).toBeNull();
    expect(searchPublishedAceNodes(families, members, 'does not exist')).toMatchObject({ total: 0, matches: [] });
  });

  it('limits results and refuses one-character broad enumeration', () => {
    const many = Array.from({ length: 55 }, (_, i) => member(`public-${i}`, 'active', `Test ${i}`));
    expect(searchPublishedAceNodes(families, many, 't').matches).toHaveLength(0);
    expect(searchPublishedAceNodes(families, many, 'test').total).toBe(55);
    expect(searchPublishedAceNodes(families, many, 'test').matches).toHaveLength(20);
    expect(searchPublishedAceNodes(families, many, 'test', 200).matches).toHaveLength(30);
  });

  it('makes URL links with published family slug/node ID only and resolves valid archive links', () => {
    const link = publishedAceNodePath(families[1], members[2]);
    expect(link).toBe('/ace?fam=archive&node=same-2');
    const params = new URLSearchParams(link.split('?')[1]);
    expect(resolvePublishedAceLink(families, members, params.get('fam'), params.get('node')))
      .toMatchObject({ status: 'published', family: { id: 'archive' }, member: { id: 'same-2' } });
  });

  it('fails closed on wrong, unpublished, removed and cross-Fam node links', () => {
    expect(resolvePublishedAceLink(families, members, null, null)).toEqual({ status: 'none' });
    for (const [slug, node] of [
      ['active', 'private-node'],
      ['private', 'private-node'],
      ['active', 'hidden'],
      ['archive', 'same-1'],
      ['active', 'removed'],
      [null, 'same-1'],
      ['unknown', 'same-1'],
    ] as Array<[string | null, string | null]>) {
      expect(resolvePublishedAceLink(families, members, slug, node)).toEqual({ status: 'invalid' });
    }
    expect(resolvePublishedAceLink(families, members, 'active', null))
      .toMatchObject({ status: 'published', family: { id: 'active' }, member: null });
  });
});
