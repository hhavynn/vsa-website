import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LaunchChecklist from './LaunchChecklist';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();

const row = (overrides: Record<string, unknown>) => ({
  id: 'k',
  title: 'Snippet',
  source_type: 'manual',
  is_public: true,
  is_active: true,
  freshness: 'stable',
  academic_year: null,
  valid_until: null,
  last_verified_at: daysAgo(5),
  created_at: daysAgo(300),
  ...overrides,
});

function renderChecklist() {
  return render(
    <MemoryRouter>
      <LaunchChecklist />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  supabaseMock.reset();
  supabaseMock.setDefault('academic_terms', { data: [{ academic_year_start: 2026 }], error: null });
});

describe('Launch Checklist: Ask VSA knowledge is current', () => {
  it('is good when nothing is stale, even if an evergreen row is old', async () => {
    supabaseMock.setDefault('ai_knowledge_base', { data: [row({ id: 'a', last_verified_at: daysAgo(900) })], error: null });
    renderChecklist();

    const check = await screen.findByRole('link', { name: /Ask VSA knowledge is current/ });
    expect(check).toHaveAttribute('href', '/admin/ai-knowledge?filter=review');
    expect(await screen.findByText(/No stale or expired snippets for 2026-2027/)).toBeInTheDocument();
  });

  it('needs attention, with a count and the reason, when a snippet is stale for the new year', async () => {
    supabaseMock.setDefault('ai_knowledge_base', {
      data: [
        row({ id: 'a' }),
        row({ id: 'b', freshness: 'yearly', academic_year: '2025-2026', last_verified_at: daysAgo(150) }),
        row({ id: 'c', valid_until: daysAgo(3) }),
      ],
      error: null,
    });
    renderChecklist();

    expect(await screen.findByText(/2 stale or expired, 0 due for review; 1 high priority/)).toBeInTheDocument();
  });

  it('reads Ask VSA knowledge once, and only public rows', async () => {
    supabaseMock.setDefault('ai_knowledge_base', { data: [], error: null });
    renderChecklist();
    await screen.findByText(/Ask VSA knowledge is current/);

    const reads = supabaseMock.queries().filter((query) => query.table === 'ai_knowledge_base');
    expect(reads).toHaveLength(1);
    expect(reads[0].calls).toContainEqual({ method: 'eq', args: ['is_public', true] });
  });

  it('agrees with the other pages when a snippet is linked to an unpublished event', async () => {
    supabaseMock.setDefault('ai_knowledge_base', { data: [row({ id: 'l', title: 'Secret mixer', linked_entity_type: 'event', linked_entity_key: 'draft-1' })], error: null });
    supabaseMock.setDefault('events', { data: [{ id: 'draft-1', date: daysAgo(-30), end_date: null, is_published: false, updated_at: daysAgo(30) }], error: null });
    renderChecklist();

    expect(await screen.findByText(/1 stale or expired, 0 due for review; 1 high priority/)).toBeInTheDocument();
  });

  it('falls back to the columns that exist when the entity-link migration is not applied yet', async () => {
    supabaseMock.queueResult('ai_knowledge_base', { data: null, error: { code: '42703', message: 'column does not exist' } });
    supabaseMock.queueResult('ai_knowledge_base', { data: [row({ id: 'a' })], error: null });
    renderChecklist();

    expect(await screen.findByText(/No stale or expired snippets for 2026-2027/)).toBeInTheDocument();
  });

  it('shows the not-installed state when the table is missing, instead of a false "current"', async () => {
    supabaseMock.setDefault('ai_knowledge_base', { data: null, error: { code: 'PGRST205', message: 'missing' } });
    renderChecklist();
    expect(await screen.findByText(/ai_knowledge_base table not found/)).toBeInTheDocument();
    expect(screen.queryByText(/Ask VSA knowledge is current/)).not.toBeInTheDocument();
  });

  it('links to Content Health as a manual launch check', async () => {
    supabaseMock.setDefault('ai_knowledge_base', { data: [], error: null });
    renderChecklist();
    const link = await screen.findByRole('link', { name: /Review Content Health: broken images and links/ });
    expect(link).toHaveAttribute('href', '/admin/content-health');
  });
});
