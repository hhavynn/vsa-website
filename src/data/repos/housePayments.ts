// Protected domain — House membership. Private House payment eligibility:
// payment cycles (deadline, cutoff), the minimal applicant snapshot used for
// reruns, and the audit trail. Status changes go only through the
// admin_set_house_applicant_payments RPC (one transaction, versioned,
// idempotent, audited). Nothing here touches members, attendance, points or
// house_memberships. Authority: 20261028000000_house_payment_eligibility.sql.
import { supabase } from '../../lib/supabase';
import type {
  HouseApplicant,
  HouseApplicationKey,
  HousePaymentAuditRow,
  HousePaymentCycle,
  PaymentChange,
} from '../../lib/housePayments';
import type { Json } from '../../types/database';
import { ValidationError, withErrorHandling } from '../errors';

const PAGE = 1000;
const MISSING_FUNCTION = new Set(['PGRST202', '42883']);
const MISSING_TABLE = new Set(['PGRST205', '42P01']);

export const PAYMENTS_UNAVAILABLE =
  'House payment eligibility is not available yet. Ask a site administrator to apply database migration 20261028000000 and refresh the API schema cache.';

function errorCode(error: unknown) {
  return typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
}

function errorMessage(error: unknown) {
  return typeof error === 'object' && error && 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
}

/** Turns database refusals into the admin-facing messages the SQL already words. */
function rethrow(error: unknown, field: string): never {
  const code = errorCode(error);
  if (MISSING_FUNCTION.has(code) || MISSING_TABLE.has(code)) throw new ValidationError(PAYMENTS_UNAVAILABLE, field);
  if (code === '40001') throw new ValidationError(`${errorMessage(error)} Nothing was changed.`, 'stale');
  if (code === '55006' || code === '23514' || code === '22023' || code === '42501') {
    throw new ValidationError(errorMessage(error), field);
  }
  throw error;
}

export interface RegisterApplicantInput {
  applicant_key: string;
  source_name: string;
  submission_timestamp: string;
  source_row_number: number;
  preferences: string[];
  member_id: string | null;
  match_status: 'match' | 'review' | 'unmatched' | 'manual';
  match_method: 'email' | 'name' | 'manual' | null;
}

export interface PaymentChangeResult {
  applied: number;
  unchanged: number;
  keptWaivers: number;
  statusVersion: number;
  postReveal: boolean;
  replayed: boolean;
}

export interface DeadlineInput {
  paymentDeadline: string | null;
  graceUntil: string | null;
  note: string | null;
  /** Required by the database when the cutoff has already passed. */
  reason: string | null;
}

