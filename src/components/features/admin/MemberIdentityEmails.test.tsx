// Admin identity emails on the Members editor. Synthetic member only.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemberIdentityEmails } from './MemberIdentityEmails';
import { supabaseMock } from '../../../test-utils/supabaseMock';

jest.mock('../../../lib/supabase', () => ({
  get supabase() {
    return require('../../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const alias = (id: string, email: string, verification_method: string) => ({
  id, member_id: 'alex', email, source: 'attendance_import', verification_method, created_at: '2026-10-01T00:00:00Z', moved_from_member_id: null,
});

function renderPanel() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemberIdentityEmails memberId="alex" contactEmail="alex@gmail.com" />
    </QueryClientProvider>,
  );
}

const calls = (method: string) =>
  supabaseMock.queriesFor('member_identity_emails').flatMap((q) => q.calls).filter((c) => c.method === method);

beforeEach(() => supabaseMock.reset());

it('lists the addresses with how each was confirmed, filtered to this member', async () => {
  supabaseMock.setDefault('member_identity_emails', {
    data: [alias('e1', 'alex@gmail.com', 'primary_email'), alias('e2', 'alex@ucsd.edu', 'unique_name_college_year')],
    error: null,
  });
  renderPanel();
  expect(await screen.findByText('alex@ucsd.edu')).toBeInTheDocument();
  expect(screen.getByText(/import: same name, college and year/)).toBeInTheDocument();
  expect(supabaseMock.filtersFor('member_identity_emails')).toContainEqual(['member_id', 'alex']);
});

it('removes an address only after a second confirmation', async () => {
  supabaseMock.setDefault('member_identity_emails', { data: [alias('e2', 'wrong@ucsd.edu', 'admin_confirmed')], error: null });
  renderPanel();
  fireEvent.click(await screen.findByRole('button', { name: 'Remove wrong@ucsd.edu' }));
  expect(calls('delete')).toEqual([]);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm remove' }));
  await waitFor(() => expect(calls('delete')).toHaveLength(1));
  expect(supabaseMock.filtersFor('member_identity_emails')).toContainEqual(['id', 'e2']);
});

it('adds a normalized address as an admin entry, and explains an address someone already has', async () => {
  supabaseMock.setDefault('member_identity_emails', { data: [], error: null });
  renderPanel();
  await screen.findByText('No confirmed emails yet.');
  fireEvent.change(screen.getByRole('textbox', { name: /Add an email/ }), { target: { value: ' Alex@UCSD.edu ' } });
  supabaseMock.queueResult('member_identity_emails', { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(await screen.findByText(/already identifies a member/)).toBeInTheDocument();
  expect(calls('insert')[0].args[0]).toEqual({ member_id: 'alex', email: 'alex@ucsd.edu', source: 'admin', verification_method: 'admin_entered' });
});

it('shows a retry instead of an empty list when the read fails', async () => {
  supabaseMock.queueResult('member_identity_emails', { data: null, error: { message: 'permission denied', code: '42501' } });
  renderPanel();
  expect(await screen.findByText(/Could not load the emails/)).toBeInTheDocument();
  expect(screen.queryByText('No confirmed emails yet.')).not.toBeInTheDocument();
});

it('does not offer to remove the contact email, which identifies the member by itself', async () => {
  supabaseMock.setDefault('member_identity_emails', {
    data: [alias('e1', 'alex@gmail.com', 'primary_email'), alias('e2', 'old@ucsd.edu', 'admin_confirmed')],
    error: null,
  });
  renderPanel();
  await screen.findByText('alex@gmail.com');
  expect(screen.queryByRole('button', { name: 'Remove alex@gmail.com' })).not.toBeInTheDocument();
  expect(screen.getByText(/Contact email: change it above/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Remove old@ucsd.edu' })).toBeInTheDocument();
});
