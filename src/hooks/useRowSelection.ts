import { useCallback, useEffect, useMemo, useState } from 'react';
import { pruneSelection, scopeDescription, selectedOffPage, selectionScope } from '../lib/adminSelection';

/**
 * Selection state for a bulk-editable list. `filterRows` is every row matching
 * the current filter (all pages); `pageRows` is what is on screen. Selection is
 * pruned to `filterRows` whenever they change, so a stale selection can never
 * carry hidden rows into a bulk write.
 */
export function useRowSelection<T>(filterRows: readonly T[], pageRows: readonly T[], getId: (row: T) => string) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filterIds = useMemo(() => filterRows.map(getId), [filterRows, getId]);
  const pageIds = useMemo(() => pageRows.map(getId), [pageRows, getId]);

  useEffect(() => {
    setSelected((current) => {
      const pruned = pruneSelection(current, filterIds);
      return pruned.size === current.size ? current : pruned;
    });
  }, [filterIds]);

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectPage = useCallback(() => setSelected(new Set(pageIds)), [pageIds]);
  const selectAllMatching = useCallback(() => setSelected(new Set(filterIds)), [filterIds]);
  const clear = useCallback(() => setSelected(new Set()), []);

  const selectedRows = useMemo(() => filterRows.filter((row) => selected.has(getId(row))), [filterRows, selected, getId]);
  const scope = selectionScope(selected, pageIds, filterIds);

  return {
    selected,
    selectedRows,
    count: selected.size,
    scope,
    offPage: selectedOffPage(selected, pageIds),
    allOnPage: pageIds.length > 0 && pageIds.every((id) => selected.has(id)),
    canSelectAllMatching: filterIds.length > pageIds.length,
    totalMatching: filterIds.length,
    isSelected: (id: string) => selected.has(id),
    describe: (noun: string, nounPlural: string, filterLabel?: string) => scopeDescription(scope, selected.size, noun, nounPlural, filterLabel),
    toggle,
    selectPage,
    selectAllMatching,
    clear,
  };
}
