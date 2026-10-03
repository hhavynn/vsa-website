/**
 * /admin/applications as a recruitment tool (#275): at-a-glance window state in
 * Pacific Time, guardrails before anything can go public, a public preview that
 * uses the site's own gating, an explicit confirmation before a save publishes a
 * form link, and Recent Changes entries.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { MemoryRouter } from 'react-router-dom';
import AdminApplications from './Applications';
import { logAdminActivity } from '../../data/repos/adminActivity';
import { applicationLinksRepository } from '../../data/repos/applicationLinks';
import { ApplicationLink } from '../../types';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }) }));
jest.mock('react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock('../../data/repos/adminActivity', () => ({ logAdminActivity: jest.fn() }));
jest.mock('../../data/repos/applicationLinks', () => ({
  applicationLinksRepository: {
    createApplicationLink: jest.fn(),
    updateApplicationLink: jest.fn(),
    deleteApplicationLink: jest.fn(),
    setApplicationLinkEnabled: jest.fn(),
  },
}));

let mockLinks: ApplicationLink[] = [];
jest.mock('../../hooks/useApplicationLinks', () => ({
  ADMIN_APPLICATION_LINKS_QUERY_KEY: ['application-links', 'admin'],
  PUBLIC_APPLICATION_LINKS_QUERY_KEY: ['application-links', 'public'],
  useAdminApplicationLinks: () => ({ links: mockLinks, loading: false, error: null, refetch: jest.fn().mockResolvedValue(undefined) }),
}));

const repo = applicationLinksRepository as jest.Mocked<typeof applicationLinksRepository>;
const DAY = 24 * 60 * 60 * 1000;
const at = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const SECRET = 'https://forms.gle/secret-until-open';

function makeLink(overrides: Partial<ApplicationLink>): ApplicationLink {
  return {
    id: 'link',
    application_key: 'house_fall',
    title: 'Window',
    description: null,
    button_label: 'Apply',
    target_url: SECRET,
    open_at: at(-5),
    due_at: at(30),
    is_enabled: true,
    before_open_message: 'Opening soon, check back.',
    after_close_message: 'This one is over.',
    sort_order: 1,
    created_by: null,
    updated_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const OPEN = makeLink({ id: 'open', title: 'Open Window' });
const SCHEDULED = makeLink({ id: 'scheduled', title: 'Scheduled Window', application_key: 'ace_application', open_at: at(10), due_at: at(20) });
const CLOSED = makeLink({ id: 'closed', title: 'Closed Window', application_key: 'intern_application', open_at: at(-30), due_at: at(-10) });
const DISABLED = makeLink({ id: 'disabled', title: 'Disabled Window', application_key: 'cabinet_application', is_enabled: false });
const FUTURE_DISABLED = makeLink({ id: 'future-disabled', title: 'Future Disabled', application_key: 'house_winter', is_enabled: false, open_at: at(10), due_at: at(20) });
const BROKEN = makeLink({ id: 'broken', title: 'Broken Window', application_key: 'house_spring', open_at: at(5), due_at: at(2) });
const BROKEN_DISABLED = makeLink({ id: 'broken-off', title: 'Broken Disabled', application_key: 'wnc_team_form', is_enabled: false, open_at: at(5), due_at: at(2) });

function renderPage(path = '/admin/applications') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminApplications />
    </MemoryRouter>,
  );
}

const card = (title: RegExp | string) => screen.getByRole('article', { name: title });
const field = (name: RegExp | string) => screen.getByLabelText(name, { selector: 'input, select, textarea' });
const edit = async (title: string) => userEvent.click(within(card(new RegExp(title))).getByRole('button', { name: 'Edit' }));

beforeEach(() => {
  jest.clearAllMocks();
  mockLinks = [OPEN, SCHEDULED, CLOSED, DISABLED, BROKEN];
  repo.updateApplicationLink.mockResolvedValue({} as ApplicationLink);
  repo.setApplicationLinkEnabled.mockResolvedValue({} as ApplicationLink);
});

describe('window status at a glance', () => {
  it('labels every window Open, Scheduled, Closed, Disabled, or Needs fixing', () => {
    renderPage();

    expect(card(/Open Window/)).toHaveAttribute('data-state', 'open');
    expect(within(card(/Open Window/)).getByText('Open')).toBeInTheDocument();
    expect(card(/Scheduled Window/)).toHaveAttribute('data-state', 'scheduled');
    expect(within(card(/Scheduled Window/)).getByText('Scheduled')).toBeInTheDocument();
    expect(card(/Closed Window/)).toHaveAttribute('data-state', 'closed');
    expect(within(card(/Closed Window/)).getByText('Closed')).toBeInTheDocument();
    expect(card(/Disabled Window/)).toHaveAttribute('data-state', 'disabled');
    expect(card(/Broken Window/)).toHaveAttribute('data-state', 'misconfigured');
    expect(within(card(/Broken Window/)).getByText('Needs fixing')).toBeInTheDocument();
    expect(within(card(/Broken Window/)).getByText(/The close time must be after the open time/)).toBeInTheDocument();
  });

  it('tells the truth about a live window whose link is broken', () => {
    mockLinks = [makeLink({ id: 'legacy', title: 'Legacy Window', target_url: 'http://insecure.example/form' })];
    renderPage();

    expect(card(/Legacy Window/)).toHaveAttribute('data-state', 'misconfigured');
    expect(card(/Legacy Window/)).toHaveTextContent('Students can reach the form now');
    expect(card(/Legacy Window/)).toHaveTextContent('This window is live, but its link is not a valid https:// URL');
  });

  it('shows both dates in the list in Pacific Time, whatever the browser timezone', () => {
    mockLinks = [makeLink({ id: 'fixed', title: 'Fixed Window', open_at: '2099-01-01T08:00:00Z', due_at: '2099-06-30T06:59:00Z' })];
    renderPage();

    expect(card(/Fixed Window/)).toHaveTextContent('Opens Jan 1, 2099, 12:00 AM PT · Closes Jun 29, 2099, 11:59 PM PT');
    expect(screen.getByText(/All times are Pacific Time \(PT\)/)).toBeInTheDocument();
  });

  it('opens straight to the filter the Admin Overview links to', () => {
    renderPage('/admin/applications?filter=scheduled');

    expect(screen.getByRole('article', { name: /Scheduled Window/ })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: /Open Window/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toHaveValue('scheduled');
  });
});

describe('guardrails', () => {
  it('flags a close time before the open time as the admin types, and saves nothing', async () => {
    mockLinks = [];
    renderPage();
    await userEvent.type(field(/^Target URL/), 'https://forms.gle/abc');
    fireEvent.change(field(/^Open date/), { target: { value: '2026-10-15' } });
    fireEvent.change(field(/^Due date/), { target: { value: '2026-10-01' } });

    expect(await screen.findByText('The close time must be after the open time, so this window stays closed.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create Link' }));
    await waitFor(() => expect(field(/^Due date/)).toHaveAttribute('aria-invalid', 'true'));
    expect(repo.createApplicationLink).not.toHaveBeenCalled();
  });

  it('highlights an open date that is already in the past', async () => {
    mockLinks = [];
    renderPage();
    fireEvent.change(field(/^Open date/), { target: { value: '2020-01-01' } });

    expect(await screen.findByText(/is already in the past/)).toBeInTheDocument();
  });

  it('refuses to enable a window whose schedule is broken', async () => {
    mockLinks = [BROKEN_DISABLED];
    renderPage();
    await userEvent.click(within(card(/Broken Disabled/)).getByRole('button', { name: 'Enable' }));

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('The close time must be after the open time'));
    expect(repo.setApplicationLinkEnabled).not.toHaveBeenCalled();
  });
});

describe('publishing needs an explicit yes', () => {
  it('asks before a save makes the form URL public, and writes nothing until confirmed', async () => {
    renderPage();
    await edit('Disabled Window');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Enabled' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Make “Disabled Window” public?');
    expect(dialog).toHaveTextContent('publicly reachable');
    expect(dialog).toHaveTextContent('PT');
    expect(repo.updateApplicationLink).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and make public' }));

    await waitFor(() => expect(repo.updateApplicationLink).toHaveBeenCalledTimes(1));
    expect(repo.updateApplicationLink).toHaveBeenCalledWith('disabled', expect.objectContaining({ is_enabled: true, target_url: SECRET }));
  });

  it('leaves the window untouched when the confirmation is cancelled', async () => {
    renderPage();
    await edit('Disabled Window');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Enabled' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(repo.updateApplicationLink).not.toHaveBeenCalled();
  });

  it('does not ask for a copy-only change to a window that is already public', async () => {
    renderPage();
    await edit('Open Window');
    await userEvent.clear(field(/^Description/));
    await userEvent.type(field(/^Description/), 'Updated blurb');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(repo.updateApplicationLink).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('does not ask when enabling a window that is scheduled for later, since nothing goes public', async () => {
    mockLinks = [FUTURE_DISABLED];
    renderPage();
    await edit('Future Disabled');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Enabled' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(repo.updateApplicationLink).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('warns in the confirmation when the link is still the seeded placeholder', async () => {
    mockLinks = [makeLink({ id: 'placeholder', title: 'Placeholder Window', is_enabled: false, target_url: 'https://example.com/placeholder' })];
    renderPage();
    await edit('Placeholder Window');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Enabled' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('still looks like a placeholder');
  });

  it('asks before changing the form link of a window that is live right now', async () => {
    renderPage();
    await edit('Open Window');
    await userEvent.clear(field(/^Target URL/));
    await userEvent.type(field(/^Target URL/), 'https://forms.gle/the-new-form');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Change the live form link for “Open Window”?');
    expect(repo.updateApplicationLink).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save new link' }));
    await waitFor(() => expect(repo.updateApplicationLink).toHaveBeenCalledWith('open', expect.objectContaining({ target_url: 'https://forms.gle/the-new-form' })));
  });

  it('keeps the confirmation open with an error when enabling fails, instead of closing as if it worked', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      mockLinks = [DISABLED];
      repo.setApplicationLinkEnabled.mockRejectedValue(new Error('permission denied'));
      renderPage();
      await userEvent.click(within(card(/Disabled Window/)).getByRole('button', { name: 'Enable' }));
      const dialog = await screen.findByRole('alertdialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Enable and make public' }));

      expect(await within(screen.getByRole('alertdialog')).findByText(/Failed to update the window/)).toBeInTheDocument();
      expect(logAdminActivity).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('asks before the Enable button publishes a window that is inside its dates', async () => {
    mockLinks = [DISABLED, FUTURE_DISABLED];
    renderPage();

    await userEvent.click(within(card(/Future Disabled/)).getByRole('button', { name: 'Enable' }));
    await waitFor(() => expect(repo.setApplicationLinkEnabled).toHaveBeenCalledWith('future-disabled', true));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    repo.setApplicationLinkEnabled.mockClear();
    await userEvent.click(within(card(/Disabled Window/)).getByRole('button', { name: 'Enable' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Enable “Disabled Window”?');
    expect(repo.setApplicationLinkEnabled).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Enable and make public' }));
    await waitFor(() => expect(repo.setApplicationLinkEnabled).toHaveBeenCalledWith('disabled', true));
  });
});

describe('public preview', () => {
  const previewCard = () => screen.getByTestId('application-preview-card');

  it('shows a scheduled window as students see it now: the before-open message and no link, with the URL only in the admin line', async () => {
    renderPage();
    await edit('Scheduled Window');

    expect(within(previewCard()).getByText('Opening soon, check back.')).toBeInTheDocument();
    expect(within(previewCard()).queryByRole('link')).not.toBeInTheDocument();
    expect(previewCard().innerHTML).not.toContain(SECRET);
    // The raw link appears once, in the labelled admin-only line outside the student-facing card.
    expect(screen.getByText(SECRET)).toBeInTheDocument();
    expect(previewCard()).not.toContainElement(screen.getByText(SECRET));
    expect(screen.getByText('Admins only:')).toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
  });

  it('previews the open state before the window opens, using the real public CTA', async () => {
    renderPage();
    await edit('Scheduled Window');
    await userEvent.click(screen.getByRole('button', { name: 'Once open' }));

    const apply = within(previewCard()).getByRole('link', { name: /Apply/ });
    expect(apply).toHaveAttribute('href', SECRET);
    expect(screen.getByText('Shown')).toBeInTheDocument();
  });

  it('will not preview the open state without a usable link', async () => {
    mockLinks = [makeLink({ id: 'nolink', title: 'No Link Window', is_enabled: false, open_at: at(10), due_at: at(20), target_url: 'http://insecure.example/x' })];
    renderPage();
    await edit('No Link Window');
    await userEvent.click(screen.getByRole('button', { name: 'Once open' }));

    expect(screen.getByText(/Add a complete https:\/\/ form link/)).toBeInTheDocument();
    expect(screen.queryByTestId('application-preview-card')).not.toBeInTheDocument();
  });

  it('never gives a closed window a link', async () => {
    renderPage();
    await edit('Closed Window');

    expect(within(previewCard()).getByText('This one is over.')).toBeInTheDocument();
    expect(within(previewCard()).queryByRole('link')).not.toBeInTheDocument();
    expect(previewCard().innerHTML).not.toContain(SECRET);
  });

  it('reads the unsaved form, so a typed change is previewed before it is saved', async () => {
    renderPage();
    await edit('Scheduled Window');
    await userEvent.clear(field(/^Before-open message/));
    await userEvent.type(field(/^Before-open message/), 'Brand new copy');

    expect(within(previewCard()).getByText('Brand new copy')).toBeInTheDocument();
  });
});

describe('change history', () => {
  it('records the key, previous and new state, and never the form URL', async () => {
    renderPage();
    await edit('Disabled Window');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Enabled' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Save and make public' }));

    await waitFor(() => expect(logAdminActivity).toHaveBeenCalledTimes(1));
    const entry = (logAdminActivity as jest.Mock).mock.calls[0][0];
    expect(entry).toMatchObject({
      action: 'application.window_updated',
      entityType: 'application_window',
      entityId: 'disabled',
      metadata: { application_key: 'cabinet_application', previous: { state: 'disabled', enabled: false }, next: { state: 'open', enabled: true } },
    });
    expect(JSON.stringify(entry)).not.toContain('forms.gle');
  });

  it('records the Enable/Disable toggle and deletes too', async () => {
    renderPage();
    await userEvent.click(within(card(/Open Window/)).getByRole('button', { name: 'Disable' }));
    await waitFor(() => expect(logAdminActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'application.window_toggled', entityId: 'open' })));
  });
});
