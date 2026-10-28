// Protected domain — House membership. Pure logic for House payment
// eligibility (#656), the payment checklist import (#658), the post-payment
// rerun (#657) and the Draft A → Draft B comparison (#659). Nothing here reads
// or writes the database; the server enforces the same rules again
// (20261028050216_house_payment_eligibility.sql). Payment status is placement
// eligibility only: it never touches members, attendance, points or a published
// House.
import { csvCell } from './adminImportReview';
import { parseCsvTable } from './csvParse';
import type { HouseAssignmentDraft, HouseAssignmentDraftInsert } from './houseAssignmentDraft';
import { readPreferences } from './houseAssignmentDraft';
import {
  Capacities,
  Placement,
  PlacementApplicant,
  PlacementHouse,
  comparePriority,
  ordinal,
} from './housePlacement';
import { FORM_TIME_ZONE, formatFormTime, parseFormTimestamp } from './housePlacementImport';
import { normalizeMemberName } from './memberLinkMatching';
import { normalizeEmail } from './memberMatching';
import type { Database, Json } from '../types/database';

export type HousePaymentCycle = Database['public']['Tables']['house_payment_cycles']['Row'];
export type HouseApplicant = Database['public']['Tables']['house_applicants']['Row'];
export type HousePaymentAuditRow = Database['public']['Tables']['house_payment_audit']['Row'];

export type PaymentStatus = 'unverified' | 'pending' | 'paid' | 'unpaid' | 'waived';
export type PaymentEvidence = 'payment_checklist' | 'crc_confirmation' | 'waiver_approval' | 'other';
export type EligibilityMode = 'provisional' | 'final';
export type HouseApplicationKey = 'house_fall' | 'house_winter' | 'house_spring';

export const PAYMENT_STATUSES: readonly PaymentStatus[] = ['unverified', 'pending', 'paid', 'unpaid', 'waived'];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unverified: 'Unverified',
  pending: 'Pending',
  paid: 'Paid (verified)',
  unpaid: 'Unpaid (confirmed)',
  waived: 'Waived / comped',
};

export const PAYMENT_EVIDENCE_LABEL: Record<PaymentEvidence, string> = {
  payment_checklist: 'Payment checklist',
  crc_confirmation: 'CRC confirmation',
  waiver_approval: 'Waiver approval',
  other: 'Other',
};

export const APPLICATION_KEY_LABEL: Record<HouseApplicationKey, string> = {
  house_fall: 'Fall House applications',
  house_winter: 'Winter House applications',
  house_spring: 'Spring House applications',
};

export function isPaymentStatus(value: string | null | undefined): value is PaymentStatus {
  return PAYMENT_STATUSES.includes(value as PaymentStatus);
}

export function readPaymentStatus(applicant: Pick<HouseApplicant, 'payment_status'>): PaymentStatus {
  return isPaymentStatus(applicant.payment_status) ? applicant.payment_status : 'unverified';
}

/** "<submission instant ISO>#<sheet row>": the applicant's identity within one responses sheet. */
export function applicantKey(submittedAtIso: string, sourceRow: number) {
  return `${new Date(submittedAtIso).toISOString()}#${sourceRow}`;
}

// ─── Deadline and cutoff (America/Los_Angeles) ──────────────────────────────

/** `<input type="datetime-local">` value in Pacific time → UTC ISO, or an error. */
export function pacificInputToIso(value: string): { ok: true; iso: string; ambiguous: boolean } | { ok: false; error: string } {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return { ok: false, error: 'Enter a date and time.' };
  const parsed = parseFormTimestamp(`${match[1]} ${match[2]}:${match[3] ?? '00'}`);
  if (parsed.kind !== 'ok') {
    return { ok: false, error: parsed.kind === 'invalid' ? 'That time does not exist in Pacific time (clocks sprang forward). Choose another.' : 'Enter a date and time.' };
  }
  // The repeated fall-back hour: the later (PST) instant gives applicants the full hour.
  const ms = parsed.ambiguous && parsed.laterMs !== null ? parsed.laterMs : parsed.ms;
  return { ok: true, iso: new Date(ms).toISOString(), ambiguous: parsed.ambiguous };
}

