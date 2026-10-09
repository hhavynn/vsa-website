import { OUTCOME_LABELS, RecoveryActionRecord, RecoveryFinding } from '../../../../lib/attendanceRecovery';

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** The immutable recovery history, newest first, scoped by the workspace's event and import filters. */
export function RecoveryHistoryList({
  actions,
  findingByRow,
  eventId,
  importJobId,
}: {
  actions: readonly RecoveryActionRecord[];
  findingByRow: ReadonlyMap<string, RecoveryFinding>;
  eventId: string | null;
  importJobId: string;
}) {
  const rows = actions
    .filter((action) => {
      const finding = findingByRow.get(action.import_job_row_id);
      if (!finding) return !eventId && !importJobId;
      return (!eventId || finding.record.event_id === eventId) && (!importJobId || finding.record.import_job_id === importJobId);
    })
    .slice(0, 200);
  if (rows.length === 0) return <div className="px-5 py-8 text-sm text-[var(--color-text3)]">No recovery actions yet for this scope.</div>;
  return (
    <ul className="divide-y divide-[var(--color-border)]" aria-label="Recovery history">
      {rows.map((action) => {
        const finding = findingByRow.get(action.import_job_row_id);
        return (
          <li key={action.id} className="px-5 py-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-[var(--color-text)]">
                {OUTCOME_LABELS[action.outcome]}
                {finding && <span className="font-normal text-[var(--color-text2)]"> · {finding.record.display_name || 'Unnamed row'} · {finding.record.event_name ?? 'Event'} · row {finding.sheetRow}</span>}
              </span>
              <span className="text-xs text-[var(--color-text3)]">{formatDateTime(action.created_at)}</span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--color-text2)]">
              {action.points_awarded > 0 ? `${action.points_awarded} points awarded` : 'No points awarded'}
              {action.created_member ? ' · new member created' : ''}
              {action.reason_code ? ` · ${action.reason_code.replace(/_/g, ' ')}` : ''}
              {action.note ? ` · “${action.note}”` : ''}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
