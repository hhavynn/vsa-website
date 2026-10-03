import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminPageHeader } from './AdminPageHeader';

const at = (path: string, ui: React.ReactElement) => render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);

describe('AdminPageHeader', () => {
  it('takes its title and breadcrumb trail from the nav config', () => {
    at('/admin/events', <AdminPageHeader />);
    expect(screen.getByRole('heading', { level: 1, name: 'Events' })).toBeInTheDocument();
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(trail).toHaveTextContent('Admin');
    expect(trail).toHaveTextContent('Member Experience');
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });

  it('links parents on nested routes and marks the current page', () => {
    at('/admin/cabinet/rollover', <AdminPageHeader />);
    expect(screen.getByRole('link', { name: 'Cabinet' })).toHaveAttribute('href', '/admin/cabinet');
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('Cabinet Rollover')).toHaveAttribute('aria-current', 'page');
  });

  it('appends a detail crumb and renders the actions slot', () => {
    at('/admin/ace', <AdminPageHeader detail="Smith fam" actions={<button>New fam</button>} description="Families" />);
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('Smith fam')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'ACE Families' })).toHaveAttribute('href', '/admin/ace');
    expect(screen.getByRole('button', { name: 'New fam' })).toBeInTheDocument();
    expect(screen.getByText('Families')).toBeInTheDocument();
  });

  it('shows no breadcrumb on the dashboard root and respects a title override', () => {
    at('/admin', <AdminPageHeader title="Welcome" />);
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument();
  });
});
