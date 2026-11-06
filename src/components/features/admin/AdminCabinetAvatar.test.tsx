import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminCabinetAvatar } from './AdminCabinetAvatar';

const full = '/images/cabinet/fictional-portrait.webp';
const thumb = '/images/cabinet/fictional-portrait-thumb.webp';

describe('Admin Cabinet portrait delivery (#303)', () => {
  it('prefers the existing smaller portrait and reserves its lazy-loaded slot', () => {
    render(<AdminCabinetAvatar name="Fictional Officer" imageUrl={full} thumbnailUrl={thumb} />);
    const image = screen.getByRole('img', { name: 'Fictional Officer' });
    expect(image).toHaveAttribute('src', thumb);
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
    expect(image).toHaveAttribute('width', '48');
    expect(image).toHaveAttribute('height', '48');
    expect(image).toHaveClass('object-cover', 'rounded-full');
  });

  it('uses a legacy full photo when no thumbnail is available', () => {
    render(<AdminCabinetAvatar name="Legacy Member" imageUrl={full} thumbnailUrl={null} />);
    expect(screen.getByRole('img', { name: 'Legacy Member' })).toHaveAttribute('src', full);
  });

  it('preserves the initials placeholder when there is no photo or the image errors', () => {
    const { rerender } = render(<AdminCabinetAvatar name="Linh" imageUrl={null} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Linh portrait unavailable')).toHaveTextContent('L');
    rerender(<AdminCabinetAvatar name="Linh" imageUrl={full} />);
    fireEvent.error(screen.getByRole('img', { name: 'Linh' }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Linh portrait unavailable')).toHaveTextContent('L');
  });

  it('reserves the 80px current-photo editor slot and retries a different selected image', async () => {
    const { rerender } = render(<AdminCabinetAvatar name="First" imageUrl={full} alt="Current" size={80} />);
    const current = screen.getByRole('img', { name: 'Current' });
    expect(current).toHaveAttribute('width', '80');
    expect(current).toHaveAttribute('height', '80');
    fireEvent.error(current);
    const replacement = '/images/cabinet/replacement.webp';
    rerender(<AdminCabinetAvatar name="Second" imageUrl={replacement} alt="Current" size={80} />);
    await waitFor(() => expect(screen.getByRole('img', { name: 'Current' })).toHaveAttribute('src', replacement));
  });
});
