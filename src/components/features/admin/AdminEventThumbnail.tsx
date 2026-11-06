import { OptimizedImage } from '../../common/OptimizedImage';

interface AdminEventThumbnailProps {
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  name: string;
}

/**
 * Compact event preview used only by the admin event list. Use the already
 * generated thumbnail first, keeping large uploaded originals off the list.
 */
export function AdminEventThumbnail({ thumbnailUrl, imageUrl, name }: AdminEventThumbnailProps) {
  const src = thumbnailUrl || imageUrl;
  if (!src) return null;

  return (
    <OptimizedImage
      src={src}
      alt={name}
      width={160}
      height={160}
      widths={[80, 160, 320]}
      sizes="(min-width: 640px) 64px, 100vw"
      resize="cover"
      quality={75}
      className="h-40 w-full shrink-0 rounded border border-[var(--color-border)] object-cover sm:h-16 sm:w-16"
      fallback={
        <div role="img" aria-label={`Image unavailable for ${name}`} className="flex h-40 w-full shrink-0 items-center justify-center rounded border border-[var(--color-border)] bg-surface2 text-text-secondary sm:h-16 sm:w-16">
          <span className="font-sans text-xs" aria-hidden="true">No image</span>
        </div>
      }
    />
  );
}
