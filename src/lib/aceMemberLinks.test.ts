import type { AceFamilyMember } from '../types';
import {
  AceMemberLinkRef,
  applyRenameLinkGuard,
  reviewUnlinkedNodes,
  selectBulkLinks,
  summarizeLinks,
} from './aceMemberLinks';
import { buildMemberNameIndex, toMemberOption } from './memberLinkMatching';

const node = (id: string, name: string, memberId: string | null = null): AceFamilyMember => ({
  id,
  family_id: 'fam-1',
  name,
  role_label: null,
  photo_url: null,
  parent_member_id: null,
  member_id: memberId,
  display_order: 0,
  is_published: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const index = buildMemberNameIndex(
  [
    ['m-tommy', 'Tommy', 'Tran', 'Sixth', 'Third Year'],
    ['m-jen', 'Jennifer', 'Nguyen', 'Muir', 'Second Year'],
    ['m-andy-1', 'Andy', 'Tran', 'Seventh', null],
    ['m-andy-2', 'Andy', 'Tran', 'Muir', null],
    ['m-kevin', 'Kevin', 'Ngo', 'Warren', null],
    ['m-linked', 'Linked', 'Person', null, null],
  ].map(([id, first, last, college, year]) =>
    toMemberOption({ id: id as string, first_name: first, last_name: last, college, year }),
  ),
);

describe('reviewUnlinkedNodes', () => {
  it('categorizes unique, ambiguous, and missing matches and skips linked nodes', () => {
    const items = reviewUnlinkedNodes(
      [
        node('n1', 'Tommy Tran'),
        node('n2', 'jennifer  nguyen'),
        node('n3', 'Andy Tran'),
        node('n4', 'Old Alumni Name'),
        node('n5', 'Linked Person', 'm-linked'),
      ],
      index,
      [],
    );
    expect(items.map((item) => [item.node.id, item.status, item.candidates.map((c) => c.id)])).toEqual([
      ['n1', 'recommended', ['m-tommy']],
      ['n2', 'recommended', ['m-jen']],
      ['n3', 'ambiguous', ['m-andy-1', 'm-andy-2']],
      ['n4', 'none', []],
    ]);
  });

  it('flags a unique match already linked to another node instead of recommending it', () => {
    const links: AceMemberLinkRef[] = [
      { nodeId: 'other-fam-node', memberId: 'm-kevin', nodeName: 'Kevin Ngo', familyName: 'Sweatpants' },
    ];
    const [item] = reviewUnlinkedNodes([node('n1', 'Kevin Ngo')], index, links);
    expect(item.status).toBe('conflict');
    expect(item.conflictsWith).toEqual(['Kevin Ngo (Sweatpants)']);
  });

  it('flags two unlinked nodes that uniquely match the same member', () => {
    const items = reviewUnlinkedNodes([node('n1', 'Tommy Tran'), node('n2', 'Tommy Tran')], index, []);
    expect(items.map((item) => item.status)).toEqual(['conflict', 'conflict']);
  });
});

describe('selectBulkLinks', () => {
  const items = reviewUnlinkedNodes(
    [
      node('n1', 'Tommy Tran'),
      node('n2', 'Jennifer Nguyen'),
      node('n3', 'Andy Tran'),
      node('n4', 'Old Alumni Name'),
      node('n5', 'Kevin Ngo'),
    ],
    index,
    [{ nodeId: 'elsewhere', memberId: 'm-kevin', nodeName: 'Kevin Ngo', familyName: null }],
  );

  it('applies only reviewed (still selected) unique matches', () => {
    expect(selectBulkLinks(items, new Set(['n1', 'n2']))).toEqual([
      { nodeId: 'n1', memberId: 'm-tommy' },
      { nodeId: 'n2', memberId: 'm-jen' },
    ]);
    expect(selectBulkLinks(items, new Set(['n2']))).toEqual([{ nodeId: 'n2', memberId: 'm-jen' }]);
  });

  it('never includes ambiguous, conflicting, or unmatched nodes even if selected', () => {
    expect(selectBulkLinks(items, new Set(['n3', 'n4', 'n5']))).toEqual([]);
  });
});

describe('summarizeLinks', () => {
  it('counts linked nodes', () => {
    expect(summarizeLinks([node('a', 'A', 'm1'), node('b', 'B'), node('c', 'C', 'm2')])).toEqual({
      linked: 2,
      total: 3,
    });
  });
});

describe('applyRenameLinkGuard', () => {
  it('clears a stale member link when the node is genuinely renamed', () => {
    expect(applyRenameLinkGuard('Tommy Tran', { name: 'Jennifer Nguyen', role_label: 'Little' })).toEqual({
      name: 'Jennifer Nguyen',
      role_label: 'Little',
      member_id: null,
    });
  });

  it('keeps the link for whitespace/case-only edits or saves without a name', () => {
    const casing = { name: '  tommy   TRAN ' };
    expect(applyRenameLinkGuard('Tommy Tran', casing)).toBe(casing);
    const roleOnly: { name?: string; role_label: string } = { role_label: 'Big' };
    expect(applyRenameLinkGuard('Tommy Tran', roleOnly)).toBe(roleOnly);
  });
});
