import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePublicSearchIndex } from '../../../hooks/usePublicSearchIndex';
import {
  flattenGroups,
  searchPublicEntries,
  suggestedDestinations,
  type PublicSearchEntry,
  type PublicSearchGroup,
} from '../../../lib/publicSearch';
import { cn } from '../../../lib/utils';

// The search box + grouped listbox, shared by the global dialog and the 404
// page. Follows the ARIA combobox/listbox pattern (focus stays in the input,
// the active option is announced via aria-activedescendant); the interaction
// model is the admin Quick Search's, but nothing is imported from admin code.

interface Row {
  key: string;
  title: string;
  typeLabel?: string;
  detail?: string;
  emoji?: string;
  to: string;
  external?: boolean;
  /** "Browse all events" rows read as an action, not a result. */
  isBrowse?: boolean;
}

interface Section {
  key: string;
  label: string;
  rows: Row[];
}

const toRow = (entry: PublicSearchEntry): Row => ({
  key: entry.key,
  title: entry.title,
  typeLabel: entry.typeLabel,
  detail: entry.detail,
  emoji: entry.emoji,
  to: entry.to,
  external: entry.external,
});

function sectionsFromGroups(groups: PublicSearchGroup[]): Section[] {
  return groups.map((group) => ({
    key: group.type,
    label: group.label,
    rows: [
      ...group.results.map(toRow),
      ...(group.browseAll && group.hiddenCount > 0
        ? [
            {
              key: `browse:${group.type}`,
              title: `${group.browseAll.label} (${group.hiddenCount} more match${group.hiddenCount === 1 ? '' : 'es'})`,
              to: group.browseAll.to,
              isBrowse: true,
            },
          ]
        : []),
    ],
  }));
}

interface PublicSearchPanelProps {
  variant: 'dialog' | 'inline';
  /** Called after a result is chosen (the dialog closes itself here). */
  onDone?: () => void;
  /** Escape with nothing left to clear. */
  onEscape?: () => void;
  autoFocus?: boolean;
  className?: string;
}

