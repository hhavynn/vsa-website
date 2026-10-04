import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PublicBreadcrumbs } from './PublicBreadcrumbs';

function renderAt(path: string, props: React.ComponentProps<typeof PublicBreadcrumbs> = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PublicBreadcrumbs {...props} />
    </MemoryRouter>,
  );
}

describe('PublicBreadcrumbs', () => {
  it('renders a labelled nav with an ordered list and marks only the current page', () => {
    renderAt('/vcn/archive');

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const list = within(nav).getByRole('list');
    expect(list.tagName).toBe('OL');
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.textContent?.replace('›', '').trim())).toEqual(['Home', 'VCN', 'Archive']);

    const current = within(nav).getByText('Archive');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(within(nav).queryByRole('link', { name: 'Archive' })).not.toBeInTheDocument();
    expect(nav.querySelectorAll('[aria-current]')).toHaveLength(1); // eslint-disable-line testing-library/no-node-access
    expect(within(nav).getByRole('link', { name: 'VCN' })).toHaveAttribute('href', '/vcn');
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });

  it('hides the decorative separators from assistive tech', () => {
    renderAt('/vcn/current');
    const separators = screen.getAllByText('›');
    expect(separators).toHaveLength(2);
    separators.forEach((separator) => expect(separator).toHaveAttribute('aria-hidden', 'true'));
  });

  it('renders nothing on flat top-level pages and unknown paths', () => {
    const { container: flatPage, unmount } = renderAt('/events');
    expect(flatPage).toBeEmptyDOMElement();
    unmount();
    const { container: unknownPage } = renderAt('/vcn/not-a-page');
    expect(unknownPage).toBeEmptyDOMElement();
  });

  it('labels House archive years apart from the live year', () => {
    renderAt('/house/year/2023-2024/dragon', { context: { currentYear: 2025, houseLabel: 'Dragon' } });
    expect(screen.getByRole('link', { name: 'Archive' })).toHaveAttribute('href', '/house/archive');
    expect(screen.getByRole('link', { name: '2023–24' })).toHaveAttribute('href', '/house/year/2023-2024');
    expect(screen.getByText('Dragon')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText('Current')).not.toBeInTheDocument();
  });

  it('shows a Current badge on the live year', () => {
    renderAt('/house/year/2025-2026', { context: { currentYear: 2025 } });
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('2025–26', { exact: false })).toHaveAttribute('aria-current', 'page');
  });

  it('is safe on narrow screens: ancestors truncate (with the full name as a tooltip) while the current page wraps instead', () => {
    renderAt('/house/year/2023-2024/a-very-long-house-name-indeed', { context: { currentYear: 2025 } });

    const ancestors = screen.getAllByRole('link');
    expect(ancestors.length).toBeGreaterThanOrEqual(3);
    for (const link of ancestors) {
      expect(link.className).toContain('truncate');
      expect(link.className).toMatch(/max-w-\[/);
      expect(link).toHaveAttribute('title', link.textContent ?? '');
    }

    const current = screen.getByText('A Very Long House Name Indeed');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current.className).not.toContain('truncate');
    expect(current.className).toContain('break-words');
    // The list wraps rather than overflowing horizontally.
    expect(screen.getByRole('list').className).toContain('flex-wrap');
  });

  it('uses design tokens only (no raw colors)', () => {
    const { container } = renderAt('/house/year/2025-2026/dragon', { context: { currentYear: 2025 } });
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|text-(gray|slate|zinc|neutral|stone)-/i);
  });

  it('accepts an explicit trail', () => {
    renderAt('/anything', { trail: [{ label: 'Home', to: '/' }, { label: 'Somewhere' }] });
    expect(screen.getByText('Somewhere')).toHaveAttribute('aria-current', 'page');
  });
});
