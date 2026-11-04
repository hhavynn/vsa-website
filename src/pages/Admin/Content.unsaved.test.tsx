import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminContent from './Content';
import { hasUnsavedChanges } from '../../hooks/useUnsavedChangesGuard';

const mockSingle = jest.fn();
const mockUpsert = jest.fn();
const mockSetQueryData = jest.fn();
const mockInvalidateQueries = jest.fn();

jest.mock('react-query', () => ({
  useQueryClient: () => ({
    setQueryData: mockSetQueryData,
    invalidateQueries: mockInvalidateQueries,
  }),
}));
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: mockSingle }) }),
      upsert: mockUpsert,
    }),
  },
}));
jest.mock('../../components/features/admin/ProgramContentManager', () => ({
  ProgramContentManager: () => null,
}));
jest.mock('../../components/features/admin/ImageDropzone', () => ({
  ImageDropzone: ({ onSelect }: { onSelect: (file: File, preview: string) => void }) => (
    <button type="button" onClick={() => onSelect(new File(['synthetic'], 'test.webp', { type: 'image/webp' }), 'blob:local-preview')}>
      Choose a local photo
    </button>
  ),
}));
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

const row = {
  presidents_names: 'Alex Example',
  presidents_role: 'VSA President',
  presidents_message: 'Welcome to VSA',
  presidents_photo_url: '',
  presidents_photo_thumbnail_url: '',
};

function mount() {
  return render(
    <MemoryRouter initialEntries={['/admin/content']}>
      <AdminContent />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSingle.mockResolvedValue({ data: row, error: null });
  mockUpsert.mockResolvedValue({ error: null });
});

describe('Admin Content draft protection (#258)', () => {
  it('guards a typed draft on tab close and on Reset to Default', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    try {
      mount();
      const names = await screen.findByDisplayValue('Alex Example');
      fireEvent.change(names, { target: { value: 'Still drafting presidents' } });
      await waitFor(() => expect(hasUnsavedChanges()).toBe(true));

      const unload = new Event('beforeunload', { cancelable: true });
      fireEvent(window, unload);
      expect(unload.defaultPrevented).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'Reset to Default' }));
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(screen.getByDisplayValue('Still drafting presidents')).toBeInTheDocument();
      expect(mockUpsert).not.toHaveBeenCalled();
    } finally {
      confirm.mockRestore();
    }
  });

  it('protects a photo-only draft without uploading it before Save', async () => {
    mount();
    await screen.findByDisplayValue('Alex Example');
    expect(hasUnsavedChanges()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Choose a local photo' }));
    await waitFor(() => expect(hasUnsavedChanges()).toBe(true));
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('clears the dirty guard after a successful content-only save', async () => {
    mount();
    const names = await screen.findByDisplayValue('Alex Example');
    fireEvent.change(names, { target: { value: 'Approved Presidents' } });
    await waitFor(() => expect(hasUnsavedChanges()).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: 'Save Content' }));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ presidents_names: 'Approved Presidents' }),
      expect.objectContaining({ onConflict: 'id' }),
    ));
    await waitFor(() => expect(hasUnsavedChanges()).toBe(false));
    expect(screen.getByDisplayValue('Approved Presidents')).toBeInTheDocument();
  });

  it('keeps a draft dirty after an unsuccessful save', async () => {
    mockUpsert.mockResolvedValueOnce({ error: new Error('Synthetic write rejected') });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      mount();
      const names = await screen.findByDisplayValue('Alex Example');
      fireEvent.change(names, { target: { value: 'Not yet approved' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Content' }));
      await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Save Content' })).toBeEnabled());
      expect(hasUnsavedChanges()).toBe(true);
      expect(screen.getByDisplayValue('Not yet approved')).toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });
});
