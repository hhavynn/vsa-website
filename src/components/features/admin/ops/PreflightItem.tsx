import { Link } from 'react-router-dom';
import { PREFLIGHT_MARKER, PreflightLine, PreflightSeverity } from '../../../../lib/operationalStatus';

const TONE: Record<PreflightSeverity, string> = {
  ok: 'text-green-700 dark:text-green-400',
  warning: 'text-amber-700 dark:text-amber-400',
  blocker: 'text-red-600 dark:text-red-400',
  info: 'text-text-muted',
};

export type { PreflightLine };

/** One blocker / warning / passed line. Links to the fixing tool when given a destination. */
export function PreflightItem({ line }: { line: PreflightLine }) {
  const marker = (
    <>
      <span aria-hidden>{PREFLIGHT_MARKER[line.severity]}</span> {line.message}
    </>
  );
  return (
    <li
      className={`text-xs ${TONE[line.severity]}`}
      data-severity={line.severity}
    >
      {line.to ? (
        <Link to={line.to} className="underline-offset-2 hover:underline">
          {marker} <span aria-hidden>→</span>
        </Link>
      ) : (
        marker
      )}
    </li>
  );
}
