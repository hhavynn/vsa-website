// Pure derivation for the Admin Operations dashboard and the cross-program
// preflight. Takes plain rows already read by data/repos/adminOperations.ts and
// returns counts, statuses, and diagnostic preflight lines. It is diagnostic
// only: nothing here (or any link it produces) repairs data.
import { RosterPreflight } from './cabinetRoster';
import { PreflightLine, formatYearSpan, pluralize } from './operationalStatus';

/** Where each operations card and preflight line sends an admin. */
export const OPS_LINKS = {
  members: '/admin/members',
  aceAssignments: '/admin/ace?view=assignments',
  aceFamilies: '/admin/ace',
  houses: '/admin/houses',
  cabinet: '/admin/cabinet',
  cabinetRollover: '/admin/cabinet/rollover',
  interns: '/admin/interns',
  events: '/admin/events',
  yearSetup: '/admin/year-setup',
  launchChecklist: '/admin/launch-checklist',
} as const;

// ─── Inputs ──────────────────────────────────────────────────────────────────

export interface AceOperationsInput {
  cycleStatus: string | null;
  /** Littles in the cycle's drafts. */
  littles: number;
  assigned: number;
  /** Live ACE tree nodes for the operating year. */
  nodesTotal: number;
  nodesLinked: number;
}

export interface HouseOperationsInput {
  batchStatus: string | null;
  /** Rows with a confirmed member and House. */
  assigned: number;
  /** Rows without a House, or with a House but no confirmed member. */
  unresolved: number;
  /** Assigned count per active House, in display order. */
  balance: number[];
}

export interface CabinetOperationsInput {
  yearLabel: string | null;
  /** Positions on the active Cabinet year (public rows, no Interns). */
  positions: number;
  filled: number;
  linked: number;
  /** A rollover roster in progress for another year, if any. */
  rollover: { yearLabel: string; status: string; positions: number; filled: number } | null;
}

export interface InternOperationsInput {
  cycleStatus: string | null;
  accepted: number;
  linked: number;
}

export interface EventsOperationsInput {
  next: { title: string; date: string } | null;
  upcoming: number;
  upcomingMissingLocation: number;
  /** Upcoming events missing a location, check-in form, or image. */
  upcomingMissingInfo: number;
}

export interface UpcomingEventRow {
  name: string;
  date: string;
  location: string | null;
  check_in_form_url: string | null;
  image_url: string | null;
}

const isBlank = (value: string | null | undefined) => value === null || value === undefined || value === '';

/**
 * Events health from the upcoming PUBLISHED events, ordered soonest first.
 * A NULL or empty location / check-in form URL, or a missing image, all count as
 * missing info (a NULL check-in URL once slipped through and the preflight said
 * all was well).
 */
export function summarizeUpcomingEvents(rows: UpcomingEventRow[]): EventsOperationsInput {
  const first = rows[0];
  return {
    next: first ? { title: first.name, date: first.date } : null,
    upcoming: rows.length,
    upcomingMissingLocation: rows.filter((row) => isBlank(row.location)).length,
    upcomingMissingInfo: rows.filter((row) => isBlank(row.location) || isBlank(row.check_in_form_url) || isBlank(row.image_url)).length,
  };
}

/** A null domain means it could not be loaded; the card says so instead of showing zeros. */
export interface OperationsInputs {
  yearStart: number;
  members: number | null;
  ace: AceOperationsInput | null;
  houses: HouseOperationsInput | null;
  cabinet: CabinetOperationsInput | null;
  interns: InternOperationsInput | null;
  events: EventsOperationsInput | null;
}

// ─── Summary ─────────────────────────────────────────────────────────────────

export interface OperationsSummary {
  yearStart: number;
  yearLabel: string;
  members: { total: number } | null;
  ace: (AceOperationsInput & { unassigned: number; nodesUnlinked: number; needAttention: number; to: string }) | null;
  houses: (HouseOperationsInput & { to: string }) | null;
  cabinet: (CabinetOperationsInput & { needReview: number; to: string }) | null;
  interns: (InternOperationsInput & { needReview: number; to: string }) | null;
  events: (EventsOperationsInput & { to: string }) | null;
}

