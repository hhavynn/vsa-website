import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../../context/ThemeContext';
import { aceFamiliesRepository } from '../../../data/repos/aceFamilies';
import type { AceAssignmentCycle, AceAssignmentDraft, AceFamily } from '../../../types';
import type { AceNodeRef } from '../../../lib/aceAssignments';
import { buildBranchPreview } from '../../../lib/aceBranchPreview';
import { FamilyTree } from '../ace/FamilyTree';
import '../../../styles/ace.css';

interface AceBranchPreviewPanelProps {
  cycle: AceAssignmentCycle;
  drafts: AceAssignmentDraft[];
  nodes: AceNodeRef[];
  /** All three upstream reads (cycle, drafts and node refs) must be complete. */
  ready: boolean;
}

/**
 * Admin-only view of what the existing ACE publisher would add.
 * No mutations, unpublished public queries, external source links or avatar fetches.
 * The full family list is fetched only after an admin opens this panel.
 */
export function AceBranchPreviewPanel({ cycle, drafts, nodes, ready }: AceBranchPreviewPanelProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState('');
  const [fullAncestry, setFullAncestry] = useState(true);
  const [focusId, setFocusId] = useState<string | null>(null);
  const { data: families, isLoading, isError } = useQuery<AceFamily[]>({
    queryKey: ['ace-families', 'admin'],
    queryFn: () => aceFamiliesRepository.getAdminFamilies(),
    enabled: open && ready,
    staleTime: 30 * 1000,
    retry: false,
  });
  const plan = useMemo(() =>
    ready && families !== undefined
      ? buildBranchPreview({ cycle, drafts, nodes, families })
      : null,
    [ready, families, cycle, drafts, nodes],
  );
  const selected = plan?.fams.find((fam) => fam.familyId === selectedFamily) ?? plan?.fams[0] ?? null;
  const visibleNodes = selected ? (fullAncestry ? selected.fullNodes : selected.newOnlyNodes) : [];
  const draftCount = selected?.fullNodes.filter((node) => node.isDraft).length ?? 0;

  return (
    <section aria-labelledby="ace-branch-preview-heading" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="ace-branch-preview-heading" className="font-serif text-lg font-bold text-[var(--color-text)]">
            Private family branch preview
          </h3>
          <p className="mt-1 text-xs text-[var(--color-text2)]">
            Inspect proposed Little branches against existing published ancestry. No changes are made to the ACE tree.
          </p>
        </div>
        <button type="button" aria-expanded={open} aria-controls="ace-branch-preview-content"
          disabled={!ready} onClick={() => setOpen((value) => !value)}
          className="min-h-11 rounded border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] disabled:opacity-50">
          {open ? 'Hide family preview' : 'Preview family branches'}
        </button>
      </div>
      {open && (
        <div id="ace-branch-preview-content" className="mt-4 space-y-4">
          {!ready ? (
            <p role="status" className="text-sm text-[var(--color-text2)]">
              Waiting for complete assignment and tree reads…
            </p>
          ) : isError ? (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              Family data could not be loaded. The preview is unavailable; do not treat missing branches as approved.
            </p>
          ) : isLoading || families === undefined ? (
            <p role="status" className="text-sm text-[var(--color-text2)]">
              Loading the complete private ACE family list…
            </p>
          ) : plan ? (
            <>
              <p role="status" className="text-sm text-[var(--color-text2)]">
                {plan.fams.length} {plan.fams.length === 1 ? 'family' : 'families'} with proposed branches ·{' '}
                {plan.skipped.length} skipped draft {plan.skipped.length === 1 ? 'row' : 'rows'} ·{' '}
                {plan.checks.length} lineage {plan.checks.length === 1 ? 'warning' : 'warnings'}.
                {' '}{plan.isFinal ? 'Locked draft snapshot for final review.' : 'Working draft; edits can still change this preview.'}
              </p>
              {plan.checks.length > 0 && (
                <div className="rounded border border-amber-500/40 p-3">
                  <h4 className="text-sm font-semibold text-[var(--color-text)]">Review before publishing</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[var(--color-text2)]">
                    {plan.checks.map((check, index) => (
                      <li key={check.code + ':' + check.familyId + ':' + index}>
                        {check.message}
                        {check.familyId && (
                          <> <Link className="underline" to={`/admin/ace?family=${encodeURIComponent(check.familyId)}`}>
                            Review family
                          </Link></>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {plan.skipped.length > 0 && (
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  {plan.skipped.length} draft rows cannot be placed on the tree. Review assignment preflight above;
                  this is not a complete publish preview.
                </p>
              )}
              {selected ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <label htmlFor="ace-branch-family" className="text-sm font-semibold text-[var(--color-text)]">Family</label>
                    <select id="ace-branch-family" value={selected.familyId}
                      onChange={(event) => { setSelectedFamily(event.target.value); setFocusId(null); }}
                      className="min-h-11 max-w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)]">
                      {plan.fams.map((fam) => (
                        <option key={fam.familyId} value={fam.familyId}>{fam.familyName}</option>
                      ))}
                    </select>
                    <label className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--color-text2)]">
                      <input type="checkbox" checked={fullAncestry} onChange={(event) => setFullAncestry(event.target.checked)} />
                      Full published ancestry
                    </label>
                    <Link to={`/admin/ace?family=${encodeURIComponent(selected.familyId)}`}
                      className="text-sm underline">Review family records</Link>
                  </div>
                  <p className="text-xs text-[var(--color-text2)]">
                    {draftCount} draft {draftCount === 1 ? 'Little' : 'Littles'} ·{' '}
                    {selected.byBig.length} {selected.byBig.length === 1 ? 'Big' : 'Bigs'}.
                    {!selected.isPublished && ' This family is not published; the new branches will not be public.'}
                    {' '}Draft nodes are visibly marked DRAFT · NOT PUBLISHED.
                  </p>
                  <div className={`ace-app ${dark ? 'is-dark' : ''} overflow-x-auto rounded border border-[var(--color-border)] bg-[var(--color-surface2)] p-2`}
                    tabIndex={0} role="region" aria-label={`Private ${selected.familyName} family tree preview`}>
                    <FamilyTree nodes={visibleNodes} dark={dark} focusId={focusId} onSelect={setFocusId} />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selected.byBig.map((group) => (
                      <p key={group.bigId} className="rounded border border-[var(--color-border)] p-2 text-xs text-[var(--color-text2)]">
                        <strong>{group.bigName}</strong>: {group.existing} existing, {group.incoming} proposed
                      </p>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-[var(--color-text2)]">No placeable Little branches in this cycle yet.</p>
              )}
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
