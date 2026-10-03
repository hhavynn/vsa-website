import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RelatedLinks } from './RelatedLinks';

const renderLinks = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('RelatedLinks', () => {
  it('renders a labelled region of compact link cards', () => {
    renderLinks(
      <RelatedLinks
        heading="Looking for…?"
        links={[
          { to: '/points', label: 'Find My Points', description: 'Look up your total.' },
          { to: '/leaderboard#how-points-work', label: 'How points work' },
        ]}
      />,
    );
    const region = screen.getByRole('complementary', { name: 'Looking for…?' });
    expect(region).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Find My Points/ })).toHaveAttribute('href', '/points');
    expect(screen.getByRole('link', { name: /How points work/ })).toHaveAttribute(
      'href',
      '/leaderboard#how-points-work',
    );
    // Related content, not a second nav bar.
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('runs a link\'s onClick handler', () => {
    const onClick = jest.fn();
    renderLinks(<RelatedLinks links={[{ to: '/x#y', label: 'Jump', onClick }]} />);
    fireEvent.click(screen.getByRole('link', { name: /Jump/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when there is nothing relevant to offer', () => {
    const { container } = renderLinks(<RelatedLinks links={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders its children slot even with no cards', () => {
    renderLinks(
      <RelatedLinks links={[]}>
        <p>Extra</p>
      </RelatedLinks>,
    );
    expect(screen.getByText('Extra')).toBeInTheDocument();
  });
});
