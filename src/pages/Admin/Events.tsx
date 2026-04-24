import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useEvents } from '../../hooks/useEvents';
import { supabase } from '../../lib/supabase';
import { Event } from '../../types';
import { useDropzone } from 'react-dropzone';
import { PageTitle } from '../../components/common/PageTitle';
import { ManualCheckIn } from '../../components/features/admin/ManualCheckIn';
import { EVENT_TYPE_LABELS } from '../../constants/eventTypes';

const EMPTY_EVENT: Partial<Event> = {
  name: '', description: '', date: '', location: '',
  event_type: 'other', check_in_form_url: '', points: 0,
};

const inputCls = 'mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 placeholder:text-zinc-600';
const labelCls = 'block text-xs font-medium text-zinc-500 uppercase tracking-label';

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
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editUploading, setEditUploading] = useState(false);

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${d}T${h}:${mi}`;
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
    onDrop, accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] }, maxFiles: 1,
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
    onDrop: onEditDrop, accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] }, maxFiles: 1,
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
        name: newEvent.name, description: newEvent.description,
        date: new Date(newEvent.date!).toISOString(), location: newEvent.location,
        event_type: newEvent.event_type, check_in_form_url: newEvent.check_in_form_url || '',
        points: newEvent.points, image_url: imageUrl,
        check_in_code: checkInCode, is_code_expired: false,
      }]);
      if (error) throw error;
      toast.success('Event created');
      setNewEvent(EMPTY_EVENT); setImageFile(null); setImagePreview(null);
      refreshEvents(); setActiveTab('manage');
    } catch (err) {
      console.error(err); toast.error('Failed to create event');
    } finally { setUploading(false); }
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
      console.error(err); toast.error('Failed to delete event');
    } finally { setEventToDelete(null); }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    try {
      setEditUploading(true);
      let imageUrl = selectedEvent.image_url;
      if (editImageFile) imageUrl = await uploadImage(editImageFile);
      const { error } = await supabase.from('events').update({
        name: selectedEvent.name, description: selectedEvent.description,
        date: new Date(selectedEvent.date).toISOString(), location: selectedEvent.location,
        event_type: selectedEvent.event_type, points: selectedEvent.points,
        image_url: imageUrl, check_in_code: selectedEvent.check_in_code,
        is_code_expired: selectedEvent.is_code_expired,
        check_in_form_url: selectedEvent.check_in_form_url || '',
      }).eq('id', selectedEvent.id);
      if (error) throw error;
      toast.success('Event updated');
      setEditImageFile(null); setEditImagePreview(null); setSelectedEvent(null);
      refreshEvents();
    } catch (err) {
      console.error(err); toast.error('Failed to update event');
    } finally { setEditUploading(false); }
  };

  const handleCopyCode = async () => {
    if (!selectedEvent?.check_in_code) return;
    await navigator.clipboard.writeText(selectedEvent.check_in_code);
    setCopiedCode(true);
    toast.success('Copied');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const EventRow = ({ event }: { event: Event }) => (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
      {event.image_url && (
        <img src={event.image_url} alt={event.name} className="w-14 h-14 object-cover rounded shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">{event.name}</p>
        <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{event.description}</p>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className="text-xs text-zinc-400">
            {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <span className="px-1.5 py-0.5 text-xs border border-zinc-200 dark:border-zinc-700 text-zinc-500 rounded">
            {EVENT_TYPE_LABELS[event.event_type]}
          </span>
          <span className="text-xs text-emerald-500 font-medium">{event.points} pts</span>
        </div>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button
          onClick={() => { setSelectedEvent(event); setEditImageFile(null); setEditImagePreview(null); }}
          className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs rounded transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => setEventToDelete(event)}
          className="px-3 py-1.5 border border-red-900/30 text-red-500 hover:bg-red-600 hover:text-white text-xs rounded transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );

  return (
    <>
      <PageTitle title="Events" />

      <div className="border-b flex items-center justify-between" style={{ padding: '20px 28px 16px', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div>
          <h1 className="font-sans font-semibold text-base tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>Events</h1>
          <p className="font-sans text-xs mt-0.5" style={{ color: 'var(--color-text2)' }}>{events.length} events total</p>
        </div>
        {/* Tab toggle */}
        <div className="inline-flex border rounded overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
          {(['create', 'manage'] as const).map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="font-sans text-xs transition-colors duration-150"
              style={{ padding: '7px 14px', fontWeight: activeTab === tab ? 500 : 400, background: activeTab === tab ? 'var(--color-surface2)' : 'transparent', color: activeTab === tab ? 'var(--color-text)' : 'var(--color-text2)', borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none', cursor: 'pointer' }}>
              {tab === 'create' ? 'Create Event' : `Manage (${events.length})`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px 28px' }}>

      <div className="border border-zinc-200 dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-md p-6">
        {activeTab === 'create' ? (
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-5">Create Event</h2>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={labelCls}>Title *</label><input type="text" value={newEvent.name} onChange={e => setNewEvent({...newEvent, name: e.target.value})} className={inputCls} required placeholder="Spring GBM" /></div>
                <div><label className={labelCls}>Location *</label><input type="text" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} className={inputCls} required placeholder="Price Center Ballroom" /></div>
                <div><label className={labelCls}>Date & Time *</label><input type="datetime-local" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} className={inputCls} required /></div>
                <div>
                  <label className={labelCls}>Event Type *</label>
                  <select value={newEvent.event_type} onChange={e => setNewEvent({...newEvent, event_type: e.target.value as Event['event_type']})} className={inputCls} required>
                    {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div><label className={labelCls}>Points *</label><input type="number" value={newEvent.points} onChange={e => setNewEvent({...newEvent, points: Number(e.target.value)})} min="0" max="1000" className={inputCls} required /></div>
                <div><label className={labelCls}>Check-in Form URL</label><input type="url" value={newEvent.check_in_form_url} onChange={e => setNewEvent({...newEvent, check_in_form_url: e.target.value})} className={inputCls} placeholder="https://forms.google.com/..." /></div>
              </div>
              <div><label className={labelCls}>Description *</label><textarea value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} className={inputCls} rows={3} required placeholder="Describe the event." /></div>
              <div>
                <label className={labelCls}>Image</label>
                <div {...getRootProps()} className={`mt-1 flex flex-col items-center justify-center border border-dashed rounded p-6 cursor-pointer transition-colors ${isDragActive ? 'border-zinc-400 bg-zinc-800/20' : 'border-zinc-700'}`}>
                  <input {...getInputProps()} />
                  {imagePreview
                    ? <img src={imagePreview} alt="Preview" className="max-h-40 rounded object-cover" />
                    : <p className="text-zinc-500 text-xs">Drag and drop or click to upload</p>}
                </div>
                {imageFile && <button type="button" className="mt-1.5 text-xs text-red-400 hover:text-red-300" onClick={() => { setImageFile(null); setImagePreview(null); }}>Remove image</button>}
              </div>
              <button type="submit" disabled={uploading} className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 font-medium py-2.5 rounded text-sm transition-colors disabled:opacity-50">
                {uploading ? 'Creating...' : 'Create Event'}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-5">Events</h2>
            {upcomingEvents.length === 0 && pastEvents.length === 0 && (
              <p className="text-zinc-500 text-sm text-center py-10">No events yet.</p>
            )}
            {upcomingEvents.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-label text-zinc-500 mb-3">Upcoming ({upcomingEvents.length})</p>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
                  {upcomingEvents.map((e: Event) => <EventRow key={e.id} event={e} />)}
                </div>
              </div>
            )}
            {pastEvents.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-label text-zinc-500 mb-3">Past ({pastEvents.length})</p>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
                  {pastEvents.map((e: Event) => <EventRow key={e.id} event={e} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-md w-full max-w-2xl my-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-50">Edit Event</h2>
              <button onClick={() => setSelectedEvent(null)} className="text-zinc-500 hover:text-zinc-200 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={labelCls}>Title *</label><input type="text" value={selectedEvent.name} onChange={e => setSelectedEvent({...selectedEvent, name: e.target.value})} className={inputCls} required /></div>
                <div><label className={labelCls}>Location *</label><input type="text" value={selectedEvent.location} onChange={e => setSelectedEvent({...selectedEvent, location: e.target.value})} className={inputCls} required /></div>
                <div><label className={labelCls}>Date & Time *</label><input type="datetime-local" value={formatDateForInput(selectedEvent.date)} onChange={e => setSelectedEvent({...selectedEvent, date: e.target.value})} className={inputCls} required /></div>
                <div>
                  <label className={labelCls}>Event Type *</label>
                  <select value={selectedEvent.event_type} onChange={e => setSelectedEvent({...selectedEvent, event_type: e.target.value as Event['event_type']})} className={inputCls} required>
                    {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div><label className={labelCls}>Points *</label><input type="number" value={selectedEvent.points} onChange={e => setSelectedEvent({...selectedEvent, points: Number(e.target.value)})} min="0" max="1000" className={inputCls} required /></div>
                <div><label className={labelCls}>Check-in Form URL</label><input type="url" value={selectedEvent.check_in_form_url || ''} onChange={e => setSelectedEvent({...selectedEvent, check_in_form_url: e.target.value})} className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>Description *</label><textarea value={selectedEvent.description} onChange={e => setSelectedEvent({...selectedEvent, description: e.target.value})} className={inputCls} rows={3} required /></div>
              <div>
                <label className={labelCls}>Check-in Code</label>
                <div className="mt-1 flex gap-2">
                  <input type="text" value={selectedEvent.check_in_code || ''} onChange={e => setSelectedEvent({...selectedEvent, check_in_code: e.target.value})} className={`${inputCls} mt-0 font-mono tracking-widest`} />
                  <button type="button" onClick={handleCopyCode} className={`shrink-0 px-3 py-2 rounded text-sm font-medium transition-colors border ${copiedCode ? 'border-emerald-600 bg-emerald-600/20 text-emerald-400' : 'border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`}>
                    {copiedCode ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <label className="flex items-center gap-2 mt-2 text-xs text-zinc-500 cursor-pointer">
                  <input type="checkbox" checked={selectedEvent.is_code_expired} onChange={e => setSelectedEvent({...selectedEvent, is_code_expired: e.target.checked})} className="rounded-sm" />
                  Mark code as expired
                </label>
              </div>
              <div>
                <label className={labelCls}>Image</label>
                {selectedEvent.image_url && !editImagePreview && (
                  <div className="mt-2 mb-3">
                    <img src={selectedEvent.image_url} alt={selectedEvent.name} className="w-full h-36 object-cover rounded border border-zinc-700" />
                    <button type="button" className="mt-1.5 text-xs text-red-400 hover:text-red-300" onClick={() => setSelectedEvent({...selectedEvent, image_url: ''})}>Remove image</button>
                  </div>
                )}
                <div {...getEditRootProps()} className={`flex flex-col items-center justify-center border border-dashed rounded p-5 cursor-pointer transition-colors ${isEditDragActive ? 'border-zinc-400 bg-zinc-800/20' : 'border-zinc-700'}`}>
                  <input {...getEditInputProps()} />
                  {editImagePreview
                    ? <img src={editImagePreview} alt="New preview" className="max-h-36 rounded object-cover" />
                    : <p className="text-zinc-500 text-xs">Drag and drop or click to replace image</p>}
                </div>
                {editImageFile && <button type="button" className="mt-1.5 text-xs text-red-400 hover:text-red-300" onClick={() => { setEditImageFile(null); setEditImagePreview(null); }}>Remove new image</button>}
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={editUploading} className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 font-medium py-2.5 rounded text-sm transition-colors disabled:opacity-50">
                  {editUploading ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setSelectedEvent(null)} className="px-5 py-2.5 border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </form>
            <div className="border-t border-zinc-800 p-5">
              <ManualCheckIn eventId={selectedEvent.id} onSuccess={refreshEvents} />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {eventToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-md max-w-sm w-full p-6">
            <h3 className="text-base font-semibold text-zinc-50 mb-2">Delete Event</h3>
            <p className="text-sm text-zinc-400 mb-1">Delete <span className="text-zinc-200 font-medium">"{eventToDelete.name}"</span>?</p>
            <p className="text-xs text-zinc-500 mb-5">This cannot be undone. Attendance records will remain.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEventToDelete(null)} className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-200 transition-colors">Cancel</button>
              <button onClick={handleDeleteConfirm} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
