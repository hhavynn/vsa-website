import { OperationsSummary } from './adminOperations';
import { buildContinueItems } from './adminContinue';

const empty: OperationsSummary = { yearStart: 2026, yearLabel: '2026–27', members: { total: 10 }, ace: null, houses: null, cabinet: null, interns: null, events: null };

describe('buildContinueItems', () => {
  it('turns persisted workflow state into next actions', () => {
    const items = buildContinueItems({
      ...empty,
      ace: { cycleStatus: 'draft', littles: 47, assigned: 42, nodesTotal: 10, nodesLinked: 10, unassigned: 5, nodesUnlinked: 0, needAttention: 5, to: '' },
      houses: { batchStatus: 'draft', assigned: 126, unresolved: 3, balance: [], to: '' },
      cabinet: { yearLabel: '2025–26', positions: 19, filled: 19, linked: 19, needReview: 0, rollover: { yearLabel: '2026–27', status: 'draft', positions: 19, filled: 18 }, to: '' },
    });
    expect(items.map((item) => item.detail)).toEqual([
      '5 Littles still need assignments',
      'Draft saved · 3 unresolved rows',
      '2026–27: 18 / 19 positions filled',
    ]);
    expect(items[0].to).toBe('/admin/ace?view=assignments&filter=unassigned');
  });

  it('shows nothing for work that is already published', () => {
    const items = buildContinueItems({
      ...empty,
      ace: { cycleStatus: 'published', littles: 47, assigned: 47, nodesTotal: 10, nodesLinked: 10, unassigned: 0, nodesUnlinked: 0, needAttention: 0, to: '' },
      houses: { batchStatus: 'published', assigned: 100, unresolved: 0, balance: [], to: '' },
      interns: { cycleStatus: 'archived', accepted: 5, linked: 5, needReview: 0, to: '' },
    });
    expect(items).toEqual([]);
  });

  it('suggests the next step for a locked cycle instead of a count', () => {
    const items = buildContinueItems({
      ...empty,
      ace: { cycleStatus: 'locked', littles: 5, assigned: 5, nodesTotal: 0, nodesLinked: 0, unassigned: 0, nodesUnlinked: 0, needAttention: 0, to: '' },
      houses: { batchStatus: 'locked', assigned: 5, unresolved: 0, balance: [], to: '' },
    });
    expect(items.find((item) => item.domain === 'ace')?.cta).toBe('Open preflight');
    expect(items.find((item) => item.domain === 'houses')?.cta).toBe('Preview reveal');
  });

  it('does not invent work when a domain failed to load', () => {
    expect(buildContinueItems(empty)).toEqual([]);
  });

  it('points interns with unlinked rows at the Unlinked filter', () => {
    const [item] = buildContinueItems({ ...empty, interns: { cycleStatus: 'draft', accepted: 12, linked: 9, needReview: 3, to: '' } });
    expect(item.detail).toBe('3 interns not linked yet');
    expect(item.to).toBe('/admin/interns?filter=unlinked');
  });
});
