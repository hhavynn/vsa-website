import {
  countBlockers,
  duplicateRowIds,
  findAceLittleDuplicates,
  findCabinetDuplicates,
  findLookalikeNames,
  findPersonInTwoHouses,
  findSameMemberTwice,
  findSameNameTwice,
  internDuplicates,
} from './adminConflicts';

describe('findSameMemberTwice', () => {
  it('flags one canonical member on two rows as a blocker', () => {
    const result = findSameMemberTwice([
      { id: 'a', label: 'Andy Nguyen', memberId: 'm1' },
      { id: 'b', label: 'A. Nguyen', memberId: 'm1' },
      { id: 'c', label: 'Bea', memberId: 'm2' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('blocker');
    expect(result[0].items.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('ignores unlinked rows', () => {
    expect(findSameMemberTwice([{ id: 'a', label: 'A' }, { id: 'b', label: 'A' }])).toEqual([]);
  });
});

describe('findSameNameTwice', () => {
  it('flags identical names regardless of case, accents, and spacing — as a warning, never a merge', () => {
    const result = findSameNameTwice([
      { id: 'a', label: 'Andy Nguyen' },
      { id: 'b', label: ' andy  nguyễn ' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('warning');
    expect(result[0].reason).toMatch(/two people with one name/);
  });
});

describe('findAceLittleDuplicates', () => {
  it('treats the same Little twice as a blocker, by member link or by name', () => {
    const result = findAceLittleDuplicates([
      { id: '1', label: 'Jenny Nguyen', memberId: 'm1' },
      { id: '2', label: 'Jenny N', memberId: 'm1' },
      { id: '3', label: 'Kevin Tran' },
      { id: '4', label: 'kevin tran' },
    ]);
    expect(result).toHaveLength(2);
    expect(countBlockers(result)).toBe(2);
  });

  it('does not double-report rows already flagged by member', () => {
    const result = findAceLittleDuplicates([
      { id: '1', label: 'Same Name', memberId: 'm1' },
      { id: '2', label: 'Same Name', memberId: 'm1' },
    ]);
    expect(result).toHaveLength(1);
  });
});

describe('findPersonInTwoHouses', () => {
  it('flags a member assigned to two different Houses and names both', () => {
    const result = findPersonInTwoHouses([
      { id: 'a', label: 'Kevin', memberId: 'm1', houseId: 'toad', houseLabel: 'Toad' },
      { id: 'b', label: 'Kevin', memberId: 'm1', houseId: 'boo', houseLabel: 'Boo' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toContain('Toad and Boo');
  });

  it('ignores the same House twice and unassigned rows', () => {
    expect(
      findPersonInTwoHouses([
        { id: 'a', label: 'K', memberId: 'm1', houseId: 'toad' },
        { id: 'b', label: 'K', memberId: 'm1', houseId: 'toad' },
        { id: 'c', label: 'K', memberId: 'm1', houseId: null },
      ]),
    ).toEqual([]);
  });
});

describe('findCabinetDuplicates', () => {
  it('blocks the same person twice in the same role', () => {
    const result = findCabinetDuplicates([
      { id: '1', role: 'Treasurer', name: 'Ada Lovelace', memberId: 'm1' },
      { id: '2', role: 'Treasurer', name: 'Ada Lovelace', memberId: 'm1' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'cabinet_duplicate_slot', severity: 'blocker' });
  });

  it('only warns when one person holds two different positions', () => {
    const result = findCabinetDuplicates([
      { id: '1', role: 'Treasurer', name: 'Ada Lovelace', memberId: 'm1' },
      { id: '2', role: 'Webmaster', name: 'Ada Lovelace', memberId: 'm1' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'cabinet_person_two_slots', severity: 'warning' });
  });

  it('ignores unfilled positions', () => {
    expect(findCabinetDuplicates([{ id: '1', role: 'A', name: null }, { id: '2', role: 'A', name: '' }])).toEqual([]);
  });
});

describe('findLookalikeNames', () => {
  it('flags names one letter apart or with reordered words, as non-exact warnings', () => {
    const result = findLookalikeNames([
      { id: 'a', label: 'Andy Nguyen' },
      { id: 'b', label: 'Andy Nguyem' },
      { id: 'c', label: 'Nguyen Andy' },
      { id: 'd', label: 'Zelda Park' },
    ]);
    expect(result.length).toBeGreaterThanOrEqual(2);
    for (const duplicate of result) {
      expect(duplicate.exact).toBe(false);
      expect(duplicate.severity).toBe('warning');
    }
    expect(duplicateRowIds(result).has('d')).toBe(false);
  });

  it('never calls two different canonical members duplicates', () => {
    expect(
      findLookalikeNames([
        { id: 'a', label: 'Andy Nguyen', memberId: 'm1' },
        { id: 'b', label: 'Andy Nguyem', memberId: 'm2' },
      ]),
    ).toEqual([]);
  });

  it('does not report identical names (that is the exact-duplicate check)', () => {
    expect(findLookalikeNames([{ id: 'a', label: 'Same Name' }, { id: 'b', label: 'same name' }])).toEqual([]);
  });
});

describe('internDuplicates', () => {
  it('combines member, identical-name, and lookalike checks without double counting', () => {
    const result = internDuplicates([
      { id: '1', label: 'Sarah Nguyen', memberId: 'm1' },
      { id: '2', label: 'Sarah Nguyen', memberId: 'm1' },
      { id: '3', label: 'Kevin Tran' },
      { id: '4', label: 'Kevin Tran' },
      { id: '5', label: 'Kevin Trann' },
    ]);
    expect(result.filter((item) => item.kind === 'same_intern_twice')).toHaveLength(2);
    expect(result.some((item) => item.kind === 'near_identical_rows')).toBe(true);
  });
});
