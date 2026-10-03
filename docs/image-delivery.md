# Image delivery

How public images are served, and how to add one without re-inventing it. Egress background and the migration pipeline live in [storage-egress-audit.md](storage-egress-audit.md) and [event-image-migration.md](event-image-migration.md); this page is about the component and the rules.

## The component

Render every public content image with `OptimizedImage` (`src/components/common/OptimizedImage.tsx`). It is a bare `<img>`, so existing aspect-ratio and `object-fit` wrappers keep working, and it applies the same rules everywhere:

| Rule | How |
|---|---|
| Explicit dimensions (no layout shift) | `width` / `height` are always set on the element. CSS still decides the rendered size. |
| Lazy by default | `loading="lazy"`, `decoding="async"`. |
| Above-the-fold image is **not** lazy | Pass `priority`: `loading="eager"` + `fetchpriority="high"`. One image per page at most (the likely LCP element). Never mark a grid. |
| Responsive file choice | `srcSet` is built by `buildImageAttrs` (`src/lib/imageDelivery.ts`) from whatever smaller variant exists (below). `sizes` must describe the real CSS layout. |
| Graceful failure | `fallback` renders when `src` is empty or the file errors; a new `src` retries. |

```tsx
<OptimizedImage
  src={event.thumbnail_url || event.image_url}
  alt={event.name}
  width={520}
  height={330}
  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
  className="h-full w-full object-cover"
  fallback={<Placeholder />}
/>
```

### Where a smaller file comes from

1. **Supabase image transforms**, when `REACT_APP_SUPABASE_IMAGE_TRANSFORMS=true` (a paid-plan feature; off by default). `widths` lists the candidates.
2. **A second file of the same picture.** Every upload already stores a thumbnail next to the full image (`thumbnail_url`, `cover_thumbnail_url`, `image_thumbnail_url`; sizes in `PRESETS` in `src/lib/imageUpload.ts`), and the migration pipeline carries it to `/images/…_thumb.webp`. Pass it as `lowRes={{ src, width }}` with `srcWidth` for the full file to get `srcset="thumb 720w, full 1200w"`.

Most card lists render the **thumbnail only** (`thumbnail_url || image_url`). Keep it that way: offering the full file in a `srcset` makes hi-DPI phones download the larger file, which is more egress, not less. Use `lowRes` only where the full image is genuinely shown large (a detail hero, a lightbox).

### Choosing `sizes`

A wrong `sizes` makes the browser fetch the wrong file. Read the container classes: write the width the image occupies at each breakpoint (`82vw` for a mobile swipe card, `33vw` for a three-column grid, a fixed `px` for a sidebar thumb). When unsure, a fixed `${width}px` is safe.

## Admin uploads

Pick files with `ImageDropzone` (`src/components/features/admin/ImageDropzone.tsx`) rather than a hand-rolled `useDropzone`. It shows a preview, the file name and size, the preset's limit and resize behavior, and a visible reason when a file is refused (oversize or wrong type). Compression and the storage upload stay in `prepareImageForUpload` and the page's own code; pass the same `ImageUploadPreset` to both so the limit shown is the limit enforced. Client-side checks are a UX affordance, not a control: bucket policies still enforce what is accepted.

## What this does not do

- It does not delete or replace Supabase Storage originals. Derived files are additions.
- It does not change which URL a row stores. Rows move from Storage to `/images/…` only through the two-phase migration.
- Static legacy files under `public/images/` (some multi-MB PNGs in `cabinet/`) are served by Vercel, not Supabase; they cost bandwidth, not Supabase egress. See the audit doc.
