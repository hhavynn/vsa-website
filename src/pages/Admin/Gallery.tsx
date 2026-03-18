import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../../lib/supabase';
import { PageTitle } from '../../components/common/PageTitle';

interface GalleryAlbum {
  id: string;
  title: string;
  description: string;
  date: string;
  google_photos_url: string;
  cover_image_url: string | null;
}

const EMPTY_FORM = {
  title: '',
  description: '',
  date: '',
  google_photos_url: '',
};

export default function AdminGallery() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [albumToDelete, setAlbumToDelete] = useState<GalleryAlbum | null>(null);
  const [albumToEdit, setAlbumToEdit] = useState<GalleryAlbum | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', date: '', google_photos_url: '' });
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');

  const fetchAlbums = async () => {
    const { data, error } = await supabase
      .from('gallery_events')
      .select('id, title, description, date, google_photos_url, cover_image_url')
      .order('date', { ascending: false });
    if (!error) setAlbums((data ?? []) as GalleryAlbum[]);
  };

  useEffect(() => { fetchAlbums(); }, []);

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
  });

  const openEditModal = (album: GalleryAlbum) => {
    setAlbumToEdit(album);
    setEditForm({
      title: album.title ?? '',
      description: album.description ?? '',
      date: album.date ?? '',
      google_photos_url: album.google_photos_url ?? '',
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
    try {
      setEditSaving(true);

      // Upload new cover if one was selected
      let coverImageUrl = albumToEdit.cover_image_url;
      if (editCoverFile) {
        const ext = editCoverFile.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('gallery_images')
          .upload(fileName, editCoverFile);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('gallery_images').getPublicUrl(fileName);
        coverImageUrl = urlData.publicUrl;

        // Delete old cover from storage if we uploaded it
        if (albumToEdit.cover_image_url?.includes('gallery_images')) {
          const oldFile = albumToEdit.cover_image_url.split('/').pop();
          if (oldFile) await supabase.storage.from('gallery_images').remove([oldFile]);
        }
      }

      const { error: updateErr } = await supabase
        .from('gallery_events')
        .update({
          title: editForm.title,
          name: editForm.title,
          description: editForm.description,
          date: editForm.date,
          google_photos_url: editForm.google_photos_url,
          cover_image_url: coverImageUrl,
        })
        .eq('id', albumToEdit.id);
      if (updateErr) throw updateErr;

      toast.success('Album updated!');
      setAlbums(prev =>
        prev.map(a =>
          a.id === albumToEdit.id
            ? { ...a, ...editForm, cover_image_url: coverImageUrl }
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
    if (!form.google_photos_url.includes('photos')) {
      toast.error('Please enter a valid Google Photos album link');
      return;
    }

    try {
      setUploading(true);

      let coverImageUrl: string | null = null;
      if (coverFile) {
        const ext = coverFile.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('gallery_images')
          .upload(fileName, coverFile);
        if (uploadErr) throw uploadErr;
        const { data } = supabase.storage.from('gallery_images').getPublicUrl(fileName);
        coverImageUrl = data.publicUrl;
      }

      const { error } = await supabase.from('gallery_events').insert([{
        title: form.title,
        name: form.title,           // keep legacy column in sync
        description: form.description,
        date: form.date,
        google_photos_url: form.google_photos_url,
        cover_image_url: coverImageUrl,
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
      if (albumToDelete.cover_image_url?.includes('gallery_images')) {
        const fileName = albumToDelete.cover_image_url.split('/').pop();
        if (fileName) await supabase.storage.from('gallery_images').remove([fileName]);
      }
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

  const inputCls = 'mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 text-zinc-100 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 px-3 py-2 text-sm placeholder:text-zinc-600';
  const labelCls = 'block text-xs font-medium text-zinc-500 uppercase tracking-label mb-1';

  return (
    <div className="py-6">
      <PageTitle title="Gallery Management" />

      {/* Tab switcher */}
      <div className="flex space-x-1 mb-6 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded p-1 w-fit">
        {(['create', 'manage'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-zinc-800 text-zinc-50'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            {tab === 'create' ? 'Add Album' : `Manage Albums (${albums.length})`}
          </button>
        ))}
      </div>

      <div className="border border-zinc-200 dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-md p-6">
        {activeTab === 'create' ? (
          <>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-1">Add Google Photos Album</h2>
            <p className="text-sm text-zinc-500 mb-6">
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
                <p className="mt-1 text-xs text-zinc-500">
                  In Google Photos → open the album → click Share → Copy link
                </p>
              </div>

              {/* Cover photo upload */}
              <div>
                <label className={labelCls}>Cover Photo <span className="text-gray-500 font-normal">(optional but recommended)</span></label>
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
                    <p className="text-zinc-400 text-sm font-medium">
                      {isDragActive ? 'Drop it here...' : 'Drag & drop a cover photo'}
                    </p>
                    <p className="text-zinc-600 text-xs mt-1">or click to browse — PNG, JPG, WebP</p>
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
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-6">
              Manage Albums
            </h2>
            {albums.length === 0 ? (
              <div className="text-center py-16 text-zinc-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p>No albums yet. Add one to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {albums.map(album => (
                  <div key={album.id} className="border border-zinc-200 dark:border-zinc-700 rounded-md overflow-hidden bg-white dark:bg-zinc-900 flex flex-col">
                    {/* Cover */}
                    <div className="relative h-36 bg-zinc-100 dark:bg-zinc-800">
                      {album.cover_image_url ? (
                        <img
                          src={album.cover_image_url}
                          alt={album.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-10 h-10 text-zinc-400 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    <div className="p-4 flex flex-col flex-grow">
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm">{album.title}</h3>
                      {album.description && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">{album.description}</p>
                      )}
                      <p className="text-xs text-zinc-400 mt-1">
                        {new Date(album.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>

                      <div className="mt-auto pt-4 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <a
                            href={album.google_photos_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 text-center py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
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
                          className="w-full py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
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
          <div className="bg-zinc-900 rounded-md max-w-2xl w-full my-8 border border-zinc-800">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="text-base font-semibold text-zinc-50">Edit Album</h3>
              <button onClick={closeEditModal} className="text-zinc-500 hover:text-zinc-100 text-2xl leading-none">&times;</button>
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

              {/* Cover photo */}
              <div>
                <label className={labelCls}>
                  Cover Photo
                  <span className="text-zinc-600 font-normal ml-1">(leave empty to keep current)</span>
                </label>

                {/* Show current cover if no new one staged */}
                {!editCoverPreview && albumToEdit.cover_image_url && (
                  <div className="mt-2 mb-3">
                    <p className="text-xs text-zinc-500 mb-1.5">Current</p>
                    <img
                      src={albumToEdit.cover_image_url}
                      alt={albumToEdit.title}
                      className="w-full h-36 object-cover rounded border border-zinc-700"
                    />
                  </div>
                )}

                {editCoverPreview ? (
                  <div className="relative mt-2">
                    <p className="text-xs text-zinc-500 mb-1.5">New cover (staged)</p>
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
                    <p className="text-zinc-400 text-sm">{isEditDragActive ? 'Drop it here...' : 'Drag & drop or click to replace cover'}</p>
                    <p className="text-zinc-600 text-xs mt-1">PNG, JPG, WebP</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 py-2.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-100 text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 py-2.5 rounded bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {editSaving ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Saving...
                    </>
                  ) : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {albumToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-md max-w-md w-full border border-zinc-800 p-6">
            <h3 className="text-base font-semibold text-zinc-50 mb-2">Delete Album</h3>
            <p className="text-zinc-400 text-sm mb-1">Are you sure you want to remove:</p>
            <p className="text-zinc-100 font-semibold text-sm mb-2">"{albumToDelete.title}"</p>
            <p className="text-zinc-500 text-sm mb-6">
              This removes it from the website. Your Google Photos album won't be affected.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setAlbumToDelete(null)}
                className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
              >
                Remove Album
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
