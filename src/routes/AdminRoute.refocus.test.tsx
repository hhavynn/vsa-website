/**
 * Switching browser tabs must never discard unsaved admin work.
 *
 * AuthProvider -> AdminRoute -> AdminLayout -> a real editor
 * (DataRightsRequestTracker), with only the Supabase boundary and the editor's
 * repository replaced. The refocus is the real sequence a browser produces:
 * visibilitychange hidden -> visible, window focus, supabase-js re-emitting
 * SIGNED_IN with a fresh user object, and react-query's focus refetch of the
 * (stale) admin-status entry. The editor stays mounted through all of it.
 *
 * The second scenario is the other way a draft is lost: a background refetch
 * of the server row while the form has unsaved edits.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider } from '../context/AuthContext';
import { AdminRoute } from './AdminRoute';
import AdminLayout from '../components/features/admin/AdminLayout';
import { DataRightsRequestTracker } from '../components/features/admin/DataRightsRequestTracker';
import { dataRightsRequestsRepository } from '../data/repos/dataRightsRequests';
import { supabaseMock, AuthSession } from '../test-utils/supabaseMock';

jest.mock('../lib/supabase', () => ({
  get supabase() {
    return require('../test-utils/supabaseMock').supabaseMock.client;
  },
}));
jest.mock('../components/features/admin/AdminNav', () => ({ AdminNav: () => null }));
jest.mock('../data/repos/dataRightsRequests', () => ({
  dataRightsRequestsRepository: {
    listDataRightsRequests: jest.fn(),
    listAdminAssignees: jest.fn(),
    listDataRightsRequestEvents: jest.fn(),
    updateDataRightsRequest: jest.fn(),
    createDataRightsRequest: jest.fn(),
  },
}));

const repo = dataRightsRequestsRepository as jest.Mocked<typeof dataRightsRequestsRepository>;

const sessionFor = (id: string): AuthSession => ({
  access_token: `token-${id}`,
  user: { id, email: `${id}@example.test` },
});

const requestRow = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'req-1',
    request_type: 'export',
    status: 'intake',
    subject_auth_user_id: null,
    subject_member_id: null,
    subject_display_name: 'Alex Subject',
    contact_channel: null,
    contact_reference: null,
    verification_status: 'not_started',
    verification_method: null,
    assigned_to: null,
    reviewer_id: null,
    priority: 'normal',
    summary: 'server summary v1',
    internal_notes: null,
    decision: null,
    completed_at: null,
    created_by: null,
    updated_by: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  }) as never;

function mountAdminEditor() {
  const client = new QueryClient({
    // The app's own default: nothing but admin-status refetches on focus.
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin/data-rights']}>
          <Routes>
            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin/data-rights" element={<DataRightsRequestTracker />} />
              </Route>
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
  return client;
}

const adminLookups = () => supabaseMock.queriesFor('user_profiles').length;

const setVisibility = (state: 'hidden' | 'visible') =>
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });

/** What the browser does when the admin leaves the tab and comes back. */
async function leaveAndReturn(client: QueryClient, adminId: string) {
  // The admin-status answer is older than its stale window, so refocus refetches it.
  client.setQueryData(['admin-status', adminId], true, { updatedAt: Date.now() - 11 * 60_000 });
  await act(async () => {
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('blur'));
  });
  await act(async () => {
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    supabaseMock.emitAuthEvent('SIGNED_IN', sessionFor(adminId));
    supabaseMock.emitAuthEvent('TOKEN_REFRESHED', sessionFor(adminId));
  });
}

beforeEach(() => {
  supabaseMock.reset();
  supabaseMock.setAuthSession(sessionFor('admin-1'));
  supabaseMock.setDefault('user_profiles', { data: { is_admin: true }, error: null });
  repo.listDataRightsRequests.mockResolvedValue([requestRow()]);
  repo.listAdminAssignees.mockResolvedValue([]);
  repo.listDataRightsRequestEvents.mockResolvedValue([]);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  setVisibility('visible');
  jest.restoreAllMocks();
});

