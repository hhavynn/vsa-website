// What a roster/cohort draft would look like on the public Cabinet board once
// published. Mirrors the publish mapping (name, role, board, order, member link,
// and the optional bio fields; never images, mentors, captions, or notes), so a
// preview shows exactly what Publish would write. Pure and read-only.
import type { CabinetMemberRaw } from '../hooks/useCabinet';
import type { CabinetRosterDraft } from './cabinetRoster';
import { INTERN_CATEGORY, INTERN_DEFAULT_ROLE, InternCohortDraft } from './internCohort';

export function rosterDraftsToPreviewMembers(drafts: readonly CabinetRosterDraft[], cabinetYearId: string): CabinetMemberRaw[] {
  return drafts
    .filter((draft) => !!draft.name?.trim())
    .map((draft) => ({
      id: `preview-${draft.id}`,
      name: (draft.name as string).trim(),
      role: draft.role,
      category: draft.category,
      display_order: draft.display_order,
      image_url: null,
      thumbnail_url: null,
      year: draft.year ?? null,
      college: draft.college ?? null,
      major: draft.major ?? null,
      minor: null,
      pronouns: draft.pronouns ?? null,
      favorite_snack: draft.favorite_snack ?? null,
      fun_fact: draft.fun_fact ?? null,
      cabinet_year_id: cabinetYearId,
      member_id: draft.member_id ?? null,
    }))
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
}

export function internDraftsToPreviewMembers(drafts: readonly InternCohortDraft[], cabinetYearId: string): CabinetMemberRaw[] {
  return drafts
    .filter((draft) => !!draft.name.trim())
    .map((draft) => ({
      id: `preview-${draft.id}`,
      name: draft.name.trim(),
      role: draft.role_or_track?.trim() || INTERN_DEFAULT_ROLE,
      category: INTERN_CATEGORY,
      display_order: draft.display_order,
      image_url: null,
      thumbnail_url: null,
      year: null,
      college: null,
      major: null,
      minor: null,
      pronouns: null,
      favorite_snack: null,
      fun_fact: null,
      cabinet_year_id: cabinetYearId,
      member_id: draft.member_id,
    }))
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
}
