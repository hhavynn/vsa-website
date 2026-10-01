import { useCallback, useEffect, useMemo, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { PageTitle } from '../../components/common/PageTitle';
import { MemberLinkPicker } from '../../components/features/admin/MemberLinkPicker';
import { internCohortRepository } from '../../data/repos/internCohort';
import { memberLookupRepository } from '../../data/repos/memberLookup';
import { useAuth } from '../../hooks/useAuth';
import { useCabinetYears } from '../../hooks/useCabinetYears';
import {
  InternCohortCycle,
  InternCohortDraft,
  MentorOption,
  buildInternDraftRows,
  buildInternPreflight,
  formatCohortYears,
  moveId,
  parseInternNames,
  resequence,
  sortDrafts,
} from '../../lib/internCohort';
import { InternDraftPatch } from '../../data/repos/internCohort';
import { MemberNameIndex, MemberOption, buildMemberNameIndex } from '../../lib/memberLinkMatching';
import { suggestMemberLink } from '../../lib/memberLinkSuggestion';

const fieldCls =
  'w-full rounded border bg-[var(--color-surface2)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] disabled:opacity-60';
const smallFieldCls =
  'w-full rounded border bg-[var(--color-surface2)] px-2 py-1.5 text-xs text-[var(--color-text)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] disabled:opacity-60';
const labelCls = 'mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.1em]';
const ghostBtn =
  'rounded border bg-transparent px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-surface2)] disabled:opacity-50';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  locked: 'Locked',
  published: 'Published',
  archived: 'Archived',
};

interface InternRowProps {
  draft: InternCohortDraft;
  index: number;
  count: number;
  editable: boolean;
  busy: boolean;
  memberById: Map<string, MemberOption>;
  nameIndex: MemberNameIndex;
  claimedByOthers: ReadonlySet<string>;
  mentors: MentorOption[];
  onSave: (draft: InternCohortDraft, patch: InternDraftPatch) => void;
  onMove: (draft: InternCohortDraft, direction: -1 | 1) => void;
  onRemove: (draft: InternCohortDraft) => void;
}

