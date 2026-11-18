import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminMemberRoles from './MemberRoles';
import { buildMemberNameIndex, type MemberOption } from '../../lib/memberLinkMatching';

const fictionalMembers: MemberOption[] = [
  { id: 'member-a', fullName: 'Ada Example', displayName: 'Ada Example · Sixth · Senior', college: 'Sixth', year: 'Senior' },
  { id: 'member-b', fullName: 'Bea Sample', displayName: 'Bea Sample · Muir · Junior', college: 'Muir', year: 'Junior' },
  { id: 'member-c', fullName: 'Bea Sample', displayName: 'Bea Sample · Warren · Sophomore', college: 'Warren', year: 'Sophomore' },
];
const mockDirectory = {
  members: fictionalMembers,
  byId: new Map(fictionalMembers.map((person) => [person.id, person])),
  nameIndex: buildMemberNameIndex(fictionalMembers),
  loading: false,
  error: null,
  refetch: jest.fn(),
};
const mockSources = [
  { id: 'source-a', name: 'Ada Example', role: 'Events Chair', category: 'General Board', cabinet_year_id: 'cabinet-year-2026', member_id: null },
  { id: 'source-b', name: 'Bea Sample', role: 'Intern', category: 'Interns', cabinet_year_id: 'cabinet-year-2026', member_id: null },
];
let mockSourceUnavailable = false;

jest.mock('../../hooks/useCabinetYears', () => ({
  useCabinetYears: () => ({
    cabinetYears: [{ id: 'cabinet-year-2026', start_year: 2026, label: '2026–2027' }],
    loading: false,
    error: null,
  }),
}));
jest.mock('../../hooks/useMemberDirectory', () => ({
  useMemberDirectory: () => mockDirectory,
}));
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: () => ({
    data: mockSources,
    isLoading: false,
    isError: mockSourceUnavailable,
    refetch: jest.fn(),
  }),
}));

function renderPage() {
  render(<MemoryRouter initialEntries={['/admin/member-roles']}><AdminMemberRoles /></MemoryRouter>);
}

beforeEach(() => { mockSourceUnavailable = false; });

it('registers a labelled admin-only role review and parses three independent names', () => {
  renderPage();
  expect(screen.getByRole('heading', { name: 'Role Assignment' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Member names, up to 150 rows/), { target: { value: 'Ada Example, Bea Sample, Cora Example' } });
  fireEvent.click(screen.getByRole('button', { name: 'Parse names' }));
  expect(screen.getByText(/3 inputs · 0 ready for editor/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '1. Ada Example' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '2. Bea Sample' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '3. Cora Example' })).toBeInTheDocument();
  expect(screen.getByText(/Multiple exact candidates/)).toBeInTheDocument();
});

it('requires explicit member and exact source selection before showing a safe editor link', () => {
  renderPage();
  fireEvent.change(screen.getByLabelText(/Member names, up to 150 rows/), { target: { value: 'Ada Example' } });
  fireEvent.click(screen.getByRole('button', { name: 'Parse names' }));
  expect(screen.queryByText('Ready to review in Cabinet')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Confirm canonical VSA member'), { target: { value: 'member-a' } });
  fireEvent.change(screen.getByLabelText('Select existing Board record'), { target: { value: 'source-a' } });
  expect(screen.getByText('Ready to review in Cabinet')).toBeInTheDocument();
  expect(screen.getByText(/0 roles published by this tool/)).toBeInTheDocument();
  const link = screen.getByRole('link', { name: 'Open exact Cabinet record for final review' });
  expect(link).toHaveAttribute('href', '/admin/cabinet?member=source-a');
  expect(link).toHaveAttribute('target', '_blank');
});

it('does not use an Intern as Board, and resets stale selections when switching source roles', () => {
  renderPage();
  fireEvent.change(screen.getByLabelText(/Member names, up to 150 rows/), { target: { value: 'Bea Sample' } });
  fireEvent.click(screen.getByRole('button', { name: 'Parse names' }));
  expect(within(screen.getByLabelText('Select existing Board record')).queryByRole('option', { name: /Intern/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Role category'), { target: { value: 'intern' } });
  expect(screen.queryByRole('heading', { name: '1. Bea Sample' })).not.toBeInTheDocument();
  expect(screen.getByLabelText(/Member names, up to 150 rows/)).toHaveValue('Bea Sample');
});

it('fails closed when published role source cannot be read', () => {
  mockSourceUnavailable = true;
  renderPage();
  fireEvent.change(screen.getByLabelText(/Member names, up to 150 rows/), { target: { value: 'Ada Example' } });
  fireEvent.click(screen.getByRole('button', { name: 'Parse names' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Identity or Cabinet source data is unavailable');
  expect(screen.getByLabelText('Confirm canonical VSA member')).toBeDisabled();
  expect(screen.getByLabelText('Select existing Board record')).toBeDisabled();
  expect(screen.queryByRole('button', { name: /Apply/ })).not.toBeInTheDocument();
});


it('only chooses a single exact member and matching Cabinet row after separate admin clicks', () => {
  renderPage();
  fireEvent.change(screen.getByLabelText(/Member names, up to 150 rows/), {
    target: { value: 'Ada Example' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Parse names' }));

  expect(screen.getByText(/1 inputs · 0 ready for editor/)).toBeInTheDocument();
  const chooseMember = screen.getByRole('button', { name: /Row 1: choose sole exact member candidate for Ada Example/ });
  expect(screen.queryByRole('button', { name: /Row 1: choose sole matching Board record for Ada Example/ })).not.toBeInTheDocument();
  fireEvent.click(chooseMember);
  expect(screen.getByLabelText('Confirm canonical VSA member')).toHaveValue('member-a');
  expect(screen.queryByText('Ready to review in Cabinet')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Row 1: choose sole matching Board record for Ada Example/ }));
  expect(screen.getByLabelText('Select existing Board record')).toHaveValue('source-a');
  expect(screen.getByText('Ready to review in Cabinet')).toBeInTheDocument();
  expect(screen.getByText(/0 roles published by this tool/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Apply/ })).not.toBeInTheDocument();
});

it('never offers an identity shortcut when two canonical members share the exact name', () => {
  renderPage();
  fireEvent.change(screen.getByLabelText(/Member names, up to 150 rows/), {
    target: { value: 'Bea Sample' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Parse names' }));
  expect(screen.getByText(/Multiple exact candidates/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /choose sole exact member candidate/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /choose sole matching/ })).not.toBeInTheDocument();
});

it('never bypasses unavailable source reads using convenience buttons', () => {
  mockSourceUnavailable = true;
  renderPage();
  fireEvent.change(screen.getByLabelText(/Member names, up to 150 rows/), {
    target: { value: 'Ada Example' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Parse names' }));
  expect(screen.queryByRole('button', { name: /Row 1: choose sole exact member candidate for Ada Example/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /choose sole matching/ })).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Identity or Cabinet source data is unavailable');
});
