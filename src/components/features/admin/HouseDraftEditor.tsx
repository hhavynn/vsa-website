// Protected domain — House membership. Review/edit/preflight/lock/reveal for one
// persisted House assignment batch. Locking is private; only "Reveal" writes
// house_memberships, and it does so through the shared dated-membership writer.
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { houseAssignmentsRepository } from '../../../data/repos/houseAssignments';
import {
  HouseAssignmentBatch,
  HouseAssignmentDraft,
  HouseProfileLite,
  buildPreflight,
  computeHouseCounts,
  houseLabel,
  readPreferences,
  suggestBalancing,
} from '../../../lib/houseAssignmentDraft';
import type { BalanceSuggestion } from '../../../lib/houseAssignmentDraft';
import { HouseImportMember, getMemberName, normalizeHouseLookup } from '../../../lib/houseAssignmentImport';
import type { MemberYearMembership } from '../../../lib/houseMembershipIntervals';
import { formatAcademicYear } from '../../../lib/academicTerms';
import { MemberSearchSelect } from './MemberSearchSelect';

export interface HouseDraftEditorProps {
  batch: HouseAssignmentBatch;
  initialDrafts: HouseAssignmentDraft[];
  profiles: HouseProfileLite[];
  existingMemberships: Map<string, MemberYearMembership[]>;
  members: HouseImportMember[];
  userId: string | null;
  onBack: () => void;
  onBatchChanged: () => void;
  /** Called after a reveal so the parent can reload the members.house cache. */
  onPublished: () => void;
}

type RowFilter = 'all' | 'attention' | 'unassigned' | 'ambiguous' | 'unmatched' | 'duplicates';

const selectCls =
  'w-full rounded border bg-[var(--color-surface2)] px-2 py-1.5 text-xs text-[var(--color-text)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] disabled:opacity-60';
const ghostBtn =
  'rounded border bg-transparent px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-surface2)] disabled:opacity-50';
const labelCls = 'mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.1em]';

function statusTone(status: string) {
  if (status === 'match' || status === 'manual') return 'text-emerald-700 dark:text-emerald-400';
  if (status === 'review') return 'text-amber-700 dark:text-amber-400';
  if (status === 'unmatched') return 'text-zinc-500 dark:text-zinc-400';
  return 'text-red-600 dark:text-red-400';
}

function batchBadge(status: string) {
  if (status === 'published') return 'Revealed';
  if (status === 'locked') return 'Locked';
  if (status === 'archived') return 'Archived';
  return 'Draft';
}

