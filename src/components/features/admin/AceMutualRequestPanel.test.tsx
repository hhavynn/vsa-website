import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AceNodeRef, ImportResolution } from '../../../lib/aceAssignments';
import { AceMutualRequestPanel } from './AceMutualRequestPanel';

const mockMatchMembersByEmail = jest.fn();
jest.mock('../../../data/repos/memberLookup', () => ({
  memberLookupRepository: { matchMembersByEmail: (emails: string[]) => mockMatchMembersByEmail(emails) },
}));
jest.mock('react-hot-toast', () => Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() }));

// Synthetic responses only.
const HEADER =
  'Timestamp\tEmail Address\tName (First, Middle Initial, Last)\tYear\tCollege\tFam (only big fill this out)\tUCSD Email\tPreferred Name\tPronouns\tGender Identity\tPhone Number \tFacebook Profile Link\tInstagram Username \tWhich ACE Eligible VSA Events Have You Attended?\tAre you mutually requesting a Big or a Little?\tWho are you Mutually Requesting?';
const row = (time: string, name: string, fam: string, ucsd: string, wants: string, request: string) =>
  [time, 'personal@example.com', name, 'Second', 'Muir', fam, ucsd, '', '', '', '555-0100', '', '', '', wants, request].join('\t');
const PASTE = [
  HEADER,
  row('10/01/2026 10:00:00', 'Wren I Halloway', 'Fam Moss', 'whalloway', 'Little', 'Tamsin Vale & Orrin Pike'),
  row('10/01/2026 11:00:00', 'Tamsin Vale', 'Im a little', 'tvale', 'Big', 'Im a little, requesting Wren Haloway to be my big'),
  row('10/01/2026 12:00:00', 'Orrin Pike', 'Im a little', 'opike', 'Big', 'Wren Halloway (Im requesting a big)'),
  row('10/01/2026 13:00:00', 'Bao Lark', 'Im a little', 'blark', 'Big', 'Someone Unknown'),
].join('\n');

const nodes: AceNodeRef[] = [
  { id: 'node-wren', name: 'Wren Halloway', familyId: 'f1', familyName: 'Fam Moss', memberId: null, parentId: null, roleLabel: null },
];

