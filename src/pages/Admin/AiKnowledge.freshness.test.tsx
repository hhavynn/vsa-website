import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminAiKnowledge from './AiKnowledge';
import { AiKnowledgeSnippet, aiKnowledgeRepository } from '../../data/repos/aiKnowledge';
import { academicTermsRepository } from '../../data/repos/academicTerms';
import { ValidationError } from '../../data/errors';

jest.mock('../../data/repos/aiKnowledge', () => ({
  ...jest.requireActual('../../data/repos/aiKnowledge'),
  aiKnowledgeRepository: {
    listAdminSnippets: jest.fn(),
    listLatestReviews: jest.fn(),
    loadEntityContext: jest.fn(),
    markReviewed: jest.fn(),
    createSnippet: jest.fn(),
    updateSnippet: jest.fn(),
    setSnippetActive: jest.fn(),
  },
}));
jest.mock('../../data/repos/academicTerms', () => ({ academicTermsRepository: { getActiveTerm: jest.fn() } }));

const repo = aiKnowledgeRepository as unknown as Record<string, jest.Mock>;

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const daysAhead = (days: number) => new Date(Date.now() + days * DAY).toISOString();

function snippet(overrides: Partial<AiKnowledgeSnippet>): AiKnowledgeSnippet {
  return {
    id: 'id',
    title: 'Snippet',
    content: 'Public-safe fact.',
    category: 'general',
    source_type: 'manual',
    source_url: null,
    is_public: true,
    is_active: true,
    priority: 0,
    tags: [],
    aliases: [],
    confidence: 'high',
    freshness: 'stable',
    academic_year: null,
    valid_until: null,
    last_verified_at: daysAgo(10),
    linked_entity_type: null,
    linked_entity_key: null,
    created_at: daysAgo(400),
    updated_at: daysAgo(10),
    ...overrides,
  };
}

const EVERGREEN = snippet({ id: 'evergreen', title: 'What is VSA?', last_verified_at: daysAgo(900), created_at: daysAgo(1000), priority: 9 });
const EXPIRED = snippet({ id: 'expired', title: 'GBM 1 location', valid_until: daysAgo(2), priority: 1 });
const DUE = snippet({ id: 'due', title: 'Quarterly points rules', freshness: 'quarterly', last_verified_at: daysAgo(200), priority: 5 });
const UNPUBLISHED_LINK = snippet({ id: 'linked', title: 'Secret mixer', linked_entity_type: 'event', linked_entity_key: 'draft-event', last_verified_at: daysAgo(3), priority: 3 });

function renderPage(url = '/admin/ai-knowledge') {
  const client = new QueryClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <AdminAiKnowledge />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, invalidate };
}

// Each list entry is one button whose accessible name carries the title, badges and reason.
const listItem = (title: string) => screen.getByRole('button', { name: new RegExp(title) });

beforeEach(() => {
  jest.resetAllMocks();
  repo.listAdminSnippets.mockResolvedValue([EVERGREEN, EXPIRED, DUE, UNPUBLISHED_LINK]);
  repo.listLatestReviews.mockResolvedValue(new Map());
  repo.loadEntityContext.mockResolvedValue({ applications: [], events: [{ id: 'draft-event', date: daysAhead(30), end_date: null, is_published: false, updated_at: daysAgo(30) }] });
  (academicTermsRepository.getActiveTerm as jest.Mock).mockResolvedValue({ academic_year_start: 2026 });
});

