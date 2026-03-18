import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AdminNav } from '../../components/features/admin/AdminNav';
import toast, { Toaster } from 'react-hot-toast';
import { OFFICIAL_YEARS } from '../../lib/yearNormalizer';
import { usePagination } from '../../hooks/usePagination';
import { PaginationControls } from '../../components/common/PaginationControls';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  college: string | null;
  year: string | null;
  email: string | null;
  points: number;
  events_attended: number;
  created_at: string;
  needs_review?: boolean;
}

interface AttendanceRecord {
  event_id: string;
  event_name: string;
  event_date: string;
  points_earned: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLLEGE_OPTIONS = [
  { value: 'revelle',  label: 'Revelle' },
  { value: 'muir',     label: 'Muir' },
  { value: 'marshall', label: 'Marshall' },
  { value: 'warren',   label: 'Warren' },
  { value: 'erc',      label: 'ERC (Eleanor Roosevelt)' },
  { value: 'sixth',    label: 'Sixth' },
  { value: 'seventh',  label: 'Seventh' },
  { value: 'eighth',   label: 'Eighth' },
];

function toCollegeKey(s: string): string {
  const t = s.toLowerCase();
  if (/revelle/.test(t))               return 'revelle';
  if (/muir/.test(t))                  return 'muir';
  if (/marshall|thurgood/.test(t))     return 'marshall';
  if (/warren/.test(t))                return 'warren';
  if (/eleanor|erc|roosevelt/.test(t)) return 'erc';
  if (/sixth|6th/.test(t))             return 'sixth';
  if (/seventh|7th/.test(t))           return 'seventh';
  if (/eighth|8th/.test(t))            return 'eighth';
  return s;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [showReviewOnly, setShowReviewOnly] = useState(false);

  // Sorting
  type SortKey = 'name' | 'points' | 'events_attended';
  const [sortKey, setSortKey] = useState<SortKey>('points');
  const [sortAsc, setSortAsc] = useState(false);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(key === 'name'); }
  }

  // Multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulk, setConfirmBulk]   = useState(false);

  // Edit modal
  const [editing, setEditing]   = useState<Member | null>(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', college: '', year: '', email: '' });
  const [saving, setSaving]     = useState(false);

  // Single delete modal
  const [deleting, setDeleting]     = useState<Member | null>(null);
  const [confirming, setConfirming] = useState(false);

  // History modal
  const [historyMember, setHistoryMember]   = useState<Member | null>(null);
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Merge modal
  const [mergingSource, setMergingSource]   = useState<Member | null>(null);
  const [mergeTarget, setMergeTarget]       = useState<Member | null>(null);
  const [mergeSearch, setMergeSearch]       = useState('');
  const [mergeConfirming, setMergeConfirming] = useState(false);
  const [mergeExecuting, setMergeExecuting] = useState(false);

  // ── Load ─────────────────────────────────────────────────────────────────────
  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('members')
      .select('id, first_name, last_name, college, year, email, points, events_attended, created_at, needs_review')
      .order('points', { ascending: false });
    if (error) toast.error('Failed to load members.');
    setMembers((data ?? []) as Member[]);
    setSelected(new Set());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // ── Filtered + sorted ────────────────────────────────────────────────────────
  const filtered = members
    .filter(m => showReviewOnly ? m.needs_review : true)
    .filter(m => {
      const q = search.toLowerCase();
      return (
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
        (m.college ?? '').toLowerCase().includes(q) ||
        (m.year ?? '').toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') {
        cmp = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      } else if (sortKey === 'points') {
        cmp = a.points - b.points;
      } else {
        cmp = a.events_attended - b.events_attended;
      }
      return sortAsc ? cmp : -cmp;
    });

  // ── Pagination ───────────────────────────────────────────────────────────────
  const resetKey = `${search}|${showReviewOnly}|${sortKey}|${sortAsc}`;
  const {
    page, totalPages, rowsPerPage, setRowsPerPage, setCurrentPage,
    pageStart, pageStartLabel, pageEndLabel,
    paginatedData: paginatedFiltered,
  } = usePagination(filtered, { defaultRowsPerPage: 25, resetKey });

  // ── Selection ────────────────────────────────────────────────────────────────
  const allFilteredIds = filtered.map(m => m.id);
  const allSelected    = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id));
  const someSelected   = allFilteredIds.some(id => selected.has(id));

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(Array.from(prev));
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(Array.from(prev));
        allFilteredIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelected(prev => new Set([...Array.from(prev), ...allFilteredIds]));
    }
  }

  // ── Edit ─────────────────────────────────────────────────────────────────────
  function openEdit(m: Member) {
    setEditing(m);
    setEditForm({
      first_name: m.first_name,
      last_name:  m.last_name,
      college:    m.college ? toCollegeKey(m.college) : '',
      year:       m.year    ?? '',
      email:      m.email   ?? '',
    });
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from('members')
      .update({
        first_name: editForm.first_name.trim(),
        last_name:  editForm.last_name.trim(),
        college:    editForm.college.trim() || null,
        year:       editForm.year.trim()    || null,
        email:      editForm.email.trim()   || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editing.id);
    setSaving(false);
    if (error) { toast.error('Failed to save changes.'); return; }
    toast.success('Member updated.');
    setEditing(null);
    load();
  }

  // ── Single delete ─────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleting) return;
    setConfirming(true);
    const { error } = await supabase.from('members').delete().eq('id', deleting.id);
    setConfirming(false);
    if (error) { toast.error('Failed to delete member.'); return; }
    toast.success(`${deleting.first_name} ${deleting.last_name} removed.`);
    setDeleting(null);
    load();
  }

  // ── Unflag (Clear Review) ───────────────────────────────────────────────────
  async function handleUnflag(m: Member) {
    const { error } = await supabase.from('members').update({ needs_review: false }).eq('id', m.id);
    if (error) { toast.error('Failed to clear review flag.'); return; }
    toast.success(`Cleared review flag for ${m.first_name} ${m.last_name}.`);
    load();
  }

  // ── Bulk delete ───────────────────────────────────────────────────────────────
  async function handleBulkDelete() {
    setBulkDeleting(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from('members').delete().in('id', ids);
    setBulkDeleting(false);
    if (error) { toast.error('Bulk delete failed.'); return; }
    toast.success(`Removed ${ids.length} member${ids.length !== 1 ? 's' : ''}.`);
    setConfirmBulk(false);
    load();
  }

  // ── History ───────────────────────────────────────────────────────────────────
  async function openHistory(m: Member) {
    setHistoryMember(m);
    setHistoryRecords([]);
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from('member_event_attendance')
      .select('event_id, points_earned, events(name, date)')
      .eq('member_id', m.id);
    setHistoryLoading(false);
    if (error) { toast.error('Failed to load history.'); return; }
    const records = ((data ?? []) as any[])
      .map(row => ({
        event_id:      row.event_id as string,
        event_name:    (row.events?.name  ?? '(unknown)') as string,
        event_date:    (row.events?.date  ?? '') as string,
        points_earned: row.points_earned as number,
      }))
      .sort((a, b) => b.event_date.localeCompare(a.event_date));
    setHistoryRecords(records);
  }

  // ── Merge ─────────────────────────────────────────────────────────────────────
  function openMerge(m: Member) {
    setMergingSource(m);
    setMergeTarget(null);
    setMergeSearch('');
    setMergeConfirming(false);
  }

  async function handleMergeConfirm() {
    if (!mergingSource || !mergeTarget) return;
    setMergeExecuting(true);
    const { error } = await supabase.rpc('smart_merge_members', {
      p_source_id: mergingSource.id,
      p_target_id: mergeTarget.id,
    });
    setMergeExecuting(false);
    if (error) { toast.error(`Merge failed: ${error.message}`); return; }
    toast.success(`Merged ${mergingSource.first_name} ${mergingSource.last_name} → ${mergeTarget.first_name} ${mergeTarget.last_name}.`);
    setMergingSource(null);
    setMergeTarget(null);
    setMergeConfirming(false);
    load();
  }

  const selectedCount = selected.size;
  const needsReviewCount = members.filter(m => m.needs_review).length;

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <Toaster position="top-right" />
      <div className="max-w-6xl mx-auto">
        <AdminNav />

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Members</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                {members.length} total member{members.length !== 1 ? 's' : ''} — edit, merge duplicates, or view attendance history.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {selectedCount > 0 && (
                <button onClick={() => setConfirmBulk(true)}
                  className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                  Delete {selectedCount} selected
                </button>
              )}
              <input type="search" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, college, year, email…"
                className="w-64 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                  text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
          </div>

          {needsReviewCount > 0 && !loading && (
            <div className={`mb-6 p-4 rounded-lg border ${showReviewOnly ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' : 'bg-amber-100 border-amber-300 dark:bg-amber-900/40 dark:border-amber-700'} flex items-center justify-between flex-wrap gap-4`}>
              <div className="flex items-center gap-3">
                <span className="text-amber-600 dark:text-amber-400">⚠️</span>
                <p className="text-amber-800 dark:text-amber-200 text-sm font-medium">
                  {needsReviewCount} new member{needsReviewCount !== 1 ? 's were' : ' was'} added but may be duplicate{needsReviewCount !== 1 ? 's' : ''} of existing members.
                </p>
              </div>
              <button 
                onClick={() => setShowReviewOnly(!showReviewOnly)}
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                {showReviewOnly ? 'Show All Members' : 'Click here to review'}
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-gray-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              {search ? 'No members match your search.' : 'No members yet. Import a sign-in sheet to get started.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50">
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" checked={allSelected}
                        ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                        onChange={toggleAll}
                        className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">#</th>
                    <SortTh label="Name"   sk="name"            active={sortKey} asc={sortAsc} onSort={handleSort} />
                    <th className="px-4 py-3 w-32 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">College</th>
                    <th className="px-4 py-3 w-28 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Year</th>
                    <SortTh label="Points" sk="points"          active={sortKey} asc={sortAsc} onSort={handleSort} />
                    <SortTh label="Events" sk="events_attended" active={sortKey} asc={sortAsc} onSort={handleSort} />
                    <th className="px-4 py-3 w-56" />
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                  {paginatedFiltered.map((m, i) => {
                    const isChecked = selected.has(m.id);
                    return (
                      <tr key={m.id}
                        onClick={() => toggleOne(m.id)}
                        className={`transition-colors cursor-pointer ${
                          isChecked ? 'bg-indigo-50/60 dark:bg-indigo-900/20' : 'hover:bg-gray-50/60 dark:hover:bg-gray-700/30'
                        }`}>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={isChecked} onChange={() => toggleOne(m.id)}
                            className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs font-mono">{pageStart + i + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          <div className="truncate">{m.first_name} {m.last_name}</div>
                          {m.email && <div className="text-xs text-gray-400 font-normal truncate">{m.email}</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs truncate">{m.college || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs truncate">{m.year || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">{m.points}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{m.events_attended}</td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <ActionBtn color="indigo" onClick={() => openEdit(m)}>Edit</ActionBtn>
                            {m.needs_review && (
                              <ActionBtn color="green" onClick={() => handleUnflag(m)}>Review OK</ActionBtn>
                            )}
                            <ActionBtn color="teal"   onClick={() => openHistory(m)}>History</ActionBtn>
                            <ActionBtn color="amber"  onClick={() => openMerge(m)}>Merge</ActionBtn>
                            <ActionBtn color="red"    onClick={() => setDeleting(m)}>Delete</ActionBtn>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length > 0 && (
                <PaginationControls
                  page={page} totalPages={totalPages}
                  rowsPerPage={rowsPerPage} onPageChange={setCurrentPage} onRowsPerPageChange={setRowsPerPage}
                  pageStartLabel={pageStartLabel} pageEndLabel={pageEndLabel} totalCount={filtered.length}
                  theme="gray"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Bulk Delete Modal ── */}
      {confirmBulk && (
        <Modal onClose={() => setConfirmBulk(false)}>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Delete {selectedCount} member{selectedCount !== 1 ? 's' : ''}?
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">
            This permanently removes {selectedCount} member{selectedCount !== 1 ? 's' : ''} and all their attendance records. Cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={handleBulkDelete} disabled={bulkDeleting}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
              {bulkDeleting ? 'Deleting…' : `Yes, delete ${selectedCount}`}
            </button>
            <BtnCancel onClick={() => setConfirmBulk(false)} />
          </div>
        </Modal>
      )}

      {/* ── Edit Modal ── */}
      {editing && (
        <Modal onClose={() => setEditing(null)} wide>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Member</h2>
            <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <input value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Last name">
                <input value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} className={inputCls} />
              </Field>
            </div>

            <Field label="Email">
              <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                placeholder="optional — helps identify duplicates" className={inputCls} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="College">
                <select value={editForm.college} onChange={e => setEditForm(f => ({ ...f, college: e.target.value }))} className={inputCls}>
                  <option value="">— select —</option>
                  {COLLEGE_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Year">
                <select value={editForm.year} onChange={e => setEditForm(f => ({ ...f, year: e.target.value }))} className={inputCls}>
                  <option value="">— select —</option>
                  {OFFICIAL_YEARS.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Computed stats — read only */}
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 px-4 py-3">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Points (computed)</p>
                <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{editing.points}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Events attended (computed)</p>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{editing.events_attended}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={handleSaveEdit} disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <BtnCancel onClick={() => setEditing(null)} />
          </div>
        </Modal>
      )}

      {/* ── Single Delete Modal ── */}
      {deleting && (
        <Modal onClose={() => setDeleting(null)}>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete member?</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">
            Remove <strong className="text-gray-700 dark:text-gray-200">{deleting.first_name} {deleting.last_name}</strong> and
            all their attendance records? Cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={handleDelete} disabled={confirming}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
              {confirming ? 'Deleting…' : 'Yes, delete'}
            </button>
            <BtnCancel onClick={() => setDeleting(null)} />
          </div>
        </Modal>
      )}

      {/* ── History Modal ── */}
      {historyMember && (
        <Modal onClose={() => setHistoryMember(null)} wide>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {historyMember.first_name} {historyMember.last_name}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {historyMember.points} pts · {historyMember.events_attended} event{historyMember.events_attended !== 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={() => setHistoryMember(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
          </div>

          {historyLoading ? (
            <div className="py-8 text-center text-gray-400 text-sm">Loading…</div>
          ) : historyRecords.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">No attendance records found.</div>
          ) : (
            <div className="overflow-y-auto max-h-80 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {historyRecords.map(rec => (
                <div key={rec.event_id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{rec.event_name}</p>
                    <p className="text-xs text-gray-400">
                      {rec.event_date
                        ? new Date(rec.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">+{rec.points_earned} pts</span>
                </div>
              ))}
            </div>
          )}

          <button onClick={() => setHistoryMember(null)}
            className="mt-5 w-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium py-2.5 rounded-lg text-sm transition-colors">
            Close
          </button>
        </Modal>
      )}

      {/* ── Merge Modal ── */}
      {mergingSource && (
        <Modal onClose={() => setMergingSource(null)} wide>
          {!mergeConfirming ? (
            /* Phase 1: pick target */
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Merge Member</h2>
                <button onClick={() => setMergingSource(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Move all attendance records from{' '}
                <strong className="text-red-600 dark:text-red-400">{mergingSource.first_name} {mergingSource.last_name}</strong>
                {' '}into another member. The source will be deleted.
              </p>
              <input type="search" value={mergeSearch} onChange={e => setMergeSearch(e.target.value)}
                placeholder="Search for the member to merge INTO…"
                className={inputCls + ' mb-3'}
                autoFocus />
              <div className="overflow-y-auto max-h-64 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {members
                  .filter(m =>
                    m.id !== mergingSource.id &&
                    `${m.first_name} ${m.last_name} ${m.email ?? ''}`.toLowerCase().includes(mergeSearch.toLowerCase())
                  )
                  .map(m => (
                    <button key={m.id}
                      onClick={() => { setMergeTarget(m); setMergeConfirming(true); }}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-left transition-colors">
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {m.first_name} {m.last_name}
                        </span>
                        {m.email && <span className="ml-2 text-xs text-gray-400">{m.email}</span>}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0 ml-3">
                        {m.points} pts · {m.events_attended} events
                      </span>
                    </button>
                  ))}
              </div>
            </>
          ) : (
            /* Phase 2: confirm */
            <>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Confirm merge?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                <strong className="text-red-600 dark:text-red-400">{mergingSource.first_name} {mergingSource.last_name}</strong>
                {' '}({mergingSource.events_attended} record{mergingSource.events_attended !== 1 ? 's' : ''}) will be merged into{' '}
                <strong className="text-indigo-600 dark:text-indigo-400">{mergeTarget!.first_name} {mergeTarget!.last_name}</strong>.
              </p>
              <p className="text-xs text-gray-400 mb-5">
                Duplicate events are skipped. The source member is permanently deleted.
              </p>
              <div className="flex gap-3">
                <button onClick={handleMergeConfirm} disabled={mergeExecuting}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
                  {mergeExecuting ? 'Merging…' : 'Yes, merge'}
                </button>
                <BtnCancel onClick={() => setMergeConfirming(false)} label="Back" />
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

const inputCls = `w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
  text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent`;

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-gray-700 w-full ${wide ? 'max-w-lg' : 'max-w-sm'}`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function BtnCancel({ onClick, label = 'Cancel' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick}
      className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium py-2.5 rounded-lg text-sm transition-colors">
      {label}
    </button>
  );
}

function ActionBtn({ color, onClick, children }: { color: string; onClick: () => void; children: React.ReactNode }) {
  const cls: Record<string, string> = {
    indigo: 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30',
    green:  'text-green-600  dark:text-green-400  hover:bg-green-50  dark:hover:bg-green-900/30',
    teal:   'text-teal-600   dark:text-teal-400   hover:bg-teal-50   dark:hover:bg-teal-900/30',
    amber:  'text-amber-600  dark:text-amber-400  hover:bg-amber-50  dark:hover:bg-amber-900/30',
    red:    'text-red-500    dark:text-red-400    hover:bg-red-50    dark:hover:bg-red-900/30',
  };
  return (
    <button onClick={onClick}
      className={`text-xs font-medium px-2 py-1 rounded transition-colors ${cls[color]}`}>
      {children}
    </button>
  );
}

function SortTh({ label, sk, active, asc, onSort }: {
  label: string; sk: string; active: string; asc: boolean; onSort: (k: any) => void;
}) {
  const isActive = active === sk;
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
      <button onClick={() => onSort(sk)}
        className={`flex items-center gap-1 transition-colors ${
          isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
        }`}>
        {label}
        <span className="text-[10px] leading-none">{isActive ? (asc ? '▲' : '▼') : '⇅'}</span>
      </button>
    </th>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
