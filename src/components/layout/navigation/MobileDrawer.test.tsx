import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Navigation menu' });
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );

    expect(focusable.length).toBeGreaterThan(1);
    await waitFor(() => expect(document.activeElement).toBe(focusable[0]));

    focusable[focusable.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(focusable[0]);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(focusable[focusable.length - 1]);

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
