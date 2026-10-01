import { MemberNameIndex, MemberOption, findExactMemberMatch } from './memberLinkMatching';

export interface MemberLinkSuggestionData {
  /** recommended: one exact, unclaimed match. review: an admin must decide. */
  kind: 'recommended' | 'review';
  members: MemberOption[];
  note?: string;
}

/**
 * What an admin is offered for an unlinked row (Cabinet position, intern, ...).
 * Exact normalized name only; nothing is ever linked automatically from here.
 */
export function suggestMemberLink(
  name: string | null | undefined,
  linkedMemberId: string | null | undefined,
  index: MemberNameIndex,
  claimedByOthers: ReadonlySet<string>,
): MemberLinkSuggestionData | null {
  if (linkedMemberId || !name?.trim()) return null;
  const match = findExactMemberMatch(name, index);
  if (match.kind === 'none') return null;
  if (match.kind === 'ambiguous') return { kind: 'review', members: match.members };
  if (claimedByOthers.has(match.member.id)) {
    return {
      kind: 'review',
      members: [match.member],
      note: 'This member is already linked to another row.',
    };
  }
  return { kind: 'recommended', members: [match.member] };
}
