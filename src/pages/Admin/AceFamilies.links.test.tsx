/**
 * Admin -> ACE: every node shows its canonical member-link status, and admins
 * can link, change, unlink, and bulk-link exact matches without SQL.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

const node = (id: string, name: string, memberId: string | null) => ({
  id,
  family_id: family.id,
  name,
  role_label: null,
  photo_url: null,
  parent_member_id: null,
  member_id: memberId,
  display_order: 0,
  is_published: true,
  created_at: '',
  updated_at: '',
  ace_families: { name: family.name },
});

const nodes = [
  node('n-havyn', 'Havyn Nguyen', 'm-havyn'),
  node('n-tommy', 'Tommy Tran', null),
  node('n-andy', 'Andy Tran', null),
  node('n-alum', 'Old Alumni Name', null),
];

const member = (id: string, first: string, last: string, college: string, year: string | null) => ({
  id,
  first_name: first,
  last_name: last,
  college,
  year,
});

beforeEach(() => {
  supabaseMock.reset();
  supabaseMock.setDefault('ace_families', { data: [family], error: null });
  supabaseMock.setDefault('ace_family_members', { data: nodes, error: null });
  supabaseMock.setDefault('public_members', {
    data: [
      member('m-havyn', 'Havyn', 'Nguyen', 'Sixth', 'Fourth Year'),
      member('m-tommy', 'Tommy', 'Tran', 'Sixth', 'Third Year'),
      member('m-andy-1', 'Andy', 'Tran', 'Seventh', null),
      member('m-andy-2', 'Andy', 'Tran', 'Muir', null),
    ],
    error: null,
  });
});

async function openMoon(initialEntries: string[] = ['/admin/ace']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AdminAceFamilies />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /Moon/ }));
  await screen.findByText('1 / 4 linked');
  await screen.findByRole('button', { name: 'Review 3 unlinked' });
}

it('clears an Unlinked URL filter in the same navigation that targets a linked year-review node', async () => {
  await openMoon(['/admin/ace?filter=unlinked']);
  const linked = nodes[0];
  expect(screen.queryByDisplayValue(linked.name)).not.toBeInTheDocument();

  const button = await screen.findByRole('button', {
    name: `Review ACE node ${linked.name}, id ${linked.id}`,
  });
  fireEvent.click(button);

  // The old two-setSearchParams sequence restored ?filter=unlinked and hid
  // the requested editor, leaving the deep-link scroll target missing.
  expect(await screen.findByDisplayValue(linked.name)).toBeInTheDocument();
});

const linkUpdates = () =>
  supabaseMock
    .queriesFor('ace_family_members')
    .filter((query) => query.calls.some((call) => call.method === 'update'))
    .map((query) => ({
      payload: query.calls.find((call) => call.method === 'update')?.args[0] as Record<string, unknown>,
      calls: query.calls,
    }));

it('shows linked, suggested, ambiguous, and unmatched status for each node', async () => {
  await openMoon();
  expect(screen.getByText('Havyn Nguyen · Sixth · Fourth Year')).toBeInTheDocument();
  expect(screen.getByText('Linked to VSA member')).toBeInTheDocument();
  expect(screen.getAllByText('Not linked')).toHaveLength(3);
  expect(screen.getByText('Suggested match')).toBeInTheDocument();
  expect(screen.getByText(/2 possible members\. Check which person/)).toBeInTheDocument();
  expect(screen.getAllByRole('img', { name: 'Linked to VSA member' }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole('img', { name: 'Not linked: possible member match' }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole('img', { name: 'Not linked: no member match' }).length).toBeGreaterThan(0);
});

it('accepts a suggested match with one click and can unlink explicitly', async () => {
  await openMoon();
  fireEvent.click(screen.getByRole('button', { name: 'Link to Tommy Tran · Sixth · Third Year' }));
  await waitFor(() => expect(linkUpdates()).toHaveLength(1));
  expect(linkUpdates()[0].payload).toEqual(expect.objectContaining({ member_id: 'm-tommy' }));

  fireEvent.click(await screen.findByRole('button', { name: 'Unlink' }));
  await waitFor(() => expect(linkUpdates()).toHaveLength(2));
  expect(linkUpdates()[1].payload).toEqual(expect.objectContaining({ member_id: null }));
  expect(linkUpdates()[1].calls).toContainEqual({ method: 'eq', args: ['id', 'n-havyn'] });
});

it('blocks link changes during an unsaved rename and clears the link on save', async () => {
  await openMoon();
  const nameInput = screen.getByDisplayValue('Havyn Nguyen');
  fireEvent.change(nameInput, { target: { value: 'Someone Else' } });
  expect(screen.getByText(/Renaming a node clears its member link/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Unlink' })).toBeDisabled();

  // eslint-disable-next-line testing-library/no-node-access -- scoping to the correct row when multiple Save buttons exist
  const row = nameInput.closest('div.rounded.border') as HTMLElement;
  fireEvent.click(within(row).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(linkUpdates()).toHaveLength(1));
  expect(linkUpdates()[0].payload).toEqual(expect.objectContaining({ name: 'Someone Else', member_id: null }));
});

it('bulk-links only the exact unique matches from Review Unlinked', async () => {
  await openMoon();
  fireEvent.click(screen.getByRole('button', { name: 'Review 3 unlinked' }));
  const panel = screen.getByRole('region', { name: 'Review unlinked ACE members' });
  expect(within(panel).getByText('Exact matches (1)')).toBeInTheDocument();
  expect(within(panel).getByText('Needs manual review (1)')).toBeInTheDocument();
  expect(within(panel).getByText('No member record (1)')).toBeInTheDocument();

  fireEvent.click(within(panel).getByRole('button', { name: 'Link 1 obvious match' }));
  await waitFor(() => expect(linkUpdates()).toHaveLength(1));
  const [update] = linkUpdates();
  expect(update.payload).toEqual(expect.objectContaining({ member_id: 'm-tommy' }));
  expect(update.calls).toContainEqual({ method: 'eq', args: ['id', 'n-tommy'] });
  expect(update.calls).toContainEqual({ method: 'is', args: ['member_id', null] });
});

describe('linking someone who is already linked elsewhere', () => {
  // Andy Tran's node is already linked to Tommy Tran's member record.
  const linkedElsewhere = nodes.map((n) => (n.id === 'n-andy' ? { ...n, member_id: 'm-tommy' } : n));

  async function openWithDuplicate() {
    supabaseMock.setDefault('ace_family_members', { data: linkedElsewhere, error: null });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminAceFamilies />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Moon/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Link to Tommy Tran · Sixth · Third Year' }));
    return screen.findByRole('alertdialog', { name: 'Link Tommy Tran again?' });
  }

  it('asks first, names the existing link, and writes nothing until confirmed', async () => {
    const nativeConfirm = jest.spyOn(window, 'confirm');
    const dialog = await openWithDuplicate();
    expect(within(dialog).getByText(/Tommy Tran is already linked to/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Andy Tran/)).toBeInTheDocument();
    expect(linkUpdates()).toHaveLength(0);
    expect(nativeConfirm).not.toHaveBeenCalled();
    nativeConfirm.mockRestore();
  });

  it("Don't link closes the dialog and leaves the node unlinked", async () => {
    const dialog = await openWithDuplicate();
    fireEvent.click(within(dialog).getByRole('button', { name: "Don't link" }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(linkUpdates()).toHaveLength(0);
  });

  it('Link anyway performs the pending link for that node and person', async () => {
    const dialog = await openWithDuplicate();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Link anyway' }));
    await waitFor(() => expect(linkUpdates()).toHaveLength(1));
    expect(linkUpdates()[0].payload).toEqual(expect.objectContaining({ member_id: 'm-tommy' }));
    expect(linkUpdates()[0].calls).toContainEqual({ method: 'eq', args: ['id', 'n-tommy'] });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });
});

describe('filters, history, and unsaved changes', () => {
  const { logAdminActivity } = jest.requireMock('../../data/repos/adminActivity');

  it('offers link filters with counts and narrows the people list', async () => {
    await openMoon();
    expect(screen.getByRole('button', { name: /^Unlinked\s*3$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Possible match\s*2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /No match\s*1/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /No match\s*1/ }));
    expect(screen.queryByDisplayValue('Havyn Nguyen')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Old Alumni Name')).toBeInTheDocument();
  });

  it('logs a link change with an undo spec holding the previous member', async () => {
    await openMoon();
    fireEvent.click(screen.getByRole('button', { name: 'Link to Tommy Tran · Sixth · Third Year' }));
    await waitFor(() => expect(logAdminActivity).toHaveBeenCalled());
    const entry = logAdminActivity.mock.calls[0][0];
    expect(entry.action).toBe('ace.link_changed');
    expect(entry.summary).toBe('Linked ACE node "Tommy Tran" → member Tommy Tran');
    expect(entry.metadata.undo).toEqual({ kind: 'ace_node_link', target: { nodeId: 'n-tommy' }, before: null, after: 'm-tommy' });
  });

  it('keeps Save disabled until the fam form changes, then shows Unsaved changes', async () => {
    await openMoon();
    const save = screen.getByRole('button', { name: 'Save Changes' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByDisplayValue('Moon'), { target: { value: 'Moon Fam' } });
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('warns before leaving a fam with unsaved changes', async () => {
    await openMoon();
    fireEvent.change(screen.getByDisplayValue('Moon'), { target: { value: 'Moon Fam' } });
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: '+ New Fam' }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByDisplayValue('Moon Fam')).toBeInTheDocument();
    confirm.mockRestore();
  });
});

it('keeps pickup columns out of ordinary member Save, even for an already dated ACE node', async () => {
  supabaseMock.setDefault('ace_family_members', {
    data: nodes.map(n => n.id === 'n-havyn'
      ? { ...n, pickup_academic_year_start: 2023, pickup_term: 'FA23' }
      : n),
    error: null,
  });
  await openMoon();
  const nameInput = screen.getByDisplayValue('Havyn Nguyen');
  // eslint-disable-next-line testing-library/no-node-access -- scope to exact ID-backed member editor
  const row = nameInput.closest('div.rounded.border') as HTMLElement;
  fireEvent.click(within(row).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(linkUpdates()).toHaveLength(1));
  expect(linkUpdates()[0].payload).not.toHaveProperty('pickup_academic_year_start');
  expect(linkUpdates()[0].payload).not.toHaveProperty('pickup_term');
  expect(supabaseMock.queriesFor('rpc:correct_ace_member_pickup_year')).toHaveLength(0);
});

it('writes an ACE year only through an explicit confirmed audited RPC, scoped to the selected node', async () => {
  supabaseMock.setDefault('ace_member_pickup_evidence', { data: [], error: null });
  supabaseMock.setDefault('rpc:correct_ace_member_pickup_year', {
    data: { changed: true, ace_member_id: 'n-havyn', previous: { academic_year_start: null, term: null }, current: { academic_year_start: 2023, term: 'FA23' } },
    error: null,
  });
  await openMoon();
  const nameInput = screen.getByDisplayValue('Havyn Nguyen');
  // eslint-disable-next-line testing-library/no-node-access -- ensure the same ACE node is the writer target
  const row = nameInput.closest('div.rounded.border') as HTMLElement;
  fireEvent.click(within(row).getByRole('button', { name: /Review pickup year/ }));
  const input = within(row).getByRole('combobox', { name: 'Pickup academic year' });
  fireEvent.change(input, { target: { value: '2023–24' } });
  fireEvent.change(within(row).getByRole('combobox', { name: 'Exact pickup term (optional)' }), {
    target: { value: 'FA' },
  });
  expect(supabaseMock.queriesFor('rpc:correct_ace_member_pickup_year')).toHaveLength(0);
  fireEvent.click(within(row).getByRole('button', { name: 'Review and save year' }));
  const confirmation = await screen.findByRole('alertdialog', { name: 'Confirm pickup-year correction' });
  expect(supabaseMock.queriesFor('rpc:correct_ace_member_pickup_year')).toHaveLength(0);
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Confirm audited correction' }));

  await waitFor(() => expect(supabaseMock.queriesFor('rpc:correct_ace_member_pickup_year')).toHaveLength(1));
  const args = supabaseMock.queriesFor('rpc:correct_ace_member_pickup_year')[0].calls[0].args[0];
  expect(args).toEqual({
    p_ace_member_id: 'n-havyn', p_expected_year: null, p_expected_term: null,
    p_academic_year_start: 2023, p_term: 'FA23',
    p_source_kind: 'admin_entry', p_evidence_id: null,
  });
  expect(linkUpdates()).toHaveLength(0);
  const privateReads = supabaseMock.queriesFor('ace_member_pickup_evidence');
  expect(privateReads.length).toBeGreaterThan(0);
  expect(privateReads[0].calls).toContainEqual({ method: 'eq', args: ['ace_family_members.family_id', family.id] });
  expect(privateReads[0].calls.find(call => call.method === 'select')?.args[0])
    .not.toContain('review_note');
});
