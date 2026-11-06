import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { ProgramContentManager } from './ProgramContentManager';
import { hasUnsavedChanges } from '../../../hooks/useUnsavedChangesGuard';

const mockUpsert = jest.fn();
const mockRefetch = jest.fn();
jest.mock('react-hot-toast', () => ({ __esModule: true, default: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }) }));
jest.mock('../../../data/repos/programContent', () => ({
  programContentRepository: { upsertContent: (...args: unknown[]) => mockUpsert(...args) },
}));
jest.mock('../../../hooks/useProgramContent', () => ({
  useAllProgramContent: () => ({ content: [], loading: false, error: null, refetch: mockRefetch }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUpsert.mockResolvedValue({});
  mockRefetch.mockResolvedValue(undefined);
});

async function editAceTitle() {
  render(<ProgramContentManager />);
  const title = screen.getByDisplayValue('Current ACE Cycle');
  await userEvent.clear(title);
  await userEvent.type(title, 'ACE new draft');
  await waitFor(() => expect(hasUnsavedChanges()).toBe(true));
}

describe('Program Status editor unsaved changes (#258)', () => {
  it('keeps the ACE draft on Cancel and switches to Intern only after explicit discard', async () => {
    await editAceTitle();
    const intern = screen.getByRole('button', { name: /Intern Current Cycle/ });
    await userEvent.click(intern);
    const prompt = screen.getByRole('alertdialog', { name: 'Discard your program edits?' });
    expect(within(prompt).getByText(/Switching to Intern Current Cycle discards them/)).toBeInTheDocument();
    await userEvent.click(within(prompt).getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByDisplayValue('ACE new draft')).toBeInTheDocument();
    expect(mockUpsert).not.toHaveBeenCalled();

    await userEvent.click(intern);
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Discard changes' }));
    expect(await screen.findByDisplayValue('Current Intern Cycle')).toBeInTheDocument();
    await waitFor(() => expect(hasUnsavedChanges()).toBe(false));
    expect(screen.queryByDisplayValue('ACE new draft')).not.toBeInTheDocument();
  });

  it('switches immediately without a dialog if there is no unsaved draft', async () => {
    render(<ProgramContentManager />);
    await userEvent.click(screen.getByRole('button', { name: /Intern Current Cycle/ }));
    expect(await screen.findByDisplayValue('Current Intern Cycle')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('does not prompt after an acknowledged successful save', async () => {
    await editAceTitle();
    await userEvent.click(screen.getByRole('button', { name: 'Save Program Content' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Program content saved'));
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ page_key: 'ace', title: 'ACE new draft' }));
    await waitFor(() => expect(hasUnsavedChanges()).toBe(false));
    await userEvent.click(screen.getByRole('button', { name: /WNC Current Event/ }));
    expect(await screen.findByDisplayValue("Current Wild N' Culture Event")).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('keeps a failed save dirty and guards against navigating away', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      mockUpsert.mockRejectedValue(new Error('simulated permission denial'));
      await editAceTitle();
      await userEvent.click(screen.getByRole('button', { name: 'Save Program Content' }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to save program content'));
      expect(screen.getByDisplayValue('ACE new draft')).toBeInTheDocument();
      expect(hasUnsavedChanges()).toBe(true);

      const leave = new Event('beforeunload', { cancelable: true });
      fireEvent(window, leave);
      expect(leave.defaultPrevented).toBe(true);

      await userEvent.click(screen.getByRole('button', { name: /House Current Cycle/ }));
      expect(screen.getByRole('alertdialog', { name: 'Discard your program edits?' })).toBeInTheDocument();
      expect(screen.getByDisplayValue('ACE new draft')).toBeInTheDocument();
    } finally {
      err.mockRestore();
    }
  });
});
