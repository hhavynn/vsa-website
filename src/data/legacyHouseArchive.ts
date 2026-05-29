export type LegacyHouseArchiveStatus = 'verified' | 'unconfirmed' | 'current';

export interface LegacyHouseArchiveYear {
  academicYear: string;
  startYear: number;
  title: string;
  theme: string;
  houses: string[];
  note: string;
  status: LegacyHouseArchiveStatus;
  detail: string;
  caution?: string;
  currentHouseLinks?: Record<string, string>;
}

export const LEGACY_HOUSE_ARCHIVE: LegacyHouseArchiveYear[] = [
  {
    academicYear: '2018-2019',
    startYear: 2018,
    title: 'Superhero Era',
    theme: 'Superheroes / comic characters',
    houses: ['Flash', 'Iron', 'Loki', 'Light'],
    note: 'The earliest House system we could verify in the archives.',
    status: 'verified',
    detail: 'Some Houses were styled like crews or families, which makes this era feel like the first recovered chapter of VSA House lore.',
    currentHouseLinks: {
      Flash: '/house/year/2018-2019/flash',
      Iron: '/house/year/2018-2019/iron',
      Loki: '/house/year/2018-2019/loki',
      Light: '/house/year/2018-2019/light',
    },
  },
  {
    academicYear: '2019-2020',
    startYear: 2019,
    title: 'Streetwear Era',
    theme: 'Designers / streetwear',
    houses: ['Gucci', 'Comme des Garçons', 'Supreme', 'Yves Saint Laurent'],
    note: 'This year had a full House Spirit Week, with Gucci taking the top spot.',
    status: 'verified',
    detail: 'Gucci won House Spirit Week 2020 with 414 points, giving this era one of the clearest recovered competition moments.',
    currentHouseLinks: {
      Gucci: '/house/year/2019-2020/gucci',
      'Comme des Garçons': '/house/year/2019-2020/cdg',
      Supreme: '/house/year/2019-2020/supreme',
      'Yves Saint Laurent': '/house/year/2019-2020/ysl',
    },
  },
  {
    academicYear: '2020-2021',
    startYear: 2020,
    title: 'Archive Gap',
    theme: 'Not confirmed',
    houses: [],
    note: 'No confirmed House archive was found for this year.',
    status: 'unconfirmed',
    detail: 'This year likely needs alumni help. Remote learning may explain the gap, but the archive is keeping it marked as unconfirmed until more records turn up.',
  },
  {
    academicYear: '2021-2022',
    startYear: 2021,
    title: 'Four Holy Beasts Era',
    theme: 'Mythical creatures',
    houses: ['Phoenix', 'Unicorn', 'Dragon', 'Tortoise'],
    note: 'A mythology-inspired House year, with some records using Turtle instead of Tortoise.',
    status: 'verified',
    detail: 'This era brought the House system back with a mythical theme and a reveal tied to the Four Holy Beasts.',
    currentHouseLinks: {
      Phoenix: '/house/year/2021-2022/phoenix',
      Unicorn: '/house/year/2021-2022/unicorn',
      Dragon: '/house/year/2021-2022/dragon',
      Tortoise: '/house/year/2021-2022/tortoise',
    },
  },
  {
    academicYear: '2022-2023',
    startYear: 2022,
    title: 'Pokemon Era',
    theme: 'Pokemon starters',
    houses: ['Squirtle', 'Pikachu', 'Bulbasaur', 'Charmander'],
    note: 'A starter Pokemon-themed House year revealed in Fall 2022.',
    status: 'verified',
    detail: 'This year leaned into a familiar starter lineup, which made the House identities easy to remember and easy to root for.',
    currentHouseLinks: {
      Squirtle: '/house/year/2022-2023/squirtle',
      Pikachu: '/house/year/2022-2023/pikachu',
      Bulbasaur: '/house/year/2022-2023/bulbasaur',
      Charmander: '/house/year/2022-2023/charmander',
    },
  },
  {
    academicYear: '2023-2024',
    startYear: 2023,
    title: 'Drink Era',
    theme: 'Asian beverages / treats',
    houses: ['Ca Phe Sua Da', 'Banana Milk', 'Matcha', 'Yakult'],
    note: "The beverage-themed year. Matcha members even had the 'Matcha munchkins' nickname.",
    status: 'verified',
    detail: 'Some old planning files reused earlier templates, so this archive follows the year confirmed by active records.',
    caution: 'Designer Houses belong to 2019-2020, not this year.',
    currentHouseLinks: {
      'Ca Phe Sua Da': '/house/year/2023-2024/ca-phe-sua-da',
      'Banana Milk': '/house/year/2023-2024/banana-milk',
      Matcha: '/house/year/2023-2024/matcha',
      Yakult: '/house/year/2023-2024/yakult',
    },
  },
  {
    academicYear: '2024-2025',
    startYear: 2024,
    title: 'Sanrio Era',
    theme: 'Sanrio',
    houses: ['Badtz-maru', 'Keroppi', 'Kuromi'],
    note: 'A rare three-House year instead of the usual four.',
    status: 'verified',
    detail: 'This year stands out because it used exactly three Houses, making it one of the stranger shapes in the archive.',
    currentHouseLinks: {
      'Badtz-maru': '/house/year/2024-2025/badtz-maru',
      Keroppi: '/house/year/2024-2025/keroppi',
      Kuromi: '/house/year/2024-2025/kuromi',
    },
  },
  {
    academicYear: '2025-2026',
    startYear: 2025,
    title: 'Super Mario Era',
    theme: 'Super Mario',
    houses: ['Bowser', 'Donkey Kong', 'Boo', 'Toad'],
    note: 'The current House cycle. The Mario names started as temporary station themes before becoming the official Houses.',
    status: 'current',
    detail: 'This is the current public House cycle, with dedicated pages, events, standings, and House Parent announcements.',
    currentHouseLinks: {
      Bowser: '/house/bowser',
      'Donkey Kong': '/house/donkey-kong',
      Boo: '/house/boo',
      Toad: '/house/toad',
    },
  },
];

export function getLegacyHouseArchiveYears() {
  return [...LEGACY_HOUSE_ARCHIVE].sort((a, b) => b.startYear - a.startYear);
}

export function getLegacyHouseArchiveByYear(academicYear: string) {
  return LEGACY_HOUSE_ARCHIVE.find((entry) => entry.academicYear === academicYear) ?? null;
}

export function getVerifiedLegacyHouseYears() {
  return LEGACY_HOUSE_ARCHIVE.filter((entry) => entry.status !== 'unconfirmed');
}
