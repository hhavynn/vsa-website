// "Continue working" for the admin home. Derived entirely from the persisted
// workflow state the Operations dashboard already loads (cycle/batch status,
// draft counts). There is no per-user tracking: any admin sees the same next
// actions, and they disappear when the work is done.
import { OPS_LINKS, OperationsSummary } from './adminOperations';
import { pluralize } from './operationalStatus';

export type ContinueDomain = 'ace' | 'houses' | 'cabinet' | 'interns';

export interface ContinueItem {
  id: string;
  domain: ContinueDomain;
  title: string;
  /** "5 Littles still need assignments" */
  detail: string;
  to: string;
  cta: string;
}

const READY_STATUSES = new Set(['published', 'archived']);

export function buildContinueItems(summary: OperationsSummary): ContinueItem[] {
  const items: ContinueItem[] = [];

  const { ace, houses, cabinet, interns } = summary;

  if (ace && ace.cycleStatus && !READY_STATUSES.has(ace.cycleStatus)) {
    if (ace.unassigned > 0) {
      items.push({ id: 'ace', domain: 'ace', title: 'ACE', detail: `${pluralize(ace.unassigned, 'Little')} still ${ace.unassigned === 1 ? 'needs an assignment' : 'need assignments'}`, to: `${OPS_LINKS.aceAssignments}&filter=unassigned`, cta: 'Continue' });
    } else if (ace.cycleStatus === 'draft') {
      items.push({ id: 'ace', domain: 'ace', title: 'ACE', detail: 'Every Little is assigned. Lock when you are ready.', to: OPS_LINKS.aceAssignments, cta: 'Review & lock' });
    } else if (ace.cycleStatus === 'locked') {
      items.push({ id: 'ace', domain: 'ace', title: 'ACE', detail: 'Locked. Check the preflight, then publish.', to: OPS_LINKS.aceAssignments, cta: 'Open preflight' });
    }
  }

  if (houses && houses.batchStatus && !READY_STATUSES.has(houses.batchStatus)) {
    if (houses.batchStatus === 'locked') {
      items.push({ id: 'houses', domain: 'houses', title: 'Houses', detail: 'Locked. Preview, then reveal.', to: OPS_LINKS.houses, cta: 'Preview reveal' });
    } else {
      items.push({
        id: 'houses',
        domain: 'houses',
        title: 'Houses',
        detail: houses.unresolved > 0 ? `Draft saved · ${pluralize(houses.unresolved, 'unresolved row')}` : 'Draft saved · every row is resolved',
        to: houses.unresolved > 0 ? `${OPS_LINKS.houses}?filter=needs_review` : OPS_LINKS.houses,
        cta: 'Continue',
      });
    }
  }

  const rollover = cabinet?.rollover;
  if (cabinet && rollover && rollover.status !== 'published') {
    items.push({
      id: 'cabinet',
      domain: 'cabinet',
      title: 'Cabinet',
      detail: `${rollover.yearLabel}: ${rollover.filled} / ${rollover.positions} positions filled`,
      to: OPS_LINKS.cabinetRollover,
      cta: 'Continue',
    });
  } else if (cabinet && cabinet.positions > 0 && cabinet.needReview > 0) {
    items.push({
      id: 'cabinet',
      domain: 'cabinet',
      title: 'Cabinet',
      detail: `${pluralize(cabinet.needReview, 'member')} not linked to a member record`,
      to: `${OPS_LINKS.cabinet}`,
      cta: 'Link members',
    });
  }

  if (interns && interns.cycleStatus && !READY_STATUSES.has(interns.cycleStatus)) {
    const unlinked = Math.max(0, interns.accepted - interns.linked);
    items.push({
      id: 'interns',
      domain: 'interns',
      title: 'Interns',
      detail: interns.cycleStatus === 'locked' ? 'Locked. Preview the cohort, then publish.' : unlinked > 0 ? `${pluralize(unlinked, 'intern')} not linked yet` : `${pluralize(interns.accepted, 'intern')} accepted · ready to lock`,
      to: unlinked > 0 && interns.cycleStatus !== 'locked' ? `${OPS_LINKS.interns}?filter=unlinked` : OPS_LINKS.interns,
      cta: 'Continue',
    });
  }

  return items;
}
