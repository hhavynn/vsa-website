import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { ApplicationCTA } from './ApplicationCTA';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

function linkRow(overrides: Record<string, unknown>) {
  return {
    id: 'house-fall',
    application_key: 'house_fall',
    title: 'House Application — Fall',
    description: null,
    button_label: 'Apply for a House',
    target_url: null,
    status: 'not_open',
    open_at: '2026-11-21T08:00:00Z',
    due_at: '2026-12-05T07:59:00Z',
    is_enabled: true,
    before_open_message: 'House applications open at GBM #2 on November 21.',
    after_close_message: 'House applications have closed for fall.',
    sort_order: 20,
    updated_at: '2026-09-26T00:00:00Z',
    ...overrides,
  };
}

function renderCTA() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ApplicationCTA
          applicationKeys="house_fall"
          fallback={{ not_open: 'Page fallback: not open.', closed: 'Page fallback: closed.' }}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ApplicationCTA message precedence', () => {
  beforeEach(() => supabaseMock.reset());

  it('shows the admin-authored before-open message over the page fallback', async () => {
    supabaseMock.setDefault('public_application_links', { data: [linkRow({})], error: null });
    renderCTA();

    expect(await screen.findByText('House applications open at GBM #2 on November 21.')).toBeInTheDocument();
    expect(screen.queryByText('Page fallback: not open.')).not.toBeInTheDocument();
  });

  it('shows the admin-authored after-close message over the page fallback', async () => {
    supabaseMock.setDefault('public_application_links', { data: [linkRow({ status: 'closed' })], error: null });
    renderCTA();

    expect(await screen.findByText('House applications have closed for fall.')).toBeInTheDocument();
  });

  it('uses the page fallback when the row has no message', async () => {
    supabaseMock.setDefault('public_application_links', { data: [linkRow({ before_open_message: null })], error: null });
    renderCTA();

    expect(await screen.findByText('Page fallback: not open.')).toBeInTheDocument();
  });
});


  it('keeps closed form URLs out of the DOM while offering useful next steps', async () => {
    supabaseMock.setDefault('public_application_links', {
      data: [linkRow({ status: 'closed', target_url: 'https://hidden-form.invalid/sensitive' })],
      error: null,
    });
    const { container } = renderCTA();

    expect(await screen.findByText('House applications have closed for fall.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /VSA on Instagram/i })).toHaveAttribute('href', expect.stringContaining('instagram'));
    expect(screen.getByRole('link', { name: /explore VSA programs/i })).toHaveAttribute('href', '/get-involved#programs');
    expect(container.innerHTML).not.toContain('hidden-form.invalid');
  });

  it('announces only real configured upcoming dates, not invented deadlines', async () => {
    supabaseMock.setDefault('public_application_links', {
      data: [linkRow({ before_open_message: null, open_at: '2026-11-21T08:00:00Z' })],
      error: null,
    });
    renderCTA();
    expect(await screen.findByText(/Scheduled to open Nov 21, 2026/i)).toBeInTheDocument();
    expect(screen.getByText('Page fallback: not open.')).toBeInTheDocument();
  });

  it('points closed-window visitors to a different genuinely open program page, never its form URL', async () => {
    supabaseMock.setDefault('public_application_links', {
      data: [
        linkRow({ status: 'closed' }),
        linkRow({ id: 'ace', application_key: 'ace_application', status: 'open', target_url: 'https://open-form.invalid/ace' }),
      ],
      error: null,
    });
    const { container } = renderCTA();
    expect(await screen.findByRole('complementary', { name: /Other open VSA opportunities/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ACE Application' })).toHaveAttribute('href', '/ace');
    expect(container.innerHTML).not.toContain('open-form.invalid');
  });

  it('does not suggest other programs when this application window is already open', async () => {
    supabaseMock.setDefault('public_application_links', {
      data: [
        linkRow({ status: 'open', target_url: 'https://open-form.invalid/house' }),
        linkRow({ id: 'ace', application_key: 'ace_application', status: 'open', target_url: 'https://open-form.invalid/ace' }),
      ],
      error: null,
    });
    renderCTA();
    expect(await screen.findByRole('link', { name: /Apply for a House/i })).toHaveAttribute('href', 'https://open-form.invalid/house');
    expect(screen.queryByRole('complementary', { name: /Other open VSA opportunities/i })).not.toBeInTheDocument();
  });
