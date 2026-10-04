import { render, screen } from '@testing-library/react';
import { HouseDetailSkeleton, VcnArchiveSkeleton } from './PageSkeletons';

describe('data-page skeletons announce loading', () => {
  it.each([
    ['House detail', HouseDetailSkeleton, 'Loading House page'],
    ['VCN archive', VcnArchiveSkeleton, 'Loading VCN archive'],
  ] as const)('%s keeps a polite status message', (_name, Skeleton, message) => {
    render(<Skeleton />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent(message);
  });
});
