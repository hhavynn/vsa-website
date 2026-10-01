import { type CabinetMemberRaw } from '../../../../hooks/useCabinet';
import { isRenamed } from '../../../../lib/memberPhotos';

export const DRAFT_CABINET_MEMBER_ID = 'draft-preview';

type CabinetDraft = Partial<CabinetMemberRaw>;

/**
 * The member list /cabinet would load for `yearId` after saving `draft`:
 * the year's saved members (plus unassigned legacy rows on the current year,
 * as the public page does), with the draft replacing its saved row or added
 * as a new one, in the public sort order.
 */
export function buildCabinetPreviewMembers({
  members,
  draft,
  yearId,
  includeLegacy,
  imageUrl,
  thumbnailUrl,
}: {
  members: CabinetMemberRaw[];
  draft: CabinetDraft;
  yearId: string | null;
  includeLegacy: boolean;
  imageUrl: string | null;
  thumbnailUrl: string | null;
}): CabinetMemberRaw[] {
  const saved = draft.id ? members.find((member) => member.id === draft.id) : undefined;
  const yearMembers = members.filter(
    (member) =>
      member.id !== draft.id &&
      (member.cabinet_year_id === yearId || (includeLegacy && !member.cabinet_year_id)),
  );

  const draftMember: CabinetMemberRaw = {
    id: draft.id ?? DRAFT_CABINET_MEMBER_ID,
    name: draft.name || 'New member',
    role: draft.role || 'Role',
    category: draft.category || 'General Board',
    display_order: draft.display_order ?? 0,
    image_url: imageUrl || null,
    thumbnail_url: imageUrl ? thumbnailUrl || null : null,
    year: draft.year || null,
    college: draft.college || null,
    major: draft.major || null,
    minor: draft.minor || null,
    pronouns: draft.pronouns || null,
    favorite_snack: draft.favorite_snack || null,
    fun_fact: draft.fun_fact || null,
    cabinet_year_id: yearId,
    // Saving a rename unlinks the member photo, so the preview drops it too.
    member_id: saved && !isRenamed(saved.name, draft.name) ? saved.member_id ?? null : null,
  };

  return [...yearMembers, draftMember].sort((a, b) => {
    const byOrder = (a.display_order ?? Number.MAX_SAFE_INTEGER) - (b.display_order ?? Number.MAX_SAFE_INTEGER);
    return byOrder !== 0 ? byOrder : a.name.localeCompare(b.name);
  });
}
