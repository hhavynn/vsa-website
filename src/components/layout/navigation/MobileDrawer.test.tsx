import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { MobileDrawer } from './MobileDrawer';

jest.mock('./UserMenu', () => ({
  UserMenu: () => <button type="button">Account actions</button>,
}));

function DrawerHarness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open navigation menu
      </button>
      <MobileDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

describe('MobileDrawer keyboard accessibility', () => {
  it('exposes the visible drawer groups as real headings and named regions', async () => {
    render(<MemoryRouter><DrawerHarness /></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));

    for (const label of ['Quick links', 'Get Involved', 'Explore']) {
      const region = screen.getByRole('region', { name: label });
      expect(region).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: label, level: 2 })).toBeInTheDocument();
    }
    expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toBeInTheDocument();
  });

  it('traps Tab within the drawer and restores focus to its opener after Escape', async () => {
    render(
      <MemoryRouter>
        <DrawerHarness />
      </MemoryRouter>
    );

    const opener = screen.getByRole('button', { name: 'Open navigation menu' });
    await userEvent.click(opener);

    const firstLink = screen.getByRole('link', { name: 'VSA at UCSD' });
    const lastButton = screen.getByRole('button', { name: 'Account actions' });
    const focusableCount = screen.getAllByRole('link').length + 2;

    await waitFor(() => expect(firstLink).toHaveFocus());

    for (let index = 1; index < focusableCount; index += 1) {
      await userEvent.tab();
    }
    expect(lastButton).toHaveFocus();

    await userEvent.tab();
    expect(firstLink).toHaveFocus();

    await userEvent.tab({ shift: true });
    expect(lastButton).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
