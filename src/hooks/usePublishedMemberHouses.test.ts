import { batchVisibleHouseMemberIds } from './usePublishedMemberHouses';

describe('bounded visible House badge batches (#627)', () => {
  it('deduplicates and sorts visible IDs, then separates a 100-row page plus podium IDs', () => {
    const memberIds = Array.from({ length: 103 }, (_, index) => 'member-' + String(index).padStart(3, '0'));
    const batches = batchVisibleHouseMemberIds([...memberIds, memberIds[1], memberIds[2]]);
    expect(batches.map((batch) => batch.length)).toEqual([100, 3]);
    expect(batches.flat()).toEqual(memberIds);
    expect(new Set(batches.flat()).size).toBe(103);
  });
  it('does not fetch a House roster when no member ID is visible', () => {
    expect(batchVisibleHouseMemberIds([])).toEqual([]);
  });
  it('supports multiple complete 100-member pages without dropping any member', () => {
    const ids = Array.from({ length: 250 }, (_, index) => 'member-' + String(index).padStart(3, '0'));
    const batches = batchVisibleHouseMemberIds(ids);
    expect(batches.map((batch) => batch.length)).toEqual([100, 100, 50]);
    expect(batches.flat()).toEqual(ids);
  });
});
