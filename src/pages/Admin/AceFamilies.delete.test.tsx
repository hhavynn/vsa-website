/**
 * Admin -> ACE: deleting a fam cascades its whole tree, so it needs the typed
 * confirmation; removing a single person is a standard confirmation. Neither
 * may touch the database until confirmed.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminAceFamilies from './AceFamilies';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../data/repos/adminActivity', () => ({ logAdminActivity: jest.fn() }));
jest.mock('../../data/repos/adminOperations', () => ({
  adminOperationsRepository: { resolveYearStart: jest.fn().mockResolvedValue(2026) },
}));
jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const family = {
  id: 'fam-moon',
  name: 'Moon',
  slug: 'moon',
  description: null,
  cover_image_url: null,
  theme_color: null,
  display_order: 0,
  is_published: true,
  academic_year_start: null,
  academic_year_end: null,
  created_at: '',
  updated_at: '',
};

const node = (id: string, name: string, parent: string | null = null) => ({
  id,
  family_id: family.id,
  name,
  role_label: null,
  photo_url: null,
  parent_member_id: parent,
  member_id: null,
  display_order: 0,
  is_published: true,
  created_at: '',
  updated_at: '',
  ace_families: { name: family.name },
});

const nodes = [node('n-big', 'Big Person'), node('n-little', 'Little Person', 'n-big')];

beforeEach(() => {
  supabaseMock.reset();
  supabaseMock.setDefault('ace_families', { data: [family], error: null });
  supabaseMock.setDefault('ace_family_members', { data: nodes, error: null });
  supabaseMock.setDefault('public_members', { data: [], error: null });
});

async function openMoon() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminAceFamilies />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /Moon/ }));
  await screen.findByRole('button', { name: 'Delete Fam' });
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(2));
}

const deletesOn = (table: string) =>
  supabaseMock.queriesFor(table).filter((query) => query.calls.some((call) => call.method === 'delete'));

it('requires typing the fam name before deleting, and states the cascade', async () => {
  await openMoon();
  fireEvent.click(screen.getByRole('button', { name: 'Delete Fam' }));

  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).getByText(/Deletes all 2 people in this fam/)).toBeInTheDocument();
  const confirm = within(dialog).getByRole('button', { name: 'Delete fam' });
  expect(confirm).toBeDisabled();
  expect(deletesOn('ace_families')).toHaveLength(0);

  fireEvent.change(within(dialog).getByLabelText(/to confirm/), { target: { value: 'Mo' } });
  expect(confirm).toBeDisabled();

  fireEvent.change(within(dialog).getByLabelText(/to confirm/), { target: { value: 'moon' } });
  expect(confirm).toBeEnabled();

  fireEvent.click(confirm);
  await waitFor(() => expect(deletesOn('ace_families')).toHaveLength(1));
  expect(deletesOn('ace_families')[0].calls).toContainEqual({ method: 'eq', args: ['id', 'fam-moon'] });
});

it('cancelling the fam delete dialog deletes nothing', async () => {
  await openMoon();
  fireEvent.click(screen.getByRole('button', { name: 'Delete Fam' }));
  const dialog = await screen.findByRole('alertdialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(deletesOn('ace_families')).toHaveLength(0);
});

it('removing one person confirms by name and notes that their littles become top-level', async () => {
  await openMoon();
  // The tree lists the Big first; the dialog title below confirms which person it is.
  fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).getByText('Remove Big Person from the fam?')).toBeInTheDocument();
  expect(within(dialog).getByText(/Their littles stay in the fam/)).toBeInTheDocument();
  expect(deletesOn('ace_family_members')).toHaveLength(0);

  fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
  await waitFor(() => expect(deletesOn('ace_family_members')).toHaveLength(1));
  expect(deletesOn('ace_family_members')[0].calls).toContainEqual({ method: 'eq', args: ['id', 'n-big'] });
});
