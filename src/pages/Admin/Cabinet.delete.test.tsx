/**
 * Admin -> Cabinet: removing a cabinet record is the typed tier. The record is
 * public, so the admin must type the person's name and nothing is deleted
 * before that.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminCabinet from './Cabinet';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));
jest.mock('../../hooks/useCabinetYears', () => {
  const years = [
    { id: 'y-2627', label: '2026-2027', slug: '2026-2027', start_year: 2026, end_year: 2027, theme_name: null, is_active: true, display_order: 0, created_at: '', updated_at: '' },
  ];
  return { useCabinetYears: () => ({ cabinetYears: years, loading: false, error: null, refreshCabinetYears: jest.fn() }) };
});

const person = {
  id: 'cm-1',
  name: 'Linh Tran',
  role: 'President',
  category: 'Executive Board',
  display_order: 1,
  image_url: null,
  thumbnail_url: null,
  year: null,
  college: null,
  major: null,
  minor: null,
  pronouns: null,
  favorite_snack: null,
  fun_fact: null,
  cabinet_year_id: 'y-2627',
  created_at: '',
};

beforeEach(() => {
  supabaseMock.reset();
  supabaseMock.setDefault('cabinet_members', { data: [person], error: null });
});

const deletes = () =>
  supabaseMock.queriesFor('cabinet_members').filter((query) => query.calls.some((call) => call.method === 'delete'));

it('requires the member name before deleting a cabinet record', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminCabinet />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).getByText(/Removes Linh Tran from the public Cabinet page and the 2026-2027 archive/)).toBeInTheDocument();

  const confirm = within(dialog).getByRole('button', { name: 'Remove member' });
  expect(confirm).toBeDisabled();
  expect(deletes()).toHaveLength(0);

  fireEvent.change(within(dialog).getByLabelText(/to confirm/), { target: { value: 'linh tran' } });
  expect(confirm).toBeEnabled();

  fireEvent.click(confirm);
  await waitFor(() => expect(deletes()).toHaveLength(1));
  expect(deletes()[0].calls).toContainEqual({ method: 'eq', args: ['id', 'cm-1'] });
});
