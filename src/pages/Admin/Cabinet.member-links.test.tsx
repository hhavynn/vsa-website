import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminCabinet from './Cabinet';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));
jest.mock('../../hooks/useCabinetYears', () => ({
  useCabinetYears: () => ({
    cabinetYears: [{
      id: 'cab-year-2026', start_year: 2026, end_year: 2027, label: '2026-2027',
      slug: '2026-2027', theme_name: null, is_active: true, display_order: 0, created_at: '', updated_at: '',
    }],
    loading: false, error: null, refreshCabinetYears: jest.fn(),
  }),
}));

const cabinet = (id: string, name: string, memberId: string | null = null) => ({
  id, name, member_id: memberId,
  role: id === 'cab-1' ? 'President' : 'VCN Director & Executive Producer',
  category: id === 'cab-1' ? 'Executive Board' : 'General Board',
  display_order: id === 'cab-1' ? 1 : 2,
  cabinet_year_id: 'cab-year-2026',
  image_url: null, thumbnail_url: null, year: null, college: null,
  major: null, minor: null, pronouns: null, favorite_snack: null, fun_fact: null,
  created_at: '',
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminCabinet />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  supabaseMock.reset();
  supabaseMock.setDefault('cabinet_members', {
    data: [cabinet('cab-1', 'Linh Tran', 'member-linh'), cabinet('cab-2', 'Robert Le')],
    error: null,
  });
  supabaseMock.setDefault('public_members', {
    data: [{
      id: 'member-robert', first_name: 'Robert', last_name: 'Le',
      college: 'Seventh', year: 'Third Year',
    }],
    error: null,
  });
});

function writes() {
  return supabaseMock.queriesFor('cabinet_members')
    .filter((query) => query.calls.some((call) => call.method === 'update'));
}

describe('verified published Cabinet links for leaderboard role recognition (#626)', () => {
  it('shows year-scoped linked/unlinked review counts and lets an admin select a canonical member manually', async () => {
    mount();
    expect(await screen.findByText(/1 linked, 1 need a VSA member link/)).toBeInTheDocument();
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await userEvent.click(editButtons[1]);
    expect(screen.getByText(/Only a verified member ID will show this published Cabinet role/)).toBeInTheDocument();
    expect(screen.getByText('Not linked')).toBeInTheDocument();
    expect(writes()).toHaveLength(0);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search members' }), 'Robert Le');
    const result = await screen.findByRole('button', { name: /Robert Le/ });
    await userEvent.click(result);
    expect(writes()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    const update = writes()[0].calls.find((call) => call.method === 'update');
    expect(update?.args[0]).toMatchObject({ member_id: 'member-robert', role: 'VCN Director & Executive Producer' });
    expect(writes()[0].calls).toContainEqual({ method: 'eq', args: ['id', 'cab-2'] });
    expect(JSON.stringify(writes())).not.toMatch(/email|attendance|house_member_yearly_points/);
  });

  it('resolves an existing linked identity without guessing from a display name', async () => {
    // The selected canonical ID is intentionally absent from this synthetic directory.
    supabaseMock.queueResult('public_members', { data: null, error: null });
    mount();
    await screen.findByText(/1 linked, 1 need a VSA member link/);
    await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    expect(await screen.findByText('Linked member (not in member directory)')).toBeInTheDocument();
    expect(screen.getByText('Linked to VSA member')).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it('clears a stale member link when changing the public Cabinet name and disables relink until saved', async () => {
    mount();
    await screen.findByText(/1 linked, 1 need a VSA member link/);
    await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const nameInput = screen.getByDisplayValue('Linh Tran');
    fireEvent.change(nameInput, { target: { value: 'Different Person' } });
    expect(screen.getByText(/Save the renamed Cabinet entry before linking/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    const update = writes()[0].calls.find((call) => call.method === 'update');
    expect(update?.args[0]).toMatchObject({ name: 'Different Person', member_id: null });
  });
});
