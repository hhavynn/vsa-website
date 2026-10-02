import { Link } from 'react-router-dom';
import { IssueFix, Readiness, UnifiedIssue } from '../../../../lib/adminPreflight';
import { cn } from '../../../../lib/utils';

const LEVEL_LABEL = { blocker: 'BLOCKER', warning: 'WARNING', info: 'INFO' } as const;
const LEVEL_MARK = { blocker: '✕', warning: '⚠', info: '○' } as const;
const LEVEL_TONE = {
  blocker: 'border-red-600/40 text-red-600 dark:text-red-400',
  warning: 'border-amber-500/40 text-amber-700 dark:text-amber-400',
  info: 'border-[var(--color-border)] text-text-muted',
} as const;

function FixAction({ fix, onFilter }: { fix: IssueFix; onFilter?: (key: string) => void }) {
  const cls =
    'inline-flex rounded border border-[var(--color-border)] px-2.5 py-1 font-sans text-xs font-semibold text-brand-700 transition-colors hover:bg-[var(--color-surface2)] dark:text-brand-300';
  if (fix.to) return <Link to={fix.to} className={cls}>{fix.label} →</Link>;
  if (fix.filter && onFilter) {
    return (
      <button type="button" onClick={() => onFilter(fix.filter as string)} className={cls}>
        {fix.label} →
      </button>
    );
  }
  return null;
}

export function IssueCard({ issue, onFilter }: { issue: UnifiedIssue; onFilter?: (key: string) => void }) {
  return (
    <li data-level={issue.level} className={cn('rounded border bg-surface px-3 py-2.5', LEVEL_TONE[issue.level])}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-sans text-[13px] font-semibold">
            <span aria-hidden>{LEVEL_MARK[issue.level]}</span>{' '}
            <span className="mr-1.5 font-mono text-[10px] font-bold tracking-[0.08em]">{LEVEL_LABEL[issue.level]}</span>
            <span className="text-text-primary">{issue.title}</span>
          </p>
          {issue.detail && <p className="mt-0.5 font-sans text-xs text-text-secondary">{issue.detail}</p>}
          {issue.count > 0 && <p className="mt-0.5 font-mono text-[11px] text-text-muted">{issue.count} affected</p>}
        </div>
        {issue.fix && <FixAction fix={issue.fix} onFilter={onFilter} />}
      </div>
    </li>
  );
}

/**
 * The shared preflight card: a verdict on top ("Ready to Publish · 0 blockers ·
 * 3 warnings") and each issue with severity, why it matters, how many records,
 * and a direct fix. Diagnostic only; lock/publish still enforce their own rules.
 */
export function ReadinessPanel({
  readiness,
  title = 'Preflight',
  onFilter,
  passed = [],
}: {
  readiness: Readiness;
  title?: string;
  onFilter?: (key: string) => void;
  /** Short "✓" facts that are already in good shape, e.g. "47 Littles". */
  passed?: readonly string[];
}) {
  return (
    <section aria-label={title} className="scrapbook-paper border-[var(--color-border)] bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-lg font-bold text-text-primary">{title}</h3>
        <p
          data-ready={readiness.ready}
          className={cn('font-sans text-sm font-bold', readiness.ready ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400')}
        >
          {readiness.ready ? '✓' : '✕'} {readiness.headline}
        </p>
      </div>
      <p className="font-mono text-[11px] text-text-muted">{readiness.subline}</p>
      {passed.length > 0 && (
        <ul className="mt-2 space-y-0.5 font-sans text-xs text-text-secondary">
          {passed.map((line) => (
            <li key={line}>
              <span aria-hidden className="text-green-700 dark:text-green-400">✓ </span>
              {line}
            </li>
          ))}
        </ul>
      )}
      {readiness.issues.length === 0 ? (
        <p className="mt-3 font-sans text-xs text-text-muted">Nothing needs attention.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {readiness.issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} onFilter={onFilter} />
          ))}
        </ul>
      )}
    </section>
  );
}
