import type { AceFamilyMember } from '../../../types';
import type { YearFlag, YearReview } from '../../../lib/aceYearReview';
import { formatPickupLabel, pickupYearOf } from '../../../lib/acePickupYear';

const FLAG_LABELS: Record<YearFlag, string> = {
  missing_year: 'Pickup year unknown',
  pending_evidence: 'Source evidence awaiting review',
  evidence_conflict: 'Conflicting year or term evidence',
  child_before_big: 'Little dated before Big',
  same_term_as_big: 'Big and Little share an exact pickup term',
  suspicious_gap: 'Six or more academic years after Big',
  duplicate_identity: 'Duplicate name or member link; verify node identity',
};

export function AceYearReviewPanel({
  familyName,
  nodes,
  reviews,
  ready,
  loading,
  failed,
  onReviewNode,
}: {
  familyName: string;
  nodes: readonly AceFamilyMember[];
  reviews: ReadonlyMap<string, YearReview>;
  ready: boolean;
  loading: boolean;
  failed: boolean;
  onReviewNode: (nodeId: string) => void;
}) {
  // Never display partial counts when the member or evidence read failed.
  if (!ready) {
    return (
      <section className="mb-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-4"
        aria-label="ACE pickup-year review">
        <h3 className="font-serif text-lg font-bold text-[var(--color-text)]">Pickup-year review</h3>
        <p role={failed ? 'alert' : 'status'} className="mt-2 text-sm text-[var(--color-text2)]">
          {failed
            ? 'Year review unavailable. Member or evidence data could not be checked; no counts or year claims are shown.'
            : loading
              ? 'Checking approved years and private source evidence…'
              : 'Choose a family to check pickup years.'}
        </p>
      </section>
    );
  }

  const flagged = nodes.filter(node => (reviews.get(node.id)?.flags.length ?? 0) > 0);
  const verified = nodes.filter(node => reviews.get(node.id)?.status === 'verified').length;
  const unknown = nodes.filter(node => reviews.get(node.id)?.flags.includes('missing_year')).length;
  const withConflict = nodes.filter(node => reviews.get(node.id)?.flags.includes('evidence_conflict')).length;

  return (
    <section className="mb-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-4"
      aria-labelledby="ace-pickup-year-review-heading">
      <h3 id="ace-pickup-year-review-heading" className="font-serif text-lg font-bold text-[var(--color-text)]">
        Pickup-year review
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-[var(--color-text2)]">
        Private review for {familyName}. Only approved node fields determine the public tree year;
        pending sources and Big/Little relationships never assign a date automatically.
      </p>
      <p role="status" className="mt-2 text-xs font-semibold text-[var(--color-text2)]">
        {nodes.length} nodes checked · {flagged.length} flagged · {unknown} unknown year · {withConflict} evidence conflict · {verified} approved year without warnings
      </p>
      {flagged.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text2)]">
          No year-review flags found in this family. This check does not verify historical source completeness.
        </p>
      ) : (
        <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1" aria-label="ACE nodes needing pickup-year review">
          {flagged.map(node => {
            const entry = reviews.get(node.id);
            const year = formatPickupLabel(pickupYearOf(node)) ?? 'Unknown';
            return (
              <li key={node.id} className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-sans text-sm font-semibold text-[var(--color-text)]">
                      {node.name}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-text2)]">
                      Approved pickup: {year} · {entry?.status === 'unknown' ? 'No approved year' : 'Needs review'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="vsa-btn-secondary min-h-11 shrink-0 text-xs"
                    onClick={() => onReviewNode(node.id)}
                    aria-label={`Review ACE node ${node.name}, id ${node.id}`}
                  >
                    Review node
                  </button>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[var(--color-text2)]">
                  {entry?.flags.map(flag => <li key={flag}>{FLAG_LABELS[flag]}</li>)}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-[var(--color-text2)]">
        Reviewing a node opens the existing editor. This panel makes no changes to family membership,
        years, published status, photos or lineage.
      </p>
    </section>
  );
}
