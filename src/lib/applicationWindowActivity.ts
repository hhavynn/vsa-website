// Builds the Recent Changes entry for an application-window mutation. Reuses the
// existing admin activity log (lib/adminActivity.ts) rather than adding a second
// audit trail. Pure; the page hands the result to logAdminActivity().
//
// Privacy: the form URL is never stored. A window's URL is not public until the
// window opens, and the log is readable by every admin, so only `urlChanged` is
// recorded. Dates are stored as ISO instants and summarised in Pacific Time.
import { ApplicationKey } from '../types';
import { ACTIVITY_ACTIONS, ActivityDraft, activitySummary } from './adminActivity';
import { WINDOW_STATE_LABELS, WindowFacts, WindowState, formatPacificDateTime, getAdminWindowState } from './applicationWindows';

export interface WindowSnapshot extends WindowFacts {
  application_key: ApplicationKey;
  title: string;
  open_at: string;
  due_at: string;
}

type Kind = 'created' | 'updated' | 'toggled' | 'deleted';

function describe(window: WindowSnapshot, now: Date) {
  const { state } = getAdminWindowState(window, now);
  return { state, enabled: window.is_enabled, open_at: window.open_at, due_at: window.due_at };
}

function scheduleText(window: WindowSnapshot): string {
  return `${formatPacificDateTime(window.open_at, { withYear: false })} to ${formatPacificDateTime(window.due_at, { withYear: false })}`;
}

export function applicationWindowActivity(
  kind: Kind,
  before: WindowSnapshot | null,
  after: WindowSnapshot | null,
  now: Date = new Date(),
): ActivityDraft {
  const subject = (after ?? before)!;
  const previous = before ? describe(before, now) : null;
  const next = after ? describe(after, now) : null;
  const urlChanged = !!before && !!after && (before.target_url ?? '').trim() !== (after.target_url ?? '').trim();

  const parts: string[] = [];
  if (kind === 'created' && next) {
    parts.push(`${WINDOW_STATE_LABELS[next.state]}, ${scheduleText(after!)}`);
  } else if (kind === 'deleted' && previous) {
    parts.push(`was ${WINDOW_STATE_LABELS[previous.state]}`);
  } else if (previous && next) {
    if (previous.state !== next.state) parts.push(`${WINDOW_STATE_LABELS[previous.state]} → ${WINDOW_STATE_LABELS[next.state]}`);
    if (Date.parse(previous.open_at) !== Date.parse(next.open_at) || Date.parse(previous.due_at) !== Date.parse(next.due_at)) parts.push(`schedule ${scheduleText(after!)}`);
    if (urlChanged) parts.push('form link changed');
    if (parts.length === 0) parts.push('copy edited');
  }

  const action =
    kind === 'created'
      ? ACTIVITY_ACTIONS.applicationWindowCreated
      : kind === 'deleted'
        ? ACTIVITY_ACTIONS.applicationWindowDeleted
        : kind === 'toggled'
          ? ACTIVITY_ACTIONS.applicationWindowToggled
          : ACTIVITY_ACTIONS.applicationWindowUpdated;
  const verb = kind === 'created' ? 'Created' : kind === 'deleted' ? 'Deleted' : 'Updated';

  return {
    action,
    entityType: 'application_window',
    summary: activitySummary.applicationWindow(verb, subject.title, parts.join('; ')),
    metadata: {
      application_key: subject.application_key,
      previous: previous as { state: WindowState; enabled: boolean; open_at: string; due_at: string } | null,
      next,
      urlChanged,
    },
  };
}
