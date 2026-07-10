/**
 * Normalizes a cabinet title for tolerant matching.
 *
 * Lowercases, expands "&" to "and", strips a leading/embedded "Co-"/"Co "
 * co-chair prefix, and collapses everything else to single-spaced
 * alphanumerics. This lets member titles like "Co-Events Chair" resolve to
 * the "Events Chair" role WITHOUT inventing fuzzy matches between genuinely
 * different roles (e.g. "Vice President" still does not match "Internal Vice
 * President").
 */
export function normalizeRoleTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\bco[-\s]+/g, '') // drop co-chair prefix (Co-President -> President)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Resolves a displayed cabinet member title to its role description.
 *
 * Matches on the normalized role name first, then on any normalized alias.
 * Returns null when nothing matches so callers can skip opening the modal
 * instead of leaving it open with no content.
 */
export function matchCabinetRole<
  T extends { role_name: string; aliases?: string[] | null },
>(roles: T[], title: string | null | undefined): T | null {
  if (!title) return null;
  const target = normalizeRoleTitle(title);
  if (!target) return null;

  for (const role of roles) {
    if (normalizeRoleTitle(role.role_name) === target) return role;
    for (const alias of role.aliases ?? []) {
      if (normalizeRoleTitle(alias) === target) return role;
    }
  }
  return null;
}
