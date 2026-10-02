import { UVSASchool } from "../types";

export const UVSA_SCHOOL_ASSETS_BUCKET = "uvsa_school_assets";

const PUBLIC_OBJECT_PREFIX = `/storage/v1/object/public/${UVSA_SCHOOL_ASSETS_BUCKET}/`;
const RENDER_PREFIX = `/storage/v1/render/image/public/${UVSA_SCHOOL_ASSETS_BUCKET}/`;

function getOwnSupabaseOrigin(
  supabaseUrl = process.env.REACT_APP_SUPABASE_URL,
) {
  if (!supabaseUrl) return null;
  try {
    return new URL(supabaseUrl).origin;
  } catch {
    return null;
  }
}

/**
 * Returns a logo URL that is safe to render, or null.
 *
 * Only https is accepted. Supabase Storage URLs are accepted solely when they
 * point at this site's own project and the dedicated school-assets bucket;
 * storage URLs from any other project or bucket stay rejected.
 */
export function getSafeLogoUrl(
  url?: string | null,
  supabaseUrl?: string,
): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return null;

    const isSupabaseStorage =
      parsed.hostname.includes("supabase.co") &&
      parsed.pathname.includes("/storage/");

    if (!isSupabaseStorage) return trimmed;

    const ownOrigin = getOwnSupabaseOrigin(supabaseUrl);
    const isOwnSchoolAsset =
      ownOrigin !== null &&
      parsed.origin === ownOrigin &&
      (parsed.pathname.startsWith(PUBLIC_OBJECT_PREFIX) ||
        parsed.pathname.startsWith(RENDER_PREFIX));

    return isOwnSchoolAsset ? trimmed : null;
  } catch {
    return null;
  }
}

/** `slug/logo-<id>.<ext>` — namespaced per school so the bucket stays browsable. */
export function buildSchoolLogoPath(
  slug: string,
  uploadId: string,
  extension: string,
) {
  const safeSlug = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!safeSlug)
    throw new Error("A school slug is required before uploading a logo.");
  return `${safeSlug}/logo-${uploadId}.${extension}`;
}

export const SCHOOL_LOGO_ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export function isAcceptedSchoolLogoType(file: Pick<File, "type">) {
  return (SCHOOL_LOGO_ACCEPTED_TYPES as readonly string[]).includes(file.type);
}

export function getSchoolInitials(label: string) {
  return (
    label
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 6)
      .toUpperCase() || "VSA"
  );
}

/**
 * Token-based fallback palettes, picked deterministically per school. These are
 * literal class strings (not computed hues) so Tailwind sees them and the
 * generated marks follow the site's brand/accent colors in both themes.
 */
const FALLBACK_PALETTES = [
  "bg-brand-600 text-white dark:bg-brand-400 dark:text-[#050810]",
  "bg-coral-500 text-white dark:bg-coral-400 dark:text-[#050810]",
  "bg-gold-500 text-white dark:bg-gold-400 dark:text-[#050810]",
  "bg-brand-800 text-white dark:bg-brand-300 dark:text-[#050810]",
  "bg-coral-600 text-white dark:bg-coral-500 dark:text-[#050810]",
  "bg-gold-600 text-white dark:bg-gold-500 dark:text-[#050810]",
] as const;

export function getFallbackPaletteClass(
  school?: Pick<UVSASchool, "slug" | "short_name">,
) {
  const key = school?.slug || school?.short_name || "vsa";
  const hash =
    key
      .split("")
      .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0) >>>
    0;
  return FALLBACK_PALETTES[hash % FALLBACK_PALETTES.length];
}
