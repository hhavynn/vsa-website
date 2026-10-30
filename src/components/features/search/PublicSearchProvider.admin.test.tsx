import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminLayout from '../admin/AdminLayout';
import { PublicSearchButton } from './PublicSearchButton';
import { PublicSearchProvider } from './PublicSearchProvider';

// The public shell wraps the admin, so both search dialogs are mounted on
// /admin routes and only the admin one may answer the keyboard there.

jest.mock('../../../lib/supabase', () => ({
  get supabase() {
    return require('../../../test-utils/supabaseMock').supabaseMock.client;
  },
}));
jest.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { email: 'cab@vsaucsd.org' } }) }));
jest.mock('../../../hooks/useAdminSearch', () => ({ useAdminSearch: () => ({ results: [], loading: false, failed: false }) }));
jest.mock('../../../hooks/usePublicSearchIndex', () => ({
  usePublicSearchIndex: () => ({ entries: [], loading: false, failed: [] }),
}));

const ADMIN_DIALOG = { name: 'Search admin' };
const PUBLIC_DIALOG = { name: 'Search the site' };

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <PublicSearchProvider>
          <PublicSearchButton />
          <Routes>
            <Route path="/" element={<Link to="/admin/events">to admin</Link>} />
            <Route element={<AdminLayout />}>
              <Route path="/admin/events" element={<Link to="/">to public</Link>} />
            </Route>
            <Route path="*" element={null} />
          </Routes>
        </PublicSearchProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The public dialog is lazy: let its chunk land before asserting it stayed closed. */
async function settleLazyDialog() {
  await act(async () => {
    await import('./PublicSearchDialog');
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('search shortcuts on admin routes', () => {
  it.each([
    ['Ctrl+K', { ctrlKey: true }],
    ['Cmd+K', { metaKey: true }],
  ])('%s opens and closes only the admin palette', async (_label, modifier) => {
    renderAt('/admin/events');

    fireEvent.keyDown(document, { key: 'k', ...modifier });
    expect(await screen.findByRole('dialog', ADMIN_DIALOG)).toBeInTheDocument();
    await settleLazyDialog();
    expect(screen.queryByRole('dialog', PUBLIC_DIALOG)).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'k', ...modifier });
    await waitFor(() => expect(screen.queryByRole('dialog', ADMIN_DIALOG)).not.toBeInTheDocument());
    await settleLazyDialog();
    expect(screen.queryByRole('dialog', PUBLIC_DIALOG)).not.toBeInTheDocument();
  });

  it('does not open public search with "/"', async () => {
    renderAt('/admin/events');
    fireEvent.keyDown(document, { key: '/' });
    await settleLazyDialog();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('applies after navigating in from a public page', async () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('link', { name: 'to admin' }));
    await screen.findByRole('link', { name: 'to public' });

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(await screen.findByRole('dialog', ADMIN_DIALOG)).toBeInTheDocument();
    await settleLazyDialog();
    expect(screen.queryByRole('dialog', PUBLIC_DIALOG)).not.toBeInTheDocument();
  });

  it('returns the shortcut to public search after leaving the admin', async () => {
    renderAt('/admin/events');
    fireEvent.click(screen.getByRole('link', { name: 'to public' }));
    await screen.findByRole('link', { name: 'to admin' });

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(await screen.findByRole('dialog', PUBLIC_DIALOG)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', ADMIN_DIALOG)).not.toBeInTheDocument();
  });

  it('leaves the shortcut alone on routes that only look like the admin', async () => {
    renderAt('/administration');
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(await screen.findByRole('dialog', PUBLIC_DIALOG)).toBeInTheDocument();
  });

  it('stops advertising the shortcut on the header button while it belongs to the admin', async () => {
    renderAt('/admin/events');
    const button = screen.getByRole('button', { name: 'Search the site' });
    expect(button).not.toHaveAttribute('aria-keyshortcuts');
    expect(button).not.toHaveTextContent(/K$/);

    fireEvent.click(button);
    expect(await screen.findByRole('dialog', PUBLIC_DIALOG)).toBeInTheDocument();
  });

  it('keeps advertising it on public pages', () => {
    renderAt('/');
    const button = screen.getByRole('button', { name: 'Search the site' });
    expect(button).toHaveAttribute('aria-keyshortcuts', 'Control+K Meta+K /');
    expect(button).toHaveTextContent(/K$/);
  });
});
