// One vocabulary for every yearly-operations workflow (ACE assignments, House
// batches, Cabinet rosters, Intern cohorts). Each domain keeps its own tables;
// this only unifies how a status is named and toned in the admin UI.

export type OperationalStatus = 'draft' | 'locked' | 'published' | 'archived';

export const OPERATIONAL_STATUS_LABEL: Record<OperationalStatus, string> = {
  draft: 'Draft',
  locked: 'Locked',
  published: 'Published',
  archived: 'Archived',
};

export const OPERATIONAL_STATUS_HINT: Record<OperationalStatus, string> = {
  draft: 'Private. Still being prepared.',
  locked: 'Private. Frozen for final review.',
  published: 'Live on the public site.',
  archived: 'Kept for the record.',
};

export function toOperationalStatus(value: string | null | undefined): OperationalStatus | null {
  return value === 'draft' || value === 'locked' || value === 'published' || value === 'archived' ? value : null;
}

export function operationalStatusLabel(value: string | null | undefined): string {
  const status = toOperationalStatus(value);
  return status ? OPERATIONAL_STATUS_LABEL[status] : 'Not started';
}

export type PreflightSeverity = 'ok' | 'warning' | 'blocker' | 'info';

export interface PreflightLine {
  id: string;
  severity: PreflightSeverity;
  message: string;
  /** Where an admin goes to fix it. Diagnostic only: following it repairs nothing. */
  to?: string;
}

/** Marker glyph used in text preflights; the same four everywhere. */
export const PREFLIGHT_MARKER: Record<PreflightSeverity, string> = {
  ok: '✓',
  warning: '⚠',
  blocker: '✕',
  info: '○',
};

export function pluralize(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "2026–27" from a start year. */
export function formatYearSpan(startYear: number): string {
  return `${startYear}–${String((startYear + 1) % 100).padStart(2, '0')}`;
}
