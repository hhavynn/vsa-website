import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAceEligibility, aceEligibilityReadinessKey } from './useAceEligibility';
import { aceAssignmentsRepository } from '../data/repos/aceAssignments';
import { attendanceReadinessRepository } from '../data/repos/attendanceReadiness';
import type { AceAssignmentCycle, AceAssignmentDraft } from '../types';

jest.mock('../data/repos/aceAssignments', () => ({ aceAssignmentsRepository: { listEligibilityEventIds: jest.fn() } }));
jest.mock('../data/repos/attendanceReadiness', () => ({
  attendanceReadinessRepository: { getReadiness: jest.fn(), getPolicyEventAttendance: jest.fn() },
}));

// Synthetic people and events only.
const cycle: AceAssignmentCycle = {
  id: 'cycle-1', academic_year_start: 2026, academic_year_end: 2027, status: 'draft',
  little_min_events: 1, big_min_events: 1, created_by: null, created_at: '', updated_at: '',
};
const drafts: AceAssignmentDraft[] = [{
  id: 'd1', cycle_id: 'cycle-1', little_name: 'Sample Little', little_member_id: 'm1', big_ace_member_id: null,
  published_ace_member_id: null, notes: null, display_order: 0, created_at: '', updated_at: '',
}];
const readiness = {
  events: [{ id: 'e1', name: 'Sample GBM', date: '2026-10-10T19:00:00Z', is_published: true, academic_term_id: 'fall',
    open_review_rows: 0, reconciliation_pending_rows: 0, reconciled_at: '2026-10-20T00:00:00Z', last_credit_at: null,
    latest_job: null, attestation: null, credits: 1 }],
  totalEvents: 1, truncated: false, checkedAt: '2026-10-30T12:00:00Z',
};

it('drops a previous result when a refresh fails instead of showing it as current', async () => {
  (aceAssignmentsRepository.listEligibilityEventIds as jest.Mock).mockResolvedValue(['e1']);
  (attendanceReadinessRepository.getReadiness as jest.Mock).mockResolvedValueOnce(readiness)
    .mockResolvedValueOnce({ ...readiness, truncated: true });
  (attendanceReadinessRepository.getPolicyEventAttendance as jest.Mock).mockResolvedValue(new Map([['m1', new Set(['e1'])]]));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useAceEligibility(cycle, drafts, [], true), { wrapper });

  await waitFor(() => expect(result.current.result?.littles[0].status).toBe('meets'));
  await act(() => client.invalidateQueries({ queryKey: aceEligibilityReadinessKey(2026) }));
  await waitFor(() => expect(result.current.error).toMatch(/incomplete/));
  expect(result.current.result).toBeNull();
});
