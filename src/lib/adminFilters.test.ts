import {
  ALL_FILTER_KEY,
  QuickFilter,
  allFilter,
  applyQuickFilter,
  countByFilter,
  matchesText,
  normalizeFilterKey,
  readFilterParam,
  sortByKey,
  withParam,
} from './adminFilters';

interface Row {
  name: string;
  linked: boolean;
  photo: boolean;
}

const rows: Row[] = [
  { name: 'Ada', linked: true, photo: true },
  { name: 'Ben', linked: false, photo: true },
  { name: 'Cam', linked: false, photo: false },
];

const filters: QuickFilter<Row>[] = [
  allFilter(),
  { key: 'unlinked', label: 'Unlinked', predicate: (row) => !row.linked },
  { key: 'missing_photo', label: 'Missing Photo', predicate: (row) => !row.photo },
];

describe('countByFilter / applyQuickFilter', () => {
  it('counts every filter, with All equal to the row total', () => {
    expect(countByFilter(rows, filters)).toEqual({ all: 3, unlinked: 2, missing_photo: 1 });
  });

  it('applies a filter and returns every row for All', () => {
    expect(applyQuickFilter(rows, filters, 'unlinked').map((row) => row.name)).toEqual(['Ben', 'Cam']);
    expect(applyQuickFilter(rows, filters, ALL_FILTER_KEY)).toHaveLength(3);
  });

  it('falls back to every row for an unknown key instead of an empty page', () => {
    expect(applyQuickFilter(rows, filters, 'bogus')).toHaveLength(3);
  });

  it('keeps counts and applied rows consistent', () => {
    const counts = countByFilter(rows, filters);
    for (const filter of filters) {
      expect(applyQuickFilter(rows, filters, filter.key)).toHaveLength(counts[filter.key]);
    }
  });
});

describe('URL param helpers', () => {
  it('reads only allowed keys', () => {
    const params = new URLSearchParams('filter=unlinked');
    expect(readFilterParam(params, 'filter', ['all', 'unlinked'])).toBe('unlinked');
    expect(readFilterParam(new URLSearchParams('filter=evil'), 'filter', ['all', 'unlinked'])).toBe('all');
    expect(readFilterParam(new URLSearchParams(), 'filter', ['all', 'unlinked'])).toBe('all');
    expect(normalizeFilterKey(null, ['all'])).toBe('all');
  });

  it('keeps other params, sets the filter, and drops it at the default', () => {
    const base = new URLSearchParams('view=assignments&year=2026');
    const filtered = withParam(base, 'filter', 'unlinked');
    expect(filtered.get('view')).toBe('assignments');
    expect(filtered.get('filter')).toBe('unlinked');
    expect(withParam(filtered, 'filter', 'all').has('filter')).toBe(false);
    expect(base.has('filter')).toBe(false);
  });
});

describe('matchesText', () => {
  it('matches any field case-insensitively and ignores blank queries', () => {
    expect(matchesText('  ADA ', 'Ada Tran', null)).toBe(true);
    expect(matchesText('zzz', 'Ada Tran', 'x')).toBe(false);
    expect(matchesText('', 'anything')).toBe(true);
  });
});

describe('sortByKey', () => {
  it('sorts naturally, keeps missing values last, and is stable', () => {
    const items = [{ n: 'b10' }, { n: 'b2' }, { n: null }, { n: 'a' }, { n: 'b2' }];
    expect(sortByKey(items, (item) => item.n).map((item) => item.n)).toEqual(['a', 'b2', 'b2', 'b10', null]);
    expect(sortByKey(items, (item) => item.n, 'desc').map((item) => item.n)).toEqual(['b10', 'b2', 'b2', 'a', null]);
  });

  it('sorts numbers numerically', () => {
    expect(sortByKey([{ v: 10 }, { v: 9 }], (item) => item.v).map((item) => item.v)).toEqual([9, 10]);
  });
});
