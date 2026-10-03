import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';

function setup(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = jest.fn().mockResolvedValue(undefined);
  const onClose = jest.fn();
  render(<ConfirmDialog open title="Delete Smith fam?" description="Removes the fam." onConfirm={onConfirm} onClose={onClose} {...props} />);
  return { onConfirm, onClose };
}

describe('ConfirmDialog', () => {
  it('is an accessible alertdialog with the consequences listed', () => {
    setup({ consequences: ['Also removes 14 members'] });
    const dialog = screen.getByRole('alertdialog', { name: 'Delete Smith fam?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Also removes 14 members')).toBeInTheDocument();
  });

  it('standard tier: focuses Cancel, confirms, then closes', async () => {
    const { onConfirm, onClose } = setup();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('typed tier: Confirm stays disabled until the name is typed (case/space-insensitive)', async () => {
    const { onConfirm } = setup({ requireText: 'Smith Fam' });
    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(confirm).toBeDisabled();
    expect(screen.getByLabelText(/type smith fam to confirm/i)).toHaveFocus();
    await userEvent.type(screen.getByLabelText(/type smith fam to confirm/i), 'smith');
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/type smith fam to confirm/i), '  fam');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
  });

  it('keeps the dialog open and shows the error when the action fails', async () => {
    const { onClose } = setup({ onConfirm: jest.fn().mockRejectedValue(new Error('Row is referenced')) });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Row is referenced');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('Escape and Cancel close it; a running action locks it', async () => {
    let release: () => void = () => undefined;
    const slow = jest.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const { onClose } = setup({ onConfirm: slow });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    release();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('Escape cancels when idle', () => {
    const { onClose } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    render(<ConfirmDialog open={false} title="x" description="y" onConfirm={jest.fn()} onClose={jest.fn()} />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
