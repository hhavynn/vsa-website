import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from 'react-query';
import { attendanceRecoveryRepository } from '../../../../data/repos/attendanceRecovery';
import { MemberSnapshot, RecoveryFinding, memberName } from '../../../../lib/attendanceRecovery';
import { Candidate, describeCandidate, rankCandidates } from '../../../../lib/recoveryTriage';
import { StageInput } from '../../../../lib/recoveryWorkspace';
import { cn } from '../../../../lib/utils';
import { CandidateEvidence, MemberIdentity, inputCls, primarySmallBtn, sectionLabel, smallBtn, warnBox } from './recoveryUi';

function useDebounced(value: string, ms = 250): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/**
 * Inline member picker for one row: the strongest candidates first, a search
 * for everyone else, and a confirmation step that names the evidence. Nothing
 * is preselected, and nothing is staged until the admin confirms the identity.
 */
export function MemberPickerPanel({
  finding,
  mode,
  candidates,
  credited,
  attendedIds,
  initialMember,
  onStage,
  onCancel,
}: {
  finding: RecoveryFinding;
  /** restore: match the attendee; reassign: credit the correct member instead of `credited`. */
  mode: 'restore' | 'reassign';
  candidates: readonly Candidate[];
  credited: MemberSnapshot | null;
  attendedIds: ReadonlySet<string> | null;
  /** Opens straight on the confirmation for this member (e.g. the holder of a conflicting email). */
  initialMember?: MemberSnapshot | null;
  onStage: (input: StageInput) => void;
  onCancel: () => void;
}) {
  const uid = useId();
  const listId = `${uid}-list`;
  const { record } = finding;
  const [term, setTerm] = useState('');
  const debounced = useDebounced(term);
  const [activeIndex, setActiveIndex] = useState(0);
  const [chosen, setChosen] = useState<Candidate | null>(() =>
    initialMember ? describeCandidate(initialMember, record, attendedIds) : null);
  const [verified, setVerified] = useState(false);
  const [note, setNote] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const search = useQuery(
    ['attendance-recovery', 'member-search', debounced.trim().toLowerCase()],
    () => attendanceRecoveryRepository.searchMembers(debounced, 10),
    { enabled: debounced.trim().length >= 2, staleTime: 30_000 },
  );

  const options = useMemo(() => {
    const excluded = mode === 'reassign' ? credited?.id ?? record.attendance_member_id : null;
    const seen = new Set<string>();
    const merged: Candidate[] = [];
    candidates.forEach((c) => { if (c.member.id !== excluded && !seen.has(c.member.id)) { seen.add(c.member.id); merged.push({ ...c }); } });
    (search.data ?? []).forEach((member) => {
      if (member.id === excluded || seen.has(member.id)) return;
      seen.add(member.id);
      merged.push(describeCandidate(member, record, attendedIds));
    });
    // Suggested candidates keep their order; search results follow.
    const suggested = rankCandidates(merged.filter((c) => c.sources.length > 0));
    const searched = merged.filter((c) => c.sources.length === 0);
    return [...suggested, ...rankCandidates(searched)];
  }, [candidates, search.data, mode, credited, record, attendedIds]);

  useEffect(() => { setActiveIndex(0); }, [debounced]);
  useEffect(() => {
    if (chosen) confirmRef.current?.focus();
    else inputRef.current?.focus();
  }, [chosen]);

  const choose = (candidate: Candidate) => {
    setChosen(candidate);
    setVerified(false);
  };

  const onInputKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((i) => Math.min(i + 1, options.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (event.key === 'Enter' && options[activeIndex]) { event.preventDefault(); choose(options[activeIndex]); }
    else if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
  };

  const stage = () => {
    if (!chosen || !verified) return;
    onStage(mode === 'restore' ? { kind: 'restore', member: chosen.member } : { kind: 'reassign', member: chosen.member, note });
  };

  const rowSummary = [record.csv_email, record.csv_college, record.csv_year].filter(Boolean).join(' · ') || 'no email, college or year';
  const title = mode === 'restore' ? `Which member is ${record.display_name || 'this attendee'}?` : 'Who should have been credited?';

  if (chosen) {
    return (
      <div className="space-y-2.5" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onCancel(); } }}>
        <p className={sectionLabel}>{mode === 'restore' ? 'Confirm the match' : 'Confirm the correction'}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded border border-[var(--color-border)] p-2">
            <p className="text-[11px] text-[var(--color-text3)]">On the sheet (row {finding.sheetRow})</p>
            <p className="font-medium text-[var(--color-text)]">{record.display_name || 'No name'}</p>
            <p className="text-xs text-[var(--color-text2)]">{rowSummary}</p>
          </div>
          <div className="rounded border border-brand-600/40 p-2 dark:border-brand-400/40">
            <p className="text-[11px] text-[var(--color-text3)]">{mode === 'restore' ? 'Existing member' : 'Correct member'}</p>
            <MemberIdentity member={chosen.member} candidate={chosen} />
          </div>
        </div>
        {mode === 'restore' && chosen.attended && (
          <div className={warnBox} role="note">
            <p className="font-medium">{memberName(chosen.member)} already has attendance for this event.</p>
            <p className="mt-0.5">Matching adds nothing and cannot be reopened later. If this row is a duplicate of their other row, dismiss it as a legitimate duplicate instead.</p>
            <button type="button" className={cn(smallBtn, 'mt-1.5')} disabled={!verified} title={verified ? undefined : 'Confirm below that this is the same person first'} onClick={() => onStage({ kind: 'dismiss', reason: 'legitimate_duplicate', note: `Same person as ${memberName(chosen.member)} (${chosen.member.id.slice(0, 8)}), who already has attendance for this event.` })}>
              Stage “legitimate duplicate” instead
            </button>
          </div>
        )}
        {mode === 'reassign' && (
          <>
            <p className="rounded border border-[var(--color-border)] bg-[var(--color-surface2)] p-2 text-xs text-[var(--color-text2)]">
              {credited ? memberName(credited) : 'The original member'} keeps their attendance. It is flagged for investigation, never removed here.
            </p>
            <label className="block text-xs text-[var(--color-text2)]" htmlFor={`${uid}-note`}>Note (optional, admin-only)</label>
            <textarea id={`${uid}-note`} className={cn(inputCls, 'min-h-[48px]')} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
          </>
        )}
        <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
          <input ref={confirmRef} type="checkbox" className="mt-0.5" checked={verified} onChange={(event) => setVerified(event.target.checked)} />
          {mode === 'restore'
            ? 'I verified this is the same person (email, college, year or the source sheet), not just a similar name.'
            : 'I verified the sheet row belongs to the member I selected.'}
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primarySmallBtn} disabled={!verified} onClick={stage}>
            {mode === 'restore' ? 'Stage match' : 'Stage correction'}
          </button>
          <button type="button" className={smallBtn} onClick={() => setChosen(null)}>Choose someone else</button>
          <button type="button" className={smallBtn} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    );
  }

  const activeId = options[activeIndex] ? `${uid}-opt-${activeIndex}` : undefined;
  return (
    <div className="space-y-2">
      <label htmlFor={`${uid}-search`} className={sectionLabel}>{title}</label>
      <input
        id={`${uid}-search`}
        ref={inputRef}
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        className={inputCls}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        onKeyDown={onInputKey}
        placeholder="Search by name or email"
      />
      <ul id={listId} role="listbox" aria-label="Members" className="max-h-64 space-y-1 overflow-y-auto">
        {options.length === 0 && (
          <li role="presentation" className="px-1 py-1 text-xs text-[var(--color-text3)]">
            {debounced.trim().length >= 2 ? (search.isLoading ? 'Searching…' : 'No members found.') : 'No suggested members. Type at least 2 letters to search.'}
          </li>
        )}
        {options.map((candidate, index) => (
          <li
            key={candidate.member.id}
            id={`${uid}-opt-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(candidate)}
            className={cn(
              'flex cursor-pointer items-start justify-between gap-2 rounded border px-2.5 py-1.5',
              index === activeIndex ? 'border-brand-600 bg-brand-600/5 dark:border-brand-400 dark:bg-brand-400/10' : 'border-[var(--color-border)]',
            )}
          >
            <MemberIdentity member={candidate.member} />
            <span className="flex shrink-0 flex-col items-end gap-0.5">
              {candidate.sources.length > 0 && <span className="text-[10px] uppercase tracking-label text-[var(--color-text3)]">Suggested</span>}
              <CandidateEvidence candidate={candidate} />
            </span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button type="button" className={smallBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
