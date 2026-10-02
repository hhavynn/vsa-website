import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { UVSA_SOCAL } from '../../../config/uvsaSocal';
import { Event } from '../../../types';
import { makeEvent, makeSchool, OWN_LOGO_URL } from '../../../test-utils/uvsaFixtures';
import { ExternalEventLinks, ExternalHostedBy } from './ExternalEventHost';
import { FeaturedEventCard, PastEventMemoryCard, UpcomingEventRow } from './PublicEventCards';

jest.mock('./EventInterestButtons', () => ({ EventInterestButtons: () => null }));
jest.mock('./AddToCalendarButton', () => ({ AddToCalendarButton: () => null }));

const uci = makeSchool({
  id: 'uci-id',
  slug: 'uci',
  short_name: 'UCI',
  vsa_name: 'VSA UCI',
  logo_url: OWN_LOGO_URL.replace('ucsd', 'uci'),
  instagram_url: 'https://www.instagram.com/vsauci/',
  linktree_url: 'https://linktr.ee/vsauci',
  website_url: 'https://vsa.uci.edu',
});

const schoolListing = makeEvent({ uvsa_school: uci, uvsa_school_id: 'uci-id' });
const socalListing = makeEvent({ host_type: 'uvsa_socal', uvsa_school_id: null, uvsa_school: undefined });

describe('ExternalHostedBy', () => {
  it('shows a school host with its logo, name and inherited shortcuts', () => {
    render(<ExternalHostedBy listing={schoolListing} />);

    expect(screen.getByText('Hosted by')).toBeInTheDocument();
    expect(screen.getByText('VSA UCI')).toBeInTheDocument();
    expect(screen.getByAltText('UCI logo')).toHaveAttribute('src', expect.stringContaining('/uci/'));
    // The logo opens the school's Instagram, like the school directory does.
    expect(screen.getByRole('link', { name: 'UCI on Instagram' })).toHaveAttribute('href', 'https://www.instagram.com/vsauci/');
    expect(screen.getByRole('link', { name: 'UCI Instagram' })).toHaveAttribute('href', 'https://www.instagram.com/vsauci/');
    expect(screen.getByRole('link', { name: 'UCI Linktree' })).toHaveAttribute('href', 'https://linktr.ee/vsauci');
    expect(screen.getByRole('link', { name: 'UCI Website' })).toHaveAttribute('href', 'https://vsa.uci.edu');
  });

  it('shows UVSA SoCal with its configured identity and only the links that exist', () => {
    render(<ExternalHostedBy listing={socalListing} />);

    expect(screen.getByText('UVSA Southern California')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'UVSA logo placeholder' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'UVSA SoCal Instagram' })).toHaveAttribute('href', UVSA_SOCAL.instagramUrl);
    expect(screen.queryByRole('link', { name: /Linktree/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Website/ })).not.toBeInTheDocument();
  });

  it('omits shortcuts in the compact card form', () => {
    render(<ExternalHostedBy listing={schoolListing} compact />);
    expect(screen.getByText('VSA UCI')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'UCI Linktree' })).not.toBeInTheDocument();
  });

  it('degrades gracefully when a school host lost its school', () => {
    render(<ExternalHostedBy listing={makeEvent({ uvsa_school: undefined, uvsa_school_id: null })} />);
    expect(screen.getByText('Another VSA')).toBeInTheDocument();
  });
});

describe('ExternalEventLinks', () => {
  it('renders only the buttons whose URLs exist', () => {
    render(
      <ExternalEventLinks
        listing={makeEvent({
          rsvp_url: 'https://rsvp.example/fall',
          host_info_url: null,
          instagram_url: 'https://instagram.com/p/1',
          ride_form_url: null,
        })}
      />,
    );
    expect(screen.getByRole('link', { name: /RSVP \/ Tickets/ })).toHaveAttribute('href', 'https://rsvp.example/fall');
    expect(screen.getByRole('link', { name: /Instagram Post/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Event Info/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Ride Form/ })).not.toBeInTheDocument();
  });

  it('shows every CTA and the ride info when all are set', () => {
    render(
      <ExternalEventLinks
        listing={makeEvent({
          rsvp_url: 'https://rsvp.example',
          host_info_url: 'https://info.example',
          instagram_url: 'https://instagram.com/p/1',
          ride_form_url: 'https://forms.example/ride',
          ride_info: 'Meet at Gilman parking structure at 5:30 PM.',
        })}
      />,
    );
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.getByRole('link', { name: /UCSD Ride Form/ })).toHaveAttribute('href', 'https://forms.example/ride');
    expect(screen.getByText(/Meet at Gilman parking structure at 5:30 PM\./)).toBeInTheDocument();
  });

  it('renders nothing when there is nothing to show', () => {
    const { container } = render(
      <ExternalEventLinks listing={makeEvent({ rsvp_url: null, host_info_url: null, instagram_url: null, ride_form_url: null, ride_info: null })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('/events cards for an external event', () => {
  const event: Event = {
    id: 'evt-1',
    name: 'UVSA SoCal Fall Social',
    description: 'A night.',
    date: '2026-10-25T00:00:00Z',
    start_time: null,
    end_time: null,
    end_date: null,
    location: 'Irvine',
    points: 4,
    event_type: 'external_event',
    is_code_expired: false,
    is_published: true,
    academic_term_id: null,
    interest_counts: null,
  };
  const wrap = (node: JSX.Element) => <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>;

  it('names the organizer and offers the event links on the featured card and list row', () => {
    const listing = makeEvent({ ...socalListing, rsvp_url: 'https://rsvp.example/socal' });

    const { unmount } = render(wrap(<FeaturedEventCard event={event} external={listing} />));
    expect(screen.getByText('UVSA Southern California')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /RSVP \/ Tickets/ })).toHaveAttribute('href', 'https://rsvp.example/socal');
    unmount();

    render(wrap(<UpcomingEventRow event={event} external={listing} />));
    expect(screen.getByText('UVSA Southern California')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /RSVP \/ Tickets/ })).toBeInTheDocument();
  });

  it('keeps the memory-wall card compact: organizer line only, no buttons', () => {
    render(wrap(<PastEventMemoryCard event={event} terms={[]} index={0} external={makeEvent({ ...schoolListing, rsvp_url: 'https://rsvp.example' })} />));
    expect(screen.getByText('VSA UCI')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /RSVP/ })).not.toBeInTheDocument();
  });

  it('draws normal events exactly as before', () => {
    render(wrap(<UpcomingEventRow event={{ ...event, event_type: 'gbm' }} />));
    expect(screen.queryByText('Hosted by')).not.toBeInTheDocument();
  });

  it('shows the host line inside the card scope for a school host', () => {
    render(wrap(<UpcomingEventRow event={event} external={schoolListing} />));
    const hosted = screen.getByText('Hosted by').parentElement as HTMLElement; // eslint-disable-line testing-library/no-node-access
    expect(within(hosted).getByText('VSA UCI')).toBeInTheDocument();
  });
});
