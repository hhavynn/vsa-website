import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { AdminQuickSearch, isQuickSearchShortcut } from './AdminQuickSearch';
import { useUnsavedChangesGuard } from '../../../hooks/useUnsavedChangesGuard';
import { adminSearchRepository } from '../../../data/repos/adminSearch';
import { memberRecord, aceRecord, eventRecord, pageRecords } from '../../../lib/adminSearch';

jest.mock('../../../data/repos/adminSearch', () => ({
  adminSearchRepository: { loadRecords: jest.fn() },
}));

const loadRecords = adminSearchRepository.loadRecords as jest.Mock;

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function Harness({ startOpen = false }: { startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/admin']}>
        <button onClick={() => setOpen(true)}>open</button>
        <AdminQuickSearch open={open} onClose={() => setOpen(false)} />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  loadRecords.mockReset();
  loadRecords.mockResolvedValue([
    ...pageRecords(),
    memberRecord({ id: 'm-1', first_name: 'Havyn', last_name: 'Nguyen' })!,
    aceRecord({ id: 'n-1', name: 'Havyn Nguyen', role_label: 'Little', family_id: 'f-1' }, { name: 'Sweatpants', academic_year_start: 2026 })!,
    eventRecord({ id: 'e-1', name: 'GBM 1', date: '2026-10-08T01:00:00Z' })!,
  ]);
});

describe('isQuickSearchShortcut', () => {
  it('matches Cmd+K and Ctrl+K only', () => {
    expect(isQuickSearchShortcut({ key: 'k', metaKey: true, ctrlKey: false })).toBe(true);
    expect(isQuickSearchShortcut({ key: 'K', metaKey: false, ctrlKey: true })).toBe(true);
    expect(isQuickSearchShortcut({ key: 'k', metaKey: false, ctrlKey: false })).toBe(false);
    expect(isQuickSearchShortcut({ key: 'j', metaKey: true, ctrlKey: false })).toBe(false);
  });
});

describe('AdminQuickSearch', () => {
  it('loads nothing until it is opened', () => {
    render(<Harness />);
    expect(loadRecords).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('identifies each result by type and destination', async () => {
    render(<Harness startOpen />);
    await userEvent.type(screen.getByRole('combobox', { name: 'Search admin' }), 'havyn');
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Havyn Nguyen');
    expect(options[0]).toHaveTextContent('Member');
    expect(options[0]).toHaveTextContent('→ Members');
    expect(options[1]).toHaveTextContent('ACE · Sweatpants · Little · 2026–27');
    expect(options[1]).toHaveTextContent('→ ACE');
  });

  it('opens the exact record, by canonical id, on Enter', async () => {
    render(<Harness startOpen />);
    const input = screen.getByRole('combobox', { name: 'Search admin' });
    await userEvent.type(input, 'havyn');
    await screen.findAllByRole('option');
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/admin/members?member=m-1'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves with the arrow keys to the ACE record', async () => {
    render(<Harness startOpen />);
    const input = screen.getByRole('combobox', { name: 'Search admin' });
    await userEvent.type(input, 'havyn');
    await screen.findAllByRole('option');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/admin/ace?family=f-1&node=n-1'));
  });

  it('routes an event result to Events', async () => {
    render(<Harness startOpen />);
    await userEvent.type(screen.getByRole('combobox', { name: 'Search admin' }), 'gbm');
    await userEvent.click(await screen.findByRole('option', { name: /GBM 1/ }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/admin/events?event=e-1'));
  });

  it('closes on Escape without navigating', async () => {
    render(<Harness startOpen />);
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search admin' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/admin');
  });

  it('still finds admin pages when the record index fails to load', async () => {
    loadRecords.mockRejectedValue(new Error('down'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<Harness startOpen />);
    await userEvent.type(screen.getByRole('combobox', { name: 'Search admin' }), 'houses');
    expect(await screen.findByRole('option', { name: /Houses/ })).toBeInTheDocument();
  });
});

describe('unsaved changes', () => {
  function Dirty({ dirty }: { dirty: boolean }) {
    useUnsavedChangesGuard(dirty);
    return null;
  }

  function DirtyHarness() {
    return (
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/admin']}>
          <Dirty dirty />
          <AdminQuickSearch open onClose={() => undefined} />
          <Routes>
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  it('asks before navigating away from a form with unsaved changes, and stays put on Cancel', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<DirtyHarness />);
    const input = screen.getByRole('combobox', { name: 'Search admin' });
    await userEvent.type(input, 'havyn');
    await screen.findAllByRole('option');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByTestId('where')).toHaveTextContent('/admin');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    confirm.mockRestore();
  });

  it('navigates once the admin agrees to discard', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<DirtyHarness />);
    const input = screen.getByRole('combobox', { name: 'Search admin' });
    await userEvent.type(input, 'havyn');
    await screen.findAllByRole('option');
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/admin/members?member=m-1'));
    confirm.mockRestore();
  });
});
