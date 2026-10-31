import { comparePickup, edgeGeometry, layoutTree, uniqueTreeNodes } from './aceTreeLayout';
import {
  bigAcrossYears, childBeforeParent, cycle2, cycle3, duplicateNames, eightYearGap,
  fa23AndSp24, goldenPABC, graveyardFam, large150, legacyAllUnknown,
  missingParent, orphanAndDisconnected, sameYearCousins, sameYearParentChild,
  selfParent, threeRoots, unknownMix,
} from './__fixtures__/aceTreeFixtures';

const noOverlapOnARow = (positions: Record<string, { x: number; y: number }>) => {
  const nodes = Object.values(positions);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[i].y === nodes[j].y) {
        expect(Math.abs(nodes[i].x - nodes[j].x)).toBeGreaterThanOrEqual(1);
      }
    }
  }
};

describe('ACE chronological tree layout (#671 and #675)', () => {
  it('golden P/A/B/C: descendants of different depths share 2023 row, siblings do not', () => {
    const result = layoutTree(goldenPABC);
    const { P, A, B, C } = result.positions;
    expect(result.mode).toBe('year');
    expect(P.y).toBeLessThan(A.y);
    expect(A.y).toBeLessThan(B.y);
    expect(B.y).toBe(C.y);
    expect(B.x).not.toBe(C.x);
    expect(result.parentById).toEqual({ P: null, B: 'P', C: 'A', A: 'P' });
    expect(Object.values(result.parentById).filter(Boolean)).toHaveLength(3);
    expect(result.yearBands.map((band) => band.key)).toEqual([2021, 2022, 2023]);
    noOverlapOnARow(result.positions);
  });

  it('same-year cousins at different generation depths occupy the same row', () => {
    const p = layoutTree(sameYearCousins).positions;
    expect(p.LeftChild.y).toBe(p.RightChild.y);
    noOverlapOnARow(p);
  });

  it('siblings picked up in three different years have different bands', () => {
    const result = layoutTree(bigAcrossYears);
    expect(new Set(['One', 'Two', 'Three'].map((key) => result.positions[key].y)).size).toBe(3);
  });

  it('FA23 and SP24 belong to one academic-year band, with safe lane for parent and Little', () => {
    const r = layoutTree(fa23AndSp24);
    expect(r.yearBands.map((b) => b.key)).toEqual([2023]);
    expect(r.positions.Big.y).not.toBe(r.positions.Little.y);
    noOverlapOnARow(r.positions);
  });

  it('keeps empty gap years at full-height bands', () => {
    const r = layoutTree(eightYearGap);
    expect(r.yearBands.map((b) => b.key)).toEqual([2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023]);
    expect(r.positions.New.y - r.positions.Old.y).toBe(8);
  });

  it('puts undated ancestors in an explicit unknown band instead of guessing from Big', () => {
    const r = layoutTree(unknownMix);
    expect(r.mode).toBe('year');
    expect(r.yearBands[0].key).toBe('unknown');
    expect(r.bandKeyById.UnknownBig).toBe('unknown');
    expect(r.bandKeyById.UnknownSibling).toBe('unknown');
    expect(r.positions.UnknownBig.y).toBeLessThan(r.positions.UnknownSibling.y);
    expect(r.positions.KnownLittle.y).toBeGreaterThan(r.positions.UnknownSibling.y);
  });

  it('keeps generation positioning for all unknown and below 25% known', () => {
    const a = layoutTree(legacyAllUnknown);
    expect(a.mode).toBe('generation');
    expect(a.yearBands).toEqual([]);
    expect(a.positions.Root.y).toBe(0);
    expect(a.positions.Little.y).toBe(1);
    expect(layoutTree(graveyardFam).mode).toBe('generation');
    const b = layoutTree([
      ...legacyAllUnknown, { id: 'X', initial: 'X', label: 'Member X', role: 'Big', parent: null },
      { id: 'Y', initial: 'Y', label: 'Member Y', role: 'Big', parent: null },
      { id: 'Z', initial: 'Z', label: 'Member Z', role: 'Big', parent: null },
      { id: 'Verified', initial: 'V', label: 'Member V', role: 'Big', parent: null,
        pickup: { status: 'verified', academicYearStart: 2023, term: null } as const },
    ]);
    expect(b.mode).toBe('generation');
  });

  it('reports same-term Little and child older than Big without moving the source values', () => {
    const same = layoutTree(sameYearParentChild);
    expect(same.issues).toContainEqual({ kind: 'same_term_as_big', nodeIds: ['Parent', 'Child'] });
    expect(same.positions.Parent.y).not.toBe(same.positions.Child.y);
    const before = layoutTree(childBeforeParent);
    expect(before.issues).toContainEqual({ kind: 'child_before_big', nodeIds: ['NewBig', 'OldLittle'] });
    expect(before.positions.OldLittle.y).toBeLessThan(before.positions.NewBig.y);
    expect(before.parentById.OldLittle).toBe('NewBig');
  });

  it('repairs cycles deterministically and positions every member', () => {
    for (const nodes of [cycle2, cycle3, selfParent]) {
      const original = nodes.map((node) => node.parent);
      const layout = layoutTree(nodes);
      expect(Object.keys(layout.positions).sort()).toEqual(nodes.map((n) => n.id).sort());
      expect(layout.issues.some((item) => item.kind === 'cycle' || item.kind === 'self_parent')).toBe(true);
      expect(nodes.map((node) => node.parent)).toEqual(original);
      noOverlapOnARow(layout.positions);
    }
    expect(layoutTree(cycle3).parentById.A).toBeNull();
  });

  it('deduplicates repeated IDs first-wins and reports the conflict', () => {
    const nodes = [...duplicateNames, { ...duplicateNames[0], parent: 'Beta' }];
    expect(uniqueTreeNodes(nodes)).toHaveLength(2);
    const r = layoutTree(nodes);
    expect(Object.keys(r.positions)).toHaveLength(2);
    expect(r.issues).toContainEqual({ kind: 'duplicate_id', nodeIds: ['Alpha'] });
  });

  it('treats missing parents as roots and handles separate and archived families', () => {
    const missing = layoutTree(missingParent);
    expect(missing.parentById.A).toBeNull();
    expect(layoutTree(threeRoots).totalWidth).toBe(3);
    const disconnected = layoutTree(orphanAndDisconnected);
    expect(Object.keys(disconnected.positions)).toHaveLength(4);
    expect(layoutTree(graveyardFam).positions.ArchivedLittle.y).toBe(1);
  });

  it('is independent of source input ordering for unique IDs', () => {
    const a = layoutTree([...goldenPABC]);
    const b = layoutTree([...goldenPABC].reverse());
    expect(a.positions).toEqual(b.positions);
    expect(a.yearBands).toEqual(b.yearBands);
    expect(a.parentById).toEqual(b.parentById);
  });

  it('places more than 150 nodes in three disjoint subtrees without overlap', () => {
    const r = layoutTree(large150);
    expect(r.mode).toBe('year');
    expect(Object.keys(r.positions)).toHaveLength(153);
    expect(r.totalWidth).toBeGreaterThanOrEqual(3);
    noOverlapOnARow(r.positions);
  });

  it('compares approved term ordering, and never invents missing term ordering', () => {
    const year = (y: number, term: string | null) => ({
      status: 'verified' as const, academicYearStart: y, term,
    });
    expect(comparePickup(year(2021, 'FA21'), year(2021, 'SP22'))).toBe(-1);
    expect(comparePickup(year(2021, 'SP22'), year(2022, 'FA22'))).toBe(-1);
    expect(comparePickup(year(2021, null), year(2021, 'SP22'))).toBeNull();
    expect(comparePickup({ status: 'unknown' }, year(2021, 'FA21'))).toBeNull();
  });

  it('uses legacy adjacent-row cubic geometry and includes long straight drops', () => {
    const a = { x: 50, y: 60 }, b = { x: 160, y: 208 };
    const adjacent = edgeGeometry(a, b, 28, 148);
    expect(adjacent.d).toBe('M 50 88 C 50 134, 160 134, 160 180');
    expect(adjacent.upward).toBe(false);
    const long = edgeGeometry(a, { x: 160, y: 60 + 5 * 148 }, 28, 148);
    expect(long.d).toContain(' L 160 ');
    expect(long.length).toBeGreaterThan(adjacent.length);
    const up = edgeGeometry(b, a, 28, 148);
    expect(up.upward).toBe(true);
    expect(up.d).toContain('160 180');
    expect(up.d).toContain('50 128');
  });
});
