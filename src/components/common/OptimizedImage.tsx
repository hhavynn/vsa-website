import { ImgHTMLAttributes, ReactNode, useEffect, useState } from 'react';
import { buildImageAttrs, getLoadingAttrs, ImageVariant } from '../../lib/imageDelivery';

type NativeImgProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'srcSet' | 'width' | 'height' | 'loading' | 'alt' | 'sizes'
>;

export interface OptimizedImageProps extends NativeImgProps {
  /** Full-size image URL. Empty/nullish renders `fallback`. */
  src: string | null | undefined;
  /** Required. Use "" only for purely decorative images. */
  alt: string;
  /**
   * Intrinsic (or 1x display) size. Always set on the element so the browser
   * reserves the box before the file arrives (no layout shift). CSS still
   * controls the rendered size.
   */
  width: number;
  height: number;
  /**
   * The image is above the fold / likely the LCP element: loads eagerly with
   * high fetch priority. Everything else is lazy. Never mark a whole grid.
   */
  priority?: boolean;
  /** `sizes` for the srcset. Defaults to `${width}px` when a srcset is produced. */
  sizes?: string;
  /** Intrinsic pixel width of `src`. Needed for `lowRes` to take effect. */
  srcWidth?: number;
  /** Smaller file of the same picture (the row's thumbnail), as a srcset candidate. */
  lowRes?: ImageVariant | null;
  /** Candidate widths when Supabase transforms are enabled. */
  widths?: number[];
  resize?: 'cover' | 'contain' | 'fill';
  quality?: number;
  /** Rendered instead of the image when `src` is missing or the file fails to load. */
  fallback?: ReactNode;
}

/**
 * The one way to render a public content image: explicit dimensions, lazy by
 * default, eager + high priority on request, responsive `srcset` when a
 * smaller variant exists, and graceful failure. Renders a bare `<img>` so
 * existing aspect-ratio/object-fit wrappers keep working.
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  sizes,
  srcWidth,
  lowRes,
  widths,
  resize,
  quality,
  fallback = null,
  onError,
  ...rest
}: OptimizedImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  // A new URL gets a fresh chance even if the previous one failed.
  useEffect(() => {
    setFailedSrc(null);
  }, [src]);

  if (!src || failedSrc === src) return <>{fallback}</>;

  const attrs = buildImageAttrs({ src, srcWidth, lowRes, width, height, widths, resize, quality });
  const extra = getLoadingAttrs(priority) as Record<string, string>;

  return (
    <img
      {...rest}
      {...extra}
      src={attrs.src}
      srcSet={attrs.srcSet}
      sizes={attrs.srcSet ? sizes ?? `${width}px` : undefined}
      width={width}
      height={height}
      alt={alt}
      decoding="async"
      onError={(event) => {
        setFailedSrc(src);
        onError?.(event);
      }}
    />
  );
}
