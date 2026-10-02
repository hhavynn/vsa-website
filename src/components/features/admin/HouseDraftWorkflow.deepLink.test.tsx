import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { HouseDraftWorkflow } from './HouseDraftWorkflow';
import { houseAssignmentsRepository, HouseBatchSnapshot } from '../../../data/repos/houseAssignments';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin' } }) }));
jest.mock('../../../data/repos/adminActivity', () => ({ logAdminActivity: jest.fn() }));
jest.mock('../../../data/repos/adminReview', () => ({
  adminReviewRepository: { listReviewed: jest.fn().mockResolvedValue(new Set()), mark: jest.fn(), unmark: jest.fn() },
}));
jest.mock('../../../data/repos/adminOperations', () => ({
  adminOperationsRepository: { resolveYearStart: jest.fn().mockResolvedValue(2026) },
}));
jest.mock('../../../data/repos/houseAssignments', () => ({
  houseAssignmentsRepository: { listBatches: jest.fn(), loadSnapshot: jest.fn() },
}));

const repo = houseAssignmentsRepository as jest.Mocked<typeof houseAssignmentsRepository>;

const batch = {
  id: 'b1', academic_year_start: 2026, academic_year_end: 2027, effective_start_date: '2026-11-08', status: 'draft',
  source_label: 'Fall sort', created_by: null, locked_at: null, published_at: null, created_at: '', updated_at: '',
};
const draft = (id: string, name: string) => ({
  id, batch_id: 'b1', source_name: name, source_house: null, member_id: null, house_profile_id: null,
  match_status: 'unmatched', match_method: null, match_score: null, preferences: null, notes: null, source_order: 0,
  created_at: '', updated_at: '',
});

function Search() {
  return <p data-testid="search">{useLocation().search}</p>;
}

function renderWorkflow(url: string, onYearChange = jest.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <HouseDraftWorkflow
                  selectedYear={2026}
                  onYearChange={onYearChange}
                  yearOptions={[{ start: 2026, label: '2026-2027', isActive: true }]}
                  effectiveStartDate="2026-11-08"
                  onEffectiveStartDateChange={jest.fn()}
                  houseProfiles={[]}
                  loadingProfiles={false}
                  members={[]}
                  loadingMembers={false}
                  onMembershipsPublished={jest.fn()}
                />
                <Search />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  repo.listBatches.mockResolvedValue([]);
  repo.loadSnapshot.mockResolvedValue({
    batch,
    drafts: [draft('r1', 'Kevin Tran'), draft('r2', 'Sara Nguyen')],
    profiles: [],
    existingMemberships: new Map(),
  } as unknown as HouseBatchSnapshot);
});

it('opens the batch from a Quick Search link, highlights the row, and clears the params', async () => {
  renderWorkflow('/admin/houses?batch=b1&row=r2');
  const rows = await screen.findAllByTestId('house-draft-row');
  expect(rows).toHaveLength(2);
  expect(rows.find((row) => row.getAttribute('data-highlighted') === 'true')).toHaveTextContent('Sara Nguyen');
  expect(repo.loadSnapshot).toHaveBeenCalledWith('b1', expect.any(Map));
  await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(/^$/));
});

it('switches to the batch’s year when the link points at a different one', async () => {
  repo.loadSnapshot.mockResolvedValue({
    batch: { ...batch, academic_year_start: 2025, academic_year_end: 2026 },
    drafts: [draft('r1', 'Kevin Tran')],
    profiles: [],
    existingMemberships: new Map(),
  } as unknown as HouseBatchSnapshot);
  const onYearChange = jest.fn();
  renderWorkflow('/admin/houses?batch=b1&row=r1', onYearChange);
  await screen.findByTestId('house-draft-row');
  expect(onYearChange).toHaveBeenCalledWith(2025);
});

it('does nothing without the parameters', async () => {
  renderWorkflow('/admin/houses');
  await screen.findByText('Import Sheet');
  expect(repo.loadSnapshot).not.toHaveBeenCalled();
});
