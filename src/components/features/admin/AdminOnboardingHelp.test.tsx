import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ResourceLink } from '../../../types';
import { AdminOnboardingHelp, selectOnboardingResources } from './AdminOnboardingHelp';

const mockUseResources = jest.fn();
jest.mock('../../../hooks/useResourceLinks', () => ({
  useResourceLinks: () => mockUseResources(),
}));

const resource = (overrides: Partial<ResourceLink> = {}): ResourceLink => ({
  id: 'r1',
  title: 'New Cabinet Guide',
  description: 'Updated by Cabinet',
  url: 'https://example.org/cabinet/guide',
  category: 'Transition Docs',
  role: null,
  program: null,
  workflow: 'onboarding',
  academic_year_start: null,
  academic_year_end: null,
  is_current: true,
  is_archived: false,
  visibility: 'admin_only',
  owner_role: null,
  last_verified_at: null,
  created_by: null,
  updated_by: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  ...overrides,
});

beforeEach(() => {
  mockUseResources.mockReturnValue({
    resources: [resource()],
    loading: false,
    error: null,
  });
});

describe('admin first-run and contextual guidance (#286)', () => {
  it('does not load editable resources until opened, and remains dismissible', () => {
    render(<MemoryRouter initialEntries={['/admin/events']}><AdminOnboardingHelp /></MemoryRouter>);
    expect(mockUseResources).not.toHaveBeenCalled();
    const toggle = screen.getByRole('button', { name: 'New to admin? Help for this page' });
    fireEvent.click(toggle);
    expect(mockUseResources).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Events: what this page does' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /New Cabinet Guide/ })).toHaveAttribute('href', 'https://example.org/cabinet/guide');
    fireEvent.click(screen.getByRole('button', { name: 'Hide admin help' }));
    expect(screen.queryByRole('heading', { name: 'Events: what this page does' })).not.toBeInTheDocument();
  });

  it('warns about protected attendance work and links to core workflow screens', () => {
    render(<MemoryRouter initialEntries={['/admin/import']}><AdminOnboardingHelp /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /New to admin/ }));
    expect(screen.getByRole('note')).toHaveTextContent(/Attendance imports may change member event history and points/);
    expect(screen.getByRole('link', { name: 'Import event attendance' })).toHaveAttribute('href', '/admin/import');
    expect(screen.getByRole('link', { name: 'Open an application window' })).toHaveAttribute('href', '/admin/applications');
    const help = screen.getByRole('region', { name: 'Admin guidance' });
    expect(within(help).getByRole('heading', { name: 'Common workflows' })).toBeInTheDocument();
  });

  it('filters closed, archived, unsafe, and unrelated program links out of cabinet help', () => {
    const items = [
      resource({ id: 'open' }),
      resource({ id: 'archived', is_archived: true }),
      resource({ id: 'public', visibility: 'public' }),
      resource({ id: 'past', is_current: false }),
      resource({ id: 'unsafe', url: 'javascript:alert(1)' }),
      resource({ id: 'scoped', program: 'Houses' }),
      resource({ id: 'wrong-role', role: 'President' }),
      resource({ id: 'unrelated', category: 'Marketing', workflow: 'meeting' }),
    ];
    expect(selectOnboardingResources(items, 'Events').map((item) => item.id)).toEqual(['open']);
  });

  it('does not imply missing resource links block access to existing admin tools', () => {
    mockUseResources.mockReturnValue({ resources: [], loading: false, error: new Error('offline') });
    render(<MemoryRouter initialEntries={['/admin']}><AdminOnboardingHelp /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /New to admin/ }));
    expect(screen.getByText(/Resources unavailable/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Publish an event' })).toHaveAttribute('href', '/admin/events');
  });
});
