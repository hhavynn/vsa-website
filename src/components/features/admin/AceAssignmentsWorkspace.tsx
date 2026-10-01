import { FormEvent, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from 'react-query';
import { aceAssignmentsRepository, AceAssignmentDraftPatch } from '../../../data/repos/aceAssignments';
import { toUserMessage } from '../../../data/errors';
import {
  ACE_ASSIGNMENT_CYCLES_KEY,
  ACE_NODE_REFS_KEY,
  aceAssignmentDraftsKey,
  useAceAssignmentCycles,
  useAceAssignmentDrafts,
  useAceNodeRefs,
} from '../../../hooks/useAceAssignments';
import { ACE_MEMBER_LINKS_QUERY_KEY } from '../../../hooks/useAceFamilies';
import { useMemberDirectory } from '../../../hooks/useMemberDirectory';
import {
  ImportResolution,
  buildPublishPreview,
  computeBigLoad,
  computePreflight,
  formatAcademicYear,
  isCycleEditable,
  reviewUnlinkedLittles,
  selectBulkLittleLinks,
} from '../../../lib/aceAssignments';
import { AceAssignmentCycle, AceAssignmentDraft } from '../../../types';
import { AceAssignmentImportPanel } from './AceAssignmentImportPanel';
import { AceAssignmentPreflightPanel } from './AceAssignmentPreflightPanel';
import { AceAssignmentRow } from './AceAssignmentRow';

const STATUS_COPY: Record<AceAssignmentCycle['status'], { label: string; hint: string }> = {
  draft: { label: 'Draft', hint: 'Private. Edit freely; nothing here is public.' },
  locked: { label: 'Locked', hint: 'Frozen for final review. Still private: locking does not publish anything.' },
  published: { label: 'Published', hint: 'These Littles are now on the public ACE tree.' },
  archived: { label: 'Archived', hint: 'Kept for reference.' },
};

const primaryBtnCls =
  'rounded border-0 bg-[var(--color-text)] px-3 py-1.5 font-sans text-xs font-medium text-[var(--color-bg)] disabled:opacity-50';
const ghostBtnCls =
  'rounded border border-[var(--color-border)] bg-transparent px-3 py-1.5 font-sans text-xs font-medium text-[var(--color-text2)] transition-colors hover:bg-[var(--color-surface2)] disabled:opacity-50';
const inputCls =
  'rounded border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 py-2 font-sans text-sm text-[var(--color-text)] placeholder-[var(--color-text3)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]';

function currentAcademicYearStart(now = new Date()): number {
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="font-serif text-2xl font-bold text-[var(--color-text)]">{value}</p>
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-text3)]">{label}</p>
    </div>
  );
}

/**
 * Admin → ACE → Assignments. Drafts the upcoming Big/Little sorting in
 * private tables, then lock → preflight → publish. Only Publish touches the
 * live ACE tree.
 */
