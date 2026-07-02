import {
  addDaysToDateOnly,
  applicationToCalendarItems,
  buildGcalAllDayDatesFromDateOnly,
  buildGoogleCalendarUrl,
  compareCalendarItems,
  formatDayGroupLabel,
  getCalendarWindow,
  getMonthGrid,
  groupItemsByDate,
  houseEventToCalendarItem,
  isPointsEligible,
  itemOccursOn,
  matchesCategoryFilter,
  matchesScope,
  vsaEventToCalendarItem,
  CalendarItem,
} from './calendar';
import { Event, HouseEvent, PublicApplicationLink } from '../types';

function makeItem(overrides: Partial<CalendarItem> = {}): CalendarItem {
  return {
    key: 'vsa:1',
    source: 'vsa',
    title: 'Test Event',
    description: null,
    date: '2026-07-10',
    endDate: null,
    startTime: null,
    endTime: null,
    location: null,
    category: 'gbm',
    categoryLabel: 'General Body Meeting',
    points: null,
    imageUrl: null,
    thumbnailUrl: null,
    houses: [],
    detailPath: '/events',
    applicationStatus: null,
    deadlineKind: null,
    ...overrides,
  };
}

const baseEvent: Event = {
  id: 'e1',
  name: 'Fall GBM',
  description: 'First GBM of the year',
  date: '2026-10-02T00:00:00+00:00',
  start_time: '19:00:00',
  end_time: '21:00:00',
  end_date: null,
  location: 'PC Ballroom',
  points: 10,
  event_type: 'gbm',
  check_in_form_url: '',
  is_code_expired: false,
  is_published: true,
};

