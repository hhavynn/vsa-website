import { useEffect, useMemo, useState } from 'react';
import {
  AceLinkReviewItem,
  AceMemberLinkChange,
  selectBulkLinks,
} from '../../../lib/aceMemberLinks';
import type { MemberOption } from '../../../lib/memberLinkMatching';

interface AceLinkReviewPanelProps {
  items: AceLinkReviewItem[];
  onApply: (links: AceMemberLinkChange[]) => void;
  onLinkOne: (nodeId: string, member: MemberOption) => void;
  onClose: () => void;
  busy: boolean;
}

const sectionTitleCls = 'font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)]';
const linkBtnCls =
  'rounded border border-[var(--color-border)] bg-transparent px-2 py-0.5 font-sans text-[11px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface2)] disabled:opacity-50';

/**
 * Reviews every unlinked node in one fam. Only exact, unique, unclaimed
 * matches can be bulk-linked; ambiguous people need a per-row decision.
 */
export function AceLinkReviewPanel({ items, onApply, onLinkOne, onClose, busy }: AceLinkReviewPanelProps) {
  const recommended = useMemo(() => items.filter((item) => item.status === 'recommended'), [items]);
  const needsReview = useMemo(
    () => items.filter((item) => item.status === 'ambiguous' || item.status === 'conflict'),
    [items],
  );
  const noMatch = useMemo(() => items.filter((item) => item.status === 'none'), [items]);

  const recommendedKey = recommended.map((item) => `${item.node.id}:${item.candidates[0].id}`).join(',');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(recommended.map((item) => item.node.id)));
  useEffect(() => {
    setSelected(new Set(recommended.map((item) => item.node.id)));
    // Re-check every recommendation whenever the set of recommendations changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendedKey]);

  const toApply = selectBulkLinks(items, selected);

  const toggle = (nodeId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });

  return (
    <section
      aria-label="Review unlinked ACE members"
      className="mb-4 rounded border border-[var(--color-border)] bg-[var(--color-surface2)] p-4 font-sans text-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Review unlinked ({items.length})</h3>
          <p className="mt-0.5 text-[11px] text-[var(--color-text3)]">
            Matches use the exact full name only. Uncheck anyone who is a different person with the same name.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="bg-transparent p-0 text-[11px] font-medium text-[var(--color-text2)] hover:underline"
        >
          Close
        </button>
      </div>

      {items.length === 0 && <p className="mt-3 text-[var(--color-text3)]">Every member in this fam is linked.</p>}

      {recommended.length > 0 && (
        <div className="mt-4">
          <h4 className={sectionTitleCls}>Exact matches ({recommended.length})</h4>
          <ul className="mt-1.5 space-y-1">
            {recommended.map((item) => (
              <li key={item.node.id}>
                <label className="flex items-center gap-2 text-[var(--color-text)]">
                  <input
                    type="checkbox"
                    checked={selected.has(item.node.id)}
                    onChange={() => toggle(item.node.id)}
                    disabled={busy}
                  />
                  <span className="font-medium">{item.node.name}</span>
                  <span aria-hidden className="text-[var(--color-text3)]">→</span>
                  <span className="sr-only">matches</span>
                  <span className="min-w-0">{item.candidates[0].displayName}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {needsReview.length > 0 && (
        <div className="mt-4">
          <h4 className={sectionTitleCls}>Needs manual review ({needsReview.length})</h4>
          <ul className="mt-1.5 space-y-2">
            {needsReview.map((item) => (
              <li key={item.node.id}>
                <p className="text-[var(--color-text)]">
                  <span aria-hidden>⚠️ </span>
                  <span className="font-medium">{item.node.name}</span>
                  <span className="text-[var(--color-text3)]">
                    {item.status === 'ambiguous'
                      ? ` → ${item.candidates.length} possible members`
                      : ` → ${item.candidates[0].displayName}, already claimed by ${item.conflictsWith.join(', ')}`}
                  </span>
                </p>
                {item.status === 'ambiguous' && (
                  <ul className="mt-1 space-y-1 pl-5">
                    {item.candidates.map((member) => (
                      <li key={member.id} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 text-[var(--color-text2)]">{member.displayName}</span>
                        <button
                          type="button"
                          className={linkBtnCls}
                          onClick={() => onLinkOne(item.node.id, member)}
                          disabled={busy}
                          aria-label={`Link ${item.node.name} to ${member.displayName}`}
                        >
                          Link
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {item.status === 'conflict' && (
                  <p className="mt-0.5 pl-5 text-[11px] text-[var(--color-text3)]">
                    Not linked automatically. If this is the same person, link it from the member row below.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {noMatch.length > 0 && (
        <div className="mt-4">
          <h4 className={sectionTitleCls}>No member record ({noMatch.length})</h4>
          <ul className="mt-1.5 space-y-0.5 text-[var(--color-text3)]">
            {noMatch.map((item) => (
              <li key={item.node.id}>
                <span aria-hidden>— </span>
                {item.node.name}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-[var(--color-text3)]">These stay name-only. Search from the member row if one is a current member.</p>
        </div>
      )}

      {recommended.length > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => onApply(toApply)}
            disabled={busy || toApply.length === 0}
            className="rounded border-0 bg-[var(--color-text)] px-3 py-1.5 text-xs font-medium text-[var(--color-bg)] disabled:opacity-50"
          >
            {busy
              ? 'Linking…'
              : `Link ${toApply.length} obvious match${toApply.length === 1 ? '' : 'es'}`}
          </button>
        </div>
      )}
    </section>
  );
}
