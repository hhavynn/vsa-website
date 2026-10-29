import { readFileSync } from 'fs';
import { resolve } from 'path';

const gallery = readFileSync(resolve(__dirname, '../pages/Gallery.tsx'), 'utf8');

describe('public Gallery mobile album readability (#209)', () => {
  it('does not silently truncate photo album titles or related event names', () => {
    expect(gallery).toContain('<h2 className="min-w-0 break-words font-sans text-sm');
    expect(gallery).toContain('className="mt-2 break-words font-mono');
    expect(gallery).not.toContain('<h2 className="truncate font-sans text-sm');
    expect(gallery).not.toContain('className="mt-2 truncate font-mono');
  });

  it('only advertises the existing mobile swipe rail when multiple albums are loaded', () => {
    expect(gallery).toContain('albums.length > 1 && (');
    expect(gallery).toContain('aria-label="Swipe horizontally to browse photo albums"');
    expect(gallery).toContain('Swipe sideways to explore more memories');
    expect(gallery).toContain('sm:hidden');
    expect(gallery).toContain('className="gallery-memory-wall"');
  });

  it('retains the shared optimized image and private-safe published gallery routing', () => {
    expect(gallery).toContain('<OptimizedImage');
    expect(gallery).toContain('onClick={(event: MouseEvent<HTMLAnchorElement>) => handleAlbumClick(event, album.id)}');
    expect(gallery).toContain('<AlbumLightbox');
  });
});
