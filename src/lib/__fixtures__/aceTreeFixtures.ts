import type { TreeNode } from '../aceTreeLayout';

const member = (id: string, parent: string | null, year?: number, term: string | null = null): TreeNode => ({
  id, parent, initial: id.charAt(0).toUpperCase(), label: 'Fictional Member ' + id,
  role: parent ? 'Little' : 'Big',
  pickup: year === undefined ? { status: 'unknown' } : {
    status: 'verified', academicYearStart: year, term,
  },
});

export const goldenPABC: TreeNode[] = [
  member('P', null, 2021, 'FA21'),
  member('B', 'P', 2023, 'FA23'), // Intentionally before A in source input.
  member('C', 'A', 2023, 'SP24'),
  member('A', 'P', 2022, 'FA22'),
];
export const bigAcrossYears = [
  member('Big', null, 2021), member('One', 'Big', 2022),
  member('Two', 'Big', 2023), member('Three', 'Big', 2025),
];
export const sameYearCousins = [
  member('Root', null, 2020), member('Left', 'Root', 2021),
  member('Right', 'Root', 2022), member('LeftChild', 'Left', 2024),
  member('RightChild', 'Right', 2024),
];
export const threeRoots = [
  member('A', null, 2021), member('B', null, 2022), member('C', null, 2023),
];
export const orphanAndDisconnected = [
  member('Root', null), member('Child', 'Root'),
  member('Orphan', 'unpublished-parent'), member('Separate', null),
];
export const fa23AndSp24 = [
  member('Big', null, 2023, 'FA23'), member('Little', 'Big', 2023, 'SP24'),
];
export const eightYearGap = [member('Old', null, 2015), member('New', 'Old', 2023)];
export const duplicateNames = [
  { ...member('Alpha', null, 2021), label: 'Member X' },
  { ...member('Beta', null, 2022), label: 'Member X' },
];
export const unknownMix = [
  member('UnknownBig', null), member('KnownLittle', 'UnknownBig', 2023),
  member('UnknownSibling', 'UnknownBig'),
];
export const legacyAllUnknown = [member('Root', null), member('Little', 'Root')];
export const sameYearParentChild = [
  member('Parent', null, 2021, 'FA21'), member('Child', 'Parent', 2021, 'FA21'),
];
export const childBeforeParent = [
  member('NewBig', null, 2024), member('OldLittle', 'NewBig', 2021),
];
export const cycle2 = [member('A', 'B'), member('B', 'A')];
export const cycle3 = [member('A', 'B'), member('B', 'C'), member('C', 'A')];
export const selfParent = [member('A', 'A')];
export const missingParent = [member('A', 'not-published', 2022)];
export const graveyardFam = [
  member('ArchivedRoot', null), member('ArchivedLittle', 'ArchivedRoot'),
];
/** Deterministic 153-node / 3-root fixture. No real genealogy or random inputs. */
export const large150: TreeNode[] = Array.from({ length: 153 }, (_, i) => {
  const root = Math.floor(i / 51);
  const within = i % 51;
  const id = 'N' + String(i).padStart(3, '0');
  const parent = within === 0 ? null : 'N' + String(i - 1).padStart(3, '0');
  return member(id, parent, 2017 + root + Math.floor(within / 5));
});
