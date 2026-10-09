import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import {
  DISMISS_REASONS,
  DismissReason,
  MemberSnapshot,
  NewMemberInput,
  RecoveryFinding,
  memberName,
  splitDisplayName,
  validatePlan,
} from '../../../../lib/attendanceRecovery';
import { Candidate, hasDuplicateEvidence, normEmail } from '../../../../lib/recoveryTriage';
import { StageInput, StagedDecision } from '../../../../lib/recoveryWorkspace';
import { cn } from '../../../../lib/utils';
import { MemberIdentity, errorBox, inputCls, labelCls, primarySmallBtn, sectionLabel, smallBtn, warnBox } from './recoveryUi';

function EditorShell({ title, onCancel, children }: { title: string; onCancel: () => void; children: ReactNode }) {
  return (
    <div className="space-y-2.5" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onCancel(); } }}>
      <p className={sectionLabel}>{title}</p>
      {children}
    </div>
  );
}

function useFirstFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return ref;
}

/**
 * Stage a separate member for this row. Never merges anyone: an email already
 * on file blocks it (match that member, or create without the email), and the
 * admin confirms explicitly that this is a new person.
 */
export function CreateMemberPanel({
  finding,
  candidates,
  existing,
  onStage,
  onMatchInstead,
  onCancel,
}: {
  finding: RecoveryFinding;
  candidates: readonly Candidate[];
  existing?: StagedDecision;
  onStage: (input: StageInput) => void;
  onMatchInstead: (member: MemberSnapshot) => void;
  onCancel: () => void;
}) {
  const uid = useId();
  const { record } = finding;
  const firstRef = useFirstFocus<HTMLInputElement>();
  const [form, setForm] = useState<NewMemberInput>(() => (existing?.kind === 'create_member' ? existing.newMember : {
    ...splitDisplayName(record.display_name),
    email: record.csv_email ?? '',
    college: record.csv_college ?? '',
    year: record.csv_year ?? '',
  }));
  const [differentPerson, setDifferentPerson] = useState(false);
  const [newPerson, setNewPerson] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const holder = candidates.find((c) => !!normEmail(form.email) && normEmail(c.member.email) === normEmail(form.email))?.member ?? null;
  const emailFlaggedByAudit = record.email_in_members && normEmail(form.email) === normEmail(record.csv_email) && !holder;

  const stage = () => {
    const invalid = validatePlan({ action: 'create_member', newMember: form });
    if (invalid) return setError(invalid);
    if (holder) return setError('A member already has this email. Match them, or create without an email.');
    if (emailFlaggedByAudit) return setError('The audit found a member with this email. Match them, or create without an email.');
    if (candidates.length > 0 && !differentPerson) return setError('Confirm this attendee is a different person from every member listed.');
    if (!newPerson) return setError('Confirm this attendee is a new person.');
    onStage({ kind: 'create_member', newMember: form });
  };

  const fields: Array<[keyof NewMemberInput, string]> = [
    ['first_name', 'First name'], ['last_name', 'Last name'], ['email', 'Email (optional)'], ['college', 'College (optional)'], ['year', 'Year (optional)'],
  ];
  return (
    <EditorShell title="Create a separate member" onCancel={onCancel}>
      <div className="grid gap-2 sm:grid-cols-5">
        {fields.map(([field, label], index) => (
          <div key={field} className={field === 'email' ? 'sm:col-span-2' : undefined}>
            <label className={labelCls} htmlFor={`${uid}-${field}`}>{label}</label>
            <input
              id={`${uid}-${field}`}
              ref={index === 0 ? firstRef : undefined}
              className={cn(inputCls, field === 'email' && (holder || emailFlaggedByAudit) && 'border-red-500 dark:border-red-400')}
              aria-invalid={field === 'email' && (!!holder || emailFlaggedByAudit) ? true : undefined}
              value={form[field]}
              onChange={(event) => { setForm((prev) => ({ ...prev, [field]: event.target.value })); setError(null); }}
            />
          </div>
        ))}
      </div>
      {(holder || emailFlaggedByAudit) && (
        <div className={warnBox} role="note">
          <p className="font-medium">Email conflict: this email belongs to an existing member.</p>
          {holder && <div className="mt-1"><MemberIdentity member={holder} /></div>}
          <div className="mt-2 flex flex-wrap gap-2">
            {holder && <button type="button" className={smallBtn} onClick={() => onMatchInstead(holder)}>Match {memberName(holder)} instead</button>}
            <button type="button" className={smallBtn} onClick={() => setForm((prev) => ({ ...prev, email: '' }))}>Create without email</button>
          </div>
        </div>
      )}
      {candidates.length > 0 && (
        <div className="rounded border border-[var(--color-border)] p-2">
          <p className={sectionLabel}>Similar members</p>
          <ul className="mt-1 grid gap-1.5 sm:grid-cols-2">
            {candidates.slice(0, 6).map((c) => <li key={c.member.id}><MemberIdentity member={c.member} candidate={c} /></li>)}
          </ul>
          <label className="mt-2 flex items-start gap-2 text-sm text-[var(--color-text)]">
            <input type="checkbox" className="mt-0.5" checked={differentPerson} onChange={(event) => setDifferentPerson(event.target.checked)} />
            This attendee is a different person from every member listed. Nothing will be merged.
          </label>
        </div>
      )}
      <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
        <input type="checkbox" className="mt-0.5" checked={newPerson} onChange={(event) => setNewPerson(event.target.checked)} />
        I confirm this attendee is a new person who is not already a member.
      </label>
      {error && <p role="alert" className={errorBox}>{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={primarySmallBtn} onClick={stage}>Stage new member</button>
        <button type="button" className={smallBtn} onClick={onCancel}>Cancel</button>
      </div>
    </EditorShell>
  );
}

type DismissChoice = DismissReason | 'match_correct';

/** Quick dismissal. "Match is correct" (wrong-match rows only) needs evidence naming the member. */
export function DismissPanel({
  finding,
  credited,
  existing,
  onStage,
  onCancel,
}: {
  finding: RecoveryFinding;
  /** The member this row currently credits, for "Match is correct". */
  credited: MemberSnapshot | null;
  existing?: StagedDecision;
  onStage: (input: StageInput) => void;
  onCancel: () => void;
}) {
  const uid = useId();
  const firstRef = useFirstFocus<HTMLInputElement>();
  const prefix = credited ? `Verified the original match to ${memberName(credited)} (${credited.id.slice(0, 8)}) is correct: ` : '';
  const [choice, setChoice] = useState<DismissChoice>(existing?.kind === 'dismiss' ? existing.reason : 'legitimate_duplicate');
  const [note, setNote] = useState(existing?.kind === 'dismiss' ? existing.note : '');
  const [error, setError] = useState<string | null>(null);
  const options: Array<{ value: DismissChoice; label: string; hint: string }> = [
    ...(credited ? [{ value: 'match_correct' as const, label: 'Match is correct', hint: `${memberName(credited)} really is this attendee. Record the evidence.` }] : []),
    ...DISMISS_REASONS,
  ];
  const noEvidence = choice === 'legitimate_duplicate' && !hasDuplicateEvidence(finding.record);
  const noteRequired = choice === 'not_actionable' || choice === 'match_correct';

  const stage = () => {
    if (noteRequired && !note.trim()) return setError(choice === 'match_correct' ? 'Record the evidence that the match is correct.' : 'Explain why this finding is not actionable.');
    if (choice === 'match_correct') onStage({ kind: 'dismiss', reason: 'not_actionable', note: `${prefix}${note.trim()}`.slice(0, 500) });
    else onStage({ kind: 'dismiss', reason: choice, note });
  };

  return (
    <EditorShell title="Dismiss finding" onCancel={onCancel}>
      <fieldset className="space-y-1.5 text-sm text-[var(--color-text)]">
        <legend className="sr-only">Reason</legend>
        {options.map((option, index) => (
          <label key={option.value} className="flex items-start gap-2">
            <input ref={index === 0 ? firstRef : undefined} type="radio" name={`${uid}-reason`} className="mt-0.5" checked={choice === option.value} onChange={() => { setChoice(option.value); setError(null); }} />
            <span>{option.label}<span className="block text-xs text-[var(--color-text2)]">{option.hint}</span></span>
          </label>
        ))}
      </fieldset>
      {noEvidence && (
        <p className={warnBox} role="note">No ledger evidence shows this person already credited for the event. Dismissing may hide missing attendance.</p>
      )}
      <div>
        <label className={labelCls} htmlFor={`${uid}-note`}>
          {choice === 'match_correct' ? 'Evidence (required)' : noteRequired ? 'Why is this not actionable? (required)' : 'Note (optional)'}
        </label>
        {choice === 'match_correct' && <p className="mb-1 text-[11px] text-[var(--color-text3)]">Saved as: “{prefix}…”</p>}
        <textarea id={`${uid}-note`} className={cn(inputCls, 'min-h-[48px]')} maxLength={500 - (choice === 'match_correct' ? prefix.length : 0)} value={note} onChange={(event) => { setNote(event.target.value); setError(null); }} />
        <p className="mt-0.5 text-[11px] text-[var(--color-text3)]">Admin-only. Do not include emails or phone numbers.</p>
      </div>
      {error && <p role="alert" className={errorBox}>{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={primarySmallBtn} onClick={stage}>Stage dismissal</button>
        <button type="button" className={smallBtn} onClick={onCancel}>Cancel</button>
      </div>
    </EditorShell>
  );
}

export const NEEDS_INFO_TEMPLATES = [
  'Need the original sign-in sheet to confirm.',
  'Need to confirm the attendee’s email with them.',
  'Need an officer who ran the event to confirm.',
];

/** Put a row on hold. The note says what is missing and is kept with the finding. */
export function NeedsInfoPanel({ existing, onStage, onCancel }: { existing?: StagedDecision; onStage: (input: StageInput) => void; onCancel: () => void }) {
  const uid = useId();
  const ref = useFirstFocus<HTMLTextAreaElement>();
  const [note, setNote] = useState(existing?.kind === 'needs_info' ? existing.note : '');
  const [error, setError] = useState<string | null>(null);
  const stage = () => (note.trim() ? onStage({ kind: 'needs_info', note }) : setError('Note what information is missing.'));
  return (
    <EditorShell title="Needs more information" onCancel={onCancel}>
      <label className={labelCls} htmlFor={`${uid}-note`}>What is missing? (required)</label>
      <textarea ref={ref} id={`${uid}-note`} className={cn(inputCls, 'min-h-[48px]')} maxLength={500} value={note} onChange={(event) => { setNote(event.target.value); setError(null); }} />
      <div className="flex flex-wrap gap-1.5" aria-label="Quick notes">
        {NEEDS_INFO_TEMPLATES.map((template) => (
          <button key={template} type="button" className={cn(smallBtn, 'text-[11px]')} onClick={() => setNote(template)}>{template}</button>
        ))}
      </div>
      {error && <p role="alert" className={errorBox}>{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={primarySmallBtn} onClick={stage}>Stage hold</button>
        <button type="button" className={smallBtn} onClick={onCancel}>Cancel</button>
      </div>
    </EditorShell>
  );
}
