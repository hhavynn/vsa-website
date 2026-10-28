import { AceFamilyMember } from '../types';
import { layoutTree } from '../components/features/ace/FamilyTree';
import { generationDepth, membersToTreeNodes } from './aceFamilyAdapter';

const member = (overrides: Partial<AceFamilyMember>): AceFamilyMember => ({
  id: 'node',
  family_id: 'fam',
  name: 'Someone',
  role_label: 'Little',
  photo_url: null,
  parent_member_id: null,
  member_id: null,
  display_order: 0,
  is_published: true,
  created_at: '',
  updated_at: '',
  ...overrides,
});

describe('membersToTreeNodes pickup year', () => {
  it('carries an approved FA23 as 2023–24 with its term label', () => {
    const [node] = membersToTreeNodes([
      member({ pickup_academic_year_start: 2023, pickup_term: 'FA23' }),
    ]);
    expect(node.pickup).toEqual({ status: 'verified', academicYearStart: 2023, term: 'FA23' });
    expect(node.cohort).toBe('FA23');
  });

  it('labels a year-only approval with the academic year, not a made-up term', () => {
    const [node] = membersToTreeNodes([member({ pickup_academic_year_start: 2021, pickup_term: null })]);
    expect(node.pickup).toEqual({ status: 'verified', academicYearStart: 2021, term: null });
    expect(node.cohort).toBe('2021–22');
  });

  it('keeps every node of an all-unknown tree unknown and still renders a layout', () => {
    const members = [
      member({ id: 'root', role_label: 'Big' }),
      member({ id: 'kid', parent_member_id: 'root', pickup_academic_year_start: null, pickup_term: null }),
    ];
    const nodes = membersToTreeNodes(members);
    expect(nodes.map((n) => [n.cohort, n.pickup])).toEqual([
      [null, { status: 'unknown' }],
      [null, { status: 'unknown' }],
    ]);
    expect(Object.keys(layoutTree(nodes).positions).sort()).toEqual(['kid', 'root']);
  });

  it('reads rows from before the migration (no pickup columns) as unknown', () => {
    const legacyRow = member({});
    expect('pickup_academic_year_start' in legacyRow).toBe(false);
    expect(membersToTreeNodes([legacyRow])[0].pickup).toEqual({ status: 'unknown' });
  });

  it("never gives a Little their Big's year, or one derived from generation", () => {
    const members = [
      member({ id: 'big', role_label: 'Big', pickup_academic_year_start: 2021, pickup_term: 'FA21' }),
      member({ id: 'little', parent_member_id: 'big' }),
      member({ id: 'grandlittle', parent_member_id: 'little' }),
    ];
    expect(generationDepth(members)).toBe(3);
    const byId = Object.fromEntries(membersToTreeNodes(members).map((n) => [n.id, n]));
    expect(byId.big.cohort).toBe('FA21');
    expect(byId.little.pickup).toEqual({ status: 'unknown' });
    expect(byId.grandlittle.pickup).toEqual({ status: 'unknown' });
  });

  it('a Big gaining Littles in later years keeps their own year', () => {
    const members = [
      member({ id: 'big', role_label: 'Big', pickup_academic_year_start: 2021, pickup_term: 'FA21' }),
      member({ id: 'l1', parent_member_id: 'big', pickup_academic_year_start: 2022, pickup_term: 'FA22' }),
      member({ id: 'l2', parent_member_id: 'big', pickup_academic_year_start: 2024, pickup_term: 'SP25' }),
    ];
    const byId = Object.fromEntries(membersToTreeNodes(members).map((n) => [n.id, n.cohort]));
    expect(byId).toEqual({ big: 'FA21', l1: 'FA22', l2: 'SP25' });
  });

  it('shows nothing for a value that breaks the database invariants', () => {
    const [node] = membersToTreeNodes([member({ pickup_academic_year_start: 2023, pickup_term: 'SP23' })]);
    expect(node.pickup).toEqual({ status: 'unknown' });
    expect(node.cohort).toBeNull();
  });

  it('leaves layout (generation rows) unchanged; chronological rows are #671', () => {
    const members = [
      member({ id: 'root', role_label: 'Big' }),
      member({ id: 'kid', parent_member_id: 'root' }),
    ];
    const dated = members.map((m, i) => ({ ...m, pickup_academic_year_start: 2020 + i * 3, pickup_term: null }));
    expect(layoutTree(membersToTreeNodes(dated)).positions).toEqual(
      layoutTree(membersToTreeNodes(members)).positions,
    );
  });
});
