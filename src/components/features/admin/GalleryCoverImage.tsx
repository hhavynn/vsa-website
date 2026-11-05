import { OptimizedImage } from '../../common/OptimizedImage';

interface GalleryCoverImageProps {
  thumbnailUrl: string | null;
  imageUrl: string | null;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  sizes?: string;
}

/** Admin album covers use the same delivery behavior as public photos.
 * A broken or absent photo leaves a neutral placeholder, never a broken icon.
 */
export function GalleryCoverImage({
  thumbnailUrl,
  imageUrl,
  alt,
  className,
  width = 420,
  height = 144,
  sizes = '(min-width: 1024px) 30vw, (min-width: 768px) 48vw, 100vw',
}: GalleryCoverImageProps) {
  const source = thumbnailUrl || imageUrl;
  return (
    <OptimizedImage
      src={source}
      alt={alt}
      width={width}
      height={height}
      widths={[320, 640, 840]}
      sizes={sizes}
      resize="cover"
      quality={75}
      className={className ?? 'h-full w-full object-cover'}
      fallback={
        <div className="flex h-full w-full items-center justify-center bg-surface2" aria-label="Cover image unavailable">
          <svg className="h-10 w-10 text-text-secondary" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      }
    />
  );
}
