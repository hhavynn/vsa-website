// Admin -> Houses -> Profiles & Images: links each House Parent to their
// canonical member record with the shared MemberLinkPicker. Exact normalized
// name only; ambiguous or missing names stay "Needs review" until an admin
// picks someone. Never creates a member and never touches House memberships.
import { useMemo } from 'react';
import toast from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { houseParentsRepository, HouseParentLink } from '../../../data/repos/houseParents';
import { memberLookupRepository } from '../../../data/repos/memberLookup';
import { formatAcademicYear } from '../../../lib/academicTerms';
import { houseParentNameVariants } from '../../../lib/housePlacementImport';
import { buildMemberNameIndex, findExactMemberMatch } from '../../../lib/memberLinkMatching';
import type { MemberOption } from '../../../lib/memberLinkMatching';
import { MemberLinkPicker, MemberLinkSuggestion } from './MemberLinkPicker';

export function suggestHouseParentMember(displayName: string, directory: readonly MemberOption[]): MemberLinkSuggestion | null {
  const index = buildMemberNameIndex(directory);
  const found = new Map<string, MemberOption>();
  houseParentNameVariants(displayName).forEach((name) => {
    const match = findExactMemberMatch(name, index);
    if (match.kind === 'unique') found.set(match.member.id, match.member);
    if (match.kind === 'ambiguous') match.members.forEach((member) => found.set(member.id, member));
  });
  const members = Array.from(found.values());
  if (members.length === 0) return null;
  return members.length === 1
    ? { kind: 'recommended', members, note: 'Exact name match.' }
    : { kind: 'review', members, note: `${members.length} members match this name. Choose the right one.` };
}

export function HouseParentLinks({ selectedYear }: { selectedYear: number | null }) {
  const queryClient = useQueryClient();
  const queryKey = ['admin', 'house-parents', selectedYear];
  const { data: parents = [], isLoading, error } = useQuery<HouseParentLink[]>({
    queryKey,
    queryFn: () => houseParentsRepository.listForYear(selectedYear as number),
    enabled: selectedYear !== null,
  });
  const linkedIds = useMemo(() => parents.map((parent) => parent.member_id).filter((id): id is string => !!id), [parents]);
  const { data: linkedMembers = new Map<string, MemberOption>() } = useQuery({
    queryKey: ['admin', 'house-parent-members', linkedIds],
    queryFn: async () => {
      const found = await Promise.all(linkedIds.map((id) => memberLookupRepository.findMemberById(id)));
      return new Map(found.filter((member): member is MemberOption => !!member).map((member) => [member.id, member]));
    },
    enabled: linkedIds.length > 0,
  });
  const needsSuggestions = parents.some((parent) => !parent.member_id);
  const { data: directory = [] } = useQuery({
    queryKey: ['admin', 'member-directory'],
    queryFn: () => memberLookupRepository.listMemberDirectory(),
    enabled: needsSuggestions,
    staleTime: 5 * 60 * 1000,
  });
  const setMember = useMutation(
    ({ parentId, memberId }: { parentId: string; memberId: string | null }) => houseParentsRepository.setMember(parentId, memberId),
    {
      onSuccess: () => queryClient.invalidateQueries(queryKey),
      onError: (err: unknown) => {
        toast.error(err instanceof Error && err.message ? err.message : 'Failed to update the House Parent link.');
      },
    },
  );

  if (selectedYear === null) return null;
  const needsReview = parents.filter((parent) => !parent.member_id).length;

  return (
    <section className="scrapbook-paper m-4 p-5 sm:m-6 lg:m-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} aria-label="House Parent member links">
      <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>House Parents · member links</h2>
      <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>
        Links each {formatAcademicYear(selectedYear)} House Parent to their member record. The public House page shows the House Parent text and image set above; links stay private.
      </p>
      {isLoading ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--color-text3)' }}>Loading House Parents…</p>
      ) : error ? (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">House Parents could not be loaded. If the House Parent migration has not been applied yet, apply it first.</p>
      ) : parents.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--color-text3)' }}>No House Parents are recorded for this year.</p>
      ) : (
        <>
          <p className="mt-3 text-xs font-semibold" style={{ color: needsReview > 0 ? undefined : 'var(--color-text2)' }}>
            <span className={needsReview > 0 ? 'text-amber-700 dark:text-amber-400' : undefined}>
              {needsReview > 0 ? `${needsReview} House Parent${needsReview === 1 ? '' : 's'} need${needsReview === 1 ? 's' : ''} review.` : 'Every House Parent is linked.'}
            </span>
          </p>
          <ul className="mt-3 divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {parents.map((parent) => (
              <li key={parent.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5" data-testid="house-parent-link">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{parent.display_name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--color-text3)' }}>
                    {parent.houseLabel} · {parent.member_id ? 'Linked' : `Needs review${parent.review_note ? ` — ${parent.review_note}` : ''}`}
                  </p>
                </div>
                <MemberLinkPicker
                  linkedMemberId={parent.member_id}
                  linkedMember={parent.member_id ? linkedMembers.get(parent.member_id) ?? null : null}
                  suggestion={parent.member_id ? null : suggestHouseParentMember(parent.display_name, directory)}
                  onLink={(member) => setMember.mutate({ parentId: parent.id, memberId: member.id })}
                  onUnlink={() => setMember.mutate({ parentId: parent.id, memberId: null })}
                  busy={setMember.isLoading}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
