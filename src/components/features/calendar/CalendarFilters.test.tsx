import { fireEvent, render, screen } from '@testing-library/react';
import { CalendarFilters, type CalendarFilterOption } from './CalendarFilters';

const options: CalendarFilterOption[] = [
  { key: 'all', label: 'All' },
  { key: 'gbm', label: 'GBMs' },
  { key: 'house', label: 'House events' },
  { key: 'application', label: 'Application deadlines' },
];

const base = {
  options,
  activeFilter: 'all' as const,
  onFilterChange: jest.fn(),
  houseOptions: [{ name: 'Twilight', color: '#9063c9' }, { name: 'Rarity', color: '#d4841a' }],
  activeHouse: null,
  onHouseChange: jest.fn(),
  pointsOnly: false,
  onPointsOnlyChange: jest.fn(),
  showPointsToggle: true,
};

describe('CalendarFilters public mobile controls (#209)', () => {
  it('shows the same dynamic categories via a labeled 44px native mobile picker and desktop pills', () => {
    render(<CalendarFilters {...base} />);
    const picker = screen.getByRole('combobox', { name: 'Show calendar' });
    expect(picker).toHaveClass('min-h-11', 'w-full');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(
      options.map((option) => option.label),
    );
    expect(screen.getByRole('button', { name: 'Application deadlines' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('group', { name: 'Filter calendar by category' })).toHaveClass('sm:flex');
  });

  it('clears a prior House-host selection when selecting another category on mobile', () => {
    const onFilterChange = jest.fn();
    const onHouseChange = jest.fn();
    render(<CalendarFilters {...base} activeFilter="house" activeHouse="Twilight" onFilterChange={onFilterChange} onHouseChange={onHouseChange} />);
    const host = screen.getByRole('combobox', { name: 'House host' });
    expect(host).toHaveValue('Twilight');
    fireEvent.change(host, { target: { value: 'Rarity' } });
    expect(onHouseChange).toHaveBeenCalledWith('Rarity');
    fireEvent.change(screen.getByRole('combobox', { name: 'Show calendar' }), { target: { value: 'gbm' } });
    expect(onFilterChange).toHaveBeenCalledWith('gbm');
    expect(onHouseChange).toHaveBeenLastCalledWith(null);
  });

  it('preserves category and House filters on desktop and an independent points-eligible toggle', () => {
    const onHouseChange = jest.fn();
    const onPointsOnlyChange = jest.fn();
    render(<CalendarFilters {...base} activeFilter="house" activeHouse="Twilight" onHouseChange={onHouseChange} onPointsOnlyChange={onPointsOnlyChange} />);
    expect(screen.getByRole('button', { name: 'House events' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Twilight' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Rarity' }));
    expect(onHouseChange).toHaveBeenCalledWith('Rarity');
    expect(screen.getAllByRole('button', { name: /Points eligible/i })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: /Points eligible/i })[0]);
    expect(onPointsOnlyChange).toHaveBeenCalledWith(true);
  });

  it('does not invent points-eligible or House-host options when they are absent', () => {
    render(<CalendarFilters {...base} activeFilter="gbm" houseOptions={[]} showPointsToggle={false} />);
    expect(screen.queryByRole('combobox', { name: 'House host' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Points eligible/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Filter by house' })).not.toBeInTheDocument();
  });
});
