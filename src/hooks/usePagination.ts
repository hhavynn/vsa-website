import { useState, useEffect, useMemo } from 'react';

export type RowsPerPageOption = 10 | 25 | 50 | 100 | 'all';
export const ROWS_PER_PAGE_OPTIONS: RowsPerPageOption[] = [10, 25, 50, 100, 'all'];

export interface UsePaginationOptions {
  defaultRowsPerPage?: RowsPerPageOption;
  initialPage?: number;
  resetKey?: string;
}

export interface UsePaginationResult<T> {
  currentPage: number;
  rowsPerPage: RowsPerPageOption;
  setCurrentPage: (page: number) => void;
  setRowsPerPage: (opt: RowsPerPageOption) => void;
  totalPages: number;
  page: number;
  pageStart: number;
  pageEnd: number;
  pageStartLabel: number;
  pageEndLabel: number;
  totalCount: number;
  paginatedData: T[];
}

export function usePagination<T>(
  filteredData: T[],
  options: UsePaginationOptions = {}
): UsePaginationResult<T> {
  const { defaultRowsPerPage = 25, initialPage = 1, resetKey } = options;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [rowsPerPage, setRowsPerPage] = useState<RowsPerPageOption>(defaultRowsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [rowsPerPage, resetKey]);

  const totalPages = useMemo(
    () =>
      rowsPerPage === 'all'
        ? 1
        : Math.max(1, Math.ceil(filteredData.length / (rowsPerPage as number))),
    [filteredData.length, rowsPerPage]
  );

  const page = Math.min(currentPage, totalPages);
  const pageStart = rowsPerPage === 'all' ? 0 : (page - 1) * (rowsPerPage as number);
  const pageEnd = rowsPerPage === 'all' ? filteredData.length : pageStart + (rowsPerPage as number);

  const paginatedData = useMemo(
    () => filteredData.slice(pageStart, pageEnd),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredData, pageStart, pageEnd]
  );

  const pageStartLabel = filteredData.length === 0 ? 0 : pageStart + 1;
  const pageEndLabel = Math.min(pageEnd, filteredData.length);

  return {
    currentPage,
    rowsPerPage,
    setCurrentPage,
    setRowsPerPage,
    totalPages,
    page,
    pageStart,
    pageEnd,
    pageStartLabel,
    pageEndLabel,
    totalCount: filteredData.length,
    paginatedData,
  };
}
