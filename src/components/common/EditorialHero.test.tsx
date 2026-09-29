import { render, screen, within } from '@testing-library/react';
import { EditorialHero, EditorialHeroScript } from './EditorialHero';

describe('EditorialHero', () => {
  it('renders one h1 with the emphasized word and hides the watermark from assistive tech', () => {
    render(
      <EditorialHero
        eyebrow="House Board"
        title={<>House <EditorialHeroScript>Program</EditorialHeroScript></>}
        meta="Year-long community competition."
        watermark="houses"
      />
    );

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('House Program');
    expect(within(heading).getByText('Program')).toHaveClass('editorial-hero-script');
    expect(screen.getByText('Year-long community competition.')).toBeInTheDocument();
    expect(screen.getByText('houses')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders the actions row only when actions are provided', () => {
    const { rerender } = render(<EditorialHero eyebrow="Event Flyer" title="Wild N' Culture" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    rerender(
      <EditorialHero
        eyebrow="Event Flyer"
        title="Wild N' Culture"
        actions={<a href="/tickets">Get Tickets</a>}
      />
    );
    expect(screen.getByRole('link', { name: 'Get Tickets' })).toBeInTheDocument();
  });
});
