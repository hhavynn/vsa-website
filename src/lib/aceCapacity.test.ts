import { computeHybridBigCapacity, parseCapacitySuggestion, HybridCapacityInput } from './aceCapacity';

/** Synthetic identifiers only. A Little in both form sources has ONE ID. */
const plan = (overrides: Partial<HybridCapacityInput> = {}) => computeHybridBigCapacity({
  capacityMax: 2,
  capacityReviewed: true,
  interpretation: 'total',
  guaranteedLittleIds: [],
  confirmedLittleIds: [],
  tentativeLittleIds: [],
  provisionalLittleIds: [],
  historicalChildren: 0,
  ...overrides,
});

describe('unapproved capacity answer parsing (#646)', () => {
  it.each([
    ['2', { suggested: 2, min: 2, max: 2, conditional: false }],
    ['1', { suggested: 1, min: 1, max: 1, conditional: false }],
    ['0', { suggested: 0, min: 0, max: 0, conditional: false }],
    ['two', { suggested: 2, min: 2, max: 2, conditional: false }],
    ['2-3', { suggested: null, min: 2, max: 3, conditional: true }],
    ['2–3', { suggested: null, min: 2, max: 3, conditional: true }],
    ['2 to 3', { suggested: null, min: 2, max: 3, conditional: true }],
    ['2 or 3', { suggested: null, min: 2, max: 3, conditional: true }],
    ['up to 2', { suggested: null, min: 0, max: 2, conditional: true }],
    ['about 2', { suggested: null, min: 2, max: 2, conditional: true }],
    ['3 but only if everyone agrees, otherwise 2', { suggested: null, min: 3, max: 3, conditional: true }],
    ['Not sure yet', { suggested: null, min: null, max: null, conditional: true }],
  ])('%p has explicit review-safe interpretation', (raw, expected) => {
    expect(parseCapacitySuggestion(raw)).toMatchObject({ ...expected, raw });
  });

  it('never fabricates a number from blank or invalid range answers', () => {
    expect(parseCapacitySuggestion(null)).toEqual({
      suggested: null, min: null, max: null, conditional: false, raw: null,
    });
    expect(parseCapacitySuggestion('  ')).toEqual(parseCapacitySuggestion(null));
    expect(parseCapacitySuggestion('5-2')).toMatchObject({ suggested: null, min: null, conditional: true });
    expect(parseCapacitySuggestion('21')).toMatchObject({ suggested: null, min: null, conditional: true });
    expect(parseCapacitySuggestion('2-25')).toMatchObject({ suggested: null, min: null, conditional: true });
  });
});

