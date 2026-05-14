import { FormEvent, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { PageTitle } from '../../components/common/PageTitle';
import { PageLoader } from '../../components/common/PageLoader';
import { PageError } from '../../components/common/PageError';
import { useAllVcnArchives } from '../../hooks/useVcnArchives';
import { VCNArchive } from '../../types';
import { VCNArchiveFormData, vcnArchivesRepository } from '../../data/repos/vcnArchives';

type VCNArchiveFormState = {
  year: string;
  title: string;
  annual_number: string;
  theme_name: string;
  event_date: string;
  event_time: string;
  venue: string;
  description: string;
  video_url: string;
  photo_album_url: string;
  album_source: string;
  cover_image_url: string;
  poster_url: string;
  trailer_url: string;
  photo_credit: string;
  is_published: boolean;
  is_featured: boolean;
  is_current: boolean;
  ticket_status: string;
  ticket_url: string;
  ticket_note: string;
  display_order: string;
  source_doc_url: string;
  internal_notes: string;
};

const EMPTY_FORM: VCNArchiveFormState = {
  year: '',
  title: '',
  annual_number: '',
  theme_name: '',
  event_date: '',
  event_time: '',
  venue: '',
  description: '',
  video_url: '',
  photo_album_url: '',
  album_source: '',
  cover_image_url: '',
  poster_url: '',
  trailer_url: '',
  photo_credit: '',
  is_published: false,
  is_featured: false,
  is_current: false,
  ticket_status: 'hidden',
  ticket_url: '',
  ticket_note: '',
  display_order: '0',
  source_doc_url: '',
  internal_notes: '',
};

const inputCls = 'mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 placeholder:text-zinc-600';
const labelCls = 'block text-xs font-medium text-zinc-500 uppercase tracking-label';

function toNullable(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formFromArchive(archive: VCNArchive): VCNArchiveFormState {
  return {
    year: String(archive.year),
    title: archive.title ?? '',
    annual_number: archive.annual_number ?? '',
    theme_name: archive.theme_name ?? '',
    event_date: archive.event_date ?? '',
    event_time: archive.event_time ?? '',
    venue: archive.venue ?? '',
    description: archive.description ?? '',
    video_url: archive.video_url ?? '',
    photo_album_url: archive.photo_album_url ?? '',
    album_source: archive.album_source ?? '',
    cover_image_url: archive.cover_image_url ?? '',
    poster_url: archive.poster_url ?? '',
    trailer_url: archive.trailer_url ?? '',
    photo_credit: archive.photo_credit ?? '',
    is_published: archive.is_published,
    is_featured: archive.is_featured,
    is_current: archive.is_current,
    ticket_status: archive.ticket_status ?? 'hidden',
    ticket_url: archive.ticket_url ?? '',
    ticket_note: archive.ticket_note ?? '',
    display_order: String(archive.display_order ?? 0),
    source_doc_url: archive.source_doc_url ?? '',
    internal_notes: archive.internal_notes ?? '',
  };
}

function archivePayloadFromForm(form: VCNArchiveFormState): VCNArchiveFormData {
  return {
    year: Number(form.year),
    title: toNullable(form.title),
    annual_number: toNullable(form.annual_number),
    theme_name: toNullable(form.theme_name),
    event_date: toNullable(form.event_date),
    event_time: toNullable(form.event_time),
    venue: toNullable(form.venue),
    description: toNullable(form.description),
    video_url: toNullable(form.video_url),
    photo_album_url: toNullable(form.photo_album_url),
    album_source: toNullable(form.album_source),
    cover_image_url: toNullable(form.cover_image_url),
    poster_url: toNullable(form.poster_url),
    trailer_url: toNullable(form.trailer_url),
    photo_credit: toNullable(form.photo_credit),
    is_published: form.is_published,
    is_featured: form.is_featured,
    is_current: form.is_current,
    ticket_status: form.ticket_status as VCNArchive['ticket_status'],
    ticket_url: toNullable(form.ticket_url),
    ticket_note: toNullable(form.ticket_note),
    display_order: Number(form.display_order || 0),
    source_doc_url: toNullable(form.source_doc_url),
    internal_notes: toNullable(form.internal_notes),
  };
}

export default function AdminVcnArchives() {
  const { archives, loading, error, refreshArchives } = useAllVcnArchives();
  const [selectedArchive, setSelectedArchive] = useState<VCNArchive | null>(null);
  const [form, setForm] = useState<VCNArchiveFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const publishedCount = useMemo(() => archives.filter((archive) => archive.is_published).length, [archives]);

  const resetForm = () => {
    setSelectedArchive(null);
    setForm(EMPTY_FORM);
  };

  const selectArchive = (archive: VCNArchive) => {
    setSelectedArchive(archive);
    setForm(formFromArchive(archive));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!form.year || Number.isNaN(Number(form.year))) {
      toast.error('Year is required');
      return;
    }

    try {
      setSaving(true);
      const payload = archivePayloadFromForm(form);

      if (selectedArchive) {
        await vcnArchivesRepository.updateArchive(selectedArchive.id, payload);
        toast.success('VCN archive updated');
      } else {
        await vcnArchivesRepository.createArchive(payload);
        toast.success('VCN archive created');
      }

      await refreshArchives();
      resetForm();
    } catch (err) {
      console.error('Error saving VCN archive:', err);
      toast.error('Failed to save VCN archive');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageTitle title="VCN Archive Management" />
        <PageLoader message="Loading VCN archive entries..." />
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageTitle title="VCN Archive Management" />
        <PageError message="Failed to load VCN archive entries" />
      </>
    );
  }

  return (
    <>
      <PageTitle title="VCN Archive Management" />

      <div className="border-b flex items-center justify-between" style={{ padding: '20px 28px 16px', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div>
          <h1 className="font-sans font-semibold text-base tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>VCN Archives</h1>
          <p className="font-sans text-xs mt-0.5" style={{ color: 'var(--color-text2)' }}>
            {archives.length} entries, {publishedCount} published
          </p>
        </div>
        <button
          type="button"
          onClick={resetForm}
          className="font-sans text-xs transition-colors duration-150 rounded border px-3 py-2"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)', background: 'transparent' }}
        >
          New Entry
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]" style={{ padding: '20px 28px' }}>
        <div className="rounded-md border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Entries</h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>Drafts are visible here but hidden from the public archive.</p>
          </div>

          {archives.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm" style={{ color: 'var(--color-text3)' }}>
              No VCN archive entries yet.
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {archives.map((archive) => (
                <button
                  key={archive.id}
                  type="button"
                  onClick={() => selectArchive(archive)}
                  className="block w-full px-5 py-4 text-left transition-opacity hover:opacity-80"
                  style={{
                    background: selectedArchive?.id === archive.id ? 'var(--color-surface2)' : 'transparent',
                    border: 'none',
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                        {archive.year} {archive.title ? `· ${archive.title}` : ''}
                      </p>
                      <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
                        {archive.annual_number ?? 'Annual number unknown'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {archive.is_current && (
                        <span
                          className="rounded-sm border px-2 py-0.5 font-sans text-[11px] text-brand-600 dark:text-brand-400"
                          style={{ borderColor: 'var(--color-border)' }}
                        >
                          Current
                        </span>
                      )}
                      <span
                        className="rounded-sm border px-2 py-0.5 font-sans text-[11px]"
                        style={{
                          borderColor: 'var(--color-border)',
                          color: archive.is_published ? 'var(--color-text)' : 'var(--color-text3)',
                        }}
                      >
                        {archive.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="rounded-md border p-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
                {selectedArchive ? `Edit ${selectedArchive.year}` : 'Create VCN Archive Entry'}
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-text2)' }}>
                Store links and metadata only. External photos stay on their original platforms.
              </p>
            </div>
            {selectedArchive && (
              <button type="button" onClick={resetForm} className="text-xs" style={{ color: 'var(--color-text3)' }}>
                Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className={labelCls}>Year *</label>
              <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className={inputCls} required min="1900" max="2100" />
            </div>
            <div>
              <label className={labelCls}>Annual Number</label>
              <input type="text" value={form.annual_number} onChange={(e) => setForm({ ...form, annual_number: e.target.value })} className={inputCls} placeholder="29th Annual" />
            </div>
            <div>
              <label className={labelCls}>Title</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Theme Name</label>
              <input type="text" value={form.theme_name} onChange={(e) => setForm({ ...form, theme_name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Event Date</label>
              <input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Event Time</label>
              <input type="text" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} className={inputCls} placeholder="6:00 PM" />
            </div>
            <div>
              <label className={labelCls}>Venue</label>
              <input type="text" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} className={inputCls} />
            </div>
          </div>

          <div className="mt-5">
            <label className={labelCls}>Description / Synopsis</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} rows={4} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className={labelCls}>Video URL</label>
              <input type="url" value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} className={inputCls} placeholder="https://youtube.com/watch?v=..." />
            </div>
            <div>
              <label className={labelCls}>Photo Album URL</label>
              <input type="url" value={form.photo_album_url} onChange={(e) => setForm({ ...form, photo_album_url: e.target.value })} className={inputCls} placeholder="https://photos.app.goo.gl/... or SmugMug" />
            </div>
            <div>
              <label className={labelCls}>Album Source</label>
              <input type="text" value={form.album_source} onChange={(e) => setForm({ ...form, album_source: e.target.value })} className={inputCls} placeholder="Google Photos, SmugMug" />
            </div>
            <div>
              <label className={labelCls}>Cover Image URL</label>
              <input type="url" value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Poster URL</label>
              <input type="url" value={form.poster_url} onChange={(e) => setForm({ ...form, poster_url: e.target.value })} className={inputCls} placeholder="https://..." />
            </div>
            <div>
              <label className={labelCls}>Trailer URL</label>
              <input type="url" value={form.trailer_url} onChange={(e) => setForm({ ...form, trailer_url: e.target.value })} className={inputCls} placeholder="https://youtube.com/embed/..." />
            </div>
          </div>

          <div className="mt-5 rounded border p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
            <h3 className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Current Show CTA
            </h3>
            <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
              Used by /vcn/current. Ticket links only render publicly when status is Open or Active.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className={labelCls}>Ticket Status</label>
                <select value={form.ticket_status} onChange={(e) => setForm({ ...form, ticket_status: e.target.value })} className={inputCls}>
                  <option value="hidden">Hidden</option>
                  <option value="coming_soon">Coming Soon</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                  <option value="active">Active</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Ticket URL</label>
                <input type="url" value={form.ticket_url} onChange={(e) => setForm({ ...form, ticket_url: e.target.value })} className={inputCls} placeholder="https://..." />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Ticket Note</label>
                <input type="text" value={form.ticket_note} onChange={(e) => setForm({ ...form, ticket_note: e.target.value })} className={inputCls} placeholder="Optional public note" />
              </div>
            </div>
          </div>

          <div className="mt-5">
            <label className={labelCls}>Photo Credit</label>
            <textarea value={form.photo_credit} onChange={(e) => setForm({ ...form, photo_credit: e.target.value })} className={inputCls} rows={2} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className={labelCls}>Source Doc URL</label>
              <input type="url" value={form.source_doc_url} onChange={(e) => setForm({ ...form, source_doc_url: e.target.value })} className={inputCls} placeholder="Admin-only Drive/source link" />
              <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>
                Admin-only. This link is never selected by public pages.
              </p>
            </div>
            <div>
              <label className={labelCls}>Internal Notes</label>
              <textarea value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} className={inputCls} rows={3} />
              <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>
                Admin-only. These notes are not rendered publicly.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[160px_1fr]">
            <div>
              <label className={labelCls}>Display Order</label>
              <input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} className={inputCls} />
            </div>
            <div className="flex flex-wrap items-end gap-5">
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text2)' }}>
                <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
                Published
              </label>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text2)' }}>
                <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
                Featured
              </label>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text2)' }}>
                <input type="checkbox" checked={form.is_current} onChange={(e) => setForm({ ...form, is_current: e.target.checked })} />
                Current
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-6 w-full rounded bg-brand-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : selectedArchive ? 'Save Changes' : 'Create Entry'}
          </button>
        </form>
      </div>
    </>
  );
}
