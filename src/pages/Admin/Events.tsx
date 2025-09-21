import { useState, useCallback } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { supabase } from '../../lib/supabase';
import { Event } from '../../types';
import { useDropzone } from 'react-dropzone';
import { PageTitle } from '../../components/PageTitle';
import { ManualCheckIn } from '../../components/Admin/ManualCheckIn';
import { AdminNav } from '../../components/Admin/AdminNav';
import { EVENT_TYPE_LABELS } from '../../constants/eventTypes';

export default function AdminEvents() {
  console.log('AdminEvents component mounting...');
  const { events, refreshEvents } = useEvents();
  console.log('Events data:', events);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [newEvent, setNewEvent] = useState<Partial<Event>>({
    name: '',
    description: '',
    date: '',
    location: '',
    event_type: 'other',
    check_in_form_url: '',
    points: 0
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  
  // Edit form file upload states
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editUploading, setEditUploading] = useState(false);

  // Helper function to format date for datetime-local input
  const formatDateForInput = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) return '';
    // Format as YYYY-MM-DDTHH:MM for datetime-local input
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Split events into upcoming and past
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const upcomingEvents = events
    .filter((event: Event) => new Date(event.date) >= oneDayAgo)
    .sort((a: Event, b: Event) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pastEvents = events
    .filter((event: Event) => new Date(event.date) < oneDayAgo)
    .sort((a: Event, b: Event) => new Date(b.date).getTime() - new Date(a.date).getTime());

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

  // Edit form dropzone handlers
  const onEditDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setEditImageFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setEditImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps: getEditRootProps, getInputProps: getEditInputProps, isDragActive: isEditDragActive } = useDropzone({
    onDrop: onEditDrop,
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
        event_type: 'other',
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


  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <PageTitle title="Event Management" />
      <AdminNav />
      
      <div className="flex space-x-4 mb-8">
        <button
          onClick={() => setActiveTab('create')}
          className={`px-4 py-2 rounded-lg ${
            activeTab === 'create'
              ? 'bg-indigo-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          } transition-colors duration-200`}
        >
          Event Creation
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          className={`px-4 py-2 rounded-lg ${
            activeTab === 'manage'
              ? 'bg-indigo-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          } transition-colors duration-200`}
        >
          Event Management
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        {activeTab === 'create' ? (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create New Event</h2>
            <form onSubmit={handleCreateEvent} className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 text-gray-900 dark:text-white">
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
                    onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value as Event['event_type'] })}
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
        ) : (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Manage Events</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold mb-4 text-white">Upcoming Events ({upcomingEvents.length})</h3>
                <div className="space-y-4">
                  {upcomingEvents.map((event: Event) => (
                    <div
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className={`bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 cursor-pointer transition-colors ${
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
                              {EVENT_TYPE_LABELS[event.event_type]}
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

              {/* Divider */}
              <div className="border-t border-gray-700 my-8"></div>

              {/* Past Events Section */}
              <div>
                <h3 className="text-xl font-semibold mb-4 text-white">Past Events ({pastEvents.length})</h3>
                <div className="space-y-4">
                  {pastEvents.map((event: Event) => (
                    <div
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className={`bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 cursor-pointer transition-colors ${
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
                              {EVENT_TYPE_LABELS[event.event_type]}
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
          </div>
        )}
      </div>

      {selectedEvent && (
        <div>
          <h2 className="text-2xl font-bold mb-4 text-white">Edit Event</h2>
          <form
            className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 mb-8 space-y-4 text-gray-900 dark:text-white"
            onSubmit={async (e) => {
              e.preventDefault();
              
              try {
                setEditUploading(true);
                
                // Handle image upload if a new file is selected
                let imageUrl = selectedEvent.image_url; // Keep existing URL by default
                if (editImageFile) {
                  const fileExt = editImageFile.name.split('.').pop();
                  const fileName = `${Math.random()}.${fileExt}`;
                  const { error: uploadError } = await supabase.storage
                    .from('event_images')
                    .upload(fileName, editImageFile);

                  if (uploadError) throw uploadError;
                  
                  // Get the public URL of the uploaded image
                  const { data: publicUrlData } = supabase.storage
                    .from('event_images')
                    .getPublicUrl(fileName);

                  imageUrl = publicUrlData?.publicUrl;
                }

                // Update event in database
                const { data, error } = await supabase
                  .from('events')
                  .update({
                    name: selectedEvent.name,
                    description: selectedEvent.description,
                    date: selectedEvent.date,
                    location: selectedEvent.location,
                    event_type: selectedEvent.event_type,
                    points: selectedEvent.points,
                    image_url: imageUrl,
                    check_in_code: selectedEvent.check_in_code,
                    is_code_expired: selectedEvent.is_code_expired,
                    check_in_form_url: '', // Remove check-in form link
                  })
                  .eq('id', selectedEvent.id);
                  
                if (error) {
                  console.error('Error updating event:', error);
                } else {
                  console.log('Event updated successfully:', data);
                  refreshEvents();
                  // Reset edit form file upload states
                  setEditImageFile(null);
                  setEditImagePreview(null);
                }
              } catch (error) {
                console.error('Error updating event:', error);
              } finally {
                setEditUploading(false);
              }
            }}
          >
            <div>
              <label className="block text-sm font-medium text-gray-300">Event Title</label>
              <input
                type="text"
                value={selectedEvent.name}
                onChange={e => setSelectedEvent({ ...selectedEvent, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">Description</label>
              <textarea
                value={selectedEvent.description}
                onChange={e => setSelectedEvent({ ...selectedEvent, description: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                rows={3}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">Date</label>
              <input
                type="datetime-local"
                value={formatDateForInput(selectedEvent.date)}
                onChange={e => setSelectedEvent({ ...selectedEvent, date: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">Location</label>
              <input
                type="text"
                value={selectedEvent.location}
                onChange={e => setSelectedEvent({ ...selectedEvent, location: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">Event Type</label>
              <select
                value={selectedEvent.event_type}
                onChange={e => setSelectedEvent({ ...selectedEvent, event_type: e.target.value as Event['event_type'] })}
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
                value={selectedEvent.points}
                onChange={e => setSelectedEvent({ ...selectedEvent, points: Number(e.target.value) })}
                min="0"
                className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">Event Image</label>
              <div className="mt-1 space-y-2">
                {/* Current image display */}
                {selectedEvent.image_url && !editImagePreview && (
                  <div className="mb-2">
                    <p className="text-sm text-gray-400 mb-2">Current image:</p>
                    <img 
                      src={selectedEvent.image_url} 
                      alt="Current event image" 
                      className="w-full h-48 object-cover rounded-md border border-gray-600" 
                    />
                  </div>
                )}
                
                {/* File upload dropzone */}
                <div {...getEditRootProps()} className={`flex items-center justify-center border-2 border-dashed rounded-md p-4 cursor-pointer ${isEditDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-600 bg-gray-700'}`}>
                  <input {...getEditInputProps()} />
                  {editImagePreview ? (
                    <img src={editImagePreview} alt="New event image" className="max-h-48 rounded-md object-cover" />
                  ) : (
                    <span className="text-gray-400">Drag & drop or click to select a new image</span>
                  )}
                </div>
                
                {/* Remove image button */}
                {editImageFile && (
                  <button 
                    type="button" 
                    className="text-red-400 hover:underline text-sm" 
                    onClick={() => { 
                      setEditImageFile(null); 
                      setEditImagePreview(null); 
                    }}
                  >
                    Remove New Image
                  </button>
                )}
                
                {/* Keep existing image option */}
                {selectedEvent.image_url && !editImageFile && (
                  <button 
                    type="button" 
                    className="text-blue-400 hover:underline text-sm" 
                    onClick={() => setSelectedEvent({ ...selectedEvent, image_url: '' })}
                  >
                    Remove Current Image
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">Check-in Code</label>
              <input
                type="text"
                value={selectedEvent.check_in_code || ''}
                onChange={e => setSelectedEvent({ ...selectedEvent, check_in_code: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">Code Expired</label>
              <input
                type="checkbox"
                checked={selectedEvent.is_code_expired}
                onChange={e => setSelectedEvent({ ...selectedEvent, is_code_expired: e.target.checked })}
                className="ml-2"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={editUploading}
            >
              {editUploading ? 'Saving...' : 'Save'}
            </button>
          </form>
          <ManualCheckIn
            eventId={selectedEvent.id}
            onSuccess={() => {
              // Refresh event data after successful check-in
              refreshEvents();
            }}
          />
        </div>
      )}

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