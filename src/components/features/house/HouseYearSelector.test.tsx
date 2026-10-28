import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { buildHouseYearOptions, HouseYearSelector } from './HouseYearSelector';

function CurrentPath() {
  const { pathname } = useLocation();
  return <output aria-label="Current route">{pathname}</output>;
}

function renderSelector(currentYear: number | null, activeStartYear: number | null = currentYear) {
  render(
    <MemoryRouter initialEntries={['/house']}>
      <HouseYearSelector currentYear={currentYear} activeStartYear={activeStartYear} />
      <CurrentPath />
    </MemoryRouter>
  );
}

describe('House selector academic-year rollover (#595)', () => {
  it('identifies the term-backed 2026-2027 year, preserving exact historical routes', () => {
    const options = buildHouseYearOptions(2026);
    expect(options.slice(0, 3)).toEqual([
      { startYear: 2026, label: '2026-2027', badge: 'Current', route: '/house' },
      { startYear: 2025, label: '2025-2026', badge: 'Archive', route: '/house/year/2025-2026' },
      { startYear: 2024, label: '2024-2025', badge: 'Archive', route: '/house/year/2024-2025' },
    ]);
    expect(options.map((year) => year.startYear)).not.toContain(2020);
  });

  it('rolls the Current chip to an active 2027-2028 term without assuming its Houses exist', () => {
    const options = buildHouseYearOptions(2027);
    expect(options.slice(0, 3).map((year) => [year.label, year.badge, year.route])).toEqual([
      ['2027-2028', 'Current', '/house'],
      ['2026-2027', 'Archive', '/house/year/2026-2027'],
      ['2025-2026', 'Archive', '/house/year/2025-2026'],
    ]);
    expect(options.filter((year) => year.badge === 'Current')).toHaveLength(1);

    renderSelector(2027);
    expect(screen.getByRole('link', { name: /2027-2028 current/i })).toHaveAttribute('href', '/house');
    expect(screen.getByRole('link', { name: /2026-2027 archive/i })).toHaveAttribute(
      'href', '/house/year/2026-2027'
    );
  });

  it('does not falsely label a year Current when the academic-year source is unknown', () => {
    const options = buildHouseYearOptions(null);
    expect(options.some((year) => year.badge === 'Current')).toBe(false);
    expect(options.every((year) => year.badge === 'Archive')).toBe(true);
    expect(options.map((year) => year.startYear)).not.toContain(2026);
  });

  it('keeps older verified years available in the More Years selector', () => {
    renderSelector(2027, 2024);
    const picker = screen.getByRole('combobox', { name: /more years/i });
    expect(picker).toHaveValue('2024');
    expect(screen.getByRole('option', { name: '2024-2025' })).toBeInTheDocument();
    fireEvent.change(picker, { target: { value: '2023' } });
    expect(screen.getByRole('status', { name: 'Current route' })).toHaveTextContent(
      '/house/year/2023-2024'
    );
  });

  it('never presents a future year when the active term is an earlier year', () => {
    const options = buildHouseYearOptions(2025);
    expect(options.map((year) => year.startYear)).not.toContain(2026);
    expect(options[0]).toMatchObject({ startYear: 2025, badge: 'Current', route: '/house' });
  });
});
