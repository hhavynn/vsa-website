import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AdminNav } from '../../components/features/admin/AdminNav';
import toast, { Toaster } from 'react-hot-toast';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  college: string | null;
  year: string | null;
  points: number;
  events_attended: number;
  created_at: string;
}

const YEAR_LABELS: Record<string, string> = {
  '1': '1st year', '2': '2nd year', '3': '3rd year',
  '4': '4th year', '5': '5th year', 'transfer': 'Transfer',
};

function yearLabel(y: string | null) {
  if (!y) return '';
  return YEAR_LABELS[y] ?? y;
}

export default function AdminMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  // Multi-select
  // Sorting
  type SortKey = 'name' | 'points' | 'events_attended';
  const [sortKey, setSortKey]   = useState<SortKey>('points');
  const [sortAsc, setSortAsc]   = useState(false);

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
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', college: '', year: '', points: 0, events_attended: 0 });
  const [saving, setSaving]     = useState(false);

  // Single delete modal
  const [deleting, setDeleting]     = useState<Member | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('members')
      .select('id, first_name, last_name, college, year, points, events_attended, created_at')
      .order('points', { ascending: false });
    if (error) toast.error('Failed to load members.');
    setMembers((data ?? []) as Member[]);
    setSelected(new Set()); // clear selection on reload
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = members
    .filter(m => {
      const q = search.toLowerCase();
      return (
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
        (m.college ?? '').toLowerCase().includes(q) ||
        (m.year ?? '').toLowerCase().includes(q)
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

  // ── Selection helpers ─────────────────────────────────────────────────────────
  const allFilteredIds = filtered.map(m => m.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id));
  const someSelected = allFilteredIds.some(id => selected.has(id));

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        allFilteredIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelected(prev => new Set([...Array.from(prev), ...allFilteredIds]));
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────────
  function openEdit(m: Member) {
    setEditing(m);
    setEditForm({
      first_name:      m.first_name,
      last_name:       m.last_name,
      college:         m.college ?? '',
      year:            m.year ?? '',
      points:          m.points,
      events_attended: m.events_attended,
    });
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from('members')
      .update({
        first_name:      editForm.first_name.trim(),
        last_name:       editForm.last_name.trim(),
        college:         editForm.college.trim() || null,
        year:            editForm.year.trim() || null,
        points:          Number(editForm.points),
        events_attended: Number(editForm.events_attended),
        updated_at:      new Date().toISOString(),
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

  const selectedCount = selected.size;

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
                {members.length} total member{members.length !== 1 ? 's' : ''} — edit names, points, or remove bad entries.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {selectedCount > 0 && (
                <button
                  onClick={() => setConfirmBulk(true)}
                  className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Delete {selectedCount} selected
                </button>
              )}
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, college, year…"
                className="w-64 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                  text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-gray-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              {search ? 'No members match your search.' : 'No members yet. Import a sign-in sheet to get started.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50">
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                        onChange={toggleAll}
                        className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">#</th>
                    <SortTh label="Name"   sk="name"            active={sortKey} asc={sortAsc} onSort={handleSort} />
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">College</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Year</th>
                    <SortTh label="Points" sk="points"          active={sortKey} asc={sortAsc} onSort={handleSort} />
                    <SortTh label="Events" sk="events_attended" active={sortKey} asc={sortAsc} onSort={handleSort} />
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map((m, i) => {
                    const isChecked = selected.has(m.id);
                    return (
                      <tr
                        key={m.id}
                        className={`transition-colors cursor-pointer ${
                          isChecked
                            ? 'bg-indigo-50/60 dark:bg-indigo-900/20'
                            : 'hover:bg-gray-50/60 dark:hover:bg-gray-700/30'
                        }`}
                        onClick={() => toggleOne(m.id)}
                      >
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleOne(m.id)}
                            className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs font-mono">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                          {m.first_name} {m.last_name}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{m.college || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{yearLabel(m.year) || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-indigo-600 dark:text-indigo-400">{m.points}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{m.events_attended}</td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEdit(m)}
                              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 font-medium px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleting(m)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Bulk Delete Modal ── */}
      {confirmBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Delete {selectedCount} member{selectedCount !== 1 ? 's' : ''}?
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">
              This will permanently remove {selectedCount} member{selectedCount !== 1 ? 's' : ''} and all their attendance records. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={handleBulkDelete} disabled={bulkDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
                {bulkDeleting ? 'Deleting…' : `Yes, delete ${selectedCount}`}
              </button>
              <button onClick={() => setConfirmBulk(false)}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium py-2.5 rounded-lg text-sm transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Member</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name">
                  <input value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))}
                    className={inputCls} />
                </Field>
                <Field label="Last name">
                  <input value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))}
                    className={inputCls} />
                </Field>
              </div>

              <Field label="College">
                <input value={editForm.college} onChange={e => setEditForm(f => ({ ...f, college: e.target.value }))}
                  placeholder="e.g. Revelle, Muir, Marshall…"
                  className={inputCls} />
              </Field>

              <Field label="Year">
                <select value={editForm.year} onChange={e => setEditForm(f => ({ ...f, year: e.target.value }))}
                  className={inputCls}>
                  <option value="">— select —</option>
                  {Object.entries(YEAR_LABELS).map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Points">
                  <input type="number" min={0} value={editForm.points}
                    onChange={e => setEditForm(f => ({ ...f, points: Number(e.target.value) }))}
                    className={inputCls} />
                </Field>
                <Field label="Events attended">
                  <input type="number" min={0} value={editForm.events_attended}
                    onChange={e => setEditForm(f => ({ ...f, events_attended: Number(e.target.value) }))}
                    className={inputCls} />
                </Field>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSaveEdit} disabled={saving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button onClick={() => setEditing(null)}
                className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Single Delete Modal ── */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete member?</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">
              Remove <strong className="text-gray-700 dark:text-gray-200">{deleting.first_name} {deleting.last_name}</strong> from
              the leaderboard? This also deletes their attendance records. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={confirming}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
                {confirming ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button onClick={() => setDeleting(null)}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium py-2.5 rounded-lg text-sm transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tiny helpers ──────────────────────────────────────────────────────────────

const inputCls = `w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
  text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent`;

function SortTh({ label, sk, active, asc, onSort }: {
  label: string; sk: string; active: string; asc: boolean; onSort: (k: any) => void;
}) {
  const isActive = active === sk;
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
      <button
        onClick={() => onSort(sk)}
        className={`flex items-center gap-1 transition-colors ${
          isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
      >
        {label}
        <span className="text-[10px] leading-none">
          {isActive ? (asc ? '▲' : '▼') : '⇅'}
        </span>
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
