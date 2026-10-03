// Row selection for bulk admin actions. The rule that matters: a selection can
// only ever contain rows that are in the *current* filter, so changing a filter
// can never leave invisible rows selected for a bulk write.

export type SelectionScope = 'none' | 'some' | 'page' | 'filter';

export function pruneSelection(selected: ReadonlySet<string>, validIds: readonly string[]): Set<string> {
  const valid = new Set(validIds);
  const next = new Set<string>();
  selected.forEach((id) => {
    if (valid.has(id)) next.add(id);
  });
  return next;
}

/** How the current selection relates to what the admin can see. */
export function selectionScope(selected: ReadonlySet<string>, pageIds: readonly string[], filterIds: readonly string[]): SelectionScope {
  if (selected.size === 0) return 'none';
  if (filterIds.length > 0 && selected.size === filterIds.length && filterIds.every((id) => selected.has(id))) {
    // Everything matching the filter; call it "page" only when the page IS the whole filter.
    return pageIds.length === filterIds.length ? 'page' : 'filter';
  }
  if (pageIds.length > 0 && selected.size === pageIds.length && pageIds.every((id) => selected.has(id))) return 'page';
  return 'some';
}

/** How many selected rows are not on the visible page (the "silent include" the dialog must disclose). */
export function selectedOffPage(selected: ReadonlySet<string>, pageIds: readonly string[]): number {
  const onPage = new Set(pageIds);
  let count = 0;
  selected.forEach((id) => {
    if (!onPage.has(id)) count += 1;
  });
  return count;
}

export function scopeDescription(scope: SelectionScope, count: number, noun: string, nounPlural: string, filterLabel?: string): string {
  const label = count === 1 ? noun : nounPlural;
  switch (scope) {
    case 'filter':
      return `All ${count} ${label}${filterLabel ? ` matching “${filterLabel}”` : ' matching the current filter'}, including ones not shown on this page.`;
    case 'page':
      return `${count} ${label} on this page.`;
    case 'some':
      return `${count} hand-picked ${label}.`;
    default:
      return '';
  }
}
