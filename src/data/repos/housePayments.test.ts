/**
 * The private House payment repository: complete roster reads (never a
 * partial list), status changes only through the versioned RPC, database
 * refusals surfaced in the admin's words, and a missing migration reported
 * as unavailable rather than as "nobody paid".
 */
import { housePaymentsRepository, PAYMENTS_UNAVAILABLE } from './housePayments';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const pageOf = (start: number, count: number) => Array.from({ length: count }, (_, index) => ({ id: `a${start + index}`, source_row_number: start + index }));

beforeEach(() => supabaseMock.reset());

describe('listApplicants', () => {
  it('reads every page past 1,000 rows', async () => {
    supabaseMock.queueResult('house_applicants', { data: pageOf(0, 1000), error: null });
    supabaseMock.queueResult('house_applicants', { data: pageOf(1000, 3), error: null });
    const all = await housePaymentsRepository.listApplicants('cycle-1');
    expect(all).toHaveLength(1003);
    const ranges = supabaseMock.queriesFor('house_applicants').flatMap((query) => query.calls).filter((call) => call.method === 'range');
    expect(ranges.map((call) => call.args)).toEqual([[0, 999], [1000, 1999]]);
  });

  it('fails the whole read when a later page fails', async () => {
    supabaseMock.queueResult('house_applicants', { data: pageOf(0, 1000), error: null });
    supabaseMock.queueResult('house_applicants', { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout', details: '', hint: '' } });
    await expect(housePaymentsRepository.listApplicants('cycle-1')).rejects.toThrow(/statement timeout/);
  });

  it('reports a missing migration as unavailable', async () => {
    supabaseMock.queueResult('house_payment_cycles', { data: null, error: { code: 'PGRST205', message: 'Could not find the table', details: '', hint: '' } });
    await expect(housePaymentsRepository.listCycles(2026)).rejects.toThrow(PAYMENTS_UNAVAILABLE);
  });
});

describe('setPayments', () => {
  it('sends one RPC with the request id and expected version', async () => {
    supabaseMock.queueResult('rpc:admin_set_house_applicant_payments', {
      data: { applied: 2, unchanged: 1, kept_waivers: 0, status_version: 9, post_reveal: false, replayed: false },
      error: null,
    });
    const result = await housePaymentsRepository.setPayments({
      cycleId: 'cycle-1',
      changes: [{ applicant_id: 'a1', payment_status: 'unpaid' }, { applicant_id: 'a2', payment_status: 'unpaid' }],
      source: 'bulk',
      reason: '  Missed the deadline  ',
      requestId: 'req-1',
      expectedVersion: 8,
    });
    expect(result).toEqual({ applied: 2, unchanged: 1, keptWaivers: 0, statusVersion: 9, postReveal: false, replayed: false });
    expect(supabaseMock.queriesFor('rpc:admin_set_house_applicant_payments')[0].calls[0].args[0]).toEqual({
      p_cycle_id: 'cycle-1',
      p_changes: [{ applicant_id: 'a1', payment_status: 'unpaid' }, { applicant_id: 'a2', payment_status: 'unpaid' }],
      p_source: 'bulk',
      p_reason: 'Missed the deadline',
      p_request_id: 'req-1',
      p_expected_version: 8,
    });
    expect(supabaseMock.usedMethod('house_applicants', 'update')).toBe(false);
  });

  it('explains a stale preview and says nothing changed', async () => {
    supabaseMock.queueResult('rpc:admin_set_house_applicant_payments', {
      data: null,
      error: { code: '40001', message: 'Payments changed since this preview (version 8 is now 9). Refresh and review again.', details: '', hint: '' },
    });
    await expect(housePaymentsRepository.setPayments({
      cycleId: 'cycle-1', changes: [{ applicant_id: 'a1', payment_status: 'paid' }], source: 'single', reason: null, requestId: 'req-2', expectedVersion: 8,
    })).rejects.toThrow(/Payments changed since this preview.*Nothing was changed/);
  });

  it('refuses an empty request without calling the database', async () => {
    await expect(housePaymentsRepository.setPayments({
      cycleId: 'cycle-1', changes: [], source: 'bulk', reason: null, requestId: 'req-3', expectedVersion: null,
    })).rejects.toThrow(/Nothing to change/);
    expect(supabaseMock.queriesFor('rpc:admin_set_house_applicant_payments')).toHaveLength(0);
  });
});

describe('registerApplicants and the gate', () => {
  it('refuses to continue if the database did not confirm every applicant', async () => {
    supabaseMock.queueResult('rpc:admin_register_house_applicants', { data: [{ applicant_key: 'k1', applicant_id: 'a1', created: true }], error: null });
    await expect(housePaymentsRepository.registerApplicants('cycle-1', [
      { applicant_key: 'k1', source_name: 'A', submission_timestamp: '2026-10-01T00:00:00Z', source_row_number: 2, preferences: ['h1'], member_id: null, match_status: 'unmatched', match_method: null },
      { applicant_key: 'k2', source_name: 'B', submission_timestamp: '2026-10-01T00:01:00Z', source_row_number: 3, preferences: ['h1'], member_id: null, match_status: 'unmatched', match_method: null },
    ], 'placement_import')).rejects.toThrow(/did not confirm every applicant/);
  });

  it('treats a missing gate function as "not gated" and a missing Reveal RPC as not started', async () => {
    supabaseMock.queueResult('rpc:house_batch_payment_blockers', { data: null, error: { code: 'PGRST202', message: 'not found', details: '', hint: '' } });
    supabaseMock.queueResult('rpc:admin_begin_house_batch_publish', { data: null, error: { code: 'PGRST202', message: 'not found', details: '', hint: '' } });
    await expect(housePaymentsRepository.getBatchBlockers('b1')).resolves.toBeNull();
    await expect(housePaymentsRepository.beginPublish('b1')).resolves.toBe(false);
  });

  it('surfaces a real gate refusal', async () => {
    supabaseMock.queueResult('rpc:admin_begin_house_batch_publish', { data: null, error: { code: '55006', message: 'Another draft’s Reveal is already in progress for this payment cycle.', details: '', hint: '' } });
    await expect(housePaymentsRepository.beginPublish('b1')).rejects.toThrow(/already in progress/);
  });
});
