import { z } from 'zod';

/**
 * A logo URL is optional when an upload is selected; an external URL must be
 * HTTP(S). AdminFormShell disables browser validation in favor of explicit,
 * announced schema validation. Do not permit javascript:, blob: or data: URLs
 * to be saved into site settings.
 */
export const SiteLogoUrlSchema = z.string().trim().refine((value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}, 'Use a valid HTTP(S) logo URL, or upload an image file.');