function InternRow({ draft, index, count, editable, busy, memberById, nameIndex, claimedByOthers, mentors, onSave, onMove, onRemove }: InternRowProps) {
  const [name, setName] = useState(draft.name);
  const [track, setTrack] = useState(draft.role_or_track ?? '');
  const [caption, setCaption] = useState(draft.caption ?? '');
  const [notes, setNotes] = useState(draft.internal_notes ?? '');
  const member = draft.member_id ? memberById.get(draft.member_id) ?? null : null;
  const mentor = mentors.find((option) => option.id === draft.mentor_cabinet_member_id) ?? null;

  function commit<K extends keyof InternDraftPatch>(key: K, value: string, current: string | null) {
    const next = value.trim();
    if (key === 'name' && !next) {
      setName(draft.name);
      return;
    }
    if (next === (current ?? '')) return;
    onSave(draft, { [key]: key === 'name' ? next : next || null } as InternDraftPatch);
  }

  return (
    <li className="rounded border p-4" style={{ borderColor: 'var(--color-border)' }} data-testid="intern-row">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[200px] flex-1">
          <label className={labelCls} style={{ color: 'var(--color-text3)' }} htmlFor={`intern-name-${draft.id}`}>Name</label>
          <input
            id={`intern-name-${draft.id}`}
            className={smallFieldCls}
            style={{ borderColor: 'var(--color-border)' }}
            value={name}
            disabled={!editable || busy}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => commit('name', name, draft.name)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px]" style={{ color: 'var(--color-text3)' }}>#{index + 1}</span>
          <button type="button" className={ghostBtn} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} disabled={!editable || busy || index === 0} onClick={() => onMove(draft, -1)} aria-label={`Move ${draft.name} up`}>↑</button>
          <button type="button" className={ghostBtn} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} disabled={!editable || busy || index === count - 1} onClick={() => onMove(draft, 1)} aria-label={`Move ${draft.name} down`}>↓</button>
          {editable && (
            <button type="button" className="bg-transparent p-0 text-[11px] font-semibold underline-offset-2 hover:underline" style={{ color: 'var(--color-text2)' }} disabled={busy} onClick={() => onRemove(draft)} aria-label={`Remove ${draft.name}`}>
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div>
          <span className={labelCls} style={{ color: 'var(--color-text3)' }}>Member</span>
          <MemberLinkPicker
            linkedMemberId={draft.member_id}
            linkedMember={member}
            suggestion={suggestMemberLink(draft.name, draft.member_id, nameIndex, claimedByOthers)}
            busy={busy}
            disabledReason={editable ? null : 'Reopen the cohort to change links.'}
            onLink={(option) => onSave(draft, { member_id: option.id })}
            onUnlink={() => onSave(draft, { member_id: null })}
          />
        </div>
        <div>
          <label className={labelCls} style={{ color: 'var(--color-text3)' }} htmlFor={`intern-mentor-${draft.id}`}>Mentor (optional)</label>
          <select
            id={`intern-mentor-${draft.id}`}
            className={smallFieldCls}
            style={{ borderColor: 'var(--color-border)' }}
            value={draft.mentor_cabinet_member_id ?? ''}
            disabled={!editable || busy}
            onChange={(event) => onSave(draft, { mentor_cabinet_member_id: event.target.value || null })}
          >
            <option value="">No mentor</option>
            {mentors.map((option) => (
              <option key={option.id} value={option.id}>{option.name} · {option.role}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: 'var(--color-text3)' }} htmlFor={`intern-track-${draft.id}`}>Role / track</label>
          <input
            id={`intern-track-${draft.id}`}
            className={smallFieldCls}
            style={{ borderColor: 'var(--color-border)' }}
            placeholder="Intern"
            value={track}
            disabled={!editable || busy}
            onChange={(event) => setTrack(event.target.value)}
            onBlur={() => commit('role_or_track', track, draft.role_or_track)}
          />
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <label className={labelCls} style={{ color: 'var(--color-text3)' }} htmlFor={`intern-caption-${draft.id}`}>Caption / bio (private for now)</label>
          <textarea
            id={`intern-caption-${draft.id}`}
            rows={2}
            className={smallFieldCls}
            style={{ borderColor: 'var(--color-border)' }}
            value={caption}
            disabled={!editable || busy}
            onChange={(event) => setCaption(event.target.value)}
            onBlur={() => commit('caption', caption, draft.caption)}
          />
        </div>
        <div>
          <label className={labelCls} style={{ color: 'var(--color-text3)' }} htmlFor={`intern-notes-${draft.id}`}>Internal notes</label>
          <textarea
            id={`intern-notes-${draft.id}`}
            rows={2}
            className={smallFieldCls}
            style={{ borderColor: 'var(--color-border)' }}
            value={notes}
            disabled={!editable || busy}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={() => commit('internal_notes', notes, draft.internal_notes)}
          />
        </div>
      </div>

      <p className="mt-3 text-xs" style={{ color: 'var(--color-text2)' }}>
        {draft.member_id ? '✅' : '⚠'} {draft.name}
        {' · '}Member: {member ? member.displayName : 'not linked'}
        {' · '}Mentor: {mentor ? `${mentor.name} · ${mentor.role}` : 'none'}
        {' · '}Track: {draft.role_or_track || 'Intern'}
        {draft.published_cabinet_member_id ? ' · published' : ''}
      </p>
    </li>
  );
}

export default function AdminInterns() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { cabinetYears } = useCabinetYears();
  const [cycles, setCycles] = useState<InternCohortCycle[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<InternCohortDraft[]>([]);
  const [mentors, setMentors] = useState<MentorOption[]>([]);
  const [directory, setDirectory] = useState<MemberOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [newCabinetYearId, setNewCabinetYearId] = useState('');
  const [pasted, setPasted] = useState('');
  const [publishConfirmed, setPublishConfirmed] = useState(false);

  const cycle = useMemo(() => cycles.find((item) => item.id === cycleId) ?? null, [cycles, cycleId]);
  const cabinetYear = useMemo(() => cabinetYears.find((year) => year.id === cycle?.cabinet_year_id) ?? null, [cabinetYears, cycle]);
  const editable = cycle?.status === 'draft';
  const ordered = useMemo(() => sortDrafts(drafts), [drafts]);
  const memberById = useMemo(() => new Map(directory.map((member) => [member.id, member])), [directory]);
  const preflight = useMemo(() => buildInternPreflight(ordered), [ordered]);
  const needReview = preflight.accepted - preflight.linked;

  const nameIndex = useMemo(() => buildMemberNameIndex(directory), [directory]);
  const linkedIds = useMemo(() => ordered.map((draft) => draft.member_id).filter((id): id is string => !!id), [ordered]);

  const loadCycles = useCallback(async () => {
    try {
      setCycles(await internCohortRepository.listCycles());
    } catch (err) {
      console.error(err);
      toast.error('Failed to load intern cohorts.');
    } finally {
      setLoadingCycles(false);
    }
  }, []);

  useEffect(() => { loadCycles(); }, [loadCycles]);
  useEffect(() => {
    memberLookupRepository.listMemberDirectory().then(setDirectory).catch((err) => {
      console.error(err);
      toast.error('Failed to load members for linking.');
    });
  }, []);

  useEffect(() => {
    setPublishConfirmed(false);
    if (!cycle) {
      setDrafts([]);
      setMentors([]);
      return;
    }
    internCohortRepository.getDrafts(cycle.id).then(setDrafts).catch((err) => {
      console.error(err);
      toast.error('Failed to load interns.');
    });
    internCohortRepository.listMentorOptions(cycle.cabinet_year_id).then(setMentors).catch(() => setMentors([]));
  }, [cycle]);

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error && err.message ? err.message : failure);
    } finally {
      setBusy(false);
    }
  }

  function createCycle() {
    const year = cabinetYears.find((item) => item.id === newCabinetYearId);
    if (!year) {
      toast.error('Choose a cabinet year.');
      return;
    }
    return run(async () => {
      const created = await internCohortRepository.createCycle({ academicYearStart: year.start_year, cabinetYearId: year.id, userId });
      await loadCycles();
      setCycleId(created.id);
    }, 'Failed to start the cohort.');
  }

  function importNames() {
    if (!cycle) return;
    const parsed = parseInternNames(pasted);
    if (parsed.length === 0) {
      toast.error('Paste at least one name.');
      return;
    }
    return run(async () => {
      const startingOrder = ordered.reduce((max, draft) => Math.max(max, draft.display_order), -1) + 1;
      const rows = buildInternDraftRows(parsed, nameIndex, startingOrder, ordered.map((d) => d.member_id).filter((id): id is string => !!id));
      const created = await internCohortRepository.addDrafts(cycle.id, rows);
      setDrafts((current) => [...current, ...created]);
      setPasted('');
      toast.success(`Added ${created.length} intern${created.length === 1 ? '' : 's'} (${created.filter((d) => d.member_id).length} linked).`);
    }, 'Failed to add interns.');
  }

  function saveDraft(draft: InternCohortDraft, patch: InternDraftPatch) {
    if (!cycle) return;
    return run(async () => {
      await internCohortRepository.updateDraft(cycle.id, draft.id, patch);
      setDrafts((current) => current.map((item) => (item.id === draft.id ? { ...item, ...patch } : item)));
    }, 'Failed to save.');
  }

  function moveDraft(draft: InternCohortDraft, direction: -1 | 1) {
    if (!cycle) return;
    const nextOrder = moveId(ordered.map((item) => item.id), draft.id, direction);
    const changes = resequence(ordered, nextOrder);
    if (changes.length === 0) return;
    return run(async () => {
      await internCohortRepository.reorder(cycle.id, changes);
      const byId = new Map(changes.map((change) => [change.id, change.display_order]));
      setDrafts((current) => current.map((item) => (byId.has(item.id) ? { ...item, display_order: byId.get(item.id) as number } : item)));
    }, 'Failed to reorder.');
  }

  function removeDraft(draft: InternCohortDraft) {
    if (!cycle) return;
    return run(async () => {
      await internCohortRepository.removeDraft(cycle.id, draft.id);
      setDrafts((current) => current.filter((item) => item.id !== draft.id));
    }, 'Failed to remove.');
  }

  async function refreshCycle() {
    if (!cycle) return;
    const fresh = await internCohortRepository.getCycle(cycle.id);
    setCycles((current) => current.map((item) => (item.id === fresh.id ? fresh : item)));
    setDrafts(await internCohortRepository.getDrafts(cycle.id));
  }

  function lock() {
    if (!cycle) return;
    return run(async () => {
      await internCohortRepository.lockCycle(cycle.id);
      await refreshCycle();
      toast.success('Locked. The cohort is still private.');
    }, 'Failed to lock.');
  }

  function reopen() {
    if (!cycle) return;
    return run(async () => {
      await internCohortRepository.reopenCycle(cycle.id);
      await refreshCycle();
    }, 'Failed to reopen.');
  }

  function publish() {
    if (!cycle) return;
    return run(async () => {
      const result = await internCohortRepository.publishCycle(cycle.id);
      await refreshCycle();
      toast.success(result.alreadyPublished ? 'Already published.' : `Published: ${result.created} added, ${result.updated} updated.`);
    }, 'Failed to publish. Nothing was lost; fix the issue and publish again.');
  }

  function discard() {
    if (!cycle || !window.confirm('Delete this draft cohort? This cannot be undone.')) return;
    return run(async () => {
      await internCohortRepository.deleteCycle(cycle.id);
      setCycleId(null);
      await loadCycles();
    }, 'Failed to delete.');
  }

  const usedCabinetYearIds = new Set(cycles.map((item) => item.cabinet_year_id));
  const availableYears = cabinetYears.filter((year) => !usedCabinetYearIds.has(year.id));

  return (
    <>
      <PageTitle title="Intern Cohort" />
      <Toaster position="top-right" />

      <div className="border-b px-6 py-6 sm:px-8 sm:py-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>Intern Cohort</h1>
        <p className="mt-2 max-w-3xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
          Prepare the accepted intern cohort privately. Nothing is public until you publish; publishing adds the interns to the Cabinet page&apos;s Interns group, which is what the Internship page shows.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link to="/admin/cabinet" className="rounded border px-2 py-1 font-semibold text-[var(--brand)] hover:bg-[var(--color-surface2)]" style={{ borderColor: 'var(--color-border)' }}>Cabinet admin</Link>
          <Link to="/intern-program" className="rounded border px-2 py-1 font-semibold text-[var(--brand)] hover:bg-[var(--color-surface2)]" style={{ borderColor: 'var(--color-border)' }}>View public Internship page</Link>
        </div>
      </div>

      {!cycle ? (
        <div className="grid gap-6 p-4 sm:p-6 lg:p-8 lg:grid-cols-2">
          <section className="scrapbook-paper p-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>Cohorts</h2>
            {loadingCycles ? (
              <p className="mt-4 text-sm" style={{ color: 'var(--color-text3)' }}>Loading…</p>
            ) : cycles.length === 0 ? (
              <p className="mt-4 text-sm" style={{ color: 'var(--color-text3)' }}>No cohorts yet. Start one to begin.</p>
            ) : (
              <ul className="mt-4 divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {cycles.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{formatCohortYears(item)} Intern Cohort</p>
                      <p className="text-xs" style={{ color: 'var(--color-text3)' }}>{STATUS_LABEL[item.status]}</p>
                    </div>
                    <button type="button" className={ghostBtn} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} onClick={() => setCycleId(item.id)}>Open</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="scrapbook-paper p-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>Start a cohort</h2>
            <label htmlFor="new-cohort-year" className={`${labelCls} mt-4`} style={{ color: 'var(--color-text3)' }}>Cabinet year</label>
            <select id="new-cohort-year" className={fieldCls} style={{ borderColor: 'var(--color-border)' }} value={newCabinetYearId} onChange={(event) => setNewCabinetYearId(event.target.value)}>
              <option value="">Choose a cabinet year…</option>
              {availableYears.map((year) => (
                <option key={year.id} value={year.id}>{year.label}</option>
              ))}
            </select>
            <button type="button" className="vsa-btn-primary mt-4 px-5 py-2 text-xs disabled:opacity-50" disabled={busy || !newCabinetYearId} onClick={createCycle}>Start cohort</button>
          </section>
        </div>
      ) : (
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <button type="button" onClick={() => setCycleId(null)} className="mb-2 bg-transparent p-0 text-xs font-semibold underline-offset-2 hover:underline" style={{ color: 'var(--color-text2)' }}>← All cohorts</button>
              <h2 className="font-serif text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{formatCohortYears(cycle)} Intern Cohort</h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>{STATUS_LABEL[cycle.status]} · cabinet year {cabinetYear?.label ?? '…'}</p>
              <p className="mt-2 font-mono text-sm" style={{ color: 'var(--color-text)' }}>
                {preflight.accepted} accepted · {preflight.linked} linked · {needReview} need review
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {cycle.status === 'draft' && (
                <>
                  <button type="button" className={ghostBtn} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }} disabled={busy} onClick={discard}>Delete draft</button>
                  <button type="button" className="vsa-btn-primary px-5 py-2 text-xs disabled:opacity-50" disabled={busy || !preflight.canLock} onClick={lock}>Lock cohort</button>
                </>
              )}
              {cycle.status === 'locked' && (
                <button type="button" className={ghostBtn} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }} disabled={busy} onClick={reopen}>Reopen draft</button>
              )}
            </div>
          </div>

          {cycle.status === 'locked' && (
            <div className="rounded border p-3 text-xs" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text2)' }}>
              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Locked — still private.</p>
              <p className="mt-1">Publishing adds or updates {preflight.accepted} intern{preflight.accepted === 1 ? '' : 's'} in the Cabinet&apos;s Interns group for {cabinetYear?.label ?? 'this cabinet year'}. Interns already published are updated, not duplicated.</p>
              <label className="mt-3 flex cursor-pointer select-none items-start gap-2">
                <input type="checkbox" checked={publishConfirmed} onChange={(event) => setPublishConfirmed(event.target.checked)} className="mt-0.5 cursor-pointer rounded border-[var(--color-border)] bg-transparent text-[var(--brand)] focus:ring-[var(--brand)]" />
                <span style={{ color: 'var(--color-text)' }}>I confirm: make this cohort public.</span>
              </label>
              <button type="button" className="vsa-btn-primary mt-3 px-5 py-2 text-xs disabled:opacity-50" disabled={busy || !publishConfirmed} onClick={publish}>
                {busy ? 'Publishing…' : 'Publish cohort'}
              </button>
            </div>
          )}
          {cycle.status === 'published' && (
            <div className="rounded border p-3 text-xs" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text2)' }}>
              Published. This cohort is read-only here; edit published interns from Cabinet admin.
            </div>
          )}

          <section className="scrapbook-paper p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} aria-label="Preflight">
            <h3 className="font-serif text-lg font-bold" style={{ color: 'var(--color-text)' }}>Preflight</h3>
            <ul className="mt-3 space-y-1 text-sm" style={{ color: 'var(--color-text)' }}>
              <li>✓ {preflight.accepted} accepted</li>
              <li>✓ {preflight.linked} linked</li>
            </ul>
            {preflight.blockers.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-red-600 dark:text-red-400">
                {preflight.blockers.map((issue) => <li key={issue.code}>✕ {issue.message}</li>)}
              </ul>
            )}
            {(preflight.warnings.length > 0 || preflight.notes.length > 0) && (
              <div className="mt-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>Needs attention</p>
                <ul className="mt-1 space-y-1 text-xs">
                  {preflight.warnings.map((issue) => <li key={issue.code} className="text-amber-700 dark:text-amber-400">⚠ {issue.message}</li>)}
                  {preflight.notes.map((issue) => <li key={issue.code} style={{ color: 'var(--color-text3)' }}>○ {issue.message}</li>)}
                </ul>
              </div>
            )}
          </section>

          {editable && (
            <section className="scrapbook-paper p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} aria-label="Import names">
              <h3 className="font-serif text-lg font-bold" style={{ color: 'var(--color-text)' }}>Add interns</h3>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>One per line: &quot;Name&quot; or &quot;Name, Track&quot;. Exact, unambiguous names link to members automatically; everything else is left for you to review.</p>
              <label htmlFor="intern-paste" className="sr-only">Pasted intern names</label>
              <textarea id="intern-paste" rows={5} className={`${fieldCls} mt-3 font-mono text-xs`} style={{ borderColor: 'var(--color-border)' }} value={pasted} onChange={(event) => setPasted(event.target.value)} placeholder={'Sarah Nguyen, Events / Operations\nKevin Tran'} />
              <button type="button" className="vsa-btn-primary mt-3 px-5 py-2 text-xs disabled:opacity-50" disabled={busy || !pasted.trim()} onClick={importNames}>Add to cohort</button>
            </section>
          )}

          <section aria-label="Interns">
            {ordered.length === 0 ? (
              <p className="rounded border px-5 py-10 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)' }}>No interns yet.</p>
            ) : (
              <ul className="space-y-3">
                {ordered.map((draft, index) => (
                  <InternRow
                    key={draft.id}
                    draft={draft}
                    index={index}
                    count={ordered.length}
                    editable={!!editable}
                    busy={busy}
                    memberById={memberById}
                    nameIndex={nameIndex}
                    claimedByOthers={new Set(linkedIds.filter((id) => id !== draft.member_id))}
                    mentors={mentors}
                    onSave={saveDraft}
                    onMove={moveDraft}
                    onRemove={removeDraft}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
