import { memo } from 'react';
import {
  BUCKET_LABELS,
  DISMISS_REASONS,
  MemberSnapshot,
  allowedActions,
  kindLabel,
  memberName,
  rowCreditsMember,
} from '../../../../lib/attendanceRecovery';
import { FLAG_LABELS, MemberLookup, RowInsight, TIER_LABELS } from '../../../../lib/recoveryTriage';
import { StageInput, StagedDecision, isLocked } from '../../../../lib/recoveryWorkspace';
import { cn } from '../../../../lib/utils';
import { MemberPickerPanel } from './MemberPickerPanel';
import { CreateMemberPanel, DismissPanel, NeedsInfoPanel } from './RowEditors';
import { MemberIdentity, TIER_CHIP, chip, formatDate, primarySmallBtn, smallBtn } from './recoveryUi';

export type EditorKind = 'restore' | 'reassign' | 'create_member' | 'dismiss' | 'needs_info';

export function stagedLabel(decision: StagedDecision, lookup: MemberLookup): string {
  const name = (id: string) => {
    const member = lookup.byId.get(id);
    return member ? memberName(member) : 'selected member';
  };
  switch (decision.kind) {
    case 'restore': return `Match → ${name(decision.memberId)}`;
    case 'reassign': return `Credit ${name(decision.memberId)}; keep original for investigation`;
    case 'create_member': return `New member: ${`${decision.newMember.first_name} ${decision.newMember.last_name}`.trim()}`;
    case 'dismiss': return `Dismiss: ${DISMISS_REASONS.find((r) => r.value === decision.reason)?.label ?? decision.reason}`;
    default: return `Hold: “${decision.note}”`;
  }
}

const EDITOR_FOR: Record<StagedDecision['kind'], EditorKind> = {
  restore: 'restore', reassign: 'reassign', create_member: 'create_member', dismiss: 'dismiss', needs_info: 'needs_info',
};

export interface RecoveryRowProps {
  insight: RowInsight;
  staged: StagedDecision | undefined;
  selected: boolean;
  active: boolean;
  editor: EditorKind | null;
  editorMember: MemberSnapshot | null;
  lookup: MemberLookup;
  rowIndex: number;
  onToggle: (rowId: string) => void;
  onActivate: (rowId: string) => void;
  onEditor: (rowId: string, kind: EditorKind | null, member?: MemberSnapshot | null) => void;
  onStage: (rowId: string, input: StageInput) => void;
  onUnstage: (rowId: string) => void;
  onOpenFull: (rowId: string) => void;
  registerRef: (rowId: string, element: HTMLDivElement | null) => void;
}

