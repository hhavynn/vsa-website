// Quick filters for the admin work queues (ACE, Houses, Cabinet, Interns,
// Members). A filter is a label plus a predicate; the page owns which filters
// are relevant to its domain, this owns counting, applying, and keeping the
// choice in the URL so a refresh or Back never loses the admin's place.

export interface QuickFilter<T> {
  key: string;
  label: string;
  predicate: (row: T) => boolean;
  /** Short hint shown as a tooltip, e.g. what "Possible match" means. */
  hint?: string;
}

export const ALL_FILTER_KEY = 'all';

/** The always-present "All" filter. */
export function allFilter<T>(label = 'All'): QuickFilter<T> {
  return { key: ALL_FILTER_KEY, label, predicate: () => true };
}

export function countByFilter<T>(rows: readonly T[], filters: ReadonlyArray<QuickFilter<T>>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const filter of filters) {
    counts[filter.key] = filter.key === ALL_FILTER_KEY ? rows.length : rows.filter(filter.predicate).length;
  }
  return counts;
}

/** Unknown keys fall back to "All" so a stale link never shows an empty page. */
export function applyQuickFilter<T>(rows: readonly T[], filters: ReadonlyArray<QuickFilter<T>>, key: string): T[] {
  const filter = filters.find((item) => item.key === key);
  return filter && filter.key !== ALL_FILTER_KEY ? rows.filter(filter.predicate) : [...rows];
}

export function normalizeFilterKey(raw: string | null | undefined, allowed: readonly string[], fallback = ALL_FILTER_KEY): string {
  return raw && allowed.includes(raw) ? raw : fallback;
}

export function readFilterParam(
  params: URLSearchParams,
  name: string,
  allowed: readonly string[],
  fallback = ALL_FILTER_KEY,
): string {
  return normalizeFilterKey(params.get(name), allowed, fallback);
}

/**
 * A copy of `params` with `name` set to `value`, or removed when `value` is the
 * default, so the URL stays clean until the admin actually filters.
 */
export function withParam(params: URLSearchParams, name: string, value: string | null, defaultValue = ALL_FILTER_KEY): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value === null || value === '' || value === defaultValue) next.delete(name);
  else next.set(name, value);
  return next;
}

/** Case-insensitive substring match over any number of fields. */
export function matchesText(needle: string, ...fields: Array<string | null | undefined>): boolean {
  const query = needle.trim().toLowerCase();
  if (!query) return true;
  return fields.some((field) => !!field && field.toLowerCase().includes(query));
}

export type SortDirection = 'asc' | 'desc';

/** Stable, locale-aware sort by a derived key; nulls always last. */
export function sortByKey<T>(rows: readonly T[], keyOf: (row: T) => string | number | null | undefined, direction: SortDirection = 'asc'): T[] {
  const sign = direction === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, key: keyOf(row) }))
    .sort((a, b) => {
      const aMissing = a.key === null || a.key === undefined || a.key === '';
      const bMissing = b.key === null || b.key === undefined || b.key === '';
      if (aMissing || bMissing) return aMissing === bMissing ? a.index - b.index : aMissing ? 1 : -1;
      const compared =
        typeof a.key === 'number' && typeof b.key === 'number'
          ? a.key - b.key
          : String(a.key).localeCompare(String(b.key), undefined, { sensitivity: 'base', numeric: true });
      return compared !== 0 ? compared * sign : a.index - b.index;
    })
    .map((entry) => entry.row);
}
