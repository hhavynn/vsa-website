import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../../lib/supabase';
import { PageTitle } from '../../components/common/PageTitle';
import { AdminNav } from '../../components/features/admin/AdminNav';

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

  const closeEditModal = () => {
    if (editCoverPreview) URL.revokeObjectURL(editCoverPreview);
    setAlbumToEdit(null);
    setEditCoverFile(null);
    setEditCoverPreview(null);
  };

  const handleEditCover = async () => {
    if (!albumToEdit || !editCoverFile) return;
    try {
      setEditSaving(true);

      // Upload new cover
      const ext = editCoverFile.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('gallery_images')
        .upload(fileName, editCoverFile);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('gallery_images').getPublicUrl(fileName);
      const newCoverUrl = urlData.publicUrl;

      // Delete old cover from storage if it was one we uploaded
      if (albumToEdit.cover_image_url?.includes('gallery_images')) {
        const oldFile = albumToEdit.cover_image_url.split('/').pop();
        if (oldFile) await supabase.storage.from('gallery_images').remove([oldFile]);
      }

      // Update the row
      const { error: updateErr } = await supabase
        .from('gallery_events')
        .update({ cover_image_url: newCoverUrl })
        .eq('id', albumToEdit.id);
      if (updateErr) throw updateErr;

      toast.success('Cover photo updated!');
      setAlbums(prev =>
        prev.map(a => a.id === albumToEdit.id ? { ...a, cover_image_url: newCoverUrl } : a)
      );
      closeEditModal();
    } catch (err) {
      console.error('Error updating cover:', err);
      toast.error('Failed to update cover photo');
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

  const inputCls = 'mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 placeholder-gray-500';
  const labelCls = 'block text-sm font-medium text-gray-300';

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <PageTitle title="Gallery Management" />
      <AdminNav />

      {/* Tab switcher */}
      <div className="flex space-x-3 mb-6">
        {(['create', 'manage'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg font-medium text-sm transition-colors ${
              activeTab === tab
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {tab === 'create' ? 'Add Album' : `Manage Albums (${albums.length})`}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        {activeTab === 'create' ? (
          <>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Add Google Photos Album</h2>
            <p className="text-sm text-gray-400 mb-6">
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
                <p className="mt-1 text-xs text-gray-500">
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
                      className="h-40 w-auto rounded-lg object-cover border border-gray-600"
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
                    className={`mt-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors ${
                      isDragActive
                        ? 'border-indigo-500 bg-indigo-900/20'
                        : 'border-gray-600 bg-gray-700/30 hover:border-gray-500'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <svg className="w-8 h-8 text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-400 text-sm font-medium">
                      {isDragActive ? 'Drop it here...' : 'Drag & drop a cover photo'}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">or click to browse — PNG, JPG, WebP</p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
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
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Manage Albums
            </h2>
            {albums.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p>No albums yet. Add one to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {albums.map(album => (
                  <div key={album.id} className="border border-gray-700 rounded-xl overflow-hidden bg-gray-900 flex flex-col">
                    {/* Cover */}
                    <div className="relative h-36 bg-gray-800">
                      {album.cover_image_url ? (
                        <img
                          src={album.cover_image_url}
                          alt={album.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900/40 to-violet-900/40">
                          <svg className="w-10 h-10 text-indigo-400/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    <div className="p-4 flex flex-col flex-grow">
                      <h3 className="font-semibold text-white text-sm">{album.title}</h3>
                      {album.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{album.description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(album.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>

                      <div className="mt-auto pt-4 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <a
                            href={album.google_photos_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 text-center py-1.5 text-xs rounded-md bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-700/50 transition-colors"
                          >
                            Open Album ↗
                          </a>
                          <button
                            onClick={() => setAlbumToDelete(album)}
                            className="py-1.5 px-3 text-xs rounded-md bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-700/40 hover:border-transparent transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                        <button
                          onClick={() => setAlbumToEdit(album)}
                          className="w-full py-1.5 text-xs rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600 transition-colors"
                        >
                          Change Cover Photo
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

      {/* Edit Cover Photo Modal */}
      {albumToEdit && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">Change Cover Photo</h3>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>

            {/* Current cover */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Current cover</p>
              {albumToEdit.cover_image_url ? (
                <img
                  src={albumToEdit.cover_image_url}
                  alt={albumToEdit.title}
                  className="w-full h-36 object-cover rounded-lg border border-gray-700"
                />
              ) : (
                <div className="w-full h-36 rounded-lg border border-gray-700 bg-gray-800 flex items-center justify-center text-gray-600 text-sm">
                  No cover photo set
                </div>
              )}
            </div>

            {/* New cover dropzone */}
            <div className="mb-5">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">New cover</p>
              {editCoverPreview ? (
                <div className="relative">
                  <img
                    src={editCoverPreview}
                    alt="New cover preview"
                    className="w-full h-36 object-cover rounded-lg border border-indigo-600/50"
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
                  className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${
                    isEditDragActive
                      ? 'border-indigo-500 bg-indigo-900/20'
                      : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                  }`}
                >
                  <input {...getEditInputProps()} />
                  <svg className="w-7 h-7 text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-400 text-sm">{isEditDragActive ? 'Drop it here...' : 'Drag & drop or click to select'}</p>
                  <p className="text-gray-600 text-xs mt-1">PNG, JPG, WebP</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeEditModal}
                className="flex-1 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditCover}
                disabled={!editCoverFile || editSaving}
                className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {editSaving ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Saving...
                  </>
                ) : 'Save Cover'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {albumToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full border border-gray-700 p-6">
            <h3 className="text-xl font-bold text-white mb-2">Delete Album</h3>
            <p className="text-gray-400 mb-1">Are you sure you want to remove:</p>
            <p className="text-white font-semibold mb-2">"{albumToDelete.title}"</p>
            <p className="text-gray-500 text-sm mb-6">
              This removes it from the website. Your Google Photos album won't be affected.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setAlbumToDelete(null)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
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
