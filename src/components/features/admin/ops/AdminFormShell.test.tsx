import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { DatabaseError } from '../../../../data/errors';
import { hasUnsavedChanges } from '../../../../hooks/useUnsavedChangesGuard';
import { useAdminForm } from '../../../../hooks/useAdminForm';
import { AdminField, AdminFormShell } from './AdminFormShell';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }) }));

const schema = z.object({ name: z.string().trim().min(1, 'Name is required'), email: z.string().trim().email('Enter a valid email').or(z.literal('')) });

function Demo({ onSubmit }: { onSubmit: (v: z.output<typeof schema>) => Promise<unknown> }) {
  const api = useAdminForm({ schema, defaultValues: { name: '', email: '' }, onSubmit, constraints: { members_email_key: { field: 'email', message: 'That email is taken.' } } });
  const { register, formState } = api.form;
  return (
    <AdminFormShell onSubmit={api.submit} status={api.status} formError={api.formError} errors={formState.errors} onDiscard={api.discard} label="Demo">
      <AdminField label="Name" required error={formState.errors.name?.message}>
        {(p) => <input {...p} {...register('name')} />}
      </AdminField>
      <AdminField label="Email" error={formState.errors.email?.message}>
        {(p) => <input {...p} {...register('email')} />}
      </AdminField>
    </AdminFormShell>
  );
}

describe('useAdminForm + AdminFormShell', () => {
  it('blocks submit with inline errors, focuses the first invalid field, announces a summary', async () => {
    const onSubmit = jest.fn();
    render(<Demo onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByLabelText(/name/i)).toHaveFocus());
    expect(screen.getByLabelText(/name/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(screen.getByText('There are 2 problems to fix:')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('guards unsaved edits, then clears the guard after a successful save', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<Demo onSubmit={onSubmit} />);
    expect(hasUnsavedChanges()).toBe(false);
    await userEvent.type(screen.getByLabelText(/name/i), 'Ada');
    await waitFor(() => expect(hasUnsavedChanges()).toBe(true));
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Ada', email: '' });
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('puts a server unique-violation beside its field and keeps the values', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new DatabaseError('duplicate key "members_email_key"', '23505'));
    render(<Demo onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/name/i), 'Ada');
    await userEvent.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true'));
    const describedBy = screen.getByLabelText(/email/i).getAttribute('aria-describedby') ?? '';
    expect(describedBy).toMatch(/-error/);
    expect(screen.getAllByText('That email is taken.').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/name/i)).toHaveValue('Ada');
    expect(screen.getByText(/Not saved/)).toBeInTheDocument();
  });

  it('warns before the tab closes while dirty', async () => {
    render(<Demo onSubmit={jest.fn()} />);
    await userEvent.type(screen.getByLabelText(/name/i), 'x');
    const event = new Event('beforeunload', { cancelable: true });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(true);
  });
});
