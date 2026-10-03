/**
 * Admin -> Events (Manage): bulk Publish / Unpublish previews exactly what
 * changes, skips events already in the target state with a reason, reports
 * per-event failures, and never offers a bulk delete. Deleting one event is the
 * typed-confirmation tier because it cascades.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminEvents from './Events';

jest.mock('react-hot-toast', () => {
  const fn = jest.fn();
  return { __esModule: true, default: Object.assign(fn, { success: jest.fn(), error: jest.fn(), dismiss: jest.fn() }) };
});

const baseEvent = {
  description: 'desc',
  start_time: null,
  end_time: null,
  end_date: null,
  location: 'Price Center',
  points: 2,
  check_in_form_url: '',
  image_url: null,
  thumbnail_url: null,
  academic_term_id: 'term-1',
  interest_counts: null,
};
const makeEvt = (id: string, name: string, isPublished: boolean, extra: Record<string, unknown> = {}) => ({
  ...baseEvent,
  id,
  name,
  is_published: isPublished,
  event_type: 'gbm',
  date: '2030-03-10T12:00:00Z',
  ...extra,
});

const mockState: {
  events: Array<ReturnType<typeof makeEvt>>;
  failIds: string[];
  deleteFails: boolean;
  storage: 'ok' | 'error' | 'throw';
} = { events: [], failIds: [], deleteFails: false, storage: 'ok' };
const mockRemove = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockRefresh = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      delete: () => ({
        eq: (_column: string, id: string) => {
          mockDelete(id);
          return Promise.resolve({ error: mockState.deleteFails ? { message: 'update or delete violates foreign key' } : null });
        },
      }),
    }),
    storage: {
      from: () => ({
        remove: (names: string[]) => {
          mockRemove(names);
          if (mockState.storage === 'throw') return Promise.reject(new Error('network down'));
          return Promise.resolve({ error: mockState.storage === 'error' ? { message: 'Storage denied' } : null });
        },
      }),
    },
  },
}));
jest.mock('../../hooks/useEvents', () => ({ useEvents: () => ({ events: mockState.events, refreshEvents: mockRefresh }) }));
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
jest.mock('../../components/features/admin/EventRecapEditor', () => ({ EventRecapEditor: () => null }));
jest.mock('../../data/repos/events', () => ({
  eventsRepository: {
    // The bulk write goes through the repository (missing rows reject there).
    updateEvent: (id: string, payload: unknown) => {
      mockUpdate(payload, id);
      return mockState.failIds.includes(id) ? Promise.reject(new Error('row-level security')) : Promise.resolve({});
    },
  },
}));
jest.mock('../../data/repos/externalEvents', () => ({ externalEventsRepository: { applySyncPlan: () => Promise.resolve() } }));
jest.mock('../../data/repos/academicTerms', () => ({ academicTermsRepository: {} }));

async function openManage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AdminEvents />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: /^Manage/ }));
}

beforeEach(() => {
  mockState.events = [
    makeEvt('a', 'Spring GBM', true),
    makeEvt('b', 'Draft Mixer', false),
    makeEvt('c', 'Fall Social', true),
  ];
  mockState.failIds = [];
  mockState.deleteFails = false;
  mockState.storage = 'ok';
  mockRemove.mockClear();
  mockUpdate.mockClear();
  mockDelete.mockClear();
  mockRefresh.mockClear();
});

describe('bulk publish / unpublish', () => {
  it('previews what changes and what is skipped before writing anything', async () => {
    await openManage();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all events on this page' }));
    expect(screen.getByRole('toolbar', { name: 'Bulk actions' })).toHaveTextContent('3 events selected');

    await userEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Unpublish events' });
    expect(within(dialog).getByText('3 events on this page.')).toBeInTheDocument();
    const willChange = within(dialog).getByRole('list', { name: 'Items that will change' });
    const rows = within(willChange).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Spring GBM');
    expect(rows[1]).toHaveTextContent('Fall Social');
    expect(within(willChange).getAllByText('Published → Draft')).toHaveLength(2);
    // The Draft is listed as skipped, with why.
    expect(within(dialog).getByText(/Draft Mixer.* — Already a draft\./)).toBeInTheDocument();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('writes only the events that change, then refetches and reports success', async () => {
    const toastSuccess = jest.spyOn(toast, 'success');
    await openManage();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all events on this page' }));
    await userEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
    await userEvent.click(screen.getByRole('button', { name: 'Unpublish 2' }));

    expect(await screen.findByText('Unpublished 2 events.')).toBeInTheDocument();
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledWith({ is_published: false }, 'a');
    expect(mockUpdate).toHaveBeenCalledWith({ is_published: false }, 'c');
    expect(mockUpdate).not.toHaveBeenCalledWith(expect.anything(), 'b');
    expect(mockRefresh).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith('Unpublished 2 events.');
  });

  it('skips an External Event that has no UVSA host when publishing', async () => {
    mockState.events = [
      makeEvt('d', 'Draft Mixer', false),
      makeEvt('x', 'Orphan External', false, { event_type: 'external_event' }),
    ];
    await openManage();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all events on this page' }));
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Publish events' });
    const willChange = within(dialog).getByRole('list', { name: 'Items that will change' });
    expect(within(willChange).getAllByRole('listitem')).toHaveLength(1);
    expect(within(willChange).getByText('Draft → Published')).toBeInTheDocument();
    expect(within(dialog).getByText(/Orphan External.* — External Event with no UVSA host yet/)).toBeInTheDocument();
  });

  it('reports a partial failure per event and leaves the failed one unchanged', async () => {
    mockState.failIds = ['c'];
    const toastError = jest.spyOn(toast, 'error');
    await openManage();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all events on this page' }));
    await userEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
    await userEvent.click(screen.getByRole('button', { name: 'Unpublish 2' }));

    expect(await screen.findByText('Unpublished 1 of 2 events. 1 failed and were left unchanged.')).toBeInTheDocument();
    const failed = screen.getByRole('list', { name: 'Items that failed' });
    expect(failed).toHaveTextContent('Fall Social');
    expect(failed).toHaveTextContent('row-level security');
    expect(screen.getByRole('button', { name: 'Retry 1 failed' })).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith('Unpublished 1 of 2 events. 1 failed and were left unchanged.');
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('states the resolved count for "select all matching" beyond the first page', async () => {
    mockState.events = Array.from({ length: 30 }, (_, i) => makeEvt(`e${i}`, `Event ${i}`, i % 2 === 0, { date: `2030-04-${String(i + 1).padStart(2, '0')}T12:00:00Z` }));
    await openManage();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all events on this page' }));
    expect(screen.getByRole('toolbar', { name: 'Bulk actions' })).toHaveTextContent('25 events selected');

    await userEvent.click(screen.getByRole('button', { name: 'Select all 30 matching events' }));
    const bar = screen.getByRole('toolbar', { name: 'Bulk actions' });
    expect(bar).toHaveTextContent('30 events selected');
    expect(bar).toHaveTextContent('All 30 matching events are selected, including ones not shown.');

    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Publish events' });
    expect(within(dialog).getByText('All 30 events matching the current filter, including ones not shown on this page.')).toBeInTheDocument();
    // Only the 15 drafts change; the 15 already-published ones are skipped.
    expect(within(dialog).getByText('Will change (15)')).toBeInTheDocument();
    expect(within(dialog).getByText('Skipped (15)')).toBeInTheDocument();
  });

  it('offers no bulk delete', async () => {
    await openManage();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all events on this page' }));
    const bar = screen.getByRole('toolbar', { name: 'Bulk actions' });
    expect(within(bar).queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });
});

const IMAGE = 'https://proj.supabase.co/storage/v1/object/public/event_images/spring.jpg';
const THUMB = 'https://proj.supabase.co/storage/v1/object/public/event_images/spring-thumb.jpg';

async function confirmDeleteOfSpringGbm() {
  const row = screen.getByRole('checkbox', { name: 'Select Spring GBM' }).closest('div.flex') as HTMLElement; // eslint-disable-line testing-library/no-node-access
  fireEvent.click(within(row).getByRole('button', { name: 'Delete' }));
  const dialog = screen.getByRole('alertdialog', { name: 'Delete event?' });
  await userEvent.type(within(dialog).getByRole('textbox'), 'Spring GBM');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete event' }));
  return dialog;
}

describe('delete event', () => {
  beforeEach(() => {
    mockState.events = [makeEvt('a', 'Spring GBM', true, { image_url: IMAGE, thumbnail_url: THUMB }), makeEvt('b', 'Draft Mixer', false)];
  });

  it('needs the event name typed, and lists what cascades (including image and thumbnail), before deleting', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm');
    await openManage();
    const row = screen.getByRole('checkbox', { name: 'Select Spring GBM' }).closest('div.flex') as HTMLElement; // eslint-disable-line testing-library/no-node-access
    fireEvent.click(within(row).getByRole('button', { name: 'Delete' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Delete event?' });
    expect(within(dialog).getByText(/every attendance record/)).toBeInTheDocument();
    expect(within(dialog).getByText(/uploaded image and thumbnail from storage/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Delete event' });
    expect(confirm).toBeDisabled();
    expect(mockDelete).not.toHaveBeenCalled();

    await userEvent.type(within(dialog).getByRole('textbox'), 'Spring GBM');
    await waitFor(() => expect(confirm).toBeEnabled());
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('database delete fails: the dialog stays open with the error, nothing is cleaned up, no success', async () => {
    mockState.deleteFails = true;
    await openManage();
    const dialog = await confirmDeleteOfSpringGbm();

    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alertdialog', { name: 'Delete event?' })).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('Failed to delete event');
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('delete and cleanup both succeed: plain success, both files removed', async () => {
    await openManage();
    await confirmDeleteOfSpringGbm();

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(mockDelete).toHaveBeenCalledWith('a');
    expect(mockRemove).toHaveBeenCalledWith(['spring.jpg']);
    expect(mockRemove).toHaveBeenCalledWith(['spring-thumb.jpg']);
    expect(toast.success).toHaveBeenCalledWith('"Spring GBM" deleted');
    expect(toast).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalled();
  });

  it.each([
    ['Storage returns an error', 'error' as const],
    ['Storage cleanup throws', 'throw' as const],
  ])('delete succeeds but %s: still reported deleted, with a cleanup warning and no retry', async (_label, mode) => {
    mockState.storage = mode;
    await openManage();
    await confirmDeleteOfSpringGbm();

    // The confirmation closes: the event is gone, there is nothing to retry.
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledTimes(1);
    const message = (toast as unknown as jest.Mock).mock.calls[0][0] as string;
    expect(message).toMatch(/"Spring GBM" was deleted, but/);
    expect(message).toMatch(/could not be cleaned up/);
    expect(message).toMatch(/Nothing to retry/);
    // Both files were attempted even though the first one failed.
    expect(mockRemove).toHaveBeenCalledTimes(2);
    expect(mockRefresh).toHaveBeenCalled();
  });
});

describe('bulk preview event dates', () => {
  it('names the San Diego day, not the device-timezone day', async () => {
    // 7:00 PM Pacific on Mar 9 is already Mar 10 in UTC and Asia/Ho_Chi_Minh.
    mockState.events = [makeEvt('e', 'Evening Mixer', true, { date: '2030-03-10T03:00:00Z', start_time: '19:00:00' })];
    await openManage();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all events on this page' }));
    await userEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
    const willChange = within(screen.getByRole('alertdialog', { name: 'Unpublish events' })).getByRole('list', { name: 'Items that will change' });
    expect(willChange).toHaveTextContent('Evening Mixer — Mar 9, 2030');
  });
});
