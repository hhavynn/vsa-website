import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GalleryFilters } from './GalleryFilters';

describe('GalleryFilters (Issue #562)', () => {
  it('renders academic years and triggers onYearChange on selection', () => {
    const onYearChange = jest.fn();
    render(
      <GalleryFilters
        years={[2026, 2025]}
        selectedYear={null}
        onYearChange={onYearChange}
        searchQuery=""
        onSearchChange={jest.fn()}
        onReset={jest.fn()}
        isFiltered={false}
      />
    );

    const select = screen.getByLabelText(/Filter by academic year/i);
    expect(screen.getByRole('option', { name: 'All years' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '2026–27' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '2025–26' })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: '2025' } });
    expect(onYearChange).toHaveBeenCalledWith(2025);
  });

  it('debounces search input and calls onSearchChange', async () => {
    const onSearchChange = jest.fn();
    render(
      <GalleryFilters
        years={[2026]}
        selectedYear={null}
        onYearChange={jest.fn()}
        searchQuery=""
        onSearchChange={onSearchChange}
        onReset={jest.fn()}
        isFiltered={false}
      />
    );

    const input = screen.getByRole('textbox', { name: 'Search album titles and descriptions' });
    fireEvent.change(input, { target: { value: 'retreat' } });

    await waitFor(() => {
      expect(onSearchChange).toHaveBeenCalledWith('retreat');
    });
  });

  it('clears search when clear button is clicked', () => {
    const onSearchChange = jest.fn();
    render(
      <GalleryFilters
        years={[2026]}
        selectedYear={null}
        onYearChange={jest.fn()}
        searchQuery="retreat"
        onSearchChange={onSearchChange}
        onReset={jest.fn()}
        isFiltered={true}
      />
    );

    const clearBtn = screen.getByRole('button', { name: /clear search/i });
    fireEvent.click(clearBtn);

    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('keeps the full accessible search label while using a shorter phone-friendly placeholder', () => {
    render(
      <GalleryFilters
        years={[2026]}
        selectedYear={null}
        onYearChange={jest.fn()}
        searchQuery=""
        onSearchChange={jest.fn()}
        onReset={jest.fn()}
        isFiltered={false}
      />
    );
    const search = screen.getByRole('textbox', { name: 'Search album titles and descriptions' });
    expect(search).toHaveAttribute('placeholder', 'Search memories...');
    expect(search).toHaveClass('pr-12');
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });

  it('gives both clearing actions at least a 44px touch target', () => {
    render(
      <GalleryFilters
        years={[2026]}
        selectedYear={2026}
        onYearChange={jest.fn()}
        searchQuery="night"
        onSearchChange={jest.fn()}
        onReset={jest.fn()}
        isFiltered={true}
      />
    );
    expect(screen.getByRole('button', { name: 'Clear search' })).toHaveClass('h-11', 'w-11');
    expect(screen.getByRole('button', { name: 'Clear filters' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Reset' })).toHaveClass('min-h-[44px]');
  });

  it('renders Reset button and matching count when filtered', () => {
    const onReset = jest.fn();
    render(
      <GalleryFilters
        years={[2026]}
        selectedYear={2026}
        onYearChange={jest.fn()}
        searchQuery=""
        onSearchChange={jest.fn()}
        onReset={onReset}
        totalFilteredCount={3}
        isFiltered={true}
      />
    );

    expect(screen.getByText('3 albums found')).toBeInTheDocument();
    const resetBtn = screen.getByRole('button', { name: 'Reset' });
    fireEvent.click(resetBtn);
    expect(onReset).toHaveBeenCalled();
  });
});
