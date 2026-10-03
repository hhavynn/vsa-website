import { buildImageAttrs, getLoadingAttrs } from './imageDelivery';

const STORAGE = 'https://abc.supabase.co/storage/v1/object/public/event_images/a.webp';
const THUMB = 'https://abc.supabase.co/storage/v1/object/public/event_images/a_thumb.webp';

describe('buildImageAttrs', () => {
  afterEach(() => {
    delete process.env.REACT_APP_SUPABASE_IMAGE_TRANSFORMS;
  });

  it('returns the bare src when there is nothing smaller to offer', () => {
    expect(buildImageAttrs({ src: '/images/events/a.webp', width: 520, height: 330 })).toEqual({
      src: '/images/events/a.webp',
    });
  });

  it('offers the thumbnail and the full file as a width-described srcset', () => {
    const attrs = buildImageAttrs({
      src: '/images/events/a.webp',
      srcWidth: 1200,
      lowRes: { src: '/images/events/a_thumb.webp', width: 720 },
      width: 520,
      height: 330,
    });
    expect(attrs.src).toBe('/images/events/a.webp');
    expect(attrs.srcSet).toBe('/images/events/a_thumb.webp 720w, /images/events/a.webp 1200w');
  });

  it('skips the srcset when the variants are not actually different', () => {
    const same = { src: '/a.webp', width: 720 };
    expect(buildImageAttrs({ src: '/a.webp', srcWidth: 1200, lowRes: same, width: 1, height: 1 }).srcSet).toBeUndefined();
    expect(
      buildImageAttrs({ src: '/a.webp', srcWidth: 600, lowRes: { src: '/b.webp', width: 720 }, width: 1, height: 1 }).srcSet,
    ).toBeUndefined();
    expect(buildImageAttrs({ src: '/a.webp', lowRes: { src: '/b.webp', width: 300 }, width: 1, height: 1 }).srcSet).toBeUndefined();
  });

  it('never emits a srcset for URLs a candidate list cannot represent', () => {
    expect(
      buildImageAttrs({ src: '/a,b.webp', srcWidth: 1200, lowRes: { src: '/t.webp', width: 600 }, width: 1, height: 1 }).srcSet,
    ).toBeUndefined();
    expect(
      buildImageAttrs({ src: '/a.webp', srcWidth: 1200, lowRes: { src: '/t t.webp', width: 600 }, width: 1, height: 1 }).srcSet,
    ).toBeUndefined();
  });

  it('works for Storage URLs that have not been migrated yet', () => {
    const attrs = buildImageAttrs({ src: STORAGE, srcWidth: 1200, lowRes: { src: THUMB, width: 720 }, width: 520, height: 330 });
    expect(attrs.srcSet).toBe(`${THUMB} 720w, ${STORAGE} 1200w`);
  });

  it('prefers Supabase transforms when they are enabled and applicable', () => {
    process.env.REACT_APP_SUPABASE_IMAGE_TRANSFORMS = 'true';
    const attrs = buildImageAttrs({
      src: STORAGE,
      srcWidth: 1200,
      lowRes: { src: THUMB, width: 720 },
      width: 520,
      height: 330,
      widths: [360, 720],
    });
    expect(attrs.src).toContain('/storage/v1/render/image/public/');
    expect(attrs.src).toContain('width=520');
    expect(attrs.srcSet).toContain('width=360');
    expect(attrs.srcSet).toContain('720w');
    expect(attrs.srcSet).not.toContain('_thumb');
  });

  it('falls back to the thumbnail srcset when transforms are on but the URL is local', () => {
    process.env.REACT_APP_SUPABASE_IMAGE_TRANSFORMS = 'true';
    const attrs = buildImageAttrs({
      src: '/images/events/a.webp',
      srcWidth: 1200,
      lowRes: { src: '/images/events/a_thumb.webp', width: 720 },
      width: 520,
      height: 330,
    });
    expect(attrs.srcSet).toBe('/images/events/a_thumb.webp 720w, /images/events/a.webp 1200w');
  });
});

describe('getLoadingAttrs', () => {
  it('is lazy by default and eager with high fetch priority for LCP images', () => {
    expect(getLoadingAttrs(false)).toEqual({ loading: 'lazy' });
    expect(getLoadingAttrs(true)).toEqual({ loading: 'eager', fetchpriority: 'high' });
  });
});
