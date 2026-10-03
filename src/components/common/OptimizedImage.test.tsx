import { fireEvent, render, screen } from '@testing-library/react';
import { OptimizedImage } from './OptimizedImage';

describe('OptimizedImage', () => {
  it('sets explicit dimensions, lazy loading and async decoding by default', () => {
    render(<OptimizedImage src="/images/a.webp" alt="A" width={520} height={330} />);
    const img = screen.getByAltText('A');
    expect(img).toHaveAttribute('width', '520');
    expect(img).toHaveAttribute('height', '330');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).not.toHaveAttribute('fetchpriority');
    expect(img).not.toHaveAttribute('srcset');
  });

  it('loads priority images eagerly with high fetch priority', () => {
    render(<OptimizedImage src="/images/a.webp" alt="Hero" width={1200} height={600} priority />);
    const img = screen.getByAltText('Hero');
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
  });

  it('emits srcset and a sizes default when a smaller variant is given', () => {
    render(
      <OptimizedImage
        src="/images/a.webp"
        srcWidth={1200}
        lowRes={{ src: '/images/a_thumb.webp', width: 720 }}
        alt="Card"
        width={520}
        height={330}
        sizes="(min-width: 640px) 50vw, 100vw"
      />,
    );
    const img = screen.getByAltText('Card');
    expect(img).toHaveAttribute('srcset', '/images/a_thumb.webp 720w, /images/a.webp 1200w');
    expect(img).toHaveAttribute('sizes', '(min-width: 640px) 50vw, 100vw');
  });

  it('renders the fallback when src is missing', () => {
    render(<OptimizedImage src={null} alt="x" width={1} height={1} fallback={<span>none</span>} />);
    expect(screen.getByText('none')).toBeInTheDocument();
  });

  it('swaps to the fallback on error and recovers when src changes', () => {
    const onError = jest.fn();
    const { rerender } = render(
      <OptimizedImage src="/bad.webp" alt="x" width={1} height={1} fallback={<span>broken</span>} onError={onError} />,
    );
    fireEvent.error(screen.getByAltText('x'));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.getByText('broken')).toBeInTheDocument();

    rerender(<OptimizedImage src="/good.webp" alt="x" width={1} height={1} fallback={<span>broken</span>} onError={onError} />);
    expect(screen.getByAltText('x')).toHaveAttribute('src', '/good.webp');
  });
});
