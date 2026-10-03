import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { MemoryRouter } from 'react-router-dom';
import AdminResources from './Resources';
import { resourceLinksRepository } from '../../data/repos/resourceLinks';
import { ResourceLink } from '../../types';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }) }));
jest.mock('react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock('../../data/repos/resourceLinks', () => ({
  RESOURCE_LINK_CATEGORIES: ['Marketing', 'Templates'],
  resourceLinksRepository: { setArchived: jest.fn(), delete: jest.fn(), create: jest.fn(), update: jest.fn(), markVerified: jest.fn() },
}));

const mockRefetch = jest.fn().mockResolvedValue(undefined);
let mockResources: ResourceLink[] = [];
jest.mock('../../hooks/useResourceLinks', () => ({
  RESOURCE_LINKS_QUERY_KEY: ['resource-links', 'admin'],
  useResourceLinks: () => ({ resources: mockResources, loading: false, error: null, refetch: mockRefetch }),
}));

const repo = resourceLinksRepository as jest.Mocked<typeof resourceLinksRepository>;

function resource(id: string, title: string, overrides: Partial<ResourceLink> = {}): ResourceLink {
  return {
    id,
    title,
    description: null,
    url: `https://drive.google.com/${id}`,
    category: 'Marketing',
    role: null,
    program: null,
    workflow: null,
    academic_year_start: null,
    academic_year_end: null,
    is_current: true,
    is_archived: false,
    visibility: 'admin_only',
    owner_role: null,
    last_verified_at: null,
    created_by: null,
    updated_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/resources']}>
      <AdminResources />
    </MemoryRouter>,
  );
}

const pick = async (title: string) => userEvent.click(screen.getAllByLabelText(`Select ${title}`)[0]);

beforeEach(() => {
  jest.clearAllMocks();
  mockResources = [resource('a', 'Alpha'), resource('b', 'Bravo'), resource('c', 'Charlie')];
});

describe('Resources bulk archive / restore', () => {
  it('previews exactly what changes and writes nothing until confirmed', async () => {
    renderPage();
    await pick('Alpha');
    await pick('Bravo');
    expect(screen.getByText('2 resources selected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Archive…' }));
    const list = screen.getByRole('list', { name: 'Items that will change' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getAllByText('Active → Archived')).toHaveLength(2);
    expect(screen.getByText('2 hand-picked resources.')).toBeInTheDocument();
    expect(repo.setArchived).not.toHaveBeenCalled();
  });

  it('skips resources already in the target state, with a reason', async () => {
    mockResources = [resource('a', 'Alpha'), resource('z', 'Zulu', { is_archived: true, is_current: false })];
    renderPage();
    await userEvent.selectOptions(screen.getByDisplayValue('Current'), 'all');
    await pick('Alpha');
    await pick('Zulu');
    await userEvent.click(screen.getByRole('button', { name: 'Archive…' }));

    const list = screen.getByRole('list', { name: 'Items that will change' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Zulu — Already archived.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive 1' })).toBeEnabled();
  });

  it('archives with the same repository call a single archive uses, then refetches and confirms', async () => {
    repo.setArchived.mockResolvedValue({} as ResourceLink);
    renderPage();
    await pick('Alpha');
    await pick('Bravo');
    await userEvent.click(screen.getByRole('button', { name: 'Archive…' }));
    await userEvent.click(screen.getByRole('button', { name: 'Archive 2' }));

    expect(await screen.findByText('Archived 2 resources.')).toBeInTheDocument();
    expect(repo.setArchived).toHaveBeenCalledTimes(2);
    expect(repo.setArchived).toHaveBeenCalledWith('a', true);
    expect(repo.setArchived).toHaveBeenCalledWith('b', true);
    expect(toast.success).toHaveBeenCalledWith('Archived 2 resources');
    await waitFor(() => expect(mockRefetch).toHaveBeenCalled());
  });

  it('restores archived resources with is_archived false', async () => {
    mockResources = [resource('z', 'Zulu', { is_archived: true, is_current: false })];
    repo.setArchived.mockResolvedValue({} as ResourceLink);
    renderPage();
    await userEvent.selectOptions(screen.getByDisplayValue('Current'), 'all');
    await pick('Zulu');
    await userEvent.click(screen.getByRole('button', { name: 'Restore…' }));
    expect(screen.getAllByText('Archived → Active').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Restore 1' }));
    expect(await screen.findByText('Restored 1 resource.')).toBeInTheDocument();
    expect(repo.setArchived).toHaveBeenCalledWith('z', false);
  });

  it('reports a partial failure per item, toasts an error, and retries only the failures', async () => {
    let failBravo = true;
    repo.setArchived.mockImplementation(async (id: string) => {
      if (id === 'b' && failBravo) throw new Error('permission denied');
      return {} as ResourceLink;
    });
    renderPage();
    await pick('Alpha');
    await pick('Bravo');
    await pick('Charlie');
    await userEvent.click(screen.getByRole('button', { name: 'Archive…' }));
    await userEvent.click(screen.getByRole('button', { name: 'Archive 3' }));

    expect(await screen.findByText('Archived 2 of 3 resources. 1 failed and were left unchanged.')).toBeInTheDocument();
    expect(screen.getByText('Bravo — permission denied')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('Archived 2, 1 failed. See the list for details.');
    expect(toast.success).not.toHaveBeenCalled();

    failBravo = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry 1 failed' }));
    expect(await screen.findByText('Archived 3 resources.')).toBeInTheDocument();
    expect(repo.setArchived).toHaveBeenCalledTimes(4);
  });

  it('select-all states the resolved count and selects every matching resource', async () => {
    renderPage();
    await userEvent.click(screen.getByLabelText('Select all 3 matching this filter'));
    expect(screen.getByText('3 resources selected')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.queryByText(/resources selected/)).not.toBeInTheDocument();
  });
});

describe('Resources delete', () => {
  it('confirms in a dialog that names the item, says Drive is untouched, and nudges to archive', async () => {
    repo.delete.mockResolvedValue(undefined);
    renderPage();
    await userEvent.click(screen.getAllByTitle('Delete resource')[0]);

    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Delete “Alpha”?')).toBeInTheDocument();
    expect(within(dialog).getByText(/Drive file or form it points to is not touched/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Archive “Alpha” instead/ })).toBeInTheDocument();
    expect(repo.delete).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete resource' }));
    await waitFor(() => expect(repo.delete).toHaveBeenCalledWith('a'));
    expect(toast.success).toHaveBeenCalledWith('Resource deleted');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('keeps the dialog open and shows the failure when the delete fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    repo.delete.mockRejectedValue(new Error('boom'));
    renderPage();
    await userEvent.click(screen.getAllByTitle('Delete resource')[0]);
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete resource' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nothing was removed');
    expect(toast.error).toHaveBeenCalledWith('Failed to delete resource');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    errorSpy.mockRestore();
  });
});
