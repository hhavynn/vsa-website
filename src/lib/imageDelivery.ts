import { getSupabaseImageSrcSet, getSupabaseImageUrl, supabaseImageTransformsEnabled } from './supabaseImages';

/**
 * Shared delivery rules for public images. `OptimizedImage` is the component
 * most call sites should use; this module is the pure part so other surfaces
 * (CSS backgrounds, preloads, tests) can reuse the same decisions.
 *
 * Two ways to serve a smaller image than the original, in priority order:
 *  1. Supabase image transforms, when `REACT_APP_SUPABASE_IMAGE_TRANSFORMS` is on
 *     (a paid-plan feature, so it is off by default).
 *  2. A second, smaller file for the same picture. Every uploaded image already
 *     has one (`thumbnail_url`, `cover_thumbnail_url`, ...) and the migration
 *     pipeline carries it to `/images/..._thumb.webp`. Offering both in a
 *     `srcset` lets the browser skip the large file on small slots.
 */

export interface ImageVariant {
  src: string;
  /** Intrinsic pixel width of this file. */
  width: number;
}

export interface ImageDeliveryInput {
  src: string;
  /** Intrinsic pixel width of `src`. Required for `lowRes` to produce a `srcset`. */
  srcWidth?: number;
  /** A smaller file of the same picture, e.g. the row's thumbnail. */
  lowRes?: ImageVariant | null;
  /** Rendered width/height at 1x; used for transforms. */
  width: number;
  height: number;
  /** Candidate widths for Supabase transforms. Defaults to 1x and 2x of `width`. */
  widths?: number[];
  resize?: 'cover' | 'contain' | 'fill';
  quality?: number;
}

export interface ImageDeliveryAttrs {
  src: string;
  srcSet?: string;
}

// A comma or whitespace in a URL would corrupt a srcset candidate list.
const SRCSET_UNSAFE = /[\s,]/;

function isSrcSetSafe(url: string) {
  return !SRCSET_UNSAFE.test(url);
}

export function buildImageAttrs(input: ImageDeliveryInput): ImageDeliveryAttrs {
  const { src, srcWidth, lowRes, width, height, resize = 'cover', quality = 72 } = input;

  if (supabaseImageTransformsEnabled()) {
    const widths = input.widths ?? [width, width * 2];
    const transformed = getSupabaseImageUrl(src, { width, height, resize, quality });
    // Transforms only apply to Supabase object URLs; anything else comes back unchanged.
    if (transformed !== src) {
      return { src: transformed, srcSet: getSupabaseImageSrcSet(src, widths, { resize, quality }) };
    }
  }

  if (
    lowRes &&
    srcWidth &&
    lowRes.src &&
    lowRes.src !== src &&
    lowRes.width > 0 &&
    lowRes.width < srcWidth &&
    isSrcSetSafe(src) &&
    isSrcSetSafe(lowRes.src)
  ) {
    return { src, srcSet: `${lowRes.src} ${lowRes.width}w, ${src} ${srcWidth}w` };
  }

  return { src };
}

/** Never lazy-load, and hint the fetch, for the image that will be the LCP element. */
export function getLoadingAttrs(priority: boolean) {
  return priority
    ? { loading: 'eager' as const, fetchpriority: 'high' }
    : { loading: 'lazy' as const };
}
