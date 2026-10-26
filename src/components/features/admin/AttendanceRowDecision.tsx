import { getMemberFullName } from '../../../lib/memberMatching';
import type { EffectiveStatus, RowDecision } from '../../../lib/attendanceImportDecisions';
import type { CandidateAssessment, EvidenceNote, IdentityMember } from '../../../lib/identityResolution';
import { cn } from '../../../lib/utils';

export interface DecisionMember extends IdentityMember {
  points?: number;
  events_attended?: number;
}

interface Props {
  rowLabel: string;
  status: EffectiveStatus;
  /** The matcher could not decide (or the row this one repeats is not imported). */
  needsDecision: boolean;
  decision: RowDecision | null;
  note: string;
  csvEmail: string;
  /** Row addresses no member holds yet; an admin match can remember them. */
  freshEmails: string[];
  /** Remember them unless unticked (exact names); otherwise opt-in. */
  rememberByDefault: boolean;
  canMatch: boolean;
  canCreateNew: boolean;
  canSkip: boolean;
  /** Existing members this row could be, best first, with why. */
  candidates: CandidateAssessment<DecisionMember>[];
  /** The row would create a new member; candidates are look-alikes the evidence ruled out. */
  suggestOnly: boolean;
  /** Members who already hold one of the row's addresses. */
  emailHolders: DecisionMember[];
  onDecide: (decision: RowDecision | null) => void;
}

const linkClass = 'text-left text-[11px] font-medium';

/** Name plus everything an admin needs to tell two similar people apart. Admin-only: shows email. */
export function MemberIdentity({ member }: { member: DecisionMember }) {
  const details = [
    member.college,
    member.year,
    member.email,
    typeof member.points === 'number' ? `${member.points} pts` : null,
  ].filter(Boolean);
  return (
    <span>
      <span className="font-medium">{getMemberFullName(member)}</span>
      {details.length > 0 && (
        <span className="ml-1 text-xs text-[var(--color-text3)]">· {details.join(' · ')}</span>
      )}
    </span>
  );
}

const TONE_CLASS: Record<EvidenceNote['tone'], string> = {
  support: 'text-emerald-700 dark:text-emerald-400',
  against: 'text-red-700 dark:text-red-400',
  neutral: 'text-text-secondary',
};
const TONE_MARK: Record<EvidenceNote['tone'], string> = { support: '✓', against: '✗', neutral: '·' };

export function EvidenceList({ notes }: { notes: EvidenceNote[] }) {
  return (
    <ul className="space-y-0.5 text-[11px]">
      {notes.map((note) => (
        <li key={note.text} className={TONE_CLASS[note.tone]}>
          <span aria-hidden="true">{TONE_MARK[note.tone]} </span>
          {note.text}
        </li>
      ))}
    </ul>
  );
}

export function AttendanceRowDecision({
  rowLabel,
  status,
  needsDecision,
  decision,
  note,
  csvEmail,
  freshEmails,
  rememberByDefault,
  canMatch,
  canCreateNew,
  canSkip,
  candidates,
  suggestOnly,
  emailHolders,
  onDecide,
}: Props) {
  const chosen = decision?.kind === 'match' ? candidates.find((c) => c.member.id === decision.memberId)?.member : undefined;
  const emailTaken = emailHolders.length > 0;
  const remember = decision?.kind === 'match' && (decision.rememberEmail ?? rememberByDefault);
  const showCandidates = !decision && canMatch && candidates.length > 0 && (needsDecision || suggestOnly);

  return (
    <div className="space-y-2 text-xs" aria-label={`Decision for ${rowLabel}`}>
      {(needsDecision || suggestOnly) && !decision && note && (
        <div className="font-medium text-text-secondary">{note}</div>
      )}

      {showCandidates && (
        <ul className="space-y-2">
          {suggestOnly && <li className="text-[11px] text-text-muted">Similar existing members, ruled out by their college or school email:</li>}
          {candidates.map((candidate) => (
            <li key={candidate.member.id} className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <MemberIdentity member={candidate.member} />
                <button
                  type="button"
                  onClick={() => onDecide({ kind: 'match', memberId: candidate.member.id })}
                  aria-label={`Match existing member ${getMemberFullName(candidate.member)}`}
                  className={cn(linkClass, 'rounded border border-brand-600 px-2 py-0.5 text-brand-600 hover:bg-[var(--color-surface2)] dark:border-brand-400 dark:text-brand-400')}
                >
                  Match Existing
                </button>
              </div>
              <EvidenceList notes={candidate.notes} />
            </li>
          ))}
        </ul>
      )}

      {chosen && (
        <div className="space-y-1 text-text-primary">
          <div>
            Matched to <MemberIdentity member={chosen} />
            {status === 'already' && ' — attendance already recorded for this event'}
          </div>
          {freshEmails.length > 0 && (
            <label className="flex items-start gap-1.5 text-[11px] text-text-secondary">
              <input
                type="checkbox"
                className="mt-0.5 rounded"
                checked={remember}
                onChange={(e) => onDecide({ kind: 'match', memberId: chosen.id, rememberEmail: e.target.checked })}
              />
              <span>Remember {freshEmails.join(' and ')} as {getMemberFullName(chosen)}'s email for future imports</span>
            </label>
          )}
        </div>
      )}
      {decision?.kind === 'new' && (
        <div className="text-text-primary">
          Confirmed as a different person. A new member will be created
          {emailTaken ? ' without the email (already on file)' : ''}.
        </div>
      )}
      {decision?.kind === 'skip' && (
        <div className="text-text-muted">Skipped. No attendance will be recorded for this row.</div>
      )}

      {decision?.kind !== 'new' && emailTaken && canCreateNew && (needsDecision || decision) && (
        <div className="text-[11px] text-[var(--color-text3)]">
          {csvEmail} already belongs to {emailHolders.map(getMemberFullName).join(', ')}. A new member would be created without it.
        </div>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {!decision && canCreateNew && (
          <button
            type="button"
            onClick={() => onDecide({ kind: 'new' })}
            aria-label={`Create new member for ${rowLabel}`}
            className={cn(linkClass, 'text-brand-600 hover:text-brand-700 dark:text-brand-400')}
          >
            Create New Member
          </button>
        )}
        {!decision && canSkip && (
          <button
            type="button"
            onClick={() => onDecide({ kind: 'skip' })}
            aria-label={`Skip ${rowLabel}`}
            className={cn(linkClass, 'text-text-secondary hover:text-text-primary')}
          >
            Skip
          </button>
        )}
        {decision && (
          <button
            type="button"
            onClick={() => onDecide(null)}
            aria-label={`Undo decision for ${rowLabel}`}
            className={cn(linkClass, 'text-text-muted hover:text-text-primary')}
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
