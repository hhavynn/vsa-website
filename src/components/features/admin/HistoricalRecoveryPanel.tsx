import { RecoveryWorkspace } from './recovery/RecoveryWorkspace';

export { RECOVERY_INVALIDATIONS } from './recovery/RecoveryWorkspace';

/**
 * Admin → Import → Historical Recovery. The event-scoped reconciliation
 * workspace; the single-row RecoveryFindingDialog stays available from every
 * row as Full review.
 */
export function HistoricalRecoveryPanel() {
  return <RecoveryWorkspace />;
}
