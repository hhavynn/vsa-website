// "What needs me?" for the Admin Overview. Pure: takes the counts and the few
// date-bearing rows the Overview already read, returns count-only items that each
// deep-link to the page and filter that resolves them.
//
// Privacy: the dashboard shows counts and generic labels only. Nothing here ever
// receives a member name, email, application submission, or request detail, so
// nothing of that kind can be rendered.
//
// Deliberately NOT included (not safely or cheaply available to an admin-readable
// count): unreviewed merge suggestions, which the Merge Review page derives by
// matching the whole members table in the browser, and failing launch-checklist
// items, which that page derives from ~12 separate queries. Counting either here
// would reintroduce the fan-out #503/#505 removed, for a cosmetic number.
import { isSummerBreak } from '../utils/seasonalState';
import {
  CLOSING_SOON_DAYS,
  OPENING_SOON_DAYS,
  WindowTiming,
  getClosingSoon,
  getOpeningSoon,
} from './applicationWindows';
import { pluralize } from './operationalStatus';

/** How far ahead an unpublished draft event is worth a nudge. */
export const DRAFT_EVENT_HORIZON_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export const ATTENTION_LINKS = {
  applicationsClosing: '/admin/applications?filter=open',
  applicationsOpening: '/admin/applications?filter=scheduled',
  photoRequests: '/admin/photo-requests?filter=pending',
  dataRights: '/admin/data-rights?filter=open',
  aiFeedback: '/admin/ai-feedback?filter=unresolved',
  feedback: '/admin/feedback?filter=pending',
  draftEvents: '/admin/events?filter=draft',
} as const;

/** The signals the Overview read. A `null` means that source could not be read (never "zero"). */
export interface AttentionSignals {
  applications: WindowTiming[] | null;
  /** Event dates (ISO) for events that are not published. */
  draftEventDates: string[] | null;
  photoRequestsPending: number | null;
  dataRightsOpen: number | null;
  aiFeedbackUnresolved: number | null;
  feedbackPending: number | null;
}

export const EMPTY_ATTENTION_SIGNALS: AttentionSignals = {
  applications: null,
  draftEventDates: null,
  photoRequestsPending: null,
  dataRightsOpen: null,
  aiFeedbackUnresolved: null,
  feedbackPending: null,
};

export type AttentionTone = 'urgent' | 'attention';

export interface AttentionItem {
  id: string;
  count: number;
  /** Count-free label, e.g. "photo requests waiting for review". */
  label: string;
  /** Optional second line; for application windows the shared "closes tomorrow" headline. */
  detail?: string;
  /** The admin page and filter that resolves it. */
  to: string;
  tone: AttentionTone;
}

export interface AttentionQueue {
  items: AttentionItem[];
  /** Sources that could not be read, so "all caught up" is never claimed over a failed check. */
  unchecked: string[];
}

function countItem(
  id: string,
  count: number | null,
  noun: string,
  nounPlural: string,
  rest: string,
  to: string,
  tone: AttentionTone = 'attention',
): AttentionItem | null {
  if (count === null || count <= 0) return null;
  return { id, count, label: `${count === 1 ? noun : nounPlural} ${rest}`, to, tone };
}

export function buildAttentionQueue(signals: AttentionSignals, now: Date = new Date()): AttentionQueue {
  const items: AttentionItem[] = [];
  const unchecked: string[] = [];

  if (signals.applications === null) unchecked.push('application windows');
  else {
    const closing = getClosingSoon(signals.applications, now, CLOSING_SOON_DAYS, { dedupeByName: false });
    if (closing.length > 0) {
      items.push({
        id: 'applications-closing',
        count: closing.length,
        label: `application ${closing.length === 1 ? 'window closes' : 'windows close'} within ${CLOSING_SOON_DAYS} days`,
        detail: closing[0].headline,
        to: ATTENTION_LINKS.applicationsClosing,
        tone: closing[0].daysUntilClose <= 1 ? 'urgent' : 'attention',
      });
    }
    const opening = getOpeningSoon(signals.applications, now, OPENING_SOON_DAYS);
    if (opening.length > 0) {
      items.push({
        id: 'applications-opening',
        count: opening.length,
        label: `application ${opening.length === 1 ? 'window opens' : 'windows open'} within ${OPENING_SOON_DAYS} days`,
        detail: opening[0].headline,
        to: ATTENTION_LINKS.applicationsOpening,
        tone: 'attention',
      });
    }
  }

  if (signals.photoRequestsPending === null) unchecked.push('photo requests');
  else {
    const item = countItem('photo-requests', signals.photoRequestsPending, 'photo request', 'photo requests', 'waiting for review', ATTENTION_LINKS.photoRequests);
    if (item) items.push(item);
  }

  if (signals.dataRightsOpen === null) unchecked.push('data-rights requests');
  else {
    const item = countItem('data-rights', signals.dataRightsOpen, 'open data-rights request', 'open data-rights requests', 'to work through', ATTENTION_LINKS.dataRights, 'urgent');
    if (item) items.push(item);
  }

  if (signals.aiFeedbackUnresolved === null) unchecked.push('Ask VSA feedback');
  else {
    const count = signals.aiFeedbackUnresolved;
    if (count > 0) {
      items.push({
        id: 'ai-feedback',
        count,
        label: `Ask VSA ${count === 1 ? 'response needs' : 'responses need'} review`,
        to: ATTENTION_LINKS.aiFeedback,
        tone: 'attention',
      });
    }
  }

  if (signals.feedbackPending === null) unchecked.push('feedback');
  else {
    const item = countItem('feedback', signals.feedbackPending, 'feedback item', 'feedback items', 'to triage', ATTENTION_LINKS.feedback);
    if (item) items.push(item);
  }

  if (signals.draftEventDates === null) unchecked.push('events');
  else {
    const horizon = now.getTime() + DRAFT_EVENT_HORIZON_DAYS * DAY_MS;
    const approaching = signals.draftEventDates.filter((date) => {
      const at = Date.parse(date);
      return !Number.isNaN(at) && at >= now.getTime() && at <= horizon;
    }).length;
    const item = countItem(
      'draft-events',
      approaching,
      'unpublished event',
      'unpublished events',
      `in the next ${DRAFT_EVENT_HORIZON_DAYS} days`,
      ATTENTION_LINKS.draftEvents,
    );
    if (item) items.push(item);
  }

  // Urgent first; otherwise keep the order above (applications, then queues, then events).
  items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'urgent' ? -1 : 1));
  return { items, unchecked };
}

export function attentionTotal(queue: AttentionQueue): number {
  return queue.items.reduce((sum, item) => sum + item.count, 0);
}

/** One-line summary for the queue header ("3 things need attention"). */
export function attentionSummary(queue: AttentionQueue): string {
  return queue.items.length === 0 ? 'Nothing needs attention' : `${pluralize(queue.items.length, 'thing')} need${queue.items.length === 1 ? 's' : ''} attention`;
}

/**
 * "No upcoming events" is a problem during the school year and normal over
 * summer break, so the content-health warning for it is suppressed then rather
 * than nagging for three months.
 */
export function warnsWhenNoUpcomingEvents(now: Date = new Date()): boolean {
  return !isSummerBreak(now);
}
