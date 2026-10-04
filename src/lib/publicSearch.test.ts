import {
  DOCK_ITEMS,
  EXPLORE_LINKS,
  GET_INVOLVED,
  QUICK_LINKS,
} from '../components/layout/navigation/navConfig';
import { FOOTER_GROUPS, FOOTER_LEGAL_LINKS } from '../components/layout/navigation/footerLinks';
import { PUBLIC_ROUTE_DECISIONS } from '../routes/publicRouteInventory';
import { getPublicDestination, getPublicDestinations } from './publicDestinations';
import {
  buildAlbumEntries,
  buildEventEntries,
  buildStaticEntries,
  flattenGroups,
  normalizeSearchText,
  searchPublicEntries,
  suggestedDestinations,
  type PublicSearchEntry,
} from './publicSearch';
import type { PublicSearchEvent } from '../data/repos/events';
import type { PublicSearchAlbum } from '../data/repos/gallery';

const event = (overrides: Partial<PublicSearchEvent> & Pick<PublicSearchEvent, 'id' | 'name'>): PublicSearchEvent => ({
  date: '2026-10-20',
  end_date: null,
  location: null,
  event_type: 'other',
  academic_term_id: 'term-fall-26',
  ...overrides,
});

const album = (overrides: Partial<PublicSearchAlbum> & Pick<PublicSearchAlbum, 'id' | 'title'>): PublicSearchAlbum => ({
  date: '2026-05-01',
  google_photos_url: 'https://photos.app.goo.gl/abc',
  ...overrides,
});

const TODAY = '2026-10-04';
const staticEntries = buildStaticEntries();
const paths = staticEntries.map((entry) => entry.to);

describe('static index is sourced from the canonical route/nav metadata', () => {
  it('contains every primary-nav and dock destination, with the nav label as its title', () => {
    for (const link of [...QUICK_LINKS, ...GET_INVOLVED, ...EXPLORE_LINKS, ...DOCK_ITEMS]) {
      const entry = staticEntries.find((candidate) => candidate.to === link.path);
      expect(entry?.title).toBe(link.label);
    }
  });

  it('contains every footer destination except legacy aliases', () => {
    const footerPaths = [...FOOTER_GROUPS.flatMap((group) => group.links), ...FOOTER_LEGAL_LINKS].map((link) => link.to);
    const aliases = Object.entries(PUBLIC_ROUTE_DECISIONS)
      .filter(([, decision]) => decision.placements.includes('alias'))
      .map(([path]) => path);

    expect(footerPaths.filter((path) => !aliases.includes(path) && !paths.includes(path))).toEqual([]);
    expect(footerPaths.filter((path) => aliases.includes(path) && paths.includes(path))).toEqual([]);
  });

  it('includes recorded public routes that sit in no nav list, using their inventory title', () => {
    expect(staticEntries.find((entry) => entry.to === '/house/archive')?.title).toBe('House archive');
    expect(staticEntries.find((entry) => entry.to === '/vcn/current')?.title).toBe('VCN: this year’s show');
    expect(staticEntries.find((entry) => entry.to === '/vcn/archive')?.title).toBe('VCN archive');
  });

  it('indexes every searchable public route in the inventory, so a new route cannot silently go unsearchable', () => {
    const expected = Object.entries(PUBLIC_ROUTE_DECISIONS)
      .filter(([path, decision]) => !path.includes(':') && !decision.placements.some((p) => ['alias', 'redirect', 'unlinked'].includes(p)))
      .map(([path]) => path);
    expect(expected.filter((path) => !paths.includes(path))).toEqual([]);
  });

  it('only ever indexes a path the route inventory knows about (no second page list)', () => {
    for (const path of paths) {
      const base = path.split('#')[0] || '/';
      expect(PUBLIC_ROUTE_DECISIONS[base]).toBeDefined();
    }
  });

  it('never indexes admin routes, redirects, aliases, unlinked entry points or parametric routes', () => {
    expect(paths.filter((path) => path.startsWith('/admin'))).toEqual([]);
    expect(paths).not.toContain('/signin');
    expect(paths).not.toContain('/house-system');
    expect(paths.filter((path) => path.includes(':'))).toEqual([]);
    const excluded = Object.entries(PUBLIC_ROUTE_DECISIONS)
      .filter(([, decision]) => decision.placements.some((placement) => ['alias', 'redirect', 'unlinked'].includes(placement)))
      .map(([path]) => path);
    expect(excluded.filter((path) => paths.includes(path))).toEqual([]);
  });

  it('keeps every page key unique, and keeps a Home entry', () => {
    const keys = staticEntries.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(paths).toContain('/');
  });

  it('does not index application links, titles or URLs', () => {
    const everything = JSON.stringify(staticEntries).toLowerCase();
    expect(everything).not.toContain('forms.gle');
    expect(everything).not.toContain('docs.google.com/forms');
    expect(everything).not.toMatch(/apply (now|here)/);
  });

  it('shares one destination model with breadcrumbs', () => {
    expect(getPublicDestination('/vcn/current')?.crumb).toBe('This year’s show');
    expect(getPublicDestinations().length).toBe(staticEntries.length);
  });
});

