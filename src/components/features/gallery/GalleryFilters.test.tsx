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

    const input = screen.getByPlaceholderText(/Search album titles and descriptions/i);
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
