import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminInterns from './Interns';
import { internCohortRepository } from '../../data/repos/internCohort';
import { memberLookupRepository } from '../../data/repos/memberLookup';
import { InternCohortCycle, InternCohortDraft } from '../../lib/internCohort';

jest.mock('react-hot-toast', () => {
  const toast = Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() });
  return { __esModule: true, default: toast, Toaster: () => null };
});
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin-1' } }) }));
jest.mock('../../hooks/useCabinetYears', () => ({
  useCabinetYears: () => ({
    cabinetYears: [{ id: 'cy-2026', label: '2026-2027', start_year: 2026, end_year: 2027 }],
    loading: false,
    error: null,
  }),
}));
jest.mock('../../data/repos/internCohort', () => ({
  internCohortRepository: {
    listCycles: jest.fn(),
    getCycle: jest.fn(),
    getDrafts: jest.fn(),
    listMentorOptions: jest.fn(),
    createCycle: jest.fn(),
    addDrafts: jest.fn(),
    updateDraft: jest.fn(),
    reorder: jest.fn(),
    removeDraft: jest.fn(),
    lockCycle: jest.fn(),
    reopenCycle: jest.fn(),
    publishCycle: jest.fn(),
    deleteCycle: jest.fn(),
  },
}));

jest.mock('../../data/repos/memberLookup', () => ({
  memberLookupRepository: { listMemberDirectory: jest.fn(), searchMembers: jest.fn() },
}));

const repo = internCohortRepository as jest.Mocked<typeof internCohortRepository>;
const lookup = memberLookupRepository as jest.Mocked<typeof memberLookupRepository>;

const cycle = (status: InternCohortCycle['status']): InternCohortCycle => ({
  id: 'c1', academic_year_start: 2026, academic_year_end: 2027, cabinet_year_id: 'cy-2026', status,
  created_by: null, locked_at: null, published_at: null, created_at: '', updated_at: '',
});
const draft = (id: string, overrides: Partial<InternCohortDraft>): InternCohortDraft => ({
  id, cycle_id: 'c1', name: id, member_id: null, mentor_cabinet_member_id: null, role_or_track: null, caption: null,
  internal_notes: null, display_order: 0, published_cabinet_member_id: null, created_at: `2026-10-01T00:00:0${id.length % 9}Z`,
  updated_at: '', ...overrides,
});

async function openCohort(status: InternCohortCycle['status'], drafts: InternCohortDraft[]) {
  repo.listCycles.mockResolvedValue([cycle(status)]);
  repo.getDrafts.mockResolvedValue(drafts);
  repo.listMentorOptions.mockResolvedValue([{ id: 'cm-emily', name: 'Emily Nguyen', role: 'Events' }]);
  lookup.searchMembers.mockResolvedValue([]);
  lookup.listMemberDirectory.mockResolvedValue([
    { id: 'm-sarah', fullName: 'Sarah Nguyen', college: 'Muir', year: 'Second Year', displayName: 'Sarah Nguyen · Muir · Second Year' },
  ]);
  render(<MemoryRouter><AdminInterns /></MemoryRouter>);
  const open = await screen.findByRole('button', { name: 'Open' });
  await userEvent.click(open);
  await screen.findByRole('heading', { name: /Intern Cohort/, level: 2 });
  await settle();
}

/** Lets the page's mount-time loads (members, mentors, interns) finish inside act. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => jest.clearAllMocks());

it('summarizes the cohort and shows a linked intern with member, mentor, and track', async () => {
  await openCohort('draft', [
    draft('Sarah Nguyen', { member_id: 'm-sarah', mentor_cabinet_member_id: 'cm-emily', role_or_track: 'Events / Operations', display_order: 0 }),
    draft('Zed Unknown', { display_order: 1 }),
  ]);

  expect(screen.getByText('2 accepted · 1 linked · 1 need review')).toBeInTheDocument();
  const preflight = within(screen.getByLabelText('Preflight'));
  expect(preflight.getByText(/1 member link unresolved/)).toBeInTheDocument();
  expect(preflight.getByText(/1 missing mentor/)).toBeInTheDocument();
  expect(screen.getByText(/✅ Sarah Nguyen · Member: Sarah Nguyen · Muir · Second Year · Mentor: Emily Nguyen · Events · Track: Events \/ Operations/)).toBeInTheDocument();
});

it('saves a mentor choice on the draft', async () => {
  await openCohort('draft', [draft('Sarah Nguyen', { member_id: 'm-sarah' })]);

  await userEvent.selectOptions(screen.getByLabelText('Mentor (optional)'), 'cm-emily');

  expect(repo.updateDraft).toHaveBeenCalledWith('c1', 'Sarah Nguyen', { mentor_cabinet_member_id: 'cm-emily' });
  await settle();
  expect(screen.getByLabelText('Mentor (optional)')).toBeEnabled();
});

it('offers an exact-name member to link but never links it by itself', async () => {
  await openCohort('draft', [draft('Sarah Nguyen', {})]);

  expect(await screen.findByText('Suggested match')).toBeInTheDocument();
  expect(repo.updateDraft).not.toHaveBeenCalled();
  repo.updateDraft.mockResolvedValue();
  await userEvent.click(screen.getByRole('button', { name: /Link to Sarah Nguyen/ }));
  expect(repo.updateDraft).toHaveBeenCalledWith('c1', 'Sarah Nguyen', { member_id: 'm-sarah' });
});

it('does not guess a near-miss name', async () => {
  await openCohort('draft', [draft('Sara Nguyn', {})]);

  expect(screen.queryByText('Suggested match')).not.toBeInTheDocument();
  expect(screen.getByText(/Not linked/)).toBeInTheDocument();
  expect(repo.updateDraft).not.toHaveBeenCalled();
});

it('blocks locking when one member is linked twice', async () => {
  await openCohort('draft', [
    draft('Sarah Nguyen', { member_id: 'm-sarah', display_order: 0 }),
    draft('Sarah N', { member_id: 'm-sarah', display_order: 1 }),
  ]);

  expect(screen.getByRole('button', { name: 'Lock cohort' })).toBeDisabled();
  expect(screen.getByText(/duplicate canonical member/)).toBeInTheDocument();
});

it('makes a locked cohort read-only and requires confirmation to publish', async () => {
  await openCohort('locked', [draft('Sarah Nguyen', { member_id: 'm-sarah' })]);

  expect(screen.getByLabelText('Name')).toBeDisabled();
  expect(screen.queryByLabelText('Pasted intern names')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Publish cohort' })).toBeDisabled();

  await userEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('button', { name: 'Publish cohort' })).toBeEnabled();
  expect(repo.publishCycle).not.toHaveBeenCalled();
});
