/** Approved public avatar URLs keyed by members.id (public_member_avatars). */
export type MemberAvatarMap = ReadonlyMap<string, string>;

export const NO_MEMBER_AVATARS: MemberAvatarMap = new Map();

/**
 * A linked member's approved avatar wins over a surface's own photo (ACE
 * photo_url, Cabinet image_url/thumbnail_url); unlinked and historical people
 * keep their local photo.
 */
export function resolveMemberPhoto(
  avatars: MemberAvatarMap,
  memberId: string | null | undefined,
  fallback?: string | null,
): string | null {
  return (memberId ? avatars.get(memberId) : undefined) || fallback || null;
}

const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Admin editors clear a row's member link when its name really changes, so a
 * renamed ACE/Cabinet entry never keeps showing the previous person's photo.
 */
export function isRenamed(previousName: string | null | undefined, nextName: string | null | undefined): boolean {
  return nameKey(previousName ?? '') !== nameKey(nextName ?? '');
}
