/**
 * Summer-break boundaries and copy routing (#270).
 *
 * The summer window is month/day in San Diego time: it starts at 00:00 on
 * June 15 and ends at 00:00 on September 15, every year. Machine-timezone
 * independence is checked by running this file under several TZ values in
 * separate processes (`npm run test:timezones`, also run in CI).
 */

import fs from 'fs';
import path from 'path';
import {
  getCurrentVsaSeason,
  getSummerBreakMessage,
  isSummerBreak,
  shouldUseSummerEmptyState,
  SummerBreakMessageContext,
} from './seasonalState';
import { losAngelesDateTimeToIso } from './losAngelesDate';

const la = (date: string, time = '00:00') => new Date(losAngelesDateTimeToIso(date, time));
const justBefore = (instant: Date) => new Date(instant.getTime() - 1000);

describe(`summer break turns on and off at San Diego midnight (TZ=${process.env.TZ ?? 'unset'})`, () => {
  it.each([
    ['Jun 14 (all day)', la('2026-06-14', '12:00'), false],
    ['Jun 14 23:59:59', justBefore(la('2026-06-15')), false],
    ['Jun 15 00:00', la('2026-06-15'), true],
    ['Jun 16', la('2026-06-16', '12:00'), true],
    ['Sep 14', la('2026-09-14', '12:00'), true],
    ['Sep 14 23:59:59', justBefore(la('2026-09-15')), true],
    ['Sep 15 00:00', la('2026-09-15'), false],
    ['Sep 16', la('2026-09-16', '12:00'), false],
  ])('%s → summer=%s', (_label, instant, summer) => {
    expect(isSummerBreak(instant as Date)).toBe(summer);
    expect(getCurrentVsaSeason(instant as Date)).toBe(summer ? 'summer_break' : 'active_year');
  });

  it('uses San Diego\'s date, not UTC\'s, at the edges', () => {
    // 5:00 PM PDT on Jun 14 is already Jun 15 in UTC; still active year in San Diego.
    expect(isSummerBreak(new Date('2026-06-15T00:00:00.000Z'))).toBe(false);
    // 6:00 PM PDT on Sep 14 is Sep 15 in UTC; still summer in San Diego.
    expect(isSummerBreak(new Date('2026-09-15T01:00:00.000Z'))).toBe(true);
  });

  it('behaves identically every year (month/day window)', () => {
    for (const year of [2027, 2028, 2030]) {
      expect(isSummerBreak(justBefore(la(`${year}-06-15`)))).toBe(false);
      expect(isSummerBreak(la(`${year}-06-15`))).toBe(true);
      expect(isSummerBreak(la(`${year}-09-15`))).toBe(false);
    }
  });
});

describe('the summer empty state never hides real content', () => {
  const july = la('2026-07-10', '12:00');
  const october = la('2026-10-10', '12:00');

  it('an active item suppresses the summer empty state, even mid-summer', () => {
    expect(shouldUseSummerEmptyState(true, july)).toBe(false);
  });

  it('with nothing active, summer shows the summer empty state', () => {
    expect(shouldUseSummerEmptyState(false, july)).toBe(true);
  });

  it('outside summer, nothing active falls through to the normal empty state', () => {
    expect(shouldUseSummerEmptyState(false, october)).toBe(false);
    expect(shouldUseSummerEmptyState(true, october)).toBe(false);
  });
});

describe('each summer message context is used by its page', () => {
  const SRC = path.resolve(__dirname, '..');
  const read = (file: string) => fs.readFileSync(path.join(SRC, file), 'utf8');
  const uses = (file: string, context: SummerBreakMessageContext) =>
    new RegExp(`getSummerBreakMessage\\(\\s*['"]${context}['"]\\s*\\)`).test(read(file));

  it.each<[SummerBreakMessageContext, string]>([
    ['homepage', 'components/features/home/ThisWeekInVSA.tsx'],
    ['houseStandings', 'components/features/home/ThisWeekInVSA.tsx'],
    ['events', 'pages/Events.tsx'],
    ['events', 'pages/Calendar.tsx'],
    ['house', 'pages/House.tsx'],
    ['externals', 'pages/UVSANetwork.tsx'],
    ['gallery', 'pages/Gallery.tsx'],
    ['points', 'pages/Leaderboard.tsx'],
  ])('%s copy is rendered by %s', (context, file) => {
    expect(uses(file, context)).toBe(true);
  });

  it('every context has its own copy, apart from the House pair and the default', () => {
    const contexts: SummerBreakMessageContext[] = ['homepage', 'events', 'house', 'externals', 'gallery', 'points', 'default'];
    const titles = contexts.map((context) => getSummerBreakMessage(context).title);
    expect(new Set(titles).size).toBe(contexts.length);
    expect(getSummerBreakMessage('houseStandings')).toEqual(getSummerBreakMessage('house'));
    for (const context of contexts) {
      const message = getSummerBreakMessage(context);
      expect(message.badge && message.title && message.body).toBeTruthy();
    }
  });
});