async function openRequestAndType(text: string) {
  await userEvent.click(await screen.findByRole('button', { name: 'Review' }));
  const summary = await screen.findByLabelText(/brief summary/i);
  await waitFor(() => expect(summary).toHaveValue('server summary v1'));
  await userEvent.type(summary, text);
  return summary as HTMLTextAreaElement;
}

describe('an admin editing a form leaves the tab and comes back', () => {
  it('keeps the very same editor, mounted, with the unsaved text, through the whole refocus', async () => {
    const client = mountAdminEditor();
    const summary = await openRequestAndType(' + my unsaved note');
    const typed = 'server summary v1 + my unsaved note';
    expect(summary).toHaveValue(typed);
    expect(adminLookups()).toBe(1);

    await leaveAndReturn(client, 'admin-1');

    // The stale admin-status entry really was revalidated by the refocus...
    await waitFor(() => expect(adminLookups()).toBe(2));
    // ...and none of it touched the editor.
    expect(screen.queryByText(/verifying admin access/i)).not.toBeInTheDocument();
    const after = screen.getByLabelText(/brief summary/i);
    expect(after).toBe(summary);
    expect(summary).toBeInTheDocument();
    expect(after).toHaveValue(typed);
  });

  it('keeps the draft when the refocus re-verification fails (a network blip is not a sign-out)', async () => {
    const client = mountAdminEditor();
    const summary = await openRequestAndType(' + my unsaved note');
    supabaseMock.queueResult('user_profiles', { data: null, error: { message: 'offline', code: '57014' } });

    await leaveAndReturn(client, 'admin-1');
    await waitFor(() => expect(adminLookups()).toBe(2));

    expect(screen.getByLabelText(/brief summary/i)).toBe(summary);
    expect(summary).toHaveValue('server summary v1 + my unsaved note');
  });
});

describe('server data refreshes while the admin has unsaved edits', () => {
  it('does not overwrite the draft when the row comes back changed, and loads it once saved', async () => {
    const client = mountAdminEditor();
    const summary = await openRequestAndType(' + my unsaved note');
    const typed = 'server summary v1 + my unsaved note';

    // Someone else edited the same request; a background refetch brings it in.
    repo.listDataRightsRequests.mockResolvedValue([
      requestRow({ summary: 'server summary v2 (other admin)', status: 'pending_review', updated_at: '2026-10-07T00:00:00Z' }),
    ]);
    await act(async () => {
      await client.invalidateQueries(['admin', 'data-rights-requests']);
    });
    await waitFor(() => expect(repo.listDataRightsRequests).toHaveBeenCalledTimes(2));

    expect(screen.getByLabelText(/brief summary/i)).toBe(summary);
    expect(summary).toHaveValue(typed);

    // Saving makes what the server returns the new baseline.
    repo.updateDataRightsRequest.mockResolvedValue(
      requestRow({ summary: typed, status: 'pending_review', updated_at: '2026-10-07T01:00:00Z' })
    );
    repo.listDataRightsRequests.mockResolvedValue([requestRow({ summary: typed, status: 'pending_review' })]);
    await userEvent.click(screen.getByRole('button', { name: /save review record/i }));
    await waitFor(() => expect(repo.updateDataRightsRequest).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByLabelText(/brief summary/i)).toHaveValue(typed));
  });

  it('still loads a clean form from the server when a refetch changes the row', async () => {
    const client = mountAdminEditor();
    await userEvent.click(await screen.findByRole('button', { name: 'Review' }));
    const summary = await screen.findByLabelText(/brief summary/i);
    await waitFor(() => expect(summary).toHaveValue('server summary v1'));

    repo.listDataRightsRequests.mockResolvedValue([requestRow({ summary: 'server summary v2 (other admin)' })]);
    await act(async () => {
      await client.invalidateQueries(['admin', 'data-rights-requests']);
    });

    await waitFor(() => expect(screen.getByLabelText(/brief summary/i)).toHaveValue('server summary v2 (other admin)'));
  });
});
