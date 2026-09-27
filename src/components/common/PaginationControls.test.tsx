import { render, screen } from '@testing-library/react';
import { PaginationControls } from './PaginationControls';

describe('PaginationControls accessibility', () => {
  it('gives the page-size selector an accessible name', () => {
    render(
      <PaginationControls
        page={1}
        totalPages={2}
        rowsPerPage={10}
        onPageChange={jest.fn()}
        onRowsPerPageChange={jest.fn()}
        pageStartLabel={1}
        pageEndLabel={10}
        totalCount={15}
      />
    );

    expect(screen.getByRole('combobox', { name: 'Results per page' })).toBeInTheDocument();
  });
});
