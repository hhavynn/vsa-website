import { type ChangeEvent, type ComponentType, type FormEvent, useEffect, useState } from 'react';
import { type IconBaseProps } from 'react-icons';
import { FiSearch, FiX } from 'react-icons/fi';

const SearchIcon = FiSearch as ComponentType<IconBaseProps>;
const CloseIcon = FiX as ComponentType<IconBaseProps>;

export interface GalleryFiltersProps {
  years: number[];
  selectedYear: number | null;
  onYearChange: (year: number | null) => void;
  searchQuery: string;
  onSearchChange: (search: string) => void;
  onReset: () => void;
  totalFilteredCount?: number | null;
  isFiltered: boolean;
  isLoading?: boolean;
}

export function formatAcademicYearLabel(startYear: number): string {
  return `${startYear}–${String(startYear + 1).slice(-2)}`;
}

export function GalleryFilters({
  years,
  selectedYear,
  onYearChange,
  searchQuery,
  onSearchChange,
  onReset,
  totalFilteredCount,
  isFiltered,
  isLoading = false,
}: GalleryFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Keep local input in sync when external searchQuery changes (e.g. URL change or reset)
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  // Debounce search updates to parent
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchQuery) {
        onSearchChange(localSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, searchQuery, onSearchChange]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearchChange(localSearch);
  };

  const handleClearSearch = () => {
    setLocalSearch('');
    onSearchChange('');
  };

  return (
    <div className="mb-8 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Year Filter */}
        <div className="relative sm:w-52">
          <label htmlFor="gallery-year-select" className="sr-only">
            Filter by academic year
          </label>
          <select
            id="gallery-year-select"
            value={selectedYear ?? ''}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
              const val = e.target.value;
              onYearChange(val ? parseInt(val, 10) : null);
            }}
            className="min-h-[44px] w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-sans text-sm text-[var(--text)] transition-colors focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 dark:focus:border-brand-400 dark:focus:ring-brand-400"
          >
            <option value="">All years</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {formatAcademicYearLabel(year)}
              </option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1" role="search">
          <label htmlFor="gallery-search-input" className="sr-only">
            Search album titles and descriptions
          </label>
          <div className="relative flex items-center">
            <span
              className="pointer-events-none absolute left-3 text-[var(--text3)]"
              aria-hidden="true"
            >
              <SearchIcon className="h-4 w-4" />
            </span>
            <input
              id="gallery-search-input"
              type="text"
              value={localSearch}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setLocalSearch(e.target.value)}
              placeholder="Search memories..."
              className="min-h-[44px] w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-12 font-sans text-sm text-[var(--text)] placeholder:text-[var(--text3)] transition-colors focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 dark:focus:border-brand-400 dark:focus:ring-brand-400"
            />
            {localSearch && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text3)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </form>

        {/* Reset button */}
        {isFiltered && (
          <button
            type="button"
            onClick={onReset}
            className="flex min-h-[44px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-4 font-mono text-xs uppercase tracking-wider text-[var(--text)] transition-colors hover:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-brand-600"
          >
            Reset
          </button>
        )}
      </div>

      {/* Filter status / feedback */}
      {isFiltered && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between font-mono text-xs text-[var(--text3)]"
        >
          <span>
            {isLoading
              ? 'Loading matches...'
              : totalFilteredCount !== null && totalFilteredCount !== undefined
              ? `${totalFilteredCount} ${totalFilteredCount === 1 ? 'album' : 'albums'} found`
              : 'Matching albums'}
          </span>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-11 items-center rounded px-2 text-brand-600 underline underline-offset-2 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-brand-400"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
