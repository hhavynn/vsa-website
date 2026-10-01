import { PreflightItem, PreflightLine } from './PreflightItem';

export interface PreflightSummaryProps {
  title?: string;
  lines: PreflightLine[];
  /** Shown when there is nothing to report. */
  emptyText?: string;
}

/**
 * Passed lines first, then blockers, then "Needs attention". Domain screens
 * build the lines; this owns how every preflight reads.
 */
export function PreflightSummary({ title = 'Preflight', lines, emptyText = 'Nothing to check yet.' }: PreflightSummaryProps) {
  const passed = lines.filter((line) => line.severity === 'ok');
  const blockers = lines.filter((line) => line.severity === 'blocker');
  const attention = lines.filter((line) => line.severity === 'warning' || line.severity === 'info');

  return (
    <section
      className="scrapbook-paper p-5 border-[var(--color-border)] bg-surface"
      aria-label={title}
    >
      <h3 className="font-serif text-lg font-bold text-text-primary">
        {title}
      </h3>
      {lines.length === 0 && (
        <p className="mt-3 text-xs text-text-muted">
          {emptyText}
        </p>
      )}
      {passed.length > 0 && (
        <ul className="mt-3 space-y-1">
          {passed.map((line) => (
            <PreflightItem key={line.id} line={line} />
          ))}
        </ul>
      )}
      {blockers.length > 0 && (
        <div className="mt-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-red-600 dark:text-red-400">Blocking</p>
          <ul className="mt-1 space-y-1">
            {blockers.map((line) => (
              <PreflightItem key={line.id} line={line} />
            ))}
          </ul>
        </div>
      )}
      {attention.length > 0 && (
        <div className="mt-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">
            Needs attention
          </p>
          <ul className="mt-1 space-y-1">
            {attention.map((line) => (
              <PreflightItem key={line.id} line={line} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