describe('calendar date math', () => {
  it('adds days across month boundaries without timezone shift', () => {
    expect(addDaysToDateOnly('2026-07-30', 3)).toBe('2026-08-02');
    expect(addDaysToDateOnly('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('computes a window spanning 3 months back to 9 months ahead', () => {
    const { start, end } = getCalendarWindow('2026-07-02');
    expect(start).toBe('2026-04-01');
    expect(end).toBe('2027-04-30');
  });
});

describe('vsaEventToCalendarItem', () => {
  it('maps only public-safe fields', () => {
    const item = vsaEventToCalendarItem(baseEvent);
    expect(item.key).toBe('vsa:e1');
    expect(item.date).toBe('2026-10-02');
    expect(item.points).toBe(10);
    expect(item.category).toBe('gbm');
    expect(item.detailPath).toBe('/events');
    expect(JSON.stringify(item)).not.toContain('check_in');
  });
});

describe('houseEventToCalendarItem', () => {
  it('normalizes house tags and links to the house page', () => {
    const houseEvent = {
      id: 'h1',
      house_profile_id: 'hp1',
      academic_year_start: 2026,
      academic_year_end: 2027,
      title: 'Boo Beach Day',
      slug: null,
      description: null,
      event_date: '2026-10-10',
      start_time: null,
      end_time: null,
      location: 'La Jolla Shores',
      image_url: null,
      image_thumbnail_url: null,
      gallery_url: null,
      recap_url: null,
      rsvp_url: null,
      google_calendar_enabled: true,
      is_published: true,
      created_at: '',
      updated_at: '',
      houses: [{ house_key: 'boo', house: 'Boo', display_name: 'House Boo', accent_color: null }],
    } as unknown as HouseEvent;

    const item = houseEventToCalendarItem(houseEvent);
    expect(item.category).toBe('house');
    expect(item.houses).toHaveLength(1);
    expect(item.houses[0].name).toBe('Boo');
    expect(item.houses[0].color).toBeTruthy();
    expect(item.detailPath).toBe('/house/boo');
  });
});

describe('applicationToCalendarItems', () => {
  const link: PublicApplicationLink = {
    id: 'a1',
    application_key: 'ace_application',
    title: 'ACE Application',
    description: 'Join a fam!',
    button_label: 'Apply',
    target_url: null,
    status: 'open',
    open_at: '2026-09-20T17:00:00+00:00',
    due_at: '2026-10-05T06:59:00+00:00',
    is_enabled: true,
    before_open_message: null,
    after_close_message: null,
    sort_order: 1,
    updated_at: '',
  };

  it('produces an opens marker and a due marker', () => {
    const items = applicationToCalendarItems(link);
    expect(items).toHaveLength(2);
    expect(items[0].deadlineKind).toBe('opens');
    expect(items[0].title).toContain('applications open');
    expect(items[1].deadlineKind).toBe('due');
    expect(items[1].source).toBe('application');
    // Never surfaces the (masked) target URL — always routes internally.
    expect(items.every((i) => i.detailPath === '/get-involved')).toBe(true);
  });

  it('skips disabled windows', () => {
    expect(applicationToCalendarItems({ ...link, is_enabled: false })).toHaveLength(0);
    expect(applicationToCalendarItems({ ...link, status: 'disabled' })).toHaveLength(0);
  });
});

describe('buildGoogleCalendarUrl', () => {
  it('builds a timed event URL with LA timezone', () => {
    const url = buildGoogleCalendarUrl(vsaEventToCalendarItem(baseEvent));
    expect(url).toContain('calendar.google.com/calendar/render');
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('20261002T190000%2F20261002T210000');
    expect(url).toContain('ctz=America%2FLos_Angeles');
    expect(url).toContain('location=PC+Ballroom');
  });

  it('builds an all-day URL with an exclusive end date', () => {
    expect(buildGcalAllDayDatesFromDateOnly('2026-07-10')).toBe('20260710/20260711');
    expect(buildGcalAllDayDatesFromDateOnly('2026-07-10', '2026-07-12')).toBe(
      '20260710/20260713'
    );
  });

  it('uses all-day dates when the item has no times', () => {
    const url = buildGoogleCalendarUrl(makeItem({ date: '2026-07-10' }));
    expect(url).toContain('20260710%2F20260711');
    expect(url).not.toContain('ctz=');
  });
});

describe('getMonthGrid', () => {
  it('covers the whole month with Sunday-start rows', () => {
    // July 2026 starts on a Wednesday and has 31 days → 5 rows.
    const grid = getMonthGrid(2026, 6, '2026-07-02');
    expect(grid).toHaveLength(35);
    expect(grid[0].dateStr).toBe('2026-06-28');
    expect(grid[3].dateStr).toBe('2026-07-01');
    expect(grid[3].inMonth).toBe(true);
    expect(grid[0].inMonth).toBe(false);
    expect(grid.find((c) => c.dateStr === '2026-07-02')?.isToday).toBe(true);
    expect(grid[grid.length - 1].dateStr).toBe('2026-08-01');
  });
});

describe('itemOccursOn', () => {
  it('matches single-day and multi-day ranges inclusively', () => {
    const single = makeItem({ date: '2026-07-10' });
    expect(itemOccursOn(single, '2026-07-10')).toBe(true);
    expect(itemOccursOn(single, '2026-07-11')).toBe(false);

    const multi = makeItem({ date: '2026-07-10', endDate: '2026-07-12' });
    expect(itemOccursOn(multi, '2026-07-10')).toBe(true);
    expect(itemOccursOn(multi, '2026-07-12')).toBe(true);
    expect(itemOccursOn(multi, '2026-07-13')).toBe(false);
  });
});

describe('filters and scopes', () => {
  const vsa = makeItem({ source: 'vsa', category: 'gbm', points: 10 });
  const vcn = makeItem({ source: 'vsa', category: 'vcn' });
  const house = makeItem({
    source: 'house',
    category: 'house',
    houses: [{ name: 'Toad', color: '#ef4444', pagePath: '/house/toad' }],
  });
  const app = makeItem({ source: 'application', category: 'application' });

  it('matches category filters against real sources', () => {
    expect(matchesCategoryFilter(vsa, 'all')).toBe(true);
    expect(matchesCategoryFilter(vsa, 'vsa')).toBe(true);
    expect(matchesCategoryFilter(house, 'vsa')).toBe(false);
    expect(matchesCategoryFilter(house, 'house')).toBe(true);
    expect(matchesCategoryFilter(house, 'house', 'Toad')).toBe(true);
    expect(matchesCategoryFilter(house, 'house', 'Bowser')).toBe(false);
    expect(matchesCategoryFilter(vcn, 'vcn')).toBe(true);
    expect(matchesCategoryFilter(app, 'applications')).toBe(true);
  });

  it('flags points-eligible items', () => {
    expect(isPointsEligible(vsa)).toBe(true);
    expect(isPointsEligible(house)).toBe(false);
  });

  it('applies week and month scopes relative to today', () => {
    const today = '2026-07-02';
    const thisWeek = makeItem({ date: '2026-07-05' });
    const nextMonth = makeItem({ date: '2026-08-05' });
    const past = makeItem({ date: '2026-06-20' });

    expect(matchesScope(thisWeek, 'week', today)).toBe(true);
    expect(matchesScope(nextMonth, 'week', today)).toBe(false);
    expect(matchesScope(thisWeek, 'month', today)).toBe(true);
    expect(matchesScope(nextMonth, 'month', today)).toBe(false);
    expect(matchesScope(past, 'upcoming', today)).toBe(false);

    // Multi-day item still in progress counts as upcoming.
    const inProgress = makeItem({ date: '2026-06-30', endDate: '2026-07-03' });
    expect(matchesScope(inProgress, 'upcoming', today)).toBe(true);
  });
});

describe('sorting and grouping', () => {
  it('sorts by date, all-day first, then start time', () => {
    const items = [
      makeItem({ key: 'b', date: '2026-07-10', startTime: '19:00:00' }),
      makeItem({ key: 'c', date: '2026-07-11' }),
      makeItem({ key: 'a', date: '2026-07-10' }),
    ];
    const sorted = [...items].sort(compareCalendarItems);
    expect(sorted.map((i) => i.key)).toEqual(['a', 'b', 'c']);
  });

  it('groups items by start date', () => {
    const groups = groupItemsByDate([
      makeItem({ key: 'a', date: '2026-07-10' }),
      makeItem({ key: 'b', date: '2026-07-11' }),
      makeItem({ key: 'c', date: '2026-07-10', startTime: '18:00:00' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].dateStr).toBe('2026-07-10');
    expect(groups[0].items).toHaveLength(2);
  });

  it('labels today and tomorrow', () => {
    expect(formatDayGroupLabel('2026-07-02', '2026-07-02')).toMatch(/^Today · /);
    expect(formatDayGroupLabel('2026-07-03', '2026-07-02')).toMatch(/^Tomorrow · /);
    expect(formatDayGroupLabel('2026-07-04', '2026-07-02')).toBe('Sat, Jul 4');
  });
});