export class HousePaymentsRepository {
  async listCycles(academicYearStart: number): Promise<HousePaymentCycle[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_payment_cycles')
        .select('*')
        .eq('academic_year_start', academicYearStart)
        .order('created_at', { ascending: true });
      if (error) rethrow(error, 'cycles');
      return data ?? [];
    }, 'Failed to load House payment cycles');
  }

  async getCycle(cycleId: string): Promise<HousePaymentCycle> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase.from('house_payment_cycles').select('*').eq('id', cycleId).single();
      if (error) rethrow(error, 'cycle');
      return data;
    }, 'Failed to load the House payment cycle');
  }

  async createCycle(academicYearStart: number, applicationKey: HouseApplicationKey): Promise<HousePaymentCycle> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_payment_cycles')
        .insert({ academic_year_start: academicYearStart, application_key: applicationKey })
        .select('*')
        .single();
      if (error) rethrow(error, 'cycle');
      return data;
    }, 'Failed to create the House payment cycle');
  }

  async updateDeadline(cycleId: string, input: DeadlineInput): Promise<HousePaymentCycle> {
    return withErrorHandling(async () => {
      if (input.graceUntil && (!input.paymentDeadline || Date.parse(input.graceUntil) <= Date.parse(input.paymentDeadline))) {
        throw new ValidationError('The grace period must end after the deadline.', 'grace_until');
      }
      const { data, error } = await supabase
        .from('house_payment_cycles')
        .update({
          payment_deadline: input.paymentDeadline,
          grace_until: input.graceUntil,
          deadline_note: input.note?.trim() || null,
          last_change_reason: input.reason?.trim() || null,
        })
        .eq('id', cycleId)
        .select('*')
        .single();
      if (error) rethrow(error, 'payment_deadline');
      return data;
    }, 'Failed to save the payment deadline');
  }

  /** An explicit, recorded early (or late) cutoff. The database stamps who and when. */
  async setCutoffAuthorization(cycleId: string, reason: string | null): Promise<HousePaymentCycle> {
    return withErrorHandling(async () => {
      const trimmed = reason?.trim() || null;
      const { data, error } = await supabase
        .from('house_payment_cycles')
        .update(trimmed
          ? { cutoff_authorized_at: new Date().toISOString(), cutoff_authorized_reason: trimmed }
          : { cutoff_authorized_at: null, cutoff_authorized_reason: null })
        .eq('id', cycleId)
        .select('*')
        .single();
      if (error) rethrow(error, 'cutoff_authorized_at');
      return data;
    }, 'Failed to record the cutoff authorization');
  }

  /** Every applicant in the cycle. A failed page fails the whole read: never a partial roster. */
  async listApplicants(cycleId: string): Promise<HouseApplicant[]> {
    return withErrorHandling(async () => {
      const all: HouseApplicant[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('house_applicants')
          .select('*')
          .eq('cycle_id', cycleId)
          .order('source_row_number', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) rethrow(error, 'applicants');
        const page = data ?? [];
        all.push(...page);
        if (page.length < PAGE) return all;
      }
    }, 'Failed to load House applicants');
  }

  async listAudit(cycleId: string, limit = 200): Promise<HousePaymentAuditRow[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_payment_audit')
        .select('*')
        .eq('cycle_id', cycleId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit);
      if (error) rethrow(error, 'audit');
      return data ?? [];
    }, 'Failed to load payment history');
  }

  /**
   * Saves the application snapshot needed to rerun later. Re-registering an
   * identical application is a no-op; a changed one is refused by the
   * database. Returns applicant ids by key.
   */
  async registerApplicants(
    cycleId: string,
    applicants: readonly RegisterApplicantInput[],
    source: 'placement_import' | 'draft_bootstrap',
  ): Promise<Map<string, string>> {
    return withErrorHandling(async () => {
      if (applicants.length === 0) return new Map();
      const { data, error } = await supabase.rpc('admin_register_house_applicants', {
        p_cycle_id: cycleId,
        p_applicants: applicants as unknown as Json,
        p_source: source,
      });
      if (error) rethrow(error, 'applicants');
      const ids = new Map((data ?? []).map((row) => [row.applicant_key, row.applicant_id]));
      if (ids.size !== applicants.length) {
        throw new ValidationError('The database did not confirm every applicant. Nothing was saved as a draft; try again.', 'applicants');
      }
      return ids;
    }, 'Failed to save the House application snapshot');
  }

  async setPayments(input: {
    cycleId: string;
    changes: readonly PaymentChange[];
    source: 'single' | 'bulk' | 'checklist_import';
    reason: string | null;
    requestId: string;
    expectedVersion: number | null;
  }): Promise<PaymentChangeResult> {
    return withErrorHandling(async () => {
      if (input.changes.length === 0) throw new ValidationError('Nothing to change.', 'changes');
      const { data, error } = await supabase.rpc('admin_set_house_applicant_payments', {
        p_cycle_id: input.cycleId,
        p_changes: input.changes as unknown as Json,
        p_source: input.source,
        p_reason: input.reason?.trim() || null,
        p_request_id: input.requestId,
        p_expected_version: input.expectedVersion,
      });
      if (error) rethrow(error, 'payment_status');
      const result = (data ?? {}) as Record<string, unknown>;
      return {
        applied: Number(result.applied ?? 0),
        unchanged: Number(result.unchanged ?? 0),
        keptWaivers: Number(result.kept_waivers ?? 0),
        statusVersion: Number(result.status_version ?? 0),
        postReveal: result.post_reveal === true,
        replayed: result.replayed === true,
      };
    }, 'Failed to change payment eligibility');
  }

  async linkApplicantMember(applicantId: string, memberId: string | null): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase
        .from('house_applicants')
        .update(memberId
          ? { member_id: memberId, match_status: 'manual', match_method: 'manual' }
          : { member_id: null, match_status: 'unmatched', match_method: null })
        .eq('id', applicantId);
      if (error) rethrow(error, 'member_id');
    }, 'Failed to link the applicant');
  }

  /**
   * The server's own answer to "may this draft be locked or revealed?".
   * Null when the payment migration is not applied (the batch is then not
   * payment-gated anywhere).
   */
  async getBatchBlockers(batchId: string): Promise<string[] | null> {
    const { data, error } = await supabase.rpc('house_batch_payment_blockers', { p_batch_id: batchId });
    if (error) {
      if (MISSING_FUNCTION.has(errorCode(error))) return null;
      throw error;
    }
    return data ?? [];
  }

  /**
   * Re-checks the gate under a lock and freezes the cycle's payments for the
   * Reveal. A no-op for batches that are not payment-gated. Returns false when
   * the migration is not applied.
   */
  async beginPublish(batchId: string): Promise<boolean> {
    const { error } = await supabase.rpc('admin_begin_house_batch_publish', { p_batch_id: batchId });
    if (!error) return true;
    if (MISSING_FUNCTION.has(errorCode(error))) return false;
    rethrow(error, 'status');
  }
}

export const housePaymentsRepository = new HousePaymentsRepository();
