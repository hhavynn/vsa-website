import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminUVSASchools from './UVSASchools';
import { uvsaSchoolsRepository } from '../../data/repos/uvsaSchools';
import { UVSASchool } from '../../types';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }) }));
jest.mock('../../data/repos/uvsaSchools', () => ({
  uvsaSchoolsRepository: { getAllSchools: jest.fn(), upsertSchool: jest.fn(), deleteSchool: jest.fn() },
}));
jest.mock('../../data/repos/uvsaNetworkSettings', () => {
  const actual = jest.requireActual('../../data/repos/uvsaNetworkSettings');
  return {
    ...actual,
    uvsaNetworkSettingsRepository: { getSettings: jest.fn().mockResolvedValue(actual.DEFAULT_UVSA_NETWORK_PAGE_SETTINGS), updateSettings: jest.fn() },
  };
});
jest.mock('../../components/features/admin/SchoolLogoField', () => ({ SchoolLogoField: () => null }));
jest.mock('../../components/features/uvsa/SchoolVisualMark', () => ({ SchoolVisualMark: () => null }));

const repo = uvsaSchoolsRepository as jest.Mocked<typeof uvsaSchoolsRepository>;

const school = {
  id: 's1',
  school_name: 'University of California, San Diego',
  short_name: 'UCSD',
  slug: 'ucsd',
  system_type: 'UC',
  city: 'La Jolla',
  logo_url: null,
  is_active: true,
  sort_order: 1,
  confidence_level: 'high',
  known_for: [],
  recurring_events: [],
} as unknown as UVSASchool;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/uvsa-schools']}>
        <AdminUVSASchools />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  repo.getAllSchools.mockResolvedValue([school]);
});

describe('UVSA schools delete', () => {
  it('uses the shared page header', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'UVSA Schools' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View public page/ })).toHaveAttribute('href', '/uvsa-network');
  });

  it('explains what disappears from the public page and only deletes after confirming', async () => {
    repo.deleteSchool.mockResolvedValue(undefined);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Delete/ }));

    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Delete UCSD?')).toBeInTheDocument();
    expect(within(dialog).getByText(/logo, Instagram link, and description disappear from the public network page/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Events linked to this school are kept but lose their school link/)).toBeInTheDocument();
    expect(repo.deleteSchool).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete school' }));
    await waitFor(() => expect(repo.deleteSchool).toHaveBeenCalledWith('s1'));
    expect(toast.success).toHaveBeenCalledWith('UVSA school deleted');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('does not delete when cancelled', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Delete/ }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(repo.deleteSchool).not.toHaveBeenCalled();
  });
});
