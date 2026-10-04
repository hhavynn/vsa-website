import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PaginationControls } from '../common/PaginationControls';
import { BackToTop } from './BackToTop';
import Footer from './Footer';

jest.mock('../../context/AnalyticsConsentContext', () => ({
  useAnalyticsConsent: () => ({ isConfigured: true, openPreferences: () => undefined }),
}));

describe('public touch-target floor', () => {
  it('gives every footer link and control a 44px hit area on touch', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );

    const controls = [
      ...screen.getAllByRole('link'),
      screen.getByRole('button', { name: 'Analytics preferences' }),
    ];
    expect(controls.length).toBeGreaterThan(15);
    for (const control of controls) {
      expect(control.className).toMatch(/touch:(min-h-11|h-11)/);
    }
  });

  it('keeps pagination buttons and the page-size select at 44px on touch', () => {
    render(
      <PaginationControls
        page={2}
        totalPages={5}
        rowsPerPage={10}
        onPageChange={() => undefined}
        onRowsPerPageChange={() => undefined}
        pageStartLabel={11}
        pageEndLabel={20}
        totalCount={50}
      />,
    );
    expect(screen.getByRole('button', { name: 'Previous' })).toHaveClass('touch:min-h-11');
    expect(screen.getByRole('button', { name: 'Next' })).toHaveClass('touch:min-h-11');
    expect(screen.getByRole('combobox', { name: 'Results per page' })).toHaveClass('touch:min-h-11');
  });

  it('renders the back-to-top control as a 44px target', () => {
    render(<BackToTop />);
    Object.defineProperty(window, 'pageYOffset', { value: 600, configurable: true });
    fireEvent.scroll(window);
    const button = screen.getByRole('button', { name: 'Back to top' });
    expect(button).toHaveClass('h-11', 'w-11');
  });
});