export function PublicSearchPanel({ variant, onDone, onEscape, autoFocus = false, className }: PublicSearchPanelProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  // The dialog opens on demand, so it loads right away; the inline copy on the
  // 404 page waits until the visitor touches the box.
  const [indexRequested, setIndexRequested] = useState(variant === 'dialog');
  const { entries, loading, failed } = usePublicSearchIndex(indexRequested);

  const trimmed = query.trim();
  const groups = useMemo(() => (trimmed ? searchPublicEntries(entries, trimmed) : []), [entries, trimmed]);
  const matchCount = flattenGroups(groups).length;

  const sections = useMemo<Section[]>(() => {
    if (!trimmed) return [{ key: 'start', label: 'Start here', rows: suggestedDestinations().map(toRow) }];
    if (matchCount === 0) return [{ key: 'empty', label: 'Try one of these', rows: suggestedDestinations().map(toRow) }];
    return sectionsFromGroups(groups);
  }, [groups, matchCount, trimmed]);

  const rows = useMemo(() => sections.flatMap((section) => section.rows), [sections]);
  // The dialog always offers somewhere to start; the inline box on the 404 page
  // stays a plain field until the visitor types (the page already lists links).
  const showList = variant === 'dialog' || trimmed.length > 0;

  useEffect(() => setActive(0), [trimmed]);
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [active, rows]);

  const choose = useCallback(
    (row: Row | undefined) => {
      if (!row) return;
      onDone?.();
      if (row.external) window.open(row.to, '_blank', 'noopener,noreferrer');
      else navigate(row.to);
    },
    [navigate, onDone],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, Math.max(rows.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(rows[active]);
    } else if (event.key === 'Escape') {
      if (variant === 'inline' && query) {
        event.preventDefault();
        setQuery('');
      } else if (onEscape) {
        event.preventDefault();
        onEscape();
      }
    }
  };

  const indexNote = failed.length
    ? `${failed.map((source) => (source === 'events' ? 'Events' : 'Photo albums')).join(' and ')} couldn’t load right now. Pages are still searchable.`
    : null;

  let status = '';
  if (trimmed) status = matchCount ? `${matchCount} result${matchCount === 1 ? '' : 's'}` : `No results for ${trimmed}`;
  if (loading) status = `${status ? `${status}. ` : ''}Loading events and photo albums`;

  let optionIndex = -1;
  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={showList && rows[active] ? `${listId}-${active}` : undefined}
        aria-label="Search pages, events and photo albums"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="go"
        value={query}
        maxLength={80}
        onFocus={() => setIndexRequested(true)}
        onChange={(event) => {
          setIndexRequested(true);
          setQuery(event.target.value);
        }}
        onKeyDown={onKeyDown}
        placeholder="Search pages, events, photo albums…"
        // 16px keeps iOS Safari from zooming the page when the box is focused.
        className={cn(
          'w-full bg-transparent px-4 py-3.5 font-sans text-base text-[var(--color-text)] placeholder-[var(--color-text3)] focus:outline-none',
          variant === 'dialog' && 'border-y border-[var(--color-border)]',
          variant === 'inline' &&
            'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400',
        )}
      />

      <div role="status" aria-live="polite" className="sr-only">
        {status}
      </div>

      {showList && (
        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          className={cn(
            'overflow-y-auto py-1',
            variant === 'dialog' ? 'max-h-[min(60dvh,28rem)]' : 'mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-left',
          )}
        >
          {trimmed && matchCount === 0 && (
            <p className="px-4 pb-1 pt-4 font-sans text-sm text-[var(--color-text2)]">
              Nothing matches “{trimmed}”.{' '}
              <span className="text-[var(--color-text3)]">Try fewer or different words, or start with one of these.</span>
            </p>
          )}
          {sections.map((section) => (
            <div key={section.key} role="group" aria-labelledby={`${listId}-${section.key}`}>
              <div
                id={`${listId}-${section.key}`}
                className="px-4 pb-1 pt-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text3)]"
              >
                {section.label}
              </div>
              {section.rows.map((row) => {
                optionIndex += 1;
                const index = optionIndex;
                const isActive = index === active;
                return (
                  <div
                    key={row.key}
                    id={`${listId}-${index}`}
                    ref={isActive ? activeRef : undefined}
                    role="option"
                    aria-selected={isActive}
                    onMouseMove={() => setActive(index)}
                    // mousedown would blur the input before click lands on touch screens.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(row)}
                    className={cn(
                      'flex min-h-[48px] cursor-pointer items-center justify-between gap-3 px-4 py-2',
                      isActive && 'bg-[var(--color-surface2)]',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {row.emoji && (
                        <span aria-hidden className="shrink-0 text-lg leading-none">
                          {row.emoji}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p
                          className={cn(
                            'truncate font-sans text-sm text-[var(--color-text)]',
                            row.isBrowse ? 'font-medium text-brand-600 dark:text-brand-400' : 'font-semibold',
                          )}
                        >
                          {row.title}
                        </p>
                        {row.detail && <p className="truncate font-sans text-xs text-[var(--color-text2)]">{row.detail}</p>}
                      </div>
                    </div>
                    {row.typeLabel && (
                      <span className="shrink-0 rounded-full border border-[var(--color-border)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--color-text3)]">
                        {row.typeLabel}
                      </span>
                    )}
                    {row.isBrowse && (
                      <span aria-hidden className="shrink-0 text-sm text-brand-600 dark:text-brand-400">
                        →
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {(loading || indexNote) && (
        <p className="px-4 pb-2 pt-1 font-sans text-xs text-[var(--color-text3)]">
          {indexNote ?? 'Loading events and photo albums…'}
        </p>
      )}
    </div>
  );
}
