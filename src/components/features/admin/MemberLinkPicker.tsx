import { useEffect, useId, useState } from 'react';
import { memberLookupRepository } from '../../../data/repos/memberLookup';
import type { MemberOption } from '../../../lib/memberLinkMatching';

export interface MemberLinkSuggestion {
  /** recommended: one exact, unclaimed match. review: an admin must decide. */
  kind: 'recommended' | 'review';
  members: MemberOption[];
  note?: string;
}

export interface MemberLinkPickerProps {
  linkedMemberId: string | null;
  /** The resolved option for linkedMemberId, when the directory has it. */
  linkedMember: MemberOption | null;
  suggestion?: MemberLinkSuggestion | null;
  onLink: (member: MemberOption) => void;
  onUnlink: () => void;
  busy?: boolean;
  /** Blocks link changes and explains why (e.g. an unsaved rename). */
  disabledReason?: string | null;
}

const linkBtnCls =
  'rounded border border-[var(--color-border)] bg-transparent px-2 py-0.5 font-sans text-[11px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface2)] disabled:opacity-50';
const textBtnCls =
  'bg-transparent p-0 font-sans text-[11px] font-medium text-[var(--color-text2)] underline-offset-2 hover:underline disabled:opacity-50';

/**
 * Admin control that links a row (ACE node, Cabinet entry, photo request) to
 * a canonical members.id. Shows only public_members fields; never email.
 */
export function MemberLinkPicker({
  linkedMemberId,
  linkedMember,
  suggestion,
  onLink,
  onUnlink,
  busy = false,
  disabledReason = null,
}: MemberLinkPickerProps) {
  const searchId = useId();
  const [changing, setChanging] = useState(false);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<MemberOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const locked = busy || !!disabledReason;

  useEffect(() => {
    if (term.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      memberLookupRepository
        .searchMembers(term)
        .then((found) => {
          if (cancelled) return;
          setResults(found);
          setSearchFailed(false);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
          setSearchFailed(true);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [term]);

  useEffect(() => {
    setChanging(false);
    setTerm('');
  }, [linkedMemberId]);

  const choose = (member: MemberOption) => {
    setTerm('');
    setResults([]);
    onLink(member);
  };

  if (linkedMemberId && !changing) {
    return (
      <div className="font-sans text-xs">
        <p className="font-medium text-[var(--color-text)]">
          <span aria-hidden>✅ </span>
          {linkedMember?.displayName ?? 'Linked member (not in member directory)'}
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--color-text3)]">Linked to VSA member</p>
        <div className="mt-1 flex items-center gap-2 text-[var(--color-text3)]">
          <button type="button" className={textBtnCls} onClick={() => setChanging(true)} disabled={locked}>
            Change
          </button>
          <span aria-hidden>|</span>
          <button type="button" className={textBtnCls} onClick={onUnlink} disabled={locked}>
            Unlink
          </button>
        </div>
        {disabledReason && <p className="mt-1 text-[11px] text-[var(--color-text3)]">{disabledReason}</p>}
      </div>
    );
  }

  return (
    <div className="font-sans text-xs">
      {!linkedMemberId && (
        <p className="font-medium text-[var(--color-text2)]">
          <span aria-hidden>⚠️ </span>Not linked
        </p>
      )}

      {!linkedMemberId && suggestion && suggestion.members.length > 0 && (
        <div className="mt-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface2)] px-2.5 py-2">
          <p className="text-[11px] font-semibold text-[var(--color-text)]">
            {suggestion.kind === 'recommended'
              ? 'Suggested match'
              : `${suggestion.members.length} possible member${suggestion.members.length === 1 ? '' : 's'}. Check which person this is before linking.`}
          </p>
          {suggestion.note && <p className="mt-0.5 text-[11px] text-[var(--color-text3)]">{suggestion.note}</p>}
          <ul className="mt-1 space-y-1">
            {suggestion.members.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 text-[var(--color-text)]">{member.displayName}</span>
                <button
                  type="button"
                  className={linkBtnCls}
                  onClick={() => choose(member)}
                  disabled={locked}
                  aria-label={`Link to ${member.displayName}`}
                >
                  Link
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label htmlFor={searchId} className="sr-only">
        Search members
      </label>
      <input
        id={searchId}
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search members..."
        disabled={locked}
        autoComplete="off"
        className="mt-1.5 block w-full max-w-sm rounded border border-[var(--color-border)] bg-[var(--color-surface2)] px-2.5 py-1.5 font-sans text-xs text-[var(--color-text)] placeholder-[var(--color-text3)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] disabled:opacity-50"
      />
      {term.trim().length >= 2 && (
        <div className="mt-1 max-w-sm rounded border border-[var(--color-border)] bg-[var(--color-surface)]">
          {searching ? (
            <p className="px-2.5 py-1.5 text-[11px] text-[var(--color-text3)]">Searching…</p>
          ) : searchFailed ? (
            <p className="px-2.5 py-1.5 text-[11px] text-red-500">Member search failed. Try again.</p>
          ) : results.length === 0 ? (
            <p className="px-2.5 py-1.5 text-[11px] text-[var(--color-text3)]">No members found.</p>
          ) : (
            <ul>
              {results.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    onClick={() => choose(member)}
                    disabled={locked}
                    className="block w-full bg-transparent px-2.5 py-1.5 text-left font-sans text-xs text-[var(--color-text)] hover:bg-[var(--color-surface2)] disabled:opacity-50"
                  >
                    {member.displayName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {changing && (
        <button type="button" className={`${textBtnCls} mt-1.5`} onClick={() => setChanging(false)}>
          Cancel
        </button>
      )}
      {disabledReason && <p className="mt-1 text-[11px] text-[var(--color-text3)]">{disabledReason}</p>}
    </div>
  );
}
