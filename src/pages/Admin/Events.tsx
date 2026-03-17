import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useEvents } from '../../hooks/useEvents';
import { supabase } from '../../lib/supabase';
import { Event } from '../../types';
import { useDropzone } from 'react-dropzone';
import { PageTitle } from '../../components/common/PageTitle';
import { ManualCheckIn } from '../../components/features/admin/ManualCheckIn';
import { AdminNav } from '../../components/features/admin/AdminNav';
import { EVENT_TYPE_LABELS } from '../../constants/eventTypes';

const EMPTY_EVENT: Partial<Event> = {
  name: '',
  description: '',
  date: '',
  location: '',
  event_type: 'other',
  check_in_form_url: '',
  points: 0,
};

export default function AdminEvents() {
  const { events, refreshEvents } = useEvents();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [newEvent, setNewEvent] = useState<Partial<Event>>(EMPTY_EVENT);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const [copiedCode, setCopiedCode] = useState(false);

  // Edit form file upload states
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editUploading, setEditUploading] = useState(false);

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const upcomingEvents = events
    .filter((e: Event) => new Date(e.date) >= oneDayAgo)
    .sort((a: Event, b: Event) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pastEvents = events
    .filter((e: Event) => new Date(e.date) < oneDayAgo)
    .sort((a: Event, b: Event) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] },
    maxFiles: 1,
  });

  const onEditDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setEditImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setEditImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps: getEditRootProps, getInputProps: getEditInputProps, isDragActive: isEditDragActive } = useDropzone({
    onDrop: onEditDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] },
    maxFiles: 1,
  });

  async function uploadImage(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const { error } = await supabase.storage.from('event_images').upload(fileName, file);
    if (error) throw error;
    const { data } = supabase.storage.from('event_images').getPublicUrl(fileName);
    return data.publicUrl;
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.name || !newEvent.description || !newEvent.date || !newEvent.location) return;

    try {
      setUploading(true);
      const imageUrl = imageFile ? await uploadImage(imageFile) : null;
      const checkInCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { error } = await supabase.from('events').insert([{
        name: newEvent.name,
        description: newEvent.description,
        date: newEvent.date,
        location: newEvent.location,
        event_type: newEvent.event_type,
        check_in_form_url: newEvent.check_in_form_url || '',
        points: newEvent.points,
        image_url: imageUrl,
        check_in_code: checkInCode,
        is_code_expired: false,
      }]);

      if (error) throw error;

      toast.success('Event created!');
      setNewEvent(EMPTY_EVENT);
      setImageFile(null);
      setImagePreview(null);
      refreshEvents();
      setActiveTab('manage');
    } catch (err) {
      console.error('Error creating event:', err);
      toast.error('Failed to create event');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!eventToDelete) return;
    try {
      const { error } = await supabase.from('events').delete().eq('id', eventToDelete.id);
      if (error) throw error;
      toast.success(`"${eventToDelete.name}" deleted`);
      refreshEvents();
      if (selectedEvent?.id === eventToDelete.id) setSelectedEvent(null);
    } catch (err) {
      console.error('Error deleting event:', err);
      toast.error('Failed to delete event');
    } finally {
      setEventToDelete(null);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    try {
      setEditUploading(true);
      let imageUrl = selectedEvent.image_url;
      if (editImageFile) {
        imageUrl = await uploadImage(editImageFile);
      }

      const { error } = await supabase.from('events').update({
        name: selectedEvent.name,
        description: selectedEvent.description,
        date: selectedEvent.date,
        location: selectedEvent.location,
        event_type: selectedEvent.event_type,
        points: selectedEvent.points,
        image_url: imageUrl,
        check_in_code: selectedEvent.check_in_code,
        is_code_expired: selectedEvent.is_code_expired,
        check_in_form_url: selectedEvent.check_in_form_url || '',
      }).eq('id', selectedEvent.id);

      if (error) throw error;

      toast.success('Event updated!');
      setEditImageFile(null);
      setEditImagePreview(null);
      setSelectedEvent(null);
      refreshEvents();
    } catch (err) {
      console.error('Error updating event:', err);
      toast.error('Failed to update event');
    } finally {
      setEditUploading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!selectedEvent?.check_in_code) return;
    await navigator.clipboard.writeText(selectedEvent.check_in_code);
    setCopiedCode(true);
    toast.success('Check-in code copied!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const inputCls = 'mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2';
  const labelCls = 'block text-sm font-medium text-gray-300';

  const EventCard = ({ event }: { event: Event }) => (
    <div className="bg-gray-900 rounded-lg shadow-xl p-5 border border-gray-700 hover:border-indigo-500 transition-colors">
      {event.image_url && (
        <img src={event.image_url} alt={event.name} className="w-full h-36 object-cover rounded-md mb-4" />
      )}
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-white truncate">{event.name}</h3>
          <p className="text-gray-400 text-sm mt-1 line-clamp-2">{event.description}</p>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className="text-xs text-gray-400">
              {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
              {EVENT_TYPE_LABELS[event.event_type]}
            </span>
            <span className="text-xs text-emerald-400 font-medium">{event.points} pts</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={() => { setSelectedEvent(event); setEditImageFile(null); setEditImagePreview(null); }}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => setEventToDelete(event)}
            className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white text-sm rounded-md transition-colors border border-red-700/50 hover:border-transparent"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <PageTitle title="Event Management" />
      <AdminNav />

      {/* Tab switcher */}
      <div className="flex space-x-3 mb-6">
        {(['create', 'manage'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg font-medium text-sm transition-colors ${
              activeTab === tab
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {tab === 'create' ? 'Create Event' : `Manage Events (${events.length})`}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        {activeTab === 'create' ? (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Create New Event</h2>
            <form onSubmit={handleCreateEvent} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>Event Title *</label>
                  <input type="text" value={newEvent.name} onChange={e => setNewEvent({ ...newEvent, name: e.target.value })} className={inputCls} required placeholder="Spring GBM" />
                </div>
                <div>
                  <label className={labelCls}>Location *</label>
                  <input type="text" value={newEvent.location} onChange={e => setNewEvent({ ...newEvent, location: e.target.value })} className={inputCls} required placeholder="Price Center Ballroom" />
                </div>
                <div>
                  <label className={labelCls}>Date & Time *</label>
                  <input type="datetime-local" value={newEvent.date} onChange={e => setNewEvent({ ...newEvent, date: e.target.value })} className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Event Type *</label>
                  <select value={newEvent.event_type} onChange={e => setNewEvent({ ...newEvent, event_type: e.target.value as Event['event_type'] })} className={inputCls} required>
                    {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Points *</label>
                  <input type="number" value={newEvent.points} onChange={e => setNewEvent({ ...newEvent, points: Number(e.target.value) })} min="0" max="1000" className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Check-in Form URL</label>
                  <input type="url" value={newEvent.check_in_form_url} onChange={e => setNewEvent({ ...newEvent, check_in_form_url: e.target.value })} className={inputCls} placeholder="https://forms.google.com/..." />
                </div>
              </div>
              <div>
                <label className={labelCls}>Description *</label>
                <textarea value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} className={inputCls} rows={3} required placeholder="What's this event about?" />
              </div>
              <div>
                <label className={labelCls}>Event Image</label>
                <div {...getRootProps()} className={`mt-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${isDragActive ? 'border-indigo-500 bg-indigo-900/20' : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'}`}>
                  <input {...getInputProps()} />
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="max-h-48 rounded-md object-cover" />
                  ) : (
                    <div className="text-center">
                      <p className="text-gray-400 text-sm">Drag & drop or click to select an image</p>
                      <p className="text-gray-500 text-xs mt-1">PNG, JPG, GIF, WebP</p>
                    </div>
                  )}
                </div>
                {imageFile && (
                  <button type="button" className="mt-2 text-sm text-red-400 hover:text-red-300" onClick={() => { setImageFile(null); setImagePreview(null); }}>
                    × Remove image
                  </button>
                )}
              </div>
              <button type="submit" disabled={uploading} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors">
                {uploading ? 'Creating...' : 'Create Event'}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Manage Events</h2>
            {upcomingEvents.length === 0 && pastEvents.length === 0 && (
              <p className="text-gray-400 text-center py-12">No events yet. Create one to get started.</p>
            )}
            {upcomingEvents.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Upcoming ({upcomingEvents.length})</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {upcomingEvents.map((event: Event) => <EventCard key={event.id} event={event} />)}
                </div>
              </div>
            )}
            {pastEvents.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Past ({pastEvents.length})</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {pastEvents.map((event: Event) => <EventCard key={event.id} event={event} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Event Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl my-8 border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">Edit Event</h2>
              <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>Event Title *</label>
                  <input type="text" value={selectedEvent.name} onChange={e => setSelectedEvent({ ...selectedEvent, name: e.target.value })} className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Location *</label>
                  <input type="text" value={selectedEvent.location} onChange={e => setSelectedEvent({ ...selectedEvent, location: e.target.value })} className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Date & Time *</label>
                  <input type="datetime-local" value={formatDateForInput(selectedEvent.date)} onChange={e => setSelectedEvent({ ...selectedEvent, date: e.target.value })} className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Event Type *</label>
                  <select value={selectedEvent.event_type} onChange={e => setSelectedEvent({ ...selectedEvent, event_type: e.target.value as Event['event_type'] })} className={inputCls} required>
                    {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Points *</label>
                  <input type="number" value={selectedEvent.points} onChange={e => setSelectedEvent({ ...selectedEvent, points: Number(e.target.value) })} min="0" max="1000" className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Check-in Form URL</label>
                  <input type="url" value={selectedEvent.check_in_form_url || ''} onChange={e => setSelectedEvent({ ...selectedEvent, check_in_form_url: e.target.value })} className={inputCls} placeholder="https://forms.google.com/..." />
                </div>
              </div>
              <div>
                <label className={labelCls}>Description *</label>
                <textarea value={selectedEvent.description} onChange={e => setSelectedEvent({ ...selectedEvent, description: e.target.value })} className={inputCls} rows={3} required />
              </div>

              {/* Check-in code with copy button */}
              <div>
                <label className={labelCls}>Check-in Code</label>
                <div className="mt-1 flex gap-2">
                  <input type="text" value={selectedEvent.check_in_code || ''} onChange={e => setSelectedEvent({ ...selectedEvent, check_in_code: e.target.value })} className={`${inputCls} mt-0 font-mono tracking-widest`} />
                  <button type="button" onClick={handleCopyCode} className={`shrink-0 px-4 py-2 rounded-md text-sm font-medium transition-colors ${copiedCode ? 'bg-emerald-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
                    {copiedCode ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <label className="flex items-center gap-2 mt-2 text-sm text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={selectedEvent.is_code_expired} onChange={e => setSelectedEvent({ ...selectedEvent, is_code_expired: e.target.checked })} className="rounded" />
                  Mark code as expired
                </label>
              </div>

              {/* Image section */}
              <div>
                <label className={labelCls}>Event Image</label>
                {selectedEvent.image_url && !editImagePreview && (
                  <div className="mt-2 mb-3">
                    <img src={selectedEvent.image_url} alt={selectedEvent.name} className="w-full h-40 object-cover rounded-lg border border-gray-600" />
                    <button type="button" className="mt-2 text-sm text-red-400 hover:text-red-300" onClick={() => setSelectedEvent({ ...selectedEvent, image_url: '' })}>
                      × Remove current image
                    </button>
                  </div>
                )}
                <div {...getEditRootProps()} className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-5 cursor-pointer transition-colors ${isEditDragActive ? 'border-indigo-500 bg-indigo-900/20' : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'}`}>
                  <input {...getEditInputProps()} />
                  {editImagePreview ? (
                    <img src={editImagePreview} alt="New preview" className="max-h-40 rounded-md object-cover" />
                  ) : (
                    <p className="text-gray-400 text-sm">Drag & drop or click to replace image</p>
                  )}
                </div>
                {editImageFile && (
                  <button type="button" className="mt-2 text-sm text-red-400 hover:text-red-300" onClick={() => { setEditImageFile(null); setEditImagePreview(null); }}>
                    × Remove new image
                  </button>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={editUploading} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors">
                  {editUploading ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setSelectedEvent(null)} className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </form>

            <div className="border-t border-gray-700 p-6">
              <ManualCheckIn eventId={selectedEvent.id} onSuccess={refreshEvents} />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {eventToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full border border-gray-700 p-6">
            <h3 className="text-xl font-bold text-white mb-2">Delete Event</h3>
            <p className="text-gray-400 mb-1">Are you sure you want to delete:</p>
            <p className="text-white font-semibold mb-6">"{eventToDelete.name}"</p>
            <p className="text-gray-500 text-sm mb-6">This action cannot be undone. All attendance records for this event will remain.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setEventToDelete(null)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleDeleteConfirm} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors">
                Delete Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