describe('normalizeSearchText', () => {
  it('lowercases, strips diacritics and flattens punctuation', () => {
    expect(normalizeSearchText('Văn Hóa — Đêm!')).toBe('van hoa dem');
    expect(normalizeSearchText("Wild n' Culture")).toBe('wild n culture');
    expect(normalizeSearchText('Dragon & Phoenix')).toBe('dragon and phoenix');
  });
});

describe('searchPublicEntries: matching and grouping', () => {
  const entries: PublicSearchEntry[] = [
    ...staticEntries,
    ...buildEventEntries(
      [
        event({ id: 'e1', name: 'House Reveal', date: '2026-10-20', location: 'Price Center', event_type: 'mixer' }),
        event({ id: 'e2', name: 'General Body Meeting', date: '2026-10-08', event_type: 'gbm' }),
        event({ id: 'e3', name: 'House Olympics', date: '2026-02-10', end_date: null }),
        event({ id: 'e4', name: 'Văn Hóa Night', date: '2026-01-15' }),
      ],
      TODAY,
    ),
    ...buildAlbumEntries([
      album({ id: 'a1', title: 'House Reveal 2025', date: '2025-10-18' }),
      album({ id: 'a2', title: 'Beach Day', date: '2026-05-01' }),
    ]),
  ];

  it('returns nothing for an empty or punctuation-only query', () => {
    expect(searchPublicEntries(entries, '')).toEqual([]);
    expect(searchPublicEntries(entries, '   ')).toEqual([]);
    expect(searchPublicEntries(entries, '?!')).toEqual([]);
  });

  it('groups results by type in a fixed order: pages & programs, events, photo albums', () => {
    const groups = searchPublicEntries(entries, 'house');
    expect(groups.map((group) => group.type)).toEqual(['page', 'event', 'album']);
    expect(groups.map((group) => group.label)).toEqual(['Pages & programs', 'Events', 'Photo albums']);
  });

  it('distinguishes the House program from similarly named events and albums', () => {
    const groups = searchPublicEntries(entries, 'house');
    const page = groups[0].results.find((result) => result.to === '/house');
    const reveal = groups[1].results.find((result) => result.title === 'House Reveal');
    const albumResult = groups[2].results[0];

    expect(page).toMatchObject({ type: 'page', typeLabel: 'Program' });
    expect(reveal).toMatchObject({ type: 'event', typeLabel: 'Event', to: '/events#event-e1' });
    expect(albumResult).toMatchObject({ type: 'album', typeLabel: 'Photo album' });
    // Same words, three different keys: a page and an event can never be confused for each other.
    expect(new Set([page?.key, reveal?.key, albumResult.key]).size).toBe(3);
  });

  it('ranks an exact title above a partial one', () => {
    const [pages] = searchPublicEntries(entries, 'vcn');
    expect(pages.results[0].to).toBe('/vcn');
  });

  it('requires every word to match, wherever it matches (title, synonyms, detail)', () => {
    const groups = searchPublicEntries(entries, 'house price');
    expect(flattenGroups(groups).map((result) => result.title)).toEqual(['House Reveal']);
  });

  it('finds pages by synonym, including a footer label that differs from the nav label', () => {
    expect(flattenGroups(searchPublicEntries(entries, 'get involved'))[0].to).toBe('/get-involved');
    expect(flattenGroups(searchPublicEntries(entries, 'big little'))[0].to).toBe('/ace');
    expect(flattenGroups(searchPublicEntries(entries, 'photos'))[0].to).toBe('/gallery');
  });

  it('matches without diacritics or exact case', () => {
    expect(flattenGroups(searchPublicEntries(entries, 'VAN HOA')).map((result) => result.title)).toContain('Văn Hóa Night');
  });

  it('caps each group and reports how many more matched, with a browse-all target', () => {
    const many = buildEventEntries(
      Array.from({ length: 9 }, (_, index) => event({ id: `m${index}`, name: `Mixer ${index}`, date: `2026-11-0${index + 1}` })),
      TODAY,
    );
    const [group] = searchPublicEntries(many, 'mixer', 5);
    expect(group.results).toHaveLength(5);
    expect(group.hiddenCount).toBe(4);
    expect(group.browseAll).toEqual({ to: '/events', label: 'Browse all events' });
  });

  it('returns no group for a type with no match', () => {
    expect(searchPublicEntries(entries, 'beach').map((group) => group.type)).toEqual(['album']);
  });

  it('ignores absurdly long input instead of scanning on it', () => {
    expect(() => searchPublicEntries(entries, 'a '.repeat(500))).not.toThrow();
  });

  it('yields start-here suggestions from the nav config for an empty box or an empty result', () => {
    const suggested = suggestedDestinations().map((entry) => entry.to);
    expect(suggested).toEqual(expect.arrayContaining(['/events', '/calendar', '/points', '/get-involved']));
    expect(suggested.filter((path) => path.startsWith('/admin'))).toEqual([]);
  });
});

