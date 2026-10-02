// Workflow progress for the yearly operations pages: what is done, what is
// partly done, and where work stopped, so an admin returning days later sees it
// at a glance. Derived only from state the pages already persist (draft rows,
// cycle status); nothing is tracked per user.

export type ProgressStatus = 'done' | 'partial' | 'warning' | 'todo';

export interface ProgressStep {
  key: string;
  label: string;
  status: ProgressStatus;
  /** "42 / 47" for counted steps. */
  value?: string;
}

/** The glyph a step shows when it has no count: ✓ done, ⚠ needs a look, — not started. */
export function stepMark(step: ProgressStep): string {
  if (step.value) return step.value;
  if (step.status === 'done') return '✓';
  if (step.status === 'warning') return '⚠';
  return '—';
}

export function countStep(key: string, label: string, done: number, total: number): ProgressStep {
  const complete = total > 0 && done >= total;
  return {
    key,
    label,
    status: complete ? 'done' : total > 0 ? 'partial' : 'todo',
    value: total > 0 ? `${done} / ${total}` : undefined,
  };
}

export function flagStep(key: string, label: string, done: boolean): ProgressStep {
  return { key, label, status: done ? 'done' : 'todo' };
}

/** ✓ with nothing outstanding, ⚠ when blockers or warnings remain, — before there is data. */
export function preflightStep(input: { hasData: boolean; blockers: number; warnings: number }): ProgressStep {
  if (!input.hasData) return { key: 'preflight', label: 'Preflight', status: 'todo' };
  return { key: 'preflight', label: 'Preflight', status: input.blockers + input.warnings > 0 ? 'warning' : 'done' };
}

const isLocked = (status: string | null | undefined) => status === 'locked' || status === 'published' || status === 'archived';
const isPublished = (status: string | null | undefined) => status === 'published' || status === 'archived';

export function aceProgress(input: {
  status: string | null;
  littles: number;
  assigned: number;
  linked: number;
  blockers: number;
  warnings: number;
}): ProgressStep[] {
  return [
    flagStep('import', 'Import', input.littles > 0),
    countStep('linking', 'Linking', input.linked, input.littles),
    countStep('assignments', 'Assignments', input.assigned, input.littles),
    preflightStep({ hasData: input.littles > 0, blockers: input.blockers, warnings: input.warnings }),
    flagStep('locked', 'Locked', isLocked(input.status)),
    flagStep('published', 'Published', isPublished(input.status)),
  ];
}

export function houseProgress(input: {
  status: string | null;
  rows: number;
  matched: number;
  assigned: number;
}): ProgressStep[] {
  return [
    flagStep('import', 'Import', input.rows > 0),
    countStep('matching', 'Matching', input.matched, input.rows),
    countStep('assignments', 'Assignments', input.assigned, input.rows),
    flagStep('locked', 'Locked', isLocked(input.status)),
    flagStep('revealed', 'Revealed', isPublished(input.status)),
  ];
}

export function cabinetProgress(input: {
  status: string | null;
  positions: number;
  filled: number;
  linked: number;
}): ProgressStep[] {
  return [
    flagStep('positions', 'Positions', input.positions > 0),
    countStep('people', 'People', input.filled, input.positions),
    countStep('links', 'Member Links', input.linked, input.filled),
    flagStep('locked', 'Locked', isLocked(input.status)),
    flagStep('published', 'Published', isPublished(input.status)),
  ];
}

export function internProgress(input: {
  status: string | null;
  accepted: number;
  linked: number;
  mentored: number;
}): ProgressStep[] {
  return [
    flagStep('added', 'Added', input.accepted > 0),
    countStep('links', 'Member Links', input.linked, input.accepted),
    countStep('mentors', 'Mentors', input.mentored, input.accepted),
    flagStep('locked', 'Locked', isLocked(input.status)),
    flagStep('published', 'Published', isPublished(input.status)),
  ];
}

/**
 * The first step that is not finished: "where work stopped". A warning counts
 * as finished work with something to look at, so it never hides a later todo.
 */
export function firstUnfinishedStep(steps: readonly ProgressStep[]): ProgressStep | null {
  return steps.find((step) => step.status === 'todo' || step.status === 'partial') ?? null;
}
