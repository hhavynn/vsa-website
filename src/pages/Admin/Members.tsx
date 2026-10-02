// House shown here is the member's membership for the CURRENT academic year,
// read from house_memberships. `members.house` is a legacy display cache that
// still holds last season's value and is an input to the Admin -> Houses
// backfill; it is deliberately left untouched.
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from 'react-query';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import toast, { Toaster } from 'react-hot-toast';
import { OFFICIAL_YEARS } from '../../lib/yearNormalizer';
import { usePagination } from '../../hooks/usePagination';
import { PaginationControls } from '../../components/common/PaginationControls';
import { Button } from '../../components/ui/Button';
import { AddMemberModal } from '../../components/features/admin/AddMemberModal';
import { MemberAttendanceModal } from '../../components/features/admin/MemberAttendanceModal';
import { MEMBER_COLLEGES } from '../../constants/memberOptions';
import { HOUSE_LABELS, HOUSE_OPTIONS, normalizeHouse } from '../../constants/houses';
import { normalizeEmail } from '../../lib/memberMatching';
import { formatAcademicYear, getAcademicYearStart } from '../../lib/academicTerms';
import { adminMembersRepository } from '../../data/repos/adminMembers';
import { houseMembershipsRepository } from '../../data/repos/houseMemberships';
import { photoRequestsRepository } from '../../data/repos/photoRequests';
import { toUserMessage } from '../../data/errors';
import { MEMBER_AVATARS_QUERY_KEY, useMemberAvatars } from '../../hooks/useMemberAvatars';
import { BulkActionBar, FilterChips, RowCheckbox, bulkBtnCls } from '../../components/features/admin/ops';
import { logAdminActivity } from '../../data/repos/adminActivity';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { useUrlFilter } from '../../hooks/useUrlFilter';
import { ACTIVITY_ACTIONS, activitySummary } from '../../lib/adminActivity';
import { planMemberClearReview, pruneSelection, selectedRows, setSelection, toggleSelected } from '../../lib/adminBulk';
import { applyQuickFilter, countByFilter } from '../../lib/adminFilters';
import { MEMBER_FILTERS, MEMBER_FILTER_KEYS, MemberRowFacts } from '../../lib/adminQueues';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  college: string | null;
  year: string | null;
  /** Legacy cache on `members`; may hold a previous season's House. */
  house: string | null;
  /** Membership for the current academic year, or null when unassigned. */
  current_house: string | null;
  email: string | null;
  points: number;
  events_attended: number;
  created_at: string;
  needs_review?: boolean;
}

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

