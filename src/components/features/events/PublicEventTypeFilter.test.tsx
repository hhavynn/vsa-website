import { fireEvent, render, screen } from '@testing-library/react';
import { PublicEventTypeFilter, PUBLIC_EVENT_FILTERS } from './PublicEventTypeFilter';

describe('public Events type filter on phones and desktop (#245)', () => {
  it('shows one native, labeled 44px-or-taller filter on phones with the same options as the desktop controls', () => {
    const onChange = jest.fn();
    render(<PublicEventTypeFilter value="all" onChange={onChange} />);

    const picker = screen.getByRole('combobox', { name: 'Show events' });
    expect(picker).toHaveValue('all');
    expect(picker).toHaveClass('min-h-11', 'w-full');
    expect(screen.getByRole('group', { name: 'Filter events by type' })).toHaveClass('sm:flex');
    expect(screen.getAllByRole('option')).toHaveLength(PUBLIC_EVENT_FILTERS.length);
    for (const option of PUBLIC_EVENT_FILTERS) {
      expect(screen.getByRole('option', { name: option.label })).toHaveAttribute('value', option.key);
      expect(screen.getByRole('button', { name: option.label })).toBeInTheDocument();
    }
  });

  it('uses the existing filter setter for phone selection and keeps desktop aria-pressed in sync', () => {
    const onChange = jest.fn();
    const { rerender } = render(<PublicEventTypeFilter value="house" onChange={onChange} />);
    expect(screen.getByRole('combobox', { name: 'Show events' })).toHaveValue('house');
    expect(screen.getByRole('button', { name: 'House Events' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.change(screen.getByRole('combobox', { name: 'Show events' }), { target: { value: 'vcn' } });
    expect(onChange).toHaveBeenCalledWith('vcn');

    rerender(<PublicEventTypeFilter value="vcn" onChange={onChange} />);
    expect(screen.getByRole('combobox', { name: 'Show events' })).toHaveValue('vcn');
    expect(screen.getByRole('button', { name: 'VCN' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(onChange).toHaveBeenLastCalledWith('all');
  });

  it('preserves all published types rather than hiding infrequent types on mobile', () => {
    expect(PUBLIC_EVENT_FILTERS.map((option) => option.key)).toEqual([
      'all', 'house', 'gbm', 'mixer', 'vcn', 'winter_retreat', 'wildn_culture', 'external_event', 'other',
    ]);
  });
});
