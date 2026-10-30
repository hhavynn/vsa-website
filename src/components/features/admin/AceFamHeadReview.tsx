import type { AceFamily, AceFamilyMember } from '../../../types';
import type { AceMemberLinkRef } from '../../../lib/aceMemberLinks';
import type { MemberOption } from '../../../lib/memberLinkMatching';
import { reviewExplicitFamHeads } from '../../../lib/aceFamHeadReview';
import { formatAcademicYear } from '../../../lib/academicTerms';

export function AceFamHeadReview({
  family, nodes, directoryById, allLinks, evidenceReady, onReviewNode,
}: {
  family: AceFamily;
  nodes: readonly AceFamilyMember[];
  directoryById: ReadonlyMap<string, MemberOption>;
  allLinks: readonly AceMemberLinkRef[];
  evidenceReady: boolean;
  onReviewNode: (nodeId: string) => void;
}) {
  const rows = reviewExplicitFamHeads(family, nodes, directoryById, allLinks, evidenceReady);
  const reviewCount = rows.filter((row) => row.status === 'needs-review').length;
  const verified = rows.filter((row) => row.status === 'verified-source').length;
  return (
    <section className="mb-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-4" aria-labelledby="ace-fam-head-review-heading">
      <h3 id="ace-fam-head-review-heading" className="font-serif text-lg font-bold text-[var(--color-text)]">
        Fam Head identity review
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-[var(--color-text2)]">
        Only explicit <strong>Fam Head</strong> or <strong>Co-Fam Head</strong> role labels count here.
        Being a Big, Little or root of a family tree does not prove leadership.
        These are private source checks, not public badges.
      </p>
      <p className="mt-2 text-xs font-semibold text-[var(--color-text2)]" role="status">
        {!evidenceReady
          ? 'Checking canonical member links; eligibility is unknown, not verified.'
          : rows.length + ' explicitly labeled · ' + verified + ' source-ready · ' + reviewCount + ' need review'}
        {family.academic_year_start !== null ? ' · ' + formatAcademicYear(family.academic_year_start) : ' · Leadership year unassigned'}
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text2)]">
          No member of this family has an explicit Fam Head label. If this family has a designated
          head, add the approved label in their existing node editor; do not infer one from ancestry.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map(({ node, status, notes, linkedMember }) => (
            <li key={node.id} className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-sans text-sm font-semibold text-[var(--color-text)]">{node.name} · {node.role_label}</p>
                  <p className="text-xs text-[var(--color-text2)]">
                    {status === 'unknown' ? 'Link evidence unavailable' : status === 'verified-source' ? 'Source ready for role projection review' : 'Needs identity/publication review'}
                    {' · '}{linkedMember ? linkedMember.displayName : node.member_id ? 'Canonical member not verified' : 'Not linked'}
                  </p>
                </div>
                <button type="button" className="vsa-btn-secondary min-h-11 shrink-0 text-xs" onClick={() => onReviewNode(node.id)}>
                  Review node
                </button>
              </div>
              {notes.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[var(--color-text2)]">
                  {notes.map((note) => <li key={note}>{note}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {rows.length > 1 && (
        <p className="mt-3 text-xs text-[var(--color-text2)]">
          Multiple explicitly labeled co-heads are allowed for review. This list never merges identities,
          replaces membership links, rewrites family ancestry or publishes a role.
        </p>
      )}
    </section>
  );
}