function getMemberEditForm(m: Member) {
  return {
    first_name: m.first_name,
    last_name: m.last_name,
    college: m.college ? toCollegeKey(m.college) : '',
    year: m.year ?? '',
    email: m.email ?? '',
    house: m.house ?? '',
  };
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
  const [filter, setFilter] = useUrlFilter(MEMBER_FILTER_KEYS);
  const showReviewOnly = filter === 'needs_review';
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [houseFilter, setHouseFilter] = useState<'all' | 'unassigned' | string>('all');
  const [houseLookupFailed, setHouseLookupFailed] = useState(false);

  // Sorting
  type SortKey = 'name' | 'house' | 'points' | 'events_attended';
  const [sortKey, setSortKey] = useState<SortKey>('points');
  const [sortAsc, setSortAsc] = useState(false);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(key === 'name'); }
  }

  // Edit modal
  const [editing, setEditing] = useState<Member | null>(null);
  const [addingMember, setAddingMember] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', college: '', year: '', email: '', house: '' });
  const [saving, setSaving] = useState<'fields' | 'photo' | null>(null);

  // Photo for the member being edited. Publishing happens on save.
  const avatars = useMemberAvatars();
  const queryClient = useQueryClient();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDropAccepted: files => { setPhotoFile(files[0]); setPhotoError(null); },
    onDropRejected: () => setPhotoError('Choose a JPEG, PNG, or WebP image up to 5 MB.'),
    accept: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    disabled: saving !== null,
  });

  useEffect(() => {
    if (!photoFile) { setPhotoPreviewUrl(null); return; }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  // History modal
  const [historyMember, setHistoryMember] = useState<Member | null>(null);
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

    // House for THIS academic year only. Reading members.house here is what
    // made the list keep showing last season's Houses after the year rolled
    // over; that column is a cache and is never year-scoped.
    const today = new Date();
    let houseByMemberId = new Map<string, string>();
    let houseLookupFailed = false;
    try {
      houseByMemberId = await houseMembershipsRepository.getHouseLabelsByMemberId(
        getAcademicYearStart(today),
        today.toISOString().slice(0, 10),
      );
    } catch {
      // Treating a failed lookup as "no memberships" would render every member
      // as confidently Unassigned across the table, the KPI, the filters and
      // the CSV. For protected House data an unknown state has to stay
      // visibly unknown.
      houseLookupFailed = true;
      toast.error('Could not load current-year House memberships. House is shown as unknown.');
    }
    setHouseLookupFailed(houseLookupFailed);

    setMembers(((data ?? []) as Omit<Member, 'current_house'>[]).map(m => ({
      ...m,
      current_house: houseByMemberId.get(m.id) ?? null,
    })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // ── Filtered + sorted ────────────────────────────────────────────────────────
  const memberFacts: Array<MemberRowFacts & { member: Member }> = useMemo(
    () => members.map(m => ({
      id: m.id,
      needs_review: m.needs_review ?? false,
      // An unknown House lookup must not make everyone look unassigned.
      current_house: houseLookupFailed ? 'unknown' : m.current_house,
      hasPhoto: avatars.has(m.id),
      events_attended: m.events_attended,
      member: m,
    })),
    [members, houseLookupFailed, avatars],
  );
  const memberFilters = useMemo(
    () => MEMBER_FILTERS.filter(f => !(houseLookupFailed && f.key === 'no_house')),
    [houseLookupFailed],
  );
  const filterCounts = useMemo(() => countByFilter(memberFacts, memberFilters), [memberFacts, memberFilters]);
  const chipMembers = useMemo(
    () => applyQuickFilter(memberFacts, memberFilters, filter).map(f => f.member),
    [memberFacts, memberFilters, filter],
  );

  const filtered = chipMembers
    .filter(m => {
      if (houseFilter === 'all') return true;
      if (houseFilter === 'unassigned') return !m.current_house;
      return m.current_house === houseFilter;
    })
    .filter(m => {
      const q = search.toLowerCase();
      return (
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
        (m.college ?? '').toLowerCase().includes(q) ||
        (m.year ?? '').toLowerCase().includes(q) ||
        (m.current_house ?? '').toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') {
        cmp = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      } else if (sortKey === 'house') {
        cmp = (a.current_house ?? '').localeCompare(b.current_house ?? '');
      } else if (sortKey === 'points') {
        cmp = a.points - b.points;
      } else {
        cmp = a.events_attended - b.events_attended;
      }
      return sortAsc ? cmp : -cmp;
    });

  // ── Pagination ───────────────────────────────────────────────────────────────
  const resetKey = `${search}|${filter}|${houseFilter}|${sortKey}|${sortAsc}`;
  const {
    page, totalPages, rowsPerPage, setRowsPerPage, setCurrentPage,
    pageStart, pageStartLabel, pageEndLabel,
    paginatedData: paginatedFiltered,
  } = usePagination(filtered, { defaultRowsPerPage: 25, resetKey });

  // ── Edit ─────────────────────────────────────────────────────────────────────
  function openEdit(m: Member) {
    setEditing(m);
    setEditForm(getMemberEditForm(m));
    clearPhoto();
  }

  function closeEdit() {
    setEditing(null);
    clearPhoto();
  }

  // The dialog stays open until a save finishes; closing it mid-publish would
  // let a second editor open, which the first save would then close.
  function requestCloseEdit() {
    if (saving !== null) return;
    if (editHasChanges && !window.confirm('You have unsaved changes. Discard them?')) return;
    closeEdit();
  }

  function clearPhoto() {
    setPhotoFile(null);
    setPhotoConsent(false);
    setPhotoError(null);
  }

  async function handleSaveEdit() {
    if (!editing) return;
    if (photoFile && !photoConsent) {
      setPhotoError('Confirm the member agreed to this photo being public.');
      return;
    }
    setSaving('fields');
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
    if (error) { setSaving(null); toast.error('Failed to save changes.'); return; }

    if (photoFile) {
      setSaving('photo');
      try {
        await photoRequestsRepository.adminPublishMemberPhoto(editing.id, photoFile);
      } catch (err) {
        console.error(err);
        setSaving(null);
        // Keep the dialog open with the photo still selected so it can be retried.
        setPhotoError(toUserMessage(err, 'The photo could not be published. Try again.'));
        toast.error('Details saved, but the photo was not published.');
        load();
        return;
      }
      queryClient.invalidateQueries(MEMBER_AVATARS_QUERY_KEY);
    }

    setSaving(null);
    toast.success(photoFile ? 'Member updated and photo published.' : 'Member updated.');
    closeEdit();
    load();
  }

  // ── Unflag (Clear Review) ───────────────────────────────────────────────────
  async function handleUnflag(m: Member) {
    const { error } = await supabase.from('members').update({ needs_review: false }).eq('id', m.id);
    if (error) { toast.error('Failed to clear review flag.'); return; }
    toast.success(`Cleared review flag for ${m.first_name} ${m.last_name}.`);
    load();
  }

  // ── Bulk: Review OK on several flagged members ─────────────────────────────
  useEffect(
    () =>
      setSelected(current => {
        const next = pruneSelection(current, members.map(m => m.id));
        return next.size === current.size ? current : next;
      }),
    [members],
  );
  const selectedMembers = useMemo(() => selectedRows(members, selected, m => m.id), [members, selected]);
  const clearReviewPlan = useMemo(
    () => planMemberClearReview(selectedMembers.map(m => ({ id: m.id, needs_review: m.needs_review ?? false }))),
    [selectedMembers],
  );

  async function handleBulkReviewOk() {
    const ids = clearReviewPlan.eligible.map(row => row.id);
    if (ids.length === 0) {
      toast('None of the selected members are flagged for review.');
      return;
    }
    setBulkBusy(true);
    try {
      await adminMembersRepository.clearReviewFlags(ids);
      logAdminActivity({
        action: ACTIVITY_ACTIONS.memberBulkChanged,
        entityType: 'member',
        summary: activitySummary.bulk('Cleared the review flag on', ids.length, 'member'),
      });
      toast.success(`Cleared the review flag on ${ids.length} member${ids.length === 1 ? '' : 's'}.`);
      setSelected(new Set());
      await load();
    } catch (err) {
      toast.error(toUserMessage(err, 'Failed to clear review flags.'));
    } finally {
      setBulkBusy(false);
    }
  }

  // Quick Search deep link: ?member=<id> opens that member's editor once.
  const memberParam = searchParams.get('member');
  useEffect(() => {
    if (!memberParam || loading) return;
    const target = members.find(m => m.id === memberParam);
    if (target) openEdit(target);
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      next.delete('member');
      return next;
    }, { replace: true });
    // openEdit only sets local state; it is intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberParam, loading, members]);

  // ── History ───────────────────────────────────────────────────────────────────
  function openHistory(member: Member) {
    setHistoryMember(member);
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

  // Derived from this year's memberships rather than the HOUSE_OPTIONS
  // constant, which is the 2025-2026 roster and would offer filters that match
  // nothing once the Houses for a new year differ.
  const currentHouseOptions = useMemo(
    () => Array.from(new Set(members.map(m => m.current_house).filter((h): h is string => !!h))).sort(),
    [members],
  );

  const needsReviewCount = members.filter(m => m.needs_review).length;
  const unassignedHouseCount = members.filter(m => !m.current_house).length;
  const unassignedHouseDisplay = houseLookupFailed ? '—' : String(unassignedHouseCount);

  // Stat card values
  const activeCount = members.filter(m => m.events_attended > 0).length;
  const avgAttendance = members.length
    ? (members.reduce((s, m) => s + m.events_attended, 0) / members.length).toFixed(1)
    : '—';

  const editHasChanges = !!editing && (!!photoFile || JSON.stringify(editForm) !== JSON.stringify(getMemberEditForm(editing)));
  useUnsavedChangesGuard(editHasChanges, saving !== null);

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
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setAddingMember(true)}>Add Member</Button>
          <button
            onClick={() => {
              const rows = [
                ['First Name', 'Last Name', 'Email', 'Year', 'College', 'House', 'Points', 'Events'],
                ...members.map(m => [m.first_name, m.last_name, m.email ?? '', m.year ?? '', m.college ?? '', houseLookupFailed ? 'unknown' : (m.current_house ?? ''), m.points, m.events_attended]),
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
      </div>

      <div className="p-4 sm:p-6 lg:p-8">

        <section
          aria-labelledby="member-deletion-guard-heading"
          className="mb-6 rounded-md border border-border-strong bg-surface2 px-4 py-3 text-text-primary"
        >
          <h2 id="member-deletion-guard-heading" className="text-sm font-semibold">
            Member deletion is temporarily disabled
          </h2>
          <p className="mt-1 text-[13px] text-text-secondary">
            Deleting a member can remove attendance, House membership, and leaderboard history. Use the data-rights runbook and future anonymization workflow for privacy or correction requests. See <code>docs/privacy-data-rights-architecture.md</code>.
          </p>
        </section>

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
              <p className="font-serif text-[32px] leading-none" style={{ color: 'var(--color-text)' }}>{unassignedHouseDisplay}</p>
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
              onClick={() => setFilter(showReviewOnly ? 'all' : 'needs_review')}
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
              {currentHouseOptions.map(house => (
                <option key={house} value={house}>{house}</option>
              ))}
            </select>
          </div>
        </div>

        {!loading && members.length > 0 && (
          <div className="mb-4">
            <FilterChips filters={memberFilters} counts={filterCounts} active={filter} onChange={setFilter} label="Filter members" />
          </div>
        )}

        {/* TABLE */}
        {loading ? (
          <div className="py-20 text-center text-sm text-[var(--color-text3)]">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-sm text-[var(--color-text3)]">
            {search || filter !== 'all' || houseFilter !== 'all' ? (
              <>
                No members match these filters.{' '}
                <button type="button" className="font-semibold text-[var(--brand)] underline-offset-2 hover:underline" onClick={() => { setSearch(''); setFilter('all'); setHouseFilter('all'); }}>
                  Clear filters
                </button>
              </>
            ) : (
              <>
                No members yet.{' '}
                <Link to="/admin/import" className="font-semibold text-[var(--brand)] underline-offset-2 hover:underline">Import a sign-in sheet</Link> to get started.
              </>
            )}
          </div>
        ) : (
          <div className="scrapbook-paper overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <BulkActionBar count={selected.size} noun="member" onClear={() => setSelected(new Set())}>
              <button type="button" className={bulkBtnCls} disabled={bulkBusy} onClick={handleBulkReviewOk}>
                Review OK{clearReviewPlan.eligible.length > 0 ? ` (${clearReviewPlan.eligible.length})` : ''}
              </button>
            </BulkActionBar>
            <div className="max-h-[75vh] overflow-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="sticky top-0 z-[2]">
                  <tr className="border-b bg-[var(--color-surface2)]" style={{ borderColor: 'var(--color-border)' }}>
                    <th className="w-10 px-4 py-2.5 text-left">
                      <RowCheckbox
                        checked={paginatedFiltered.length > 0 && paginatedFiltered.every(m => selected.has(m.id))}
                        onChange={() => setSelected(setSelection(paginatedFiltered.map(m => m.id), !paginatedFiltered.every(m => selected.has(m.id))))}
                        label="Select all members on this page"
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
                    return (
                      <tr key={m.id} className="transition-colors hover:bg-[var(--color-surface2)]">
                        <td className="px-4 py-3">
                          <RowCheckbox checked={selected.has(m.id)} onChange={() => setSelected(current => toggleSelected(current, m.id))} label={`Select ${m.first_name} ${m.last_name}`} />
                        </td>
                        <td className="font-mono text-xs px-4 py-3 text-[var(--color-text3)]">{pageStart + i + 1}</td>
                        {/* NAME */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <MemberPhoto src={avatars.get(m.id)} first={m.first_name} last={m.last_name} className="h-8 w-8 text-[12px]" />
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
                          {houseLookupFailed ? (
                            <span className="text-[12px] text-[var(--color-text3)]">Unknown</span>
                          ) : m.current_house ? (
                            <span className="inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text2)]" style={{ borderColor: 'var(--color-border)' }}>
                              {m.current_house}
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

      {/* ── Edit Modal ── */}
      {editing && (
        <Modal onClose={requestCloseEdit} wide>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[16px] font-bold text-zinc-900 dark:text-zinc-50">Edit Member</h2>
            <button onClick={requestCloseEdit} disabled={saving !== null} aria-label="Close" className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none disabled:opacity-40">×</button>
          </div>
          <div className="space-y-4">
            <Field label="Photo">
              <div className="flex items-center gap-4">
                <MemberPhoto
                  src={photoPreviewUrl ?? avatars.get(editing.id)}
                  first={editing.first_name}
                  last={editing.last_name}
                  alt={photoPreviewUrl ? 'Selected photo preview' : `Current photo of ${editing.first_name} ${editing.last_name}`}
                  className="h-16 w-16 text-[18px]"
                />
                <div className="min-w-0 flex-1">
                  <div
                    {...getRootProps({
                      role: 'button',
                      className: cn(
                        'cursor-pointer rounded border border-dashed px-3 py-2.5 text-[12px] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand)]',
                        isDragActive ? 'border-[var(--brand)] bg-[var(--color-surface2)]' : 'border-[var(--color-border)] hover:border-[var(--brand)]',
                        saving !== null && 'cursor-default opacity-60',
                      ),
                    })}
                  >
                    <input {...getInputProps({ 'aria-label': 'Photo file' })} />
                    <span className="font-semibold text-[var(--color-text)]">
                      {isDragActive ? 'Drop the photo here' : photoFile ? 'Choose a different photo' : avatars.get(editing.id) ? 'Choose a new photo' : 'Choose a photo'}
                    </span>
                    <span className="text-[var(--color-text3)]"> or drop one here</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--color-text3)]">
                    JPEG, PNG, or WebP up to 5 MB. Published when you save, on the leaderboard and anywhere else this member is linked.
                  </p>
                  {photoFile ? (
                    <button type="button" onClick={clearPhoto} disabled={saving !== null} className="mt-1 text-[11px] font-semibold text-[var(--color-text2)] underline disabled:opacity-40">
                      Don't change the photo
                    </button>
                  ) : avatars.get(editing.id) ? (
                    <Link to="/admin/photo-requests" className="mt-1 inline-block text-[11px] font-semibold text-brand-600 underline dark:text-brand-400">
                      Remove or review photos in Photo requests
                    </Link>
                  ) : null}
                </div>
              </div>
              {photoFile && (
                <label className="mt-3 flex items-start gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 py-2.5 text-[12px] text-[var(--color-text)]">
                  <input
                    type="checkbox"
                    checked={photoConsent}
                    disabled={saving !== null}
                    onChange={e => { setPhotoConsent(e.target.checked); setPhotoError(null); }}
                    className="mt-0.5"
                  />
                  <span>{editing.first_name || 'This member'} agreed to this photo being shown publicly on the VSA website.</span>
                </label>
              )}
              {photoError && (
                <p role="alert" className="mt-2 text-[12px] text-red-700 dark:text-red-400">{photoError}</p>
              )}
            </Field>
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
            <Field label="House (legacy cache — not this year's assignment)">
              <p className="mb-1 text-[11px] text-[var(--color-text3)]">
                Assign Houses for {formatAcademicYear(getAcademicYearStart(new Date()))} on Admin &rarr; Houses. This field only
                updates the legacy <code>members.house</code> value the Houses backfill reads.
              </p>
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
                  {MEMBER_COLLEGES.map(({ value, label }) => (
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
          <Button variant="outline" className="mt-4" fullWidth disabled={saving !== null || editHasChanges}
            onClick={() => { closeEdit(); openHistory(editing); }}>Manage attendance</Button>
          {editHasChanges && <p className="mt-2 text-sm text-text-secondary">Save changes or cancel this edit before managing attendance.</p>}
          <div className="flex gap-3 mt-6">
            <button onClick={handleSaveEdit} disabled={saving !== null || !editHasChanges}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-md text-[13px] transition-colors">
              {saving === 'photo' ? 'Publishing photo…' : saving ? 'Saving…' : photoFile ? 'Save & publish photo' : 'Save changes'}
            </button>
            <BtnCancel onClick={requestCloseEdit} disabled={saving !== null} />
          </div>
          <p role="status" aria-live="polite" className="mt-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-400">
            {editHasChanges ? 'Unsaved changes' : ''}
          </p>
        </Modal>
      )}

      {addingMember && (
        <AddMemberModal onClose={() => setAddingMember(false)} onCreated={async member => {
          setSearch(`${member.first_name} ${member.last_name}`);
          setFilter('all');
          setHouseFilter('all');
          await load();
        }} />
      )}
      {historyMember && (
        <MemberAttendanceModal key={historyMember.id} memberId={historyMember.id}
          onClose={() => setHistoryMember(null)} onChanged={load} />
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
    <div data-testid="modal-backdrop" className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
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

/** Only local previews (blob:) and storage URLs (http/https) may reach <img src>. */
function isSafeImageSrc(src: string): boolean {
  try {
    return ['blob:', 'https:', 'http:'].includes(new URL(src).protocol);
  } catch {
    return false;
  }
}

function MemberPhoto({ src, first, last, alt = '', className }: {
  src: string | null | undefined; first: string; last: string; alt?: string; className: string;
}) {
  const shape = cn('shrink-0 rounded-full border border-[var(--color-border)]', className);
  if (src && isSafeImageSrc(src)) return <img src={src} alt={alt} className={cn(shape, 'object-cover')} />;
  return (
    <div className={cn(shape, 'flex items-center justify-center bg-[var(--color-surface2)] font-semibold text-[var(--color-text2)]')}>
      {initials(first, last)}
    </div>
  );
}

function BtnCancel({ onClick, label = 'Cancel', disabled }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex-1 border bg-transparent hover:bg-[var(--color-surface2)] disabled:opacity-40 font-medium py-2.5 rounded-md text-[13px] transition-colors"
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
