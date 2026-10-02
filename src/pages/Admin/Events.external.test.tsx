/**
 * Admin -> Events: Event Type = External Event reveals the UVSA fields and
 * keeps exactly one linked UVSA Network listing in step with the event.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminEvents from './Events';
import { makeEvent, makeSchool } from '../../test-utils/uvsaFixtures';

const mockSchools = [
  makeSchool({ id: 'ucsd-id', slug: 'ucsd', short_name: 'UCSD', vsa_name: 'UCSD VSA' }),
  makeSchool({ id: 'uci-id', slug: 'uci', short_name: 'UCI', vsa_name: 'VSA UCI', logo_url: null }),
  makeSchool({ id: 'old-id', slug: 'old', short_name: 'OLD', vsa_name: 'OLD VSA', is_active: false }),
];

const baseEvent = {
  description: 'desc',
  date: '2026-10-25T00:00:00Z',
  start_time: null,
  end_time: null,
  end_date: null,
  location: 'Irvine',
  points: 4,
  check_in_form_url: '',
  image_url: null,
  thumbnail_url: null,
  is_code_expired: false,
  is_published: true,
  academic_term_id: 'term-1',
  interest_counts: null,
};
const mockEvents = [
  { ...baseEvent, id: 'evt-ext', name: 'UVSA SoCal Fall Social', event_type: 'external_event' },
  { ...baseEvent, id: 'evt-nohost', name: 'Orphan External', event_type: 'external_event' },
  { ...baseEvent, id: 'evt-gbm', name: 'GBM 1', event_type: 'gbm' },
];
const mockListings: unknown[] = [];

const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockApplySyncPlan = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: (...args: unknown[]) => {
        mockInsert(...args);
        return { select: () => ({ single: () => Promise.resolve({ data: { id: 'evt-new' }, error: null }) }) };
      },
      update: (...args: unknown[]) => {
        mockUpdate(...args);
        return { eq: () => Promise.resolve({ error: null }) };
      },
    }),
    storage: { from: () => ({}) },
  },
}));
jest.mock('../../hooks/useEvents', () => ({ useEvents: () => ({ events: mockEvents, refreshEvents: jest.fn() }) }));
jest.mock('../../hooks/useAcademicTerms', () => ({
  useAcademicTerms: () => ({ terms: [], loading: false, error: null, refreshTerms: jest.fn() }),
}));
jest.mock('../../hooks/useEventRecap', () => ({ useEventRecapEventIds: () => ({ recapEventIds: new Set<string>() }) }));
jest.mock('../../hooks/useExternalEvents', () => ({
  useAdminExternalEvents: () => ({ events: mockListings, loading: false, error: null, refreshEvents: jest.fn() }),
}));
jest.mock('../../hooks/useUVSASchools', () => ({
  useUVSASchools: () => ({ schools: mockSchools.filter((school) => school.is_active), loading: false, error: null }),
}));
jest.mock('../../components/features/admin/EventRecapEditor', () => ({ EventRecapEditor: () => null }));
jest.mock('../../components/features/admin/ManualCheckIn', () => ({ ManualCheckIn: () => null }));
jest.mock('../../data/repos/events', () => ({
  // Plain functions: CRA's resetMocks would wipe jest.fn() implementations.
  eventsRepository: { getCheckInCode: () => Promise.resolve(''), setCheckInCode: () => Promise.resolve() },
}));
jest.mock('../../data/repos/externalEvents', () => ({
  externalEventsRepository: { applySyncPlan: (...args: unknown[]) => mockApplySyncPlan(...args) },
}));
jest.mock('../../data/repos/academicTerms', () => ({
  academicTermsRepository: { ensureTermForDate: () => Promise.resolve({ id: 'term-1' }) },
}));

function renderEvents() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AdminEvents />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const listingFor = (eventId: string, overrides = {}) =>
  makeEvent({
    id: `listing-${eventId}`,
    source_event_id: eventId,
    uvsa_school_id: 'uci-id',
    uvsa_school: mockSchools[1],
    show_on_network: true,
    status: 'upcoming',
    rsvp_url: 'https://rsvp.example/old',
    ...overrides,
  });

beforeEach(() => {
  mockListings.length = 0;
  mockInsert.mockClear();
  mockUpdate.mockClear();
  mockApplySyncPlan.mockReset().mockResolvedValue(undefined);
});

// Submit the form directly so the component's own validation is what's under test.
async function submitForm() {
  fireEvent.submit(screen.getByLabelText(/Event Type/).closest('form') as HTMLFormElement); // eslint-disable-line testing-library/no-node-access
  // Let the async save chain finish so its state updates land inside act.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function fillCreateForm(user: typeof userEvent, type: string) {
  await user.type(screen.getByPlaceholderText('Spring GBM'), 'Fall Social');
  await user.type(screen.getByPlaceholderText('Price Center Ballroom'), 'Irvine');
  await user.type(screen.getByPlaceholderText('Describe the event.'), 'A social night.');
  const date = document.querySelector('input[type="date"]') as HTMLInputElement; // eslint-disable-line testing-library/no-node-access
  await user.type(date, '2026-10-24');
  await user.selectOptions(screen.getByLabelText(/Event Type/), type);
}

describe('Create Event', () => {
  it('reveals External Event Details only for the External Event type', async () => {
    const user = userEvent;
    renderEvents();

    expect(screen.queryByText('External Event Details')).not.toBeInTheDocument();
    for (const type of ['gbm', 'mixer', 'vcn', 'other']) {
      await user.selectOptions(screen.getByLabelText(/Event Type/), type);
      expect(screen.queryByText('External Event Details')).not.toBeInTheDocument();
    }

    await user.selectOptions(screen.getByLabelText(/Event Type/), 'external_event');
    expect(screen.getByText('External Event Details')).toBeInTheDocument();
    expect(screen.getByLabelText(/Host \/ Organizer/)).toBeInTheDocument();
    expect(screen.getByLabelText('RSVP / Tickets')).toBeInTheDocument();
    expect(screen.getByLabelText('Event Info')).toBeInTheDocument();
    expect(screen.getByLabelText('Instagram Post')).toBeInTheDocument();
    expect(screen.getByLabelText('UCSD Ride Form')).toBeInTheDocument();
    expect(screen.getByLabelText('Ride Info')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Show on UVSA Network/ })).toBeChecked();
  });

  it('offers UVSA SoCal then only the active schools as hosts', async () => {
    const user = userEvent;
    renderEvents();
    await user.selectOptions(screen.getByLabelText(/Event Type/), 'external_event');

    const options = within(screen.getByLabelText(/Host \/ Organizer/)).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Choose a host', 'UVSA SoCal', '────────────', 'UCSD — UCSD VSA', 'UCI — VSA UCI']);
  });

  it('shows the chosen school host with its logo fallback and inherited social links', async () => {
    const user = userEvent;
    renderEvents();
    await user.selectOptions(screen.getByLabelText(/Event Type/), 'external_event');
    await user.selectOptions(screen.getByLabelText(/Host \/ Organizer/), 'uci-id');

    expect(screen.getByText('VSA UCI')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Instagram ↗' })).toHaveAttribute('href', mockSchools[1].instagram_url);
    expect(screen.getByRole('link', { name: 'Linktree ↗' })).toHaveAttribute('href', mockSchools[1].linktree_url);
    expect(screen.getByRole('link', { name: 'Website ↗' })).toHaveAttribute('href', mockSchools[1].website_url);
  });

  it('creates the event and exactly one linked listing for a school host', async () => {
    const user = userEvent;
    renderEvents();
    await fillCreateForm(user, 'external_event');
    await user.selectOptions(screen.getByLabelText(/Host \/ Organizer/), 'uci-id');
    await user.type(screen.getByLabelText('RSVP / Tickets'), 'https://rsvp.example/fall');
    await submitForm();

    await waitFor(() => expect(mockApplySyncPlan).toHaveBeenCalledTimes(1));
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const [eventId, plan] = mockApplySyncPlan.mock.calls[0];
    expect(eventId).toBe('evt-new');
    expect(plan).toMatchObject({
      action: 'upsert',
      payload: {
        title: 'Fall Social',
        date: '2026-10-24',
        location: 'Irvine',
        description: 'A social night.',
        host_type: 'school',
        uvsa_school_id: 'uci-id',
        rsvp_url: 'https://rsvp.example/fall',
        status: 'upcoming',
      },
    });
  });

  it('keeps uvsa_school_id null for a UVSA SoCal-hosted event', async () => {
    const user = userEvent;
    renderEvents();
    await fillCreateForm(user, 'external_event');
    await user.selectOptions(screen.getByLabelText(/Host \/ Organizer/), 'uvsa_socal');
    expect(screen.getByText('UVSA Southern California')).toBeInTheDocument();
    await submitForm();

    await waitFor(() => expect(mockApplySyncPlan).toHaveBeenCalledTimes(1));
    expect(mockApplySyncPlan.mock.calls[0][1]).toMatchObject({
      payload: { host_type: 'uvsa_socal', uvsa_school_id: null },
    });
  });

  it('refuses to create a school-hosted external without a host, and writes nothing', async () => {
    const user = userEvent;
    renderEvents();
    await fillCreateForm(user, 'external_event');
    await submitForm();

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockApplySyncPlan).not.toHaveBeenCalled();
  });

  it('creates a normal event with no listing work', async () => {
    const user = userEvent;
    renderEvents();
    await fillCreateForm(user, 'gbm');
    await submitForm();

    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1));
    expect(mockApplySyncPlan).not.toHaveBeenCalled();
  });

  it('previews organizer, logo and links without creating or updating any rows', async () => {
    const user = userEvent;
    renderEvents();
    await fillCreateForm(user, 'external_event');
    await user.selectOptions(screen.getByLabelText(/Host \/ Organizer/), 'uci-id');
    await user.type(screen.getByLabelText('RSVP / Tickets'), 'https://rsvp.example/fall');
    await user.type(screen.getByLabelText('UCSD Ride Form'), 'https://forms.example/ride');
    await user.click(screen.getByRole('button', { name: /Preview/ }));

    const dialog = await screen.findByRole('dialog');
    // The public components render inside the preview iframe; pick the placement
    // explicitly since the default depends on today's date.
    const frame = () => within((screen.getByTitle(/Public preview of/) as HTMLIFrameElement).contentDocument!.body);
    await user.click(within(dialog).getByRole('button', { name: 'Next up' }));
    expect(frame().getByText('Hosted by')).toBeInTheDocument();
    expect(frame().getByText('VSA UCI')).toBeInTheDocument();
    expect(frame().getByRole('link', { name: /RSVP \/ Tickets/ })).toHaveAttribute('href', 'https://rsvp.example/fall');
    expect(frame().getByRole('link', { name: /UCSD Ride Form/ })).toHaveAttribute('href', 'https://forms.example/ride');
    // The UVSA Network placement draws the same card /uvsa-network does.
    await user.click(within(dialog).getByRole('button', { name: 'UVSA Network' }));
    expect(frame().getByRole('heading', { name: 'Fall Social' })).toBeInTheDocument();

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockApplySyncPlan).not.toHaveBeenCalled();
  });
});

describe('Manage Events', () => {
  async function openManage(user: typeof userEvent) {
    const manageBtn = await screen.findByRole('button', { name: /Manage/i });
    await user.click(manageBtn);
  }

  async function openEditor(user: typeof userEvent, index: number) {
    const editButtons = await screen.findAllByRole('button', { name: 'Edit' });
    fireEvent.click(editButtons[index]);
  }

  it('labels external events with their host, and flags a missing host', async () => {
    mockListings.push(
      listingFor('evt-ext', { host_type: 'uvsa_socal', uvsa_school_id: null, uvsa_school: undefined }),
    );
    const user = userEvent;
    renderEvents();
    await openManage(user);

    expect(await screen.findByText('External · UVSA SoCal')).toBeInTheDocument();
    // evt-nohost has no listing at all.
    expect(screen.getByText('⚠ Host missing')).toBeInTheDocument();
    expect(screen.queryByText(/External · UCI/)).not.toBeInTheDocument();
  });

  it('loads the linked fields on edit and syncs them instead of creating a second listing', async () => {
    mockListings.push(listingFor('evt-ext'));
    const user = userEvent;
    renderEvents();
    await openManage(user);
    await openEditor(user, 0);

    const rsvpInput = await screen.findByLabelText('RSVP / Tickets');
    expect(rsvpInput).toHaveValue('https://rsvp.example/old');
    expect(screen.getByLabelText(/Host \/ Organizer/)).toHaveValue('uci-id');

    await user.selectOptions(screen.getByLabelText(/Host \/ Organizer/), 'uvsa_socal');
    await submitForm();

    await waitFor(() => expect(mockApplySyncPlan).toHaveBeenCalledTimes(1));
    const [eventId, plan] = mockApplySyncPlan.mock.calls[0];
    expect(eventId).toBe('evt-ext');
    expect(plan).toMatchObject({
      action: 'upsert',
      payload: { host_type: 'uvsa_socal', uvsa_school_id: null, rsvp_url: 'https://rsvp.example/old' },
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('warns, then hides rather than deletes, when an event stops being External', async () => {
    mockListings.push(listingFor('evt-ext'));
    const user = userEvent;
    renderEvents();
    await openManage(user);
    await openEditor(user, 0);
    await screen.findByDisplayValue('UVSA SoCal Fall Social');
    expect(screen.queryByText(/currently appears on the UVSA Network/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Event Type/), 'gbm');
    expect(screen.queryByText('External Event Details')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('This event currently appears on the UVSA Network.');
    expect(screen.getByRole('alert')).toHaveTextContent('Changing its type will hide the linked external listing.');

    await submitForm();
    await waitFor(() => expect(mockApplySyncPlan).toHaveBeenCalledTimes(1));
    expect(mockApplySyncPlan.mock.calls[0][1]).toEqual({ action: 'hide' });
  });

  it('does not warn for a normal event that was never on the network', async () => {
    const user = userEvent;
    renderEvents();
    await openManage(user);
    await openEditor(user, 2);
    await screen.findByDisplayValue('GBM 1');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('External Event Details')).not.toBeInTheDocument();
  });
});