function RecoveryRowImpl({
  insight, staged, selected, active, editor, editorMember, lookup, rowIndex,
  onToggle, onActivate, onEditor, onStage, onUnstage, onOpenFull, registerRef,
}: RecoveryRowProps) {
  const { finding, candidates, triage, flags } = insight;
  const { record, classification } = finding;
  const rowId = record.row_id;
  const allowed = allowedActions(finding);
  const credited = rowCreditsMember(record) && record.attendance_member_id ? lookup.byId.get(record.attendance_member_id) ?? null : null;
  const locked = isLocked(staged);
  const recommended = triage.recommendation;
  const recommendedMember = recommended?.memberId ? lookup.byId.get(recommended.memberId) ?? null : null;
  const top = candidates[0] ?? null;
  const name = record.display_name || 'Unnamed row';
  const statusText = staged ? `staged: ${stagedLabel(staged, lookup)}` : BUCKET_LABELS[finding.bucket];
  const canDecide = allowed.some((kind) => kind !== 'reopen' && kind !== 'resolve_investigation');

  const stage = (input: StageInput) => onStage(rowId, input);
  const close = () => onEditor(rowId, null);
  const button = (kind: EditorKind, label: string, shortcut: string, primary = false) => (
    <button
      type="button"
      className={primary ? primarySmallBtn : smallBtn}
      aria-keyshortcuts={shortcut}
      title={`${label} (${shortcut})`}
      onClick={(event) => { event.stopPropagation(); onEditor(rowId, kind); }}
    >
      {label}
    </button>
  );

  return (
    <div
      ref={(element) => registerRef(rowId, element)}
      role="row"
      aria-rowindex={rowIndex + 2}
      aria-selected={selected}
      aria-label={`${name}, sheet row ${finding.sheetRow}, ${TIER_LABELS[triage.tier]}, ${statusText}`}
      data-row-id={rowId}
      tabIndex={active ? 0 : -1}
      onFocus={(event) => { if (event.target === event.currentTarget) onActivate(rowId); }}
      onMouseDown={() => onActivate(rowId)}
      className={cn(
        'group border-b border-[var(--color-border)] px-3 py-2.5 outline-none transition-colors md:px-4',
        'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400',
        selected && 'bg-brand-600/[0.06] dark:bg-brand-400/[0.08]',
        staged && !staged.issue && 'border-l-4 border-l-amber-500 dark:border-l-amber-400',
        staged?.issue && 'border-l-4 border-l-red-600 dark:border-l-red-400',
        active && !selected && 'bg-[var(--color-surface2)]',
      )}
    >
      <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 gap-y-2 md:grid-cols-[1.75rem_minmax(0,1.15fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1.25fr)] md:gap-x-4">
        <div role="gridcell" className="pt-0.5">
          <input
            type="checkbox"
            aria-label={`Select ${name}, sheet row ${finding.sheetRow}`}
            checked={selected}
            tabIndex={-1}
            onChange={() => onToggle(rowId)}
            onClick={(event) => event.stopPropagation()}
          />
        </div>

        <div role="gridcell" className="min-w-0">
          <p className="truncate font-medium text-[var(--color-text)]">{name}</p>
          <p className="truncate text-xs text-[var(--color-text2)]">{record.csv_email || 'No email on the row'}</p>
          <p className="truncate text-xs text-[var(--color-text2)]">{[record.csv_college, record.csv_year].filter(Boolean).join(' · ') || 'No college or year'}</p>
          <p className="text-[11px] text-[var(--color-text3)]">Sheet row {finding.sheetRow} · import {formatDate(record.job_created_at)}</p>
        </div>

        <div role="gridcell" className="col-start-2 min-w-0 md:col-start-auto">
          <div className="flex flex-wrap items-center gap-1">
            <span className={cn(chip, TIER_CHIP[triage.tier])}>{TIER_LABELS[triage.tier]}</span>
            <span className={cn(chip, 'bg-[var(--color-surface2)] text-[var(--color-text2)]')}>{kindLabel(classification.kind)}</span>
            {classification.priority === 'high' && <span className={cn(chip, 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300')}>High priority</span>}
          </div>
          <p className="mt-1 line-clamp-3 text-xs text-[var(--color-text2)]">{triage.explanation}</p>
          {flags.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-1">
              {flags.map((flag) => (
                <span key={flag} className={cn(chip, 'px-1.5 text-[10px]', flag === 'dismissed_but_missing' || flag === 'credit_removed' || flag === 'email_conflict'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300')}>
                  {FLAG_LABELS[flag]}
                </span>
              ))}
            </p>
          )}
        </div>

        <div role="gridcell" className="col-start-2 min-w-0 md:col-start-auto">
          {credited ? (
            <>
              <p className="text-[11px] uppercase tracking-label text-[var(--color-text3)]">Currently credited</p>
              <MemberIdentity member={credited} />
            </>
          ) : top ? (
            <>
              <p className="text-[11px] uppercase tracking-label text-[var(--color-text3)]">
                {recommendedMember ? 'Suggested by email' : candidates.length === 1 ? 'Similar member' : `${candidates.length} similar members`}
              </p>
              <MemberIdentity member={recommendedMember ?? top.member} candidate={candidates.find((c) => c.member.id === (recommendedMember ?? top.member).id)} />
            </>
          ) : (
            <p className="text-xs text-[var(--color-text3)]">{lookup.ready ? 'No similar members' : 'Loading members…'}</p>
          )}
        </div>

        <div role="gridcell" className="col-start-2 min-w-0 md:col-start-auto">
          {staged ? (
            <div className="space-y-1">
              <span className={cn(chip, 'border border-dashed border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-950/30 dark:text-amber-200')}>
                <span aria-hidden="true" className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                Staged
              </span>
              <p className="text-xs font-medium text-[var(--color-text)]">{stagedLabel(staged, lookup)}</p>
              {staged.issue && (
                <p role="status" className="text-xs font-medium text-red-700 dark:text-red-300">
                  {staged.issue.status === 'unknown' ? 'No answer last time. ' : staged.issue.status === 'conflict' ? 'Conflict: ' : 'Not applied: '}
                  {staged.issue.message}
                </p>
              )}
            </div>
          ) : (
            <span className={cn(chip, finding.bucket === 'recovered' || finding.bucket === 'dismissed'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-[var(--color-surface2)] text-[var(--color-text2)]')}>
              {BUCKET_LABELS[finding.bucket]}
            </span>
          )}
          {!editor && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {staged && !locked && (
                <>
                  {button(EDITOR_FOR[staged.kind], 'Change', 'Enter')}
                  <button type="button" className={smallBtn} aria-keyshortcuts="u" title="Undo this staged decision (u)" onClick={(event) => { event.stopPropagation(); onUnstage(rowId); }}>Undo</button>
                </>
              )}
              {staged && locked && <p className="text-[11px] text-[var(--color-text3)]">Locked until applied again from Review.</p>}
              {!staged && canDecide && (
                <>
                  {allowed.includes('restore') && button('restore', 'Match…', 'm', recommended?.kind === 'restore')}
                  {allowed.includes('reassign') && button('reassign', 'Credit correct…', 'm')}
                  {allowed.includes('create_member') && button('create_member', 'New member…', 'c', recommended?.kind === 'create_member')}
                  {allowed.includes('dismiss') && button('dismiss', 'Dismiss…', 'd', recommended?.kind === 'dismiss')}
                  {allowed.includes('needs_info') && finding.status !== 'needs_info' && button('needs_info', 'Hold…', 'n')}
                </>
              )}
              <button type="button" className={smallBtn} aria-keyshortcuts="e" title="Full review with stored source row (e)" onClick={(event) => { event.stopPropagation(); onOpenFull(rowId); }}>
                {canDecide ? 'Details' : 'Full review'}
              </button>
            </div>
          )}
        </div>
      </div>

      {editor && (
        <div role="gridcell" className="mt-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3 md:ml-9" onMouseDown={(event) => event.stopPropagation()}>
          {(editor === 'restore' || editor === 'reassign') && (
            <MemberPickerPanel
              finding={finding}
              mode={editor}
              candidates={candidates}
              credited={credited}
              attendedIds={lookup.attendedIds}
              initialMember={editorMember}
              onStage={stage}
              onCancel={close}
            />
          )}
          {editor === 'create_member' && (
            <CreateMemberPanel
              finding={finding}
              candidates={candidates}
              existing={staged}
              onStage={stage}
              onMatchInstead={(member) => onEditor(rowId, 'restore', member)}
              onCancel={close}
            />
          )}
          {editor === 'dismiss' && <DismissPanel finding={finding} credited={credited} existing={staged} onStage={stage} onCancel={close} />}
          {editor === 'needs_info' && <NeedsInfoPanel existing={staged} onStage={stage} onCancel={close} />}
        </div>
      )}
    </div>
  );
}

export const RecoveryRow = memo(RecoveryRowImpl);