function setup(existingNames: string[] = []) {
  const onImport = jest.fn<Promise<void>, [ImportResolution]>().mockResolvedValue();
  render(<AceMutualRequestPanel nodes={nodes} existingNames={existingNames} onImport={onImport} onClose={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Pasted mutual request responses'), { target: { value: PASTE } });
  return { onImport };
}

const section = (name: RegExp) => screen.getByRole('region', { name });

beforeEach(() => {
  mockMatchMembersByEmail.mockReset();
  mockMatchMembersByEmail.mockResolvedValue(
    new Map([['tvale@ucsd.edu', [{ id: 'member-tamsin', fullName: 'Tamsin Vale', college: null, year: null, displayName: 'Tamsin Vale' }]]]),
  );
});

it('classifies the paste, takes the chair’s confirmation, and adds confirmed pairs through onImport', async () => {
  const { onImport } = setup();

  expect(screen.getByTestId('mutual-summary')).toHaveTextContent('4 people · 1 Big · 3 Littles');
  expect(within(section(/Confirmed pairs/)).getByText('Orrin Pike')).toBeInTheDocument();
  expect(within(section(/Confirmed pairs/)).queryByText('Tamsin Vale')).not.toBeInTheDocument();
  expect(within(section(/Unresolved names/)).getByText(/Someone Unknown/)).toBeInTheDocument();
  expect(within(section(/One-sided/)).getByText('Wren Halloway')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add 1 confirmed pair to draft' })).toBeEnabled();

  const possible = section(/Possible matches/);
  expect(within(possible).getByText('“Wren Haloway”')).toBeInTheDocument();
  fireEvent.click(within(possible).getByRole('button', { name: 'Same person' }));
  expect(within(possible).getByRole('button', { name: 'Same person' })).toHaveAttribute('aria-pressed', 'true');

  expect(within(section(/Confirmed pairs/)).getByText('Tamsin Vale')).toBeInTheDocument();
  expect(within(section(/One-sided/)).getByText('None.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add 2 confirmed pairs to draft' }));

  await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
  expect(mockMatchMembersByEmail).toHaveBeenCalledWith(['tvale@ucsd.edu', 'opike@ucsd.edu']);
  expect(onImport.mock.calls[0][0]).toEqual({
    seeds: [
      { little_name: 'Tamsin Vale', little_member_id: 'member-tamsin', big_ace_member_id: 'node-wren', notes: null },
      { little_name: 'Orrin Pike', little_member_id: null, big_ace_member_id: 'node-wren', notes: null },
    ],
    emailLinked: 1,
    bigMatched: 2,
    bigUnresolved: 0,
  });
  expect(JSON.stringify(onImport.mock.calls[0][0])).not.toMatch(/@|555-0100/);
});

it('rejecting a possible match moves it to unresolved', () => {
  setup();
  fireEvent.click(within(section(/Possible matches/)).getByRole('button', { name: 'Not them' }));
  expect(within(section(/Unresolved names/)).getByText(/rejected by the chair/)).toBeInTheDocument();
});

it('skips Littles already in the draft and says so', async () => {
  const { onImport } = setup(['Orrin Pike']);
  expect(screen.getByText('1 Little already in the draft will be skipped.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add 0 confirmed pairs to draft' })).toBeDisabled();
  fireEvent.click(within(section(/Possible matches/)).getByRole('button', { name: 'Same person' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add 1 confirmed pair to draft' }));
  await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
  expect(onImport.mock.calls[0][0].seeds.map((seed) => seed.little_name)).toEqual(['Tamsin Vale']);
});


it('loads a local TSV mutual form without writing drafts or reading contacts into a database', async () => {
  setup();
  fireEvent.change(screen.getByLabelText('Pasted mutual request responses'), { target: { value: '' } });
  const file = new File([PASTE], 'mutual-responses.tsv', { type: 'text/tab-separated-values' });
  fireEvent.change(screen.getByLabelText('Upload mutual request CSV or TSV'), { target: { files: [file] } });
  await waitFor(() => expect(screen.getByTestId('mutual-summary')).toHaveTextContent('4 people · 1 Big · 3 Littles'));
  expect(screen.getByRole('button', { name: 'Add 1 confirmed pair to draft' })).toBeEnabled();
  expect(mockMatchMembersByEmail).not.toHaveBeenCalled();
});

it('supports quoted CSV export and resets stale spelling approvals when the file changes', async () => {
  setup();
  const possible = section(/Possible matches/);
  fireEvent.click(within(possible).getByRole('button', { name: 'Same person' }));
  expect(within(possible).getByRole('button', { name: 'Same person' })).toHaveAttribute('aria-pressed', 'true');
  const csv = PASTE.split('\\n')
    .map((line) => line.split('\\t').map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\\n');
  fireEvent.change(screen.getByLabelText('Upload mutual request CSV or TSV'), {
    target: { files: [new File([csv], 'mutual-responses.CSV', { type: 'text/csv' })] },
  });
  await waitFor(() => expect(within(section(/Possible matches/)).getByRole('button', { name: 'Same person' })).toHaveAttribute('aria-pressed', 'false'));
  expect(screen.getByTestId('mutual-summary')).toHaveTextContent('4 people · 1 Big · 3 Littles');
});

it('rejects .xlsx and oversized exports without erasing an existing paste', async () => {
  setup();
  fireEvent.change(screen.getByLabelText('Upload mutual request CSV or TSV'), {
    target: { files: [new File(['binary'], 'mutual.xlsx')] },
  });
  expect(await screen.findByRole('alert')).toHaveTextContent(/export the Form Responses tab as CSV first/i);
  expect(screen.getByTestId('mutual-summary')).toHaveTextContent('4 people · 1 Big · 3 Littles');
});