describe('dynamic entries', () => {
  it('sorts upcoming events first (soonest first), then past events newest first', () => {
    const built = buildEventEntries(
      [
        event({ id: 'past-old', name: 'Mixer A', date: '2026-01-01' }),
        event({ id: 'future-late', name: 'Mixer B', date: '2026-12-01' }),
        event({ id: 'past-new', name: 'Mixer C', date: '2026-09-01' }),
        event({ id: 'future-soon', name: 'Mixer D', date: '2026-10-10' }),
      ],
      TODAY,
    );
    expect(built.map((entry) => entry.key)).toEqual(['event:future-soon', 'event:future-late', 'event:past-new', 'event:past-old']);
  });

  it('keeps a multi-day event that started before today but has not ended among the upcoming', () => {
    const [built] = buildEventEntries([event({ id: 'retreat', name: 'Winter Retreat', date: '2026-10-03', end_date: '2026-10-05' })], TODAY);
    expect(built.to).toBe('/events#event-retreat');
  });

  it('links a past event to its archive term and card, like the Gallery related-event link', () => {
    const [built] = buildEventEntries([event({ id: 'old', name: 'Old Mixer', date: '2025-11-01', academic_term_id: 'term-1' })], TODAY);
    expect(built.to).toBe('/events?term=term-1#event-old');
  });

  it('shows date, place and kind on an event row', () => {
    const [built] = buildEventEntries([event({ id: 'g', name: 'GBM 1', date: '2026-10-08', location: 'PC West', event_type: 'gbm' })], TODAY);
    expect(built.detail).toBe('Oct 8, 2026 · PC West · GBM');
  });

  it('opens albums externally and only accepts https album URLs', () => {
    const built = buildAlbumEntries([
      album({ id: 'ok', title: 'Fine' }),
      album({ id: 'bad', title: 'Bad', google_photos_url: ['java', 'script:alert(1)'].join('') }),
      album({ id: 'http', title: 'Plain', google_photos_url: 'http://example.com/x' }),
    ]);
    expect(built.map((entry) => entry.key)).toEqual(['album:ok']);
    expect(built[0]).toMatchObject({ external: true, to: 'https://photos.app.goo.gl/abc' });
  });
});
