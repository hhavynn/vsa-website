import React from "react";
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminNav } from './AdminNav';
import { ADMIN_EXPANDED_STORAGE_KEY, ADMIN_FAVORITES_STORAGE_KEY } from '../../../hooks/useAdminNavPreferences';
import { ADMIN_NAV_GROUPS, DEFAULT_ADMIN_FAVORITES, MAX_ADMIN_FAVORITES } from '../../../lib/adminNavigation';

jest.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { email: 'cab@vsaucsd.org' } }) }));

function renderNav(path = '/admin', props: Partial<React.ComponentProps<typeof AdminNav>> = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminNav {...props} />
    </MemoryRouter>,
  );
}

const groupButton = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name.replace(/&/g, '\\&')}`) });
const favorites = () => within(screen.getByRole('region', { name: /Favorites/ }));

beforeEach(() => window.localStorage.clear());

describe('AdminNav groups', () => {
  it('shows the dashboard plus the groups, not all 31 destinations at once', () => {
    renderNav('/admin');
    // Dashboard is a plain link; the other five are collapsible group headings.
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    const headings = ADMIN_NAV_GROUPS.filter((g) => g.group).map((g) => g.group as string);
    expect(headings).toHaveLength(5);
    for (const heading of headings) expect(groupButton(heading)).toBeInTheDocument();

    const visibleLinks = screen.getAllByRole('link').length;
    // Dashboard + favorites + one default group + footer, far fewer than 31 + chrome.
    expect(visibleLinks).toBeLessThan(20);
  });

  it('opens only the group holding the current page on a direct visit', () => {
    renderNav('/admin/gallery');
    expect(groupButton('Content & Outreach')).toHaveAttribute('aria-expanded', 'true');
    expect(groupButton('Events & Attendance')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'Gallery' })).toHaveAttribute('aria-current', 'page');
    // A destination inside a collapsed group is not reachable until it is opened.
    expect(screen.queryByRole('link', { name: 'Analytics' })).not.toBeInTheDocument();
  });

  it('highlights nested routes under their parent group', () => {
    renderNav('/admin/cabinet/rollover');
    expect(groupButton('Programs & People')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Cabinet Rollover' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Cabinet' })).not.toHaveAttribute('aria-current');
  });

  it('opens the default group on the dashboard for a first-time visitor', () => {
    renderNav('/admin');
    expect(groupButton('Events & Attendance')).toHaveAttribute('aria-expanded', 'true');
  });

  it('lets an admin open another group without losing the current page', () => {
    renderNav('/admin/gallery');
    fireEvent.click(groupButton('Planning & Health'));

    expect(groupButton('Planning & Health')).toHaveAttribute('aria-expanded', 'true');
    expect(groupButton('Content & Outreach')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Gallery' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Analytics' })).toHaveAttribute('href', '/admin/analytics');
  });

  it('collapses a group and hides its links from the accessibility tree', () => {
    renderNav('/admin/gallery');
    fireEvent.click(groupButton('Content & Outreach'));
    expect(groupButton('Content & Outreach')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Gallery' })).not.toBeInTheDocument();
    expect(groupButton('Content & Outreach')).toHaveTextContent('contains the current page');
  });

  it('remembers open groups across visits', () => {
    const view = renderNav('/admin/gallery');
    fireEvent.click(groupButton('Planning & Health'));
    view.unmount();

    renderNav('/admin/gallery');
    expect(groupButton('Planning & Health')).toHaveAttribute('aria-expanded', 'true');
  });

  it('ignores a corrupted expanded-state value', () => {
    window.localStorage.setItem(ADMIN_EXPANDED_STORAGE_KEY, '{not json');
    renderNav('/admin/gallery');
    expect(groupButton('Content & Outreach')).toHaveAttribute('aria-expanded', 'true');

    window.localStorage.setItem(ADMIN_EXPANDED_STORAGE_KEY, JSON.stringify(['nope', 42, null, 'planning-health']));
    renderNav('/admin/gallery');
    expect(screen.getAllByRole('button', { name: /^Planning & Health/ }).some((b) => b.getAttribute('aria-expanded') === 'true')).toBe(true);
  });

  it('survives storage that throws', () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderNav('/admin/gallery');
    fireEvent.click(groupButton('Planning & Health'));
    expect(groupButton('Planning & Health')).toHaveAttribute('aria-expanded', 'true');
    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe('AdminNav favorites', () => {
  it('starts with the default favorites', () => {
    renderNav('/admin');
    const labels = favorites().getAllByRole('link').map((link) => link.textContent);
    expect(labels).toEqual(['Events', 'Attendance Imports', 'Members', 'Houses']);
    expect(DEFAULT_ADMIN_FAVORITES).toHaveLength(4);
  });

  it('pins a page, saves it to this browser only, and unpins it', () => {
    renderNav('/admin/gallery');
    fireEvent.click(screen.getByRole('button', { name: 'Pin Gallery to favorites' }));

    expect(favorites().getByRole('link', { name: 'Gallery' })).toHaveAttribute('href', '/admin/gallery');
    expect(JSON.parse(window.localStorage.getItem(ADMIN_FAVORITES_STORAGE_KEY) ?? '[]')).toContain('/admin/gallery');

    fireEvent.click(favorites().getByRole('button', { name: 'Unpin Gallery from favorites' }));
    expect(favorites().queryByRole('link', { name: 'Gallery' })).not.toBeInTheDocument();
  });

  it('stops at the cap and says why', () => {
    renderNav('/admin/gallery');
    fireEvent.click(screen.getByRole('button', { name: 'Pin Gallery to favorites' }));
    expect(favorites().getAllByRole('link')).toHaveLength(MAX_ADMIN_FAVORITES);

    const blocked = screen.getByRole('button', { name: /Favorites are full \(5\)\. Unpin one to add Content Calendar/ });
    expect(blocked).toBeDisabled();
  });

  it('shows an empty state after every favorite is removed, and keeps it empty on reload', () => {
    const view = renderNav('/admin');
    for (const button of favorites().getAllByRole('button')) fireEvent.click(button);
    expect(screen.getByText(/Use the star beside any page to pin up to 5 here/)).toBeInTheDocument();
    view.unmount();

    renderNav('/admin');
    expect(screen.getByText(/Use the star beside any page to pin up to 5 here/)).toBeInTheDocument();
  });

  it.each([['{not json'], ['"a string"'], ['{"a":1}']])('falls back to the defaults for invalid stored value %s', (raw) => {
    window.localStorage.setItem(ADMIN_FAVORITES_STORAGE_KEY, raw);
    renderNav('/admin');
    expect(favorites().getAllByRole('link')).toHaveLength(DEFAULT_ADMIN_FAVORITES.length);
  });

  it('drops unknown, duplicate, and dashboard entries from a stored list', () => {
    window.localStorage.setItem(ADMIN_FAVORITES_STORAGE_KEY, JSON.stringify(['/admin/gone', '/admin', '/admin/gallery', '/admin/gallery', 7]));
    renderNav('/admin');
    expect(favorites().getAllByRole('link').map((l) => l.textContent)).toEqual(['Gallery']);
  });
});

describe('AdminNav mobile drawer', () => {
  it('is not rendered until opened', () => {
    renderNav('/admin', { isOpen: false, onClose: jest.fn() });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens as a labelled modal dialog with a close button focused first', () => {
    renderNav('/admin', { isOpen: true, onClose: jest.fn() });
    const dialog = screen.getByRole('dialog', { name: 'Admin navigation' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('button', { name: 'Close navigation' })).toHaveFocus();
    expect(within(dialog).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = jest.fn();
    renderNav('/admin', { isOpen: true, onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is pressed', () => {
    const onClose = jest.fn();
    renderNav('/admin', { isOpen: true, onClose });
    fireEvent.click(screen.getByTestId('admin-nav-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes after choosing a destination', () => {
    const onClose = jest.fn();
    renderNav('/admin', { isOpen: true, onClose });
    // Pinned by default, so it appears under Favorites and in its group; either closes the drawer.
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('link', { name: 'Attendance Imports' })[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps Tab inside the drawer', () => {
    renderNav('/admin', { isOpen: true, onClose: jest.fn() });
    const dialog = screen.getByRole('dialog');
    // Tab order is document order across links and buttons, which role queries do not preserve.
    // eslint-disable-next-line testing-library/no-node-access
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"])'));
    focusable[focusable.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(focusable[0]).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(focusable[focusable.length - 1]).toHaveFocus();
  });

  it('restores focus to whatever opened it', () => {
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return (
        <MemoryRouter>
          <button onClick={() => setOpen(true)}>menu</button>
          <AdminNav isOpen={open} onClose={() => setOpen(false)} />
        </MemoryRouter>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'menu' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(trigger).toHaveFocus();
  });

  it('locks page scroll while open and releases it on close', () => {
    const view = renderNav('/admin', { isOpen: true, onClose: jest.fn() });
    expect(document.body.style.overflow).toBe('hidden');
    view.unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
