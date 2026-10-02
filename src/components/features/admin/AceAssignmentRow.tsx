import { useEffect, useState } from 'react';
import { AceAssignmentDraft } from '../../../types';
import { AceNodeRef, AssignmentIssue, BigLoad, LittleLinkReviewItem } from '../../../lib/aceAssignments';
import { isRenamed } from '../../../lib/memberPhotos';
import type { MemberOption } from '../../../lib/memberLinkMatching';
import { AceBigPicker } from './AceBigPicker';
import { MemberLinkPicker, MemberLinkSuggestion } from './MemberLinkPicker';
import { RowCheckbox } from './ops';

interface AceAssignmentRowProps {
  draft: AceAssignmentDraft;
  editable: boolean;
  nodes: readonly AceNodeRef[];
  linkedMember: MemberOption | null;
  review: LittleLinkReviewItem | undefined;
  issues: readonly AssignmentIssue[];
  loadFor: (bigId: string) => BigLoad;
  busy: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  reviewed?: boolean;
  onPatch: (
    id: string,
    patch: Partial<Pick<AceAssignmentDraft, 'little_name' | 'little_member_id' | 'big_ace_member_id' | 'notes'>>,
  ) => void;
  onRemove: (id: string) => void;
}

const fieldCls =
  'block w-full rounded border border-transparent bg-transparent px-1.5 py-1 font-sans text-sm text-[var(--color-text)] placeholder-[var(--color-text3)] hover:border-[var(--color-border)] focus:border-[var(--brand)] focus:bg-[var(--color-surface2)] focus:outline-none disabled:hover:border-transparent';

function suggestionFor(review: LittleLinkReviewItem | undefined): MemberLinkSuggestion | null {
  if (!review || review.candidates.length === 0) return null;
  if (review.status === 'recommended') return { kind: 'recommended', members: review.candidates };
  return {
    kind: 'review',
    members: review.candidates,
    note: review.status === 'conflict' ? 'This member is already used by another Little in this cycle.' : undefined,
  };
}

/** One Little → Big assignment. Renaming a Little clears its member link, like ACE nodes do. */
export function AceAssignmentRow({
  draft,
  editable,
  nodes,
  linkedMember,
  review,
  issues,
  loadFor,
  busy,
  selected = false,
  onToggleSelect,
  reviewed = false,
  onPatch,
  onRemove,
}: AceAssignmentRowProps) {
  const [name, setName] = useState(draft.little_name);
  const [notes, setNotes] = useState(draft.notes ?? '');
  useEffect(() => setName(draft.little_name), [draft.little_name]);
  useEffect(() => setNotes(draft.notes ?? ''), [draft.notes]);

  const commitName = () => {
    const next = name.replace(/\s+/g, ' ').trim();
    if (!next) {
      setName(draft.little_name);
      return;
    }
    if (next === draft.little_name) return;
    onPatch(draft.id, isRenamed(draft.little_name, next) ? { little_name: next, little_member_id: null } : { little_name: next });
  };
  const commitNotes = () => {
    const next = notes.trim();
    if (next !== (draft.notes ?? '')) onPatch(draft.id, { notes: next || null });
  };

  return (
    <li className="grid gap-3 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0 md:grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start" data-reviewed={reviewed}>
      <div className="pt-1.5">
        {onToggleSelect && <RowCheckbox checked={selected} onChange={() => onToggleSelect(draft.id)} label={`Select ${draft.little_name}`} />}
      </div>
      <div className="min-w-0">
        <label className="sr-only" htmlFor={`little-${draft.id}`}>
          Little name
        </label>
        <input
          id={`little-${draft.id}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          disabled={!editable || busy}
          className={`${fieldCls} font-medium`}
        />
        <label className="sr-only" htmlFor={`notes-${draft.id}`}>
          Notes for {draft.little_name}
        </label>
        <input
          id={`notes-${draft.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={commitNotes}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          disabled={!editable || busy}
          placeholder={editable ? 'Notes (admin only)' : ''}
          className={`${fieldCls} mt-0.5 text-xs text-[var(--color-text2)]`}
        />
        {reviewed && (
          <p className="mt-1 px-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-green-700 dark:text-green-400">✓ Reviewed</p>
        )}
        {issues.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-1 px-1.5">
            {issues.map((issue) => (
              <li
                key={issue.code}
                className="rounded border border-[var(--color-border)] px-1.5 py-px font-sans text-[10px] text-[var(--color-text2)]"
              >
                {issue.severity === 'blocker' ? '⛔ ' : '⚠️ '}
                {issue.message.replace(/^\d+ /, '')}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="min-w-0">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-text3)] md:hidden">Member</p>
        <MemberLinkPicker
          linkedMemberId={draft.little_member_id}
          linkedMember={linkedMember}
          suggestion={suggestionFor(review)}
          onLink={(member) => onPatch(draft.id, { little_member_id: member.id })}
          onUnlink={() => onPatch(draft.id, { little_member_id: null })}
          busy={busy}
          disabledReason={editable ? null : 'Unlock the cycle to change member links.'}
        />
      </div>

      <div className="min-w-0">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-text3)] md:hidden">Big</p>
        <AceBigPicker
          value={draft.big_ace_member_id}
          nodes={nodes}
          loadFor={loadFor}
          onChange={(bigId) => onPatch(draft.id, { big_ace_member_id: bigId })}
          disabled={!editable || busy}
          label={draft.little_name}
        />
      </div>

      <div className="md:text-right">
        {editable && (
          <button
            type="button"
            onClick={() => onRemove(draft.id)}
            disabled={busy}
            aria-label={`Remove ${draft.little_name}`}
            className="bg-transparent p-0 font-sans text-[11px] font-medium text-[var(--color-text3)] underline-offset-2 hover:text-red-500 hover:underline disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
    </li>
  );
}