let pacificInputFormatter: Intl.DateTimeFormat | null = null;
/** UTC ISO → `datetime-local` value in Pacific time. */
export function isoToPacificInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  pacificInputFormatter ??= new Intl.DateTimeFormat('en-CA', {
    timeZone: FORM_TIME_ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const parts = pacificInputFormatter.formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export function formatPacific(iso: string | null | undefined): string {
  return iso && Number.isFinite(Date.parse(iso)) ? formatFormTime(iso) : '—';
}

export type CutoffState =
  | { kind: 'no_deadline' }
  | { kind: 'open'; cutoffIso: string }
  | { kind: 'grace'; cutoffIso: string }
  | { kind: 'passed'; cutoffIso: string }
  | { kind: 'authorized'; atIso: string; reason: string };

export function cutoffState(
  cycle: Pick<HousePaymentCycle, 'payment_deadline' | 'grace_until' | 'cutoff_authorized_at' | 'cutoff_authorized_reason'>,
  nowMs: number,
): CutoffState {
  if (cycle.cutoff_authorized_at) {
    return { kind: 'authorized', atIso: cycle.cutoff_authorized_at, reason: cycle.cutoff_authorized_reason ?? '' };
  }
  if (!cycle.payment_deadline) return { kind: 'no_deadline' };
  const cutoffIso = cycle.grace_until ?? cycle.payment_deadline;
  if (nowMs >= Date.parse(cutoffIso)) return { kind: 'passed', cutoffIso };
  if (cycle.grace_until && nowMs >= Date.parse(cycle.payment_deadline)) return { kind: 'grace', cutoffIso };
  return { kind: 'open', cutoffIso };
}

export function cutoffReached(state: CutoffState) {
  return state.kind === 'passed' || state.kind === 'authorized';
}

// ─── Eligibility ────────────────────────────────────────────────────────────

/**
 * Final: only Paid or authorized Waived. Provisional (before the cutoff):
 * everyone not confirmed Unpaid. Withdrawn applicants are never eligible.
 */
export function isEligible(applicant: Pick<HouseApplicant, 'payment_status' | 'withdrawn_reason'>, mode: EligibilityMode) {
  if (applicant.withdrawn_reason) return false;
  const status = readPaymentStatus(applicant);
  return mode === 'final' ? status === 'paid' || status === 'waived' : status !== 'unpaid';
}

export function exclusionReason(applicant: Pick<HouseApplicant, 'payment_status' | 'withdrawn_reason'>, mode: EligibilityMode): string | null {
  if (applicant.withdrawn_reason) return `Withdrawn: ${applicant.withdrawn_reason}`;
  if (isEligible(applicant, mode)) return null;
  const status = readPaymentStatus(applicant);
  if (status === 'unpaid') return 'Payment: unpaid (confirmed)';
  return `Payment: ${PAYMENT_STATUS_LABEL[status].toLowerCase()} at the cutoff`;
}

export interface PaymentCounts {
  total: number;
  unverified: number;
  pending: number;
  paid: number;
  unpaid: number;
  waived: number;
  withdrawn: number;
  provisionalEligible: number;
  finalEligible: number;
  /** Not withdrawn and still Unverified or Pending. */
  unresolved: number;
}

export function paymentCounts(applicants: ReadonlyArray<Pick<HouseApplicant, 'payment_status' | 'withdrawn_reason'>>): PaymentCounts {
  const counts: PaymentCounts = {
    total: applicants.length, unverified: 0, pending: 0, paid: 0, unpaid: 0, waived: 0, withdrawn: 0,
    provisionalEligible: 0, finalEligible: 0, unresolved: 0,
  };
  applicants.forEach((applicant) => {
    if (applicant.withdrawn_reason) {
      counts.withdrawn += 1;
      return;
    }
    const status = readPaymentStatus(applicant);
    counts[status] += 1;
    if (status === 'unverified' || status === 'pending') counts.unresolved += 1;
    if (isEligible(applicant, 'provisional')) counts.provisionalEligible += 1;
    if (isEligible(applicant, 'final')) counts.finalEligible += 1;
  });
  return counts;
}

/** Why a final (lockable) sort cannot be generated yet; empty when it can. */
export function finalSortBlockers(state: CutoffState, counts: PaymentCounts): string[] {
  const blockers: string[] = [];
  if (!cutoffReached(state)) {
    blockers.push(state.kind === 'no_deadline'
      ? 'Set the payment deadline first (or record an authorized early cutoff).'
      : 'The payment cutoff has not passed yet. Sort provisionally, or record an authorized early cutoff.');
  }
  if (counts.unresolved > 0) {
    blockers.push(`${counts.unresolved} applicant${counts.unresolved === 1 ? ' is' : 's are'} still Unverified or Pending. Mark each Paid, Unpaid or Waived; unknown is never treated as paid or unpaid.`);
  }
  if (counts.finalEligible === 0) blockers.push('Nobody is Paid or Waived yet.');
  return blockers;
}

// ─── Status changes ─────────────────────────────────────────────────────────

export interface PaymentChange {
  applicant_id: string;
  payment_status?: PaymentStatus;
  payment_evidence?: PaymentEvidence | null;
  payment_reference?: string | null;
  payment_note?: string | null;
  withdrawn_reason?: string | null;
}

/** One change per selected applicant whose status would actually change. */
export function bulkStatusChanges(
  applicants: ReadonlyArray<Pick<HouseApplicant, 'id' | 'payment_status'>>,
  selectedIds: ReadonlySet<string>,
  status: PaymentStatus,
  evidence: PaymentEvidence | null,
): { changes: PaymentChange[]; unchanged: number } {
  const changes: PaymentChange[] = [];
  let unchanged = 0;
  applicants.forEach((applicant) => {
    if (!selectedIds.has(applicant.id)) return;
    if (readPaymentStatus(applicant) === status) {
      unchanged += 1;
      return;
    }
    changes.push({ applicant_id: applicant.id, payment_status: status, ...(evidence ? { payment_evidence: evidence } : {}) });
  });
  return { changes, unchanged };
}

// ─── Payment checklist import (#658) ────────────────────────────────────────

export type ChecklistMode = 'paid_roster' | 'unpaid_list';
export type AbsentPolicy = 'unknown' | 'unpaid';

export interface ChecklistColumns {
  name: string | null;
  email: string | null;
  sheetRow: string | null;
  status: string | null;
  note: string | null;
}

export interface ChecklistRow {
  /** 1-based row in the uploaded checklist. */
  row: number;
  name: string;
  email: string;
  sheetRow: number | null;
  rawStatus: string;
  note: string;
}

export type ChecklistParse =
  | { ok: true; headers: string[]; columns: ChecklistColumns; rows: ChecklistRow[] }
  | { ok: false; error: string };

const HEADER_PATTERNS: Array<[keyof ChecklistColumns, RegExp]> = [
  // Only an explicit application/sheet row: a checklist's own "Row" or "#" numbering must not match applicants.
  ['sheetRow', /^(application|sheet|response|form)\s*(row|id|#|number)|^app(lication)?\s*id$/],
  ['email', /e-?mail/],
  ['status', /status|paid|payment/],
  ['note', /note|comment|memo/],
  ['name', /name/],
];

export function detectChecklistColumns(headers: readonly string[]): ChecklistColumns {
  const columns: ChecklistColumns = { name: null, email: null, sheetRow: null, status: null, note: null };
  headers.forEach((header) => {
    const text = header.trim().toLowerCase();
    const role = HEADER_PATTERNS.find(([key, pattern]) => columns[key] === null && pattern.test(text));
    if (role) columns[role[0]] = header;
  });
  return columns;
}

export function parseChecklistCsv(raw: string): ChecklistParse {
  if (!raw.trim()) return { ok: false, error: 'The checklist file is empty.' };
  const table = parseCsvTable(raw);
  if (table.unterminatedQuote) {
    return { ok: false, error: `The CSV is malformed: a quoted cell opened on line ${table.unterminatedQuoteLine} never closes.` };
  }
  const columns = detectChecklistColumns(table.headers);
  if (!columns.name && !columns.email && !columns.sheetRow) {
    return { ok: false, error: 'No Name, Email or Application row column was found. Add a header row with at least one of them.' };
  }
  if (table.rows.length === 0) return { ok: false, error: 'The checklist has a header row but no entries.' };
  const rows = table.rows.map((record, index): ChecklistRow => {
    const rawRow = columns.sheetRow ? (record[columns.sheetRow] ?? '').replace(/^row\s*/i, '').trim() : '';
    const sheetRow = /^\d+$/.test(rawRow) ? Number(rawRow) : null;
    return {
      row: table.rowNumbers[index],
      name: (columns.name ? record[columns.name] ?? '' : '').replace(/\s+/g, ' ').trim(),
      email: normalizeEmail(columns.email ? record[columns.email] : ''),
      sheetRow,
      rawStatus: columns.status ? (record[columns.status] ?? '').trim() : '',
      note: columns.note ? (record[columns.note] ?? '').trim().slice(0, 500) : '',
    };
  });
  return { ok: true, headers: table.headers, columns, rows };
}

/** A checklist cell → status. Blank means "use the import mode's meaning". */
export function parseChecklistStatus(raw: string): PaymentStatus | 'blank' | 'unknown' {
  const text = raw.trim().toLowerCase().replace(/[.!]/g, '');
  if (!text) return 'blank';
  if (/^(paid|yes|y|true|x|✓|✔|verified|received|done)$/.test(text)) return 'paid';
  if (/^(unpaid|no|n|false|not paid|did not pay|didn't pay|missing)$/.test(text)) return 'unpaid';
  if (/^(pending|waiting|in progress)$/.test(text)) return 'pending';
  if (/^(waived|comp|comped|waiver|scholarship)$/.test(text)) return 'waived';
  return 'unknown';
}

export type ChecklistOutcome =
  | 'change'
  | 'unchanged'
  | 'suggested'
  | 'ambiguous'
  | 'unmatched'
  | 'duplicate'
  | 'conflict'
  | 'kept_waiver'
  | 'bad_status';

export interface ChecklistItem {
  row: ChecklistRow;
  outcome: ChecklistOutcome;
  applicantId: string | null;
  /** Applicants a reviewer may pick from (name-only or ambiguous matches). */
  candidateIds: string[];
  targetStatus: PaymentStatus | null;
  matchedBy: 'sheet_row' | 'email' | 'name' | null;
  message: string;
}

export interface ChecklistPlan {
  items: ChecklistItem[];
  /** Only confirmed rows; suggested name matches need confirmedSuggestions. */
  changes: PaymentChange[];
  /** Applicants not on a paid roster, when absence was explicitly chosen to mean Unpaid. */
  absentToUnpaid: string[];
  /** Paid applicants absent from an authoritative paid roster: reported, never changed. */
  paidButAbsent: string[];
  counts: Record<ChecklistOutcome, number>;
  /** Conflicts or unreadable statuses: nothing may be applied until they are fixed. */
  blocked: boolean;
  /** Why it is blocked, in the admin's words; empty when it is not. */
  blockReasons: string[];
}

export interface ChecklistContext {
  applicants: ReadonlyArray<Pick<HouseApplicant, 'id' | 'source_name' | 'source_row_number' | 'member_id' | 'payment_status' | 'withdrawn_reason'>>;
  /** Normalized email → member ids (members.email and confirmed aliases). */
  membersByEmail: ReadonlyMap<string, readonly string[]>;
  mode: ChecklistMode;
  absentPolicy: AbsentPolicy;
  /** Checklist row → applicant id an admin confirmed for a name-only or ambiguous match. */
  confirmedSuggestions: Readonly<Record<number, string>>;
}

/**
 * Plans a checklist import without changing anything. Matching is
 * conservative: an application row number or a known email (through the
 * applicant's confirmed member link) matches; a name alone is only suggested.
 * Absence from a checklist means nothing unless the admin explicitly chose
 * "absent means Unpaid" for an authoritative paid roster.
 */
export function planChecklistImport(rows: readonly ChecklistRow[], context: ChecklistContext): ChecklistPlan {
  const applicants = context.applicants;
  const byRow = new Map<number, string>();
  applicants.forEach((applicant) => byRow.set(applicant.source_row_number, applicant.id));
  const byMember = new Map<string, string[]>();
  applicants.forEach((applicant) => {
    if (applicant.member_id) byMember.set(applicant.member_id, [...(byMember.get(applicant.member_id) ?? []), applicant.id]);
  });
  const byName = new Map<string, string[]>();
  applicants.forEach((applicant) => {
    const key = normalizeMemberName(applicant.source_name);
    byName.set(key, [...(byName.get(key) ?? []), applicant.id]);
  });
  const applicantById = new Map(applicants.map((applicant) => [applicant.id, applicant]));
  const defaultStatus: PaymentStatus = context.mode === 'paid_roster' ? 'paid' : 'unpaid';

  const items: ChecklistItem[] = rows.map((row) => {
    const parsed = parseChecklistStatus(row.rawStatus);
    const targetStatus = parsed === 'blank' ? defaultStatus : parsed === 'unknown' ? null : parsed;
    const base = { row, candidateIds: [] as string[], targetStatus };
    if (targetStatus === null) {
      return { ...base, outcome: 'bad_status', applicantId: null, matchedBy: null, message: `"${row.rawStatus}" is not a payment status (use Paid, Unpaid, Pending or Waived).` };
    }
    if (row.sheetRow !== null) {
      const id = byRow.get(row.sheetRow);
      if (!id) return { ...base, outcome: 'unmatched', applicantId: null, matchedBy: null, message: `No applicant came from application row ${row.sheetRow}.` };
      const applicant = applicantById.get(id);
      if (row.name && applicant && normalizeMemberName(row.name) !== normalizeMemberName(applicant.source_name)) {
        return { ...base, outcome: 'suggested', applicantId: null, candidateIds: [id], matchedBy: 'sheet_row', message: `Application row ${row.sheetRow} is ${applicant.source_name}, not "${row.name}". Confirm before applying.` };
      }
      return { ...base, outcome: 'change', applicantId: id, matchedBy: 'sheet_row', message: `Matched by application row ${row.sheetRow}.` };
    }
    if (row.email) {
      const memberIds = context.membersByEmail.get(row.email) ?? [];
      const ids = Array.from(new Set(memberIds.flatMap((memberId) => byMember.get(memberId) ?? [])));
      if (ids.length === 1) return { ...base, outcome: 'change', applicantId: ids[0], matchedBy: 'email', message: 'Matched by email through the applicant’s linked member.' };
      if (ids.length > 1) return { ...base, outcome: 'ambiguous', applicantId: null, candidateIds: ids, matchedBy: 'email', message: `${ids.length} applicants are linked to this email’s member. Choose one.` };
    }
    const nameIds = row.name ? byName.get(normalizeMemberName(row.name)) ?? [] : [];
    if (nameIds.length === 1) {
      return { ...base, outcome: 'suggested', applicantId: null, candidateIds: nameIds, matchedBy: 'name', message: 'Same name as one applicant. A name alone is a suggestion: confirm it.' };
    }
    if (nameIds.length > 1) {
      return { ...base, outcome: 'ambiguous', applicantId: null, candidateIds: nameIds, matchedBy: 'name', message: `${nameIds.length} applicants share this name. Choose one.` };
    }
    return { ...base, outcome: 'unmatched', applicantId: null, matchedBy: null, message: row.email ? 'No applicant is linked to this email or name.' : 'No applicant has this name.' };
  });

  items.forEach((item) => {
    if ((item.outcome === 'suggested' || item.outcome === 'ambiguous') && context.confirmedSuggestions[item.row.row]) {
      const chosen = context.confirmedSuggestions[item.row.row];
      if (item.candidateIds.includes(chosen)) {
        item.applicantId = chosen;
        item.outcome = 'change';
        item.message = `${item.message} Confirmed by an admin.`;
      }
    }
  });

  const seen = new Map<string, ChecklistItem>();
  items.forEach((item) => {
    if (item.outcome !== 'change' || !item.applicantId) return;
    const earlier = seen.get(item.applicantId);
    if (!earlier) {
      seen.set(item.applicantId, item);
      return;
    }
    if (earlier.targetStatus === item.targetStatus) {
      item.outcome = 'duplicate';
      item.message = `Same applicant and status as checklist row ${earlier.row.row}; counted once.`;
    } else {
      item.outcome = 'conflict';
      earlier.outcome = 'conflict';
      const message = `Checklist rows ${earlier.row.row} and ${item.row.row} give this applicant different statuses.`;
      earlier.message = message;
      item.message = message;
    }
  });

  items.forEach((item) => {
    if (item.outcome !== 'change' || !item.applicantId) return;
    const applicant = applicantById.get(item.applicantId);
    if (!applicant) return;
    const current = readPaymentStatus(applicant);
    if (current === 'waived' && item.targetStatus !== 'waived') {
      item.outcome = 'kept_waiver';
      item.message = 'Has an approved waiver; a checklist never reverses it. Change it individually if needed.';
    } else if (current === item.targetStatus) {
      item.outcome = 'unchanged';
      item.message = `Already ${PAYMENT_STATUS_LABEL[current]}.`;
    }
  });

  const changes: PaymentChange[] = items
    .filter((item) => item.outcome === 'change' && item.applicantId && item.targetStatus)
    .map((item) => ({
      applicant_id: item.applicantId as string,
      payment_status: item.targetStatus as PaymentStatus,
      payment_evidence: 'payment_checklist',
      ...(item.row.note ? { payment_note: item.row.note } : {}),
    }));

  const listed = new Set(items.flatMap((item) => (item.applicantId ? [item.applicantId] : item.candidateIds)));
  const absentToUnpaid: string[] = [];
  const paidButAbsent: string[] = [];
  if (context.mode === 'paid_roster') {
    applicants.forEach((applicant) => {
      if (listed.has(applicant.id) || applicant.withdrawn_reason) return;
      const status = readPaymentStatus(applicant);
      if (status === 'paid') paidButAbsent.push(applicant.id);
      else if (context.absentPolicy === 'unpaid' && (status === 'unverified' || status === 'pending')) absentToUnpaid.push(applicant.id);
    });
  }
  absentToUnpaid.forEach((id) => changes.push({ applicant_id: id, payment_status: 'unpaid', payment_evidence: 'payment_checklist' }));

  const counts = {
    change: 0, unchanged: 0, suggested: 0, ambiguous: 0, unmatched: 0, duplicate: 0, conflict: 0, kept_waiver: 0, bad_status: 0,
  } as Record<ChecklistOutcome, number>;
  items.forEach((item) => { counts[item.outcome] += 1; });
  const blockReasons: string[] = [];
  if (counts.conflict > 0) blockReasons.push('Some rows give one applicant different statuses.');
  if (counts.bad_status > 0) blockReasons.push('Some statuses could not be read.');
  // "Absent means Unpaid" is only safe when every listed person was found:
  // an unmatched "Kathy Tran" would otherwise turn a paid "Katherine Tran" Unpaid.
  const unresolved = counts.unmatched + counts.ambiguous + counts.suggested;
  if (context.mode === 'paid_roster' && context.absentPolicy === 'unpaid' && unresolved > 0) {
    blockReasons.push(`${unresolved} checklist row${unresolved === 1 ? ' is' : 's are'} not matched to an applicant yet. Confirm or fix ${unresolved === 1 ? 'it' : 'them'} before marking absent applicants Unpaid.`);
  }
  return { items, changes, absentToUnpaid, paidButAbsent, counts, blocked: blockReasons.length > 0, blockReasons };
}

/** Admin-only checklist for CRC review: matching fields, status, reason, date. */
export function paymentChecklistCsv(
  applicants: ReadonlyArray<Pick<HouseApplicant, 'source_row_number' | 'source_name' | 'member_id' | 'submission_timestamp' | 'payment_status' | 'payment_evidence' | 'payment_note' | 'payment_updated_at' | 'withdrawn_reason'>>,
  memberName: (memberId: string) => string | null,
): string {
  const header = ['Application row', 'Applicant name', 'Linked member', 'Submitted (Pacific)', 'Payment status', 'Evidence', 'Note', 'Status changed (Pacific)', 'Withdrawn reason'];
  const lines = [header.map(csvCell).join(',')];
  [...applicants]
    .sort((a, b) => a.source_row_number - b.source_row_number)
    .forEach((applicant) => {
      const status = readPaymentStatus(applicant);
      lines.push([
        String(applicant.source_row_number),
        applicant.source_name,
        applicant.member_id ? memberName(applicant.member_id) ?? '' : '',
        formatPacific(applicant.submission_timestamp),
        PAYMENT_STATUS_LABEL[status],
        applicant.payment_evidence && applicant.payment_evidence in PAYMENT_EVIDENCE_LABEL
          ? PAYMENT_EVIDENCE_LABEL[applicant.payment_evidence as PaymentEvidence]
          : '',
        applicant.payment_note ?? '',
        applicant.payment_updated_at ? formatPacific(applicant.payment_updated_at) : '',
        applicant.withdrawn_reason ?? '',
      ].map(csvCell).join(','));
    });
  return `${lines.join('\n')}\n`;
}

// ─── Rerun (#657) ───────────────────────────────────────────────────────────

/** Saved applicants in the allocator's shape. Original submission priority only. */
export function rerunApplicants(
  applicants: ReadonlyArray<Pick<HouseApplicant, 'id' | 'source_name' | 'submission_timestamp' | 'source_row_number' | 'preferences'>>,
): PlacementApplicant[] {
  return applicants.map((applicant) => ({
    id: applicant.id,
    name: applicant.source_name,
    // Repeat submissions were set aside when the applications were imported.
    email: null,
    submittedAtMs: Date.parse(applicant.submission_timestamp),
    sourceRow: applicant.source_row_number,
    preferences: readPreferences(applicant.preferences as Json),
  }));
}

function fnv1a(text: string, seed: number) {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Identifies the exact rerun input: who was eligible (with original time,
 * row and ranking) and the capacities. Equal inputs give equal fingerprints,
 * whatever order they were listed in. Not a security hash.
 */
export function applicantSetFingerprint(applicants: readonly PlacementApplicant[], capacities: Capacities): string {
  const people = [...applicants]
    .sort(comparePriority)
    .map((applicant) => `${applicant.id}|${applicant.submittedAtMs}|${applicant.sourceRow}|${applicant.preferences.join(',')}`)
    .join(';');
  const houses = Object.keys(capacities).sort().map((id) => `${id}=${capacities[id]}`).join(';');
  const text = `${people}#${houses}`;
  return `v1-${fnv1a(text, 0x811c9dc5)}${fnv1a(text, 0x01234567)}`;
}

export interface RerunMemberLink {
  memberId: string | null;
  status: 'match' | 'review' | 'unmatched' | 'manual';
  method: 'email' | 'name' | 'manual' | null;
}

/**
 * The member link for a rerun row. The application's confirmed link wins (the
 * database refuses a row that places anyone else); otherwise a link an admin
 * confirmed in the source draft; otherwise the application's unconfirmed
 * suggestion, still marked for review. Identity is never guessed here.
 */
export function rerunMemberLink(
  applicant: Pick<HouseApplicant, 'member_id' | 'match_status' | 'match_method'>,
  sourceRow: Pick<HouseAssignmentDraft, 'member_id' | 'match_status' | 'match_method'> | undefined,
): RerunMemberLink {
  const method = (value: string | null) => (value === 'email' || value === 'name' || value === 'manual' ? value : null);
  if (applicant.member_id && (applicant.match_status === 'match' || applicant.match_status === 'manual')) {
    return { memberId: applicant.member_id, status: applicant.match_status, method: method(applicant.match_method) };
  }
  if (sourceRow?.member_id && (sourceRow.match_status === 'match' || sourceRow.match_status === 'manual')) {
    return { memberId: sourceRow.member_id, status: sourceRow.match_status, method: method(sourceRow.match_method) };
  }
  if (!applicant.member_id) return { memberId: null, status: 'unmatched', method: null };
  return { memberId: applicant.member_id, status: 'review', method: method(applicant.match_method) };
}

/** A Draft B row. Stores no email or other form answers. */
export function rerunDraftInsert(
  placement: Placement,
  applicant: Pick<HouseApplicant, 'id' | 'source_name' | 'submission_timestamp' | 'source_row_number' | 'preferences'>,
  link: RerunMemberLink,
  overrideNote: string | null,
): Omit<HouseAssignmentDraftInsert, 'batch_id'> {
  return {
    applicant_id: applicant.id,
    source_name: applicant.source_name,
    source_house: null,
    member_id: link.memberId,
    house_profile_id: placement.houseId,
    generated_house_profile_id: placement.houseId,
    override_reason: null,
    match_status: link.status,
    match_method: link.method,
    match_score: link.method ? 100 : null,
    preferences: readPreferences(applicant.preferences as Json),
    notes: overrideNote ? `${placement.explanation} ${overrideNote}` : placement.explanation,
    source_order: placement.priority - 1,
    submission_timestamp: new Date(applicant.submission_timestamp).toISOString(),
    source_row_number: applicant.source_row_number,
  };
}

// ─── Draft comparison (#659) ────────────────────────────────────────────────

export type ComparisonCategory =
  | 'removed_payment'
  | 'removed_withdrawn'
  | 'unchanged'
  | 'moved_better'
  | 'moved_worse'
  | 'moved_other'
  | 'reinstated';

export const COMPARISON_LABEL: Record<ComparisonCategory, string> = {
  removed_payment: 'Removed: payment',
  removed_withdrawn: 'Removed: withdrawn',
  unchanged: 'Unchanged',
  moved_better: 'Moved to a better choice',
  moved_worse: 'Moved to a worse choice',
  moved_other: 'Moved',
  reinstated: 'Added since the original',
};

export interface ComparisonEntry {
  key: string;
  applicantId: string | null;
  name: string;
  sourceRow: number | null;
  submittedIso: string | null;
  /** 1-based priority in the original draft / in the rerun. */
  beforePriority: number | null;
  afterPriority: number | null;
  beforeHouseId: string | null;
  afterHouseId: string | null;
  beforeRank: number | null;
  afterRank: number | null;
  category: ComparisonCategory;
  reason: string;
  /** No confirmed member link in the rerun row. */
  needsIdentity: boolean;
  /** The original row was a manual override of the allocator. */
  originalOverride: { fromHouseId: string | null; toHouseId: string | null; reason: string } | null;
}

export interface HouseComparison {
  houseId: string;
  label: string;
  beforeCapacity: number | null;
  afterCapacity: number;
  beforeCount: number;
  afterCount: number;
  /** rank → people, index 0 = first choice. */
  beforeRanks: number[];
  afterRanks: number[];
}

export interface DraftComparison {
  entries: ComparisonEntry[];
  houses: HouseComparison[];
  counts: Record<ComparisonCategory, number>;
  beforeTotal: number;
  afterTotal: number;
}

export interface CompareInput {
  houses: readonly PlacementHouse[];
  before: { rows: readonly HouseAssignmentDraft[]; capacities: Record<string, number> | null };
  after: { placements: readonly Placement[]; capacities: Capacities };
  applicants: ReadonlyArray<Pick<HouseApplicant, 'id' | 'source_name' | 'submission_timestamp' | 'source_row_number' | 'preferences' | 'payment_status' | 'withdrawn_reason' | 'member_id' | 'match_status'>>;
  /** Applicant id → the rerun member link (to flag identity review). */
  linkByApplicant: ReadonlyMap<string, RerunMemberLink>;
  mode: EligibilityMode;
}

function draftKey(row: Pick<HouseAssignmentDraft, 'applicant_id' | 'submission_timestamp' | 'source_row_number' | 'id'>) {
  if (row.applicant_id) return row.applicant_id;
  if (row.submission_timestamp && row.source_row_number) return applicantKey(row.submission_timestamp, row.source_row_number);
  return `row:${row.id}`;
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/**
 * Explains every difference between a saved draft and a rerun from the
 * allocator's own trace: who left the cohort, whose House changed and the
 * concrete reason (a higher-priority holder left, or better Houses were
 * full when their turn came). Same names stay separate people: rows are
 * keyed by applicant, never by name.
 */
export function compareDrafts(input: CompareInput): DraftComparison {
  const labelOf = new Map(input.houses.map((house) => [house.id, house.label]));
  const label = (id: string | null) => (id ? labelOf.get(id) ?? 'Unknown House' : 'No House');
  const applicantById = new Map(input.applicants.map((applicant) => [applicant.id, applicant]));
  const applicantByKey = new Map(input.applicants.map((applicant) => [applicantKey(applicant.submission_timestamp, applicant.source_row_number), applicant]));
  const placementById = new Map(input.after.placements.map((placement) => [placement.applicantId, placement]));

  const beforeOrdered = [...input.before.rows].sort((a, b) => a.source_order - b.source_order || a.id.localeCompare(b.id));
  const beforeByKey = new Map<string, { row: HouseAssignmentDraft; priority: number }>();
  beforeOrdered.forEach((row, index) => {
    const key = draftKey(row);
    const resolved = row.applicant_id ?? applicantByKey.get(key)?.id ?? key;
    beforeByKey.set(resolved, { row, priority: index + 1 });
  });
  const priorityMs = (key: string) => {
    const applicant = applicantById.get(key);
    if (applicant) return { submittedAtMs: Date.parse(applicant.submission_timestamp), sourceRow: applicant.source_row_number, id: applicant.id };
    const row = beforeByKey.get(key)?.row;
    return { submittedAtMs: row?.submission_timestamp ? Date.parse(row.submission_timestamp) : Number.POSITIVE_INFINITY, sourceRow: row?.source_row_number ?? 0, id: key };
  };

  const keys = new Set<string>([...Array.from(beforeByKey.keys()), ...input.after.placements.map((placement) => placement.applicantId)]);
  const rankOf = (prefs: readonly string[], houseId: string | null) => {
    if (!houseId) return null;
    const index = prefs.indexOf(houseId);
    return index === -1 ? null : index + 1;
  };

  const entries: ComparisonEntry[] = Array.from(keys).map((key) => {
    const before = beforeByKey.get(key);
    const after = placementById.get(key);
    const applicant = applicantById.get(key);
    const prefs = applicant ? readPreferences(applicant.preferences as Json) : readPreferences(before?.row.preferences);
    const beforeHouseId = before?.row.house_profile_id ?? null;
    const afterHouseId = after?.houseId ?? null;
    const beforeRank = rankOf(prefs, beforeHouseId);
    const afterRank = after ? after.achievedRank : null;
    const link = applicant ? input.linkByApplicant.get(applicant.id) : undefined;
    const overridden = before && (before.row.house_profile_id ?? null) !== (before.row.generated_house_profile_id ?? null);
    const entry: ComparisonEntry = {
      key,
      applicantId: applicant?.id ?? null,
      name: applicant?.source_name ?? before?.row.source_name ?? 'Unknown applicant',
      sourceRow: applicant?.source_row_number ?? before?.row.source_row_number ?? null,
      submittedIso: applicant?.submission_timestamp ?? before?.row.submission_timestamp ?? null,
      beforePriority: before?.priority ?? null,
      afterPriority: after?.priority ?? null,
      beforeHouseId,
      afterHouseId,
      beforeRank,
      afterRank,
      category: 'unchanged',
      reason: '',
      needsIdentity: !!after && (!link || !link.memberId || (link.status !== 'match' && link.status !== 'manual')),
      originalOverride: overridden && before
        ? { fromHouseId: before.row.generated_house_profile_id ?? null, toHouseId: before.row.house_profile_id ?? null, reason: before.row.override_reason ?? '' }
        : null,
    };

    if (!after) {
      if (applicant?.withdrawn_reason) {
        entry.category = 'removed_withdrawn';
        entry.reason = `Withdrawn: ${applicant.withdrawn_reason}`;
      } else {
        entry.category = 'removed_payment';
        entry.reason = applicant
          ? exclusionReason(applicant, input.mode) ?? 'Not eligible in this rerun.'
          : 'Not in the payment roster for this cycle.';
      }
      return entry;
    }
    if (!before) {
      entry.category = 'reinstated';
      const status = applicant ? PAYMENT_STATUS_LABEL[readPaymentStatus(applicant)] : 'eligible';
      entry.reason = `Not in the original draft; included now (${status}). Placed by original submission time: ${after.explanation}`;
      return entry;
    }
    if (beforeHouseId === afterHouseId) {
      entry.category = 'unchanged';
      entry.reason = `Same House (${afterRank ? ordinal(afterRank) : 'unranked'} choice).`;
      return entry;
    }

    const myPriority = priorityMs(key);
    if (beforeRank !== null && afterRank !== null && afterRank < beforeRank) {
      entry.category = 'moved_better';
      const freed = Array.from(beforeByKey.entries()).filter(([otherKey, other]) =>
        otherKey !== key
        && other.row.house_profile_id === afterHouseId
        && comparePriority(priorityMs(otherKey), myPriority) < 0
        && placementById.get(otherKey)?.houseId !== afterHouseId);
      const left = freed.filter(([otherKey]) => !placementById.has(otherKey)).length;
      const moved = freed.length - left;
      const parts = [
        left > 0 ? `${plural(left, 'higher-priority applicant')} who held ${label(afterHouseId)} in the original ${left === 1 ? 'is' : 'are'} no longer included` : '',
        moved > 0 ? `${plural(moved, 'higher-priority applicant')} who held it moved elsewhere` : '',
      ].filter(Boolean);
      const capacityBefore = input.before.capacities?.[afterHouseId as string];
      const capacityAfter = input.after.capacities[afterHouseId as string];
      const capacityNote = capacityBefore !== undefined && capacityBefore !== capacityAfter ? ` Its capacity changed from ${capacityBefore} to ${capacityAfter}.` : '';
      entry.reason = `${parts.length > 0 ? `${parts.join(', and ')}, so ` : ''}${label(afterHouseId)} (${ordinal(afterRank)} choice) had room when this applicant's turn came.${capacityNote}`;
      return entry;
    }
    if (beforeRank !== null && afterRank !== null && afterRank > beforeRank) {
      entry.category = 'moved_worse';
      const full = after.fullAhead.map(label);
      const shrunk = after.fullAhead.filter((id) => {
        const capacityBefore = input.before.capacities?.[id];
        return capacityBefore !== undefined && input.after.capacities[id] < capacityBefore;
      });
      entry.reason = `${full.join(', ')} ${full.length === 1 ? 'was' : 'were'} full when this applicant's turn came in the rerun.${shrunk.length > 0 ? ` Capacity dropped for ${shrunk.map((id) => `${label(id)} (${input.before.capacities?.[id]} → ${input.after.capacities[id]})`).join(', ')} because the cohort is smaller.` : ''}`;
      return entry;
    }
    entry.category = 'moved_other';
    entry.reason = entry.originalOverride
      ? `The original placement was a manual override (${label(entry.originalOverride.fromHouseId)} → ${label(entry.originalOverride.toHouseId)}); the rerun uses the allocator's result. ${after.explanation}`
      : after.explanation;
    return entry;
  });

  entries.sort((a, b) => comparePriority(priorityMs(a.key), priorityMs(b.key)));

  const counts = {
    removed_payment: 0, removed_withdrawn: 0, unchanged: 0, moved_better: 0, moved_worse: 0, moved_other: 0, reinstated: 0,
  } as Record<ComparisonCategory, number>;
  entries.forEach((entry) => { counts[entry.category] += 1; });

  const rankBuckets = (rows: Array<{ houseId: string | null; rank: number | null }>, houseId: string) => {
    const buckets = input.houses.map(() => 0);
    rows.forEach((row) => {
      if (row.houseId === houseId && row.rank !== null && row.rank <= buckets.length) buckets[row.rank - 1] += 1;
    });
    return buckets;
  };
  const beforeList = entries.filter((entry) => entry.beforeHouseId).map((entry) => ({ houseId: entry.beforeHouseId, rank: entry.beforeRank }));
  const afterList = entries.filter((entry) => entry.afterHouseId).map((entry) => ({ houseId: entry.afterHouseId, rank: entry.afterRank }));
  const houses: HouseComparison[] = input.houses.map((house) => ({
    houseId: house.id,
    label: house.label,
    beforeCapacity: input.before.capacities?.[house.id] ?? null,
    afterCapacity: input.after.capacities[house.id] ?? 0,
    beforeCount: beforeList.filter((row) => row.houseId === house.id).length,
    afterCount: afterList.filter((row) => row.houseId === house.id).length,
    beforeRanks: rankBuckets(beforeList, house.id),
    afterRanks: rankBuckets(afterList, house.id),
  }));

  return { entries, houses, counts, beforeTotal: input.before.rows.length, afterTotal: input.after.placements.length };
}

/** Private comparison CSV: placement facts only, formula-safe. */
export function comparisonCsv(comparison: DraftComparison, houseLabel: (id: string | null) => string): string {
  const header = [
    'Original priority', 'Rerun priority', 'Application row', 'Applicant name', 'Submitted (Pacific)',
    'Original House', 'Original rank', 'Rerun House', 'Rerun rank', 'Change', 'Reason', 'Needs identity review', 'Original was a manual override',
  ];
  const lines = [header.map(csvCell).join(',')];
  comparison.entries.forEach((entry) => {
    lines.push([
      entry.beforePriority === null ? '' : String(entry.beforePriority),
      entry.afterPriority === null ? '' : String(entry.afterPriority),
      entry.sourceRow === null ? '' : String(entry.sourceRow),
      entry.name,
      formatPacific(entry.submittedIso),
      entry.beforeHouseId ? houseLabel(entry.beforeHouseId) : '',
      entry.beforeRank === null ? '' : String(entry.beforeRank),
      entry.afterHouseId ? houseLabel(entry.afterHouseId) : '',
      entry.afterRank === null ? '' : String(entry.afterRank),
      COMPARISON_LABEL[entry.category],
      entry.reason,
      entry.needsIdentity ? 'Yes' : 'No',
      entry.originalOverride ? 'Yes' : 'No',
    ].map(csvCell).join(','));
  });
  return `${lines.join('\n')}\n`;
}

// ─── Batch lineage labels ───────────────────────────────────────────────────

export function batchLineageLabel(batch: { generation_reason?: string | null; eligibility_mode?: string | null; revised_from_batch_id?: string | null }) {
  if (batch.generation_reason === 'post_payment_rerun') {
    return batch.eligibility_mode === 'final' ? 'Post-payment rerun (final)' : 'Rerun (provisional)';
  }
  if (batch.eligibility_mode === 'provisional') return 'Initial placement (provisional)';
  return null;
}

export function readEligibilitySummary(value: Json | null | undefined): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const summary: Record<string, number> = {};
  Object.entries(value).forEach(([key, count]) => {
    if (typeof count === 'number') summary[key] = count;
  });
  return summary;
}
