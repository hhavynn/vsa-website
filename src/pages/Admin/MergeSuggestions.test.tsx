// Merge Suggestions on the shared identity evidence. Synthetic members only.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminMergeSuggestions from './MergeSuggestions';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const member = (id: string, first: string, last: string, extra: Record<string, unknown> = {}) => ({
  id, first_name: first, last_name: last, college: null, year: null, email: null, points: 3, events_attended: 1,
  created_at: `2026-0${id === 'a' ? 1 : 2}-01T00:00:00Z`, ...extra,
});

beforeEach(() => supabaseMock.reset());
afterEach(() => { delete process.env.REACT_APP_ATTENDANCE_IDENTITY_V2; });

it('suggests a pair that shares a confirmed address and shows every email on both records', async () => {
  process.env.REACT_APP_ATTENDANCE_IDENTITY_V2 = 'true';
  supabaseMock.setDefault('members', {
    data: [member('a', 'Alex', 'Nguyen', { email: 'alex@gmail.com' }), member('b', 'Alexander', 'Nguyen', { email: 'anguyen@ucsd.edu' })],
    error: null,
  });
  supabaseMock.setDefault('member_identity_emails', { data: [{ id: 'e1', member_id: 'b', email: 'alex@gmail.com' }], error: null });
  render(<MemoryRouter initialEntries={['/admin/merge-suggestions']}><AdminMergeSuggestions /></MemoryRouter>);
  expect(await screen.findByText('Same email on file')).toBeInTheDocument();
  expect(screen.getByText('anguyen@ucsd.edu, alex@gmail.com')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Confirm Merge' }));
  await waitFor(() => expect(supabaseMock.queriesFor('rpc:smart_merge_members')).toHaveLength(1));
  expect(supabaseMock.queriesFor('rpc:smart_merge_members')[0].calls[0].args[0]).toEqual({ p_source_id: 'b', p_target_id: 'a' });
});

it('shows an error instead of "All clean" when the roster cannot be read', async () => {
  supabaseMock.queueResult('members', { data: null, error: { message: 'permission denied', code: '42501' } });
  render(<MemoryRouter initialEntries={['/admin/merge-suggestions']}><AdminMergeSuggestions /></MemoryRouter>);
  expect(await screen.findByText('Suggestions could not be loaded.')).toBeInTheDocument();
  expect(screen.queryByText('All clean.')).not.toBeInTheDocument();
});

it('does not suggest merely similar names', async () => {
  supabaseMock.setDefault('members', { data: [member('a', 'An', 'Nguyen'), member('b', 'Anh', 'Nguyen')], error: null });
  render(<MemoryRouter initialEntries={['/admin/merge-suggestions']}><AdminMergeSuggestions /></MemoryRouter>);
  expect(await screen.findByText('All clean.')).toBeInTheDocument();
});

it('never reads the identity tables while the identity rollout is off', async () => {
  supabaseMock.setDefault('members', { data: [member('a', 'Ryan', 'Le'), member('b', 'Ryan', 'Le')], error: null });
  render(<MemoryRouter initialEntries={['/admin/merge-suggestions']}><AdminMergeSuggestions /></MemoryRouter>);
  expect(await screen.findByText('Same name')).toBeInTheDocument();
  expect(supabaseMock.queriesFor('member_identity_emails')).toEqual([]);
  expect(supabaseMock.queriesFor('member_year_observations')).toEqual([]);
});
