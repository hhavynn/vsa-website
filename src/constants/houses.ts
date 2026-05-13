export const HOUSE_OPTIONS = ['Bowser', 'Donkey Kong', 'Boo', 'Toad'] as const;

export type HouseName = typeof HOUSE_OPTIONS[number];

export const HOUSE_LABELS: Record<HouseName, string> = {
  Bowser: 'House Bowser',
  'Donkey Kong': 'House Donkey Kong',
  Boo: 'House Boo',
  Toad: 'House Toad',
};

export const HOUSE_COLORS: Record<HouseName, string> = {
  Bowser: '#f97316',
  'Donkey Kong': '#eab308',
  Boo: '#94a3b8',
  Toad: '#ef4444',
};

export function normalizeHouse(value: string | null | undefined): HouseName | null {
  const normalized = (value ?? '')
    .toLowerCase()
    .replace(/^house\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized === 'bowser') return 'Bowser';
  if (normalized === 'donkey kong' || normalized === 'dk') return 'Donkey Kong';
  if (normalized === 'boo') return 'Boo';
  if (normalized === 'toad') return 'Toad';
  return null;
}

export function isHouseName(value: string | null | undefined): value is HouseName {
  return normalizeHouse(value) === value;
}
