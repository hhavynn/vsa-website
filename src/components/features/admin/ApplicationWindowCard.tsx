import {
  WINDOW_STATE_LABELS,
  WindowState,
  formatPacificDateTime,
  getAdminWindowState,
  getClosingSoon,
  relativeDayPhrase,
} from '../../../lib/applicationWindows';
import { applicationKeyLabel } from '../../../lib/applicationLinks';
import { ApplicationLink } from '../../../types';

const STATE_COLOR: Record<WindowState, string> = {
  open: 'var(--brand)',
  scheduled: '#b45309',
  closed: 'var(--color-text3)',
  disabled: 'var(--color-text3)',
  misconfigured: '#dc2626',
};

const actionCls = 'rounded border px-2.5 py-1.5 font-sans text-xs';

interface ApplicationWindowCardProps {
  link: ApplicationLink;
  now: Date;
  selected: boolean;
  onEdit: (link: ApplicationLink) => void;
  onToggle: (link: ApplicationLink) => void;
  onDelete: (link: ApplicationLink) => void;
}

/**
 * One application window at a glance: state, both dates in Pacific Time, whether
 * students can reach the form right now, and anything misconfigured. Everything
 * here is derived from the shared window helpers, so it matches the public site.
 */
export function ApplicationWindowCard({ link, now, selected, onEdit, onToggle, onDelete }: ApplicationWindowCardProps) {
  const { state, issues, isPublic } = getAdminWindowState(link, now);
  const closingSoon = getClosingSoon([link], now)[0];

  return (
    <article
      className="px-4 py-4"
      data-state={state}
      aria-label={`${link.title}: ${WINDOW_STATE_LABELS[state]}`}
      style={{ background: selected ? 'var(--color-surface2)' : 'transparent' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{link.title}</h3>
            <span className="rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)' }}>
              {applicationKeyLabel(link.application_key)}
            </span>
          </div>
          <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
            Opens {formatPacificDateTime(link.open_at) || '—'} · Closes {formatPacificDateTime(link.due_at) || '—'}
          </p>
          <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
            Button: “{link.button_label}” · {link.target_url ? 'URL set' : 'No URL'} ·{' '}
            {isPublic ? 'Students can reach the form now' : 'Not public'}
          </p>
          {closingSoon && (
            <p className="mt-1 font-sans text-xs font-semibold" style={{ color: '#b45309' }}>
              Closes {relativeDayPhrase(closingSoon.daysUntilClose)}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: STATE_COLOR[state] }}>
            {WINDOW_STATE_LABELS[state]}
          </span>
          <span className="font-mono text-[10px]" style={{ color: link.is_enabled ? 'var(--brand)' : 'var(--color-text3)' }}>
            {link.is_enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      {issues.length > 0 && (
        <ul className="mt-2 space-y-1" aria-label="Problems with this window">
          {issues.map((issue) => (
            <li key={issue.code} className="font-sans text-xs" style={{ color: issue.severity === 'error' ? '#dc2626' : '#b45309' }}>
              {issue.severity === 'error' ? 'Problem: ' : 'Heads up: '}
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => onEdit(link)} className={actionCls} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
          Edit
        </button>
        <button type="button" onClick={() => onToggle(link)} className={actionCls} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
          {link.is_enabled ? 'Disable' : 'Enable'}
        </button>
        <button type="button" onClick={() => onDelete(link)} className={actionCls} style={{ borderColor: 'var(--color-border)', color: '#dc2626' }}>
          Delete
        </button>
      </div>
    </article>
  );
}
