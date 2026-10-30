/**
 * House Parent member links (Admin -> Houses -> Profiles & Images). Linked
 * parents show their member; unlinked ones say "Needs review" and offer only an
 * exact-name suggestion, including "Tim Huynh" for "Timothy (Tim) Huynh".
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { HouseParentLinks, suggestHouseParentMember } from './HouseParentLinks';
import { houseParentsRepository, HouseParentLink } from '../../../data/repos/houseParents';
import { memberLookupRepository } from '../../../data/repos/memberLookup';
import { houseParentNameVariants } from '../../../lib/housePlacementImport';
import type { MemberOption } from '../../../lib/memberLinkMatching';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../../data/repos/houseParents', () => ({
  houseParentsRepository: { listForYear: jest.fn(), setMember: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../../../data/repos/memberLookup', () => ({
  memberLookupRepository: { findMemberById: jest.fn(), listMemberDirectory: jest.fn(), searchMembers: jest.fn().mockResolvedValue([]) },
}));

const parentsRepo = houseParentsRepository as jest.Mocked<typeof houseParentsRepository>;
const lookup = memberLookupRepository as jest.Mocked<typeof memberLookupRepository>;

const option = (id: string, fullName: string): MemberOption => ({ id, fullName, college: null, year: null, displayName: fullName });
const parent = (id: string, house: string, order: number, name: string, memberId: string | null, note: string | null = null): HouseParentLink => ({
  id, house_profile_id: `p-${house}`, display_name: name, member_id: memberId, review_note: note, display_order: order,
  created_at: '', updated_at: '', houseLabel: house, houseDisplayOrder: 0,
});

function renderLinks() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <HouseParentLinks selectedYear={2026} />
    </QueryClientProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

it('expands a nickname into both exact names to search', () => {
  expect(houseParentNameVariants('Timothy (Tim) Huynh')).toEqual(['Timothy Huynh', 'Tim Huynh']);
  expect(houseParentNameVariants('Kent Nguyen')).toEqual(['Kent Nguyen']);
});

it('suggests only exact-name matches and flags several as review', () => {
  expect(suggestHouseParentMember('Timothy (Tim) Huynh', [option('m-tim', 'Tim Huynh')])).toMatchObject({ kind: 'recommended', members: [{ id: 'm-tim' }] });
  expect(suggestHouseParentMember('Timothy (Tim) Huynh', [option('m-1', 'Timothy Huynh'), option('m-2', 'Tim Huynh')])).toMatchObject({ kind: 'review' });
  expect(suggestHouseParentMember('Kent Nguyen', [option('m-k', 'Kent Nguyenn')])).toBeNull();
});

it('shows linked House Parents and flags the ones that need review', async () => {
  parentsRepo.listForYear.mockResolvedValue([
    parent('hp1', 'Pinkie Pie', 0, 'Ingyin Moh', 'm-ingyin'),
    parent('hp2', 'Pinkie Pie', 1, 'Martin Dang', null, 'No member record has this exact name. Link one by hand.'),
  ]);
  lookup.findMemberById.mockResolvedValue(option('m-ingyin', 'Ingyin Moh'));
  lookup.listMemberDirectory.mockResolvedValue([option('m-ingyin', 'Ingyin Moh'), option('m-martin', 'Martin Dang')]);
  renderLinks();

  const rows = await screen.findAllByTestId('house-parent-link');
  expect(rows[0]).toHaveTextContent('Ingyin Moh');
  expect(rows[0]).toHaveTextContent('Pinkie Pie · Linked');
  expect(rows[1]).toHaveTextContent('Needs review — No member record has this exact name.');
  expect(await screen.findByText('1 House Parent needs review.')).toBeInTheDocument();
  expect(parentsRepo.listForYear).toHaveBeenCalledWith(2026);
  expect(await within(rows[1]).findByRole('button', { name: 'Link to Martin Dang' })).toBeInTheDocument();
  expect(within(rows[0]).queryByRole('button', { name: /^Link to/ })).not.toBeInTheDocument();
});

it('links a member only when the admin chooses one', async () => {
  parentsRepo.listForYear.mockResolvedValue([parent('hp2', 'Pinkie Pie', 1, 'Martin Dang', null)]);
  lookup.listMemberDirectory.mockResolvedValue([option('m-martin', 'Martin Dang')]);
  renderLinks();
  const row = (await screen.findAllByTestId('house-parent-link'))[0];
  expect(parentsRepo.setMember).not.toHaveBeenCalled();
  const accept = await within(row).findByRole('button', { name: 'Link to Martin Dang' });
  await userEvent.click(accept);
  await waitFor(() => expect(parentsRepo.setMember).toHaveBeenCalledWith('hp2', 'm-martin'));
});


it('filters same-year House Parent review queue by status and House without editing memberships', async () => {
  parentsRepo.listForYear.mockResolvedValue([
    parent('hp1', 'Pinkie Pie', 0, 'Ada Example', 'm-ada'),
    parent('hp2', 'Rarity', 1, 'Bea Sample', null),
    parent('hp3', 'Rarity', 2, 'Cai Sample', 'missing-id'),
  ]);
  lookup.listMemberDirectory.mockResolvedValue([
    option('m-ada', 'Ada Example'),
    option('m-bea-1', 'Bea Sample'),
    option('m-bea-2', 'Bea Sample'),
  ]);
  renderLinks();
  await screen.findByText('2 House Parents need review.');
  expect(screen.getByRole('option', { name: /Ambiguous \(1\)/ })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: /Duplicate \/ stale link \(1\)/ })).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('Filter House Parent links by status'), 'ambiguous');
  expect(screen.getAllByTestId('house-parent-link')).toHaveLength(1);
  expect(screen.getByText('Ambiguous identity')).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('Filter House Parent links by House'), 'p-Pinkie Pie');
  expect(screen.queryAllByTestId('house-parent-link')).toHaveLength(0);
  expect(parentsRepo.setMember).not.toHaveBeenCalled();
});

it('fails closed when the canonical member directory is unavailable', async () => {
  parentsRepo.listForYear.mockResolvedValue([parent('hp1', 'Pinkie Pie', 0, 'Ada Example', 'm-ada')]);
  lookup.listMemberDirectory.mockRejectedValue(new Error('offline'));
  renderLinks();
  expect(await screen.findByRole('alert')).toHaveTextContent('Member directory unavailable');
  expect(screen.queryByText('Every House Parent link is verified.')).not.toBeInTheDocument();
  const row = screen.getByTestId('house-parent-link');
  expect(within(row).getByRole('button', { name: 'Change' })).toBeDisabled();
  expect(parentsRepo.setMember).not.toHaveBeenCalled();
});
