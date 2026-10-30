const publicUrl = process.env.PUBLIC_URL || '';

/**
 * The official VSA mark. `vsa-logo-official.png` (400px, ~315KB) is the
 * lossless master; pages load these WebP renditions instead (~37KB / ~10KB).
 * An admin-set `site_settings` logo still takes precedence wherever these
 * are used as the fallback.
 */
export const OFFICIAL_LOGO = {
  src: `${publicUrl}/images/vsa-logo-official.webp`,
  width: 400,
  /** For the nav mark and footer (rendered at 40–90px). */
  small: { src: `${publicUrl}/images/vsa-logo-official-192.webp`, width: 192 },
} as const;
