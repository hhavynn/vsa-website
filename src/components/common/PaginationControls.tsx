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
  theme?: 'slate' | 'gray' | 'zinc';
  showRowsPerPage?: boolean;
  className?: string;
}

const THEMES = {
  slate: {
    divider:     'border-slate-800/80',
    btnBorder:   'border-slate-700',
    btnText:     'text-slate-300',
    btnHover:    'hover:bg-slate-800/60',
    pageLabel:   'text-slate-400',
    selectBg:    'bg-slate-950/80',
    selectText:  'text-white',
    selectBorder:'border-slate-700',
    selectFocus: 'focus:border-indigo-500 focus:outline-none',
    countText:   'text-slate-500',
  },
  gray: {
    divider:     'border-gray-200 dark:border-gray-700',
    btnBorder:   'border-gray-300 dark:border-gray-600',
    btnText:     'text-gray-700 dark:text-gray-300',
    btnHover:    'hover:bg-gray-50 dark:hover:bg-gray-800',
    pageLabel:   'text-gray-500 dark:text-gray-400',
    selectBg:    'bg-white dark:bg-gray-700',
    selectText:  'text-gray-900 dark:text-white',
    selectBorder:'border-gray-300 dark:border-gray-600',
    selectFocus: 'focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none',
    countText:   'text-gray-500 dark:text-gray-400',
  },
  zinc: {
    divider:     'border-zinc-200 dark:border-[#27272a]',
    btnBorder:   'border-zinc-200 dark:border-[#27272a]',
    btnText:     'text-zinc-700 dark:text-zinc-300',
    btnHover:    'hover:bg-zinc-50 dark:hover:bg-zinc-800',
    pageLabel:   'text-zinc-500 dark:text-zinc-400',
    selectBg:    'bg-white dark:bg-[#18181b]',
    selectText:  'text-zinc-900 dark:text-zinc-100',
    selectBorder:'border-zinc-200 dark:border-[#27272a]',
    selectFocus: 'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500',
    countText:   'text-zinc-500 dark:text-zinc-400',
  },
} as const;

export function PaginationControls({
  page,
  totalPages,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  pageStartLabel,
  pageEndLabel,
  totalCount,
  theme = 'gray',
  showRowsPerPage = true,
  className = '',
}: PaginationControlsProps) {
  const t = THEMES[theme];

  return (
    <div className={className}>
      {showRowsPerPage && (
        <div className={`flex items-center justify-between px-4 pt-3 pb-1`}>
          <select
            value={rowsPerPage}
            onChange={e =>
              onRowsPerPageChange(
                e.target.value === 'all'
                  ? 'all'
                  : (Number(e.target.value) as RowsPerPageOption)
              )
            }
            className={`rounded-lg border ${t.selectBorder} ${t.selectBg} px-3 py-1.5 text-sm ${t.selectText} ${t.selectFocus} transition-colors`}
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
          className={`rounded-lg border ${t.btnBorder} px-3 py-2 text-sm font-medium ${t.btnText} transition-colors ${t.btnHover} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Previous
        </button>
        <p className={`text-sm ${t.pageLabel}`}>
          Page {page} of {totalPages}
        </p>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className={`rounded-lg border ${t.btnBorder} px-3 py-2 text-sm font-medium ${t.btnText} transition-colors ${t.btnHover} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Next
        </button>
      </div>
    </div>
  );
}
