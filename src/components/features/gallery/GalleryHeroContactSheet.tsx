import { OptimizedImage } from '../../common/OptimizedImage';
import type { GalleryAlbum } from '../../../data/repos/gallery';
import { cn } from '../../../lib/utils';
import { CameraFrame, cameraDateStamp } from './CameraFrame';

// Prints fanned behind the camera, left to right.
const prints = [
  'left-0 top-[6%] w-[38%] -rotate-[8deg]',
  'right-0 top-0 w-[34%] rotate-[7deg]',
];

function contactSheetCovers(albums: GalleryAlbum[]) {
  return albums.filter((album) => album.cover_thumbnail_url || album.cover_image_url).slice(0, 3);
}

/**
 * The phone camera's box while the albums load, so the page below doesn't drop
 * ~180px when the covers arrive. Large screens position the sheet absolutely
 * and need no placeholder.
 */
export function GalleryHeroContactSheetPlaceholder() {
  return (
    <div aria-hidden="true" className="ml-auto mt-6 max-w-[260px] rotate-[2deg] sm:max-w-[300px] lg:hidden">
      <CameraFrame size="sm">
        <div className="aspect-[3/2] w-full bg-figma-screen" />
      </CameraFrame>
    </div>
  );
}

/** Whether the camera will render, so the hero text only narrows when it does. */
export function hasContactSheetCovers(albums: GalleryAlbum[]): boolean {
  return contactSheetCovers(albums).length >= 1;
}

function cover(album: GalleryAlbum) {
  return album.cover_thumbnail_url || album.cover_image_url;
}

/**
 * The Gallery hero's photography: the newest cover on a point-and-shoot
 * screen, with the next two as prints fanned behind it. Decorative — the
 * album cards below are the links — so it is hidden from assistive tech. On
 * large screens it sits absolutely beside the hero text (the hero's direct
 * children are forced to position: relative) so it never shifts the layout;
 * on phones a smaller camera follows the intro. Covers use the album wall's
 * widths so the browser reuses the same files.
 */
export function GalleryHeroContactSheet({ albums }: { albums: GalleryAlbum[] }) {
  const covers = contactSheetCovers(albums);
  if (covers.length < 1) return null;
  const [lead, ...rest] = covers;

  const screen = (
    <OptimizedImage
      src={cover(lead)}
      alt=""
      width={520}
      height={346}
      widths={[360, 520, 720]}
      sizes="(min-width: 1024px) 360px, 80vw"
      className="aspect-[3/2] w-full object-cover"
      fallback={<div className="aspect-[3/2] w-full bg-figma-screen" />}
    />
  );
  const hud = { date: cameraDateStamp(lead.date), counter: `1 / ${albums.length}` };

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-1/2 hidden h-[300px] w-[min(40vw,520px)] -translate-y-1/2 lg:block"
      >
        {rest.map((album, index) => (
          <div key={album.id} className={cn('home-editorial-polaroid absolute p-1.5 pb-6', prints[index])}>
            <OptimizedImage
              src={cover(album)}
              alt=""
              width={360}
              height={270}
              widths={[360, 520, 720]}
              sizes="200px"
              className="aspect-[4/3] w-full bg-figma-mist object-cover"
              fallback={<div className="aspect-[4/3] w-full bg-figma-mist" />}
            />
          </div>
        ))}
        <CameraFrame size="sm" hud={hud} className="absolute bottom-0 left-1/2 w-[70%] -translate-x-1/2 rotate-[-2deg]">
          {screen}
        </CameraFrame>
      </div>
      <div aria-hidden="true" className="ml-auto mt-6 max-w-[260px] rotate-[2deg] sm:max-w-[300px] lg:hidden">
        <CameraFrame size="sm" hud={hud}>
          {screen}
        </CameraFrame>
      </div>
    </>
  );
}
