import { useEffect, useMemo, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { PageTitle } from '../../components/common/PageTitle';
import { internCohortRepository } from '../../data/repos/internCohort';
import { useAcademicTerms } from '../../hooks/useAcademicTerms';
import { useAdminInternCohort } from '../../hooks/useInternCohort';
import { formatAcademicYear, getAcademicTermMeta } from '../../lib/academicTerms';
import { supabase } from '../../lib/supabase';
import { InternCohortMember } from '../../types';

interface InternFormState {
  name: string;
  photo_url: string;
  role_or_track: string;
  caption: string;
  display_order: number;
  is_published: boolean;
  source_doc_url: string;
  internal_notes: string;
}

const emptyForm: InternFormState = {
  name: '',
  photo_url: '',
  role_or_track: '',
  caption: '',
  display_order: 0,
  is_published: false,
  source_doc_url: '',
  internal_notes: '',
};

const inputCls = 'w-full rounded border px-3 py-2 text-sm';
const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide';

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getCurrentAcademicYearStart() {
  return getAcademicTermMeta(new Date())?.academicYearStart ?? new Date().getFullYear();
}

function defaultAcademicYearStart(terms: ReturnType<typeof useAcademicTerms>['terms']) {
  return terms.find((term) => term.is_active)?.academic_year_start
    ?? getCurrentAcademicYearStart()
    ?? terms[0]?.academic_year_start
    ?? null;
}

function buildAcademicYearOptions(terms: ReturnType<typeof useAcademicTerms>['terms']) {
  const years = new Map<number, { start: number; label: string; isActive: boolean }>();
  const currentYear = getCurrentAcademicYearStart();

  years.set(currentYear, {
    start: currentYear,
    label: formatAcademicYear(currentYear),
    isActive: false,
  });

  terms.forEach((term) => {
    const existing = years.get(term.academic_year_start);
    years.set(term.academic_year_start, {
      start: term.academic_year_start,
      label: `${term.academic_year_start}-${term.academic_year_end}`,
      isActive: term.is_active || existing?.isActive || false,
    });
  });

  return Array.from(years.values()).sort((a, b) => b.start - a.start);
}

function formFromMember(member: InternCohortMember): InternFormState {
  return {
    name: member.name,
    photo_url: member.photo_url ?? '',
    role_or_track: member.role_or_track ?? '',
    caption: member.caption ?? '',
    display_order: member.display_order,
    is_published: member.is_published,
    source_doc_url: member.source_doc_url ?? '',
    internal_notes: member.internal_notes ?? '',
  };
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'IN';
}

export default function AdminInterns() {
  const { terms } = useAcademicTerms();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const { members, loading, error, refetch } = useAdminInternCohort(selectedYear);
  const [form, setForm] = useState<InternFormState>(emptyForm);
  const [editingMember, setEditingMember] = useState<InternCohortMember | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const academicYearOptions = useMemo(() => buildAcademicYearOptions(terms), [terms]);

  useEffect(() => {
    if (selectedYear === null) setSelectedYear(defaultAcademicYearStart(terms));
  }, [selectedYear, terms]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function resetForm() {
    setEditingMember(null);
    setForm(emptyForm);
    setPhotoFile(null);
    setPhotoPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }

  function startEdit(member: InternCohortMember) {
    setEditingMember(member);
    setForm(formFromMember(member));
    setPhotoFile(null);
    setPhotoPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }

  function handlePhotoFile(file: File | null) {
    setPhotoFile(file);
    setPhotoPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  async function uploadInternPhoto(file: File) {
    if (!selectedYear) throw new Error('Choose an academic year first.');
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${selectedYear}/${crypto.randomUUID()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('intern_images').upload(fileName, file);
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('intern_images').getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedYear) {
      toast.error('Choose an academic year first.');
      return;
    }
    if (!form.name.trim()) {
      toast.error('Intern name is required.');
      return;
    }

    try {
      setSaving(true);
      const uploadedUrl = photoFile ? await uploadInternPhoto(photoFile) : null;
      await internCohortRepository.upsertMember({
        ...(editingMember ? { id: editingMember.id } : {}),
        academic_year_start: selectedYear,
        academic_year_end: selectedYear + 1,
        name: form.name.trim(),
        photo_url: nullable(uploadedUrl ?? form.photo_url),
        role_or_track: nullable(form.role_or_track),
        caption: nullable(form.caption),
        display_order: Number(form.display_order) || 0,
        is_published: form.is_published,
        source_doc_url: nullable(form.source_doc_url),
        internal_notes: nullable(form.internal_notes),
      });

      toast.success(editingMember ? 'Intern updated.' : 'Intern added.');
      resetForm();
      await refetch();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save intern.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(member: InternCohortMember) {
    if (!window.confirm(`Remove ${member.name} from the intern cohort?`)) return;

    try {
      await internCohortRepository.deleteMember(member.id);
      toast.success('Intern removed.');
      if (editingMember?.id === member.id) resetForm();
      await refetch();
    } catch (err) {
      console.error(err);
      toast.error('Failed to remove intern.');
    }
  }

  const fieldStyle = {
    borderColor: 'var(--color-border)',
    background: 'var(--color-surface2)',
    color: 'var(--color-text)',
  };

  const previewUrl = photoPreview ?? form.photo_url;

  return (
    <>
      <PageTitle title="Intern Cohort" />
      <Toaster position="top-right" />

      <div className="border-b flex items-center justify-between gap-4" style={{ padding: '20px 28px 16px', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div>
          <h1 className="font-sans font-semibold text-base tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>Intern Cohort</h1>
          <p className="font-sans text-xs mt-0.5" style={{ color: 'var(--color-text2)' }}>
            Manage public intern names, photos, and optional tracks. Do not add private application data.
          </p>
        </div>
        <div className="w-full max-w-xs">
          <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Academic Year</label>
          <select
            value={selectedYear ?? ''}
            onChange={(event) => { setSelectedYear(Number(event.target.value)); resetForm(); }}
            className={inputCls}
            style={fieldStyle}
          >
            {academicYearOptions.map((year) => (
              <option key={year.start} value={year.start}>
                {`${year.label}${year.isActive ? ' (Active)' : ''}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]" style={{ padding: '20px 28px' }}>
        <form onSubmit={handleSave} className="rounded-md border p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                {editingMember ? 'Edit Intern' : 'Add Intern'}
              </h2>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                Only published entries appear on the public Intern Program page.
              </p>
            </div>
            {editingMember && (
              <button type="button" onClick={resetForm} className="rounded border px-3 py-1.5 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
                New
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Name *</label>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className={inputCls}
                style={fieldStyle}
                required
              />
            </div>

            <div>
              <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Role / Track</label>
              <input
                value={form.role_or_track}
                onChange={(event) => setForm({ ...form, role_or_track: event.target.value })}
                className={inputCls}
                style={fieldStyle}
                placeholder="Media, Events, VCN, etc."
              />
            </div>

            <div>
              <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Photo URL</label>
              <input
                type="url"
                value={form.photo_url}
                onChange={(event) => setForm({ ...form, photo_url: event.target.value })}
                className={inputCls}
                style={fieldStyle}
                placeholder="https://..."
              />
            </div>

            <div>
              <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Upload Photo</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => handlePhotoFile(event.target.files?.[0] ?? null)}
                className="block w-full text-xs"
                style={{ color: 'var(--color-text2)' }}
              />
            </div>

            <div className="flex items-center gap-4">
              <div
                className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded border"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="Intern preview" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-serif text-xl" style={{ color: 'var(--color-text3)' }}>{initials(form.name)}</span>
                )}
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text3)' }}>
                Uploaded files go to the public `intern_images` bucket. Use only photos approved for the website.
              </p>
            </div>

            <div>
              <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Caption</label>
              <textarea
                value={form.caption}
                onChange={(event) => setForm({ ...form, caption: event.target.value })}
                className={inputCls}
                style={fieldStyle}
                rows={2}
                placeholder="Optional short public caption"
              />
            </div>

            <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4">
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Order</label>
                <input
                  type="number"
                  value={form.display_order}
                  onChange={(event) => setForm({ ...form, display_order: Number(event.target.value) })}
                  className={inputCls}
                  style={fieldStyle}
                />
              </div>
              <label className="mt-6 flex items-center gap-2 text-sm" style={{ color: 'var(--color-text2)' }}>
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(event) => setForm({ ...form, is_published: event.target.checked })}
                />
                Published
              </label>
            </div>

            <div className="border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
              <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Source Doc URL (admin-only)</label>
              <input
                type="url"
                value={form.source_doc_url}
                onChange={(event) => setForm({ ...form, source_doc_url: event.target.value })}
                className={inputCls}
                style={fieldStyle}
                placeholder="Optional internal reference"
              />
            </div>

            <div>
              <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Internal Notes (admin-only)</label>
              <textarea
                value={form.internal_notes}
                onChange={(event) => setForm({ ...form, internal_notes: event.target.value })}
                className={inputCls}
                style={fieldStyle}
                rows={3}
              />
            </div>

            <button
              type="submit"
              disabled={saving || !selectedYear}
              className="w-full rounded bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
            >
              {saving ? 'Saving...' : editingMember ? 'Save Changes' : 'Add Intern'}
            </button>
          </div>
        </form>

        <div className="rounded-md border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {selectedYear ? `${formatAcademicYear(selectedYear)} Interns` : 'Interns'}
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text3)' }}>
              Published entries are visible on `/intern-program`; drafts stay admin-only.
            </p>
          </div>

          {error ? (
            <div className="px-5 py-10 text-sm text-amber-600 dark:text-amber-400">
              Intern cohort data could not be loaded. Apply the intern cohort migration before editing.
            </div>
          ) : loading ? (
            <div className="px-5 py-16 text-center text-sm" style={{ color: 'var(--color-text3)' }}>Loading interns...</div>
          ) : members.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm" style={{ color: 'var(--color-text3)' }}>
              No interns added for this academic year yet.
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {members.map((member) => (
                <div key={member.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
                      {member.photo_url ? (
                        <img src={member.photo_url} alt={member.name} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <span className="font-serif text-lg" style={{ color: 'var(--color-text3)' }}>{initials(member.name)}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{member.name}</p>
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ border: '1px solid var(--color-border)', color: member.is_published ? 'var(--color-text)' : 'var(--color-text3)' }}>
                          {member.is_published ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      {member.role_or_track && (
                        <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text2)' }}>{member.role_or_track}</p>
                      )}
                      <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-text3)' }}>
                        Order {member.display_order}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 sm:shrink-0">
                    <button type="button" onClick={() => startEdit(member)} className="rounded border px-3 py-1.5 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDelete(member)} className="rounded border border-red-900/30 px-3 py-1.5 text-xs text-red-500">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
