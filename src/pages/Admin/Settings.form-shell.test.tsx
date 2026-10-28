import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminSettings from './Settings';

const mockRefresh = jest.fn();
const mockUpsert = jest.fn();
let mockSettings = { logoUrl: 'https://vsaatucsd.com/logo.png', logoAlt: 'VSA logo' };

jest.mock('../../context/SiteSettingsContext', () => ({
  useSiteSettings: () => ({
    settings: mockSettings,
    refresh: mockRefresh,
  }),
}));
jest.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ upsert: mockUpsert }) },
}));
jest.mock('../../components/features/admin/ImageDropzone', () => ({
  ImageDropzone: () => <div data-testid="mock-logo-upload" />,
}));
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

beforeEach(() => {
  mockSettings = { logoUrl: 'https://vsaatucsd.com/logo.png', logoAlt: 'VSA logo' };
  jest.clearAllMocks();
  mockUpsert.mockResolvedValue({ error: null });
  mockRefresh.mockImplementation(async () => {
    const lastWrite = mockUpsert.mock.calls[mockUpsert.mock.calls.length - 1]?.[0] as
      | { logo_url?: string | null; logo_alt?: string | null }
      | undefined;
    if (lastWrite) {
      mockSettings = {
        logoUrl: lastWrite.logo_url ?? '',
        logoAlt: lastWrite.logo_alt ?? 'VSA logo',
      };
    }
  });
});

describe('Admin Settings shared form shell (#258)', () => {
  it('disables save until changed, saves edits and clears the dirty state', async () => {
    render(<MemoryRouter><AdminSettings /></MemoryRouter>);
    const save = screen.getByRole('button', { name: 'Save Settings' });
    const alt = screen.getByRole('textbox', { name: 'Alt Text' });

    await waitFor(() => expect(alt).toHaveValue('VSA logo'));
    expect(save).toBeDisabled();
    fireEvent.change(alt, { target: { value: 'Vietnamese Student Association logo' } });
    expect(save).toBeEnabled();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    fireEvent.click(save);

    await waitFor(() => expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ logo_alt: 'Vietnamese Student Association logo' }),
      expect.objectContaining({ onConflict: 'id' }),
    ));
    await waitFor(() => expect(save).toBeDisabled());
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('keeps unsaved logo edits across a background server refresh', async () => {
    const { rerender } = render(<MemoryRouter><AdminSettings /></MemoryRouter>);
    const alt = screen.getByRole('textbox', { name: 'Alt Text' });
    await waitFor(() => expect(alt).toHaveValue('VSA logo'));
    fireEvent.change(alt, { target: { value: 'My in-progress logo description' } });

    mockSettings = { logoUrl: 'https://vsaatucsd.com/new-logo.png', logoAlt: 'Another editor changed this' };
    rerender(<MemoryRouter><AdminSettings /></MemoryRouter>);
    expect(alt).toHaveValue('My in-progress logo description');
    expect(screen.getByRole('button', { name: 'Save Settings' })).toBeEnabled();
  });

  it('discards an unsubmitted change without writing to the database', async () => {
    render(<MemoryRouter><AdminSettings /></MemoryRouter>);
    const alt = screen.getByRole('textbox', { name: 'Alt Text' });
    await waitFor(() => expect(alt).toHaveValue('VSA logo'));
    fireEvent.change(alt, { target: { value: 'Other alt text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(alt).toHaveValue('VSA logo');
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save Settings' })).toBeDisabled();
  });

  it('rejects a non-http logo URL without writing settings', async () => {
    render(<MemoryRouter><AdminSettings /></MemoryRouter>);
    const logoUrl = screen.getByRole('textbox', { name: 'Logo URL' });
    fireEvent.change(logoUrl, { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Use a valid HTTP(S) logo URL');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('preserves edits and announces a failed save', async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: 'synthetic rejection' } });
    render(<MemoryRouter><AdminSettings /></MemoryRouter>);
    const alt = screen.getByRole('textbox', { name: 'Alt Text' });
    await waitFor(() => expect(alt).toHaveValue('VSA logo'));
    fireEvent.change(alt, { target: { value: 'Unsaved alt text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to save settings');
    expect(alt).toHaveValue('Unsaved alt text');
    expect(screen.getByRole('button', { name: 'Save Settings' })).toBeEnabled();
  });
});
