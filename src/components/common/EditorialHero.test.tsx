import { render, screen } from '@testing-library/react';
import { EditorialHero, EditorialHeroScript } from './EditorialHero';

describe('EditorialHero', () => {
  it('renders one h1 with the emphasized word and hides the watermark from assistive tech', () => {
    const { container } = render(
      <EditorialHero
        eyebrow="House Board"
        title={<>House <EditorialHeroScript>Program</EditorialHeroScript></>}
        meta="Year-long community competition."
        watermark="houses"
      />
    );

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('House Program');
    expect(heading.querySelector('.editorial-hero-script')).toHaveTextContent('Program');
    expect(screen.getByText('Year-long community competition.')).toBeInTheDocument();
    expect(container.querySelector('.editorial-hero-watermark')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders the actions row only when actions are provided', () => {
    const { container, rerender } = render(<EditorialHero eyebrow="Event Flyer" title="Wild N' Culture" />);
    expect(container.querySelector('.editorial-hero-actions')).toBeNull();

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
