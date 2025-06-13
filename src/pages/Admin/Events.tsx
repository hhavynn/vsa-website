import { useState, useCallback, useEffect } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { supabase } from '../../lib/supabase';
import { Event } from '../../types';
import { GenerateCheckInCode } from '../../components/Admin/GenerateCheckInCode';
import { useDropzone } from 'react-dropzone';
import { PageTitle } from '../../components/PageTitle';
import { ManualCheckIn } from '../../components/Admin/ManualCheckIn';

type EventType = 'general_event' | 'wildn_culture' | 'vcn_dance_practice' | 'vcn_attendance';

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  general_event: 'General Event',
  wildn_culture: 'Wild n\' Culture',
  vcn_dance_practice: 'VCN Dance Practice',
  vcn_attendance: 'VCN Attendance'
};

export default function AdminEvents() {
  const { events, refreshEvents } = useEvents();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [newEvent, setNewEvent] = useState<Partial<Event>>({
    name: '',
    description: '',
    date: '',
    location: '',
    event_type: 'general_event',
    check_in_form_url: '',
    points: 0
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    },
    maxFiles: 1
  });

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.name || !newEvent.description || !newEvent.date || !newEvent.location || !newEvent.check_in_form_url) {
      return;
    }

    try {
      setUploading(true);

      // Upload image if selected
      let imageUrl = null;
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('event_images')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;
        
        // Get the public URL of the uploaded image
        const { data: publicUrlData } = supabase.storage
          .from('event_images')
          .getPublicUrl(fileName);

        imageUrl = publicUrlData?.publicUrl;
      }

      // Generate a random check-in code
      const checkInCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Create event
      const { error } = await supabase
        .from('events')
        .insert([
          {
            name: newEvent.name,
            description: newEvent.description,
            date: newEvent.date,
            location: newEvent.location,
            event_type: newEvent.event_type,
            check_in_form_url: newEvent.check_in_form_url,
            points: newEvent.points,
            image_url: imageUrl,
            check_in_code: checkInCode,
            is_code_expired: false
          }
        ]);

      if (error) throw error;

      // Reset form
      setNewEvent({
        name: '',
        description: '',
        date: '',
        location: '',
        event_type: 'general_event',
        check_in_form_url: '',
        points: 0
      });
      setImageFile(null);
      setImagePreview(null);

      // Refresh events list
      refreshEvents();
    } catch (error) {
      console.error('Error creating event:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteClick = (eventId: string) => {
    setEventToDelete(eventId);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!eventToDelete) return;

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventToDelete);

      if (error) throw error;
      refreshEvents();
      if (selectedEvent?.id === eventToDelete) {
        setSelectedEvent(null);
      }
    } catch (error) {
      console.error('Error deleting event:', error);
    } finally {
      setShowDeleteConfirm(false);
      setEventToDelete(null);
    }
  };

  const handleExpireCode = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ is_code_expired: true })
        .eq('id', eventId);

      if (error) throw error;
      refreshEvents();
    } catch (error) {
      console.error('Error expiring code:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-white">Event Management</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold mb-4 text-white">Create Event</h2>
            <form onSubmit={handleCreateEvent} className="bg-gray-800 rounded-lg shadow-xl p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300">Event Title</label>
                  <input
                    type="text"
                    value={newEvent.name}
                    onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Description</label>
                  <textarea
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    rows={3}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Date</label>
                  <input
                    type="datetime-local"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Location</label>
                  <input
                    type="text"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Event Type</label>
                  <select
                    value={newEvent.event_type}
                    onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value as EventType })}
                    className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                  >
                    {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Points</label>
                  <input
                    type="number"
                    value={newEvent.points}
                    onChange={(e) => setNewEvent({ ...newEvent, points: Number(e.target.value) })}
                    min="0"
                    className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Check-in Form URL</label>
                  <input
                    type="url"
                    value={newEvent.check_in_form_url}
                    onChange={(e) => setNewEvent({ ...newEvent, check_in_form_url: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                    placeholder="https://docs.google.com/forms/d/e/..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Event Image</label>
                  <div {...getRootProps()} className={`mt-1 flex items-center justify-center border-2 border-dashed rounded-md p-4 cursor-pointer ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-600 bg-gray-700'}`}>
                    <input {...getInputProps()} />
                    {imagePreview ? (
                      <img src={imagePreview} alt="Event" className="max-h-48 rounded-md object-cover" />
                    ) : (
                      <span className="text-gray-400">Drag & drop or click to select an image</span>
                    )}
                  </div>
                  {imageFile && (
                    <button type="button" className="mt-2 text-red-400 hover:underline" onClick={() => { setImageFile(null); setImagePreview(null); }}>
                      Remove Image
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  disabled={uploading}
                >
                  {uploading ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4 text-white">Events List</h2>
            <div className="space-y-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className={`bg-gray-800 rounded-lg shadow-xl p-6 cursor-pointer transition-colors ${
                    selectedEvent?.id === event.id
                      ? 'ring-2 ring-indigo-500'
                      : 'hover:bg-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold mb-2 text-white">{event.name}</h3>
                      <p className="text-gray-300 mb-4">{event.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">
                          {new Date(event.date).toLocaleDateString()}
                        </span>
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-indigo-900 text-indigo-200">
                          {EVENT_TYPE_LABELS[event.event_type as EventType]}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(event.id);
                      }}
                      className="text-red-400 hover:text-red-500"
                    >
                      Delete
                    </button>
                  </div>
                  {event.image_url && (
                    <div className="mt-4">
                      <img src={event.image_url} alt="Event Image" className="w-full h-48 object-cover rounded-md" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {selectedEvent && (
          <div>
            <h2 className="text-2xl font-bold mb-4 text-white">Event Details</h2>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 mb-8">
              <h3 className="text-xl font-bold mb-2 text-white">{selectedEvent.name}</h3>
              <p className="text-gray-300 mb-4">{selectedEvent.description}</p>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-semibold mb-2 text-white">Check-in Code</h4>
                  <div className="flex items-center space-x-4">
                    <code className="px-4 py-2 bg-gray-900 rounded-lg text-white font-mono">
                      {selectedEvent.check_in_code}
                    </code>
                    {!selectedEvent.is_code_expired && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExpireCode(selectedEvent.id);
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Expire Code
                      </button>
                    )}
                  </div>
                  {selectedEvent.is_code_expired && (
                    <p className="mt-2 text-red-400">This code has expired</p>
                  )}
                </div>

                <ManualCheckIn
                  eventId={selectedEvent.id}
                  onSuccess={() => {
                    // Refresh event data after successful check-in
                    refreshEvents();
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-white">Confirm Delete</h3>
            <p className="text-gray-300 mb-6">Are you sure you want to delete this event? This action cannot be undone.</p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setEventToDelete(null);
                }}
                className="px-4 py-2 text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 