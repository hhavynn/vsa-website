import type { AceAssignmentDraft } from '../types';
import type { DraftSeed } from './aceAssignments';
import { normalizeMemberName } from './memberLinkMatching';

type ExistingLittle = Pick<AceAssignmentDraft, 'little_name' | 'little_member_id'>;

export interface AceDraftImportPlan {
  seeds: DraftSeed[];
  skippedExisting: number;
  skippedRepeated: number;
  needsReview: number;
}

/**
 * Prevent repeated general-form imports from duplicating Littles added by
 * mutual requests (or an earlier paste). This is a client-side safety net;
 * the existing server-side publish preflight remains authoritative.
 *
 * Exact canonical member links win. A name collision with two *different*
 * linked members, or ambiguous identities within one paste, is held for
 * manual review rather than silently merging two people.
 */
export function planAceDraftImport(
  incoming: readonly DraftSeed[],
  existing: readonly ExistingLittle[],
): AceDraftImportPlan {
  const existingIds = new Set(existing.flatMap((row) => (row.little_member_id ? [row.little_member_id] : [])));
  const existingByName = new Map<string, ExistingLittle[]>();
  for (const row of existing) {
    const name = normalizeMemberName(row.little_name);
    existingByName.set(name, [...(existingByName.get(name) ?? []), row]);
  }

  const byName = new Map<string, DraftSeed[]>();
  const namesById = new Map<string, Set<string>>();
  for (const seed of incoming) {
    const name = normalizeMemberName(seed.little_name);
    byName.set(name, [...(byName.get(name) ?? []), seed]);
    if (seed.little_member_id) {
      const names = namesById.get(seed.little_member_id) ?? new Set<string>();
      names.add(name);
      namesById.set(seed.little_member_id, names);
    }
  }

  const result: AceDraftImportPlan = { seeds: [], skippedExisting: 0, skippedRepeated: 0, needsReview: 0 };
  const seen = new Set<string>();
  for (const seed of incoming) {
    const name = normalizeMemberName(seed.little_name);
    const existingWithName = existingByName.get(name) ?? [];
    if (!name || (
      seed.little_member_id &&
      existingWithName.some((row) => row.little_member_id && row.little_member_id !== seed.little_member_id)
    )) {
      result.needsReview += 1;
      continue;
    }

    if ((seed.little_member_id && existingIds.has(seed.little_member_id)) || existingWithName.length > 0) {
      result.skippedExisting += 1;
      continue;
    }

    const sameName = byName.get(name) ?? [];
    const sameMemberDifferentNames = !!seed.little_member_id && (namesById.get(seed.little_member_id)?.size ?? 0) > 1;
    const unambiguousRepeat = sameName.length > 1 &&
      !!seed.little_member_id &&
      sameName.every((row) => row.little_member_id === seed.little_member_id);
    if (sameMemberDifferentNames || (sameName.length > 1 && !unambiguousRepeat)) {
      result.needsReview += 1;
      continue;
    }
    if (seen.has(name)) {
      result.skippedRepeated += 1;
      continue;
    }
    seen.add(name);
    result.seeds.push(seed);
  }
  return result;
}
