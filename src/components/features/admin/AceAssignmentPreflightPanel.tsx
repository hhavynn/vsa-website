import type { AssignmentPreflight } from '../../../lib/aceAssignments';
import { aceIssues, buildReadiness } from '../../../lib/adminPreflight';
import { ReadinessPanel } from './ops';

interface AceAssignmentPreflightPanelProps {
  preflight: AssignmentPreflight;
  /** The step this preflight guards, e.g. "Preflight before locking". */
  heading?: string;
  readyLabel?: string;
  /** Selecting an issue's fix applies that quick filter to the rows below. */
  onFilter?: (key: string) => void;
}

/**
 * The checklist shown before Lock and again before Publish, in the shared
 * preflight presentation: a Ready / Not Ready verdict, then each issue with
 * severity, why it matters, how many Littles, and a direct fix. Blockers stop
 * Publish; warnings (mostly member-link gaps) never do.
 */
export function AceAssignmentPreflightPanel({ preflight, heading = 'Preflight', readyLabel, onFilter }: AceAssignmentPreflightPanelProps) {
  const readiness = buildReadiness(aceIssues(preflight), { ready: readyLabel });
  const passed = [
    `${preflight.littleCount} ${preflight.littleCount === 1 ? 'Little' : 'Littles'}`,
    `${preflight.linkedCount} canonical member ${preflight.linkedCount === 1 ? 'link' : 'links'}`,
  ];
  return <ReadinessPanel readiness={readiness} title={heading} onFilter={onFilter} passed={passed} />;
}
