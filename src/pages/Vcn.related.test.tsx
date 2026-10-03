import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VCN } from './Vcn';
import type { ApplicationKey, ApplicationStatus, PublicApplicationLink } from '../types';

let mockLinks: PublicApplicationLink[] = [];

jest.mock('../hooks/useApplicationLinks', () => ({
  usePublicApplicationLinks: () => ({ links: mockLinks, loading: false, error: null }),
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
    'hides the application CTA, and exposes no URL, while the window is %s',
    (status) => {
      // Even if a stale/leaky row carried a URL, nothing may render for a non-open window.
      mockLinks = [
        link('vcn_stage_ninja_interest', status, 'https://forms.example.test/should-never-render'),
        link('vcn_props_team_interest', status, null),
      ];
      renderPage();
      expect(screen.queryByRole('link', { name: /Join/ })).not.toBeInTheDocument();
      const hrefs = screen.getAllByRole('link').map((anchor) => anchor.getAttribute('href') ?? '');
      expect(hrefs.filter((href) => href.includes('forms.example.test'))).toEqual([]);
      expect(screen.getByRole('link', { name: /Compare programs/ })).toBeInTheDocument();
    },
  );
});
