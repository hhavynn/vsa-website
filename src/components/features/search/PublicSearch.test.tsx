import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider, notifyManager } from 'react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { eventsRepository } from '../../../data/repos/events';
import { galleryRepository } from '../../../data/repos/gallery';
import { PublicSearchButton } from './PublicSearchButton';
import { PublicSearchPanel } from './PublicSearchPanel';
import { PublicSearchProvider } from './PublicSearchProvider';

jest.mock('../../../lib/supabase', () => ({
  get supabase() {
    return require('../../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const futureYear = new Date().getFullYear() + 1;
const PUBLISHED_EVENTS = [
  { id: 'e1', name: 'House Reveal', date: `${futureYear}-10-20`, end_date: null, location: 'Price Center', event_type: 'mixer' as const, academic_term_id: 't1' },
  { id: 'e2', name: 'General Body Meeting', date: `${futureYear}-10-08`, end_date: null, location: null, event_type: 'gbm' as const, academic_term_id: 't1' },
];
const ALBUMS = [
  { id: 'a1', title: 'House Reveal 2025', date: '2025-10-18', google_photos_url: 'https://photos.app.goo.gl/reveal' },
];

let eventsSpy: jest.SpyInstance;
let albumsSpy: jest.SpyInstance;
let legacyEventsSpy: jest.SpyInstance;

// react-query notifies observers outside React's batch; route it through act()
// so the one-time index fetch resolving mid-test is not reported as an unwrapped update.
beforeAll(() => notifyManager.setBatchNotifyFunction((callback) => act(callback)));

beforeEach(() => {
  eventsSpy = jest.spyOn(eventsRepository, 'getPublicSearchEntries').mockResolvedValue(PUBLISHED_EVENTS);
  albumsSpy = jest.spyOn(galleryRepository, 'getPublicSearchAlbums').mockResolvedValue(ALBUMS);
  // The admin-capable read must never back public search.
  legacyEventsSpy = jest.spyOn(eventsRepository, 'getEvents').mockResolvedValue([]);
});
afterEach(async () => {
  // Let the one-time index fetch settle inside act so it cannot update after the test.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  jest.restoreAllMocks();
});

function LocationProbe() {
  const { pathname, search, hash } = useLocation();
  return <div data-testid="location">{`${pathname}${search}${hash}`}</div>;
}

function wrap(children: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        {children}
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const activeOptionText = () => {
  const input = screen.getByRole('combobox');
  const id = input.getAttribute('aria-activedescendant');
  return id ? document.getElementById(id)?.textContent ?? '' : ''; // eslint-disable-line testing-library/no-node-access
};

describe('PublicSearchPanel (dialog variant)', () => {
  it('offers somewhere to start before anything is typed, without fetching on render of unrelated pages', async () => {
    wrap(<PublicSearchPanel variant="dialog" autoFocus />);
    expect(screen.getByText('Start here')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Events/ })).toBeInTheDocument();
    await waitFor(() => expect(eventsSpy).toHaveBeenCalledTimes(1));
  });

  it('shows results grouped by type and distinguishes the House program from the House Reveal event and album', async () => {
    wrap(<PublicSearchPanel variant="dialog" autoFocus />);
    await userEvent.type(screen.getByRole('combobox'), 'house');

    await screen.findByRole('option', { name: /House Reveal 2025/ });
    const groups = screen.getAllByRole('group');
    expect(groups.map((group) => group.firstChild?.textContent)).toEqual(['Pages & programs', 'Events', 'Photo albums']); // eslint-disable-line testing-library/no-node-access

    const pages = within(groups[0]).getByRole('option', { name: /^House Join a house fam/ });
    expect(within(pages).getByText('Program')).toBeInTheDocument();
    const reveal = within(groups[1]).getByRole('option', { name: /House Reveal/ });
    expect(within(reveal).getByText('Event')).toBeInTheDocument();
    expect(within(groups[2]).getByRole('option', { name: /House Reveal 2025/ })).toHaveTextContent('opens in Google Photos');
  });

  it('makes no network request per keystroke: one cached fetch per source, filtering in memory', async () => {
    wrap(<PublicSearchPanel variant="dialog" autoFocus />);
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'general body');
    await screen.findByRole('option', { name: /General Body Meeting/ });
    await userEvent.clear(input);
    await userEvent.type(input, 'reveal');
    await screen.findByRole('option', { name: /^House Reveal Oct/ });

    expect(eventsSpy).toHaveBeenCalledTimes(1);
    expect(albumsSpy).toHaveBeenCalledTimes(1);
    expect(legacyEventsSpy).not.toHaveBeenCalled();
  });

  it('moves with the arrow keys and opens the active result with Enter', async () => {
    wrap(<PublicSearchPanel variant="dialog" autoFocus />);
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'reveal');
    await screen.findByRole('option', { name: /House Reveal 2025/ });

    // First option is the event; ArrowDown reaches the album, ArrowUp comes back.
    expect(activeOptionText()).toContain('House Reveal');
    expect(activeOptionText()).not.toContain('2025');
    await userEvent.keyboard('{ArrowDown}');
    expect(activeOptionText()).toContain('House Reveal 2025');
    await userEvent.keyboard('{ArrowUp}');
    expect(activeOptionText()).not.toContain('2025');
    expect(screen.getAllByRole('option').filter((option) => option.getAttribute('aria-selected') === 'true')).toHaveLength(1);

    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/events\?.*#event-e1$|^\/events#event-e1$/);
  });

  it('never moves past the first or last result', async () => {
    wrap(<PublicSearchPanel variant="dialog" autoFocus />);
    await userEvent.type(screen.getByRole('combobox'), 'general body');
    await screen.findByRole('option', { name: /General Body Meeting/ });
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(activeOptionText()).toContain('General Body Meeting');
  });

  it('opens an album in a new tab with noopener, not in the app', async () => {
    const open = jest.spyOn(window, 'open').mockReturnValue(null);
    wrap(<PublicSearchPanel variant="dialog" autoFocus />);
    await userEvent.type(screen.getByRole('combobox'), 'reveal 2025');
    await userEvent.click(await screen.findByRole('option', { name: /House Reveal 2025/ }));

    expect(open).toHaveBeenCalledWith('https://photos.app.goo.gl/reveal', '_blank', 'noopener,noreferrer');
    expect(screen.getByTestId('location')).toHaveTextContent('/');
    expect(screen.getByTestId('location').textContent).toBe('/');
  });

  it('opens a page result by click', async () => {
    wrap(<PublicSearchPanel variant="dialog" autoFocus />);
    await userEvent.type(screen.getByRole('combobox'), 'calendar');
    await userEvent.click(await screen.findByRole('option', { name: /Calendar/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/calendar');
  });

  it('shows a useful empty state with next steps, not a dead end', async () => {
    wrap(<PublicSearchPanel variant="dialog" autoFocus />);
    await userEvent.type(screen.getByRole('combobox'), 'zzzzqqq');

    expect(await screen.findByText(/Nothing matches/)).toHaveTextContent('zzzzqqq');
    expect(screen.getByText('Try one of these')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Events/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Start Here/ })).toBeInTheDocument();
    // Keyboard still works from the empty state.
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('location').textContent).not.toBe('/');
  });

  it('keeps pages searchable and says so when events or albums fail to load', async () => {
    eventsSpy.mockRejectedValue(new Error('boom'));
    wrap(<PublicSearchPanel variant="dialog" autoFocus />);
    await userEvent.type(screen.getByRole('combobox'), 'calendar');

    expect(await screen.findByRole('option', { name: /Calendar/ })).toBeInTheDocument();
    expect(await screen.findByText(/Events couldn’t load right now/)).toBeInTheDocument();
  });

  it('summarizes the result count in a polite live region', async () => {
    wrap(<PublicSearchPanel variant="dialog" autoFocus />);
    await userEvent.type(screen.getByRole('combobox'), 'general body');
    await screen.findByRole('option', { name: /General Body Meeting/ });
    expect(screen.getByRole('status')).toHaveTextContent('1 result');
  });
});

describe('results never include admin or private surfaces', () => {
  it('finds no admin pages, even when searching for admin words', async () => {
    wrap(<PublicSearchPanel variant="dialog" autoFocus />);
    const input = screen.getByRole('combobox');
    for (const term of ['admin', 'members', 'login', 'applications', 'import', 'check-in']) {
      await userEvent.clear(input);
      await userEvent.type(input, term);
      const rendered = screen.queryAllByRole('option').map((option) => option.textContent ?? '').join(' ').toLowerCase();
      expect(rendered).not.toContain('/admin');
      expect(rendered).not.toMatch(/admin (dashboard|login|overview)|sign in/);
    }
    expect(screen.getByTestId('location').textContent).toBe('/');
  });

  it('reads only the published-events and public-albums projections', async () => {
    wrap(<PublicSearchPanel variant="dialog" autoFocus />);
    await waitFor(() => expect(eventsSpy).toHaveBeenCalled());
    expect(legacyEventsSpy).not.toHaveBeenCalled();
  });
});

describe('PublicSearchPanel (inline variant, for the 404 page)', () => {
  it('stays a plain field and fetches nothing until the visitor touches it', async () => {
    wrap(<PublicSearchPanel variant="inline" />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(eventsSpy).not.toHaveBeenCalled();

    await userEvent.type(screen.getByRole('combobox'), 'gal');
    expect(await screen.findByRole('option', { name: /Gallery/ })).toBeInTheDocument();
    expect(eventsSpy).toHaveBeenCalledTimes(1);
  });

  it('clears the box on Escape instead of leaving the page', async () => {
    const onEscape = jest.fn();
    wrap(<PublicSearchPanel variant="inline" onEscape={onEscape} />);
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'gal');
    await userEvent.keyboard('{Escape}');
    expect(input).toHaveValue('');
    expect(onEscape).not.toHaveBeenCalled();
  });
});

describe('PublicSearchProvider: global entry point', () => {
  function Shell() {
    return (
      <PublicSearchProvider>
        <button type="button">Elsewhere</button>
        <input aria-label="Some other field" />
        <PublicSearchButton />
        <PublicSearchButton compact />
      </PublicSearchProvider>
    );
  }

  it('opens from the header button, focuses the box, locks scroll, and restores focus on Escape', async () => {
    wrap(<Shell />);
    const [desktopButton] = screen.getAllByRole('button', { name: 'Search the site' });
    desktopButton.focus();
    await userEvent.click(desktopButton);

    const dialog = await screen.findByRole('dialog', { name: 'Search the site' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => expect(within(dialog).getByRole('combobox')).toHaveFocus());
    expect(document.body.style.overflow).toBe('hidden');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe('');
    expect(desktopButton).toHaveFocus();
  });

  it('exposes both the desktop pill and the mobile icon trigger', () => {
    wrap(<Shell />);
    expect(screen.getAllByRole('button', { name: 'Search the site' })).toHaveLength(2);
  });

  it('opens and toggles with Ctrl+K from anywhere', async () => {
    wrap(<Shell />);
    await userEvent.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Control>}k{/Control}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('opens with "/" but not while the visitor is typing in a field', async () => {
    wrap(<Shell />);
    await userEvent.click(screen.getByLabelText('Some other field'));
    await userEvent.keyboard('/');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));
    await userEvent.keyboard('/');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('closes after choosing a result and lands on it', async () => {
    wrap(<Shell />);
    await userEvent.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('combobox'), 'gallery{Enter}');

    expect(screen.getByTestId('location')).toHaveTextContent('/gallery');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps Tab inside the dialog', async () => {
    wrap(<Shell />);
    await userEvent.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByRole('combobox');
    const close = within(dialog).getByRole('button', { name: 'Close' });
    await waitFor(() => expect(input).toHaveFocus());

    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.tab();
    expect(input).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(close).toHaveFocus();
  });

  it('renders no trigger outside a provider', () => {
    wrap(<PublicSearchButton />);
    expect(screen.queryByRole('button', { name: 'Search the site' })).not.toBeInTheDocument();
  });
});
