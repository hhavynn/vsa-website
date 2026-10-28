import { dataRightsRequestsRepository } from './dataRightsRequests';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

describe('dataRightsRequestsRepository private boundary (#291)', () => {
  it('lists newest first with an explicit private column projection', async () => {
    const request = { id: 'request-1', request_type: 'export', status: 'pending' };
    supabaseMock.queueResult('data_rights_requests', { data: [request], error: null });
    await expect(dataRightsRequestsRepository.listDataRightsRequests()).resolves.toEqual([request]);
    const calls = supabaseMock.queriesFor('data_rights_requests')[0].calls;
    const select = calls.find((call) => call.method === 'select');
    expect(select?.args[0]).toContain('internal_notes');
    expect(select?.args[0]).not.toBe('*');
    expect(calls).toContainEqual({
      method: 'order', args: ['updated_at', { ascending: false }],
    });
  });

  it('returns an empty list only on a successful empty response', async () => {
    supabaseMock.queueResult('data_rights_requests', { data: null, error: null });
    await expect(dataRightsRequestsRepository.listDataRightsRequests()).resolves.toEqual([]);
    supabaseMock.queueResult('data_rights_requests', {
      data: null, error: postgrestError('permission denied', '42501'),
    });
    await expect(dataRightsRequestsRepository.listDataRightsRequests()).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
  });

  it('normalizes optional private text before inserting and scopes updates by request id', async () => {
    const request = { id: 'request-1' };
    supabaseMock.queueResult('data_rights_requests', { data: request, error: null });
    await dataRightsRequestsRepository.createDataRightsRequest({
      request_type: 'export',
      subject_display_name: '  Example Student  ',
      contact_channel: '  email  ',
      contact_reference: '  synthetic@example.invalid  ',
      summary: ' ',
      internal_notes: '  Cabinet only  ',
    } as Parameters<typeof dataRightsRequestsRepository.createDataRightsRequest>[0]);
    const first = supabaseMock.queriesFor('data_rights_requests')[0].calls;
    expect(first.find((call) => call.method === 'insert')?.args[0]).toMatchObject({
      subject_display_name: 'Example Student',
      contact_channel: 'email',
      contact_reference: 'synthetic@example.invalid',
      summary: null,
      internal_notes: 'Cabinet only',
    });

    supabaseMock.queueResult('data_rights_requests', { data: request, error: null });
    await dataRightsRequestsRepository.updateDataRightsRequest('request-1', {
      decision: '  Reviewed  ',
      internal_notes: '',
    });
    const calls = supabaseMock.queriesFor('data_rights_requests')[1].calls;
    expect(calls).toContainEqual({ method: 'eq', args: ['id', 'request-1'] });
    expect(calls.find((call) => call.method === 'update')?.args[0]).toMatchObject({
      decision: 'Reviewed', internal_notes: null,
    });
  });

  it('fetches request-history events only for the requested private case', async () => {
    supabaseMock.queueResult('data_rights_request_events', {
      data: [{ id: 'event-1', request_id: 'request-1' }], error: null,
    });
    await expect(dataRightsRequestsRepository.listDataRightsRequestEvents('request-1')).resolves.toEqual([
      { id: 'event-1', request_id: 'request-1' },
    ]);
    const calls = supabaseMock.queriesFor('data_rights_request_events')[0].calls;
    expect(calls).toContainEqual({ method: 'eq', args: ['request_id', 'request-1'] });
    expect(calls).toContainEqual({
      method: 'order', args: ['created_at', { ascending: false }],
    });
  });

  it('restricts admin assignee lookup to is_admin and formats missing names safely', async () => {
    supabaseMock.queueResult('user_profiles', {
      data: [
        { id: 'admin-1', first_name: 'Example', last_name: 'Chair' },
        { id: 'admin-2', first_name: '', last_name: '' },
      ], error: null,
    });
    await expect(dataRightsRequestsRepository.listAdminAssignees()).resolves.toEqual([
      { id: 'admin-1', displayName: 'Example Chair' },
      { id: 'admin-2', displayName: 'Admin' },
    ]);
    expect(supabaseMock.filtersFor('user_profiles')).toContainEqual(['is_admin', true]);
  });

  it('passes a specific request id to preview RPC and surfaces denied access', async () => {
    supabaseMock.queueResult('rpc:get_data_rights_dependency_preview', {
      data: null, error: postgrestError('permission denied', '42501'),
    });
    await expect(dataRightsRequestsRepository.getDataRightsDependencyPreview('request-1')).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
    const [query] = supabaseMock.queriesFor('rpc:get_data_rights_dependency_preview');
    expect(query.calls[0]).toEqual({
      method: 'rpc', args: [{ p_request_id: 'request-1' }],
    });
  });

  it('propagates failed history reads instead of hiding missing authorization', async () => {
    supabaseMock.queueResult('data_rights_request_events', {
      data: null, error: postgrestError('permission denied', '42501'),
    });
    await expect(dataRightsRequestsRepository.listDataRightsRequestEvents('request-1')).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
  });
});
