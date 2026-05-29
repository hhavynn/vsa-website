export const VSA_TIME_ZONE = 'America/Los_Angeles';

const SUMMER_BREAK_START = { month: 6, day: 15 };
const SUMMER_BREAK_END = { month: 9, day: 15 };

export type VsaSeason = 'active_year' | 'summer_break';

export type SummerBreakMessageContext =
  | 'homepage'
  | 'events'
  | 'house'
  | 'houseStandings'
  | 'externals'
  | 'gallery'
  | 'points'
  | 'default';

export interface SummerBreakMessage {
  badge: string;
  title: string;
  body: string;
}

function getLosAngelesMonthDay(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: VSA_TIME_ZONE,
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);

  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  return { month, day };
}

function compareMonthDay(
  value: { month: number; day: number },
  target: { month: number; day: number }
) {
  if (value.month !== target.month) return value.month - target.month;
  return value.day - target.day;
}

// Public seasonal empty-state helpers. These are intentionally lightweight and
// can be updated when the next academic year calendar is finalized.
export function isSummerBreak(date: Date = new Date()): boolean {
  const losAngelesDate = getLosAngelesMonthDay(date);
  return (
    compareMonthDay(losAngelesDate, SUMMER_BREAK_START) >= 0 &&
    compareMonthDay(losAngelesDate, SUMMER_BREAK_END) < 0
  );
}

export function getCurrentVsaSeason(date: Date = new Date()): VsaSeason {
  return isSummerBreak(date) ? 'summer_break' : 'active_year';
}

export function shouldUseSummerEmptyState(hasActiveItems: boolean, date: Date = new Date()): boolean {
  return !hasActiveItems && isSummerBreak(date);
}

export function getSummerBreakMessage(context: SummerBreakMessageContext = 'default'): SummerBreakMessage {
  switch (context) {
    case 'homepage':
      return {
        badge: 'Summer break',
        title: 'VSA is on summer break',
        body: "We'll be back in fall with new events, House updates, and ways to get involved. Check back closer to the school year.",
      };
    case 'events':
      return {
        badge: 'Summer break',
        title: 'Events will be back in fall',
        body: 'VSA at UCSD is on summer break. New GBMs, socials, and programs will show up here once the school year gets closer.',
      };
    case 'house':
    case 'houseStandings':
      return {
        badge: 'Summer break',
        title: 'Houses return in fall',
        body: 'House apps, House Reveal, and new standings will come back with the school year. Check back in fall to see where your House lands.',
      };
    case 'externals':
      return {
        badge: 'Summer break',
        title: 'Externals will return next school term',
        body: 'Upcoming externals will be added once VSA at UCSD and the host schools confirm dates for the new school year.',
      };
    case 'gallery':
      return {
        badge: 'Summer break',
        title: 'Summer is a good time to look back',
        body: 'Photos and recaps will appear here after events are added.',
      };
    case 'points':
      return {
        badge: 'Summer note',
        title: 'Points lookup stays available',
        body: 'New points usually resume once fall events start.',
      };
    default:
      return {
        badge: 'Summer break',
        title: 'Check back in fall',
        body: 'VSA at UCSD is on summer break. New updates will appear once the school year gets closer.',
      };
  }
}
