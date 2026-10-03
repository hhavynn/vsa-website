/**
 * Admin -> External Events stays available for advanced management: linked rows
 * point back to their Event, and UVSA SoCal can host unmirrored externals too.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { MemoryRouter } from 'react-router-dom';
import AdminExternalEvents from './ExternalEvents';
import { ExternalEvent } from '../../types';
import { makeEvent, makeSchool } from '../../test-utils/uvsaFixtures';

const mockUci = makeSchool({ id: 'uci-id', slug: 'uci', short_name: 'UCI', vsa_name: 'VSA UCI' });
const mockMutateAsync = jest.fn();
const mockDeleteMutateAsync = jest.fn();
const mockState: { events: ExternalEvent[] } = { events: [] };

jest.mock('../../hooks/useExternalEvents', () => ({
  useAdminExternalEvents: () => ({ events: mockState.events, loading: false, refreshEvents: jest.fn() }),
  useUpsertExternalEvent: () => ({ mutateAsync: (...args: unknown[]) => mockMutateAsync(...args), isLoading: false }),
  useDeleteExternalEvent: () => ({ mutateAsync: (...args: unknown[]) => mockDeleteMutateAsync(...args), isLoading: false }),
}));
jest.mock('../../hooks/useUVSASchools', () => ({
  useAdminUVSASchools: () => ({ schools: [mockUci], loading: false, error: null }),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminExternalEvents />
    </MemoryRouter>,
  );

beforeEach(() => {
  mockMutateAsync.mockReset().mockResolvedValue(undefined);
  mockDeleteMutateAsync.mockReset().mockResolvedValue(undefined);
  mockState.events = [];
});

it('shows a Linked Event link on rows mirrored from an Event, and none on unmirrored rows', () => {
  mockState.events = [
    makeEvent({
      id: 'linked',
      title: 'UVSA SoCal Fall Social',
      source_event_id: 'evt-1',
      source_event: { id: 'evt-1', name: 'UVSA SoCal Fall Social' },
      host_type: 'uvsa_socal',
      uvsa_school_id: null,
      uvsa_school: undefined,
    }),
    makeEvent({ id: 'plain', title: 'Mount Jamprov' }),
  ];
  renderPage();

  expect(screen.getByRole('link', { name: /Linked Event: UVSA SoCal Fall Social/ })).toHaveAttribute(
    'href',
    '/admin/events?event=evt-1',
  );
  expect(screen.getAllByRole('link', { name: /Linked Event/ })).toHaveLength(1);
});

it('labels hosts: UVSA SoCal, a school, and a missing school', () => {
  mockState.events = [
    makeEvent({ id: 'a', title: 'A', host_type: 'uvsa_socal', uvsa_school_id: null, uvsa_school: undefined }),
    makeEvent({ id: 'b', title: 'B', uvsa_school: mockUci }),
    makeEvent({ id: 'c', title: 'C', uvsa_school: undefined, uvsa_school_id: null }),
  ];
  renderPage();
  expect(screen.getByText('UVSA SoCal')).toBeInTheDocument();
  expect(screen.getByText('UCI')).toBeInTheDocument();
  expect(screen.getByText('⚠ Host missing')).toBeInTheDocument();
});

it('locks the synced fields on a linked row and sends no joined relations back', async () => {
  mockState.events = [
    makeEvent({
      id: 'linked',
      title: 'Synced Title',
      source_event_id: 'evt-1',
      source_event: { id: 'evt-1', name: 'Synced Title' },
      uvsa_school: mockUci,
      uvsa_school_id: 'uci-id',
    }),
  ];
  renderPage();
  const editBtn = await screen.findByRole('button', { name: /Edit/ });
  fireEvent.click(editBtn);

  const formHeading = await screen.findByText(/^Edit /);
  const form = formHeading.closest('div') as HTMLElement; // eslint-disable-line testing-library/no-node-access
  expect(within(form).getByDisplayValue('Synced Title')).toBeDisabled();
  expect(within(form).getByText(/managed there and re-sync on every save/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Save Event/ }));
  await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
  const payload = mockMutateAsync.mock.calls[0][0];
  expect(payload).not.toHaveProperty('uvsa_school');
  expect(payload).not.toHaveProperty('source_event');
  expect(payload.source_event_id).toBe('evt-1');
});

it('hosts an unmirrored external by UVSA SoCal, clearing the school', async () => {
  mockState.events = [makeEvent({ id: 'plain', title: 'Mount Jamprov', uvsa_school: mockUci, uvsa_school_id: 'uci-id' })];
  renderPage();
  const editBtn = await screen.findByRole('button', { name: /Edit/ });
  fireEvent.click(editBtn);

  const hostSelect = await screen.findByDisplayValue('UCI — VSA UCI');
  await userEvent.selectOptions(hostSelect, 'uvsa_socal');
  fireEvent.click(screen.getByRole('button', { name: /Save Event/ }));

  await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
  expect(mockMutateAsync.mock.calls[0][0]).toMatchObject({ host_type: 'uvsa_socal', uvsa_school_id: null });
});

it('disables deletion of linked mirror rows and directs deletion to Admin Events', async () => {
  mockState.events = [
    makeEvent({
      id: 'linked',
      title: 'Linked Event',
      source_event_id: 'evt-1',
      source_event: { id: 'evt-1', name: 'Linked Event' },
    }),
    makeEvent({ id: 'plain', title: 'Plain Event' }),
  ];
  renderPage();

  const disabledDeleteBtn = screen.getByRole('button', { name: /Cannot delete linked event: Linked Event/i });
  expect(disabledDeleteBtn).toBeDisabled();
  expect(disabledDeleteBtn).toHaveAttribute(
    'title',
    'Linked to a normal event. Delete the event in Admin → Events to remove both.',
  );

  fireEvent.click(disabledDeleteBtn);
  expect(mockDeleteMutateAsync).not.toHaveBeenCalled();

  const enabledDeleteBtn = screen.getByRole('button', { name: /Delete Plain Event/i });
  expect(enabledDeleteBtn).toBeEnabled();
  const confirmSpy = jest.spyOn(window, 'confirm');
  const toastSuccess = jest.spyOn(toast, 'success');
  fireEvent.click(enabledDeleteBtn);
  // A named confirmation dialog, not window.confirm; nothing is deleted yet.
  const dialog = screen.getByRole('alertdialog', { name: 'Delete external event?' });
  expect(within(dialog).getByText(/Plain Event/)).toBeInTheDocument();
  expect(confirmSpy).not.toHaveBeenCalled();
  expect(mockDeleteMutateAsync).not.toHaveBeenCalled();

  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete event' }));
  await waitFor(() => expect(mockDeleteMutateAsync).toHaveBeenCalledWith('plain'));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(toastSuccess).toHaveBeenCalledWith('"Plain Event" deleted');
  confirmSpy.mockRestore();
});

it('keeps the delete dialog open with the error when deleting fails', async () => {
  mockState.events = [makeEvent({ id: 'plain', title: 'Plain Event' })];
  mockDeleteMutateAsync.mockRejectedValue(new Error('boom'));
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const toastError = jest.spyOn(toast, 'error');
  renderPage();

  fireEvent.click(screen.getByRole('button', { name: /Delete Plain Event/i }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete event' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  expect(toastError).toHaveBeenCalledWith('Failed to delete event');
  consoleError.mockRestore();
});

describe('Flyer Image URL on save', () => {
  const FLYER_PLACEHOLDER = 'https://… (optional)';
  const clickEdit = async () => fireEvent.click(await screen.findByRole('button', { name: /Edit/ }));
  const save = () => fireEvent.click(screen.getByRole('button', { name: /Save Event/ }));
  const toastError = jest.spyOn(toast, 'error');

  beforeEach(() => toastError.mockClear());

  it('omits image_url when the flyer is blank on a row without the column', async () => {
    mockState.events = [makeEvent({ id: 'plain', title: 'Mount Jamprov', uvsa_school: mockUci, uvsa_school_id: 'uci-id' })];
    expect('image_url' in mockState.events[0]).toBe(false);
    renderPage();
    await clickEdit();
    save();

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockMutateAsync.mock.calls[0][0]).not.toHaveProperty('image_url');
  });

  it('omits image_url for a new row with a blank flyer', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Add Event/ }));
    await userEvent.type(screen.getByPlaceholderText('e.g. Mount Jamprov'), 'New Night');
    await userEvent.selectOptions(screen.getByDisplayValue('Select a host'), 'uvsa_socal');
    save();

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockMutateAsync.mock.calls[0][0]).not.toHaveProperty('image_url');
  });

  it('includes image_url when a flyer is entered, even if the row lacks the column', async () => {
    mockState.events = [makeEvent({ id: 'plain', title: 'Mount Jamprov', uvsa_school: mockUci, uvsa_school_id: 'uci-id' })];
    renderPage();
    await clickEdit();
    await userEvent.type(screen.getByPlaceholderText(FLYER_PLACEHOLDER), 'https://cdn.example/flyer.webp');
    save();

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockMutateAsync.mock.calls[0][0].image_url).toBe('https://cdn.example/flyer.webp');
  });

  it('sends null when clearing the flyer on a row that already carries image_url', async () => {
    mockState.events = [
      makeEvent({ id: 'plain', title: 'Mount Jamprov', uvsa_school: mockUci, uvsa_school_id: 'uci-id', image_url: 'https://cdn.example/old.webp' }),
    ];
    renderPage();
    await clickEdit();
    await userEvent.clear(screen.getByPlaceholderText(FLYER_PLACEHOLDER));
    save();

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockMutateAsync.mock.calls[0][0]).toHaveProperty('image_url', null);
  });

  it('sends null for an untouched blank flyer when the row already has an image_url key', async () => {
    mockState.events = [makeEvent({ id: 'plain', title: 'Mount Jamprov', uvsa_school: mockUci, uvsa_school_id: 'uci-id', image_url: null })];
    renderPage();
    await clickEdit();
    save();

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockMutateAsync.mock.calls[0][0]).toHaveProperty('image_url', null);
  });

  it.each(['/images/events/x.webp', 'http://cdn.example/x.webp', 'javascript:alert(1)'])(
    'rejects a non-https flyer (%s) on save',
    async bad => {
      mockState.events = [makeEvent({ id: 'plain', title: 'Mount Jamprov', uvsa_school: mockUci, uvsa_school_id: 'uci-id' })];
      renderPage();
      await clickEdit();
      await userEvent.type(screen.getByPlaceholderText(FLYER_PLACEHOLDER), bad);
      save();

      await waitFor(() => expect(toastError).toHaveBeenCalledWith('Flyer Image URL must be an https link.'));
      expect(mockMutateAsync).not.toHaveBeenCalled();
    },
  );

  it('uses consistent flyer copy for linked and standalone rows', async () => {
    mockState.events = [
      makeEvent({ id: 'linked', title: 'Synced', source_event_id: 'evt-1', source_event: { id: 'evt-1', name: 'Synced' }, uvsa_school: mockUci, uvsa_school_id: 'uci-id' }),
    ];
    const { unmount } = renderPage();
    await clickEdit();
    expect(screen.getByPlaceholderText(FLYER_PLACEHOLDER)).toBeDisabled();
    expect(screen.getByText('Flyer comes from the linked event; upload or change it in Admin → Events.')).toBeInTheDocument();
    unmount();

    mockState.events = [makeEvent({ id: 'plain', title: 'Plain', uvsa_school: mockUci, uvsa_school_id: 'uci-id' })];
    renderPage();
    await clickEdit();
    expect(screen.getByPlaceholderText(FLYER_PLACEHOLDER)).toBeEnabled();
    expect(screen.getByText(/Optional\. Paste an https:\/\/ link to the flyer image/)).toBeInTheDocument();
    expect(screen.queryByText(/instead of uploading or embedding flyer media/)).not.toBeInTheDocument();
  });
});
