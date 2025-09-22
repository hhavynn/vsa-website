import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { PageTitle } from '../../components/PageTitle';
import { AdminNav } from '../../components/Admin/AdminNav';

interface GalleryEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  images: string[];
}

export default function AdminGallery() {
  const [newGallery, setNewGallery] = useState<Omit<GalleryEvent, 'id'>>({
    title: '',
    description: '',
    date: '',
    images: []
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [galleries, setGalleries] = useState<GalleryEvent[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 6) {
      setError('You can only upload up to 6 images');
      return;
    }
    setSelectedFiles(files);
    setPreviewUrls(files.map(file => URL.createObjectURL(file)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length !== 6) {
      setError('Please select exactly 6 images');
      return;
    }

    try {
      setUploading(true);

      // Upload images
      const imageUrls = await Promise.all(
        selectedFiles.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('gallery_images')
            .upload(fileName, file);

          if (uploadError) throw uploadError;
          
          const { data: publicUrlData } = supabase.storage
            .from('gallery_images')
            .getPublicUrl(fileName);

          return publicUrlData?.publicUrl;
        })
      );

      // Create gallery event
      const { error } = await supabase
        .from('gallery_events')
        .insert([
          {
            title: newGallery.title,
            description: newGallery.description,
            date: newGallery.date,
            images: imageUrls
          }
        ]);

      if (error) throw error;

      // Reset form
      setNewGallery({
        title: '',
        description: '',
        date: '',
        images: []
      });
      setSelectedFiles([]);
      setPreviewUrls([]);

      // Refresh galleries list
      fetchGalleries();
    } catch (error) {
      console.error('Error creating gallery:', error);
    } finally {
      setUploading(false);
    }
  };

  const fetchGalleries = async () => {
    try {
      const { data, error } = await supabase
        .from('gallery_events')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setGalleries(data || []);
    } catch (error) {
      console.error('Error fetching galleries:', error);
    }
  };

  const handleDeleteGallery = async (galleryId: string) => {
    try {
      // First, delete all images from storage
      const { data: gallery } = await supabase
        .from('gallery_events')
        .select('images')
        .eq('id', galleryId)
        .single();

      if (gallery) {
        // Delete each image from storage
        await Promise.all(
          gallery.images.map(async (imageUrl: string) => {
            const imagePath = imageUrl.split('/').pop();
            if (imagePath) {
              await supabase.storage
                .from('gallery_images')
                .remove([imagePath]);
            }
          })
        );
      }

      // Then delete the gallery record
      const { error: deleteError } = await supabase
        .from('gallery_events')
        .delete()
        .eq('id', galleryId);

      if (deleteError) throw deleteError;

      // Update the galleries list
      setGalleries(galleries.filter(g => g.id !== galleryId));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting gallery:', err);
      setError('Failed to delete gallery');
    }
  };

  // Fetch galleries on component mount
  useEffect(() => {
    fetchGalleries();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <PageTitle title="Gallery Management" />
      <AdminNav />
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Create New Gallery</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Event Title</label>
            <input
              type="text"
              value={newGallery.title}
              onChange={(e) => setNewGallery({ ...newGallery, title: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
            <input
              type="date"
              value={newGallery.date}
              onChange={(e) => setNewGallery({ ...newGallery, date: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              value={newGallery.description}
              onChange={(e) => setNewGallery({ ...newGallery, description: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Images (Select 6 images)
            </label>
            <input
              type="file"
              onChange={handleFileSelect}
              accept="image/*"
              multiple
              className="w-full"
              required
            />
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>

          {previewUrls.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Preview</h3>
              <div className="grid grid-cols-3 gap-4">
                {previewUrls.map((url, index) => (
                  <div key={index} className="relative aspect-w-16 aspect-h-9">
                    <img
                      src={url}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={uploading}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Create Gallery'}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Existing Galleries</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {galleries.map((gallery) => (
            <div key={gallery.id} className="border rounded-lg overflow-hidden bg-white dark:bg-gray-700">
              <div className="grid grid-cols-3 gap-2 p-2">
                {gallery.images.map((image, index) => (
                  <div key={index} className="relative aspect-w-16 aspect-h-9">
                    <img
                      src={image}
                      alt={`${gallery.title} - ${index + 1}`}
                      className="w-full h-full object-cover rounded"
                    />
                  </div>
                ))}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">{gallery.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">{gallery.description}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {new Date(gallery.date).toLocaleDateString()}
                </p>
                <div className="mt-4 flex justify-end">
                  {deleteConfirm === gallery.id ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleDeleteGallery(gallery.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(gallery.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-4 text-white hover:text-gray-200"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
} 