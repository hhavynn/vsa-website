import {
  AttendanceImportMember,
  getMemberFullName,
} from '../../../lib/memberMatching';
import type { EffectiveStatus, RowDecision } from '../../../lib/attendanceImportDecisions';

export interface DecisionMember extends AttendanceImportMember {
  points?: number;
  events_attended?: number;
}

interface Props {
  rowLabel: string;
  status: EffectiveStatus;
  rowStatus: EffectiveStatus;
  decision: RowDecision | null;
  note: string;
  csvEmail: string;
  canMatch: boolean;
  canCreateNew: boolean;
  /** Existing members this row could be, best first. */
  candidates: DecisionMember[];
  /** Members who already hold the row's CSV email. */
  emailHolders: DecisionMember[];
  onDecide: (decision: RowDecision | null) => void;
}

const linkClass = 'text-left text-[11px] font-medium';

/** Name plus everything an admin needs to tell two similar people apart. */
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

export function AttendanceRowDecision({
  rowLabel,
  status,
  rowStatus,
  decision,
  note,
  csvEmail,
  canMatch,
  canCreateNew,
  candidates,
  emailHolders,
  onDecide,
}: Props) {
  const needsDecision = rowStatus === 'review';
  const chosen = decision?.kind === 'match' ? candidates.find((c) => c.id === decision.memberId) : undefined;
  const emailTaken = emailHolders.length > 0;
  const canSkip = rowStatus === 'review' || rowStatus === 'match' || rowStatus === 'new';

  return (
    <div className="space-y-2 text-xs" aria-label={`Decision for ${rowLabel}`}>
      {needsDecision && !decision && note && (
        <div className="font-medium text-text-secondary">{note}</div>
      )}

      {needsDecision && !decision && canMatch && candidates.length > 0 && (
        <ul className="space-y-1">
          {candidates.map((candidate) => (
            <li key={candidate.id} className="flex flex-wrap items-center gap-2">
              <MemberIdentity member={candidate} />
              <button
                type="button"
                onClick={() => onDecide({ kind: 'match', memberId: candidate.id })}
                aria-label={`Match existing member ${getMemberFullName(candidate)}`}
                className={`${linkClass} rounded border border-brand-600 px-2 py-0.5 text-brand-600 hover:bg-[var(--color-surface2)] dark:border-brand-400 dark:text-brand-400`}
              >
                Match Existing
              </button>
            </li>
          ))}
        </ul>
      )}

      {chosen && (
        <div className="text-text-primary">
          Matched to <MemberIdentity member={chosen} />
          {status === 'already' && ' — attendance already recorded for this event'}
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

      {decision?.kind !== 'new' && emailTaken && canCreateNew && (
        <div className="text-[11px] text-[var(--color-text3)]">
          {csvEmail} already belongs to {emailHolders.map(getMemberFullName).join(', ')}. A new member would be created without it.
        </div>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {!decision && canCreateNew && (rowStatus === 'review' || rowStatus === 'match' || rowStatus === 'already') && (
          <button
            type="button"
            onClick={() => onDecide({ kind: 'new' })}
            aria-label={`Create new member for ${rowLabel}`}
            className={`${linkClass} text-brand-600 hover:text-brand-700 dark:text-brand-400`}
          >
            Create New Member
          </button>
        )}
        {!decision && canSkip && (
          <button
            type="button"
            onClick={() => onDecide({ kind: 'skip' })}
            aria-label={`Skip ${rowLabel}`}
            className={`${linkClass} text-text-secondary hover:text-text-primary`}
          >
            Skip
          </button>
        )}
        {decision && (
          <button
            type="button"
            onClick={() => onDecide(null)}
            aria-label={`Undo decision for ${rowLabel}`}
            className={`${linkClass} text-text-muted hover:text-text-primary`}
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
