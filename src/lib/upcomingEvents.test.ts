/**
 * Unified upcoming list (#634). What matters: one chronological order in Los
 * Angeles time for regular and House events, deterministic ties, a House event
 * that is over (or unpublished) dropped, a collab listed once, and each House
 * event linking to its own card on its year's House page.
 */
import type { Event, HouseEvent, HousePageAsset } from '../types';
import { losAngelesDateTimeToIso } from '../utils/losAngelesDate';
import { isHouseEventUpcomingOrOngoing, mergeUpcoming } from './upcomingEvents';

const NOW = new Date(losAngelesDateTimeToIso('2026-11-10', '12:00'));
const rarity = { id: 'hp-rarity', house: 'rarity', house_key: 'rarity', display_name: 'Rarity', academic_year_start: 2026, is_active: true } as HousePageAsset;
const applejack = { id: 'hp-applejack', house: 'applejack', house_key: 'applejack', display_name: 'Applejack', academic_year_start: 2026, is_active: true } as HousePageAsset;

const vsa = (id: string, date: string, start: string | null = '18:00:00'): Event =>
  ({ id, name: `VSA ${id}`, date, start_time: start, end_time: start ? '20:00:00' : null, end_date: null, event_type: 'gbm', is_published: true }) as Event;
const house = (id: string, date: string, start: string | null = '18:00:00', extra: Partial<HouseEvent> = {}): HouseEvent =>
  ({ id, title: `House ${id}`, event_date: date, start_time: start, end_time: start ? '20:00:00' : null, academic_year_start: 2026, is_published: true, houses: [rarity], ...extra }) as HouseEvent;

const order = (items: ReturnType<typeof mergeUpcoming>) => items.map((item) => item.key);

it('puts a House event before a later regular event', () => {
  expect(order(mergeUpcoming([vsa('gbm', '2026-11-14')], [house('social', '2026-11-12')], NOW))).toEqual(['house:social', 'vsa:gbm']);
  expect(order(mergeUpcoming([vsa('gbm', '2026-11-12', '09:00:00')], [house('social', '2026-11-12', '18:00:00')], NOW))).toEqual(['vsa:gbm', 'house:social']);
});

it('orders ties and untimed events deterministically', () => {
  const items = mergeUpcoming(
    [vsa('same', '2026-11-12', '18:00:00'), vsa('allday', '2026-11-12', null)],
    [house('same', '2026-11-12', '18:00:00'), house('allday', '2026-11-12', null), house('early', '2026-11-12', '10:00:00')],
    NOW,
  );
  expect(order(items)).toEqual(['house:early', 'vsa:same', 'house:same', 'vsa:allday', 'house:allday']);
});

it('keeps an ongoing House event, drops one that ended today, and handles overnight ones', () => {
  expect(isHouseEventUpcomingOrOngoing(house('now', '2026-11-10', '11:00:00', { end_time: '13:00:00' }), NOW)).toBe(true);
  expect(isHouseEventUpcomingOrOngoing(house('done', '2026-11-10', '09:00:00', { end_time: '11:00:00' }), NOW)).toBe(false);
  expect(isHouseEventUpcomingOrOngoing(house('allday', '2026-11-10', null), NOW)).toBe(true);
  expect(isHouseEventUpcomingOrOngoing(house('yesterday', '2026-11-09', null), NOW)).toBe(false);
  // 10 PM to 2 AM the night before: still going at 1 AM.
  const overnight = house('late', '2026-11-09', '22:00:00', { end_time: '02:00:00' });
  expect(isHouseEventUpcomingOrOngoing(overnight, new Date(losAngelesDateTimeToIso('2026-11-10', '01:00')))).toBe(true);
  expect(isHouseEventUpcomingOrOngoing(overnight, NOW)).toBe(false);
});

it('lists a collab once with both hosts, links to its own card, and drops unpublished rows', () => {
  const collab = house('collab', '2026-11-12', '18:00:00', { houses: [rarity, applejack] });
  const items = mergeUpcoming([], [collab, collab, house('draft', '2026-11-12', '18:00:00', { is_published: false })], NOW);
  expect(order(items)).toEqual(['house:collab']);
  const [item] = items;
  expect(item.kind === 'house' && item.detailPath).toBe('/house/year/2026-2027/rarity#house-event-collab');
  expect(item.kind === 'house' && item.event.houses?.map((h) => h.display_name)).toEqual(['Rarity', 'Applejack']);
});

it('falls back to the year page when no host is known', () => {
  const [item] = mergeUpcoming([], [house('nohost', '2026-11-12', '18:00:00', { houses: [] })], NOW);
  expect(item.kind === 'house' && item.detailPath).toBe('/house/year/2026-2027');
});
