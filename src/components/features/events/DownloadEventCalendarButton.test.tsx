import { fireEvent, render, screen } from '@testing-library/react';
import type { Event } from '../../../types';
import { DownloadEventCalendarButton } from './DownloadEventCalendarButton';
import { downloadPublicEventIcs } from '../../../lib/publicEventIcs';

jest.mock('../../../lib/publicEventIcs', () => ({
  downloadPublicEventIcs: jest.fn(),
}));

const fixture = (id: string, is_published: boolean): Event => ({
  id,
  is_published,
  name: 'Synthetic event',
  date: '2026-11-05',
  description: null,
  start_time: null,
  end_time: null,
  end_date: null,
  location: null,
} as Event);

describe('download VSA event calendar control (#278)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('only forwards published events and is clearly labeled as one-time', () => {
    const published = fixture('public', true);
    const draft = fixture('private', false);
    render(<DownloadEventCalendarButton events={[published, draft]} />);
    fireEvent.click(screen.getByRole('button', { name: /Download VSA events/i }));
    expect(downloadPublicEventIcs).toHaveBeenCalledWith([published]);
    expect(screen.getByText(/One-time calendar import/)).toBeInTheDocument();
  });

  it('disables the action for empty or entirely unpublished results', () => {
    const { rerender } = render(<DownloadEventCalendarButton events={[]} />);
    expect(screen.getByRole('button', { name: /Download VSA events/i })).toBeDisabled();
    rerender(<DownloadEventCalendarButton events={[fixture('draft', false)]} />);
    expect(screen.getByRole('button', { name: /Download VSA events/i })).toBeDisabled();
    expect(downloadPublicEventIcs).not.toHaveBeenCalled();
  });
});
