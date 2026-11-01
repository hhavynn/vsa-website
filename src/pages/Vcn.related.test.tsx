import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VCN } from './Vcn';
import type { ApplicationKey, ApplicationStatus, PublicApplicationLink } from '../types';

let mockLinks: PublicApplicationLink[] = [];

jest.mock('../hooks/useApplicationLinks', () => ({
  usePublicApplicationLinks: () => ({ links: mockLinks, loading: false, error: null }),
}));

// Hero photography is covered by ProgramPhotoStack.test.tsx.
jest.mock('../components/features/gallery/ProgramPhotoStack', () => ({
  useProgramHeroMedia: () => undefined,
}));

const OPEN_URL = 'https://forms.example.test/vcn-stage-ninja-open';

function link(key: ApplicationKey, status: ApplicationStatus, targetUrl: string | null): PublicApplicationLink {
  return {
    id: key,
    application_key: key,
    title: key === 'vcn_stage_ninja_interest' ? 'VCN Stage Ninja Interest' : 'VCN Props Team Interest',
    description: null,
    button_label: key === 'vcn_stage_ninja_interest' ? 'Join Stage Ninjas' : 'Join Props Team',
    target_url: targetUrl,
    status,
    open_at: '2026-01-01T00:00:00Z',
    due_at: '2026-12-31T00:00:00Z',
    is_enabled: true,
    before_open_message: null,
    after_close_message: null,
    sort_order: 1,
    updated_at: '2026-01-01T00:00:00Z',
  } as PublicApplicationLink;
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <VCN />
    </MemoryRouter>,
  );

describe('VCN overview related links', () => {
  it('always offers the programs comparison', () => {
    mockLinks = [];
    renderPage();
    expect(screen.getByRole('link', { name: /Compare programs/ })).toHaveAttribute(
      'href',
      '/get-involved#programs',
    );
  });

  it('shows an application CTA only for an open window, with the URL from the application-link model', () => {
    mockLinks = [
      link('vcn_stage_ninja_interest', 'open', OPEN_URL),
      link('vcn_props_team_interest', 'closed', null),
    ];
    renderPage();
    expect(screen.getByRole('link', { name: /Join Stage Ninjas/ })).toHaveAttribute('href', OPEN_URL);
    expect(screen.queryByRole('link', { name: /Join Props Team/ })).not.toBeInTheDocument();
  });

  it.each(['closed', 'not_open', 'disabled'] as const)(
    'keeps VCN interest guidance visible without any form URL while the window is %s',
    (status) => {
      // Even if a stale/leaky row carried a URL, nothing may render for a non-open window.
      mockLinks = [
        link('vcn_stage_ninja_interest', status, 'https://forms.example.test/should-never-render'),
        link('vcn_props_team_interest', status, null),
      ];
      const { container } = renderPage();
      expect(screen.getByText('Get involved in VCN')).toBeInTheDocument();
      expect(screen.getByText('VCN Stage Ninja Interest')).toBeInTheDocument();
      expect(screen.getByText('VCN Props Team Interest')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Join Stage Ninjas|Join Props Team/ })).not.toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: /VSA on Instagram/ })).toHaveLength(2);
      expect(screen.getAllByRole('link', { name: /explore VSA programs/ })).toHaveLength(2);
      expect(container.innerHTML).not.toContain('should-never-render');
      const hrefs = screen.getAllByRole('link').map((anchor) => anchor.getAttribute('href') ?? '');
      expect(hrefs.filter((href) => href.includes('forms.example.test'))).toEqual([]);
      expect(screen.getByRole('link', { name: /Compare programs/ })).toBeInTheDocument();
    },
  );

  it('highlights genuinely open alternatives while VCN interest forms are closed', () => {
    mockLinks = [
      link('vcn_stage_ninja_interest', 'closed', 'https://forms.example.test/hidden-vcn'),
      link('vcn_props_team_interest', 'closed', null),
      link('ace_application', 'open', 'https://forms.example.test/other-application'),
    ];
    const { container } = renderPage();
    const alternatives = screen.getByRole('complementary', { name: 'Other open VSA opportunities' });
    expect(alternatives).toHaveTextContent('ACE Application');
    expect(screen.getByRole('link', { name: 'ACE Application' })).toHaveAttribute('href', '/ace');
    expect(container.innerHTML).not.toContain('hidden-vcn');
    expect(container.innerHTML).not.toContain('other-application');
  });

  it('does not invent a reopening date when both VCN forms have closed', () => {
    mockLinks = [
      link('vcn_stage_ninja_interest', 'closed', null),
      link('vcn_props_team_interest', 'closed', null),
    ];
    renderPage();
    expect(screen.getAllByText('Closed for this round')).toHaveLength(2);
    expect(screen.getByText('Stage Ninja interest forms have closed for this cycle.')).toBeInTheDocument();
    expect(screen.getByText('Props team interest forms have closed for this cycle.')).toBeInTheDocument();
    expect(screen.queryByText(/Scheduled to open/)).not.toBeInTheDocument();
  });
});