export function AceAssignmentsWorkspace() {
  const queryClient = useQueryClient();
  const { cycles, loading: cyclesLoading, error: cyclesError } = useAceAssignmentCycles();
  const [pickedCycleId, setPickedCycleId] = useState<string | null>(null);
  const cycle = useMemo(
    () => cycles.find((c) => c.id === pickedCycleId) ?? cycles.find((c) => c.status !== 'archived') ?? null,
    [cycles, pickedCycleId],
  );
  const cycleId = cycle?.id ?? null;

  const { drafts, loading: draftsLoading, error: draftsError } = useAceAssignmentDrafts(cycleId);
  const { nodes, loading: nodesLoading, error: nodesError } = useAceNodeRefs(!!cycleId);
  const { byId: directoryById, nameIndex, loading: directoryLoading, error: directoryError } = useMemberDirectory(!!cycleId);

  const [busy, setBusy] = useState(false);
  const [newYear, setNewYear] = useState(String(currentAcademicYearStart()));
  const [newLittle, setNewLittle] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const ready = !!cycle && !draftsLoading && !nodesLoading && !directoryLoading && !draftsError && !nodesError && !directoryError;
  const editable = !!cycle && isCycleEditable(cycle.status);

  const preflight = useMemo(
    () => (cycle && ready ? computePreflight(drafts, nodes, nameIndex, cycle.status) : null),
    [cycle, ready, drafts, nodes, nameIndex],
  );
  const issuesByDraft = useMemo(() => {
    const map = new Map<string, NonNullable<typeof preflight>['issues']>();
    for (const issue of preflight?.issues ?? []) {
      for (const id of issue.draftIds) map.set(id, [...(map.get(id) ?? []), issue]);
    }
    return map;
  }, [preflight]);
  const reviewByDraft = useMemo(
    () => new Map(reviewUnlinkedLittles(drafts, nameIndex).map((item) => [item.draft.id, item])),
    [drafts, nameIndex],
  );
  const obviousLinks = useMemo(() => selectBulkLittleLinks(Array.from(reviewByDraft.values())), [reviewByDraft]);
  const publishPreview = useMemo(() => buildPublishPreview(drafts, nodes), [drafts, nodes]);
  const loadFor = (bigId: string) => computeBigLoad(bigId, drafts, nodes);

  const refreshDrafts = () => queryClient.invalidateQueries(aceAssignmentDraftsKey(cycleId));
  const refreshCycles = () => queryClient.invalidateQueries(ACE_ASSIGNMENT_CYCLES_KEY);

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(toUserMessage(error, failure));
    } finally {
      setBusy(false);
    }
  }

  const createCycle = (event: FormEvent) => {
    event.preventDefault();
    const start = Number(newYear);
    if (!Number.isInteger(start) || start < 2000 || start > 2100) {
      toast.error('Enter a four-digit start year, like 2026.');
      return;
    }
    void run(async () => {
      const created = await aceAssignmentsRepository.createCycle(start);
      setPickedCycleId(created.id);
      await refreshCycles();
      toast.success(`Started ACE ${formatAcademicYear(start)} assignments.`);
    }, 'Could not start the cycle');
  };

  const patchDraft = (id: string, patch: AceAssignmentDraftPatch) =>
    run(async () => {
      await aceAssignmentsRepository.updateDraft(id, patch);
      await refreshDrafts();
    }, 'Could not save');

  const removeDraft = (id: string) =>
    run(async () => {
      await aceAssignmentsRepository.deleteDraft(id);
      await refreshDrafts();
    }, 'Could not remove');

  const nextOrder = () => drafts.reduce((max, d) => Math.max(max, d.display_order), -1) + 1;

  const addLittle = (event: FormEvent) => {
    event.preventDefault();
    const name = newLittle.replace(/\s+/g, ' ').trim();
    if (!name || !cycleId) return;
    void run(async () => {
      await aceAssignmentsRepository.addDrafts(
        cycleId,
        [{ little_name: name, little_member_id: null, big_ace_member_id: null, notes: null }],
        nextOrder(),
      );
      setNewLittle('');
      await refreshDrafts();
    }, 'Could not add');
  };

  const importLittles = async (resolution: ImportResolution) => {
    if (!cycleId) return;
    await aceAssignmentsRepository.addDrafts(cycleId, resolution.seeds, nextOrder());
    await refreshDrafts();
    const parts = [`Added ${resolution.seeds.length} to the draft.`];
    if (resolution.emailLinked > 0) parts.push(`${resolution.emailLinked} linked by email.`);
    if (resolution.bigUnresolved > 0) parts.push(`${resolution.bigUnresolved} Bigs need a manual pick (see notes).`);
    toast.success(parts.join(' '));
    setImportOpen(false);
  };

  const linkObvious = () =>
    run(async () => {
      const { linked, skipped } = await aceAssignmentsRepository.linkDraftMembers(obviousLinks);
      await refreshDrafts();
      toast.success(
        `Linked ${linked.length} ${linked.length === 1 ? 'Little' : 'Littles'}` +
          (skipped.length > 0 ? `; ${skipped.length} changed meanwhile and were skipped.` : '.'),
      );
    }, 'Could not link');

  const setStatus = (to: 'draft' | 'locked' | 'archived') =>
    cycle &&
    run(async () => {
      await aceAssignmentsRepository.setCycleStatus(cycle.id, cycle.status, to);
      setConfirmPublish(false);
      await refreshCycles();
      toast.success(to === 'locked' ? 'Assignments locked. Nothing is public yet.' : to === 'draft' ? 'Unlocked.' : 'Archived.');
    }, 'Could not update the cycle');

  const publish = () =>
    cycle &&
    run(async () => {
      const result = await aceAssignmentsRepository.publishCycle(cycle.id);
      setConfirmPublish(false);
      await Promise.all([refreshCycles(), refreshDrafts()]);
      await queryClient.invalidateQueries(ACE_NODE_REFS_KEY);
      await queryClient.invalidateQueries(ACE_MEMBER_LINKS_QUERY_KEY);
      await queryClient.invalidateQueries('ace-family-members');
      toast.success(
        result.alreadyPublished ? 'Already published. Nothing new was added.' : `Published ${result.created} Littles to the ACE tree.`,
      );
    }, 'Could not publish');

  if (cyclesLoading) return <p className="px-7 py-6 font-sans text-sm text-[var(--color-text3)]">Loading assignments…</p>;
  if (cyclesError) {
    return <p className="px-7 py-6 font-sans text-sm text-red-500">Failed to load assignment cycles.</p>;
  }

  if (!cycle) {
    return (
      <div className="px-7 py-6">
        <form
          onSubmit={createCycle}
          className="max-w-md rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        >
          <h2 className="font-serif text-xl font-bold text-[var(--color-text)]">Start ACE assignments</h2>
          <p className="mt-1 font-sans text-xs text-[var(--color-text2)]">
            Prepare the upcoming Big/Little sorting privately. Nothing is public until you publish.
          </p>
          <label htmlFor="ace-cycle-year" className="mt-4 block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)]">
            Academic year starts
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="ace-cycle-year"
              inputMode="numeric"
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
              className={`${inputCls} w-28`}
            />
            <button type="submit" disabled={busy} className={primaryBtnCls}>
              Start {Number(newYear) ? formatAcademicYear(Number(newYear)) : ''}
            </button>
          </div>
        </form>
      </div>
    );
  }

  const status = STATUS_COPY[cycle.status];
  const bigCount = preflight?.bigCount ?? 0;
  const loadError = !!(draftsError || nodesError || directoryError);

  return (
    <div className="space-y-5 px-7 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[var(--color-text)]">
            ACE {formatAcademicYear(cycle.academic_year_start)} Assignment
          </h2>
          <p className="mt-1 font-sans text-xs text-[var(--color-text2)]">
            <span className="mr-2 rounded border border-[var(--color-border)] px-2 py-0.5 font-semibold text-[var(--color-text)]">
              {status.label}
            </span>
            {status.hint}
          </p>
        </div>
        {cycles.filter((c) => c.status !== 'archived').length > 1 && (
          <select
            aria-label="Assignment cycle"
            value={cycle.id}
            onChange={(e) => setPickedCycleId(e.target.value)}
            className={inputCls}
          >
            {cycles
              .filter((c) => c.status !== 'archived')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  ACE {formatAcademicYear(c.academic_year_start)} · {STATUS_COPY[c.status].label}
                </option>
              ))}
          </select>
        )}
      </div>

      {loadError && (
        <p role="alert" className="font-sans text-xs text-red-500">
          Could not load everything this workspace needs. Refresh to try again.
        </p>
      )}

      {preflight && (
        <div className="grid grid-cols-2 gap-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:grid-cols-4">
          <Stat value={preflight.littleCount} label="Littles" />
          <Stat value={bigCount} label="Bigs" />
          <Stat value={preflight.assignedCount} label="Assigned" />
          <Stat value={preflight.unassignedCount} label="Unassigned" />
        </div>
      )}

      {preflight && cycle.status !== 'published' && cycle.status !== 'archived' && (
        <div className="space-y-3">
          <AceAssignmentPreflightPanel
            preflight={preflight}
            heading={cycle.status === 'locked' ? 'Preflight before publishing' : 'Preflight before locking'}
          />
          <div className="flex flex-wrap items-center gap-2">
            {cycle.status === 'draft' && (
              <button type="button" onClick={() => setStatus('locked')} disabled={busy || preflight.littleCount === 0} className={primaryBtnCls}>
                Lock assignments
              </button>
            )}
            {cycle.status === 'locked' && (
              <>
                <button type="button" onClick={() => setStatus('draft')} disabled={busy} className={ghostBtnCls}>
                  Unlock to edit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmPublish(true)}
                  disabled={busy || !preflight.canPublish}
                  className={primaryBtnCls}
                >
                  Publish to ACE tree…
                </button>
                {!preflight.canPublish && (
                  <span className="font-sans text-[11px] text-[var(--color-text3)]">Fix the blocking items first.</span>
                )}
              </>
            )}
          </div>
          {confirmPublish && cycle.status === 'locked' && (
            <div
              role="alertdialog"
              aria-label="Confirm publish"
              className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4 font-sans text-xs"
            >
              <p className="font-semibold text-[var(--color-text)]">
                This adds {publishPreview.nodes.length} {publishPreview.nodes.length === 1 ? 'Little' : 'Littles'} to{' '}
                {publishPreview.familyCount} {publishPreview.familyCount === 1 ? 'fam' : 'fams'} on the ACE tree.
              </p>
              <p className="mt-1 text-[var(--color-text2)]">
                Each Little joins their Big's fam with the Big as parent. Fams that are live show them immediately.
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={publish} disabled={busy} className={primaryBtnCls}>
                  {busy ? 'Publishing…' : 'Confirm publish'}
                </button>
                <button type="button" onClick={() => setConfirmPublish(false)} disabled={busy} className={ghostBtnCls}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {cycle.status === 'published' && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 font-sans text-xs text-[var(--color-text2)]">
          <span>
            {drafts.filter((d) => d.published_ace_member_id).length} of {drafts.length} Littles are on the ACE tree.
          </span>
          <button type="button" onClick={() => setStatus('archived')} disabled={busy} className={ghostBtnCls}>
            Archive cycle
          </button>
        </div>
      )}

      {editable && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={addLittle} className="flex items-center gap-2">
              <label htmlFor="ace-new-little" className="sr-only">
                New Little name
              </label>
              <input
                id="ace-new-little"
                value={newLittle}
                onChange={(e) => setNewLittle(e.target.value)}
                placeholder="Add a Little…"
                className={`${inputCls} w-56`}
              />
              <button type="submit" disabled={busy || !newLittle.trim()} className={ghostBtnCls}>
                Add
              </button>
            </form>
            <button type="button" onClick={() => setImportOpen((open) => !open)} className={ghostBtnCls}>
              {importOpen ? 'Close import' : 'Import CSV / TSV'}
            </button>
            {obviousLinks.length > 0 && (
              <button type="button" onClick={linkObvious} disabled={busy} className={ghostBtnCls}>
                Link {obviousLinks.length} obvious member {obviousLinks.length === 1 ? 'match' : 'matches'}
              </button>
            )}
          </div>
          {importOpen && (
            <AceAssignmentImportPanel nodes={nodes} onImport={importLittles} onClose={() => setImportOpen(false)} />
          )}
        </div>
      )}

      <section aria-label="Assignments" className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="hidden border-b border-[var(--color-border)] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)] md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:gap-3">
          <span>Little</span>
          <span>Member</span>
          <span>Big</span>
          <span className="w-12" />
        </div>
        {!ready ? (
          <p className="px-4 py-8 text-center font-sans text-xs text-[var(--color-text3)]">Loading…</p>
        ) : drafts.length === 0 ? (
          <p className="px-4 py-8 text-center font-sans text-xs text-[var(--color-text3)]">
            No Littles yet. Add one above or import a pasted list.
          </p>
        ) : (
          <ul>
            {drafts.map((draft: AceAssignmentDraft) => (
              <AceAssignmentRow
                key={draft.id}
                draft={draft}
                editable={editable}
                nodes={nodes}
                linkedMember={draft.little_member_id ? directoryById.get(draft.little_member_id) ?? null : null}
                review={reviewByDraft.get(draft.id)}
                issues={issuesByDraft.get(draft.id) ?? []}
                loadFor={loadFor}
                busy={busy}
                onPatch={patchDraft}
                onRemove={removeDraft}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
