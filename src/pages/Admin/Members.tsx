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
  { value: 'revelle', label: 'Revelle' },
  { value: 'muir', label: 'Muir' },
  { value: 'marshall', label: 'Marshall' },
  { value: 'warren', label: 'Warren' },
  { value: 'erc', label: 'ERC (Eleanor Roosevelt)' },
  { value: 'sixth', label: 'Sixth' },
  { value: 'seventh', label: 'Seventh' },
  { value: 'eighth', label: 'Eighth' },
];

function toCollegeKey(s: string): string {
  const t = s.toLowerCase();
  if (/revelle/.test(t)) return 'revelle';
  if (/muir/.test(t)) return 'muir';
  if (/marshall|thurgood/.test(t)) return 'marshall';
  if (/warren/.test(t)) return 'warren';
  if (/eleanor|erc|roosevelt/.test(t)) return 'erc';
  if (/sixth|6th/.test(t)) return 'sixth';
  if (/seventh|7th/.test(t)) return 'seventh';
  if (/eighth|8th/.test(t)) return 'eighth';
  return s;
}

// ─── Year badge colours ───────────────────────────────────────────────────────

function yearBadgeCls(year: string | null) {
  const y = (year ?? '').toLowerCase();
  if (y.includes('fresh')) return 'bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-600';
  if (y.includes('soph')) return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
  if (y.includes('junior')) return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800';
  if (y.includes('senior')) return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
  return 'bg-zinc-100 text-zinc-500 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-600';
}

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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
  const [confirmBulk, setConfirmBulk] = useState(false);

  // Edit modal
  const [editing, setEditing] = useState<Member | null>(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', college: '', year: '', email: '' });
  const [saving, setSaving] = useState(false);

  // Single delete modal
  const [deleting, setDeleting] = useState<Member | null>(null);
  const [confirming, setConfirming] = useState(false);

  // History modal
  const [historyMember, setHistoryMember] = useState<Member | null>(null);
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Merge modal
  const [mergingSource, setMergingSource] = useState<Member | null>(null);
  const [mergeTarget, setMergeTarget] = useState<Member | null>(null);
  const [mergeSearch, setMergeSearch] = useState('');
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
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id));
  const someSelected = allFilteredIds.some(id => selected.has(id));

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
      last_name: m.last_name,
      college: m.college ? toCollegeKey(m.college) : '',
      year: m.year ?? '',
      email: m.email ?? '',
    });
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from('members')
      .update({
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        college: editForm.college.trim() || null,
        year: editForm.year.trim() || null,
        email: editForm.email.trim() || null,
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
        event_id: row.event_id as string,
        event_name: (row.events?.name ?? '(unknown)') as string,
        event_date: (row.events?.date ?? '') as string,
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

  // Stat card values
  const activeCount = members.filter(m => m.events_attended > 0).length;
  const avgAttendance = members.length
    ? (members.reduce((s, m) => s + m.events_attended, 0) / members.length).toFixed(1)
    : '—';

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="py-6">
      <Toaster position="top-right" />

        {/* PAGE HEADER */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[24px] font-bold text-[#09090b] dark:text-[#fafafa]">Members</h1>
          <button
            onClick={() => {
              const rows = [
                ['First Name', 'Last Name', 'Email', 'Year', 'College', 'Points', 'Events'],
                ...members.map(m => [m.first_name, m.last_name, m.email ?? '', m.year ?? '', m.college ?? '', m.points, m.events_attended]),
              ];
              const csv = rows.map(r => r.join(',')).join('\n');
              const a = document.createElement('a');
              a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
              a.download = 'vsa-members.csv';
              a.click();
            }}
            className="h-9 px-4 text-[13px] font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-[#27272a] rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Export CSV
          </button>
        </div>

        {/* STAT CARDS */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="border border-zinc-200 dark:border-[#27272a] rounded-md px-4 py-3 bg-white dark:bg-[#18181b]">
              <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide mb-1">Total Members</p>
              <p className="text-[28px] font-bold text-zinc-900 dark:text-zinc-50 leading-none">{members.length}</p>
            </div>
            <div className="border border-zinc-200 dark:border-[#27272a] rounded-md px-4 py-3 bg-white dark:bg-[#18181b]">
              <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide mb-1">Active This Semester</p>
              <p className="text-[28px] font-bold text-zinc-900 dark:text-zinc-50 leading-none">{activeCount}</p>
            </div>
            <div className="border border-zinc-200 dark:border-[#27272a] rounded-md px-4 py-3 bg-white dark:bg-[#18181b]">
              <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide mb-1">Points Leaders</p>
              <a href="/admin/points" className="text-[13px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                View Top 10 →
              </a>
            </div>
            <div className="border border-zinc-200 dark:border-[#27272a] rounded-md px-4 py-3 bg-white dark:bg-[#18181b]">
              <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide mb-1">Avg Attendance</p>
              <p className="text-[28px] font-bold text-zinc-900 dark:text-zinc-50 leading-none">{avgAttendance}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">events/member</p>
            </div>
          </div>
        )}

        {/* REVIEW BANNER */}
        {needsReviewCount > 0 && !loading && (
          <div className={`mb-4 px-4 py-3 rounded-md border flex items-center justify-between gap-4 ${showReviewOnly
              ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
              : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
            }`}>
            <p className="text-[13px] font-medium text-amber-800 dark:text-amber-200">
              ⚠ {needsReviewCount} member{needsReviewCount !== 1 ? 's' : ''} flagged as possible duplicate{needsReviewCount !== 1 ? 's' : ''}
            </p>
            <button
              onClick={() => setShowReviewOnly(!showReviewOnly)}
              className="text-[12px] font-medium text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 px-3 py-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors shrink-0"
            >
              {showReviewOnly ? 'Show all' : 'Review now'}
            </button>
          </div>
        )}

        {/* TOOLBAR */}
        <div className="flex items-center justify-between mt-2 mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 w-3.5 h-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search members…"
                className="h-9 w-64 pl-8 pr-3 text-[13px] border border-zinc-200 dark:border-[#27272a] rounded-md bg-white dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition"
              />
            </div>
          </div>
          {selectedCount > 0 && (
            <button
              onClick={() => setConfirmBulk(true)}
              className="h-9 px-4 text-[13px] font-medium bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
            >
              Delete {selectedCount} selected
            </button>
          )}
        </div>

        {/* TABLE */}
        {loading ? (
          <div className="py-20 text-center text-zinc-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-zinc-400 text-sm">
            {search ? 'No members match your search.' : 'No members yet. Import a sign-in sheet to get started.'}
          </div>
        ) : (
          <div className="border border-zinc-200 dark:border-[#27272a] rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-[#27272a] border-b border-zinc-200 dark:border-[#3f3f46]">
                  <th className="px-4 py-2.5 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                      onChange={toggleAll}
                      className="rounded border-zinc-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-2.5 w-10 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">#</th>
                  <SortTh label="Name" sk="name" active={sortKey} asc={sortAsc} onSort={handleSort} />
                  <th className="px-4 py-2.5 w-28 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Year</th>
                  <th className="px-4 py-2.5 w-28 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">College</th>
                  <SortTh label="Points" sk="points" active={sortKey} asc={sortAsc} onSort={handleSort} />
                  <SortTh label="Events" sk="events_attended" active={sortKey} asc={sortAsc} onSort={handleSort} />
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-[#18181b] divide-y divide-zinc-100 dark:divide-[#27272a]">
                {paginatedFiltered.map((m, i) => {
                  const isChecked = selected.has(m.id);
                  return (
                    <tr
                      key={m.id}
                      onClick={() => toggleOne(m.id)}
                      className={`transition-colors cursor-pointer ${isChecked
                          ? 'bg-[#eef2ff] dark:bg-indigo-950/30 border-l-2 border-l-indigo-600'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                        }`}
                    >
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(m.id)}
                          className="rounded border-zinc-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-xs font-mono">{pageStart + i + 1}</td>
                      {/* NAME */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[12px] font-semibold text-zinc-600 dark:text-zinc-300 shrink-0">
                            {initials(m.first_name, m.last_name)}
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">{m.first_name} {m.last_name}</p>
                            {m.email && <p className="text-[11px] text-zinc-400">{m.email}</p>}
                          </div>
                        </div>
                      </td>
                      {/* YEAR */}
                      <td className="px-4 py-3">
                        {m.year ? (
                          <span className={`inline-flex items-center text-[11px] font-medium border rounded-full px-2 py-0.5 ${yearBadgeCls(m.year)}`}>
                            {m.year}
                          </span>
                        ) : <span className="text-zinc-400 text-[12px]">—</span>}
                      </td>
                      {/* COLLEGE */}
                      <td className="px-4 py-3 text-[13px] text-zinc-500 dark:text-zinc-400">{m.college || '—'}</td>
                      {/* POINTS */}
                      <td className="px-4 py-3 text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{m.points} pts</td>
                      {/* EVENTS */}
                      <td className="px-4 py-3 text-[13px] text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{m.events_attended} events</td>
                      {/* ACTIONS */}
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <GhostBtn onClick={() => openEdit(m)}>Edit</GhostBtn>
                          {m.needs_review && <GhostBtn color="green" onClick={() => handleUnflag(m)}>Review OK</GhostBtn>}
                          <GhostBtn color="zinc" onClick={() => openHistory(m)}>History</GhostBtn>
                          <GhostBtn color="amber" onClick={() => openMerge(m)}>Merge</GhostBtn>
                          <GhostBtn color="red" onClick={() => setDeleting(m)}>Delete</GhostBtn>
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
                theme="zinc"
              />
            )}
          </div>
        )}
      </div>

      {/* ── Bulk Delete Modal ── */}
      {confirmBulk && (
        <Modal onClose={() => setConfirmBulk(false)}>
          <h2 className="text-[16px] font-bold text-zinc-900 dark:text-zinc-50 mb-2">
            Delete {selectedCount} member{selectedCount !== 1 ? 's' : ''}?
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-[13px] mb-5">
            This permanently removes {selectedCount} member{selectedCount !== 1 ? 's' : ''} and all their attendance records. Cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={handleBulkDelete} disabled={bulkDeleting}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium py-2.5 rounded-md text-[13px] transition-colors">
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
            <h2 className="text-[16px] font-bold text-zinc-900 dark:text-zinc-50">Edit Member</h2>
            <button onClick={() => setEditing(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
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
            <div className="grid grid-cols-2 gap-3 rounded-md bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3 border border-zinc-200 dark:border-[#27272a]">
              <div>
                <p className="text-[11px] text-zinc-400 mb-0.5">Points (computed)</p>
                <p className="text-[13px] font-semibold text-indigo-600 dark:text-indigo-400">{editing.points}</p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 mb-0.5">Events attended (computed)</p>
                <p className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-200">{editing.events_attended}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={handleSaveEdit} disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 rounded-md text-[13px] transition-colors">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <BtnCancel onClick={() => setEditing(null)} />
          </div>
        </Modal>
      )}

      {/* ── Single Delete Modal ── */}
      {deleting && (
        <Modal onClose={() => setDeleting(null)}>
          <h2 className="text-[16px] font-bold text-zinc-900 dark:text-zinc-50 mb-2">Delete member?</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-[13px] mb-5">
            Remove <strong className="text-zinc-700 dark:text-zinc-200">{deleting.first_name} {deleting.last_name}</strong> and all their attendance records? Cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={handleDelete} disabled={confirming}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium py-2.5 rounded-md text-[13px] transition-colors">
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
              <h2 className="text-[16px] font-bold text-zinc-900 dark:text-zinc-50">
                {historyMember.first_name} {historyMember.last_name}
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {historyMember.points} pts · {historyMember.events_attended} event{historyMember.events_attended !== 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={() => setHistoryMember(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
          </div>
          {historyLoading ? (
            <div className="py-8 text-center text-zinc-400 text-[13px]">Loading…</div>
          ) : historyRecords.length === 0 ? (
            <div className="py-8 text-center text-zinc-400 text-[13px]">No attendance records found.</div>
          ) : (
            <div className="overflow-y-auto max-h-80 rounded-md border border-zinc-200 dark:border-[#27272a] divide-y divide-zinc-100 dark:divide-[#27272a]">
              {historyRecords.map(rec => (
                <div key={rec.event_id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-50">{rec.event_name}</p>
                    <p className="text-[11px] text-zinc-400">
                      {rec.event_date
                        ? new Date(rec.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </p>
                  </div>
                  <span className="text-[13px] font-semibold text-indigo-600 dark:text-indigo-400">+{rec.points_earned} pts</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setHistoryMember(null)}
            className="mt-5 w-full border border-zinc-200 dark:border-[#27272a] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium py-2.5 rounded-md text-[13px] transition-colors">
            Close
          </button>
        </Modal>
      )}

      {/* ── Merge Modal ── */}
      {mergingSource && (
        <Modal onClose={() => setMergingSource(null)} wide>
          {!mergeConfirming ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[16px] font-bold text-zinc-900 dark:text-zinc-50">Merge Member</h2>
                <button onClick={() => setMergingSource(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
              </div>
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mb-4">
                Move all attendance records from{' '}
                <strong className="text-red-600 dark:text-red-400">{mergingSource.first_name} {mergingSource.last_name}</strong>
                {' '}into another member. The source will be deleted.
              </p>
              <input type="search" value={mergeSearch} onChange={e => setMergeSearch(e.target.value)}
                placeholder="Search for the member to merge INTO…"
                className={inputCls + ' mb-3'}
                autoFocus />
              <div className="overflow-y-auto max-h-64 rounded-md border border-zinc-200 dark:border-[#27272a] divide-y divide-zinc-100 dark:divide-[#27272a]">
                {members
                  .filter(m =>
                    m.id !== mergingSource.id &&
                    `${m.first_name} ${m.last_name} ${m.email ?? ''}`.toLowerCase().includes(mergeSearch.toLowerCase())
                  )
                  .map(m => (
                    <button key={m.id}
                      onClick={() => { setMergeTarget(m); setMergeConfirming(true); }}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-left transition-colors">
                      <div>
                        <span className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                          {m.first_name} {m.last_name}
                        </span>
                        {m.email && <span className="ml-2 text-[11px] text-zinc-400">{m.email}</span>}
                      </div>
                      <span className="text-[11px] text-zinc-400 shrink-0 ml-3">
                        {m.points} pts · {m.events_attended} events
                      </span>
                    </button>
                  ))}
              </div>
            </>
          ) : (
            <>
              <h2 className="text-[16px] font-bold text-zinc-900 dark:text-zinc-50 mb-2">Confirm merge?</h2>
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mb-1">
                <strong className="text-red-600 dark:text-red-400">{mergingSource.first_name} {mergingSource.last_name}</strong>
                {' '}({mergingSource.events_attended} record{mergingSource.events_attended !== 1 ? 's' : ''}) will be merged into{' '}
                <strong className="text-indigo-600 dark:text-indigo-400">{mergeTarget!.first_name} {mergeTarget!.last_name}</strong>.
              </p>
              <p className="text-[11px] text-zinc-400 mb-5">
                Duplicate events are skipped. The source member is permanently deleted.
              </p>
              <div className="flex gap-3">
                <button onClick={handleMergeConfirm} disabled={mergeExecuting}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-medium py-2.5 rounded-md text-[13px] transition-colors">
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

const inputCls = `w-full rounded-md border border-zinc-200 dark:border-[#27272a] bg-white dark:bg-[#18181b]
  text-zinc-900 dark:text-zinc-100 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition`;

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className={`bg-white dark:bg-[#18181b] rounded-lg shadow-xl p-6 border border-zinc-200 dark:border-[#27272a] w-full ${wide ? 'max-w-lg' : 'max-w-sm'}`}
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
      className="flex-1 border border-zinc-200 dark:border-[#27272a] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium py-2.5 rounded-md text-[13px] transition-colors">
      {label}
    </button>
  );
}

function GhostBtn({ color = 'indigo', onClick, children }: { color?: string; onClick: () => void; children: React.ReactNode }) {
  const cls: Record<string, string> = {
    indigo: 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30',
    green: 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30',
    zinc: 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800',
    amber: 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30',
    red: 'text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30',
  };
  return (
    <button onClick={onClick} className={`text-[12px] font-medium px-2 py-1 rounded transition-colors ${cls[color] ?? cls.indigo}`}>
      {children}
    </button>
  );
}

function SortTh({ label, sk, active, asc, onSort }: {
  label: string; sk: string; active: string; asc: boolean; onSort: (k: any) => void;
}) {
  const isActive = active === sk;
  return (
    <th className="px-4 py-2.5 text-left whitespace-nowrap">
      <button onClick={() => onSort(sk)}
        className={`flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide transition-colors ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
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
      <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
