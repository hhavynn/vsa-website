/**
 * Admin -> ACE -> Assignments: private drafting, lock, preflight, publish.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminAceFamilies from '../../../pages/Admin/AceFamilies';
import { AceAssignmentsWorkspace } from './AceAssignmentsWorkspace';
import { supabaseMock } from '../../../test-utils/supabaseMock';

jest.mock('../../../data/repos/adminActivity', () => ({
  logAdminActivity: jest.fn(),
  adminActivityRepository: { record: jest.fn(), list: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../../../lib/supabase', () => ({
  get supabase() {
    return require('../../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const cycle = (status: string, over: Record<string, unknown> = {}) => ({
  id: 'cycle-1',
  academic_year_start: 2026,
  academic_year_end: 2027,
  status,
  ...over,
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

const aceNode = (id: string, name: string, familyId: string, familyName: string, memberId: string | null = null) => ({
  id,
  name,
  family_id: familyId,
  member_id: memberId,
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

function seed(status: string, drafts: ReturnType<typeof draft>[], cycleOver: Record<string, unknown> = {}) {
  supabaseMock.reset();
  supabaseMock.setDefault('ace_assignment_cycles', { data: [cycle(status, cycleOver)], error: null });
  supabaseMock.setDefault('ace_assignment_cycle_events', { data: [], error: null });
  supabaseMock.setDefault('rpc:admin_event_attendance_readiness', {
    data: { events: [], total_events: 0, truncated: false, checked_at: '2026-10-30T12:00:00Z' },
    error: null,
  });
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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AceAssignmentsWorkspace />
      </MemoryRouter>
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
    expect(screen.getAllByText('BLOCKER').length).toBeGreaterThan(0);
    expect(screen.getByText(/Not Ready/)).toBeInTheDocument();
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

describe('filters, bulk actions and activity', () => {
  const { logAdminActivity } = jest.requireMock('../../../data/repos/adminActivity');

  beforeEach(() => {
    logAdminActivity.mockClear();
    seed('draft', [
      draft('d1', 'John Nguyen', { big_ace_member_id: 'big-april' }),
      draft('d2', 'Amy Tran'),
      draft('d3', 'Andy Tran'),
    ]);
  });

  it('shows filter chips with counts and filters the rows', async () => {
    renderWorkspace();
    const unassigned = await screen.findByRole('button', { name: /Unassigned Little\s*2/ });
    expect(screen.getByRole('button', { name: /Possible match\s*2/ })).toBeInTheDocument();
    fireEvent.click(unassigned);
    await waitFor(() => expect(screen.getAllByLabelText('Little name')).toHaveLength(2));
    expect(unassigned).toHaveAttribute('aria-pressed', 'true');
  });

  it('bulk link skips the ambiguous Andy Tran and links only the exact match', async () => {
    renderWorkspace();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select Amy Tran' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Andy Tran' }));
    fireEvent.click(screen.getByRole('button', { name: 'Link selected exact matches' }));
    await waitFor(() => expect(callsOf('ace_assignment_drafts', 'update')).toHaveLength(1));
    expect(callsOf('ace_assignment_drafts', 'update')[0].args[0]).toMatchObject({ little_member_id: 'm-amy' });
    expect(supabaseMock.filtersFor('ace_assignment_drafts')).not.toContainEqual(['id', 'd3']);
    await waitFor(() => expect(logAdminActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'ace.bulk_linked' })));
  });

  it('records clearing a Big with an undo spec that restores it', async () => {
    renderWorkspace();
    fireEvent.click(await screen.findByRole('button', { name: 'Clear Big for John Nguyen' }));
    await waitFor(() => expect(callsOf('ace_assignment_drafts', 'update')).toHaveLength(1));
    await waitFor(() => expect(logAdminActivity).toHaveBeenCalled());
    const entry = logAdminActivity.mock.calls.find(([draft]: [{ action: string }]) => draft.action === 'ace.assignment_changed')[0];
    expect(entry.summary).toBe("Changed John Nguyen's Big: April Pham → Unassigned");
    expect(entry.metadata.undo).toEqual({ kind: 'ace_draft_big', target: { draftId: 'd1' }, before: 'big-april', after: null });
  });

  it('records locking in the activity log', async () => {
    renderWorkspace();
    fireEvent.click(await screen.findByRole('button', { name: 'Lock assignments' }));
    await waitFor(() => expect(logAdminActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'ace.cycle_locked' })));
  });

  it('shows the year, the progress header, and an obvious next step after locking', async () => {
    renderWorkspace();
    expect(await screen.findByText('2026–27')).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: '2026–27 ACE progress' })).toHaveTextContent('Assignments 1 / 3');
    fireEvent.click(await screen.findByRole('button', { name: 'Lock assignments' }));
    expect(await screen.findByText('Assignments locked')).toBeInTheDocument();
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

describe('pre-sort attendance eligibility', () => {
  const readinessEvent = (id: string) => ({
    id,
    name: `Sample event ${id}`,
    date: '2026-10-10T19:00:00Z',
    event_type: 'gbm',
    points: 1,
    is_published: true,
    academic_term_id: 'fall',
    term_label: 'Fall 2026',
    credits: 1,
    scoring_credits: 1,
    last_credit_at: null,
    jobs: 0,
    latest_job: null,
    open_review_rows: 0,
    reconciled_at: '2026-10-20T00:00:00Z',
    reconciliation_pending_rows: 0,
    attestation: null,
    house_credits: [],
  });

  function seedPolicy(status: string) {
    seed(
      status,
      [
        draft('d1', 'Amy Tran', { little_member_id: 'm-amy', big_ace_member_id: 'big-april' }),
        draft('d2', 'Kevin Le', { little_member_id: 'm-kevin', big_ace_member_id: 'big-april' }),
      ],
      { little_min_events: 4, big_min_events: 3 },
    );
    supabaseMock.setDefault('ace_family_members', {
      data: [aceNode('big-april', 'April Pham', 'fam-sweatpants', 'Sweatpants', 'm-april')],
      error: null,
    });
    supabaseMock.setDefault('ace_assignment_cycle_events', {
      data: ['e1', 'e2', 'e3', 'e4'].map((event_id) => ({ event_id })),
      error: null,
    });
    supabaseMock.setDefault('rpc:admin_event_attendance_readiness', {
      data: { events: ['e1', 'e2', 'e3', 'e4'].map(readinessEvent), total_events: 4, truncated: false, checked_at: '2026-10-30T12:00:00Z' },
      error: null,
    });
    const rows = (member: string, events: string[]) => events.map((event_id) => ({ member_id: member, event_id }));
    supabaseMock.setDefault('member_event_attendance', {
      data: [...rows('m-amy', ['e1', 'e2']), ...rows('m-april', ['e1', 'e2', 'e3']), ...rows('m-kevin', ['e1', 'e2', 'e3', 'e4'])],
      error: null,
    });
  }

  it('names who is short as a warning, and Lock stays available', async () => {
    seedPolicy('draft');
    renderWorkspace();
    expect(await screen.findByText('1 Little below the 4-event minimum')).toBeInTheDocument();
    expect(screen.getByText('Amy Tran (2 of 4)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lock assignments' })).toBeEnabled();
    expect(screen.queryByText(/Big below the 3-event minimum/)).not.toBeInTheDocument();
    expect(supabaseMock.queriesFor('member_event_attendance').every((q) => q.calls.every((c) => ['select', 'in', 'order', 'range'].includes(c.method)))).toBe(true);
  });

  it('does not block Publish, and the confirmation says who is short', async () => {
    seedPolicy('locked');
    renderWorkspace();
    await screen.findByText('1 Little below the 4-event minimum');
    const publish = screen.getByRole('button', { name: 'Publish to ACE tree…' });
    expect(publish).toBeEnabled();
    fireEvent.click(publish);
    expect(screen.getByText(/1 person is below the saved attendance minimums/)).toBeInTheDocument();
  });

  it('warns, without blocking, when no minimums are saved yet', async () => {
    seed('draft', [draft('d1', 'Amy Tran', { little_member_id: 'm-amy', big_ace_member_id: 'big-april' })]);
    renderWorkspace();
    expect(await screen.findByText('Attendance minimums are not saved for this cycle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lock assignments' })).toBeEnabled();
    expect(supabaseMock.queriesFor('member_event_attendance')).toHaveLength(0);
  });
});

describe('Admin → ACE page', () => {
  it('opens the workspace from the Assignments tab and offers to start a cycle when none exists', async () => {
    supabaseMock.reset();
    supabaseMock.setDefault('ace_families', { data: [], error: null });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
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
