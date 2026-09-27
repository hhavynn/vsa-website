import { render, screen } from '@testing-library/react';
import { SplitText } from './SplitText';

describe('SplitText accessibility', () => {
  it('exposes its text to assistive technology while hiding animated characters', () => {
    render(
      <h1>
        <SplitText text="Welcome to VSA" />
      </h1>
    );

    expect(screen.getByRole('heading', { name: 'Welcome to VSA' })).toBeInTheDocument();
    expect(screen.getByText('Welcome to VSA')).toHaveClass('sr-only');
    expect(document.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});
