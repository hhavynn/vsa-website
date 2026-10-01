import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useQueryClient } from 'react-query';
import { PageTitle } from '../../components/common/PageTitle';
import { MemberLinkPicker } from '../../components/features/admin/MemberLinkPicker';
import { PreflightSummary, StatusBadge } from '../../components/features/admin/ops';
import { COLLEGE_OPTIONS, YEAR_OPTIONS } from '../../constants/cabinetOptions';
import { cabinetRosterRepository } from '../../data/repos/cabinetRoster';
import { cabinetYearsRepository } from '../../data/repos/cabinetYears';
import { memberLookupRepository } from '../../data/repos/memberLookup';
import { photoRequestsRepository } from '../../data/repos/photoRequests';
import { useAuth } from '../../hooks/useAuth';
import { useCabinetYears } from '../../hooks/useCabinetYears';
import {
  CABINET_ROSTER_CATEGORIES,
  CabinetRosterCycle,
  CabinetRosterDraft,
  RosterDraftPatch,
  buildRosterPreflight,
  formatRosterYears,
  guessCategory,
  parseRosterPaste,
  planRosterFill,
  rosterLinkSuggestion,
  rosterPreflightLines,
  sortRosterDrafts,
} from '../../lib/cabinetRoster';
import { MemberOption, buildMemberNameIndex } from '../../lib/memberLinkMatching';
import { CabinetYear } from '../../types';

const fieldCls =
  'w-full rounded border bg-[var(--color-surface2)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] disabled:opacity-60';
const smallFieldCls =
  'w-full rounded border bg-[var(--color-surface2)] px-2 py-1.5 text-xs text-[var(--color-text)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] disabled:opacity-60';
const labelCls = 'mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.1em]';
const ghostBtn =
  'rounded border bg-transparent px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-surface2)] disabled:opacity-50';

type TextField = 'name' | 'role' | 'year' | 'college' | 'major' | 'pronouns' | 'favorite_snack' | 'fun_fact';

interface RosterRowProps {
  draft: CabinetRosterDraft;
  editable: boolean;
  busy: boolean;
  memberById: Map<string, MemberOption>;
  nameIndex: ReturnType<typeof buildMemberNameIndex>;
  claimedByOthers: ReadonlySet<string>;
  hasPhoto: boolean;
  onSave: (draft: CabinetRosterDraft, patch: RosterDraftPatch) => void;
  onRemove: (draft: CabinetRosterDraft) => void;
}

