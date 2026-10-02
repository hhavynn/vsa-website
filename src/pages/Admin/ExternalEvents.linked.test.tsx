/**
 * Admin -> External Events stays available for advanced management: linked rows
 * point back to their Event, and UVSA SoCal can host unmirrored externals too.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminExternalEvents from './ExternalEvents';
import { ExternalEvent } from '../../types';
import { makeEvent, makeSchool } from '../../test-utils/uvsaFixtures';

const mockUci = makeSchool({ id: 'uci-id', slug: 'uci', short_name: 'UCI', vsa_name: 'VSA UCI' });
const mockMutateAsync = jest.fn();
const mockState: { events: ExternalEvent[] } = { events: [] };

jest.mock('../../hooks/useExternalEvents', () => ({
  useAdminExternalEvents: () => ({ events: mockState.events, loading: false, refreshEvents: jest.fn() }),
  useUpsertExternalEvent: () => ({ mutateAsync: (...args: unknown[]) => mockMutateAsync(...args), isLoading: false }),
  useDeleteExternalEvent: () => ({ mutateAsync: jest.fn(), isLoading: false }),
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
