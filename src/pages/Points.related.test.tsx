/* eslint-disable testing-library/no-node-access -- anchor target lookup */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Points from './Points';

jest.mock('../hooks/useFindMyPoints', () => ({
  useFindMyPoints: () => ({ error: null }),
}));
jest.mock('../components/features/points/FindMyPoints', () => ({
  FindMyPoints: () => <div>Find my points lookup</div>,
}));
jest.mock('../components/features/points/PointsExplainer', () => ({
  PointsExplainer: () => <h2>Earn Points, Show Up</h2>,
}));

describe('/points related links', () => {
  it('offers the leaderboard and events as next steps', () => {
    render(
      <MemoryRouter>
        <Points />
      </MemoryRouter>,
    );
    const related = screen.getByRole('complementary', { name: 'Related' });
    expect(related).toHaveTextContent('Leaderboard');
    expect(screen.getByRole('link', { name: /Leaderboard/ })).toHaveAttribute('href', '/leaderboard');
    expect(screen.getByRole('link', { name: /Earn more points/ })).toHaveAttribute('href', '/events');
  });

  it('exposes the existing explainer as the #how-points-work target (no duplicate page)', () => {
    render(
      <MemoryRouter>
        <Points />
      </MemoryRouter>,
    );
    const anchor = document.getElementById('how-points-work');
    expect(anchor).not.toBeNull();
    expect(anchor).toHaveTextContent('Earn Points, Show Up');
  });
});
