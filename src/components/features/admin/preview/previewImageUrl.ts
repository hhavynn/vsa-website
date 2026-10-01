const SAME_SITE_PATH = /^\/(?!\/)/;
const LOCAL_IMAGE_DATA = /^data:image\/(?:png|jpe?g|webp|gif);base64,/i;

/**
 * Makes an admin-typed (or locally read) image URL safe to put in a preview's
 * `<img src>`: escapes markup characters, then allows only http(s), same-site
 * paths, and local image data from the file picker. Anything else (e.g. a
 * `javascript:` URL) renders no image. Mirrors sanitizeUrl in
 * formatAssistantMessage.
 */
export function safePreviewImageUrl(url: string | null | undefined): string {
  if (!url) return '';

  let encoded: string;
  try {
    // Restore percent-escapes that were already valid so they aren't doubled.
    encoded = encodeURI(url.trim()).replace(/%25([0-9A-Fa-f]{2})/g, '%$1');
  } catch {
    return '';
  }

  if (SAME_SITE_PATH.test(encoded) || LOCAL_IMAGE_DATA.test(encoded)) return encoded;

  try {
    const parsed = new URL(encoded);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
  } catch {
    return '';
  }

  return '';
}
