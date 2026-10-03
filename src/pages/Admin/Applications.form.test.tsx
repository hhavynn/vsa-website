import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { MemoryRouter } from 'react-router-dom';
import AdminApplications from './Applications';
import { DatabaseError } from '../../data/errors';
import { applicationLinksRepository } from '../../data/repos/applicationLinks';
import { hasUnsavedChanges } from '../../hooks/useUnsavedChangesGuard';
import { ApplicationLink } from '../../types';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }) }));
jest.mock('react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock('../../data/repos/applicationLinks', () => ({
  applicationLinksRepository: {
    createApplicationLink: jest.fn(),
    updateApplicationLink: jest.fn(),
    deleteApplicationLink: jest.fn(),
    setApplicationLinkEnabled: jest.fn(),
  },
}));

const mockRefetch = jest.fn().mockResolvedValue(undefined);
let mockLinks: ApplicationLink[] = [];
jest.mock('../../hooks/useApplicationLinks', () => ({
  ADMIN_APPLICATION_LINKS_QUERY_KEY: ['application-links', 'admin'],
  PUBLIC_APPLICATION_LINKS_QUERY_KEY: ['application-links', 'public'],
  useAdminApplicationLinks: () => ({ links: mockLinks, loading: false, error: null, refetch: mockRefetch }),
}));

const repo = applicationLinksRepository as jest.Mocked<typeof applicationLinksRepository>;

function liveLink(): ApplicationLink {
  return {
    id: 'link-1',
    application_key: 'house_fall',
    title: 'House Fall',
    description: null,
    button_label: 'Apply',
    target_url: 'https://forms.gle/house',
    open_at: '2020-01-01T08:00:00Z',
    due_at: '2099-01-01T08:00:00Z',
    is_enabled: true,
    before_open_message: null,
    after_close_message: null,
    sort_order: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  } as ApplicationLink;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/applications']}>
      <AdminApplications />
    </MemoryRouter>,
  );
}

const field = (name: RegExp | string) => screen.getByLabelText(name, { selector: 'input, select, textarea' });

async function fillSchedule(url: string) {
  await userEvent.clear(field(/^Target URL/));
  await userEvent.type(field(/^Target URL/), url);
  fireEvent.change(field(/^Open date/), { target: { value: '2026-10-01' } });
  fireEvent.change(field(/^Due date/), { target: { value: '2026-10-15' } });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLinks = [];
});

describe('Applications link form', () => {
  it('blocks a bad submit with inline errors on the fields and writes nothing', async () => {
    renderPage();
    await userEvent.type(field(/^Target URL/), 'http://insecure.example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Create Link' }));

    await waitFor(() => expect(field(/^Target URL/)).toHaveAttribute('aria-invalid', 'true'));
    expect(field(/^Target URL/)).toHaveAccessibleDescription(expect.stringContaining('Target URL must start with https://'));
    expect(field(/^Open date/)).toHaveAttribute('aria-invalid', 'true');
    expect(field(/^Due date/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('There are 3 problems to fix:')).toBeInTheDocument();
    expect(repo.createApplicationLink).not.toHaveBeenCalled();
  });

  it('rejects a due time that is not after the open time', async () => {
    renderPage();
    await fillSchedule('https://forms.gle/abc');
    fireEvent.change(field(/^Due date/), { target: { value: '2026-09-30' } });
    await userEvent.click(screen.getByRole('button', { name: 'Create Link' }));
    await waitFor(() => expect(field(/^Due date/)).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getAllByText('Due date/time must be after the open date/time').length).toBeGreaterThan(0);
    expect(repo.createApplicationLink).not.toHaveBeenCalled();
  });

  it('sends the exact repository payload, toasts, clears the form, and leaves no unsaved-changes guard', async () => {
    repo.createApplicationLink.mockResolvedValue({} as ApplicationLink);
    renderPage();
    await fillSchedule('  https://forms.gle/abc  ');
    await waitFor(() => expect(hasUnsavedChanges()).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: 'Create Link' }));

    await waitFor(() => expect(repo.createApplicationLink).toHaveBeenCalledTimes(1));
    expect(repo.createApplicationLink).toHaveBeenCalledWith({
      application_key: 'ace_application',
      title: 'ACE Application',
      description: null,
      button_label: 'Apply Now',
      target_url: 'https://forms.gle/abc',
      open_at: expect.stringMatching(/^2026-10-01T07:00:00/),
      due_at: expect.stringMatching(/^2026-10-16T06:59:00/),
      is_enabled: false,
      before_open_message: 'ACE applications will be released later.',
      after_close_message: 'ACE applications have closed. Check back next year.',
      sort_order: 0,
    });
    expect(toast.success).toHaveBeenCalledWith('Application link created');
    await waitFor(() => expect(field(/^Target URL/)).toHaveValue(''));
    expect(hasUnsavedChanges()).toBe(false);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('puts a server window-constraint rejection on the due date field and keeps the values', async () => {
    repo.createApplicationLink.mockRejectedValue(new DatabaseError('violates check constraint "application_links_window_check"', '23514'));
    renderPage();
    await fillSchedule('https://forms.gle/abc');
    await userEvent.click(screen.getByRole('button', { name: 'Create Link' }));

    await waitFor(() => expect(field(/^Due date/)).toHaveAttribute('aria-invalid', 'true'));
    expect(field(/^Due date/)).toHaveAccessibleDescription(expect.stringContaining('Due date/time must be after the open date/time'));
    expect(field(/^Target URL/)).toHaveValue('https://forms.gle/abc');
    expect(toast.error).toHaveBeenCalled();
    expect(screen.getByText(/Not saved/)).toBeInTheDocument();
  });

  it('asks before saving a Google Drive link, and only saves once confirmed', async () => {
    repo.createApplicationLink.mockResolvedValue({} as ApplicationLink);
    renderPage();
    await fillSchedule('https://drive.google.com/file/d/abc/view');
    await userEvent.click(screen.getByRole('button', { name: 'Create Link' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/shared publicly and safe to expose/)).toBeInTheDocument();
    expect(repo.createApplicationLink).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'It is public, save' }));
    await waitFor(() => expect(repo.createApplicationLink).toHaveBeenCalledTimes(1));
  });
});

describe('Applications delete', () => {
  it('names the live consequence for an open window and offers Disable instead', async () => {
    mockLinks = [liveLink()];
    repo.deleteApplicationLink.mockResolvedValue(undefined);
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Delete “House Fall”?')).toBeInTheDocument();
    expect(within(dialog).getByText(/open right now: the Apply button disappears from the public pages immediately/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Disable it instead/ })).toBeInTheDocument();
    expect(repo.deleteApplicationLink).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete link' }));
    await waitFor(() => expect(repo.deleteApplicationLink).toHaveBeenCalledWith('link-1'));
    expect(toast.success).toHaveBeenCalledWith('Application link deleted');
  });
});
