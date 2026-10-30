// Admin -> Houses -> Profiles & Images: links each House Parent to their
// canonical member record with the shared MemberLinkPicker. Exact normalized
// name only; ambiguous or missing names stay "Needs review" until an admin
// picks someone. Never creates a member and never touches House memberships.
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { houseParentsRepository, HouseParentLink } from '../../../data/repos/houseParents';
import { memberLookupRepository } from '../../../data/repos/memberLookup';
import { formatAcademicYear } from '../../../lib/academicTerms';
import { houseParentNameVariants } from '../../../lib/housePlacementImport';
import { buildMemberNameIndex, findExactMemberMatch } from '../../../lib/memberLinkMatching';
import type { MemberOption } from '../../../lib/memberLinkMatching';
import { MemberLinkPicker, MemberLinkSuggestion } from './MemberLinkPicker';
import { reviewHouseParents, type HouseParentReviewState } from '../../../lib/houseParentLinkReview';

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
  const [statusFilter, setStatusFilter] = useState<'all' | HouseParentReviewState>('all');
  const [houseFilter, setHouseFilter] = useState('all');
  useEffect(() => {
    setStatusFilter('all');
    setHouseFilter('all');
  }, [selectedYear]);

  // One complete paginated safe-directory read, not N lookups for N linked parents.
  // Directory failures must not turn linked identities into falsely "stale" badges.
  const { data: directory = [], isLoading: directoryLoading, error: directoryError, refetch: retryDirectory } = useQuery<MemberOption[]>({
    queryKey: ['admin', 'member-directory'],
    queryFn: () => memberLookupRepository.listMemberDirectory(),
    enabled: parents.length > 0 && !error,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const linkedMembers = useMemo(() => new Map(directory.map((member) => [member.id, member])), [directory]);
  const reviews = useMemo(() => reviewHouseParents(parents, directory), [parents, directory]);
  const counts = {
    linked: reviews.filter((item) => item.state === 'linked').length,
    unlinked: reviews.filter((item) => item.state === 'unlinked').length,
    ambiguous: reviews.filter((item) => item.state === 'ambiguous').length,
    'duplicate-stale': reviews.filter((item) => item.state === 'duplicate-stale').length,
  };
  const houses = Array.from(new Map(parents.map((parent) => [parent.house_profile_id, parent.houseLabel])).entries());
  const visible = reviews.filter(({ parent, state }) =>
    (houseFilter === 'all' || houseFilter === parent.house_profile_id) &&
    (statusFilter === 'all' || statusFilter === state));

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
  const needsReview = counts.unlinked + counts.ambiguous + counts['duplicate-stale'];
  const unavailable = directoryLoading || !!directoryError;

  return (
    <section className="scrapbook-paper m-4 p-5 sm:m-6 lg:m-8 border-[var(--color-border)] bg-surface" aria-label="House Parent member links">
      <h2 className="font-serif text-xl font-bold text-text-primary">House Parents · member links</h2>
      <p className="mt-1 text-xs text-text-muted">
        Links each {formatAcademicYear(selectedYear)} House Parent to their member record. The public House page shows the House Parent text and image set above; links stay private.
      </p>
      {isLoading ? (
        <p className="mt-4 text-sm text-text-muted">Loading House Parents…</p>
      ) : error ? (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">House Parents could not be loaded. If the House Parent migration has not been applied yet, apply it first.</p>
      ) : parents.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">No House Parents are recorded for this year.</p>
      ) : (
        <>
          {directoryLoading ? (
            <p role="status" className="mt-3 text-xs text-text-secondary">Checking every linked identity against the complete member directory…</p>
          ) : directoryError ? (
            <div role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
              Member directory unavailable. Link status is unknown; changes are disabled until a successful retry.
              <button type="button" className="ml-2 underline" onClick={() => void retryDirectory()}>Retry directory</button>
            </div>
          ) : (
            <p role="status" className={`mt-3 text-xs font-semibold ${needsReview > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-text-secondary'}`}>
              {needsReview > 0 ? `${needsReview} House Parent${needsReview === 1 ? '' : 's'} need${needsReview === 1 ? 's' : ''} review.` : 'Every House Parent link is verified.'}
            </p>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-text-secondary">
              Link status
              <select aria-label="Filter House Parent links by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="mt-1 w-full rounded border border-border-strong bg-surface px-3 py-2 text-text-primary">
                <option value="all">All ({parents.length})</option>
                <option value="unlinked">Unlinked ({unavailable ? '—' : counts.unlinked})</option>
                <option value="ambiguous">Ambiguous ({unavailable ? '—' : counts.ambiguous})</option>
                <option value="linked">Verified linked ({unavailable ? '—' : counts.linked})</option>
                <option value="duplicate-stale">Duplicate / stale link ({unavailable ? '—' : counts['duplicate-stale']})</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-text-secondary">
              House
              <select aria-label="Filter House Parent links by House" value={houseFilter} onChange={(event) => setHouseFilter(event.target.value)} className="mt-1 w-full rounded border border-border-strong bg-surface px-3 py-2 text-text-primary">
                <option value="all">All Houses</option>
                {houses.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
          </div>
          <ul className="mt-3 divide-y border-[var(--color-border)]">
            {visible.map(({ parent, state, reason }) => (
              <li key={parent.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5" data-testid="house-parent-link">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{parent.display_name}</p>
                  <p className="text-[11px] text-text-muted">
                    {parent.houseLabel} · {parent.member_id ? 'Linked' : `Needs review${parent.review_note ? ` — ${parent.review_note}` : ''}`}
                  </p>
                  {!unavailable && <p className="mt-1 text-xs font-semibold text-text-secondary">
                    {state === 'linked' ? 'Verified link' : state === 'ambiguous' ? 'Ambiguous identity' : state === 'duplicate-stale' ? 'Duplicate / stale link' : 'Unlinked'}
                  </p>}
                  {!unavailable && reason && <p className="mt-1 max-w-lg text-xs text-text-muted">{reason}</p>}
                  {!unavailable && parent.member_id && linkedMembers.has(parent.member_id) && (
                    <p className="mt-1 text-[11px] text-text-muted">Confirmed: {linkedMembers.get(parent.member_id)?.displayName} · ID {parent.member_id.slice(0, 8)}</p>
                  )}
                </div>
                <MemberLinkPicker
                  linkedMemberId={parent.member_id}
                  linkedMember={parent.member_id ? linkedMembers.get(parent.member_id) ?? null : null}
                  suggestion={parent.member_id ? null : suggestHouseParentMember(parent.display_name, directory)}
                  onLink={(member) => setMember.mutate({ parentId: parent.id, memberId: member.id })}
                  onUnlink={() => setMember.mutate({ parentId: parent.id, memberId: null })}
                  busy={setMember.isLoading || unavailable}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
