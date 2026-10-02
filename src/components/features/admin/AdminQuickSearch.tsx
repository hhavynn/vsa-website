import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAdminSearch } from '../../../hooks/useAdminSearch';
import { confirmLeaveIfUnsaved } from '../../../hooks/useUnsavedChangesGuard';
import { AdminSearchResult, collidingTitles } from '../../../lib/adminSearch';
import { cn } from '../../../lib/utils';

/** True for ⌘K / Ctrl+K. */
export function isQuickSearchShortcut(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey'>): boolean {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
}

function Palette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const { results, loading, failed } = useAdminSearch(query, true);
  const collisions = collidingTitles(results);

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => setActive(0), [query]);

  const choose = useCallback(
    (result: AdminSearchResult | undefined) => {
      if (!result) return;
      // Quick Search navigates programmatically, which link-click guards never see.
      if (result.to !== `${window.location.pathname}${window.location.search}` && !confirmLeaveIfUnsaved()) return;
      onClose();
      navigate(result.to);
    },
    [navigate, onClose],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(results[active]);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Search admin" onKeyDown={onKeyDown} className="w-full max-w-xl overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
          aria-label="Search admin"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search members, ACE, Cabinet, interns, events, pages…"
          className="w-full border-0 border-b border-[var(--color-border)] bg-transparent px-4 py-3.5 font-sans text-[15px] text-[var(--color-text)] placeholder-[var(--color-text3)] focus:outline-none"
        />
        <ul id={listId} role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto py-1">
          {results.map((result, index) => (
            <li
              key={result.key}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(result)}
              className={cn('flex cursor-pointer items-center justify-between gap-3 px-4 py-2', index === active && 'bg-[var(--color-surface2)]')}
            >
              <div className="min-w-0">
                <p className="truncate font-sans text-sm font-semibold text-[var(--color-text)]">{result.title}</p>
                <p className="truncate font-sans text-xs text-[var(--color-text2)]">
                  {result.typeLine}
                  {collisions.has(result.title.toLowerCase()) && result.type !== 'page' ? ' · same name as another result' : ''}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[11px] text-[var(--color-text3)]">→ {result.destination}</span>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-4 py-6 text-center font-sans text-xs text-[var(--color-text3)]">{loading ? 'Searching…' : `No results for “${query.trim()}”.`}</li>
          )}
        </ul>
        <div className="flex justify-between border-t border-[var(--color-border)] px-4 py-2 font-mono text-[10px] text-[var(--color-text3)]">
          <span>↑↓ to move · Enter to open · Esc to close</span>
          {failed && <span>Some records could not load</span>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Admin Quick Search (⌘K / Ctrl+K). Mounted only inside the admin shell, which
 * sits behind AdminRoute, and it loads nothing until it is opened.
 */
export function AdminQuickSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <Palette onClose={onClose} /> : null;
}

export function QuickSearchButton({ onOpen, className }: { onOpen: () => void; className?: string }) {
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Search admin"
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 py-2 font-sans text-[13px] text-[var(--color-text2)] transition-colors hover:text-[var(--color-text)]',
        className,
      )}
    >
      <span>Search admin…</span>
      <kbd className="font-mono text-[10px] text-[var(--color-text3)]">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
    </button>
  );
}
