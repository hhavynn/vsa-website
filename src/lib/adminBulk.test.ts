import type { LittleLinkReviewItem } from './aceAssignments';
import type { AceAssignmentDraft } from '../types';
import {
  planAceLinkExactMatches,
  planBulk,
  planCabinetCategory,
  planHouseAssign,
  planHouseClear,
  planInternMentor,
  planInternTrack,
  planMarkReviewed,
  planMemberClearReview,
  pruneSelection,
  selectedRows,
  setSelection,
  toggleSelected,
} from './adminBulk';

const review = (id: string, status: LittleLinkReviewItem['status']): LittleLinkReviewItem => ({
  draft: { id, little_name: `Little ${id}` } as AceAssignmentDraft,
  status,
  candidates: status === 'none' ? [] : [{ id: `m-${id}` } as never],
});

describe('planBulk', () => {
  it('separates eligible rows from skipped rows with reasons', () => {
    const plan = planBulk([1, 2, 3], (n) => (n === 2 ? 'nope' : null), { verb: 'Do', noun: 'item' });
    expect(plan.eligible).toEqual([1, 3]);
    expect(plan.skipped).toEqual([{ row: 2, reason: 'nope' }]);
    expect(plan.summary).toBe('2 of 3 selected items will change. 1 skipped.');
    expect(plan.needsConfirm).toBe(false);
  });

  it('requires confirmation showing the affected count for destructive actions', () => {
    const plan = planBulk([1, 2, 3], () => null, { verb: 'Delete', noun: 'item', destructive: true });
    expect(plan.needsConfirm).toBe(true);
    expect(plan.confirmText).toBe('Delete 3 items?');
  });

  it('does not ask to confirm a destructive action that would change nothing', () => {
    const plan = planBulk([1], () => 'no', { verb: 'Delete', noun: 'item', destructive: true });
    expect(plan.needsConfirm).toBe(false);
    expect(plan.eligible).toHaveLength(0);
  });

  it('asks for a selection when nothing is selected', () => {
    expect(planBulk([], () => null, { verb: 'Do', noun: 'row' }).summary).toBe('Select rows first.');
  });
});

describe('selection helpers', () => {
  it('toggles without mutating the original set', () => {
    const base = new Set(['a']);
    const next = toggleSelected(base, 'b');
    expect(Array.from(next).sort()).toEqual(['a', 'b']);
    expect(base.size).toBe(1);
    expect(toggleSelected(next, 'a').has('a')).toBe(false);
  });

  it('selects all and clears', () => {
    expect(setSelection(['a', 'b'], true).size).toBe(2);
    expect(setSelection(['a', 'b'], false).size).toBe(0);
  });

  it('prunes ids that left the visible data (year switch, deleted row)', () => {
    expect(Array.from(pruneSelection(new Set(['a', 'gone']), ['a', 'b']))).toEqual(['a']);
  });

  it('returns the selected rows in table order', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(selectedRows(rows, new Set(['c', 'a']), (row) => row.id).map((row) => row.id)).toEqual(['a', 'c']);
  });
});

describe('planAceLinkExactMatches', () => {
  const items = [review('1', 'recommended'), review('2', 'ambiguous'), review('3', 'conflict'), review('4', 'none'), review('5', 'recommended')];

  it('links only exact, unclaimed matches among the selection', () => {
    const plan = planAceLinkExactMatches(new Set(['1', '2', '3', '4']), items);
    expect(plan.eligible.map((item) => item.draft.id)).toEqual(['1']);
    expect(plan.skipped.map((skip) => skip.row.draft.id)).toEqual(['2', '3', '4']);
  });

  it('never auto-resolves an ambiguous identity and explains why', () => {
    const plan = planAceLinkExactMatches(new Set(['2']), items);
    expect(plan.eligible).toHaveLength(0);
    expect(plan.skipped[0].reason).toMatch(/choose one manually/i);
  });

  it('ignores rows that were not selected', () => {
    expect(planAceLinkExactMatches(new Set(['1']), items).eligible.map((item) => item.draft.id)).toEqual(['1']);
  });

  it('reports selected rows that are already linked instead of dropping them silently', () => {
    const plan = planAceLinkExactMatches(new Set(['1', 'linked-1']), items, new Set(['linked-1']));
    expect(plan.total).toBe(2);
    expect(plan.summary).toMatch(/already linked/);
  });
});

describe('House planners', () => {
  const rows = [
    { id: 'a', house_profile_id: 'toad' },
    { id: 'b', house_profile_id: null },
    { id: 'c', house_profile_id: 'boo' },
  ];

  it('assigns only rows that are not already in that House', () => {
    const plan = planHouseAssign(rows, 'toad', true);
    expect(plan.eligible.map((row) => row.id)).toEqual(['b', 'c']);
    expect(plan.skipped[0].reason).toBe('Already in this House.');
  });

  it('refuses every row when the batch is locked', () => {
    expect(planHouseAssign(rows, 'toad', false).eligible).toHaveLength(0);
    expect(planHouseClear(rows, false).eligible).toHaveLength(0);
  });

  it('treats clearing as destructive and confirms with the count of rows that change', () => {
    const plan = planHouseClear(rows, true);
    expect(plan.eligible.map((row) => row.id)).toEqual(['a', 'c']);
    expect(plan.needsConfirm).toBe(true);
    expect(plan.confirmText).toBe('Clear the House for 2 rows?');
  });
});

describe('Intern planners', () => {
  const rows = [
    { id: 'a', mentor_cabinet_member_id: 'm1', role_or_track: 'Events' },
    { id: 'b', mentor_cabinet_member_id: null, role_or_track: null },
  ];

  it('sets a mentor on rows that do not already have it', () => {
    expect(planInternMentor(rows, 'm1', true).eligible.map((row) => row.id)).toEqual(['b']);
  });

  it('treats removing a mentor as destructive', () => {
    const plan = planInternMentor(rows, null, true);
    expect(plan.eligible.map((row) => row.id)).toEqual(['a']);
    expect(plan.needsConfirm).toBe(true);
  });

  it('requires a track value and skips rows that already match', () => {
    expect(planInternTrack(rows, '  ', true).eligible).toHaveLength(0);
    expect(planInternTrack(rows, 'Events', true).eligible.map((row) => row.id)).toEqual(['b']);
  });
});

describe('Cabinet / review planners', () => {
  it('moves only positions not already on that board', () => {
    const plan = planCabinetCategory([{ id: 'a', category: 'Executive Board' }, { id: 'b', category: 'General Board' }], 'General Board', true);
    expect(plan.eligible.map((row) => row.id)).toEqual(['a']);
  });

  it('marks reviewed only rows not yet reviewed', () => {
    const plan = planMarkReviewed([{ id: 'a' }, { id: 'b' }], new Set(['a']));
    expect(plan.eligible.map((row) => row.id)).toEqual(['b']);
  });

  it('clears the review flag only on flagged members', () => {
    const plan = planMemberClearReview([{ id: 'a', needs_review: true }, { id: 'b', needs_review: false }, { id: 'c', needs_review: null }]);
    expect(plan.eligible.map((row) => row.id)).toEqual(['a']);
  });
});
