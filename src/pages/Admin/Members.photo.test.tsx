/**
 * Admin -> Members -> Edit: publishing a photo for a member. The photo goes
 * public immediately, so the dialog must not publish without the admin's
 * consent confirmation, and a failed publish must leave the dialog open with
 * the photo still selected.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminMembers from './Members';
import { supabaseMock } from '../../test-utils/supabaseMock';
import { ValidationError } from '../../data/errors';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

jest.mock('../../data/repos/houseMemberships', () => ({
  houseMembershipsRepository: { getHouseLabelsByMemberId: async () => new Map() },
}));

const mockPublish = jest.fn();
const AVATAR_URL = 'https://example.invalid/storage/v1/object/public/avatars/approved/lan.webp';

jest.mock('../../data/repos/photoRequests', () => ({
  photoRequestsRepository: {
    adminPublishMemberPhoto: (...args: unknown[]) => mockPublish(...args),
    getPublicMemberAvatars: async () => new Map([['member-lan', AVATAR_URL]]),
  },
}));

const rows = [
  {
    id: 'member-lan', first_name: 'Lan', last_name: 'Tran', college: null, year: null, house: null,
    email: null, points: 10, events_attended: 2, created_at: '', needs_review: false,
  },
];

beforeAll(() => {
  Object.assign(URL, { createObjectURL: () => 'blob:preview', revokeObjectURL: () => undefined });
});

afterEach(() => jest.restoreAllMocks());

beforeEach(() => {
  supabaseMock.reset();
  supabaseMock.setDefault('members', { data: rows, error: null });
  mockPublish.mockReset().mockResolvedValue(undefined);
});

async function openEditDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminMembers />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
  return screen.getByLabelText('Choose a new photo');
}

const photo = () => new File(['bytes'], 'lan.png', { type: 'image/png' });

it('shows the member’s current approved photo in the dialog', async () => {
  await openEditDialog();
  expect(await screen.findByAltText('Current photo of Lan Tran')).toHaveAttribute('src', AVATAR_URL);
});

it('does not save or publish until the admin confirms consent', async () => {
  const input = await openEditDialog();
  fireEvent.change(input, { target: { files: [photo()] } });
  fireEvent.click(screen.getByRole('button', { name: 'Save & publish photo' }));

  expect(screen.getByRole('alert')).toHaveTextContent('Confirm the member agreed');
  expect(supabaseMock.usedMethod('members', 'update')).toBe(false);
  expect(mockPublish).not.toHaveBeenCalled();
});

it('saves the member, then publishes the photo, and closes', async () => {
  let savedBeforePublish = false;
  mockPublish.mockImplementation(async () => {
    savedBeforePublish = supabaseMock.usedMethod('members', 'update');
  });
  const input = await openEditDialog();
  const file = photo();
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(screen.getByLabelText(/agreed to this photo being shown publicly/));
  fireEvent.click(screen.getByRole('button', { name: 'Save & publish photo' }));

  await waitFor(() => expect(mockPublish).toHaveBeenCalledWith('member-lan', file));
  expect(savedBeforePublish).toBe(true);
  await waitFor(() => expect(screen.queryByText('Edit Member')).not.toBeInTheDocument());
});

it('keeps the dialog open with the photo selected when publishing fails', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  mockPublish.mockRejectedValue(new ValidationError('Image is too large. Max upload size is 5 MB.', 'file'));
  const input = await openEditDialog();
  fireEvent.change(input, { target: { files: [photo()] } });
  fireEvent.click(screen.getByLabelText(/agreed to this photo being shown publicly/));
  fireEvent.click(screen.getByRole('button', { name: 'Save & publish photo' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Image is too large');
  expect(screen.getByText('Edit Member')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save & publish photo' })).toBeEnabled();
});
