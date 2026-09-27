import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
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
      <ApplicationCTA
        applicationKeys="house_fall"
        fallback={{ not_open: 'Page fallback: not open.', closed: 'Page fallback: closed.' }}
      />
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