export function buildOperationsSummary(inputs: OperationsInputs): OperationsSummary {
  const ace = inputs.ace
    ? (() => {
        const unassigned = Math.max(0, inputs.ace.littles - inputs.ace.assigned);
        const nodesUnlinked = Math.max(0, inputs.ace.nodesTotal - inputs.ace.nodesLinked);
        return {
          ...inputs.ace,
          unassigned,
          nodesUnlinked,
          needAttention: unassigned + nodesUnlinked,
          to: OPS_LINKS.aceAssignments,
        };
      })()
    : null;

  return {
    yearStart: inputs.yearStart,
    yearLabel: formatYearSpan(inputs.yearStart),
    members: inputs.members === null ? null : { total: inputs.members },
    ace,
    houses: inputs.houses ? { ...inputs.houses, to: OPS_LINKS.houses } : null,
    cabinet: inputs.cabinet
      ? {
          ...inputs.cabinet,
          needReview: Math.max(0, inputs.cabinet.filled - inputs.cabinet.linked),
          to: inputs.cabinet.rollover && inputs.cabinet.rollover.status !== 'published' ? OPS_LINKS.cabinetRollover : OPS_LINKS.cabinet,
        }
      : null,
    interns: inputs.interns
      ? { ...inputs.interns, needReview: Math.max(0, inputs.interns.accepted - inputs.interns.linked), to: OPS_LINKS.interns }
      : null,
    events: inputs.events ? { ...inputs.events, to: OPS_LINKS.events } : null,
  };
}

/** "31 / 32 / 32 / 31" */
export function formatHouseBalance(balance: readonly number[]): string {
  return balance.join(' / ');
}

// ─── Cross-program preflight ─────────────────────────────────────────────────

export type PreflightGroupKey = 'ace' | 'houses' | 'cabinet' | 'interns' | 'events';

export interface PreflightGroup {
  key: PreflightGroupKey;
  label: string;
  lines: PreflightLine[];
}

const READY_STATUSES = new Set(['locked', 'published']);

function unavailable(key: PreflightGroupKey, label: string): PreflightGroup {
  return { key, label, lines: [{ id: `${key}-unavailable`, severity: 'warning', message: `${label} status could not be loaded` }] };
}

