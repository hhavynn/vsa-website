import { BulkPartialError, runBulk, summarizeBulkResult } from './adminBulkRun';
import { pruneSelection, scopeDescription, selectedOffPage, selectionScope } from './adminSelection';

describe('runBulk', () => {
  it('records each failure against its item and keeps going', async () => {
    const progress: number[] = [];
    const result = await runBulk(
      ['a', 'b', 'c', 'd'],
      async (item) => {
        if (item === 'b' || item === 'd') throw new Error(`no ${item}`);
      },
      { concurrency: 2, onProgress: (done) => progress.push(done) },
    );
    expect(result.succeeded.sort()).toEqual(['a', 'c']);
    expect(result.failed.map((f) => [f.item, f.error]).sort()).toEqual([
      ['b', 'no b'],
      ['d', 'no d'],
    ]);
    expect(progress[0]).toBe(0);
    expect(progress[progress.length - 1]).toBe(4);
  });

  it('handles an empty list and supabase-style error objects', async () => {
    expect((await runBulk([], async () => undefined)).succeeded).toEqual([]);
    const r = await runBulk([1], async () => {
      return Promise.reject({ message: 'permission denied', code: '42501' });
    });
    expect(r.failed[0].error).toBe('permission denied');
  });

  it('never exceeds the requested concurrency', async () => {
    let live = 0;
    let peak = 0;
    await runBulk(
      Array.from({ length: 10 }, (_, i) => i),
      async () => {
        live += 1;
        peak = Math.max(peak, live);
        await new Promise((resolve) => setTimeout(resolve, 1));
        live -= 1;
      },
      { concurrency: 3 },
    );
    expect(peak).toBeLessThanOrEqual(3);
  });
});

describe('BulkPartialError (committed, follow-up failed)', () => {
  it('counts the item as changed, flags it for attention, and keeps it out of the failures', async () => {
    const result = await runBulk(['a', 'b'], async (item) => {
      if (item === 'b') throw new BulkPartialError('listing not synced');
    });
    expect(result.succeeded.sort()).toEqual(['a', 'b']);
    expect(result.failed).toEqual([]);
    expect(result.warnings).toEqual([{ item: 'b', error: 'listing not synced' }]);
  });

  it('summarizes as partial without claiming anything was left unchanged', () => {
    const out = summarizeBulkResult(
      { succeeded: ['a', 'b'], failed: [], warnings: [{ item: 'b', error: 'x' }] },
      { past: 'Published', verb: 'publish', noun: 'event' },
    );
    expect(out.tone).toBe('partial');
    expect(out.headline).toBe('Published 2 events. 1 saved but needs attention.');
    expect(out.headline).not.toMatch(/unchanged/);
  });
});

describe('summarizeBulkResult', () => {
  const item = (n: number) => Array.from({ length: n }, (_, i) => i);
  it('says partial when some failed — not generic success', () => {
    const out = summarizeBulkResult({ succeeded: item(9), failed: item(3).map((i) => ({ item: i, error: 'x' })) }, { past: 'Archived', verb: 'archive', noun: 'resource' });
    expect(out.tone).toBe('partial');
    expect(out.headline).toBe('Archived 9 of 12 resources. 3 failed and were left unchanged.');
  });
  it('covers success, total failure, and empty', () => {
    expect(summarizeBulkResult({ succeeded: item(1), failed: [] }, { past: 'Archived', verb: 'archive', noun: 'resource' }).headline).toBe('Archived 1 resource.');
    expect(summarizeBulkResult({ succeeded: [], failed: [{ item: 1, error: 'x' }] }, { past: 'Archived', verb: 'archive', noun: 'resource' }).tone).toBe('failure');
    expect(summarizeBulkResult({ succeeded: [], failed: [] }, { past: 'Archived', verb: 'archive', noun: 'resource' }).tone).toBe('empty');
  });
});

describe('selection scope', () => {
  const page = ['1', '2'];
  const filter = ['1', '2', '3', '4'];
  it('prunes ids that left the filter', () => {
    expect(Array.from(pruneSelection(new Set(['1', '9']), filter))).toEqual(['1']);
  });
  it('distinguishes page, filter, and hand-picked selections', () => {
    expect(selectionScope(new Set(), page, filter)).toBe('none');
    expect(selectionScope(new Set(['1']), page, filter)).toBe('some');
    expect(selectionScope(new Set(page), page, filter)).toBe('page');
    expect(selectionScope(new Set(filter), page, filter)).toBe('filter');
    expect(selectionScope(new Set(filter), filter, filter)).toBe('page');
  });
  it('discloses selected rows that are not on screen', () => {
    expect(selectedOffPage(new Set(filter), page)).toBe(2);
    expect(selectedOffPage(new Set(page), page)).toBe(0);
  });
  it('words the scope plainly', () => {
    expect(scopeDescription('filter', 4, 'event', 'events', 'Spring 2026')).toBe('All 4 events matching “Spring 2026”, including ones not shown on this page.');
    expect(scopeDescription('some', 1, 'event', 'events')).toBe('1 hand-picked event.');
  });
});
