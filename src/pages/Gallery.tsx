import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface GalleryEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  images: string[];
}

export default function Gallery() {
  const [galleries, setGalleries] = useState<GalleryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGallery, setSelectedGallery] = useState<GalleryEvent | null>(null);

  useEffect(() => {
    fetchGalleries();
  }, []);

  const fetchGalleries = async () => {
    try {
      const { data, error } = await supabase
        .from('gallery_events')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setGalleries(data || []);
    } catch (err) {
      setError('Failed to load galleries');
      console.error('Error fetching galleries:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600 text-center">
          <p className="text-xl font-semibold">{error}</p>
          <p className="mt-2">Please try again later</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      {/* Hero Section */}
      <div className="bg-[#1a365d] text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-4">Event Gallery</h1>
          <p className="text-xl text-center text-gray-200 max-w-2xl mx-auto">
            Explore our collection of memorable moments and special events
          </p>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {galleries.map((gallery) => (
            <div
              key={gallery.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transform transition-all duration-300 hover:shadow-xl cursor-pointer border border-gray-200 dark:border-gray-700"
              onClick={() => setSelectedGallery(gallery)}
            >
              <div className="relative">
                <img
                  src={gallery.images[0]}
                  alt={gallery.title}
                  className="w-full h-64 object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#1a365d]/80 to-transparent p-4">
                  <h2 className="text-xl font-bold text-white mb-1">{gallery.title}</h2>
                  <p className="text-gray-200 text-sm">
                    {new Date(gallery.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
              <div className="p-4">
                <p className="text-gray-600 dark:text-gray-300 line-clamp-2">{gallery.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal for Gallery Details */}
      {selectedGallery && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedGallery.title}</h2>
                  <p className="text-gray-600 dark:text-gray-300">
                    {new Date(selectedGallery.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedGallery(null)}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-6">{selectedGallery.description}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {selectedGallery.images.map((image, index) => (
                  <div key={index} className="aspect-w-16 aspect-h-9">
                    <img
                      src={image}
                      alt={`${selectedGallery.title} - ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg shadow-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 