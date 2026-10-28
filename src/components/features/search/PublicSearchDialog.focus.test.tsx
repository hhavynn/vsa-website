import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PublicSearchDialog from './PublicSearchDialog';

jest.mock('./PublicSearchPanel', () => ({
  PublicSearchPanel: () => (
    <>
      <input aria-label="Search query" />
      <button type="button">First result</button>
    </>
  ),
}));

function SearchHarness() {
  const [open, setOpen] = useState(false);
  const [showOpener, setShowOpener] = useState(true);
  return (
    <>
      <nav aria-label="Primary navigation"><a href="#main-content">Site home</a></nav>
      {showOpener && <button type="button" onClick={() => setOpen(true)}>Open search</button>}
      <button type="button" onClick={() => setShowOpener(false)}>Remove opener</button>
      <button type="button">Background action</button>
      {open && <PublicSearchDialog onClose={() => setOpen(false)} />}
    </>
  );
}

describe('public search dialog focus containment (#316)', () => {
  it('keeps Tab and Shift-Tab inside the popup, and restores opener on Escape', async () => {
    const user = userEvent.setup();
    render(<SearchHarness />);
    const opener = screen.getByRole('button', { name: 'Open search' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Search the site' });
    const close = screen.getByRole('button', { name: 'Close' });
    const last = screen.getByRole('button', { name: 'First result' });
    expect(dialog).toBeInTheDocument();

    last.focus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Search the site' })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('contains programmatic background focus and preserves previous body scroll lock', async () => {
    const user = userEvent.setup();
    document.body.style.overflow = 'clip';
    const { unmount } = render(<SearchHarness />);
    try {
      await user.click(screen.getByRole('button', { name: 'Open search' }));
      expect(document.body.style.overflow).toBe('hidden');
      screen.getByRole('button', { name: 'Background action' }).focus();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus());
      await user.keyboard('{Escape}');
      expect(document.body.style.overflow).toBe('clip');
    } finally {
      unmount();
      document.body.style.overflow = '';
    }
  });

  it('returns focus to navigation when the opener was removed during an open search', async () => {
    const user = userEvent.setup();
    render(<SearchHarness />);
    await user.click(screen.getByRole('button', { name: 'Open search' }));
    // Dispatch the state change from the page, without moving focus outside
    // the modal (which correctly prevents direct background focus).
    await user.click(screen.getByRole('button', { name: 'Remove opener' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Search the site' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Site home' })).toHaveFocus();
  });
});
