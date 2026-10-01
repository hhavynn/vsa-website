/**
 * Admin -> ACE: every node shows its canonical member-link status, and admins
 * can link, change, unlink, and bulk-link exact matches without SQL.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminAceFamilies from './AceFamilies';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const family = {
  id: 'fam-moon',
  name: 'Moon',
  slug: 'moon',
  description: null,
  cover_image_url: null,
  theme_color: null,
  display_order: 0,
  is_published: true,
  academic_year_start: null,
  academic_year_end: null,
  created_at: '',
  updated_at: '',
};

const node = (id: string, name: string, memberId: string | null) => ({
  id,
  family_id: family.id,
  name,
  role_label: null,
  photo_url: null,
  parent_member_id: null,
  member_id: memberId,
  display_order: 0,
  is_published: true,
  created_at: '',
  updated_at: '',
  ace_families: { name: family.name },
});

const nodes = [
  node('n-havyn', 'Havyn Nguyen', 'm-havyn'),
  node('n-tommy', 'Tommy Tran', null),
  node('n-andy', 'Andy Tran', null),
  node('n-alum', 'Old Alumni Name', null),
];

const member = (id: string, first: string, last: string, college: string, year: string | null) => ({
  id,
  first_name: first,
  last_name: last,
  college,
  year,
});

beforeEach(() => {
  supabaseMock.reset();
  supabaseMock.setDefault('ace_families', { data: [family], error: null });
  supabaseMock.setDefault('ace_family_members', { data: nodes, error: null });
  supabaseMock.setDefault('public_members', {
    data: [
      member('m-havyn', 'Havyn', 'Nguyen', 'Sixth', 'Fourth Year'),
      member('m-tommy', 'Tommy', 'Tran', 'Sixth', 'Third Year'),
      member('m-andy-1', 'Andy', 'Tran', 'Seventh', null),
      member('m-andy-2', 'Andy', 'Tran', 'Muir', null),
    ],
    error: null,
  });
});

async function openMoon() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminAceFamilies />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /Moon/ }));
  await screen.findByText('1 / 4 linked');
  await screen.findByRole('button', { name: 'Review 3 unlinked' });
}

const linkUpdates = () =>
  supabaseMock
    .queriesFor('ace_family_members')
    .filter((query) => query.calls.some((call) => call.method === 'update'))
    .map((query) => ({
      payload: query.calls.find((call) => call.method === 'update')?.args[0] as Record<string, unknown>,
      calls: query.calls,
    }));

it('shows linked, suggested, ambiguous, and unmatched status for each node', async () => {
  await openMoon();
  expect(screen.getByText('Havyn Nguyen · Sixth · Fourth Year')).toBeInTheDocument();
  expect(screen.getByText('Linked to VSA member')).toBeInTheDocument();
  expect(screen.getAllByText('Not linked')).toHaveLength(3);
  expect(screen.getByText('Suggested match')).toBeInTheDocument();
  expect(screen.getByText(/2 possible members\. Check which person/)).toBeInTheDocument();
  expect(screen.getAllByRole('img', { name: 'Linked to VSA member' }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole('img', { name: 'Not linked: possible member match' }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole('img', { name: 'Not linked: no member match' }).length).toBeGreaterThan(0);
});

it('accepts a suggested match with one click and can unlink explicitly', async () => {
  await openMoon();
  fireEvent.click(screen.getByRole('button', { name: 'Link to Tommy Tran · Sixth · Third Year' }));
  await waitFor(() => expect(linkUpdates()).toHaveLength(1));
  expect(linkUpdates()[0].payload).toEqual(expect.objectContaining({ member_id: 'm-tommy' }));

  fireEvent.click(await screen.findByRole('button', { name: 'Unlink' }));
  await waitFor(() => expect(linkUpdates()).toHaveLength(2));
  expect(linkUpdates()[1].payload).toEqual(expect.objectContaining({ member_id: null }));
  expect(linkUpdates()[1].calls).toContainEqual({ method: 'eq', args: ['id', 'n-havyn'] });
});

it('blocks link changes during an unsaved rename and clears the link on save', async () => {
  await openMoon();
  const nameInput = screen.getByDisplayValue('Havyn Nguyen');
  fireEvent.change(nameInput, { target: { value: 'Someone Else' } });
  expect(screen.getByText(/Renaming a node clears its member link/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Unlink' })).toBeDisabled();

  const row = nameInput.closest('div.rounded.border') as HTMLElement;
  fireEvent.click(within(row).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(linkUpdates()).toHaveLength(1));
  expect(linkUpdates()[0].payload).toEqual(expect.objectContaining({ name: 'Someone Else', member_id: null }));
});

it('bulk-links only the exact unique matches from Review Unlinked', async () => {
  await openMoon();
  fireEvent.click(screen.getByRole('button', { name: 'Review 3 unlinked' }));
  const panel = screen.getByRole('region', { name: 'Review unlinked ACE members' });
  expect(within(panel).getByText('Exact matches (1)')).toBeInTheDocument();
  expect(within(panel).getByText('Needs manual review (1)')).toBeInTheDocument();
  expect(within(panel).getByText('No member record (1)')).toBeInTheDocument();

  fireEvent.click(within(panel).getByRole('button', { name: 'Link 1 obvious match' }));
  await waitFor(() => expect(linkUpdates()).toHaveLength(1));
  const [update] = linkUpdates();
  expect(update.payload).toEqual(expect.objectContaining({ member_id: 'm-tommy' }));
  expect(update.calls).toContainEqual({ method: 'eq', args: ['id', 'n-tommy'] });
  expect(update.calls).toContainEqual({ method: 'is', args: ['member_id', null] });
});
