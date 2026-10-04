// The small, dependency-free part of the link check that the admin pages also
// need: where a URL is used, and when a failed check is certain enough to show.
// Kept apart from contentLinkCheck.ts (target list, host policy, runner) so the
// client bundle never includes the checker or the storage audit it imports.

export type LinkKind = 'image' | 'link';

export interface LinkUsage {
  table: string;
  id: string;
  field: string;
  /** The public name of the row (event name, album title). Never a person or a note. */
  label: string;
  /** The admin page that fixes it. */
  path: string;
  kind: LinkKind;
}

/** Failures that are certain on the first sighting; everything else must repeat on a later run. */
// An HTML answer to an image request can be a bot wall or a soft 404, so it must repeat on a second run.
export const DEFINITIVE_FAILURE_REASONS: readonly string[] = ['http_404', 'http_410', 'missing_local_file'];
export const CONFIRM_AFTER_FAILURES = 2;

/** A failure worth showing an admin: certain, or seen on two separate runs. */
export function isConfirmedLinkFailure(check: { check_status: string; failure_reason?: string | null; consecutive_failures?: number | null }): boolean {
  if (check.check_status !== 'failed') return false;
  if (check.failure_reason && DEFINITIVE_FAILURE_REASONS.includes(check.failure_reason)) return true;
  return (check.consecutive_failures ?? 0) >= CONFIRM_AFTER_FAILURES;
}