describe('Ask VSA knowledge freshness', () => {
  it('does not flag an evergreen row for being old, and explains why the others are flagged', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'What is VSA?', level: 3 });

    expect(within(listItem('What is VSA?')).queryByText(/stale|review due/i)).not.toBeInTheDocument();
    expect(within(listItem('GBM 1 location')).getByText('Stale')).toBeInTheDocument();
    expect(within(listItem('GBM 1 location')).getByText(/Time-bound fact expired .* no longer uses it/)).toBeInTheDocument();
    expect(within(listItem('Quarterly points rules')).getByText('Review due')).toBeInTheDocument();
    expect(within(listItem('Quarterly points rules')).getByText(/Marked quarterly; last reviewed/)).toBeInTheDocument();
    // The entity rules arrive once the linked rows have been read.
    await waitFor(() => expect(within(listItem('Secret mixer')).getByText(/not published, but this snippet is public/)).toBeInTheDocument());
  });

  it('filters to what needs review and puts the most urgent first', async () => {
    renderPage('/admin/ai-knowledge?filter=review');
    await screen.findByRole('heading', { name: 'GBM 1 location', level: 3 });
    await waitFor(() => expect(screen.getByRole('button', { name: /Needs review 3/ })).toHaveAttribute('aria-pressed', 'true'));

    const titles = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(titles).not.toContain('What is VSA?');
    // High (unpublished link) before medium (expired) before low (quarterly), despite priorities 3 / 1 / 5.
    expect(titles.slice(0, 3)).toEqual(['Secret mixer', 'GBM 1 location', 'Quarterly points rules']);
  });

  it('marks a row reviewed without rewriting it, and the row stops being due', async () => {
    const reviewedAt = new Date().toISOString();
    repo.markReviewed.mockImplementation(async (row: AiKnowledgeSnippet) => ({ ...row, last_verified_at: reviewedAt }));
    const { invalidate } = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Quarterly points rules/ }));

    fireEvent.click(await screen.findByRole('button', { name: 'Mark reviewed' }));

    await screen.findByText('Marked as reviewed. The text was not changed.');
    expect(repo.markReviewed).toHaveBeenCalledWith(expect.objectContaining({ id: 'due', title: 'Quarterly points rules' }));
    expect(repo.updateSnippet).not.toHaveBeenCalled();
    expect(repo.createSnippet).not.toHaveBeenCalled();
    await waitFor(() => expect(within(listItem('Quarterly points rules')).queryByText('Review due')).not.toBeInTheDocument());
    // The Overview count and Content Health refresh.
    expect(invalidate).toHaveBeenCalledWith('admin-health');
    expect(screen.getByText(/Last reviewed .* by you/)).toBeInTheDocument();
  });

  it('says an expired date needs a new date, not a review', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /GBM 1 location/ }));

    expect(await screen.findByText(/Marking it reviewed will not fix this/)).toBeInTheDocument();
  });

  it('shows who last reviewed it, from the activity log, only when that entry is the current review', async () => {
    const reviewedAt = daysAgo(1);
    repo.listAdminSnippets.mockResolvedValue([snippet({ id: 'due', title: 'Quarterly points rules', freshness: 'quarterly', last_verified_at: reviewedAt })]);
    repo.listLatestReviews.mockResolvedValue(new Map([['due', { reviewedAt, reviewer: 'Havyn' }]]));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Quarterly points rules/ }));
    expect(await screen.findByText(/Last reviewed .* by Havyn/)).toBeInTheDocument();
  });

  it('does not credit a reviewer when the review date was edited past the log entry', async () => {
    repo.listAdminSnippets.mockResolvedValue([snippet({ id: 'due', title: 'Quarterly points rules', freshness: 'quarterly', last_verified_at: daysAgo(1) })]);
    repo.listLatestReviews.mockResolvedValue(new Map([['due', { reviewedAt: daysAgo(40), reviewer: 'Havyn' }]]));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Quarterly points rules/ }));
    expect(await screen.findByText(/Last reviewed [A-Z][a-z]{2} \d+, \d{4}\./)).toBeInTheDocument();
    expect(screen.queryByText(/by Havyn/)).not.toBeInTheDocument();
  });

  describe('saving', () => {
    const TIMED = snippet({ id: 'timed', title: 'Dinner night', valid_until: '2026-12-11T08:00:00.000Z', last_verified_at: '2026-09-20T19:00:00.000Z' });

    beforeEach(() => {
      repo.listAdminSnippets.mockResolvedValue([TIMED]);
      repo.updateSnippet.mockImplementation(async (_id: string, payload: Record<string, unknown>) => ({ ...TIMED, ...payload }));
    });

    it('does not re-stamp the review date or drift the expiry date when other edits are saved', async () => {
      renderPage();
      await screen.findByRole('button', { name: /Dinner night/ });
      // Pacific midnight on Dec 11 is the end of Dec 10, whatever timezone the browser is in.
      expect(screen.getByLabelText(/^Valid until/)).toHaveValue('2026-12-10');
      fireEvent.change(screen.getByLabelText(/^Content/), { target: { value: 'Updated public-safe fact.' } });

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(repo.updateSnippet).toHaveBeenCalled());
      const payload = repo.updateSnippet.mock.calls[0][1];
      expect(payload.valid_until).toBe('2026-12-11T08:00:00.000Z');
      // Left undefined, which the repository leaves out of the update entirely.
      expect(payload.last_verified_at).toBeUndefined();
      expect(payload.linked_entity_type).toBeUndefined();
    });

    it('stamps the review date only when the admin changes that field, and refuses a date in the future', async () => {
      renderPage();
      await screen.findByRole('button', { name: /Dinner night/ });

      fireEvent.change(screen.getByLabelText('Last verified date'), { target: { value: '2999-01-01' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByText('Last verified date cannot be in the future.')).toBeInTheDocument();
      expect(repo.updateSnippet).not.toHaveBeenCalled();

      fireEvent.change(screen.getByLabelText('Last verified date'), { target: { value: '2026-09-25' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(repo.updateSnippet).toHaveBeenCalled());
      expect(repo.updateSnippet.mock.calls[0][1].last_verified_at).toBe('2026-09-25T19:00:00.000Z');
    });

    it('keeps the application windows other snippets rely on when an unrelated snippet is saved', async () => {
      const LINKED = snippet({ id: 'app', title: 'House fall window', linked_entity_type: 'application', linked_entity_key: 'house_fall', last_verified_at: new Date().toISOString() });
      const PLAIN = snippet({ id: 'plain', title: 'Plain fact' });
      repo.listAdminSnippets.mockResolvedValue([LINKED, PLAIN]);
      // The first load finds the window; a later read for the unlinked snippet would return nothing.
      repo.loadEntityContext.mockImplementation(async (rows: AiKnowledgeSnippet[]) => ({
        applications: rows.some((r) => r.linked_entity_type === 'application') ? [{ application_key: 'house_fall', due_at: daysAhead(30), updated_at: daysAgo(100) }] : [],
        events: [],
      }));
      repo.updateSnippet.mockImplementation(async (_id: string, payload: Record<string, unknown>) => ({ ...PLAIN, ...payload }));
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: /Plain fact/ }));
      await waitFor(() => expect(repo.loadEntityContext).toHaveBeenCalled());

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(repo.updateSnippet).toHaveBeenCalled());

      // The application-linked snippet must not turn into "no longer exists" (High).
      expect(await screen.findByRole('button', { name: /House fall window/ })).toBeInTheDocument();
      expect(screen.queryByText(/no longer exists/)).not.toBeInTheDocument();
    });

    it('shows the repository\u2019s refusal when a snippet cannot be reactivated against a draft event', async () => {
      repo.listAdminSnippets.mockResolvedValue([snippet({ id: 'off', title: 'Draft mixer', is_active: false, linked_entity_type: 'event', linked_entity_key: 'draft-event' })]);
      repo.setSnippetActive.mockRejectedValue(new ValidationError('That event is not published, so Ask VSA cannot use it.', 'linked_entity_key'));
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: /Draft mixer/ }));

      fireEvent.click(await screen.findByRole('button', { name: 'Reactivate' }));

      expect(await screen.findByText(/not published/)).toBeInTheDocument();
    });
  });
});