function RosterRow({ draft, editable, busy, memberById, nameIndex, claimedByOthers, hasPhoto, onSave, onRemove }: RosterRowProps) {
  const [values, setValues] = useState<Record<TextField, string>>(() => rowValues(draft));
  const [order, setOrder] = useState(String(draft.display_order));

  useEffect(() => {
    setValues(rowValues(draft));
    setOrder(String(draft.display_order));
  }, [draft]);

  function commit(field: TextField) {
    const next = values[field].trim();
    const current = (draft[field] ?? '').toString();
    if (next === current) return;
    if (field === 'role' && !next) {
      setValues((prev) => ({ ...prev, role: draft.role }));
      return;
    }
    // A renamed person must not keep the previous person's member link (or photo).
    const patch: RosterDraftPatch = { [field]: next || null } as RosterDraftPatch;
    if (field === 'role') patch.role = next;
    if (field === 'name' && draft.member_id) patch.member_id = null;
    onSave(draft, patch);
  }

  const setValue = (field: TextField) => (event: { target: { value: string } }) =>
    setValues((prev) => ({ ...prev, [field]: event.target.value }));

  const suggestion = rosterLinkSuggestion(draft, nameIndex, claimedByOthers);
  const filled = !!draft.name?.trim();

  return (
    <li className="rounded border p-4 border-[var(--color-border)]" data-testid="roster-row">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className={`${labelCls} text-text-muted`} htmlFor={`roster-role-${draft.id}`}>Position</label>
          <input id={`roster-role-${draft.id}`} className={`${smallFieldCls} border-[var(--color-border)]`} value={values.role} disabled={!editable || busy} onChange={setValue('role')} onBlur={() => commit('role')} />
        </div>
        <div>
          <label className={`${labelCls} text-text-muted`} htmlFor={`roster-name-${draft.id}`}>Name</label>
          <input id={`roster-name-${draft.id}`} className={`${smallFieldCls} border-[var(--color-border)]`} value={values.name} placeholder="Not filled yet" disabled={!editable || busy} onChange={setValue('name')} onBlur={() => commit('name')} />
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className={`${labelCls} text-text-muted`} htmlFor={`roster-category-${draft.id}`}>Board</label>
            <select id={`roster-category-${draft.id}`} className={`${smallFieldCls} border-[var(--color-border)]`} value={draft.category} disabled={!editable || busy} onChange={(event) => onSave(draft, { category: event.target.value })}>
              {CABINET_ROSTER_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div className="w-16">
            <label className={`${labelCls} text-text-muted`} htmlFor={`roster-order-${draft.id}`}>Order</label>
            <input
              id={`roster-order-${draft.id}`}
              type="number"
              className={`${smallFieldCls} border-[var(--color-border)]`}

              value={order}
              disabled={!editable || busy}
              onChange={(event) => setOrder(event.target.value)}
              onBlur={() => {
                const parsed = Number.parseInt(order, 10);
                if (Number.isNaN(parsed)) setOrder(String(draft.display_order));
                else if (parsed !== draft.display_order) onSave(draft, { display_order: parsed });
              }}
            />
          </div>
          {editable && (
            <button type="button" className="bg-transparent p-0 pb-2 text-[11px] font-semibold underline-offset-2 hover:underline text-text-secondary" disabled={busy} onClick={() => onRemove(draft)} aria-label={`Remove ${draft.role}`}>
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="mt-3">
        <span className={`${labelCls} text-text-muted`}>Member link</span>
        {filled ? (
          <MemberLinkPicker
            linkedMemberId={draft.member_id}
            linkedMember={draft.member_id ? memberById.get(draft.member_id) ?? null : null}
            suggestion={suggestion}
            busy={busy}
            disabledReason={editable ? null : 'Reopen the roster to change links.'}
            onLink={(member) => onSave(draft, { member_id: member.id })}
            onUnlink={() => onSave(draft, { member_id: null })}
          />
        ) : (
          <p className="text-xs text-text-muted">Fill in a name to link a member.</p>
        )}
        {draft.member_id && (
          <p className="mt-1 text-[11px] text-text-muted">
            {hasPhoto ? '📷 Approved photo available' : 'No approved photo yet (not required to publish).'}
          </p>
        )}
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-text-secondary">Profile details (public once published)</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {([
            ['year', 'Year', YEAR_OPTIONS],
            ['college', 'College', COLLEGE_OPTIONS],
            ['major', 'Major', undefined],
            ['pronouns', 'Pronouns', undefined],
            ['favorite_snack', 'Favorite snack', undefined],
            ['fun_fact', 'Fun fact', undefined],
          ] as const).map(([field, label, options]) => (
            <div key={field}>
              <label className={`${labelCls} text-text-muted`} htmlFor={`roster-${field}-${draft.id}`}>{label}</label>
              <input
                id={`roster-${field}-${draft.id}`}
                list={options ? `roster-${field}-options` : undefined}
                className={`${smallFieldCls} border-[var(--color-border)]`}

                value={values[field]}
                disabled={!editable || busy}
                onChange={setValue(field)}
                onBlur={() => commit(field)}
              />
            </div>
          ))}
        </div>
      </details>
    </li>
  );
}

function rowValues(draft: CabinetRosterDraft): Record<TextField, string> {
  return {
    name: draft.name ?? '',
    role: draft.role,
    year: draft.year ?? '',
    college: draft.college ?? '',
    major: draft.major ?? '',
    pronouns: draft.pronouns ?? '',
    favorite_snack: draft.favorite_snack ?? '',
    fun_fact: draft.fun_fact ?? '',
  };
}

function previousYear(years: CabinetYear[], target: CabinetYear | undefined) {
  if (!target) return null;
  return years
    .filter((year) => year.start_year < target.start_year)
    .sort((a, b) => b.start_year - a.start_year)[0] ?? null;
}

