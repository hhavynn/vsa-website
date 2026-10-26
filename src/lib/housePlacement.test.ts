import {
  PlacementApplicant,
  PlacementHouse,
  allocateHouseApplicants,
  comparePriority,
  dedupeApplicants,
  findPriorityViolations,
  firstChoiceDemand,
  suggestCapacities,
  validateCapacities,
} from './housePlacement';

const RARITY = 'h-rarity';
const PINKIE = 'h-pinkie';
const APPLE = 'h-apple';
const TWILIGHT = 'h-twilight';
const houses: PlacementHouse[] = [
  { id: RARITY, label: 'Rarity', displayOrder: 1 },
  { id: PINKIE, label: 'Pinkie Pie', displayOrder: 2 },
  { id: APPLE, label: 'Applejack', displayOrder: 3 },
  { id: TWILIGHT, label: 'Twilight Sparkle', displayOrder: 4 },
];
const BASE = Date.UTC(2026, 9, 22, 4, 0, 0);
const minute = 60_000;

function applicant(id: string, minutesIn: number, preferences: string[], overrides: Partial<PlacementApplicant> = {}): PlacementApplicant {
  return {
    id,
    name: `Applicant ${id}`,
    email: `${id}@example.test`,
    submittedAtMs: BASE + minutesIn * minute,
    sourceRow: Number(id.replace(/\D/g, '')) + 1 || 2,
    preferences,
    ...overrides,
  };
}

function caps(rarity: number, pinkie: number, apple: number, twilight: number) {
  return { [RARITY]: rarity, [PINKIE]: pinkie, [APPLE]: apple, [TWILIGHT]: twilight };
}

function placed(result: ReturnType<typeof allocateHouseApplicants>) {
  if (!result.ok) throw new Error(result.errors.map((error) => error.message).join('; '));
  return new Map(result.placements.map((placement) => [placement.applicantId, placement]));
}

const ALL = [RARITY, PINKIE, APPLE, TWILIGHT];

