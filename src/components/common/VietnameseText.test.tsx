import { render, screen } from '@testing-library/react';
import { VietnameseText } from './VietnameseText';

describe('VietnameseText', () => {
  it('renders children with lang="vi"', () => {
    render(<VietnameseText>Anh Chị Em</VietnameseText>);
    const element = screen.getByText('Anh Chị Em');
    expect(element).toHaveAttribute('lang', 'vi');
  });

  it('applies the provided className', () => {
    render(<VietnameseText className="custom-class">Gia Đình</VietnameseText>);
    const element = screen.getByText('Gia Đình');
    expect(element).toHaveClass('custom-class');
  });
});
