/**
 * House event dashboard views (#636). What matters: an event is listed once per
 * view and found under each of its hosts; drafts never count as upcoming or
 * past; warnings are prompts (they never hide an event from its own view).
 */
import type { HouseEvent, HousePageAsset } from '../types';
import { addDaysToDateOnly, countsByHouse, eventsInView, filterByHost, houseEventIssues, thisWeek } from './houseEventDashboard';

const TODAY = '2026-11-10';
const house = (id: string, name: string, extra: Partial<HousePageAsset> = {}) =>
  ({ id, house: id, house_key: id, display_name: name, academic_year_start: 2026, academic_year_end: 2027, is_active: true, ...extra }) as HousePageAsset;
const twilight = house('hp-twilight', 'Twilight Sparkle');
const rarity = house('hp-rarity', 'Rarity');

function event(id: string, extra: Partial<HouseEvent> = {}): HouseEvent {
  return {
    id,
    house_profile_id: twilight.id,
    academic_year_start: 2026,
    academic_year_end: 2027,
    title: `Event ${id}`,
    event_date: '2026-11-20',
    start_time: '18:00:00',
    end_time: '20:00:00',
    location: 'Fictional Hall',
    rsvp_url: 'https://example.org/rsvp',
    image_url: null,
    image_thumbnail_url: null,
    is_published: true,
    google_calendar_enabled: true,
    houses: [twilight],
    ...extra,
  } as HouseEvent;
}

it('adds calendar days across month and year ends', () => {
  expect(addDaysToDateOnly('2026-11-28', 6)).toBe('2026-12-04');
  expect(addDaysToDateOnly('2026-12-30', 3)).toBe('2027-01-02');
});

it('lists a collab event once and finds it under each host', () => {
  const collab = event('collab', { houses: [twilight, rarity] });
  const events = [collab, event('solo')];
  expect(eventsInView(events, 'upcoming', TODAY).map((e) => e.id)).toEqual(['collab', 'solo']);
  expect(filterByHost(events, rarity.id).map((e) => e.id)).toEqual(['collab']);
  expect(filterByHost(events, twilight.id)).toHaveLength(2);
  expect(countsByHouse(events, [twilight, rarity])).toEqual([
    { profile: twilight, published: 2, drafts: 0 },
    { profile: rarity, published: 1, drafts: 0 },
  ]);
});

it('keeps drafts out of Upcoming and Past', () => {
  const events = [event('draft', { is_published: false }), event('old-draft', { is_published: false, event_date: '2026-10-01' }), event('past', { event_date: '2026-10-01' })];
  expect(eventsInView(events, 'drafts', TODAY).map((e) => e.id)).toEqual(['old-draft', 'draft']);
  expect(eventsInView(events, 'upcoming', TODAY)).toEqual([]);
  expect(eventsInView(events, 'past', TODAY).map((e) => e.id)).toEqual(['past']);
});

it('sorts by date then start time, untimed last within a day', () => {
  const events = [
    event('late', { start_time: '19:00:00' }),
    event('untimed', { start_time: null, end_time: null }),
    event('early', { start_time: '09:00:00' }),
    event('tomorrow', { event_date: '2026-11-11', start_time: '23:00:00' }),
  ];
  expect(eventsInView(events, 'upcoming', TODAY).map((e) => e.id)).toEqual(['tomorrow', 'early', 'late', 'untimed']);
});

it('flags what needs a look and leaves complete events alone', () => {
  expect(houseEventIssues(event('ok'), TODAY)).toEqual([]);
  const ids = (e: HouseEvent) => houseEventIssues(e, TODAY).map((issue) => issue.id);
  expect(ids(event('nohost', { houses: [] }))).toContain('no_host');
  expect(ids(event('hidden', { houses: [house('hp-x', 'Applejack', { is_active: false })] }))).toContain('host_not_public');
  expect(ids(event('year', { houses: [house('hp-old', 'Old House', { academic_year_start: 2025 })] }))).toContain('host_other_year');
  expect(ids(event('rsvp', { rsvp_url: ['javascript', 'alert(1)'].join(':') }))).toContain('rsvp_unsafe');
  expect(ids(event('img', { image_url: 'http://example.org/a.jpg' }))).toContain('image_unsupported');
  expect(ids(event('soon', { is_published: false, event_date: '2026-11-12' }))).toContain('draft_soon');
  expect(ids(event('stale', { is_published: false, event_date: '2026-11-01' }))).toContain('draft_past');
  expect(ids(event('bare', { start_time: null, end_time: null, location: null }))).toEqual(expect.arrayContaining(['no_time', 'no_location']));
  // A missing RSVP is optional: a note, not a reason to need attention.
  const noRsvp = event('norsvp', { rsvp_url: null });
  expect(houseEventIssues(noRsvp, TODAY)).toEqual([{ id: 'no_rsvp', level: 'note', message: expect.any(String) }]);
  expect(eventsInView([noRsvp], 'attention', TODAY)).toEqual([]);
});

it('does not pull finished published events into Needs attention', () => {
  const pastBare = event('past-bare', { event_date: '2026-10-01', location: null });
  expect(eventsInView([pastBare], 'attention', TODAY)).toEqual([]);
});

it('shows the next seven days, today included, drafts too', () => {
  const events = [
    event('today', { event_date: TODAY }),
    event('day7', { event_date: '2026-11-16', is_published: false }),
    event('day8', { event_date: '2026-11-17' }),
    event('yesterday', { event_date: '2026-11-09' }),
  ];
  expect(thisWeek(events, TODAY).map((e) => e.id)).toEqual(['today', 'day7']);
});
