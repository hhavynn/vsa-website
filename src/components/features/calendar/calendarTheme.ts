import { CalendarCategory, CalendarItem } from '../../../utils/calendar';

// Accent colors for calendar dots/badges. House items use the house's own
// accent color instead; applications use the scrapbook gold.
const CATEGORY_COLORS: Record<CalendarCategory, string> = {
  gbm: '#1e8878',
  mixer: '#3b82f6',
  vcn: '#a855f7',
  wildn_culture: '#e8623a',
  winter_retreat: '#0ea5e9',
  external_event: '#64748b',
  other: '#8a94a6',
  house: '#d4841a',
  application: '#d4841a',
};

export function getItemColor(item: CalendarItem): string {
  if (item.source === 'house' && item.houses.length > 0) return item.houses[0].color;
  return CATEGORY_COLORS[item.category] ?? '#8a94a6';
}

export function getDetailLinkLabel(item: CalendarItem): string {
  if (item.source === 'application') return 'Get Involved';
  if (item.source === 'house') return 'Visit house page';
  return 'See events page';
}
