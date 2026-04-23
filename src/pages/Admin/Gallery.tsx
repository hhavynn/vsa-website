import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../../lib/supabase';
import { PageTitle } from '../../components/common/PageTitle';
import { AdminNav } from '../../components/features/admin/AdminNav';

interface GalleryEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  images: string[];
}

const EMPTY_GALLERY = { title: '', description: '', date: '' };

export default function AdminGallery() {
  const [newGallery, setNewGallery] = useState(EMPTY_GALLERY);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [galleries, setGalleries] = useState<GalleryEvent[]>([]);
  const [galleryToDelete, setGalleryToDelete] = useState<GalleryEvent | null>(null);
  const previewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    previewUrlsRef.current = previewUrls;
  }, [previewUrls]);

  useEffect(() => {
    return () => previewUrlsRef.current.forEach(URL.revokeObjectURL);
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const combined = [...selectedFiles, ...acceptedFiles];
    const newUrls = [...previewUrls, ...acceptedFiles.map(f => URL.createObjectURL(f))];
    setSelectedFiles(combined);
    setPreviewUrls(newUrls);
  }, [selectedFiles, previewUrls]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] },
    multiple: true,
  });

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    setPreviewUrls(previewUrls.filter((_, i) => i !== index));
  };

  const fetchGalleries = async () => {
    const { data, error } = await supabase
      .from('gallery_events')
      .select('*')
      .order('date', { ascending: false });
    if (!error) setGalleries(data || []);
  };

  useEffect(() => { fetchGalleries(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length < 1) {
      toast.error('Please select at least 1 image');
      return;
    }

    try {
      setUploading(true);

      const imageUrls = await Promise.all(
        selectedFiles.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${crypto.randomUUID()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('gallery_images')
            .upload(fileName, file);
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('gallery_images').getPublicUrl(fileName);
          return data.publicUrl;
        })
      );

      const { error } = await supabase.from('gallery_events').insert([{
        title: newGallery.title,
        description: newGallery.description,
        date: newGallery.date,
        images: imageUrls,
      }]);

      if (error) throw error;

      toast.success('Gallery created!');
      setNewGallery(EMPTY_GALLERY);
      setSelectedFiles([]);
      setPreviewUrls([]);
      fetchGalleries();
    } catch (err) {
      console.error('Error creating gallery:', err);
      toast.error('Failed to create gallery');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteGallery = async () => {
    if (!galleryToDelete) return;
    try {
      // Delete images from storage
      await Promise.all(
        galleryToDelete.images.map(async (imageUrl) => {
          const imagePath = imageUrl.split('/').pop();
          if (imagePath) {
            await supabase.storage.from('gallery_images').remove([imagePath]);
          }
        })
      );

      const { error } = await supabase.from('gallery_events').delete().eq('id', galleryToDelete.id);
      if (error) throw error;

      toast.success(`"${galleryToDelete.title}" deleted`);
      setGalleries(prev => prev.filter(g => g.id !== galleryToDelete.id));
    } catch (err) {
      console.error('Error deleting gallery:', err);
      toast.error('Failed to delete gallery');
    } finally {
      setGalleryToDelete(null);
    }
  };

  const inputCls = 'mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2';
  const labelCls = 'block text-sm font-medium text-gray-300';

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <PageTitle title="Gallery Management" />
      <AdminNav />

      {/* Create Gallery Form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Create New Gallery</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Gallery Title *</label>
              <input
                type="text"
                value={newGallery.title}
                onChange={e => setNewGallery({ ...newGallery, title: e.target.value })}
                className={inputCls}
                required
                placeholder="Spring Formal 2025"
              />
            </div>
            <div>
              <label className={labelCls}>Date *</label>
              <input
                type="date"
                value={newGallery.date}
                onChange={e => setNewGallery({ ...newGallery, date: e.target.value })}
                className={inputCls}
                required
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Description *</label>
            <textarea
              value={newGallery.description}
              onChange={e => setNewGallery({ ...newGallery, description: e.target.value })}
              className={inputCls}
              rows={2}
              required
              placeholder="A short description of this event..."
            />
          </div>

          {/* Dropzone */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>Images *</label>
              {selectedFiles.length > 0 && (
                <span className="text-sm text-indigo-400 font-medium">
                  {selectedFiles.length} image{selectedFiles.length !== 1 ? 's' : ''} selected
                </span>
              )}
            </div>
            <div
              {...getRootProps()}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-indigo-500 bg-indigo-900/20'
                  : 'border-gray-600 bg-gray-700/30 hover:border-gray-500'
              }`}
            >
              <input {...getInputProps()} />
              <div className="text-center">
                <p className="text-gray-300 text-sm font-medium">
                  {isDragActive ? 'Drop images here...' : 'Drag & drop images here'}
                </p>
                <p className="text-gray-500 text-xs mt-1">or click to browse — PNG, JPG, GIF, WebP</p>
              </div>
            </div>
          </div>

          {/* Image previews with individual remove */}
          {previewUrls.length > 0 && (
            <div>
              <p className="text-sm text-gray-400 mb-3">Preview — click × to remove</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {previewUrls.map((url, index) => (
                  <div key={index} className="relative group aspect-square">
                    <img
                      src={url}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/70 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={uploading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {uploading ? `Uploading ${selectedFiles.length} image${selectedFiles.length !== 1 ? 's' : ''}...` : 'Create Gallery'}
          </button>
        </form>
      </div>

      {/* Existing Galleries */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Existing Galleries ({galleries.length})
        </h2>
        {galleries.length === 0 ? (
          <p className="text-gray-400 text-center py-12">No galleries yet. Create one above.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {galleries.map((gallery) => (
              <div key={gallery.id} className="border border-gray-700 rounded-xl overflow-hidden bg-gray-900">
                {/* Image grid preview (up to 6) */}
                <div className={`grid gap-0.5 ${gallery.images.length === 1 ? 'grid-cols-1' : gallery.images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {gallery.images.slice(0, 6).map((image, index) => (
                    <div key={index} className="relative aspect-square">
                      <img
                        src={image}
                        alt={`${gallery.title} ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {index === 5 && gallery.images.length > 6 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="text-white font-bold text-lg">+{gallery.images.length - 6}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-white">{gallery.title}</h3>
                  <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">{gallery.description}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <p className="text-xs text-gray-500">
                        {new Date(gallery.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-gray-500">{gallery.images.length} photo{gallery.images.length !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                      onClick={() => setGalleryToDelete(gallery)}
                      className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white text-sm rounded-md transition-colors border border-red-700/50 hover:border-transparent"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {galleryToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full border border-gray-700 p-6">
            <h3 className="text-xl font-bold text-white mb-2">Delete Gallery</h3>
            <p className="text-gray-400 mb-1">Are you sure you want to delete:</p>
            <p className="text-white font-semibold mb-2">"{galleryToDelete.title}"</p>
            <p className="text-gray-500 text-sm mb-6">
              This will permanently delete the gallery and all {galleryToDelete.images.length} photo{galleryToDelete.images.length !== 1 ? 's' : ''} from storage.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setGalleryToDelete(null)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleDeleteGallery} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors">
                Delete Gallery
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
