type SupabaseImageOptions = {
  width?: number;
  height?: number;
  quality?: number;
  resize?: 'cover' | 'contain' | 'fill';
};

const OBJECT_PUBLIC_PATH = '/storage/v1/object/public/';
const RENDER_PUBLIC_PATH = '/storage/v1/render/image/public/';
const UNSUPPORTED_RENDER_EXTENSIONS = /\.(gif|svg)$/i;

// Read per call (not at module load) so tests can toggle the flag.
function transformsEnabled() {
  return process.env.REACT_APP_SUPABASE_IMAGE_TRANSFORMS === 'true';
}

export function supabaseImageTransformsEnabled() {
  return transformsEnabled();
}

export function getSupabaseImageUrl(src: string | null | undefined, options: SupabaseImageOptions = {}) {
  if (!src) return '';
  if (!transformsEnabled()) return src;

  try {
    const url = new URL(src);
    if (UNSUPPORTED_RENDER_EXTENSIONS.test(url.pathname)) return src;

    if (url.pathname.includes(OBJECT_PUBLIC_PATH)) {
      url.pathname = url.pathname.replace(OBJECT_PUBLIC_PATH, RENDER_PUBLIC_PATH);
    } else if (!url.pathname.includes(RENDER_PUBLIC_PATH)) {
      return src;
    }

    if (options.width) url.searchParams.set('width', String(options.width));
    if (options.height) url.searchParams.set('height', String(options.height));
    if (options.resize) url.searchParams.set('resize', options.resize);
    if (options.quality) url.searchParams.set('quality', String(options.quality));

    return url.toString();
  } catch {
    return src;
  }
}

export function getSupabaseImageSrcSet(
  src: string | null | undefined,
  widths: number[],
  options: Omit<SupabaseImageOptions, 'width'> = {},
) {
  if (!src) return undefined;
  if (!transformsEnabled()) return undefined;

  return widths
    .map((width) => `${getSupabaseImageUrl(src, { ...options, width })} ${width}w`)
    .join(', ');
}