export default function AdminCabinetRollover() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const { cabinetYears, refreshCabinetYears } = useCabinetYears();
  const [cycles, setCycles] = useState<CabinetRosterCycle[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<CabinetRosterDraft[]>([]);
  const [directory, setDirectory] = useState<MemberOption[]>([]);
  const [avatars, setAvatars] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState(false);
  const [newYearId, setNewYearId] = useState('');
  const [sourceYearId, setSourceYearId] = useState<string>('auto');
  const [pasted, setPasted] = useState('');
  const [newRole, setNewRole] = useState('');
  const [publicRowCount, setPublicRowCount] = useState<number | null>(null);
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const [activateConfirmed, setActivateConfirmed] = useState(false);

  const cycle = useMemo(() => cycles.find((item) => item.id === cycleId) ?? null, [cycles, cycleId]);
  const cabinetYear = useMemo(() => cabinetYears.find((year) => year.id === cycle?.cabinet_year_id) ?? null, [cabinetYears, cycle]);
  const editable = cycle?.status === 'draft';
  const ordered = useMemo(() => sortRosterDrafts(drafts), [drafts]);
  const photoIds = useMemo(() => new Set(avatars.keys()), [avatars]);
  const preflight = useMemo(() => buildRosterPreflight(ordered, photoIds), [ordered, photoIds]);
  const memberById = useMemo(() => new Map(directory.map((member) => [member.id, member])), [directory]);
  const nameIndex = useMemo(() => buildMemberNameIndex(directory), [directory]);
  const linkedIds = useMemo(() => ordered.map((draft) => draft.member_id).filter((id): id is string => !!id), [ordered]);

  const loadCycles = useCallback(async () => {
    try {
      setCycles(await cabinetRosterRepository.listCycles());
    } catch (err) {
      console.error(err);
      toast.error('Failed to load Cabinet rosters.');
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
    photoRequestsRepository.getPublicMemberAvatars().then(setAvatars).catch(() => setAvatars(new Map()));
  }, []);

  // The roster the admin is looking at right now. Every async result is checked
  // against it, so a slow response for a roster they already left can never be
  // shown under (or written into) the one they opened next.
  const activeCycleRef = useRef<string | null>(null);

  useEffect(() => {
    activeCycleRef.current = cycleId;
  }, [cycleId]);

  function setDraftsFor(forCycleId: string, next: CabinetRosterDraft[] | ((current: CabinetRosterDraft[]) => CabinetRosterDraft[])) {
    if (activeCycleRef.current === forCycleId) setDrafts(next);
  }

  useEffect(() => {
    setPublishConfirmed(false);
    setActivateConfirmed(false);
    setPublicRowCount(null);
    setDrafts([]);
    if (!cycleId) return;
    let cancelled = false;
    cabinetRosterRepository.getDrafts(cycleId).then((loaded) => {
      if (!cancelled) setDrafts(loaded);
    }).catch((err) => {
      console.error(err);
      if (!cancelled) toast.error('Failed to load Cabinet positions.');
    });
    return () => {
      cancelled = true;
    };
  }, [cycleId]);

  const cycleStatus = cycle?.status;
  const cycleYearId = cycle?.cabinet_year_id;
  useEffect(() => {
    // A new status (locked, reopened, published) always needs a fresh confirmation.
    setPublishConfirmed(false);
    setActivateConfirmed(false);
    if (cycleStatus !== 'locked' || !cycleYearId) return;
    let cancelled = false;
    cabinetRosterRepository.countPublicRows(cycleYearId).then((count) => {
      if (!cancelled) setPublicRowCount(count);
    }).catch(() => {
      if (!cancelled) setPublicRowCount(null);
    });
    return () => {
      cancelled = true;
    };
  }, [cycleStatus, cycleYearId]);

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

  function invalidatePublicCabinet() {
    queryClient.invalidateQueries('cabinet-years');
    queryClient.invalidateQueries('cabinet-members');
    queryClient.invalidateQueries('cabinet-member-year-ids');
  }

  const usedYearIds = new Set(cycles.map((item) => item.cabinet_year_id));
  const availableYears = cabinetYears.filter((year) => !usedYearIds.has(year.id));
  const targetYear = cabinetYears.find((year) => year.id === newYearId);
  const autoSource = previousYear(cabinetYears, targetYear);

  function createCycle() {
    if (!targetYear) {
      toast.error('Choose a cabinet year.');
      return;
    }
    const source = sourceYearId === 'auto' ? autoSource?.id ?? null : sourceYearId === 'none' ? null : sourceYearId;
    return run(async () => {
      const result = await cabinetRosterRepository.createCycle({ cabinetYearId: targetYear.id, sourceCabinetYearId: source, userId });
      await loadCycles();
      setCycleId(result.cycle.id);
      toast.success(result.created
        ? `Draft created with ${result.positionsCopied} position${result.positionsCopied === 1 ? '' : 's'}. No people were copied.`
        : 'A roster already exists for this year; opened it.');
    }, 'Failed to start the Cabinet draft.');
  }

  function importRoster() {
    if (!cycle) return;
    const entries = parseRosterPaste(pasted);
    if (entries.length === 0) {
      toast.error('Paste at least one line like "Name, Role".');
      return;
    }
    return run(async () => {
      const plan = planRosterFill(ordered, entries, nameIndex);
      for (const update of plan.updates) {
        await cabinetRosterRepository.updateDraft(cycle.id, update.draftId, update.patch);
      }
      if (plan.inserts.length > 0) await cabinetRosterRepository.addDrafts(cycle.id, plan.inserts);
      setDraftsFor(cycle.id, await cabinetRosterRepository.getDrafts(cycle.id));
      setPasted('');
      toast.success(`Placed ${entries.length} ${entries.length === 1 ? 'person' : 'people'} (${plan.linked} linked${plan.inserts.length ? `, ${plan.inserts.length} new position${plan.inserts.length === 1 ? '' : 's'}` : ''}).`);
    }, 'Failed to place the roster.');
  }

  function saveDraft(draft: CabinetRosterDraft, patch: RosterDraftPatch) {
    if (!cycle) return;
    return run(async () => {
      await cabinetRosterRepository.updateDraft(cycle.id, draft.id, patch);
      setDraftsFor(cycle.id, (current) => current.map((item) => (item.id === draft.id ? { ...item, ...patch } : item)));
    }, 'Failed to save.');
  }

  function removeDraft(draft: CabinetRosterDraft) {
    if (!cycle) return;
    return run(async () => {
      await cabinetRosterRepository.removeDraft(cycle.id, draft.id);
      setDraftsFor(cycle.id, (current) => current.filter((item) => item.id !== draft.id));
    }, 'Failed to remove.');
  }

  function addPosition() {
    if (!cycle || !newRole.trim()) return;
    return run(async () => {
      const role = newRole.trim();
      const order = ordered.reduce((max, draft) => Math.max(max, draft.display_order), -1) + 1;
      const created = await cabinetRosterRepository.addDrafts(cycle.id, [{ role, category: guessCategory(role), display_order: order }]);
      setDraftsFor(cycle.id, (current) => [...current, ...created]);
      setNewRole('');
    }, 'Failed to add the position.');
  }

  async function refreshCycle() {
    if (!cycle) return;
    const fresh = await cabinetRosterRepository.getCycle(cycle.id);
    setCycles((current) => current.map((item) => (item.id === fresh.id ? fresh : item)));
    setDraftsFor(cycle.id, await cabinetRosterRepository.getDrafts(cycle.id));
  }

  function lock() {
    if (!cycle) return;
    return run(async () => {
      await cabinetRosterRepository.lockCycle(cycle.id);
      await refreshCycle();
      toast.success('Locked. The roster is still private.');
    }, 'Failed to lock.');
  }

  function reopen() {
    if (!cycle) return;
    return run(async () => {
      await cabinetRosterRepository.reopenCycle(cycle.id);
      await refreshCycle();
    }, 'Failed to reopen.');
  }

  function publish() {
    if (!cycle) return;
    return run(async () => {
      const result = await cabinetRosterRepository.publishCycle(cycle.id);
      await refreshCycle();
      invalidatePublicCabinet();
      toast.success(result.alreadyPublished ? 'Already published.' : `Published: ${result.created} added, ${result.updated} updated.`);
    }, 'Failed to publish. Nothing was lost; fix the issue and publish again.');
  }

  function activate() {
    if (!cycle || !cabinetYear) return;
    return run(async () => {
      await cabinetYearsRepository.setActiveYear(cabinetYear.id);
      await refreshCabinetYears();
      invalidatePublicCabinet();
      toast.success(`${cabinetYear.label} is now the active Cabinet.`);
      setActivateConfirmed(false);
    }, 'Failed to activate the Cabinet year.');
  }

  function discard() {
    if (!cycle || !window.confirm('Delete this draft roster? This cannot be undone.')) return;
    return run(async () => {
      await cabinetRosterRepository.deleteCycle(cycle.id);
      setCycleId(null);
      await loadCycles();
    }, 'Failed to delete.');
  }

  const yearLabel = formatRosterYears(cabinetYear);

  return (
    <>
      <PageTitle title="Cabinet Rollover" />
      <Toaster position="top-right" />
      <datalist id="roster-year-options">{YEAR_OPTIONS.map((option) => <option key={option} value={option} />)}</datalist>
      <datalist id="roster-college-options">{COLLEGE_OPTIONS.map((option) => <option key={option} value={option} />)}</datalist>

      <div className="border-b px-6 py-6 sm:px-8 sm:py-8 border-[var(--color-border)] bg-surface">
        <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl text-text-primary">Cabinet Rollover</h1>
        <p className="mt-2 max-w-3xl font-sans text-sm leading-relaxed text-text-secondary">
          Prepare next year&apos;s Cabinet privately: copy last year&apos;s positions (never its people), paste the new roster, link members, resolve warnings, lock, then publish. Publishing never makes a year the current Cabinet; activating is its own step.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link to="/admin/cabinet" className="rounded border px-2 py-1 font-semibold text-[var(--brand)] hover:bg-[var(--color-surface2)] border-[var(--color-border)]">Cabinet admin</Link>
          <Link to="/admin/year-setup" className="rounded border px-2 py-1 font-semibold text-[var(--brand)] hover:bg-[var(--color-surface2)] border-[var(--color-border)]">New Year Setup</Link>
          <Link to="/admin/interns" className="rounded border px-2 py-1 font-semibold text-[var(--brand)] hover:bg-[var(--color-surface2)] border-[var(--color-border)]">Intern cohort</Link>
        </div>
      </div>

      {!cycle ? (
        <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-2 lg:p-8">
          <section className="scrapbook-paper p-6 border-[var(--color-border)] bg-surface">
            <h2 className="font-serif text-xl font-bold text-text-primary">Rosters</h2>
            {loadingCycles ? (
              <p className="mt-4 text-sm text-text-muted">Loading…</p>
            ) : cycles.length === 0 ? (
              <p className="mt-4 text-sm text-text-muted">No Cabinet drafts yet. Start one to begin.</p>
            ) : (
              <ul className="mt-4 divide-y border-[var(--color-border)]">
                {cycles.map((item) => {
                  const year = cabinetYears.find((candidate) => candidate.id === item.cabinet_year_id);
                  return (
                    <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{formatRosterYears(year)} Cabinet</p>
                        <StatusBadge status={item.status} className="mt-1" />
                      </div>
                      <button type="button" className={`${ghostBtn} border-[var(--color-border)] text-text-primary`} onClick={() => setCycleId(item.id)}>Open</button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section className="scrapbook-paper p-6 border-[var(--color-border)] bg-surface">
            <h2 className="font-serif text-xl font-bold text-text-primary">Create Cabinet draft</h2>
            <label htmlFor="new-roster-year" className={`${labelCls} mt-4 text-text-muted`}>Cabinet year</label>
            <select id="new-roster-year" className={`${fieldCls} border-[var(--color-border)]`} value={newYearId} onChange={(event) => setNewYearId(event.target.value)}>
              <option value="">Choose a cabinet year…</option>
              {availableYears.map((year) => (
                <option key={year.id} value={year.id}>{year.label}{year.is_active ? ' (active)' : ''}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-text-muted">
              Missing the year? <Link to="/admin/year-setup" className="font-semibold text-[var(--brand)] hover:underline">Start a new year</Link> creates it (inactive).
            </p>
            <label htmlFor="roster-source-year" className={`${labelCls} mt-4 text-text-muted`}>Copy position structure from</label>
            <select id="roster-source-year" className={`${fieldCls} border-[var(--color-border)]`} value={sourceYearId} onChange={(event) => setSourceYearId(event.target.value)}>
              <option value="auto">{autoSource ? `Previous year (${autoSource.label})` : 'Previous year (none found)'}</option>
              {cabinetYears.filter((year) => year.id !== newYearId).map((year) => (
                <option key={year.id} value={year.id}>{year.label}</option>
              ))}
              <option value="none">Start empty</option>
            </select>
            <p className="mt-1 text-[11px] text-text-muted">Copies role, board, and order only. Names, member links, photos, and bios are never copied.</p>
            <button type="button" className="vsa-btn-primary mt-4 px-5 py-2 text-xs disabled:opacity-50" disabled={busy || !newYearId} onClick={createCycle}>
              {targetYear ? `Create ${formatRosterYears(targetYear)} Cabinet Draft` : 'Create Cabinet Draft'}
            </button>
          </section>
        </div>
      ) : (
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <button type="button" onClick={() => setCycleId(null)} disabled={busy} className="mb-2 bg-transparent p-0 text-xs font-semibold underline-offset-2 hover:underline disabled:opacity-50 text-text-secondary">← All rosters</button>
              <h2 className="font-serif text-2xl font-bold text-text-primary">{yearLabel} Cabinet</h2>
              <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
                <StatusBadge status={cycle.status} />
                <span>{cabinetYear?.is_active ? 'Active Cabinet year' : 'Not the active Cabinet year'}</span>
              </div>
              <p className="mt-2 font-mono text-sm text-text-primary" data-testid="roster-counts">
                {preflight.positions} positions · {preflight.linked} member links · {preflight.needReview} need review · {preflight.photosAvailable} photos available
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {cycle.status === 'draft' && (
                <>
                  <button type="button" className={`${ghostBtn} border-[var(--color-border)] text-text-secondary`} disabled={busy} onClick={discard}>Delete draft</button>
                  <button type="button" className="vsa-btn-primary px-5 py-2 text-xs disabled:opacity-50" disabled={busy || !preflight.canLock} onClick={lock}>Lock roster</button>
                </>
              )}
              {cycle.status === 'locked' && (
                <button type="button" className={`${ghostBtn} border-[var(--color-border)] text-text-secondary`} disabled={busy} onClick={reopen}>Reopen draft</button>
              )}
            </div>
          </div>

          {cycle.status === 'locked' && (
            <div className="rounded border p-3 text-xs border-[var(--color-border)] bg-surface2 text-text-secondary">
              <p className="font-semibold text-text-primary">Locked — still private.</p>
              <p className="mt-1">
                Publishing adds or updates {preflight.positions} position{preflight.positions === 1 ? '' : 's'} for {yearLabel}, which then appears in the public Cabinet year picker. Positions already published are updated, not duplicated. It does not make {yearLabel} the current Cabinet.
                {publicRowCount ? ` This year already has ${publicRowCount} public ${publicRowCount === 1 ? 'row' : 'rows'}; matching people are updated and any others are left untouched.` : ''}
              </p>
              <label className="mt-3 flex cursor-pointer select-none items-start gap-2">
                <input type="checkbox" checked={publishConfirmed} onChange={(event) => setPublishConfirmed(event.target.checked)} className="mt-0.5 cursor-pointer rounded border-[var(--color-border)] bg-transparent text-[var(--brand)] focus:ring-[var(--brand)]" />
                <span className="text-text-primary">I confirm: make this roster public.</span>
              </label>
              <button type="button" className="vsa-btn-primary mt-3 px-5 py-2 text-xs disabled:opacity-50" disabled={busy || !publishConfirmed} onClick={publish}>
                {busy ? 'Publishing…' : 'Publish roster'}
              </button>
            </div>
          )}

          {cycle.status === 'published' && (
            <div className="rounded border p-3 text-xs border-[var(--color-border)] bg-surface2 text-text-secondary">
              <p className="font-semibold text-text-primary">Published. Edit published people from Cabinet admin.</p>
              {cabinetYear?.is_active ? (
                <p className="mt-1">{cabinetYear.label} is the active Cabinet year.</p>
              ) : (
                <>
                  <p className="mt-1">Activating makes {yearLabel} the current Cabinet on the public Cabinet page and deactivates the current one. This is separate from publishing.</p>
                  <label className="mt-3 flex cursor-pointer select-none items-start gap-2">
                    <input type="checkbox" checked={activateConfirmed} onChange={(event) => setActivateConfirmed(event.target.checked)} className="mt-0.5 cursor-pointer rounded border-[var(--color-border)] bg-transparent text-[var(--brand)] focus:ring-[var(--brand)]" />
                    <span className="text-text-primary">I confirm: make {yearLabel} the active Cabinet.</span>
                  </label>
                  <button type="button" className="vsa-btn-primary mt-3 px-5 py-2 text-xs disabled:opacity-50" disabled={busy || !activateConfirmed} onClick={activate}>
                    Make {yearLabel} the active Cabinet
                  </button>
                </>
              )}
            </div>
          )}

          <PreflightSummary title="Cabinet preflight" lines={rosterPreflightLines(preflight)} emptyText="Add positions to run the preflight." />

          {editable && (
            <section className="scrapbook-paper p-5 border-[var(--color-border)] bg-surface" aria-label="Paste roster">
              <h3 className="font-serif text-lg font-bold text-text-primary">Paste the new roster</h3>
              <p className="mt-1 text-xs text-text-muted">One person per line as &quot;Name, Role&quot;. Each person fills the first empty position with that role (or adds a position). Exact, unambiguous names link to members automatically; everything else is left for you to review.</p>
              <label htmlFor="roster-paste" className="sr-only">Pasted roster</label>
              <textarea id="roster-paste" rows={6} className={`${fieldCls} mt-3 font-mono text-xs border-[var(--color-border)]`} value={pasted} onChange={(event) => setPasted(event.target.value)} placeholder={'Havyn Nguyen, Co-President\nApril Pham, Co-President'} />
              <button type="button" className="vsa-btn-primary mt-3 px-5 py-2 text-xs disabled:opacity-50" disabled={busy || !pasted.trim()} onClick={importRoster}>Place into roster</button>
            </section>
          )}

          <section aria-label="Positions">
            {ordered.length === 0 ? (
              <p className="rounded border px-5 py-10 text-center text-sm border-[var(--color-border)] text-text-muted">No positions yet. Add one below or paste a roster.</p>
            ) : (
              <ul className="space-y-3">
                {ordered.map((draft) => {
                  const claimedByOthers = new Set(linkedIds.filter((id) => id !== draft.member_id));
                  return (
                    <RosterRow
                      key={draft.id}
                      draft={draft}
                      editable={!!editable}
                      busy={busy}
                      memberById={memberById}
                      nameIndex={nameIndex}
                      claimedByOthers={claimedByOthers}
                      hasPhoto={!!draft.member_id && photoIds.has(draft.member_id)}
                      onSave={saveDraft}
                      onRemove={removeDraft}
                    />
                  );
                })}
              </ul>
            )}
            {editable && (
              <div className="mt-4 flex flex-wrap items-end gap-2">
                <div className="min-w-[220px] flex-1">
                  <label htmlFor="roster-new-role" className={`${labelCls} text-text-muted`}>Add a position</label>
                  <input id="roster-new-role" className={`${fieldCls} border-[var(--color-border)]`} value={newRole} onChange={(event) => setNewRole(event.target.value)} placeholder="e.g. Historian" />
                </div>
                <button type="button" className={`${ghostBtn} border-[var(--color-border)] text-text-primary`} disabled={busy || !newRole.trim()} onClick={addPosition}>Add position</button>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
