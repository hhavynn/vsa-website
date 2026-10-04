/* eslint-disable testing-library/no-node-access, testing-library/no-container -- structural assertions on motion wrappers and character spans */
import { fireEvent, render, screen } from '@testing-library/react';
import { RevealOnScrollWrapper } from './components/common/RevealOnScrollWrapper';
import { BackToTop } from './components/layout/BackToTop';
import { SplitText } from './components/ui/SplitText';

const mockUseReducedMotion = jest.fn();
jest.mock('framer-motion', () => ({
  ...jest.requireActual('framer-motion'),
  useReducedMotion: () => mockUseReducedMotion(),
}));

afterEach(() => {
  mockUseReducedMotion.mockReset();
});

describe('prefers-reduced-motion', () => {
  it('SplitText renders the final heading text with no animated character spans', () => {
    mockUseReducedMotion.mockReturnValue(true);
    const { container } = render(
      <h1>
        <SplitText text="Welcome to VSA" />
      </h1>,
    );
    expect(screen.getByRole('heading', { name: 'Welcome to VSA' })).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
    expect(container.querySelectorAll('span span')).toHaveLength(0);
  });

  it('SplitText still animates character by character in normal motion', () => {
    mockUseReducedMotion.mockReturnValue(false);
    const { container } = render(<SplitText text="Hi" />);
    expect(container.querySelectorAll('[aria-hidden="true"] > span')).toHaveLength(2);
  });

  it('RevealOnScrollWrapper never holds content at opacity 0 or translated', () => {
    mockUseReducedMotion.mockReturnValue(true);
    render(
      <RevealOnScrollWrapper className="reveal">
        <p>Below the fold</p>
      </RevealOnScrollWrapper>,
    );
    const wrapper = screen.getByText('Below the fold').parentElement as HTMLElement;
    expect(wrapper).toHaveClass('reveal');
    expect(wrapper.getAttribute('style') ?? '').not.toMatch(/opacity|transform/);
  });

  it('RevealOnScrollWrapper keeps its scroll reveal in normal motion', () => {
    mockUseReducedMotion.mockReturnValue(false);
    render(
      <RevealOnScrollWrapper>
        <p>Below the fold</p>
      </RevealOnScrollWrapper>,
    );
    const wrapper = screen.getByText('Below the fold').parentElement as HTMLElement;
    expect(wrapper.getAttribute('style') ?? '').toMatch(/opacity: 0/);
  });

  it('BackToTop jumps instead of smooth-scrolling, and still works', () => {
    mockUseReducedMotion.mockReturnValue(true);
    const scrollTo = jest.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    Object.defineProperty(window, 'pageYOffset', { value: 900, configurable: true });
    render(<BackToTop />);
    fireEvent.scroll(window);
    fireEvent.click(screen.getByRole('button', { name: 'Back to top' }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('BackToTop smooth-scrolls in normal motion', () => {
    mockUseReducedMotion.mockReturnValue(false);
    const scrollTo = jest.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    Object.defineProperty(window, 'pageYOffset', { value: 900, configurable: true });
    render(<BackToTop />);
    fireEvent.scroll(window);
    fireEvent.click(screen.getByRole('button', { name: 'Back to top' }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
