import { render, screen } from '@testing-library/react';
import { makeEvent } from '../../../test-utils/uvsaFixtures';
import { ExternalEventFacts, ExternalEventCard } from './ExternalEventCard';
import { FeaturedExternal } from './FeaturedExternal';

const longVenue = 'The Student Union Ballroom West At The Far Side Of The Multi-Purpose Center Beyond The Main Courtyard Entrance';
const longTitle = 'SuperLongUnbrokenVietnameseStudentOrganizationCommunityCelebration2026';
const rideNotes = 'MeetAtTheGilmanTransitHubNearTheStairsForCoordinatedUCSDRides';

describe('public UVSA event facts fit narrow screens (#209)', () => {
  const event = makeEvent({ title: longTitle, location: longVenue, ride_info: rideNotes });

  it('wraps the published date/time and full venue beside non-shrinking icons', () => {
    render(<ExternalEventFacts event={event} />);
    const time = screen.getByText('Sat, Nov 14');
    expect(time).toHaveClass('min-w-0', 'break-words');
    const venue = screen.getByText(longVenue);
    expect(venue).toHaveClass('min-w-0', 'break-words');
    expect(screen.getByText('+4 pts')).toBeInTheDocument();
  });

  it('keeps larger featured time and venue typography without sacrificing wrapping', () => {
    render(<ExternalEventFacts event={event} large />);
    expect(screen.getByText('Sat, Nov 14')).toHaveClass('min-w-0', 'break-words');
    expect(screen.getByText(longVenue)).toHaveClass('min-w-0', 'break-words');
  });

  it('allows long titles and ride instructions to wrap on normal external cards', () => {
    render(<ExternalEventCard event={event} />);
    expect(screen.getByRole('heading', { name: longTitle })).toHaveClass('break-words');
    expect(screen.getByText(rideNotes)).toBeInTheDocument();
    expect(screen.getByText(/Rides:/)).toBeInTheDocument();
    expect(screen.getByText(longVenue)).toHaveClass('break-words');
  });

  it('allows long featured names and ride instructions to wrap in the same public-safe representation', () => {
    render(<FeaturedExternal event={event} />);
    expect(screen.getByRole('heading', { name: longTitle })).toHaveClass('min-w-0', 'break-words');
    expect(screen.getByText(rideNotes)).toBeInTheDocument();
    expect(screen.getByText(longVenue)).toHaveClass('break-words');
  });

  it('never invents a venue or date when an external listing omits them', () => {
    render(<ExternalEventFacts event={makeEvent({ location: null, date: null, points: 0 })} />);
    expect(screen.queryByText(/points|pts/i)).not.toBeInTheDocument();
    expect(screen.queryByText(longVenue)).not.toBeInTheDocument();
  });
});
