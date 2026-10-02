// Contextual shortcuts: after a common admin action, the logical next step —
// so a success message is never a dead end. Pure: pages pass what just
// happened and get a message plus actions to render (a link, or a page-local
// filter/preview the page wires up).
import { OPS_LINKS } from './adminOperations';
import { formatYearSpan, pluralize } from './operationalStatus';

export interface NextStepAction {
  label: string;
  /** Admin route to open. */
  to?: string;
  /** Quick-filter key on the current page. */
  filter?: string;
  /** Page-local action the page handles, e.g. open the public preview. */
  intent?: 'preview';
}

export interface NextStep {
  id: string;
  message: string;
  actions: NextStepAction[];
}

export type NextStepEvent =
  | { type: 'ace_imported'; count: number; issues: number }
  | { type: 'ace_all_linked' }
  | { type: 'ace_locked' }
  | { type: 'house_imported'; count: number; issues: number }
  | { type: 'house_locked' }
  | { type: 'cabinet_roster_complete' }
  | { type: 'cabinet_published' }
  | { type: 'intern_locked' }
  | { type: 'year_prepared'; yearStart: number };

export function nextStepFor(event: NextStepEvent): NextStep {
  switch (event.type) {
    case 'ace_imported':
      return {
        id: event.type,
        message: `${pluralize(event.count, 'Little')} imported`,
        actions:
          event.issues > 0
            ? [{ label: `Review ${pluralize(event.issues, 'Issue')}`, filter: 'needs_review' }]
            : [{ label: 'Open Assignment Preflight', filter: 'all' }],
      };
    case 'ace_all_linked':
      return { id: event.type, message: 'All current members linked', actions: [{ label: 'Open Assignment Preflight', to: OPS_LINKS.aceAssignments }] };
    case 'ace_locked':
      return { id: event.type, message: 'Assignments locked', actions: [{ label: 'Review Preflight', filter: 'all' }] };
    case 'house_imported':
      return {
        id: event.type,
        message: `${pluralize(event.count, 'row')} imported as a draft`,
        actions: event.issues > 0 ? [{ label: `Review ${pluralize(event.issues, 'Issue')}`, filter: 'needs_review' }] : [{ label: 'Open Preflight', filter: 'all' }],
      };
    case 'house_locked':
      return { id: event.type, message: 'Assignments locked', actions: [{ label: 'Preview Reveal', intent: 'preview' }] };
    case 'cabinet_roster_complete':
      return { id: event.type, message: 'Roster complete', actions: [{ label: 'Preview Cabinet', intent: 'preview' }] };
    case 'cabinet_published':
      return { id: event.type, message: 'Cabinet published', actions: [{ label: 'Open Operations Dashboard', to: '/admin' }] };
    case 'intern_locked':
      return { id: event.type, message: 'Cohort locked', actions: [{ label: 'Preview Cohort', intent: 'preview' }] };
    case 'year_prepared':
      return {
        id: event.type,
        message: `${formatYearSpan(event.yearStart)} prepared`,
        actions: [{ label: 'Open Operations Dashboard', to: '/admin' }],
      };
  }
}
