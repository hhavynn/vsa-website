import { OptimizedImage } from '../../common/OptimizedImage';
import type { GalleryAlbum } from '../../../data/repos/gallery';

// A fanned contact sheet: each slot's offset and tilt, left to right.
const slots = [
  'left-0 top-[14%] -rotate-[6deg]',
  'left-[24%] top-[2%] -rotate-[2deg] z-10',
  'left-[48%] top-[16%] rotate-[3deg] z-20',
  'left-[70%] top-[4%] rotate-[7deg] z-30',
];

/**
 * The Gallery hero's photography: the newest album covers the page already
 * loaded, fanned like prints on a contact sheet. Decorative — the album cards
 * below are the links — so it is hidden from assistive tech, desktop only,
 * and absolutely positioned inside the hero's text container (the hero's
 * direct children are forced to position: relative) so it never shifts the
 * layout when it appears.
 */
function contactSheetCovers(albums: GalleryAlbum[]) {
  return albums
    .filter((album) => album.cover_thumbnail_url || album.cover_image_url)
    .slice(0, slots.length);
}

/** Whether the sheet will render, so the hero text only narrows when it does. */
export function hasContactSheetCovers(albums: GalleryAlbum[]): boolean {
  return contactSheetCovers(albums).length >= 2;
}

export function GalleryHeroContactSheet({ albums }: { albums: GalleryAlbum[] }) {
  const covers = contactSheetCovers(albums);
  if (covers.length < 2) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-0 top-1/2 hidden h-[250px] w-[min(40vw,520px)] -translate-y-1/2 lg:block"
    >
      {covers.map((album, index) => (
        <div
          key={album.id}
          className={`home-editorial-polaroid absolute w-[34%] p-1.5 pb-6 ${slots[index]}`}
        >
          <OptimizedImage
            src={album.cover_thumbnail_url || album.cover_image_url}
            alt=""
            width={240}
            height={180}
            sizes="180px"
            className="aspect-[4/3] w-full bg-figma-mist object-cover"
            fallback={<div className="aspect-[4/3] w-full bg-figma-mist" />}
          />
        </div>
      ))}
    </div>
  );
}
