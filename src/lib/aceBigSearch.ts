import type { AceNodeRef } from './aceAssignments';
import { normalizeMemberName } from './memberLinkMatching';

export interface AceBigSearchResult {
  matches: AceNodeRef[];
  total: number;
}

/**
 * Search the complete admin ACE tree without silently implying the first few
 * displayed options are the only matches. Exact names take priority, followed
 * by name prefixes, then family and other partial matches. Never choose a
 * canonical identity from the name alone: every result retains its node ID.
 */
export function searchAceBigNodes(
  nodes: readonly AceNodeRef[],
  term: string,
  limit = 8,
): AceBigSearchResult {
  const needle = normalizeMemberName(term);
  if (needle.length < 2) return { matches: [], total: 0 };
  const ranked = nodes.flatMap((node) => {
    const name = normalizeMemberName(node.name);
    const family = normalizeMemberName(node.familyName ?? '');
    const combined = [name, family].filter(Boolean).join(' ');
    if (!combined.includes(needle)) return [];
    const rank = name === needle || combined === needle ? 0
      : name.startsWith(needle) ? 1
      : name.split(' ').some((word) => word.startsWith(needle)) ? 2
      : family.startsWith(needle) ? 3
      : 4;
    return [{ node, rank }];
  });
  ranked.sort((a, b) => a.rank - b.rank
    || a.node.name.localeCompare(b.node.name)
    || (a.node.familyName ?? '').localeCompare(b.node.familyName ?? '')
    || a.node.id.localeCompare(b.node.id));
  return { matches: ranked.slice(0, Math.max(0, limit)).map((entry) => entry.node), total: ranked.length };
}