export function HouseDraftEditor({
  batch: initialBatch,
  initialDrafts,
  profiles,
  existingMemberships,
  members,
  userId,
  onBack,
  onBatchChanged,
  onPublished,
}: HouseDraftEditorProps) {
  const [batch, setBatch] = useState(initialBatch);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<RowFilter>('all');
  const [search, setSearch] = useState('');
  const [revealConfirmed, setRevealConfirmed] = useState(false);
  const [addMemberId, setAddMemberId] = useState<string | null>(null);
  const [addHouseId, setAddHouseId] = useState('');

  const editable = batch.status === 'draft';
  const activeProfiles = useMemo(() => profiles.filter((profile) => profile.is_active), [profiles]);
  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, getMemberName(member)])),
    [members],
  );
  const houseIdByText = useMemo(() => {
    const map = new Map<string, string>();
    profiles.forEach((profile) => {
      [profile.house_key, profile.display_name].forEach((value) => map.set(normalizeHouseLookup(value), profile.id));
    });
    return map;
  }, [profiles]);

  const preflight = useMemo(
    () => buildPreflight(drafts, profiles, { effectiveStartDate: batch.effective_start_date, existingMemberships, memberNames }),
    [drafts, profiles, batch.effective_start_date, existingMemberships, memberNames],
  );
  const counts = useMemo(() => computeHouseCounts(drafts, profiles), [drafts, profiles]);
  const balance = useMemo(
    () => suggestBalancing(drafts, profiles, memberNames, (text) => houseIdByText.get(normalizeHouseLookup(text)) ?? null),
    [drafts, profiles, memberNames, houseIdByText],
  );

  const duplicateRowIds = useMemo(() => {
    const ids = new Set<string>();
    preflight.blockers.concat(preflight.warnings)
      .filter((issue) => issue.code === 'duplicate_member' || issue.code === 'conflicting_house')
      .forEach((issue) => issue.rowIds.forEach((id) => ids.add(id)));
    return ids;
  }, [preflight]);

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return drafts.filter((row) => {
      if (needle) {
        const name = ((row.member_id && memberNames.get(row.member_id)) || row.source_name).toLowerCase();
        if (!name.includes(needle) && !row.source_name.toLowerCase().includes(needle)) return false;
      }
      const noHouse = !row.house_profile_id && !row.source_house;
      switch (filter) {
        case 'unassigned': return noHouse;
        case 'ambiguous': return row.match_status === 'review';
        case 'unmatched': return !row.member_id;
        case 'duplicates': return duplicateRowIds.has(row.id);
        case 'attention':
          return noHouse || row.match_status === 'review' || !row.member_id || duplicateRowIds.has(row.id)
            || (!!row.house_profile_id && !profileById.get(row.house_profile_id)?.is_active);
        default: return true;
      }
    });
  }, [drafts, filter, search, memberNames, duplicateRowIds, profileById]);

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

  function patchLocal(rowId: string, patch: Partial<HouseAssignmentDraft>) {
    setDrafts((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function editRow(row: HouseAssignmentDraft, patch: Partial<HouseAssignmentDraft>, failure = 'Failed to update the row.') {
    return run(async () => {
      await houseAssignmentsRepository.updateDraft(batch.id, row.id, patch);
      patchLocal(row.id, patch);
    }, failure);
  }

  function setMember(row: HouseAssignmentDraft, memberId: string | null) {
    return editRow(row, memberId
      ? { member_id: memberId, match_status: 'manual', match_method: 'manual', match_score: null }
      : { member_id: null, match_status: 'unmatched', match_method: null, match_score: null });
  }

  function acceptSuggestion(suggestion: BalanceSuggestion) {
    const row = drafts.find((item) => item.id === suggestion.rowId);
    if (!row) return;
    return editRow(row, { house_profile_id: suggestion.toProfileId }, 'Failed to apply the suggestion.');
  }

  function removeRow(row: HouseAssignmentDraft) {
    return run(async () => {
      await houseAssignmentsRepository.removeDraft(batch.id, row.id);
      setDrafts((current) => current.filter((item) => item.id !== row.id));
    }, 'Failed to remove the row.');
  }

  function addPerson() {
    const member = addMemberId ? memberById.get(addMemberId) : null;
    if (!member) {
      toast.error('Choose a member to add.');
      return;
    }
    return run(async () => {
      const nextOrder = drafts.reduce((max, row) => Math.max(max, row.source_order), -1) + 1;
      const created = await houseAssignmentsRepository.addDraft(batch.id, {
        source_name: getMemberName(member),
        source_house: null,
        member_id: member.id,
        house_profile_id: addHouseId || null,
        match_status: 'manual',
        match_method: 'manual',
        notes: 'Added manually.',
        source_order: nextOrder,
      });
      setDrafts((current) => [...current, created]);
      setAddMemberId(null);
      setAddHouseId('');
    }, 'Failed to add the person.');
  }

  async function refreshBatch() {
    const fresh = await houseAssignmentsRepository.getBatch(batch.id);
    setBatch(fresh);
    onBatchChanged();
  }

  function lock() {
    return run(async () => {
      await houseAssignmentsRepository.lockBatch(batch.id, memberNames);
      await refreshBatch();
      toast.success('Locked. Nothing is public until you reveal.');
    }, 'Failed to lock.');
  }

  function reopen() {
    return run(async () => {
      await houseAssignmentsRepository.reopenBatch(batch.id);
      setRevealConfirmed(false);
      await refreshBatch();
      toast.success('Reopened for editing.');
    }, 'Failed to reopen.');
  }

  function reveal() {
    return run(async () => {
      const result = await houseAssignmentsRepository.publishBatch(batch.id, userId);
      await refreshBatch();
      setRevealConfirmed(false);
      toast.success(
        result.alreadyPublished
          ? 'Already revealed.'
          : `Revealed: ${result.applied} membership${result.applied === 1 ? '' : 's'} created${result.skipped ? `, ${result.skipped} already in place` : ''}.`,
      );
      onPublished();
    }, 'Failed to reveal. Nothing was lost; fix the issue and reveal again.');
  }

  function discard() {
    if (!window.confirm('Delete this draft? This cannot be undone.')) return;
    return run(async () => {
      await houseAssignmentsRepository.deleteBatch(batch.id);
      onBatchChanged();
      onBack();
    }, 'Failed to delete the draft.');
  }

  const toneBlock = 'rounded border p-3 text-xs';
  const imbalance = balance.imbalance;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="mb-2 bg-transparent p-0 text-xs font-semibold underline-offset-2 hover:underline" style={{ color: 'var(--color-text2)' }}>
            ← All drafts
          </button>
          <h2 className="font-serif text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            {formatAcademicYear(batch.academic_year_start)} House assignments
          </h2>
          <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
            {batchBadge(batch.status)} · effective {batch.effective_start_date}
            {batch.source_label ? ` · ${batch.source_label}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {batch.status === 'draft' && (
            <>
              <button type="button" onClick={discard} disabled={busy} className={ghostBtn} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
                Delete draft
              </button>
              <button type="button" onClick={lock} disabled={busy || !preflight.canLock} className="vsa-btn-primary px-5 py-2 text-xs disabled:opacity-50">
                Lock assignments
              </button>
            </>
          )}
          {batch.status === 'locked' && (
            <button type="button" onClick={reopen} disabled={busy} className={ghostBtn} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
              Reopen draft
            </button>
          )}
        </div>
      </div>

      {batch.status === 'locked' && (
        <div className={toneBlock} style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text2)' }}>
          <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Locked — still private.</p>
          <p className="mt-1">
            Revealing creates {preflight.assigned} dated House membership{preflight.assigned === 1 ? '' : 's'} starting {batch.effective_start_date} and refreshes the legacy House label on each member. Earlier event attendance keeps individual points but does not earn House points.
          </p>
          <label className="mt-3 flex cursor-pointer select-none items-start gap-2">
            <input
              type="checkbox"
              checked={revealConfirmed}
              onChange={(event) => setRevealConfirmed(event.target.checked)}
              className="mt-0.5 cursor-pointer rounded border-[var(--color-border)] bg-transparent text-[var(--brand)] focus:ring-[var(--brand)]"
            />
            <span style={{ color: 'var(--color-text)' }}>
              I confirm: reveal these {preflight.assigned} assignments for {formatAcademicYear(batch.academic_year_start)}.
            </span>
          </label>
          <button type="button" onClick={reveal} disabled={busy || !revealConfirmed || preflight.blockers.length > 0} className="vsa-btn-primary mt-3 px-5 py-2 text-xs disabled:opacity-50">
            {busy ? 'Revealing…' : 'Reveal House assignments'}
          </button>
        </div>
      )}
      {batch.status === 'published' && (
        <div className={toneBlock} style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text2)' }}>
          Revealed {batch.published_at ? new Date(batch.published_at).toLocaleString() : ''}. This batch is read-only.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="scrapbook-paper p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} aria-label="House counts">
          <h3 className="font-serif text-lg font-bold" style={{ color: 'var(--color-text)' }}>House counts</h3>
          <dl className="mt-3 space-y-1.5 font-mono text-sm">
            {counts.perHouse.map((entry) => (
              <div key={entry.profileId} className="flex justify-between gap-4" data-testid={`house-count-${entry.label}`}>
                <dt style={{ color: 'var(--color-text2)' }}>{entry.label}</dt>
                <dd style={{ color: 'var(--color-text)' }}>{entry.count}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t pt-1.5" style={{ borderColor: 'var(--color-border)' }} data-testid="house-count-Unassigned">
              <dt style={{ color: 'var(--color-text2)' }}>Unassigned</dt>
              <dd style={{ color: 'var(--color-text)' }}>{counts.unassigned}</dd>
            </div>
          </dl>
          {counts.needsMember > 0 && (
            <p className="mt-2 text-xs" style={{ color: 'var(--color-text3)' }}>
              {counts.needsMember} more row{counts.needsMember === 1 ? ' has' : 's have'} a House but no confirmed member yet.
            </p>
          )}
        </section>

        <section className="scrapbook-paper p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} aria-label="Preflight">
          <h3 className="font-serif text-lg font-bold" style={{ color: 'var(--color-text)' }}>Preflight</h3>
          <ul className="mt-3 space-y-1 text-sm" style={{ color: 'var(--color-text)' }}>
            <li>✓ {preflight.applicants} applicants</li>
            <li>✓ {preflight.assigned} assigned</li>
          </ul>
          {preflight.blockers.length > 0 && (
            <div className="mt-3">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-red-600 dark:text-red-400">Blocking</p>
              <ul className="mt-1 space-y-1 text-xs text-red-600 dark:text-red-400">
                {preflight.blockers.map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>✕ {issue.message}</li>
                ))}
              </ul>
            </div>
          )}
          {preflight.warnings.length > 0 && (
            <div className="mt-3">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>Needs attention</p>
              <ul className="mt-1 space-y-1 text-xs text-amber-700 dark:text-amber-400">
                {preflight.warnings.map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>⚠ {issue.message}</li>
                ))}
              </ul>
            </div>
          )}
          {preflight.blockers.length === 0 && preflight.warnings.length === 0 && (
            <p className="mt-3 text-xs" style={{ color: 'var(--color-text3)' }}>Nothing needs attention.</p>
          )}
        </section>
      </div>

      <section className="scrapbook-paper p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} aria-label="Balance helper">
        <h3 className="font-serif text-lg font-bold" style={{ color: 'var(--color-text)' }}>Balance helper</h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>
          Suggestions only. Nobody moves until you accept it.
        </p>
        {imbalance ? (
          <p className="mt-3 text-sm" style={{ color: 'var(--color-text)' }}>
            {imbalance.largest.label} has {imbalance.gap} more member{imbalance.gap === 1 ? '' : 's'} than {imbalance.smallest.label}.
          </p>
        ) : (
          <p className="mt-3 text-sm" style={{ color: 'var(--color-text)' }}>The Houses are evenly sized.</p>
        )}
        {balance.unassigned.length > 0 && (
          <p className="mt-2 text-xs" style={{ color: 'var(--color-text2)' }}>
            Unassigned: {balance.unassigned.map((row) => (row.member_id && memberNames.get(row.member_id)) || row.source_name).join(', ')}
          </p>
        )}
        {!balance.hasPreferences ? (
          <p className="mt-2 text-xs" style={{ color: 'var(--color-text3)' }}>
            This sheet has no House preferences, so there are no suggestions. Move people by hand in the table below.
          </p>
        ) : balance.suggestions.length === 0 ? (
          <p className="mt-2 text-xs" style={{ color: 'var(--color-text3)' }}>No preference-based moves would improve balance.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {balance.suggestions.map((suggestion) => (
              <li key={suggestion.rowId} className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-xs" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                    {suggestion.name} → {houseLabel(profileById.get(suggestion.toProfileId) as HouseProfileLite)}
                  </p>
                  <p style={{ color: 'var(--color-text3)' }}>Reason: {suggestion.reason}</p>
                </div>
                <button type="button" disabled={busy || !editable} onClick={() => acceptSuggestion(suggestion)} className={ghostBtn} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                  Accept
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="scrapbook-paper overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} aria-label="Assignment rows">
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-end sm:justify-between" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="font-serif text-lg font-bold" style={{ color: 'var(--color-text)' }}>Rows</h3>
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search rows…"
              aria-label="Search rows"
              className="rounded border px-2 py-1.5 text-xs"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text)' }}
            />
            <select value={filter} onChange={(event) => setFilter(event.target.value as RowFilter)} aria-label="Filter rows" className={`${selectCls} w-auto`} style={{ borderColor: 'var(--color-border)' }}>
              <option value="all">All rows</option>
              <option value="attention">Needs attention</option>
              <option value="unassigned">Unassigned</option>
              <option value="ambiguous">Ambiguous matches</option>
              <option value="unmatched">No member</option>
              <option value="duplicates">Duplicates</option>
            </select>
          </div>
        </div>

        {editable && (
          <div className="flex flex-wrap items-end gap-3 border-b px-5 py-3" style={{ borderColor: 'var(--color-border)' }}>
            <div className="min-w-[240px] flex-1">
              <span className={labelCls} style={{ color: 'var(--color-text3)' }}>Add someone manually</span>
              <MemberSearchSelect members={members} value={addMemberId} onChange={setAddMemberId} label="new row" disabled={busy} />
            </div>
            <div className="min-w-[160px]">
              <label htmlFor="add-house" className={labelCls} style={{ color: 'var(--color-text3)' }}>House</label>
              <select id="add-house" value={addHouseId} onChange={(event) => setAddHouseId(event.target.value)} className={selectCls} style={{ borderColor: 'var(--color-border)' }}>
                <option value="">Unassigned</option>
                {activeProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{houseLabel(profile)}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={addPerson} disabled={busy || !addMemberId} className={ghostBtn} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              Add
            </button>
          </div>
        )}

        {visibleRows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm" style={{ color: 'var(--color-text3)' }}>No rows match this filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b bg-[var(--color-surface2)]" style={{ borderColor: 'var(--color-border)' }}>
                  {['Sheet entry', 'Member', 'House', 'Match', ''].map((heading) => (
                    <th key={heading || 'actions'} className="px-4 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {visibleRows.map((row) => {
                  const profile = row.house_profile_id ? profileById.get(row.house_profile_id) : null;
                  const brokenHouse = (!!row.house_profile_id && !profile?.is_active) || (!row.house_profile_id && !!row.source_house);
                  const prefs = readPreferences(row.preferences);
                  return (
                    <tr key={row.id} data-testid="house-draft-row">
                      <td className="px-4 py-3 align-top">
                        <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text)' }}>{row.source_name || '—'}</p>
                        {prefs.length > 0 && <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-text3)' }}>Prefers: {prefs.join(' › ')}</p>}
                        {duplicateRowIds.has(row.id) && <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">Duplicate member</p>}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <MemberSearchSelect
                          members={members}
                          value={row.member_id}
                          onChange={(memberId) => setMember(row, memberId)}
                          disabled={busy || !editable}
                          label={row.source_name}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <select
                          value={row.house_profile_id ?? ''}
                          disabled={busy || !editable}
                          onChange={(event) => editRow(row, { house_profile_id: event.target.value || null })}
                          aria-label={`House for ${row.source_name}`}
                          className={selectCls}
                          style={{ borderColor: 'var(--color-border)' }}
                        >
                          <option value="">Unassigned</option>
                          {activeProfiles.map((option) => (
                            <option key={option.id} value={option.id}>{houseLabel(option)}</option>
                          ))}
                        </select>
                        {brokenHouse && (
                          <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                            {row.source_house ? `"${row.source_house}" has no profile this year.` : 'House profile unavailable.'}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className={`font-mono text-[11px] font-bold uppercase ${statusTone(row.match_status)}`}>{row.match_status}</p>
                        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-text3)' }}>
                          {row.match_method && row.match_score != null ? `${row.match_score}% ${row.match_method}` : row.match_method ?? ''}
                        </p>
                        {row.notes && <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-text3)' }}>{row.notes}</p>}
                        {editable && row.match_status === 'review' && row.member_id && (
                          <button type="button" disabled={busy} onClick={() => editRow(row, { match_status: 'manual' })} className="mt-1 bg-transparent p-0 text-[11px] font-semibold underline-offset-2 hover:underline" style={{ color: 'var(--brand)' }}>
                            Confirm match
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        {editable && (
                          <button type="button" disabled={busy} onClick={() => removeRow(row)} aria-label={`Remove ${row.source_name}`} className="bg-transparent p-0 text-[11px] font-semibold underline-offset-2 hover:underline" style={{ color: 'var(--color-text2)' }}>
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
