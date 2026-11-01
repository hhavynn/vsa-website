import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminUVSASchools from './UVSASchools';
import { DEFAULT_UVSA_NETWORK_PAGE_SETTINGS } from '../../data/repos/uvsaNetworkSettings';

const mockLoadSettings = jest.fn();
const mockUpdateSettings = jest.fn();
const mockLoadSchools = jest.fn();

jest.mock('../../data/repos/uvsaNetworkSettings', () => {
  const original = jest.requireActual('../../data/repos/uvsaNetworkSettings');
  return {
    ...original,
    uvsaNetworkSettingsRepository: {
      getSettings: (...args: unknown[]) => mockLoadSettings(...args),
      updateSettings: (...args: unknown[]) => mockUpdateSettings(...args),
    },
  };
});
jest.mock('../../data/repos/uvsaSchools', () => ({
  uvsaSchoolsRepository: {
    getAllSchools: (...args: unknown[]) => mockLoadSchools(...args),
    upsertSchool: jest.fn(),
    deleteSchool: jest.fn(),
  },
}));
jest.mock('../../components/features/admin/SchoolLogoField', () => ({
  SchoolLogoField: () => <div data-testid="mock-school-logo" />,
}));
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><AdminUVSASchools /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadSchools.mockResolvedValue([]);
  mockLoadSettings.mockResolvedValue(DEFAULT_UVSA_NETWORK_PAGE_SETTINGS);
  mockUpdateSettings.mockResolvedValue(undefined);
});

describe('UVSA Network copy shared form shell (#258)', () => {
  it('saves changed copy and supports explicit discard without writing', async () => {
    renderPage();
    const hero = await screen.findByRole('textbox', { name: 'Hero title' });
    const save = screen.getByRole('button', { name: 'Save copy' });
    await waitFor(() => expect(hero).toHaveValue(DEFAULT_UVSA_NETWORK_PAGE_SETTINGS.hero_title));
    expect(save).toBeDisabled();

    fireEvent.change(hero, { target: { value: 'New synthetic title' } });
    expect(save).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(hero).toHaveValue(DEFAULT_UVSA_NETWORK_PAGE_SETTINGS.hero_title);
    expect(mockUpdateSettings).not.toHaveBeenCalled();

    fireEvent.change(hero, { target: { value: 'Approved new title' } });
    fireEvent.click(save);
    await waitFor(() => expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({ hero_title: 'Approved new title' })));
    await waitFor(() => expect(save).toBeDisabled());
  });

  it('retains edits and a retry control after failure', async () => {
    mockUpdateSettings.mockRejectedValueOnce(new Error('synthetic error'));
    renderPage();
    const hero = await screen.findByRole('textbox', { name: 'Hero title' });
    await waitFor(() => expect(hero).toHaveValue(DEFAULT_UVSA_NETWORK_PAGE_SETTINGS.hero_title));
    fireEvent.change(hero, { target: { value: 'Draft to keep' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save copy' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save page copy');
    expect(hero).toHaveValue('Draft to keep');
    expect(screen.getByRole('button', { name: 'Save copy' })).toBeEnabled();
  });
});
