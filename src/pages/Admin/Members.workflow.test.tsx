/**
 * Admin -> Members: quick filters with counts (kept in the URL), bulk "Review
 * OK", the Quick Search deep link, and unsaved-change protection in the editor.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminMembers from './Members';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));
jest.mock('../../data/repos/adminActivity', () => ({ logAdminActivity: jest.fn() }));
jest.mock('../../data/repos/houseMemberships', () => ({
  houseMembershipsRepository: { getHouseLabelsByMemberId: async () => new Map([['m-ada', 'Toad']]) },
}));
jest.mock('../../data/repos/photoRequests', () => ({
  photoRequestsRepository: {
    adminPublishMemberPhoto: jest.fn(),
    getPublicMemberAvatars: async () => new Map([['m-ada', 'https://example.invalid/ada.webp']]),
  },
}));

const member = (id: string, first: string, patch: Record<string, unknown> = {}) => ({
  id, first_name: first, last_name: 'Test', college: null, year: null, house: null, email: null,
  points: 0, events_attended: 0, created_at: '', needs_review: false, ...patch,
});
const rows = [
  member('m-ada', 'Ada', { events_attended: 3, points: 9 }),
  member('m-ben', 'Ben', { needs_review: true }),
  member('m-cam', 'Cam', { needs_review: true, events_attended: 1 }),
];

const { logAdminActivity } = jest.requireMock('../../data/repos/adminActivity');

function renderMembers(url = '/admin/members') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <AdminMembers />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  supabaseMock.reset();
  supabaseMock.setDefault('members', { data: rows, error: null });
  logAdminActivity.mockClear();
});

it('shows chips with live counts and filters the table', async () => {
  renderMembers();
  expect(await screen.findByRole('button', { name: /Needs Review\s*2/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /No House\s*2/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Missing Photo\s*2/ })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Missing Photo\s*2/ }));
  expect(screen.queryByText('Ada Test')).not.toBeInTheDocument();
  expect(screen.getByText('Ben Test')).toBeInTheDocument();
});

it('restores the filter from the URL so a refresh keeps the admin’s place', async () => {
  renderMembers('/admin/members?filter=needs_review');
  expect(await screen.findByRole('button', { name: /Needs Review\s*2/ })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByText('Ada Test')).not.toBeInTheDocument();
});

it('clears the review flag on only the selected flagged members', async () => {
  renderMembers();
  await userEvent.click(await screen.findByRole('checkbox', { name: 'Select Ben Test' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'Select Ada Test' }));
  await userEvent.click(screen.getByRole('button', { name: /Review OK \(1\)/ }));
  await waitFor(() => expect(logAdminActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'member.bulk_changed' })));
  const update = supabaseMock.queriesFor('members').find((query) => query.calls.some((call) => call.method === 'update'));
  expect(update?.calls.find((call) => call.method === 'update')?.args[0]).toEqual({ needs_review: false });
  expect(update?.calls).toContainEqual({ method: 'in', args: ['id', ['m-ben']] });
});

it('opens the editor from a Quick Search link by canonical id', async () => {
  renderMembers('/admin/members?member=m-cam');
  expect(await screen.findByRole('heading', { name: 'Edit Member' })).toBeInTheDocument();
  expect(screen.getByDisplayValue('Cam')).toBeInTheDocument();
});

it('keeps Save disabled until something changes, then shows Unsaved changes', async () => {
  renderMembers('/admin/members?member=m-cam');
  await screen.findByRole('heading', { name: 'Edit Member' });
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  fireEvent.change(screen.getByDisplayValue('Cam'), { target: { value: 'Cameron' } });
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
});

describe('discarding unsaved edits', () => {
  async function editedCam() {
    renderMembers('/admin/members?member=m-cam');
    await screen.findByRole('heading', { name: 'Edit Member' });
    fireEvent.change(screen.getByDisplayValue('Cam'), { target: { value: 'Cameron' } });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    return screen.findByRole('alertdialog', { name: 'Discard your edits?' });
  }

  it('asks in a dialog that names what is lost, and Keep editing leaves the edit untouched', async () => {
    const nativeConfirm = jest.spyOn(window, 'confirm');
    const dialog = await editedCam();
    expect(within(dialog).getByText(/unsaved changes to Cam Test/)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Edit Member' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Cameron')).toBeInTheDocument();
    expect(nativeConfirm).not.toHaveBeenCalled();
    nativeConfirm.mockRestore();
  });

  it('closes the editor only after Discard changes', async () => {
    const dialog = await editedCam();
    expect(screen.getByRole('heading', { name: 'Edit Member' })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit Member' })).not.toBeInTheDocument());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('does not ask when nothing changed', async () => {
    renderMembers('/admin/members?member=m-cam');
    await screen.findByRole('heading', { name: 'Edit Member' });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Edit Member' })).not.toBeInTheDocument();
  });
});


it('finds Matthew Van beyond Supabase\'s first 1,000 members', async () => {
  const largeRoster = Array.from({ length: 1004 }, (_, index) =>
    member(`member-${String(index).padStart(4, '0')}`, 'Other'),
  );
  largeRoster.push(member('member-1004', 'Matthew', { last_name: 'Van' }));
  supabaseMock.setDefault('members', { data: largeRoster, error: null });

  renderMembers();

  expect(await screen.findByText('1005 total members')).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText('Search members...'), {
    target: { value: 'Matthew Van' },
  });
  expect(await screen.findByText('Matthew Van')).toBeInTheDocument();
  expect(supabaseMock.queriesFor('members')).toHaveLength(3);
});

it('does not report zero members or export a partial list if a later page fails', async () => {
  supabaseMock.queueResult('members', {
    data: Array.from({ length: 500 }, (_, index) =>
      member(`member-${String(index).padStart(4, '0')}`, 'Other'),
    ),
    error: null,
  });
  supabaseMock.queueResult('members', {
    data: null,
    error: { message: 'The second batch failed', code: '42501' },
  });

  renderMembers();

  expect(await screen.findByText(/The full member roster could not be loaded/)).toBeInTheDocument();
  expect(screen.queryByText(/No members yet/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Retry loading' })).toBeInTheDocument();
});

