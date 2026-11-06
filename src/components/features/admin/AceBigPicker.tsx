import { useId, useMemo, useState } from 'react';
import { AceNodeRef, BigLoad } from '../../../lib/aceAssignments';
import { normalizeMemberName } from '../../../lib/memberLinkMatching';
import { searchAceBigNodes } from '../../../lib/aceBigSearch';

interface AceBigPickerProps {
  value: string | null;
  nodes: readonly AceNodeRef[];
  loadFor: (bigId: string) => BigLoad;
  onChange: (bigId: string | null) => void;
  disabled?: boolean;
  label: string;
  /** A Big's planned number of Littles, when application answers are loaded. */
  capacityFor?: (bigId: string) => number | null;
}

const MAX_RESULTS = 8;

export const describeBig = (node: AceNodeRef) => [node.name, node.familyName].filter(Boolean).join(' · ');

function formatLoad(load: BigLoad, capacity: number | null = null): string {
  const parts = [`${load.current} on tree`];
  if (capacity != null) parts.push(`${load.incoming} of ${capacity} planned new`);
  else if (load.incoming > 0) parts.push(`${load.incoming} new`);
  return parts.join(' · ');
}

/**
 * Chooses a Big from existing ACE tree nodes. The Little's family is whatever
 * family that Big's node belongs to, so the fam is shown with every option.
 */
export function AceBigPicker({ value, nodes, loadFor, onChange, disabled = false, label, capacityFor }: AceBigPickerProps) {
  const searchId = useId();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const selected = useMemo(() => nodes.find((node) => node.id === value) ?? null, [nodes, value]);

  const { matches: results, total } = useMemo(
    () => searchAceBigNodes(nodes, term, MAX_RESULTS),
    [nodes, term],
  );

  const choose = (bigId: string | null) => {
    onChange(bigId);
    setOpen(false);
    setTerm('');
  };

  if (!open) {
    return (
      <div className="font-sans text-xs">
        {value && !selected ? (
          <p className="font-medium text-red-500">Big no longer exists</p>
        ) : selected ? (
          <>
            <p className="font-medium text-[var(--color-text)]">{describeBig(selected)}</p>
            <p className="text-[11px] text-[var(--color-text3)]">{formatLoad(loadFor(selected.id), capacityFor?.(selected.id))}</p>
          </>
        ) : (
          <p className="font-medium text-[var(--color-text2)]">
            <span aria-hidden>⚠️ </span>Unassigned
          </p>
        )}
        {!disabled && (
          <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--color-text3)]">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`${selected ? 'Change' : 'Choose'} Big for ${label}`}
              className="bg-transparent p-0 font-medium text-[var(--color-text2)] underline-offset-2 hover:underline"
            >
              {selected ? 'Change' : 'Choose Big'}
            </button>
            {value && (
              <>
                <span aria-hidden>|</span>
                <button
                  type="button"
                  onClick={() => choose(null)}
                  aria-label={`Clear Big for ${label}`}
                  className="bg-transparent p-0 font-medium text-[var(--color-text2)] underline-offset-2 hover:underline"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="font-sans text-xs">
      <label htmlFor={searchId} className="sr-only">
        Search Bigs for {label}
      </label>
      <input
        id={searchId}
        type="search"
        autoFocus
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search Big or fam…"
        autoComplete="off"
        className="block w-full max-w-xs rounded border border-[var(--color-border)] bg-[var(--color-surface2)] px-2.5 py-1.5 text-xs text-[var(--color-text)] placeholder-[var(--color-text3)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
      />
      {normalizeMemberName(term).length >= 2 && (
        <div className="mt-1 max-w-xs rounded border border-[var(--color-border)] bg-[var(--color-surface)]">
          {results.length === 0 ? (
            <p className="px-2.5 py-1.5 text-[11px] text-[var(--color-text3)]">No ACE members found.</p>
          ) : (
            <ul>
              {results.map((node) => (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => choose(node.id)}
                    className="block w-full bg-transparent px-2.5 py-1.5 text-left text-xs text-[var(--color-text)] hover:bg-[var(--color-surface2)]"
                  >
                    <span className="font-medium">{describeBig(node)}</span>
                    <span className="ml-2 text-[11px] text-[var(--color-text3)]">{formatLoad(loadFor(node.id), capacityFor?.(node.id))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {total > MAX_RESULTS && (
        <p role="status" className="mt-1 max-w-xs text-[11px] text-[var(--color-text3)]">
          Showing {MAX_RESULTS} of {total} matching Big nodes. Add a name or family to narrow the list.
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setTerm('');
        }}
        className="mt-1.5 bg-transparent p-0 text-[11px] font-medium text-[var(--color-text2)] underline-offset-2 hover:underline"
      >
        Cancel
      </button>
    </div>
  );
}
