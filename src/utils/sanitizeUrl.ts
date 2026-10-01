/**
 * URL sanitisation helpers.
 *
 * Validates a URL string against an allowlist of safe protocols and returns the
 * sanitised URL or a safe fallback.  Used to prevent `javascript:`, `vbscript:`,
 * and other dangerous protocol URLs from reaching `<a href>` or `<img src>`
 * attributes.
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Safe URL for `<a href>` — allows http(s) and site-relative paths. */
export function sanitizeHref(url: string): string {
  return sanitize(url, false) ?? '#';
}

/** Safe URL for `<img src>` — also allows `data:image/*` and `blob:` URIs. */
export function sanitizeImageSrc(url: string): string {
  return sanitize(url, true) ?? '';
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function sanitize(url: string, allowImageData: boolean): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Site-relative paths (but not protocol-relative "//evil.com")
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  // data:image/* URIs from FileReader.readAsDataURL (img src only)
  if (allowImageData && /^data:image\//i.test(trimmed)) {
    return trimmed;
  }

  // blob: URIs from URL.createObjectURL (img src only)
  if (allowImageData && /^blob:/i.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}
