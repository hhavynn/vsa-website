// #646: Pure, private review-only helpers for the *future* ACE intake planner.
// Do not import this module into public ACE/leaderboard code. Orphans are not
// synthetic family nodes or assignment drafts; no writes or publication here.
import { csvCell } from './adminImportReview';

export type AceParticipantStatus = 'pending_review' | 'eligible' | 'not_eligible' | 'withdrawn';
export type AceLittleOutcome = 'none' | 'orphan' | 'declined';
export type AceOrphanFollowUp = 'none' | 'to_contact' | 'contacted' | 'closed';
export type AcePairingStatus = 'none' | 'tentative' | 'confirmed' | 'revoked';

export interface AceOrphanReviewRow {
  participantId: string;
  cycleId: string;
  cycleLabel: string;
  displayName: string;
  role: 'big' | 'little';
  operationalStatus: AceParticipantStatus;
  littleOutcome: AceLittleOutcome;
  orphanFollowUp: AceOrphanFollowUp;
  orphanContinues: boolean;
  /** Derived from approved pairing rows, not unsaved ACE draft assignments. */
  pairingStatus: AcePairingStatus;
  /** Private narrative: never included in CSV or used to infer eligibility. */
  orphanReason?: string | null;
}

export type LittleReviewState =
  | 'not_yet_matched'
  | 'tentatively_matched'
  | 'confirmed_pairing'
  | 'orphan'
  | 'declined_withdrawn'
  | 'needs_review';

const LIVE_PAIRINGS: ReadonlySet<AcePairingStatus> = new Set(['tentative', 'confirmed']);
const PAIRING_CODES: ReadonlySet<AcePairingStatus> = new Set(['none', 'tentative', 'confirmed', 'revoked']);
const OPERATIONAL_CODES: ReadonlySet<AceParticipantStatus> =
  new Set(['pending_review', 'eligible', 'not_eligible', 'withdrawn']);
const OUTCOME_CODES: ReadonlySet<AceLittleOutcome> = new Set(['none', 'orphan', 'declined']);
const FOLLOW_UP_CODES: ReadonlySet<AceOrphanFollowUp> = new Set(['none', 'to_contact', 'contacted', 'closed']);

/**
 * Derived display status only. A contradictory Orphan + live pairing must be
 * fixed by the Chair, never silently converted into a pairing or an Orphan.
 * This does NOT change an intake status or authorize an assignment.
 */
export function littleState(row: Pick<AceOrphanReviewRow,
  'role' | 'operationalStatus' | 'littleOutcome' | 'pairingStatus'>): LittleReviewState {
  if (row.role !== 'little' || !PAIRING_CODES.has(row.pairingStatus) ||
      !OPERATIONAL_CODES.has(row.operationalStatus) || !OUTCOME_CODES.has(row.littleOutcome)) {
    return 'needs_review';
  }
  if (row.littleOutcome === 'orphan' && LIVE_PAIRINGS.has(row.pairingStatus)) return 'needs_review';
  if ((row.operationalStatus === 'withdrawn' || row.operationalStatus === 'not_eligible' ||
       row.littleOutcome === 'declined') && LIVE_PAIRINGS.has(row.pairingStatus)) return 'needs_review';
  if (row.operationalStatus === 'withdrawn' || row.littleOutcome === 'declined') return 'declined_withdrawn';
  if (row.littleOutcome === 'orphan' && row.operationalStatus !== 'eligible') return 'needs_review';
  if (row.littleOutcome === 'orphan') return 'orphan';
  if (row.pairingStatus === 'confirmed') return 'confirmed_pairing';
  if (row.pairingStatus === 'tentative') return 'tentatively_matched';
  return 'not_yet_matched';
}

export const ORPHAN_EXPORT_HEADERS = ['Name', 'Cycle', 'Follow-up', 'Continues'] as const;

/**
 * Review-only CSV for exactly one selected cycle. It contains NO reasons,
 * answers, contacts, member IDs, pairing claims, or unpublished tree nodes.
 * Fail closed on contradictory or duplicate Orphans rather than downloading
 * a deceptively complete list. Caller must first verify private admin access.
 */
export function buildOrphanCsv(rows: readonly AceOrphanReviewRow[], cycleId: string): string {
  if (!cycleId.trim()) throw new Error('Select a reviewed ACE cycle before exporting Orphans.');

  // Validate *all* rows before emitting anything: no mixed-cycle data, duplicate
  // participant identities, or inconsistent active pairings can slip through.
  const seen = new Set<string>();
  const orphans: AceOrphanReviewRow[] = [];
  for (const row of rows) {
    if (row.cycleId !== cycleId) throw new Error('Orphan export includes a different ACE cycle.');
    if (!row.participantId || seen.has(row.participantId)) {
      throw new Error('Orphan export contains a missing or duplicate participant ID.');
    }
    seen.add(row.participantId);
    if (!OUTCOME_CODES.has(row.littleOutcome) || !OPERATIONAL_CODES.has(row.operationalStatus) ||
        !PAIRING_CODES.has(row.pairingStatus)) {
      throw new Error('Orphan export contains unrecognized participant or pairing states.');
    }
    if (row.littleOutcome !== 'orphan') continue;
    if (row.role !== 'little' || row.operationalStatus !== 'eligible' ||
        LIVE_PAIRINGS.has(row.pairingStatus)) {
      throw new Error('An Orphan has conflicting role, eligibility or pairing state. Review before export.');
    }
    if (!row.displayName.trim() || !row.cycleLabel.trim() ||
        !FOLLOW_UP_CODES.has(row.orphanFollowUp) || typeof row.orphanContinues !== 'boolean') {
      throw new Error('Orphan export contains unreviewed required fields.');
    }
    orphans.push(row);
  }

  const lines = [ORPHAN_EXPORT_HEADERS.map(csvCell).join(',')];
  orphans
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'en') ||
      a.participantId.localeCompare(b.participantId))
    .forEach((row) => lines.push([
      row.displayName.trim(), row.cycleLabel.trim(),
      row.orphanFollowUp, row.orphanContinues ? 'Yes' : 'No',
    ].map(csvCell).join(',')));
  return '\uFEFF' + lines.join('\n') + '\n';
}
