import { render, screen, within } from '@testing-library/react';
import { SectionHeading } from './Editorial';

describe('SectionHeading', () => {
  it('renders one heading with the italic accent word and keeps the eyebrow out of it', () => {
    render(
      <SectionHeading
        id="events-title"
        eyebrow="On the calendar"
        title="Upcoming"
        accent="Events"
        action={<a href="/events">View all events</a>}
      />,
    );
    const heading = screen.getByRole('heading', { level: 2, name: 'Upcoming Events' });
    expect(heading).toHaveAttribute('id', 'events-title');
    expect(within(heading).getByText('Events', { selector: 'em' })).toBeInTheDocument();
    expect(screen.getByText('On the calendar')).not.toBe(heading);
    expect(screen.getByRole('link', { name: 'View all events' })).toBeInTheDocument();
  });

  it('can render a different heading level for nested sections', () => {
    render(<SectionHeading as="h3" eyebrow="Archive" title="Recent" />);
    expect(screen.getByRole('heading', { level: 3, name: 'Recent' })).toBeInTheDocument();
  });
});
