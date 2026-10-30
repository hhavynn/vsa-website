import React from 'react';
import { RowsPerPageOption, ROWS_PER_PAGE_OPTIONS } from '../../hooks/usePagination';

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  rowsPerPage: RowsPerPageOption;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (opt: RowsPerPageOption) => void;
  pageStartLabel: number;
  pageEndLabel: number;
  totalCount: number;
  showRowsPerPage?: boolean;
  className?: string;
}

/** Token-driven, so pagination matches whichever surface (public or admin) hosts it. */
const t = {
  divider:      'border-[var(--color-border)]',
  btnBorder:    'border-[var(--color-border)]',
  btnText:      'text-text-secondary',
  btnHover:     'hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 dark:hover:border-brand-700 dark:hover:bg-brand-900/40 dark:hover:text-brand-100',
  pageLabel:    'text-text-muted',
  selectBg:     'bg-[var(--color-input)]',
  selectText:   'text-text-primary',
  selectBorder: 'border-[var(--color-border)]',
  selectFocus:  'focus:outline-none focus:border-brand-600 dark:focus:border-brand-400',
  countText:    'text-text-muted',
};

export function PaginationControls({
  page,
  totalPages,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  pageStartLabel,
  pageEndLabel,
  totalCount,
  showRowsPerPage = true,
  className = '',
}: PaginationControlsProps) {
  return (
    <div className={className}>
      {showRowsPerPage && (
        <div className={`flex items-center justify-between px-4 pt-3 pb-1`}>
          <select
            value={rowsPerPage}
            aria-label="Results per page"
            onChange={e =>
              onRowsPerPageChange(
                e.target.value === 'all'
                  ? 'all'
                  : (Number(e.target.value) as RowsPerPageOption)
              )
            }
            className={`rounded-lg border ${t.selectBorder} ${t.selectBg} px-3 py-1.5 text-sm touch:min-h-11 ${t.selectText} ${t.selectFocus} transition-colors`}
          >
            {ROWS_PER_PAGE_OPTIONS.map(option => (
              <option key={option} value={option}>
                {option === 'all' ? 'Show All' : `Show ${option} per page`}
              </option>
            ))}
          </select>
          <span className={`text-xs ${t.countText}`}>
            {totalCount === 0
              ? 'No results'
              : `Showing ${pageStartLabel}–${pageEndLabel} of ${totalCount}`}
          </span>
        </div>
      )}
      <div className={`flex items-center justify-between border-t ${t.divider} px-4 py-3`}>
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className={`rounded-lg border ${t.btnBorder} px-3 py-2 text-sm font-medium touch:min-h-11 touch:min-w-11 ${t.btnText} transition-colors ${t.btnHover} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Previous
        </button>
        <p className={`text-sm ${t.pageLabel}`}>
          Page {page} of {totalPages}
        </p>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className={`rounded-lg border ${t.btnBorder} px-3 py-2 text-sm font-medium touch:min-h-11 touch:min-w-11 ${t.btnText} transition-colors ${t.btnHover} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Next
        </button>
      </div>
    </div>
  );
}
