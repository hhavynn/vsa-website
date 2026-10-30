import {
  rolesForSelectedYear,
  shapePublishedCabinetRoles,
  type PublishedCabinetRoleRow,
} from './memberRoles';

const row = (
  id: string,
  memberId: string | null,
  role: string,
  category: string,
): PublishedCabinetRoleRow => ({ id, member_id: memberId, role, category });

describe('verified, year-scoped public member role mapping (#627)', () => {
  it('displays Board + exact published position, multiple positions, and Intern independently', () => {
    const roles = shapePublishedCabinetRoles([
      row('1', 'a', 'Events Chair', 'General Board'),
      row('2', 'a', 'PR Chair', 'General Board'),
      row('3', 'a', 'Intern', 'Interns'),
      row('4', 'b', 'Treasurer', 'Executive Board'),
      row('5', 'c', 'Intern', 'Interns'),
    ], ['a', 'b', 'c'], 2026);

    expect(roles.get('a')?.map((role) => role.label)).toEqual([
      'Board Member', 'Events Chair', 'PR Chair', 'Intern',
    ]);
    expect(roles.get('b')?.map((role) => role.label)).toEqual(['Board Member', 'Treasurer']);
    expect(roles.get('c')?.map((role) => role.label)).toEqual(['Intern']);
    expect(roles.get('c')?.some((role) => role.kind === 'board')).toBe(false);
  });

  it('deduplicates repeated public roles without erasing two different Cabinet positions', () => {
    const roles = shapePublishedCabinetRoles([
      row('1', 'a', 'Events Chair', 'General Board'),
      row('2', 'a', ' events chair ', 'General Board'),
      row('3', 'a', 'Events Chair', 'Executive Board'),
      row('4', 'a', 'Intern', 'Interns'),
      row('5', 'a', 'Intern', 'Interns'),
    ], ['a'], 2026);

    expect(roles.get('a')?.map((role) => role.label)).toEqual([
      'Board Member', 'Events Chair', 'Intern',
    ]);
  });

  it('does not infer a badge from an unlinked name, draft category, or member absent from the visible ID set', () => {
    const roles = shapePublishedCabinetRoles([
      row('1', null, 'President', 'Executive Board'),
      row('2', 'a', 'Fake role', 'Draft'),
      row('3', 'other', 'President', 'Executive Board'),
      row('4', 'a', 'Intern', 'Interns'),
    ], ['a'], 2026);
    expect(roles.get('a')?.map((role) => role.label)).toEqual(['Intern']);
    expect(roles.has('other')).toBe(false);
    expect(roles.has('Robert Le')).toBe(false);
  });

  it('never presents a 2025–26 role as current in 2026–27 or All-Time', () => {
    const roles = shapePublishedCabinetRoles([row('1', 'a', 'President', 'Executive Board')], ['a'], 2025);
    expect(rolesForSelectedYear(roles, 'a', 2025)).toHaveLength(2);
    expect(rolesForSelectedYear(roles, 'a', 2026)).toEqual([]);
    expect(rolesForSelectedYear(roles, 'a', 'all')).toEqual([]);
    expect(rolesForSelectedYear(roles, 'a', null)).toEqual([]);
  });

  it('preserves a published role label as ordinary UI text, without inventing House/VCN/ACE status', () => {
    const roles = shapePublishedCabinetRoles([
      row('1', 'a', '<img src=x onerror=alert(1)>', 'General Board'),
    ], ['a'], 2026);
    expect(roles.get('a')?.[1].label).toBe('<img src=x onerror=alert(1)>');
    expect(roles.get('a')?.map((role) => role.kind)).toEqual(['board', 'cabinet_position']);
  });
});
