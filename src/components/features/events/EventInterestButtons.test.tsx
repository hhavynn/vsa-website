import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { EventInterestButtons } from './EventInterestButtons';
import { eventsRepository } from '../../../data/repos/events';

const counts = (eventId: string, interested: number) => ({
  event_id: eventId,
  interested_count: interested,
  going_count: 0,
  updated_at: '2026-09-01T00:00:00Z',
});

function setup() {
  const queryClient = new QueryClient();
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
  const wrap = (eventId: string, interested: number) => (
    <QueryClientProvider client={queryClient}>
      <EventInterestButtons eventId={eventId} initialCounts={counts(eventId, interested)} />
    </QueryClientProvider>
  );
  return { wrap, invalidate };
}

describe('EventInterestButtons', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.spyOn(eventsRepository, 'recordInterest').mockResolvedValue(undefined);
  });

  it('does not carry one event\'s saved choice or counts over to the next event', async () => {
    localStorage.setItem('vsa:event-interest:event-a', 'interested');
    const { wrap } = setup();
    const { rerender } = render(wrap('event-a', 5));

    rerender(wrap('event-b', 2));

    // With no saved choice for event-b, clicking must ADD interest, not clear event-a's.
    fireEvent.click(screen.getAllByRole('button')[0]);
    await waitFor(() => expect(eventsRepository.recordInterest).toHaveBeenCalledWith('event-b', 'interested'));
    expect(screen.queryByText(/\(5\)/)).not.toBeInTheDocument();
  });

  it('invalidates other cached copies of the event after a change', async () => {
    const { wrap, invalidate } = setup();
    render(wrap('event-a', 1));

    fireEvent.click(screen.getAllByRole('button')[0]);

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith(['events']));
    expect(invalidate).toHaveBeenCalledWith(['home', 'upcoming-events-section']);
  });
});