describe('allocateHouseApplicants', () => {
  it('assigns every applicant to their first choice when capacities equal demand', () => {
    const result = allocateHouseApplicants({
      houses,
      capacities: caps(1, 1, 1, 1),
      applicants: [
        applicant('a1', 1, [RARITY, PINKIE, APPLE, TWILIGHT]),
        applicant('a2', 2, [PINKIE, RARITY, APPLE, TWILIGHT]),
        applicant('a3', 3, [APPLE, RARITY, PINKIE, TWILIGHT]),
        applicant('a4', 4, [TWILIGHT, RARITY, PINKIE, APPLE]),
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.placements.every((placement) => placement.achievedRank === 1)).toBe(true);
    expect(result.rankCounts).toEqual([4, 0, 0, 0]);
  });

  it('gives the earlier applicant priority over a later one for the same House', () => {
    const result = placed(allocateHouseApplicants({
      houses,
      capacities: caps(1, 1, 1, 1),
      applicants: [
        applicant('a2', 20, [RARITY, PINKIE, APPLE, TWILIGHT]),
        applicant('a1', 0, [RARITY, APPLE, PINKIE, TWILIGHT]),
        applicant('a3', 30, [PINKIE, APPLE, RARITY, TWILIGHT]),
        applicant('a4', 40, [APPLE, TWILIGHT, RARITY, PINKIE]),
      ],
    }));
    expect(result.get('a1')?.houseId).toBe(RARITY);
    expect(result.get('a2')?.houseId).toBe(PINKIE);
    expect(result.get('a2')?.explanation).toBe('Assigned to Pinkie Pie (2nd choice). Rarity was full when this applicant was processed.');
  });

  it('keeps an early second-choice placement even when a later applicant ranked that House first', () => {
    // A (9:00 PM) wants Rarity then Pinkie Pie; Rarity is already full. B (9:20 PM) wants Pinkie Pie first.
    const result = placed(allocateHouseApplicants({
      houses,
      capacities: caps(1, 1, 1, 1),
      applicants: [
        applicant('a0', -10, [RARITY, APPLE, PINKIE, TWILIGHT]),
        applicant('a1', 0, [RARITY, PINKIE, APPLE, TWILIGHT]),
        applicant('a2', 20, [PINKIE, RARITY, APPLE, TWILIGHT]),
        applicant('a3', 30, [TWILIGHT, APPLE, RARITY, PINKIE]),
      ],
    }));
    expect(result.get('a1')?.houseId).toBe(PINKIE);
    expect(result.get('a2')?.houseId).not.toBe(PINKIE);
    expect(result.get('a2')?.achievedRank).toBe(3);
  });

  it('never exceeds capacity, even when one House is overwhelmingly popular', () => {
    const applicants = Array.from({ length: 40 }, (_, index) => applicant(`a${index}`, index, [RARITY, PINKIE, APPLE, TWILIGHT]));
    const result = allocateHouseApplicants({ houses, capacities: caps(10, 10, 10, 10), applicants });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.houseCounts).toEqual(caps(10, 10, 10, 10));
    expect(result.rankCounts).toEqual([10, 10, 10, 10]);
    const byId = placed(result);
    expect(byId.get('a0')?.houseId).toBe(RARITY);
    expect(byId.get('a9')?.houseId).toBe(RARITY);
    expect(byId.get('a10')?.houseId).toBe(PINKIE);
    expect(byId.get('a39')?.houseId).toBe(TWILIGHT);
    expect(byId.get('a39')?.explanation).toBe('Assigned to Twilight Sparkle (4th choice). Rarity, Pinkie Pie, and Applejack were full when this applicant was processed.');
  });

  it('is deterministic: the same input, in any input order, gives identical results', () => {
    const applicants = Array.from({ length: 30 }, (_, index) =>
      applicant(`a${index}`, (index * 7) % 13, [ALL[index % 4], ALL[(index + 1) % 4], ALL[(index + 2) % 4], ALL[(index + 3) % 4]]));
    const capacities = suggestCapacities(houses, 30, firstChoiceDemand(houses, applicants));
    const first = allocateHouseApplicants({ houses, capacities, applicants });
    const second = allocateHouseApplicants({ houses, capacities, applicants });
    const reversed = allocateHouseApplicants({ houses, capacities, applicants: [...applicants].reverse() });
    expect(second).toEqual(first);
    expect(reversed).toEqual(first);
  });

  it('orders unsorted timestamps chronologically', () => {
    const result = allocateHouseApplicants({
      houses,
      capacities: caps(1, 1, 1, 0),
      applicants: [
        applicant('late', 50, [RARITY, PINKIE, APPLE]),
        applicant('early', 1, [RARITY, PINKIE, APPLE]),
        applicant('mid', 25, [RARITY, PINKIE, APPLE]),
      ],
    });
    expect(result.ok && result.placements.map((placement) => [placement.applicantId, placement.priority, placement.houseId])).toEqual([
      ['early', 1, RARITY],
      ['mid', 2, PINKIE],
      ['late', 3, APPLE],
    ]);
  });

  it('breaks exact timestamp ties by source row, then by id', () => {
    const result = allocateHouseApplicants({
      houses,
      capacities: caps(1, 1, 1, 0),
      applicants: [
        applicant('x', 0, [RARITY, PINKIE, APPLE], { sourceRow: 9 }),
        applicant('y', 0, [RARITY, PINKIE, APPLE], { sourceRow: 4 }),
        applicant('b', 0, [RARITY, PINKIE, APPLE], { sourceRow: 12 }),
      ],
    });
    expect(result.ok && result.placements.map((placement) => placement.applicantId)).toEqual(['y', 'x', 'b']);
    expect(comparePriority({ id: 'a', sourceRow: 3, submittedAtMs: 1 }, { id: 'b', sourceRow: 3, submittedAtMs: 1 })).toBeLessThan(0);
  });

  it('keeps the earliest submission for a repeated email, with its original rankings', () => {
    const result = allocateHouseApplicants({
      houses,
      capacities: caps(1, 0, 0, 0),
      applicants: [
        applicant('again', 30, [PINKIE, RARITY, APPLE, TWILIGHT], { email: 'Same@Example.test' }),
        applicant('first', 5, [RARITY, PINKIE, APPLE, TWILIGHT], { email: 'same@example.test' }),
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.placements).toHaveLength(1);
    expect(result.placements[0]).toMatchObject({ applicantId: 'first', houseId: RARITY, achievedRank: 1 });
    expect(result.duplicates).toEqual([{ applicantId: 'again', keptApplicantId: 'first', preferencesDiffer: true }]);
  });

  it('never merges applicants without an email', () => {
    const { kept } = dedupeApplicants([
      applicant('a1', 0, [RARITY], { email: null }),
      applicant('a2', 1, [RARITY], { email: null }),
    ]);
    expect(kept).toHaveLength(2);
  });

  it('never lets a later applicant displace an earlier one', () => {
    const applicants = Array.from({ length: 24 }, (_, index) =>
      applicant(`a${index}`, index, [ALL[(index * 3) % 4], ALL[(index * 3 + 1) % 4], ALL[(index * 3 + 2) % 4], ALL[(index * 3 + 3) % 4]]));
    const result = allocateHouseApplicants({ houses, capacities: caps(6, 6, 6, 6), applicants });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = placed(result);
    const ordered = [...applicants].sort(comparePriority).map((item) => ({ id: item.id, preferences: item.preferences, houseId: byId.get(item.id)?.houseId ?? null }));
    expect(findPriorityViolations(ordered)).toEqual([]);
  });

  it('keeps a provisional placement for every applicant regardless of member matching', () => {
    // The allocator never sees member records; an unmatched member is simply another applicant.
    const result = allocateHouseApplicants({
      houses,
      capacities: caps(1, 1, 0, 0),
      applicants: [applicant('linked', 0, [RARITY, PINKIE]), applicant('not-yet-linked', 1, [RARITY, PINKIE])],
    });
    expect(result.ok && result.placements.map((placement) => placement.applicantId)).toEqual(['linked', 'not-yet-linked']);
  });

  it('handles no applicants and a single applicant', () => {
    expect(allocateHouseApplicants({ houses, capacities: caps(0, 0, 0, 0), applicants: [] })).toMatchObject({ ok: true, placements: [] });
    const one = allocateHouseApplicants({ houses, capacities: suggestCapacities(houses, 1, { [APPLE]: 1 }), applicants: [applicant('a1', 0, [APPLE, RARITY, PINKIE, TWILIGHT])] });
    expect(one.ok && one.placements[0].houseId).toBe(APPLE);
  });

  it('handles four Houses with fewer than four applicants', () => {
    const applicants = [applicant('a1', 0, [PINKIE, RARITY, APPLE, TWILIGHT]), applicant('a2', 1, [PINKIE, APPLE, RARITY, TWILIGHT]), applicant('a3', 2, [RARITY, PINKIE, APPLE, TWILIGHT])];
    const capacities = suggestCapacities(houses, 3, firstChoiceDemand(houses, applicants));
    expect(capacities).toEqual(caps(1, 1, 1, 0));
    const byId = placed(allocateHouseApplicants({ houses, capacities, applicants }));
    expect(byId.get('a1')?.houseId).toBe(PINKIE);
    expect(byId.get('a2')?.houseId).toBe(APPLE);
    expect(byId.get('a3')?.houseId).toBe(RARITY);
  });

  it('rejects capacity totals that differ from the applicant count', () => {
    const result = allocateHouseApplicants({ houses, capacities: caps(2, 1, 1, 1), applicants: [applicant('a1', 0, ALL)] });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.map((error) => error.code)).toEqual(['capacity_mismatch']);
  });

  it('rejects negative, fractional or missing capacities and duplicate Houses', () => {
    expect(validateCapacities(houses, caps(-1, 1, 1, 0), 1).map((error) => error.code)).toEqual(['invalid_capacity']);
    expect(validateCapacities(houses, caps(0.5, 0.5, 0, 0), 1).map((error) => error.code)).toEqual(['invalid_capacity', 'invalid_capacity']);
    expect(validateCapacities(houses, { [RARITY]: 1 }, 1).map((error) => error.code)).toEqual(['missing_capacity', 'missing_capacity', 'missing_capacity']);
    expect(validateCapacities([...houses, houses[0]], caps(1, 0, 0, 0), 1).map((error) => error.code)).toContain('duplicate_house');
    expect(validateCapacities(houses, { ...caps(1, 0, 0, 0), stray: 0 }, 1).map((error) => error.code)).toEqual(['unknown_capacity_house']);
    expect(validateCapacities([], {}, 0).map((error) => error.code)).toEqual(['no_houses']);
  });

  it('rejects unknown Houses, repeated rankings, and missing or invalid timestamps', () => {
    const result = allocateHouseApplicants({
      houses,
      capacities: caps(1, 1, 1, 1),
      applicants: [
        applicant('a1', 0, [RARITY, 'h-unknown']),
        applicant('a2', 1, [PINKIE, PINKIE, PINKIE, PINKIE]),
        applicant('a3', Number.NaN, [APPLE]),
        applicant('a4', 3, []),
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.placements).toEqual([]);
    expect(result.errors.map((error) => [error.code, error.applicantId])).toEqual([
      ['unknown_house', 'a1'],
      ['duplicate_preference', 'a2'],
      ['duplicate_preference', 'a2'],
      ['duplicate_preference', 'a2'],
      ['invalid_timestamp', 'a3'],
      ['no_preferences', 'a4'],
    ]);
  });

  it('reports an applicant who cannot be placed instead of dropping them', () => {
    const result = allocateHouseApplicants({
      houses,
      capacities: caps(1, 1, 0, 0),
      applicants: [applicant('a1', 0, [RARITY]), applicant('a2', 1, [RARITY])],
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toEqual([expect.objectContaining({ code: 'unplaceable', applicantId: 'a2' })]);
  });
});

describe('suggestCapacities', () => {
  it('splits an odd count so sizes differ by at most one', () => {
    const capacities = suggestCapacities(houses, 17, {});
    const sizes = Object.values(capacities);
    expect(sizes.reduce((sum, value) => sum + value, 0)).toBe(17);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it('gives 155 applicants over four Houses 39/39/39/38, extra seats following first-choice demand', () => {
    const demand = { [RARITY]: 85, [PINKIE]: 38, [APPLE]: 21, [TWILIGHT]: 10 };
    expect(suggestCapacities(houses, 155, demand)).toEqual(caps(39, 39, 39, 38));
  });

  it('breaks tied demand by display order, then id', () => {
    expect(suggestCapacities(houses, 6, { [TWILIGHT]: 5, [APPLE]: 2, [PINKIE]: 2, [RARITY]: 0 })).toEqual(caps(1, 2, 1, 2));
    const sameOrder: PlacementHouse[] = [{ id: 'b', label: 'B', displayOrder: 1 }, { id: 'a', label: 'A', displayOrder: 1 }];
    expect(suggestCapacities(sameOrder, 1, {})).toEqual({ a: 1, b: 0 });
  });

  it('places 155 applicants within the default capacities, all ranked, with no priority violations', () => {
    const order = (index: number) => {
      if (index % 155 < 85) return [RARITY, PINKIE, APPLE, TWILIGHT];
      if (index % 155 < 123) return [PINKIE, RARITY, TWILIGHT, APPLE];
      if (index % 155 < 144) return [APPLE, TWILIGHT, PINKIE, RARITY];
      return [TWILIGHT, APPLE, RARITY, PINKIE];
    };
    const applicants = Array.from({ length: 155 }, (_, index) => applicant(`a${index}`, (index * 37) % 155, order(index)));
    const capacities = suggestCapacities(houses, 155, firstChoiceDemand(houses, applicants));
    const result = allocateHouseApplicants({ houses, capacities, applicants });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.placements).toHaveLength(155);
    expect(result.houseCounts).toEqual(caps(39, 39, 39, 38));
    expect(result.rankCounts.reduce((sum, value) => sum + value, 0)).toBe(155);
  });
});

describe('findPriorityViolations', () => {
  it('flags an earlier applicant who lost a preferred House to a later one', () => {
    expect(findPriorityViolations([
      { id: 'early', preferences: [RARITY, PINKIE], houseId: PINKIE },
      { id: 'late', preferences: [PINKIE, RARITY], houseId: RARITY },
    ])).toEqual([{ applicantId: 'early', laterApplicantId: 'late', houseId: RARITY }]);
  });
});
