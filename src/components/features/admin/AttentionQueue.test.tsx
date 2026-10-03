import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AttentionQueue } from './AttentionQueue';
import { ClosingSoonApplications } from '../home/ClosingSoonApplications';
import { AttentionSignals } from '../../../lib/adminAttention';
import { PublicApplicationLink } from '../../../types';

// Thu Oct 1 2026, 9:00 AM PDT.
const NOW = new Date('2026-10-01T16:00:00Z');

let mockPublicLinks: PublicApplicationLink[] = [];
jest.mock('../../../hooks/useApplicationLinks', () => ({
  usePublicApplicationLinks: () => ({ links: mockPublicLinks, loading: false, error: null }),
}));

const CLEAR: AttentionSignals = {
  applications: [],
  draftEventDates: [],
  photoRequestsPending: 0,
  dataRightsOpen: 0,
  aiFeedbackUnresolved: 0,
  feedbackPending: 0,
};

function renderQueue(signals: AttentionSignals | null, loading = false) {
  return render(
    <MemoryRouter>
      <AttentionQueue signals={signals} loading={loading} now={NOW} />
    </MemoryRouter>,
  );
}

describe('AttentionQueue', () => {
  it('shows a genuine caught-up state when every source loaded and nothing is waiting', () => {
    renderQueue(CLEAR);
    expect(screen.getByText('You’re all caught up')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('does not claim to be caught up while loading or when a source could not be checked', () => {
    const { unmount } = renderQueue(null, true);
    expect(screen.getByText(/Checking what needs attention/)).toBeInTheDocument();
    expect(screen.queryByText('You’re all caught up')).not.toBeInTheDocument();
    unmount();

    renderQueue({ ...CLEAR, photoRequestsPending: null });
    expect(screen.queryByText('You’re all caught up')).not.toBeInTheDocument();
    expect(screen.getByText(/Could not check: photo requests/)).toBeInTheDocument();
  });

  it('says so when the whole check failed, instead of spinning or claiming all clear', () => {
    render(
      <MemoryRouter>
        <AttentionQueue signals={null} failed />
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not check what needs attention');
    expect(screen.queryByText('You’re all caught up')).not.toBeInTheDocument();
  });

  it('links each count to the page and filter that resolves it', () => {
    renderQueue({ ...CLEAR, photoRequestsPending: 3, aiFeedbackUnresolved: 2, dataRightsOpen: 1 });

    expect(screen.getByRole('link', { name: /3 photo requests waiting for review/ })).toHaveAttribute('href', '/admin/photo-requests?filter=pending');
    expect(screen.getByRole('link', { name: /2 Ask VSA responses need review/ })).toHaveAttribute('href', '/admin/ai-feedback?filter=unresolved');
    expect(screen.getByRole('link', { name: /1 open data-rights request to work through/ })).toHaveAttribute('href', '/admin/data-rights?filter=open');
    expect(screen.queryByText('You’re all caught up')).not.toBeInTheDocument();
  });

  it('renders counts and generic labels only: no names, emails, or request details', () => {
    const { container } = renderQueue({ ...CLEAR, photoRequestsPending: 2, dataRightsOpen: 1, aiFeedbackUnresolved: 1, feedbackPending: 1 });
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/@/);
    // Everything a person could read is a count plus one of the fixed labels.
    const rows = within(container).getAllByRole('link').map((link) => link.textContent);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^1 open data-rights request to work through/),
        expect.stringMatching(/^2 photo requests waiting for review/),
        expect.stringMatching(/^1 Ask VSA response needs review/),
        expect.stringMatching(/^1 feedback item to triage/),
      ]),
    );
  });

  it('uses the same closing-soon helper as the homepage notice for the same window', () => {
    const window = { application_key: 'house_fall' as const, open_at: '2026-09-01T07:00:00Z', due_at: '2026-10-03T06:59:00Z', is_enabled: true };
    renderQueue({ ...CLEAR, applications: [window] });
    const adminLink = screen.getByRole('link', { name: /application window closes within 7 days/ });
    const adminHeadline = within(adminLink).getByText('House Applications close tomorrow').textContent;

    mockPublicLinks = [
      {
        id: 'w1',
        title: 'House Fall',
        description: null,
        button_label: 'Apply',
        target_url: 'https://forms.gle/house',
        status: 'open',
        before_open_message: null,
        after_close_message: null,
        sort_order: 1,
        updated_at: '2026-09-01T00:00:00Z',
        ...window,
      },
    ];
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    try {
      const view = render(
        <MemoryRouter>
          <ClosingSoonApplications />
        </MemoryRouter>,
      );
      expect(within(view.container).getByText('House Applications close tomorrow')).toBeInTheDocument();
      expect(adminHeadline).toBe('House Applications close tomorrow');
    } finally {
      jest.useRealTimers();
      mockPublicLinks = [];
    }
  });
});
