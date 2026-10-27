import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { useAdminSearchOpener } from './AdminSearchContext';

jest.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { email: 'cab@vsaucsd.org' } }) }));
jest.mock('../../../hooks/useAdminSearch', () => ({ useAdminSearch: () => ({ results: [], loading: false, failed: false }) }));

function Page() {
  const openSearch = useAdminSearchOpener();
  return (
    <div>
      <h1>Page</h1>
      <button onClick={openSearch}>page search</button>
      <Link to="/admin/members">go to members</Link>
    </div>
  );
}

function renderLayout(path = '/admin/events') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="/admin/events" element={<Page />} />
          <Route path="/admin/members" element={<Page />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminLayout', () => {
  it('names the current page in the mobile bar and offers menu and search', () => {
    renderLayout('/admin/events');
    expect(screen.getAllByText('Events').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Open admin navigation' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('button', { name: 'Search admin' }).length).toBeGreaterThanOrEqual(2);
  });

  it('opens the drawer from the menu button and closes it on Escape, returning focus', async () => {
    renderLayout();
    const menu = screen.getByRole('button', { name: 'Open admin navigation' });
    menu.focus();
    fireEvent.click(menu);
    expect(screen.getByRole('dialog', { name: 'Admin navigation' })).toBeInTheDocument();
    expect(menu).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(menu).toHaveFocus();
  });

  it('closes the drawer after navigating from it', async () => {
    renderLayout('/admin/events');
    fireEvent.click(screen.getByRole('button', { name: 'Open admin navigation' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getAllByRole('link', { name: 'Members' })[0]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('opens Quick Search from the mobile bar, the sidebar, the page, and Cmd/Ctrl+K', async () => {
    renderLayout();
    fireEvent.click(screen.getAllByRole('button', { name: 'Search admin' })[0]);
    expect(await screen.findByRole('dialog', { name: 'Search admin' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Search admin' })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'page search' }));
    expect(await screen.findByRole('dialog', { name: 'Search admin' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Search admin' })).not.toBeInTheDocument());

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(await screen.findByRole('dialog', { name: 'Search admin' })).toBeInTheDocument();
  });
});
