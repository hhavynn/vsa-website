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
      userEvent.tab();
    }
    expect(lastButton).toHaveFocus();

    userEvent.tab();
    expect(firstLink).toHaveFocus();

    userEvent.tab({ shift: true });
    expect(lastButton).toHaveFocus();

    userEvent.keyboard('{Escape}');
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