export function buildOperationsPreflight(summary: OperationsSummary): PreflightGroup[] {
  const groups: PreflightGroup[] = [];

  // ACE
  if (!summary.ace) {
    groups.push(unavailable('ace', 'ACE'));
  } else {
    const { ace } = summary;
    const lines: PreflightLine[] = [];
    if (ace.cycleStatus === null && ace.nodesTotal === 0) {
      lines.push({ id: 'ace-none', severity: 'info', message: `No ACE assignment cycle for ${summary.yearLabel}`, to: OPS_LINKS.aceAssignments });
    }
    if (ace.cycleStatus !== null) {
      if (ace.unassigned > 0) {
        lines.push({ id: 'ace-unassigned', severity: 'warning', message: `${ace.unassigned} unassigned`, to: OPS_LINKS.aceAssignments });
      } else if (ace.littles > 0) {
        lines.push({ id: 'ace-assigned', severity: 'ok', message: 'Every Little is assigned', to: OPS_LINKS.aceAssignments });
      }
    }
    if (ace.nodesUnlinked > 0) {
      lines.push({ id: 'ace-unlinked', severity: 'warning', message: `${pluralize(ace.nodesUnlinked, 'ACE person', 'ACE people')} not linked to a member`, to: OPS_LINKS.aceFamilies });
    }
    groups.push({ key: 'ace', label: 'ACE', lines });
  }

  // Houses
  if (!summary.houses) {
    groups.push(unavailable('houses', 'Houses'));
  } else {
    const { houses } = summary;
    const lines: PreflightLine[] = [];
    if (houses.batchStatus === null) {
      lines.push({ id: 'houses-none', severity: 'info', message: 'No House assignment batch (intentional until the reveal)', to: OPS_LINKS.houses });
    } else if (READY_STATUSES.has(houses.batchStatus)) {
      lines.push({ id: 'houses-ready', severity: 'ok', message: `Assignment batch ${houses.batchStatus}`, to: OPS_LINKS.houses });
    } else {
      lines.push({ id: 'houses-draft', severity: 'info', message: 'Assignment batch is still a draft', to: OPS_LINKS.houses });
    }
    if (houses.unresolved > 0) {
      lines.push({ id: 'houses-unresolved', severity: 'warning', message: `${houses.unresolved} unresolved`, to: OPS_LINKS.houses });
    }
    groups.push({ key: 'houses', label: 'Houses', lines });
  }

  // Cabinet
  if (!summary.cabinet) {
    groups.push(unavailable('cabinet', 'Cabinet'));
  } else {
    const { cabinet } = summary;
    const lines: PreflightLine[] = [];
    if (cabinet.positions === 0) {
      lines.push({ id: 'cabinet-empty', severity: 'warning', message: 'No Cabinet roster on the active year', to: OPS_LINKS.cabinetRollover });
    } else if (cabinet.needReview > 0) {
      lines.push({ id: 'cabinet-unlinked', severity: 'warning', message: `${cabinet.needReview} unlinked ${cabinet.needReview === 1 ? 'member' : 'members'}`, to: OPS_LINKS.cabinet });
    } else {
      lines.push({ id: 'cabinet-linked', severity: 'ok', message: 'Every Cabinet member is linked', to: OPS_LINKS.cabinet });
    }
    if (cabinet.rollover && cabinet.rollover.status !== 'published') {
      lines.push({
        id: 'cabinet-rollover',
        severity: 'info',
        message: `${cabinet.rollover.yearLabel} roster is a ${cabinet.rollover.status} (${cabinet.rollover.filled} / ${cabinet.rollover.positions} filled)`,
        to: OPS_LINKS.cabinetRollover,
      });
    }
    groups.push({ key: 'cabinet', label: 'Cabinet', lines });
  }

  // Interns
  if (!summary.interns) {
    groups.push(unavailable('interns', 'Interns'));
  } else {
    const { interns } = summary;
    const lines: PreflightLine[] = [];
    if (interns.accepted === 0) {
      lines.push({ id: 'interns-none', severity: 'info', message: 'No interns accepted yet', to: OPS_LINKS.interns });
    } else if (interns.needReview > 0) {
      lines.push({ id: 'interns-unlinked', severity: 'warning', message: `${interns.needReview} unlinked ${interns.needReview === 1 ? 'intern' : 'interns'}`, to: OPS_LINKS.interns });
    } else {
      lines.push({ id: 'interns-ready', severity: 'ok', message: 'Ready', to: OPS_LINKS.interns });
    }
    groups.push({ key: 'interns', label: 'Interns', lines });
  }

  // Events
  if (!summary.events) {
    groups.push(unavailable('events', 'Events'));
  } else {
    const { events } = summary;
    const lines: PreflightLine[] = [];
    if (events.upcomingMissingLocation > 0) {
      lines.push({
        id: 'events-location',
        severity: 'warning',
        message: `${pluralize(events.upcomingMissingLocation, 'upcoming event')} missing location`,
        to: OPS_LINKS.events,
      });
    }
    const otherMissing = Math.max(0, events.upcomingMissingInfo - events.upcomingMissingLocation);
    if (otherMissing > 0) {
      lines.push({ id: 'events-info', severity: 'warning', message: `${pluralize(otherMissing, 'upcoming event')} missing a form or image`, to: OPS_LINKS.events });
    }
    if (lines.length === 0) {
      lines.push({ id: 'events-ok', severity: 'ok', message: events.upcoming > 0 ? 'Upcoming events have their info' : 'No upcoming events', to: OPS_LINKS.events });
    }
    groups.push({ key: 'events', label: 'Events', lines });
  }

  return groups;
}

/** Number of warning/blocker lines across every group. */
export function countPreflightIssues(groups: readonly PreflightGroup[]): number {
  return groups.reduce((total, group) => total + group.lines.filter((line) => line.severity === 'warning' || line.severity === 'blocker').length, 0);
}

/** A Cabinet rollover roster summarized for the dashboard card. */
export function rolloverSummary(
  yearLabel: string,
  status: string,
  preflight: Pick<RosterPreflight, 'positions' | 'filled'>,
): NonNullable<CabinetOperationsInput['rollover']> {
  return { yearLabel, status, positions: preflight.positions, filled: preflight.filled };
}
