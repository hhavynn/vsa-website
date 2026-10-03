/**
 * Pure description of where `scripts/migrate-supabase-images-to-public.ts` puts
 * each category of image. No I/O, no env access, no side effects on import, so
 * read-only tools (`scripts/audit-storage-backed-content.ts`) can compute the
 * file name the migration WOULD choose without running any migration code.
 *
 * Keep this byte-for-byte equivalent to the CATEGORIES table in the migrate
 * script until that script imports it (`src/__meta__/storageAuditScript.test.ts`
 * fails while the two disagree).
 */

export interface ImageField {
  name: string;
  suffix: string;
}

export interface CategoryConfig {
  table: string;
  select: string;
  imageFields: ImageField[];
  getSlug: (row: Record<string, unknown>) => string;
  outputDir: string;
  maxWidth: number;
  maxHeight: number;
  quality: number;
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function idSuffix(row: Record<string, unknown>): string {
  return String(row['id'] ?? '').slice(0, 8);
}

export const CATEGORIES: Record<string, CategoryConfig> = {
  cabinet: {
    table: 'cabinet_members',
    select: 'id, name, image_url, thumbnail_url',
    imageFields: [
      { name: 'image_url', suffix: '' },
      { name: 'thumbnail_url', suffix: '_thumb' },
    ],
    getSlug: (row) => {
      const name = row['name'] ? slugify(String(row['name'])) : '';
      return name ? `${name}_${idSuffix(row)}` : idSuffix(row);
    },
    outputDir: 'public/images/cabinet',
    maxWidth: 800,
    maxHeight: 800,
    quality: 80,
  },

  events: {
    table: 'events',
    select: 'id, name, date, image_url, thumbnail_url',
    imageFields: [
      { name: 'image_url', suffix: '' },
      { name: 'thumbnail_url', suffix: '_thumb' },
    ],
    getSlug: (row) => {
      const name = row['name'] ? slugify(String(row['name'])) : '';
      const date = row['date'] ? String(row['date']).slice(0, 10) : '';
      if (name && date) return `${name}_${date}`;
      if (name) return `${name}_${idSuffix(row)}`;
      return idSuffix(row);
    },
    outputDir: 'public/images/events',
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 80,
  },

  gallery: {
    table: 'gallery_events',
    select: 'id, title, date, cover_image_url, cover_thumbnail_url',
    imageFields: [
      { name: 'cover_image_url', suffix: '' },
      { name: 'cover_thumbnail_url', suffix: '_thumb' },
    ],
    getSlug: (row) => {
      const title = row['title'] ? slugify(String(row['title'])) : '';
      const date = row['date'] ? String(row['date']).slice(0, 10) : '';
      if (title && date) return `${title}_${date}`;
      if (title) return `${title}_${idSuffix(row)}`;
      return idSuffix(row);
    },
    outputDir: 'public/images/gallery',
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 80,
  },

  houses: {
    table: 'house_page_assets',
    select: 'id, house, house_key, academic_year_start, image_url, image_thumbnail_url, cover_image_url, house_parent_image_url',
    imageFields: [
      { name: 'image_url', suffix: '' },
      { name: 'image_thumbnail_url', suffix: '_thumb' },
      { name: 'cover_image_url', suffix: '_cover' },
      { name: 'house_parent_image_url', suffix: '_parent' },
    ],
    getSlug: (row) => {
      const year = row['academic_year_start'] ? String(row['academic_year_start']) : 'unknown';
      const houseIdentifier = row['house_key'] || row['house'] || idSuffix(row);
      const house = slugify(String(houseIdentifier));
      return `${year}_${house}`;
    },
    outputDir: 'public/images/houses',
    maxWidth: 1200,
    maxHeight: 1500,
    quality: 80,
  },

  home: {
    table: 'homepage_content',
    select: 'id, presidents_photo_url, presidents_photo_thumbnail_url',
    imageFields: [
      { name: 'presidents_photo_url', suffix: '' },
      { name: 'presidents_photo_thumbnail_url', suffix: '_thumb' },
    ],
    getSlug: (row) => `presidents_${idSuffix(row)}`,
    outputDir: 'public/images/home',
    maxWidth: 800,
    maxHeight: 800,
    quality: 80,
  },

  'house-events': {
    table: 'house_events',
    select: 'id, title, slug, image_url, image_thumbnail_url',
    imageFields: [
      { name: 'image_url', suffix: '' },
      { name: 'image_thumbnail_url', suffix: '_thumb' },
    ],
    getSlug: (row) => {
      const titleSlug = row['slug'] ? String(row['slug']) : slugify(String(row['title'] ?? ''));
      const id = idSuffix(row);
      return id && titleSlug ? `${id}-${titleSlug}` : (id || titleSlug || 'unknown');
    },
    outputDir: 'public/images/house-events',
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 80,
  },
};
