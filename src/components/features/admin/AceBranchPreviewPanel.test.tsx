import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../../context/ThemeContext';
import { aceFamiliesRepository } from '../../../data/repos/aceFamilies';
import type { AceAssignmentCycle, AceAssignmentDraft, AceFamily } from '../../../types';
import type { AceNodeRef } from '../../../lib/aceAssignments';
import { AceBranchPreviewPanel } from './AceBranchPreviewPanel';

jest.mock('../../../data/repos/aceFamilies', () => ({
  aceFamiliesRepository: { getAdminFamilies: jest.fn() },
}));

const getAdminFamilies = aceFamiliesRepository.getAdminFamilies as jest.Mock;

const family: AceFamily = {
  id: 'fictional-fam', name: 'Fictional Fam', slug: 'fictional-fam',
  is_published: true, academic_year_start: null, academic_year_end: null,
  cover_image_url: null, theme_color: null, description: null, display_order: 0,
  created_at: '', updated_at: '',
};

const cycle = {
  id: 'fictional-cycle', status: 'locked', academic_year_start: 2026,
  academic_year_end: 2027, created_by: null, created_at: '', updated_at: '',
} as AceAssignmentCycle;

const drafts: AceAssignmentDraft[] = [{
  id: 'fictional-draft', cycle_id: cycle.id,
  little_name: 'Fictional Rookie', little_member_id: 'member-rookie',
  big_ace_member_id: 'big', published_ace_member_id: null,
  notes: 'PRIVATE FIXTURE NOTES MUST NOT RENDER', display_order: 0,
  created_at: '', updated_at: '',
}];

const node = (id: string, year: number | null): AceNodeRef => ({
  id, name: 'Fictional ' + id, familyId: family.id, familyName: family.name,
  parentId: null, memberId: 'member-' + id, roleLabel: 'Big',
  isPublished: true, pickupAcademicYearStart: year,
  pickupTerm: year === null ? null : 'FA' + String(year).slice(-2),
});

// The proposed Big has no verified pickup year, but unrelated published
// family members have enough dated evidence to select chronological rows.
const nodes: AceNodeRef[] = [
  node('big', null), node('a', 2021), node('b', 2022),
  node('c', 2023), node('d', 2024),
];

function renderPanel(ready = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, cacheTime: 0 } },
  });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AceBranchPreviewPanel cycle={cycle} drafts={drafts} nodes={nodes} ready={ready} />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  getAdminFamilies.mockResolvedValue([family]);
});

describe('ACE admin family preview layout continuity (#665)', () => {
  it('keeps chronological layout when toggled to undated new-additions-only', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Preview family branches' }));
    const canvas = await screen.findByRole('region', {
      name: 'Private Fictional Fam family tree preview',
    });
    expect(canvas.querySelector('[data-year-band="2021"]')).not.toBeNull();
    expect(canvas.querySelector('[data-year-band="unknown"]')).not.toBeNull();
    expect(screen.getByText(/Locked draft snapshot for final review/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Full published ancestry' }));
    const filtered = screen.getByRole('region', {
      name: 'Private Fictional Fam family tree preview',
    });
    expect(filtered.querySelector('[data-year-band="unknown"]')).not.toBeNull();
    expect(filtered.querySelector('[data-year-band="2021"]')).toBeNull();
    expect(within(filtered).getByText('Fictional Rookie')).toBeInTheDocument();
    expect(within(filtered).getByText('DRAFT · NOT PUBLISHED')).toBeInTheDocument();
    expect(filtered.textContent).not.toContain('PRIVATE FIXTURE NOTES MUST NOT RENDER');
  });

  it('fails closed when the private family read errors', async () => {
    getAdminFamilies.mockRejectedValueOnce(new Error('synthetic read denied'));
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Preview family branches' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The preview is unavailable');
    expect(screen.queryByRole('region', { name: /family tree preview/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Fictional Rookie')).not.toBeInTheDocument();
  });

  it('does not request family data while upstream assignment reads are incomplete', () => {
    renderPanel(false);
    expect(screen.getByRole('button', { name: 'Preview family branches' })).toBeDisabled();
    expect(getAdminFamilies).not.toHaveBeenCalled();
  });
});
