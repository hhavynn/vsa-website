import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminSettings from './Settings';

const refresh = jest.fn();
const upsert = jest.fn();

jest.mock('../../context/SiteSettingsContext', () => ({
  useSiteSettings: () => ({
    settings: { logoUrl: 'https://vsaatucsd.com/logo.png', logoAlt: 'VSA logo' },
    refresh,
  }),
}));
jest.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ upsert }) },
}));
jest.mock('../../components/features/admin/ImageDropzone', () => ({
  ImageDropzone: () => <div data-testid="mock-logo-upload" />,
}));
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  upsert.mockResolvedValue({ error: null });
  refresh.mockResolvedValue(undefined);
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

    await waitFor(() => expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ logo_alt: 'Vietnamese Student Association logo' }),
      expect.objectContaining({ onConflict: 'id' }),
    ));
    await waitFor(() => expect(save).toBeDisabled());
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('discards an unsubmitted change without writing to the database', async () => {
    render(<MemoryRouter><AdminSettings /></MemoryRouter>);
    const alt = screen.getByRole('textbox', { name: 'Alt Text' });
    await waitFor(() => expect(alt).toHaveValue('VSA logo'));
    fireEvent.change(alt, { target: { value: 'Other alt text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(alt).toHaveValue('VSA logo');
    expect(upsert).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save Settings' })).toBeDisabled();
  });

  it('preserves edits and announces a failed save', async () => {
    upsert.mockResolvedValueOnce({ error: { message: 'synthetic rejection' } });
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
