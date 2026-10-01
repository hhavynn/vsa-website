import type { AssignmentPreflight } from '../../../lib/aceAssignments';

interface AceAssignmentPreflightPanelProps {
  preflight: AssignmentPreflight;
  /** The step this preflight guards, e.g. "Lock" or "Publish". */
  heading?: string;
}

/**
 * The checklist shown before Lock and again before Publish. Blockers stop
 * Publish; warnings (mostly member-link gaps) do not.
 */
export function AceAssignmentPreflightPanel({ preflight, heading = 'Preflight' }: AceAssignmentPreflightPanelProps) {
  const { issues } = preflight;
  return (
    <section
      aria-label={heading}
      className="rounded border border-[var(--color-border)] bg-[var(--color-surface2)] p-4 font-sans text-xs"
    >
      <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)]">{heading}</h3>
      <ul className="mt-2 space-y-1 text-[var(--color-text)]">
        <li>
          <span aria-hidden>✓ </span>
          {preflight.littleCount} {preflight.littleCount === 1 ? 'Little' : 'Littles'}
        </li>
        <li>
          <span aria-hidden>✓ </span>
          {preflight.linkedCount} canonical member {preflight.linkedCount === 1 ? 'link' : 'links'}
        </li>
      </ul>

      {issues.length === 0 ? (
        <p className="mt-3 text-[var(--color-text2)]">Nothing needs attention.</p>
      ) : (
        <>
          <p className="mt-3 font-semibold text-[var(--color-text)]">Needs attention</p>
          <ul className="mt-1 space-y-1">
            {issues.map((issue) => (
              <li key={issue.code} className="text-[var(--color-text)]">
                <span aria-hidden>⚠️ </span>
                {issue.message}
                {issue.severity === 'blocker' && (
                  <span className="ml-2 rounded border border-[var(--color-border)] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text2)]">
                    Blocks publish
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
