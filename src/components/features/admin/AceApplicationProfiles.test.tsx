/**
 * Admin -> ACE -> Assignments: pasted application answers are shown beside
 * the drafts and never written anywhere. Synthetic data only.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { logAdminActivity } from '../../../data/repos/adminActivity';
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

const HEADERS = [
  'Name (First, Middle Initial, Last)',
  'Preferred Name',
  'UCSD Email',
  'Phone Number',
  'Are You Applying to be an Anh/Chi (Big) or Em (Little)? ',
  'Year?',
  'Gender Identity',
  'How many littles do you plan on picking up?',
  'Gender Preference? ',
  'What are your hobbies?',
  "Is there anyone in VSA who you don't want to be paired with or have problems with?",
  'Gender Preference?  2',
  'What are your hobbies? 2',
  'How introverted/extroverted are you? 2',
  'How introverted/extroverted are you?',
];

const ROWS = [
  ['Ava Q Lin', '', 'alin', '555-0100', 'Anh/Chi (Big)', '3rd', 'Female', '1', 'No preference', 'Secret hobby alpha', 'Ben Ho', '', '', '', '7'],
  ['Eve Ng', '', 'eng', '555-0101', 'Anh/Chi (Big)', '4th', 'Female', '2', 'No preference', 'Secret hobby beta', 'N/A', '', '', '', '6'],
  ['Ben Ho', '', 'bho', '555-0102', 'Em (Little)', '1st', 'Male', '', '', '', '', 'No preference', 'Secret hobby gamma', '5', ''],
  ['Cy Do', '', 'cdo', '555-0103', 'Em (Little)', '2nd Year Transfer', 'Male', '', '', '', '', 'No preference', 'Secret hobby delta', '6', ''],
  ['Zed Unmatched', '', 'zed', '555-0104', 'Em (Little)', '1st', 'Male', '', '', '', '', '', '', '', ''],
];
const PASTE = [HEADERS, ...ROWS].map((row) => row.join('\t')).join('\n');
const PRIVATE_VALUES = ['Secret hobby', '555-01', '@ucsd.edu', 'No preference', 'Female', '2nd Year Transfer'];

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

const aceNode = (id: string, name: string) => ({
  id,
  name,
  family_id: 'fam-1',
  member_id: null,
  parent_member_id: null,
  role_label: 'Big',
  ace_families: { name: 'Test Fam' },
});

function seed() {
  supabaseMock.reset();
  supabaseMock.setDefault('ace_assignment_cycles', {
    data: [{ id: 'cycle-1', academic_year_start: 2026, academic_year_end: 2027, status: 'draft', created_by: null, created_at: '', updated_at: '' }],
    error: null,
  });
  supabaseMock.setDefault('ace_assignment_drafts', {
    data: [draft('d-ben', 'Ben Ho', { big_ace_member_id: 'big-ava' }), draft('d-cy', 'Cy Do')],
    error: null,
  });
  supabaseMock.setDefault('ace_family_members', { data: [aceNode('big-ava', 'Ava Lin'), aceNode('big-eve', 'Eve Ng')], error: null });
  supabaseMock.setDefault('public_members', { data: [], error: null });
  supabaseMock.setDefault('members', { data: [], error: null });
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

const WRITE_METHODS = new Set(['insert', 'update', 'upsert', 'delete']);
const writes = () =>
  supabaseMock
    .queries()
    .filter((query) => query.calls.some((call) => WRITE_METHODS.has(call.method)));

function expectNoPrivateValues(value: unknown) {
  const text = JSON.stringify(value);
  for (const secret of PRIVATE_VALUES) expect(text).not.toContain(secret);
}

async function loadAnswers() {
  fireEvent.click(await screen.findByRole('button', { name: 'Load application answers' }));
  const panel = screen.getByRole('region', { name: 'Application answers' });
  expect(within(panel).getByText(/Application answers stay in this browser tab and are not saved\./)).toBeInTheDocument();
  fireEvent.change(within(panel).getByLabelText('Pasted application responses'), { target: { value: PASTE } });
  fireEvent.click(within(panel).getByRole('button', { name: 'Load answers' }));
  await within(panel).findByText('Unmatched');
  return panel;
}

describe('application answers while sorting', () => {
  let setItem: jest.SpyInstance;
  beforeEach(() => {
    seed();
    (logAdminActivity as jest.Mock).mockClear();
    setItem = jest.spyOn(Storage.prototype, 'setItem');
  });
  afterEach(() => setItem.mockRestore());

  it('shows counts, chips, and advisory warnings on rows', async () => {
    renderWorkspace();
    const panel = await loadAnswers();

    const stat = (label: string) => within(within(panel).getByRole('group', { name: label })).getByRole('definition').textContent;
    expect(stat('Bigs')).toBe('2');
    expect(stat('Littles')).toBe('3');
    expect(stat('Repeats replaced')).toBe('0');
    expect(stat('Unmatched')).toBe('1');
    expect(within(panel).getByRole('list', { name: 'Unmatched applicants' })).toHaveTextContent('Zed Unmatched');

    // Ava asked not to be paired with Ben, and Ben is assigned to her.
    expect(screen.getByText('1 check to review')).toBeInTheDocument();
    // The preflight counts it as a warning, without names, and nothing new blocks Lock.
    expect(screen.getByText('1 pairing names someone the other person asked not to be paired with')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lock assignments' })).toBeEnabled();
    expect(screen.getByText('2nd Year Transfer')).toBeInTheDocument();
    // The Big picker shows Ava's load against her planned capacity.
    expect(screen.getByText('0 on tree · 1 of 1 planned new')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Show answers' })[0]);
    expect(screen.getByText(/Ava Lin asked not to be paired with Ben Ho/)).toBeInTheDocument();
    expect(screen.getByText('Secret hobby alpha')).toBeInTheDocument();
    // Never-read columns are not shown.
    expect(screen.queryByText(/555-01/)).not.toBeInTheDocument();
  });

  it('suggests Bigs for an unassigned Little and picks one through the normal assignment write', async () => {
    renderWorkspace();
    await loadAnswers();

    fireEvent.click(screen.getAllByRole('button', { name: 'Show answers' })[1]);
    // Ava is full (1 of 1) and asked not to have Ben, so Eve is the only suggestion.
    const list = screen.getByRole('list', { name: 'Suggested Bigs for Cy Do' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(within(list).getByRole('button', { name: 'Assign Eve Ng as Big for Cy Do' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    const update = writes()[0];
    expect(update.table).toBe('ace_assignment_drafts');
    // Only the Big choice (plus the repository's own timestamp) is written.
    const patch = update.calls.find((call) => call.method === 'update')?.args[0] as Record<string, unknown>;
    expect(Object.keys(patch).sort()).toEqual(['big_ace_member_id', 'updated_at']);
    expect(patch.big_ace_member_id).toBe('big-eve');
  });

  it('writes nothing from the application: no repository call, activity log, or browser storage carries its data', async () => {
    renderWorkspace();
    await loadAnswers();
    fireEvent.click(screen.getAllByRole('button', { name: 'Show answers' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Assign Eve Ng as Big for Cy Do' }));
    await waitFor(() => expect(writes()).toHaveLength(1));

    for (const query of writes()) expectNoPrivateValues(query.calls);
    expectNoPrivateValues((logAdminActivity as jest.Mock).mock.calls);
    expectNoPrivateValues(setItem.mock.calls);
    // Only the admin-gated POST RPC may receive normalized applicant emails.
    // No application answers, contact fields or emails reach GET query URLs,
    // writes, audit activity, browser storage or unrelated repositories.
    const emailRpcs = supabaseMock.queriesFor('rpc:admin_match_members_by_email');
    expect(emailRpcs).toHaveLength(1);
    expect(emailRpcs[0].calls).toEqual([{
      method: 'rpc',
      args: [{ p_emails: ['bho@ucsd.edu', 'cdo@ucsd.edu', 'zed@ucsd.edu'] }],
    }]);
    const reads = supabaseMock.queries().filter(
      (query) => query.table !== 'rpc:admin_match_members_by_email',
    );
    expectNoPrivateValues(reads);
    expect(supabaseMock.queriesFor('members')).toHaveLength(0);
  });

  it('clearing the answers removes every chip', async () => {
    renderWorkspace();
    const panel = await loadAnswers();
    fireEvent.click(within(panel).getByRole('button', { name: 'Clear answers' }));
    expect(screen.queryByText('1 check to review')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: 'Show answers' })).toHaveLength(0);
  });
});