describe('reviewed hybrid Big capacity foundation (#646/#663)', () => {
  it('guaranteed plus 2 additional gives ceiling 3, with 2 available slots', () => {
    expect(plan({
      interpretation: 'additional',
      guaranteedLittleIds: ['mutual-little'],
    })).toMatchObject({
      guaranteed: 1, unreserved: 2, remaining: 2, ceiling: 3,
      totalIncoming: 1, state: 'open', needsInterpretation: false,
    });
  });

  it('2 total with 1 guaranteed leaves only one unreserved seat', () => {
    expect(plan({ guaranteedLittleIds: ['mutual-little'] })).toMatchObject({
      guaranteed: 1, ceiling: 2, unreserved: 1, remaining: 1,
    });
  });

  it('unset interpretation with a guaranteed Little provides both possibilities but NO remaining seat count', () => {
    expect(plan({ guaranteedLittleIds: ['mutual-little'], interpretation: null })).toMatchObject({
      needsInterpretation: true, needsReview: true, remaining: null,
      ceilingIfTotal: 2, unreservedIfTotal: 1,
      ceilingIfAdditional: 3, unreservedIfAdditional: 2,
    });
  });

  it('no guarantee makes interpretation irrelevant; 2 total and 2 additional mean the same thing', () => {
    for (const interpretation of [null, 'total', 'additional'] as const) {
      expect(plan({ interpretation })).toMatchObject({
        needsInterpretation: false, ceiling: 2, unreserved: 2, remaining: 2,
      });
    }
  });

  it('confirmed regular and tentative placements consume seats; provisional requests never do', () => {
    expect(plan({
      guaranteedLittleIds: ['mutual-little'],
      confirmedLittleIds: ['regular-little'],
      tentativeLittleIds: ['candidate-little'],
      provisionalLittleIds: ['pending-request'],
      interpretation: 'additional',
    })).toMatchObject({
      guaranteed: 1, confirmed: 1, tentative: 1, provisional: 1,
      totalIncoming: 2, ceiling: 3, remaining: 0, state: 'full',
    });
  });

  it('a negative remaining count is over-capacity, but guarantee and all pairings remain visible', () => {
    expect(plan({
      capacityMax: 1,
      guaranteedLittleIds: ['mutual-a', 'mutual-b'],
      confirmedLittleIds: ['regular-a'],
    })).toMatchObject({
      guaranteed: 2, confirmed: 1, totalIncoming: 3,
      unreserved: -1, remaining: -2, state: 'over', needsReview: true,
    });
  });

  it('a Big with no reviewed capacity keeps guarantees and authorizes no extra seats', () => {
    expect(plan({
      capacityMax: null, capacityReviewed: false, interpretation: null,
      guaranteedLittleIds: ['mutual-only-little'],
    })).toMatchObject({
      ceiling: 1, unreserved: 0, remaining: 0, state: 'full',
      needsCapacity: true, needsReview: true,
    });
  });

  it('never mistakes a suggested, unreviewed number for an approved capacity', () => {
    expect(plan({
      capacityMax: 2, capacityReviewed: false, interpretation: 'additional',
      guaranteedLittleIds: ['mutual-little'], tentativeLittleIds: ['extra'],
    })).toMatchObject({
      needsCapacity: true, ceiling: 1, remaining: -1, state: 'over',
    });
  });

  it('subtracts only live cycle pairings, never historical children', () => {
    expect(plan({
      historicalChildren: 12, confirmedLittleIds: ['new-little'],
    })).toMatchObject({
      historical: 12, ceiling: 2, remaining: 1,
      confirmed: 1, totalIncoming: 1,
    });
  });

  it('counts a Little present in both form sources exactly once across all states', () => {
    expect(plan({
      guaranteedLittleIds: ['same-id', 'same-id'],
      confirmedLittleIds: ['same-id', 'regular-id'],
      tentativeLittleIds: ['same-id', 'regular-id'],
      provisionalLittleIds: ['same-id', 'provisional-id'],
      interpretation: 'additional',
    })).toMatchObject({
      guaranteed: 1, confirmed: 1, tentative: 0, provisional: 1,
      totalIncoming: 2, remaining: 1,
    });
  });

  it('withdrawn Littles free seats and Big withdrawal never drops pairings silently', () => {
    expect(plan({
      guaranteedLittleIds: ['approved', 'withdrawn-mutual'],
      confirmedLittleIds: ['regular', 'withdrawn-regular'],
      tentativeLittleIds: ['withdrawn-tentative'],
      withdrawnLittleIds: new Set(['withdrawn-mutual', 'withdrawn-regular', 'withdrawn-tentative']),
      bigWithdrawn: true,
    })).toMatchObject({
      guaranteed: 1, confirmed: 1, tentative: 0, remaining: 0,
      totalIncoming: 2, needsReview: true,
    });
  });

  it('zero remaining means full even with zero authorized capacity', () => {
    expect(plan({ capacityMax: 0 })).toMatchObject({
      ceiling: 0, unreserved: 0, remaining: 0, state: 'full',
    });
  });

  it('rejects invalid reviewed capacities, historical counts and missing stable IDs', () => {
    expect(() => plan({ capacityMax: -1 })).toThrow(/integer between 0 and 20/);
    expect(() => plan({ capacityMax: 21 })).toThrow(/integer between 0 and 20/);
    expect(() => plan({ capacityMax: 1.5 })).toThrow(/integer between 0 and 20/);
    expect(() => plan({ historicalChildren: -1 })).toThrow(/nonnegative/);
    expect(() => plan({ guaranteedLittleIds: [''] })).toThrow(/stable canonical ID/);
  });
});
