/**
 * Admin -> Cabinet: unsaved edits in the member editor are never thrown away
 * silently. Opening another member or cancelling the editor asks in a
 * ConfirmDialog that names what is lost; Keep editing changes nothing and
 * Discard changes performs the pending action.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

const person = (id: string, name: string, role: string, order: number) => ({
  id,
  name,
  role,
  category: 'Executive Board',
  display_order: order,
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
});

beforeEach(() => {
  supabaseMock.reset();
  supabaseMock.setDefault('cabinet_members', {
    data: [person('cm-1', 'Linh Tran', 'President', 1), person('cm-2', 'Bao Vo', 'Treasurer', 2)],
    error: null,
  });
});

function renderCabinet() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminCabinet />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openLinh() {
  renderCabinet();
  await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
  return screen.findByDisplayValue('President');
}

async function editLinh() {
  const role = await openLinh();
  await userEvent.clear(role);
  await userEvent.type(role, 'Co-President');
  return screen.getAllByRole('button', { name: 'Edit' });
}

describe('opening another member over unsaved edits', () => {
  it('asks first and Keep editing leaves the current edit untouched', async () => {
    const nativeConfirm = jest.spyOn(window, 'confirm');
    const rows = await editLinh();
    await userEvent.click(rows[1]);

    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your edits?' });
    expect(within(dialog).getByText(/unsaved changes to Linh Tran\. Opening Bao Vo discards them/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Co-President')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Treasurer')).not.toBeInTheDocument();
    expect(nativeConfirm).not.toHaveBeenCalled();
    nativeConfirm.mockRestore();
  });

  it('Discard changes opens the other member', async () => {
    const rows = await editLinh();
    await userEvent.click(rows[1]);
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your edits?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard changes' }));

    expect(await screen.findByDisplayValue('Treasurer')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Co-President')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('cancelling the editor with unsaved edits', () => {
  it('Keep editing keeps the editor and its edit; Discard changes closes it', async () => {
    await editLinh();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    let dialog = await screen.findByRole('alertdialog', { name: 'Discard your edits?' });
    expect(within(dialog).getByText(/unsaved changes to Linh Tran\. Closing the editor discards them/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByRole('heading', { name: 'Edit Linh Tran' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Co-President')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    dialog = await screen.findByRole('alertdialog', { name: 'Discard your edits?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard changes' }));
    expect(screen.queryByRole('heading', { name: 'Edit Linh Tran' })).not.toBeInTheDocument();
  });

  it('does not ask when nothing changed', async () => {
    await openLinh();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Edit Linh Tran' })).not.toBeInTheDocument();
  });
});
