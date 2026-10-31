import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ApplicationCTA, publicApplicationAtTime } from './ApplicationCTA';
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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
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

// Each clock spy is restored even when an assertion fails.
afterEach(() => jest.restoreAllMocks());

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
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-28T12:00:00Z'));

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
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-28T12:00:00Z'));

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

describe('public closed-window next steps and cached form safety (#276)', () => {
  beforeEach(() => supabaseMock.reset());

  it('links to an actually scheduled different program without ever exposing its future form URL', async () => {
    supabaseMock.setDefault('public_application_links', {
      data: [
        linkRow({ status: 'closed', target_url: 'https://closed-form.invalid/private' }),
        linkRow({
          id: 'ace-upcoming',
          application_key: 'ace_application',
          title: 'ACE Application',
          status: 'not_open',
          open_at: '2099-03-15T00:00:00Z',
          due_at: '2099-03-22T00:00:00Z',
          target_url: 'https://future-form.invalid/hidden',
          before_open_message: null,
          sort_order: 40,
        }),
      ],
      error: null,
    });
    const { container } = renderCTA();
    expect(await screen.findByRole('complementary', { name: 'Upcoming VSA application windows' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ACE Application' })).toHaveAttribute('href', '/ace');
    expect(screen.getByText(/Scheduled to open Mar 14, 2099/i)).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('future-form.invalid');
    expect(container.innerHTML).not.toContain('closed-form.invalid');
  });

  it('does not advertise a date for an invalid or past opening, or for disabled future forms', async () => {
    supabaseMock.setDefault('public_application_links', {
      data: [
        linkRow({ status: 'closed', target_url: null }),
        linkRow({
          id: 'future-invalid',
          application_key: 'ace_application',
          status: 'not_open',
          open_at: 'not-a-date',
          target_url: null,
        }),
        linkRow({
          id: 'future-disabled',
          application_key: 'intern_application',
          status: 'not_open',
          is_enabled: false,
          open_at: '2099-03-15T00:00:00Z',
          target_url: null,
        }),
      ],
      error: null,
    });
    renderCTA();
    expect(await screen.findByText('House applications have closed for fall.')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Upcoming VSA application windows' })).not.toBeInTheDocument();
  });

  it('displays an unavailable state on any public query failure rather than falsely declaring the window closed', async () => {
    supabaseMock.setDefault('public_application_links', {
      data: null,
      error: { message: 'permission denied', code: '42501' },
    });
    renderCTA();
    expect(await screen.findByText(/Application availability cannot be confirmed right now/i)).toBeInTheDocument();
    expect(screen.queryByText('Page fallback: closed.')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Instagram' })).toHaveAttribute('href', expect.stringContaining('instagram.com'));
  });

  it('drops a cached form URL once its window closes without promoting any not-open row', () => {
    const row = linkRow({
      status: 'open',
      open_at: '2026-10-29T15:00:00Z',
      due_at: '2026-10-29T18:00:00Z',
      target_url: 'https://open-form.invalid/private',
    });
    const withinWindow = publicApplicationAtTime(row as any, new Date('2026-10-29T17:00:00Z'));
    expect(withinWindow.status).toBe('open');
    expect(withinWindow.target_url).toBe('https://open-form.invalid/private');

    const expired = publicApplicationAtTime(row as any, new Date('2026-10-29T18:00:01Z'));
    expect(expired.status).toBe('closed');
    expect(expired.target_url).toBeNull();

    const upcoming = publicApplicationAtTime(
      { ...row, status: 'not_open', target_url: null } as any,
      new Date('2026-10-30T17:00:00Z'),
    );
    expect(upcoming.status).toBe('not_open');
    expect(upcoming.target_url).toBeNull();

    const disabled = publicApplicationAtTime(
      { ...row, is_enabled: false } as any,
      new Date('2026-10-29T17:00:00Z'),
    );
    expect(disabled.status).toBe('disabled');
    expect(disabled.target_url).toBeNull();
  });
});
