import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button touch-target floor', () => {
  it.each(['sm', 'md', 'lg'] as const)('%s buttons reach 44x44 on phone widths and coarse pointers', (size) => {
    render(<Button size={size}>Go</Button>);
    const button = screen.getByRole('button', { name: 'Go' });
    expect(button).toHaveClass('touch:min-h-11');
    expect(button).toHaveClass('touch:min-w-11');
  });

  it('lets callers add classes without losing the floor', () => {
    render(<Button className="px-2">Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass('touch:min-h-11', 'px-2');
  });
});
