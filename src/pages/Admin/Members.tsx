import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';
import { OFFICIAL_YEARS } from '../../lib/yearNormalizer';
import { usePagination } from '../../hooks/usePagination';
import { PaginationControls } from '../../components/common/PaginationControls';
import { HOUSE_LABELS, HOUSE_OPTIONS, normalizeHouse } from '../../constants/houses';
import { normalizeEmail } from '../../lib/memberMatching';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  college: string | null;
  year: string | null;
  house: string | null;
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
  term_label: string | null;
}

interface YearlyTotal {
  academic_year_start: number;
  academic_year_end: number;
  total_points: number;
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
  const [houseFilter, setHouseFilter] = useState<'all' | 'unassigned' | string>('all');

  // Sorting
  type SortKey = 'name' | 'house' | 'points' | 'events_attended';
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
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', college: '', year: '', email: '', house: '' });
  const [saving, setSaving] = useState(false);

  // Single delete modal
  const [deleting, setDeleting] = useState<Member | null>(null);
  const [confirming, setConfirming] = useState(false);

  // History modal
  const [historyMember, setHistoryMember] = useState<Member | null>(null);
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([]);
  const [historyYearly, setHistoryYearly] = useState<YearlyTotal[]>([]);
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
      .select('id, first_name, last_name, college, year, house, email, points, events_attended, created_at, needs_review')
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
      if (houseFilter === 'all') return true;
      if (houseFilter === 'unassigned') return !m.house;
      return m.house === houseFilter;
    })
    .filter(m => {
      const q = search.toLowerCase();
      return (
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
        (m.college ?? '').toLowerCase().includes(q) ||
        (m.year ?? '').toLowerCase().includes(q) ||
        (m.house ?? '').toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') {
        cmp = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      } else if (sortKey === 'house') {
        cmp = (a.house ?? '').localeCompare(b.house ?? '');
      } else if (sortKey === 'points') {
        cmp = a.points - b.points;
      } else {
        cmp = a.events_attended - b.events_attended;
      }
      return sortAsc ? cmp : -cmp;
    });

  // ── Pagination ───────────────────────────────────────────────────────────────
  const resetKey = `${search}|${showReviewOnly}|${houseFilter}|${sortKey}|${sortAsc}`;
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
      house: m.house ?? '',
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
        house: normalizeHouse(editForm.house) ?? null,
        email: normalizeEmail(editForm.email) || null,
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
    setHistoryYearly([]);
    setHistoryLoading(true);
    
    try {
      // 1. Fetch attendance with term labels
      const { data: attendanceData, error: attError } = await supabase
        .from('member_event_attendance')
        .select(`
          event_id, 
          points_earned, 
          events(
            name, 
            date, 
            academic_term_id,
            academic_terms(label)
          )
        `)
        .eq('member_id', m.id);
      
      if (attError) throw attError;

      const records = ((attendanceData ?? []) as any[])
        .map(row => ({
          event_id: row.event_id as string,
          event_name: (row.events?.name ?? '(unknown)') as string,
          event_date: (row.events?.date ?? '') as string,
          points_earned: row.points_earned as number,
          term_label: (row.events?.academic_terms?.label ?? null) as string | null,
        }))
        .sort((a, b) => b.event_date.localeCompare(a.event_date));
      setHistoryRecords(records);

      // 2. Fetch yearly point totals
      const { data: yearlyData, error: yearlyError } = await supabase
        .from('member_yearly_points')
        .select('academic_year_start, academic_year_end, total_points')
        .eq('member_id', m.id)
        .order('academic_year_start', { ascending: false });
      
      if (yearlyError) throw yearlyError;
      setHistoryYearly((yearlyData ?? []) as YearlyTotal[]);

    } catch (err: any) {
      toast.error('Failed to load history.');
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
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
  const unassignedHouseCount = members.filter(m => !m.house).length;

  // Stat card values
  const activeCount = members.filter(m => m.events_attended > 0).length;
  const avgAttendance = members.length
    ? (members.reduce((s, m) => s + m.events_attended, 0) / members.length).toFixed(1)
    : '—';

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <Toaster position="top-right" />

      {/* PAGE HEADER */}
      <div className="border-b px-6 py-6 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-8 sm:py-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="mb-4 sm:mb-0">
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>Members</h1>
          <p className="mt-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>{members.length} total members</p>
        </div>
        <button
          onClick={() => {
            const rows = [
              ['First Name', 'Last Name', 'Email', 'Year', 'College', 'House', 'Points', 'Events'],
              ...members.map(m => [m.first_name, m.last_name, m.email ?? '', m.year ?? '', m.college ?? '', m.house ?? '', m.points, m.events_attended]),
            ];
            const csv = rows.map(r => r.join(',')).join('\n');
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
            a.download = 'vsa-members.csv';
            a.click();
          }}
          className="rounded border bg-transparent px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--color-surface2)]"
          style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', cursor: 'pointer' }}
        >
          Export CSV
        </button>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">

        {/* STAT CARDS */}
        {!loading && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:gap-6">
            <div className="scrapbook-note flex flex-col justify-center px-4 py-4 sm:px-5">
              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>Total Members</p>
              <p className="font-serif text-[32px] leading-none" style={{ color: 'var(--color-text)' }}>{members.length}</p>
            </div>
            <div className="scrapbook-note flex flex-col justify-center px-4 py-4 sm:px-5">
              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>Active This Term</p>
              <p className="font-serif text-[32px] leading-none" style={{ color: 'var(--color-text)' }}>{activeCount}</p>
            </div>
            <div className="scrapbook-note flex flex-col justify-center px-4 py-4 sm:px-5">
              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>Unassigned House</p>
              <p className="font-serif text-[32px] leading-none" style={{ color: 'var(--color-text)' }}>{unassignedHouseCount}</p>
              <p className="mt-1 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>members</p>
            </div>
            <div className="scrapbook-note flex flex-col justify-center px-4 py-4 sm:px-5">
              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>Avg Attendance</p>
              <p className="font-serif text-[32px] leading-none" style={{ color: 'var(--color-text)' }}>{avgAttendance}</p>
              <p className="mt-1 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>events/member</p>
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
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search members..."
                className="w-full rounded border bg-[var(--color-surface2)] py-2 pl-9 pr-3 text-[13px] text-[var(--color-text)] placeholder-[var(--color-text3)] transition focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] sm:w-64"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>
            <select
              value={houseFilter}
              onChange={e => setHouseFilter(e.target.value)}
              className="w-full rounded border bg-[var(--color-surface2)] px-3 py-2 text-[13px] text-[var(--color-text)] transition focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] sm:w-auto"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <option value="all">All houses</option>
              <option value="unassigned">Unassigned</option>
              {HOUSE_OPTIONS.map(house => (
                <option key={house} value={house}>{HOUSE_LABELS[house]}</option>
              ))}
            </select>
          </div>
          {selectedCount > 0 && (
            <button
              onClick={() => setConfirmBulk(true)}
              className="w-full rounded bg-red-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-red-700 sm:w-auto"
            >
              Delete {selectedCount} selected
            </button>
          )}
        </div>

        {/* TABLE */}
        {loading ? (
          <div className="py-20 text-center text-sm text-[var(--color-text3)]">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-sm text-[var(--color-text3)]">
            {search ? 'No members match your search.' : 'No members yet. Import a sign-in sheet to get started.'}
          </div>
        ) : (
          <div className="scrapbook-paper overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="border-b bg-[var(--color-surface2)]" style={{ borderColor: 'var(--color-border)' }}>
                    <th className="w-10 px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                        onChange={toggleAll}
                        className="cursor-pointer rounded border-[var(--color-border)] bg-[var(--color-surface2)] text-[var(--brand)] focus:ring-[var(--brand)]"
                      />
                    </th>
                    <th className="w-10 px-4 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)]">#</th>
                    <SortTh label="Name" sk="name" active={sortKey} asc={sortAsc} onSort={handleSort} />
                    <th className="w-28 px-4 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)]">Year</th>
                    <th className="w-28 px-4 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)]">College</th>
                    <SortTh label="House" sk="house" active={sortKey} asc={sortAsc} onSort={handleSort} />
                    <SortTh label="Points" sk="points" active={sortKey} asc={sortAsc} onSort={handleSort} />
                    <SortTh label="Events" sk="events_attended" active={sortKey} asc={sortAsc} onSort={handleSort} />
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y bg-[var(--color-surface)]" style={{ borderColor: 'var(--color-border)' }}>
                  {paginatedFiltered.map((m, i) => {
                    const isChecked = selected.has(m.id);
                    return (
                      <tr
                        key={m.id}
                        onClick={() => toggleOne(m.id)}
                        className={`cursor-pointer transition-colors ${isChecked
                            ? 'bg-[var(--color-surface2)] border-l-2 border-l-[var(--brand)]'
                            : 'hover:bg-[var(--color-surface2)]'
                          }`}
                      >
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleOne(m.id)}
                            className="cursor-pointer rounded border-[var(--color-border)] bg-transparent text-[var(--brand)] focus:ring-[var(--brand)]"
                          />
                        </td>
                        <td className="font-mono text-xs px-4 py-3 text-[var(--color-text3)]">{pageStart + i + 1}</td>
                        {/* NAME */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-[var(--color-surface2)] text-[12px] font-semibold text-[var(--color-text2)]" style={{ borderColor: 'var(--color-border)' }}>
                              {initials(m.first_name, m.last_name)}
                            </div>
                            <div>
                              <p className="text-[13px] font-medium text-[var(--color-text)]">{m.first_name} {m.last_name}</p>
                              {m.email && <p className="text-[11px] text-[var(--color-text3)]">{m.email}</p>}
                            </div>
                          </div>
                        </td>
                        {/* YEAR */}
                        <td className="px-4 py-3">
                          {m.year ? (
                            <span className={`inline-flex items-center text-[11px] font-medium border rounded px-1.5 py-0.5 ${yearBadgeCls(m.year)}`}>
                              {m.year}
                            </span>
                          ) : <span className="text-[12px] text-[var(--color-text3)]">—</span>}
                        </td>
                        {/* COLLEGE */}
                        <td className="text-[13px] px-4 py-3 text-[var(--color-text2)]">{m.college || '—'}</td>
                        {/* HOUSE */}
                        <td className="text-[13px] px-4 py-3 text-[var(--color-text2)]">
                          {m.house ? (
                            <span className="inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text2)]" style={{ borderColor: 'var(--color-border)' }}>
                              {m.house}
                            </span>
                          ) : <span className="text-[12px] text-[var(--color-text3)]">Unassigned</span>}
                        </td>
                        {/* POINTS */}
                        <td className="whitespace-nowrap px-4 py-3 text-[13px] font-semibold text-[var(--color-text)]">{m.points} pts</td>
                        {/* EVENTS */}
                        <td className="whitespace-nowrap px-4 py-3 text-[13px] text-[var(--color-text2)]">{m.events_attended} events</td>
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
            </div>
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
                placeholder="optional - helps identify duplicates" className={inputCls} />
            </Field>
            <Field label="House">
              <select value={editForm.house} onChange={e => setEditForm(f => ({ ...f, house: e.target.value }))} className={inputCls}>
                <option value="">Unassigned</option>
                {HOUSE_OPTIONS.map(house => (
                  <option key={house} value={house}>{HOUSE_LABELS[house]}</option>
                ))}
              </select>
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
                {historyMember.points} pts (All-Time) · {historyMember.events_attended} event{historyMember.events_attended !== 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={() => setHistoryMember(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
          </div>
          
          {historyLoading ? (
            <div className="py-8 text-center text-zinc-400 text-[13px]">Loading…</div>
          ) : (
            <div className="space-y-6">
              {/* Yearly Breakdown */}
              {historyYearly.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">Yearly Breakdown</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {historyYearly.map(y => (
                      <div key={y.academic_year_start} className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-[#27272a] rounded px-3 py-2 flex justify-between items-center">
                        <span className="text-[12px] text-zinc-600 dark:text-zinc-400 font-medium">{y.academic_year_start}-{y.academic_year_end}</span>
                        <span className="text-[13px] font-bold text-indigo-600 dark:text-indigo-400">{y.total_points} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Event Records */}
              <div>
                <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">Event Records</h3>
                {historyRecords.length === 0 ? (
                  <div className="py-4 text-center text-zinc-400 text-[13px] border border-dashed rounded">No attendance records found.</div>
                ) : (
                  <div className="overflow-y-auto max-h-64 rounded-md border border-zinc-200 dark:border-[#27272a] divide-y divide-zinc-100 dark:divide-[#27272a]">
                    {historyRecords.map(rec => (
                      <div key={rec.event_id} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-50">{rec.event_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-zinc-400">
                              {rec.event_date
                                ? new Date(rec.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : '—'}
                            </span>
                            {rec.term_label && (
                              <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                                {rec.term_label}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[13px] font-semibold text-indigo-600 dark:text-indigo-400">+{rec.points_earned} pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
    </>
  );
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

const inputCls = `mt-1 block w-full rounded border px-3 py-2.5 text-[15px] sm:py-2 sm:text-sm focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] bg-[var(--color-surface2)] border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text3)] transition`;

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div
        className={`scrapbook-paper rounded-lg shadow-xl p-6 sm:p-8 w-full my-8 sm:my-0 ${wide ? 'max-w-lg' : 'max-w-sm'}`}
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
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
      className="flex-1 border bg-transparent hover:bg-[var(--color-surface2)] font-medium py-2.5 rounded-md text-[13px] transition-colors"
      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
      {label}
    </button>
  );
}

function GhostBtn({ color = 'indigo', onClick, children }: { color?: string; onClick: () => void; children: React.ReactNode }) {
  const cls: Record<string, string> = {
    indigo: 'text-brand-600 dark:text-brand-400 hover:bg-[var(--color-surface2)]',
    green: 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30',
    zinc: 'text-[var(--color-text2)] hover:bg-[var(--color-surface2)]',
    amber: 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30',
    red: 'text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30',
  };
  return (
    <button onClick={onClick} className={`text-[12px] font-semibold px-2 py-1 rounded transition-colors ${cls[color] ?? cls.indigo}`}>
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
        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors"
        style={{ color: isActive ? 'var(--brand)' : 'var(--color-text3)' }}>
        {label}
        <span className="text-[9px] leading-none">{isActive ? (asc ? '▲' : '▼') : '⇅'}</span>
      </button>
    </th>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)] mb-1">{label}</label>
      {children}
    </div>
  );
}
