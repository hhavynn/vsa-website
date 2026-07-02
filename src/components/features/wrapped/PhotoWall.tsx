import { Link } from 'react-router-dom';
import { GalleryAlbum } from '../../../data/repos/gallery';
import { getSupabaseImageUrl } from '../../../lib/supabaseImages';
import { formatDateOnly } from '../../../lib/dateOnly';

const ROTATIONS = [
  'scrapbook-rotate-sm-left',
  'scrapbook-rotate-sm-right',
  '',
  'scrapbook-rotate-md-right',
  'scrapbook-rotate-md-left',
  '',
];

const TAPES = ['scrapbook-tape-teal', 'scrapbook-tape-coral', 'scrapbook-tape-gold'];

interface Props {
  albums: GalleryAlbum[];
}

/** Collage of approved public gallery album covers, polaroid-style. */
export function PhotoWall({ albums }: Props) {
  const withCovers = albums.filter((album) => album.cover_thumbnail_url || album.cover_image_url);

  if (withCovers.length === 0) {
    return (
      <div className="scrapbook-empty py-8 text-center">
        <p className="font-sans text-[14px]" style={{ color: 'var(--text2)' }}>
          The photo wall lives in the gallery — album drops from every quarter.
        </p>
        <Link
          to="/gallery"
          className="mt-3 inline-flex font-mono text-[11px] uppercase tracking-wider"
          style={{ color: 'var(--brand)' }}
        >
          Open the gallery →
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="columns-2 gap-4 sm:columns-3 [&>*]:mb-4">
        {withCovers.slice(0, 9).map((album, index) => {
          const src = album.cover_thumbnail_url || album.cover_image_url!;
          return (
            <Link
              key={album.id}
              to="/gallery"
              className={`scrapbook-photo scrapbook-hover-tilt block break-inside-avoid overflow-hidden p-2 pb-3 transition-transform ${ROTATIONS[index % ROTATIONS.length]} ${TAPES[index % TAPES.length]}`}
            >
              <img
                src={getSupabaseImageUrl(src, { width: 480 }) || src}
                alt={album.title}
                className="w-full rounded-[3px] object-cover"
                loading="lazy"
              />
              <div className="mt-2 px-1">
                <div className="truncate font-sans text-[12.5px] font-bold" style={{ color: 'var(--text)' }}>
                  {album.title}
                </div>
                <div className="font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>
                  {formatDateOnly(album.date, 'MMM yyyy')}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <Link
        to="/gallery"
        className="mt-2 inline-flex font-mono text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--brand)' }}
      >
        See every album in the gallery →
      </Link>
    </>
  );
}
