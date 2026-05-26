import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../../lib/supabase';
import { formatDateOnly, toDateOnlyString } from '../../lib/dateOnly';
import { PageTitle } from '../../components/common/PageTitle';
import { extractSupabasePublicObjectName, getUploadExtension, prepareImageForUpload } from '../../lib/imageUpload';

interface GalleryAlbum {
  id: string;
  title: string;
  description: string;
  date: string;
  google_photos_url: string;
  cover_image_url: string | null;
  cover_thumbnail_url: string | null;
  event_id: string | null;
}

interface UploadedGalleryCover {
  imageUrl: string;
  thumbnailUrl: string;
}

interface EventOption {
  id: string;
  name: string;
  date: string;
}

const EMPTY_FORM = {
  title: '',
  description: '',
  date: '',
  google_photos_url: '',
  event_id: '' as string,
};

export default function AdminGallery() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [albumToDelete, setAlbumToDelete] = useState<GalleryAlbum | null>(null);
  const [albumToEdit, setAlbumToEdit] = useState<GalleryAlbum | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', date: '', google_photos_url: '', event_id: '' as string });
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');

  const fetchAlbums = async () => {
    const { data, error } = await supabase
      .from('gallery_events')
      .select('id, title, description, date, google_photos_url, cover_image_url, cover_thumbnail_url, event_id')
      .order('date', { ascending: false });
    if (!error) setAlbums((data ?? []) as GalleryAlbum[]);
  };

  const fetchEventOptions = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('id, name, date')
      .order('date', { ascending: false });
    if (!error) setEventOptions((data ?? []) as EventOption[]);
  };

  useEffect(() => { fetchAlbums(); fetchEventOptions(); }, []);

  // Revoke stale object URL on unmount / change
  useEffect(() => {
    return () => { if (coverPreview) URL.revokeObjectURL(coverPreview); };
  }, [coverPreview]);

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }, [coverPreview]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  const removeCover = () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview(null);
  };

  // Edit cover dropzone
  const onEditDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    if (editCoverPreview) URL.revokeObjectURL(editCoverPreview);
    setEditCoverFile(file);
    setEditCoverPreview(URL.createObjectURL(file));
  }, [editCoverPreview]);

  const { getRootProps: getEditRootProps, getInputProps: getEditInputProps, isDragActive: isEditDragActive } = useDropzone({
    onDrop: onEditDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  async function uploadCoverImage(file: File): Promise<UploadedGalleryCover> {
    const { file: preparedFile, reduction, wasCompressed } = await prepareImageForUpload(file, 'galleryCover');
    const { file: thumbnailFile } = await prepareImageForUpload(file, 'galleryCoverThumbnail');
    const uploadId = crypto.randomUUID();
    const fileName = `${uploadId}.${getUploadExtension(preparedFile)}`;
    const thumbnailName = `thumbs/${uploadId}.${getUploadExtension(thumbnailFile)}`;
    const { error } = await supabase.storage
      .from('gallery_images')
      .upload(fileName, preparedFile, {
        cacheControl: '31536000',
        contentType: preparedFile.type,
      });
    if (error) throw error;

    const { error: thumbnailError } = await supabase.storage
      .from('gallery_images')
      .upload(thumbnailName, thumbnailFile, {
        cacheControl: '31536000',
        contentType: thumbnailFile.type,
      });
    if (thumbnailError) {
      await supabase.storage.from('gallery_images').remove([fileName]);
      throw thumbnailError;
    }

    if (wasCompressed && reduction > 10) {
      toast.success(`Cover photo optimized (reduced by ${reduction}%)`, { icon: '⚡' });
    }

    const { data } = supabase.storage.from('gallery_images').getPublicUrl(fileName);
    const { data: thumbnailData } = supabase.storage.from('gallery_images').getPublicUrl(thumbnailName);
    return {
      imageUrl: data.publicUrl,
      thumbnailUrl: thumbnailData.publicUrl,
    };
  }

  async function removeGalleryImage(url?: string | null) {
    const objectName = extractSupabasePublicObjectName(url, 'gallery_images');
    if (objectName) await supabase.storage.from('gallery_images').remove([objectName]);
  }

  const openEditModal = (album: GalleryAlbum) => {
    setAlbumToEdit(album);
    setEditForm({
      title: album.title ?? '',
      description: album.description ?? '',
      date: toDateOnlyString(album.date),
      google_photos_url: album.google_photos_url ?? '',
      event_id: album.event_id ?? '',
    });
    setEditCoverFile(null);
    setEditCoverPreview(null);
  };

  const closeEditModal = () => {
    if (editCoverPreview) URL.revokeObjectURL(editCoverPreview);
    setAlbumToEdit(null);
    setEditCoverFile(null);
    setEditCoverPreview(null);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!albumToEdit) return;
    if (!editForm.title || !editForm.date || !editForm.google_photos_url) {
      toast.error('Title, date, and Google Photos link are required');
      return;
    }
    const eventDate = toDateOnlyString(editForm.date);
    if (!eventDate) {
      toast.error('Please enter a valid event date');
      return;
    }
    try {
      setEditSaving(true);

      // Upload new cover if one was selected
      let coverImageUrl = albumToEdit.cover_image_url;
      let coverThumbnailUrl = albumToEdit.cover_thumbnail_url;
      let coverImageToRemove: string | null = null;
      let coverThumbnailToRemove: string | null = null;
      if (editCoverFile) {
        const uploadedCover = await uploadCoverImage(editCoverFile);
        coverImageUrl = uploadedCover.imageUrl;
        coverThumbnailUrl = uploadedCover.thumbnailUrl;
        coverImageToRemove = albumToEdit.cover_image_url;
        coverThumbnailToRemove = albumToEdit.cover_thumbnail_url;
      }

      const nextEventId = editForm.event_id ? editForm.event_id : null;
      const { error: updateErr } = await supabase
        .from('gallery_events')
        .update({
          title: editForm.title,
          name: editForm.title,
          description: editForm.description,
          date: eventDate,
          google_photos_url: editForm.google_photos_url,
          cover_image_url: coverImageUrl,
          cover_thumbnail_url: coverThumbnailUrl,
          event_id: nextEventId,
        })
        .eq('id', albumToEdit.id);
      if (updateErr) throw updateErr;
      await removeGalleryImage(coverImageToRemove);
      await removeGalleryImage(coverThumbnailToRemove);

      toast.success('Album updated!');
      setAlbums(prev =>
        prev.map(a =>
          a.id === albumToEdit.id
            ? { ...a, ...editForm, date: eventDate, cover_image_url: coverImageUrl, cover_thumbnail_url: coverThumbnailUrl, event_id: nextEventId }
            : a
        )
      );
      closeEditModal();
    } catch (err) {
      console.error('Error updating album:', err);
      toast.error('Failed to update album');
    } finally {
      setEditSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.date || !form.google_photos_url) {
      toast.error('Title, date, and Google Photos link are required');
      return;
    }
    const eventDate = toDateOnlyString(form.date);
    if (!eventDate) {
      toast.error('Please enter a valid event date');
      return;
    }
    if (!form.google_photos_url.includes('photos')) {
      toast.error('Please enter a valid Google Photos album link');
      return;
    }

    try {
      setUploading(true);

      let coverImageUrl: string | null = null;
      let coverThumbnailUrl: string | null = null;
      if (coverFile) {
        const uploadedCover = await uploadCoverImage(coverFile);
        coverImageUrl = uploadedCover.imageUrl;
        coverThumbnailUrl = uploadedCover.thumbnailUrl;
      }

      const { error } = await supabase.from('gallery_events').insert([{
        title: form.title,
        name: form.title,           // keep legacy column in sync
        description: form.description,
        date: eventDate,
        google_photos_url: form.google_photos_url,
        cover_image_url: coverImageUrl,
        cover_thumbnail_url: coverThumbnailUrl,
        event_id: form.event_id ? form.event_id : null,
        images: [],                 // legacy column — no longer used
      }]);

      if (error) throw error;

      toast.success('Album added!');
      setForm(EMPTY_FORM);
      removeCover();
      fetchAlbums();
      setActiveTab('manage');
    } catch (err) {
      console.error('Error adding album:', err);
      toast.error('Failed to add album');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!albumToDelete) return;
    try {
      // Delete cover from storage if it was uploaded
      await removeGalleryImage(albumToDelete.cover_image_url);
      await removeGalleryImage(albumToDelete.cover_thumbnail_url);
      const { error } = await supabase
        .from('gallery_events')
        .delete()
        .eq('id', albumToDelete.id);
      if (error) throw error;
      toast.success(`"${albumToDelete.title}" deleted`);
      setAlbums(prev => prev.filter(a => a.id !== albumToDelete.id));
    } catch (err) {
      console.error('Error deleting album:', err);
      toast.error('Failed to delete album');
    } finally {
      setAlbumToDelete(null);
    }
  };

  const inputCls = 'mt-1 block w-full rounded border px-3 py-2.5 text-[15px] sm:py-2 sm:text-sm focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] bg-[var(--color-surface2)] border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text3)] transition';
  const labelCls = 'block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)]';

  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Gallery Management" />

      <div className="border-b px-6 py-6 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-8 sm:py-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="mb-4 sm:mb-0">
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>Gallery</h1>
          <p className="mt-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>Manage public photo albums</p>
        </div>
        <div className="inline-flex overflow-hidden rounded border" style={{ borderColor: 'var(--color-border)' }}>
          {(['create', 'manage'] as const).map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="font-sans text-[13px] font-semibold transition-colors duration-150 sm:text-sm"
              style={{ padding: '8px 16px', fontWeight: activeTab === tab ? 600 : 500, background: activeTab === tab ? 'var(--color-surface2)' : 'transparent', color: activeTab === tab ? 'var(--color-text)' : 'var(--color-text2)', borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none', cursor: 'pointer' }}>
              {tab === 'create' ? 'Add Album' : 'Manage Albums'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="scrapbook-paper min-h-[500px]" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        {activeTab === 'create' ? (
          <>
            <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--color-text)' }}>Add Google Photos Album</h2>
            <p className="mb-6 text-sm" style={{ color: 'var(--color-text2)' }}>
              Each album links out to your Google Photos shared album. Upload a cover photo so it looks great on the gallery page.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>Album Title *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    className={inputCls}
                    required
                    placeholder="Spring Formal 2025"
                  />
                </div>
                <div>
                  <label className={labelCls}>Event Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className={inputCls}
                  rows={2}
                  placeholder="A short description of the event..."
                />
              </div>

              <div>
                <label className={labelCls}>Google Photos Album Link *</label>
                <input
                  type="url"
                  value={form.google_photos_url}
                  onChange={e => setForm({ ...form, google_photos_url: e.target.value })}
                  className={inputCls}
                  required
                  placeholder="https://photos.app.goo.gl/..."
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>
                  In Google Photos, open the album, click Share, then copy the public link.
                </p>
              </div>

              <div>
                <label className={labelCls}>
                  Related Event
                  <span className="ml-1 font-normal" style={{ color: 'var(--color-text3)' }}>(optional)</span>
                </label>
                <select
                  value={form.event_id}
                  onChange={e => setForm({ ...form, event_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="">— No linked event —</option>
                  {eventOptions.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {formatDateOnly(ev.date, { month: 'short', day: 'numeric', year: 'numeric' })} — {ev.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>
                  Linking lets the Events page show a "View Photos" button on the matching past event.
                </p>
              </div>

              {/* Cover photo upload */}
              <div>
                <label className={labelCls}>Cover Photo <span className="font-normal" style={{ color: 'var(--color-text3)' }}>(optional but recommended)</span></label>
                <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>
                  New uploads create a smaller public thumbnail. Older images may still use original URLs until thumbnails are regenerated.
                </p>
                {coverPreview ? (
                  <div className="mt-2 relative inline-block">
                    <img
                      src={coverPreview}
                      alt="Cover preview"
                      className="h-40 w-auto rounded object-cover border border-zinc-700"
                    />
                    <button
                      type="button"
                      onClick={removeCover}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/70 hover:bg-red-600 text-white rounded-full text-sm flex items-center justify-center transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div
                    {...getRootProps()}
                    className={`mt-1 flex flex-col items-center justify-center border border-dashed rounded p-8 cursor-pointer transition-colors ${
                      isDragActive
                        ? 'border-zinc-400 bg-zinc-800/20'
                        : 'border-zinc-700 bg-zinc-900/40 hover:border-zinc-500'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <svg className="w-8 h-8 text-zinc-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text2)' }}>
                      {isDragActive ? 'Drop it here...' : 'Drag & drop a cover photo'}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>or click to browse - PNG, JPG, WebP</p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-medium py-2.5 rounded transition-colors flex items-center justify-center gap-2 text-sm"
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Saving...
                  </>
                ) : 'Add Album'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="mb-6 text-base font-semibold" style={{ color: 'var(--color-text)' }}>
              Manage Albums
            </h2>
            {albums.length === 0 ? (
              <div className="py-16 text-center" style={{ color: 'var(--color-text2)' }}>
                <svg className="mx-auto mb-3 h-12 w-12" style={{ color: 'var(--color-text3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p>No albums yet. Add one to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {albums.map(album => (
                  <div key={album.id} className="flex flex-col overflow-hidden rounded-md border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
                    {/* Cover */}
                    <div className="relative h-36" style={{ background: 'var(--color-surface2)' }}>
                      {(album.cover_thumbnail_url || album.cover_image_url) ? (
                        <img
                          src={album.cover_thumbnail_url || album.cover_image_url || ''}
                          alt={album.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="h-10 w-10" style={{ color: 'var(--color-text3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    <div className="p-4 flex flex-col flex-grow">
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{album.title}</h3>
                      {album.description && (
                        <p className="mt-1 line-clamp-2 text-xs" style={{ color: 'var(--color-text2)' }}>{album.description}</p>
                      )}
                      <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>
                        {formatDateOnly(album.date, { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>

                      <div className="mt-auto pt-4 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <a
                            href={album.google_photos_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 rounded border py-1.5 text-center text-xs transition-colors"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
                          >
                            Open Album ↗
                          </a>
                          <button
                            onClick={() => setAlbumToDelete(album)}
                            className="py-1.5 px-3 text-xs rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                        <button
                          onClick={() => openEditModal(album)}
                          className="w-full rounded border py-1.5 text-xs transition-colors"
                          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
                        >
                          Edit Album
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Album Modal */}
      {albumToEdit && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="my-8 w-full max-w-2xl rounded-md border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--color-border)' }}>
              <h3 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Edit Album</h3>
              <button onClick={closeEditModal} className="text-2xl leading-none" style={{ color: 'var(--color-text3)' }}>&times;</button>
            </div>

            <form onSubmit={handleEditSave} className="p-6 space-y-5">
              {/* Title + Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>Album Title *</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Event Date *</label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  className={inputCls}
                  rows={2}
                />
              </div>

              {/* Google Photos URL */}
              <div>
                <label className={labelCls}>Google Photos Album Link *</label>
                <input
                  type="url"
                  value={editForm.google_photos_url}
                  onChange={e => setEditForm({ ...editForm, google_photos_url: e.target.value })}
                  className={inputCls}
                  required
                />
              </div>

              {/* Related Event */}
              <div>
                <label className={labelCls}>
                  Related Event
                  <span className="ml-1 font-normal" style={{ color: 'var(--color-text3)' }}>(optional)</span>
                </label>
                <select
                  value={editForm.event_id}
                  onChange={e => setEditForm({ ...editForm, event_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="">— No linked event —</option>
                  {eventOptions.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {formatDateOnly(ev.date, { month: 'short', day: 'numeric', year: 'numeric' })} — {ev.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cover photo */}
              <div>
                <label className={labelCls}>
                  Cover Photo
                  <span className="ml-1 font-normal" style={{ color: 'var(--color-text3)' }}>(leave empty to keep current)</span>
                </label>
                <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>
                  New uploads create a smaller public thumbnail. Older images may still use original URLs until thumbnails are regenerated.
                </p>

                {/* Show current cover if no new one staged */}
                {!editCoverPreview && (albumToEdit.cover_thumbnail_url || albumToEdit.cover_image_url) && (
                  <div className="mt-2 mb-3">
                    <p className="mb-1.5 text-xs" style={{ color: 'var(--color-text3)' }}>Current</p>
                    <img
                      src={albumToEdit.cover_thumbnail_url || albumToEdit.cover_image_url || ''}
                      alt={albumToEdit.title}
                      className="w-full h-36 object-cover rounded border border-zinc-700"
                    />
                  </div>
                )}

                {editCoverPreview ? (
                  <div className="relative mt-2">
                    <p className="mb-1.5 text-xs" style={{ color: 'var(--color-text3)' }}>New cover staged</p>
                    <img
                      src={editCoverPreview}
                      alt="New cover preview"
                      className="w-full h-36 object-cover rounded border border-zinc-400/60"
                    />
                    <button
                      type="button"
                      onClick={() => { if (editCoverPreview) URL.revokeObjectURL(editCoverPreview); setEditCoverFile(null); setEditCoverPreview(null); }}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/70 hover:bg-red-600 text-white rounded-full text-sm flex items-center justify-center transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div
                    {...getEditRootProps()}
                    className={`mt-2 flex flex-col items-center justify-center border border-dashed rounded p-5 cursor-pointer transition-colors ${
                      isEditDragActive
                        ? 'border-zinc-400 bg-zinc-800/20'
                        : 'border-zinc-700 bg-zinc-900/40 hover:border-zinc-500'
                    }`}
                  >
                    <input {...getEditInputProps()} />
                    <svg className="w-6 h-6 text-zinc-600 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm" style={{ color: 'var(--color-text2)' }}>{isEditDragActive ? 'Drop it here...' : 'Drag & drop or click to replace cover'}</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>PNG, JPG, WebP</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 pt-4 sm:flex-row-reverse sm:justify-start">
                <button
                  type="submit"
                  disabled={editSaving}
                  className="vsa-btn-primary sm:px-8 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {editSaving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Saving...
                    </>
                  ) : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded border bg-transparent px-6 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--color-surface2)]"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {albumToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="scrapbook-paper w-full max-w-sm p-6 sm:p-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <h3 className="mb-3 font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>Delete Album</h3>
            <p className="mb-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>Are you sure you want to remove:</p>
            <p className="mb-2 font-sans text-[15px] font-bold" style={{ color: 'var(--color-text)' }}>"{albumToDelete.title}"</p>
            <p className="mb-6 font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
              This removes it from the website. Your Google Photos album won't be affected.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setAlbumToDelete(null)}
                className="rounded border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--color-surface2)]"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              >
                Remove Album
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
