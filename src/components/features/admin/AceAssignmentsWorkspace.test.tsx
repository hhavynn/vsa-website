/**
 * Admin -> ACE -> Assignments: private drafting, lock, preflight, publish.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminAceFamilies from '../../../pages/Admin/AceFamilies';
import { AceAssignmentsWorkspace } from './AceAssignmentsWorkspace';
import { supabaseMock } from '../../../test-utils/supabaseMock';

jest.mock('../../../lib/supabase', () => ({
  get supabase() {
    return require('../../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const cycle = (status: string) => ({
  id: 'cycle-1',
  academic_year_start: 2026,
  academic_year_end: 2027,
  status,
  created_by: null,
  created_at: '',
  updated_at: '',
});

const draft = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  cycle_id: 'cycle-1',
  little_name: name,
  little_member_id: null,
  big_ace_member_id: null,
  published_ace_member_id: null,
  notes: null,
  display_order: 0,
  created_at: '',
  updated_at: '',
  ...over,
});

const aceNode = (id: string, name: string, familyId: string, familyName: string) => ({
  id,
  name,
  family_id: familyId,
  member_id: null,
  parent_member_id: null,
  role_label: 'Little',
  ace_families: { name: familyName },
});

const member = (id: string, first: string, last: string) => ({
  id,
  first_name: first,
  last_name: last,
  college: 'Sixth',
  year: 'Third Year',
});

function seed(status: string, drafts: ReturnType<typeof draft>[]) {
  supabaseMock.reset();
  supabaseMock.setDefault('ace_assignment_cycles', { data: [cycle(status)], error: null });
  supabaseMock.setDefault('ace_assignment_drafts', { data: drafts, error: null });
  supabaseMock.setDefault('ace_family_members', {
    data: [aceNode('big-april', 'April Pham', 'fam-sweatpants', 'Sweatpants'), aceNode('big-emily', 'Emily Nguyen', 'fam-nsf', 'NSF')],
    error: null,
  });
  supabaseMock.setDefault('public_members', {
    data: [member('m-amy', 'Amy', 'Tran'), member('m-andy-1', 'Andy', 'Tran'), member('m-andy-2', 'Andy', 'Tran')],
    error: null,
  });
}

function renderWorkspace() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AceAssignmentsWorkspace />
    </QueryClientProvider>,
  );
}

const callsOf = (table: string, method: string) =>
  supabaseMock
    .queriesFor(table)
    .flatMap((query) => query.calls)
    .filter((call) => call.method === method);

describe('draft cycle', () => {
  beforeEach(() =>
    seed('draft', [
      draft('d1', 'John Nguyen', { big_ace_member_id: 'big-april' }),
      draft('d2', 'Amy Tran'),
      draft('d3', 'Andy Tran', { big_ace_member_id: 'big-emily' }),
    ]),
  );

  it('shows the headline counts and a preflight with publish blockers', async () => {
    renderWorkspace();
    expect(await screen.findByText('ACE 2026–27 Assignment')).toBeInTheDocument();
    expect(await screen.findByText('1 unassigned Little')).toBeInTheDocument();
    expect(screen.getByText('Blocks publish')).toBeInTheDocument();
    expect(screen.getByText('1 ambiguous member match')).toBeInTheDocument();
    expect(screen.getByText('Private. Edit freely; nothing here is public.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publish/ })).not.toBeInTheDocument();
  });

  it('locking changes only the cycle status and publishes nothing', async () => {
    renderWorkspace();
    fireEvent.click(await screen.findByRole('button', { name: 'Lock assignments' }));
    await waitFor(() => expect(callsOf('ace_assignment_cycles', 'update')).toHaveLength(1));
    expect(callsOf('ace_assignment_cycles', 'update')[0].args[0]).toMatchObject({ status: 'locked' });
    expect(supabaseMock.filtersFor('ace_assignment_cycles')).toContainEqual(['status', 'draft']);
    expect(supabaseMock.queriesFor('ace_family_members').every((q) => q.calls.every((c) => c.method !== 'insert' && c.method !== 'update'))).toBe(true);
    expect(supabaseMock.queriesFor('rpc:publish_ace_assignment_cycle')).toHaveLength(0);
  });

  it('renaming a Little clears their member link, like an ACE node does', async () => {
    seed('draft', [draft('d1', 'Amy Tran', { little_member_id: 'm-amy', big_ace_member_id: 'big-april' })]);
    renderWorkspace();
    const input = await screen.findByLabelText('Little name');
    fireEvent.change(input, { target: { value: 'Amy Pham' } });
    fireEvent.blur(input);
    await waitFor(() => expect(callsOf('ace_assignment_drafts', 'update')).toHaveLength(1));
    expect(callsOf('ace_assignment_drafts', 'update')[0].args[0]).toMatchObject({
      little_name: 'Amy Pham',
      little_member_id: null,
    });
  });

  it('a spacing-only edit keeps the member link', async () => {
    seed('draft', [draft('d1', 'Amy Tran', { little_member_id: 'm-amy', big_ace_member_id: 'big-april' })]);
    renderWorkspace();
    const input = await screen.findByLabelText('Little name');
    fireEvent.change(input, { target: { value: 'amy  TRAN' } });
    fireEvent.blur(input);
    await waitFor(() => expect(callsOf('ace_assignment_drafts', 'update')).toHaveLength(1));
    expect(callsOf('ace_assignment_drafts', 'update')[0].args[0]).not.toHaveProperty('little_member_id');
  });

  it('bulk-links only the unique exact match, never the ambiguous Andy Tran', async () => {
    renderWorkspace();
    fireEvent.click(await screen.findByRole('button', { name: 'Link 1 obvious member match' }));
    await waitFor(() => expect(callsOf('ace_assignment_drafts', 'update')).toHaveLength(1));
    expect(callsOf('ace_assignment_drafts', 'update')[0].args[0]).toMatchObject({ little_member_id: 'm-amy' });
    expect(supabaseMock.filtersFor('ace_assignment_drafts')).toContainEqual(['id', 'd2']);
  });
});

describe('locked cycle', () => {
  it('is read-only and cannot publish while a Little has no Big', async () => {
    seed('locked', [draft('d1', 'John Nguyen', { big_ace_member_id: 'big-april' }), draft('d2', 'Amy Tran')]);
    renderWorkspace();
    expect(await screen.findByRole('button', { name: 'Unlock to edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish to ACE tree…' })).toBeDisabled();
    expect(screen.getAllByLabelText('Little name').every((input) => (input as HTMLInputElement).disabled)).toBe(true);
    expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Add a Little…')).not.toBeInTheDocument();
    expect(screen.getByText(/does not publish anything/)).toBeInTheDocument();
  });

  it('publishes once after confirmation, even if the button is clicked twice', async () => {
    seed('locked', [draft('d1', 'John Nguyen', { big_ace_member_id: 'big-april' }), draft('d2', 'Kevin Le', { big_ace_member_id: 'big-emily' })]);
    supabaseMock.setDefault('rpc:publish_ace_assignment_cycle', {
      data: { cycle_id: 'cycle-1', status: 'published', created: 2, total: 2, already_published: false },
      error: null,
    });
    renderWorkspace();
    fireEvent.click(await screen.findByRole('button', { name: 'Publish to ACE tree…' }));
    expect(screen.getByText('This adds 2 Littles to 2 fams on the ACE tree.')).toBeInTheDocument();
    expect(supabaseMock.queriesFor('rpc:publish_ace_assignment_cycle')).toHaveLength(0);

    const confirm = screen.getByRole('button', { name: 'Confirm publish' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(supabaseMock.queriesFor('rpc:publish_ace_assignment_cycle')).toHaveLength(1));
    expect(supabaseMock.queriesFor('rpc:publish_ace_assignment_cycle')[0].calls[0].args[0]).toEqual({ p_cycle_id: 'cycle-1' });
  });
});

describe('Admin → ACE page', () => {
  it('opens the workspace from the Assignments tab and offers to start a cycle when none exists', async () => {
    supabaseMock.reset();
    supabaseMock.setDefault('ace_families', { data: [], error: null });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminAceFamilies />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('tab', { name: 'Families', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ New Fam' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Assignments' }));
    expect(await screen.findByText('Start ACE assignments')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ New Fam' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Families' }));
    expect(screen.getByRole('button', { name: '+ New Fam' })).toBeInTheDocument();
  });
});
