/**
 * Admin -> Events: Duplicate Event copies an event's shape, never its history.
 * The copy is a Draft, needs a new date, and creates nothing until the admin
 * submits the form.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminEvents from './Events';

const mockEvent = {
  id: 'evt-1',
  name: 'GBM 1',
  description: 'First general body meeting',
  date: '2026-10-08T01:00:00Z',
  start_time: '18:00',
  end_time: '20:00',
  end_date: null,
  location: 'Price Center',
  points: 3,
  event_type: 'gbm',
  check_in_form_url: 'https://forms.example/secret',
  image_url: 'https://img.example/a.png',
  thumbnail_url: null,
  is_published: true,
  academic_term_id: 'term-1',
  interest_counts: { event_id: 'evt-1', interested_count: 4, going_count: 2, updated_at: '' },
};

const mockInsert = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ insert: (...args: unknown[]) => mockInsert(...args) }) },
}));
jest.mock('../../hooks/useEvents', () => ({ useEvents: () => ({ events: [mockEvent], refreshEvents: jest.fn() }) }));
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

function renderEvents() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AdminEvents />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => mockInsert.mockClear());

it('duplicates into the Create form as a Draft with no date, check-in link, or image', async () => {
  renderEvents();
  await userEvent.click(screen.getByRole('button', { name: /Manage/i }));
  await userEvent.click(await screen.findByRole('button', { name: 'Duplicate' }));

  expect(screen.getByDisplayValue('GBM 1 (copy)')).toBeInTheDocument();
  expect(screen.getByDisplayValue('First general body meeting')).toBeInTheDocument();
  expect(screen.getByDisplayValue('3')).toBeInTheDocument();
  expect(screen.getByDisplayValue('Price Center')).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: /Publish this event publicly/ })).not.toBeChecked();
  expect(screen.queryByDisplayValue('https://forms.example/secret')).not.toBeInTheDocument();
  expect(screen.getByText(/Duplicated from “GBM 1” as a Draft/)).toBeInTheDocument();
  const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement; // eslint-disable-line testing-library/no-node-access
  expect(dateInput.value).toBe('');
  expect(mockInsert).not.toHaveBeenCalled();
});

it('cannot be created without choosing a new date', async () => {
  renderEvents();
  await userEvent.click(screen.getByRole('button', { name: /Manage/i }));
  await userEvent.click(await screen.findByRole('button', { name: 'Duplicate' }));
  fireEvent.submit(screen.getByDisplayValue('GBM 1 (copy)').closest('form') as HTMLFormElement); // eslint-disable-line testing-library/no-node-access
  expect(mockInsert).not.toHaveBeenCalled();
});

it('warns before replacing unsaved Create-form work with a duplicate', async () => {
  renderEvents();
  await userEvent.type(screen.getByPlaceholderText('Spring GBM'), 'Half-typed');
  await userEvent.click(screen.getByRole('button', { name: /Manage/i }));
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  await userEvent.click(await screen.findByRole('button', { name: 'Duplicate' }));
  expect(confirm).toHaveBeenCalled();
  confirm.mockRestore();
});
