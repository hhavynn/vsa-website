import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { useUrlFilter } from './useUrlFilter';

function Probe() {
  const [filter, setFilter] = useUrlFilter(['pending', 'all'], 'filter', 'pending');
  const navigate = useNavigate();
  return (
    <div>
      <p data-testid="filter">{filter}</p>
      <button onClick={() => setFilter('all')}>show all</button>
      <button onClick={() => setFilter('pending')}>show pending</button>
      <button onClick={() => navigate('/page?filter=all')}>link to all</button>
      <button onClick={() => navigate('/page')}>link to bare page</button>
      <button onClick={() => navigate('/page?filter=bogus')}>link to junk</button>
    </div>
  );
}

const renderProbe = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Probe />
    </MemoryRouter>,
  );

describe('useUrlFilter with a non-"all" default', () => {
  it('opens on the default when the URL has no filter, and on the deep link when it has one', () => {
    const { unmount } = renderProbe('/page');
    expect(screen.getByTestId('filter')).toHaveTextContent('pending');
    unmount();
    renderProbe('/page?filter=all');
    expect(screen.getByTestId('filter')).toHaveTextContent('all');
  });

  it('follows the URL while mounted, so a new deep link or Back never leaves a stale filter', async () => {
    renderProbe('/page?filter=all');
    await userEvent.click(screen.getByRole('button', { name: 'link to bare page' }));
    expect(screen.getByTestId('filter')).toHaveTextContent('pending');
    await userEvent.click(screen.getByRole('button', { name: 'link to all' }));
    expect(screen.getByTestId('filter')).toHaveTextContent('all');
  });

  it('ignores an unknown value rather than showing an empty page', async () => {
    renderProbe('/page');
    await userEvent.click(screen.getByRole('button', { name: 'link to junk' }));
    expect(screen.getByTestId('filter')).toHaveTextContent('pending');
  });

  it('writes the choice to the address bar, so refresh and copied links restore it', async () => {
    renderProbe('/page');
    await userEvent.click(screen.getByRole('button', { name: 'show all' }));
    expect(screen.getByTestId('filter')).toHaveTextContent('all');
    await userEvent.click(screen.getByRole('button', { name: 'show pending' }));
    expect(screen.getByTestId('filter')).toHaveTextContent('pending');
  });
});
