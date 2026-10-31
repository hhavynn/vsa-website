/**
 * Admin -> Events: unsaved edits in the Edit modal are never thrown away
 * silently. Switching to another event or cancelling the editor asks in a
 * ConfirmDialog that names what is lost; Keep editing changes nothing and
 * Discard changes performs the pending action.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminEvents from './Events';

const makeEvent = (id: string, name: string) => ({
  id,
  name,
  description: `${name} description`,
  date: '2026-10-08T01:00:00Z',
  start_time: '18:00',
  end_time: '20:00',
  end_date: null,
  location: 'Price Center',
  points: 3,
  event_type: 'gbm',
  check_in_form_url: null,
  image_url: null,
  thumbnail_url: null,
  is_published: true,
  academic_term_id: 'term-1',
  interest_counts: null,
});
const mockEvents = [makeEvent('evt-1', 'GBM 1'), makeEvent('evt-2', 'Social Night')];

jest.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ insert: jest.fn(), update: jest.fn() }) },
}));
jest.mock('../../hooks/useEvents', () => ({ useEvents: () => ({ events: mockEvents, refreshEvents: jest.fn() }) }));
jest.mock('../../hooks/useAcademicTerms', () => ({
  useAcademicTerms: () => ({ terms: [], loading: false, error: null, refreshTerms: jest.fn() }),
}));
jest.mock('../../hooks/useExternalEvents', () => ({
  useAdminExternalEvents: () => ({ events: [], loading: false, error: null, refreshEvents: jest.fn() }),
}));
jest.mock('../../hooks/useUVSASchools', () => ({
  useAdminUVSASchools: () => ({ schools: [], loading: false, error: null, refreshSchools: jest.fn() }),
}));
jest.mock('../../hooks/useEventRecap', () => ({ useEventRecapEventIds: () => ({ recapEventIds: new Set<string>() }) }));
jest.mock('../../data/repos/academicTerms', () => ({ academicTermsRepository: {} }));
jest.mock('../../components/features/admin/EventRecapEditor', () => ({ EventRecapEditor: () => null }));

function renderEvents() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AdminEvents />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openFirstEvent() {
  renderEvents();
  await userEvent.click(screen.getByRole('button', { name: /Manage/i }));
  await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
  return screen.findByDisplayValue('GBM 1');
}

async function editFirstEvent() {
  const title = await openFirstEvent();
  await userEvent.clear(title);
  await userEvent.type(title, 'GBM One');
  return screen.getAllByRole('button', { name: 'Edit' });
}

describe('opening another event over unsaved edits', () => {
  it('asks first and Keep editing leaves the current edit untouched', async () => {
    const nativeConfirm = jest.spyOn(window, 'confirm');
    const rows = await editFirstEvent();
    await userEvent.click(rows[1]);

    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your edits?' });
    expect(within(dialog).getByText(/unsaved changes to GBM One\. Opening Social Night discards them/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('GBM One')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Social Night')).not.toBeInTheDocument();
    expect(nativeConfirm).not.toHaveBeenCalled();
    nativeConfirm.mockRestore();
  });

  it('Discard changes opens the other event', async () => {
    const rows = await editFirstEvent();
    await userEvent.click(rows[1]);
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your edits?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard changes' }));

    expect(await screen.findByDisplayValue('Social Night')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('GBM One')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('cancelling the editor with unsaved edits', () => {
  it('Keep editing keeps the editor and its edit; Discard changes closes it', async () => {
    await editFirstEvent();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    let dialog = await screen.findByRole('alertdialog', { name: 'Discard your edits?' });
    expect(within(dialog).getByText(/unsaved changes to GBM One\. Closing the editor discards them/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByRole('heading', { name: 'Edit Event' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('GBM One')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    dialog = await screen.findByRole('alertdialog', { name: 'Discard your edits?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard changes' }));
    expect(screen.queryByRole('heading', { name: 'Edit Event' })).not.toBeInTheDocument();
  });

  it('does not ask when nothing changed', async () => {
    await openFirstEvent();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Edit Event' })).not.toBeInTheDocument();
  });
});
