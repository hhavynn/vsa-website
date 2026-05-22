import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useEvents } from '../../hooks/useEvents';
import { useAcademicTerms } from '../../hooks/useAcademicTerms';
import { academicTermsRepository } from '../../data/repos/academicTerms';
import { supabase } from '../../lib/supabase';
import { AcademicTerm, Event } from '../../types';
import { useDropzone } from 'react-dropzone';
import { PageTitle } from '../../components/common/PageTitle';
import { ManualCheckIn } from '../../components/features/admin/ManualCheckIn';
import { EVENT_TYPE_LABELS } from '../../constants/eventTypes';
import { getAcademicTermMeta } from '../../lib/academicTerms';
import { extractSupabasePublicObjectName, getUploadExtension, prepareImageForUpload } from '../../lib/imageUpload';

const EMPTY_EVENT: Partial<Event> = {
  name: '', description: '', date: '', location: '',
  event_type: 'other', check_in_form_url: '', points: 0,
  academic_term_id: null,
};

const inputCls = 'mt-1 block w-full rounded border px-3 py-2.5 text-[15px] sm:py-2 sm:text-sm focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] bg-[var(--color-surface2)] border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text3)]';
const labelCls = 'block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)]';

function findTermForDate(dateString: string | null | undefined, terms: AcademicTerm[]) {
  const meta = dateString ? getAcademicTermMeta(dateString) : null;
  if (!meta) return null;
  return terms.find((term) => term.code === meta.code) ?? null;
}

function getSuggestedTermLabel(dateString?: string | null) {
  const meta = dateString ? getAcademicTermMeta(dateString) : null;
  return meta?.label ?? null;
}

function AcademicTermSelect({
  value,
  date,
  terms,
  termsLoading,
  termsError,
  onChange,
}: {
  value?: string | null;
  date?: string | null;
  terms: AcademicTerm[];
  termsLoading: boolean;
  termsError: unknown;
  onChange: (termId: string | null) => void;
}) {
  const suggestedLabel = getSuggestedTermLabel(date);
  const hasSuggestedTerm = !!findTermForDate(date, terms);
  const selectedTerm = value ? terms.find((term) => term.id === value) : null;
  const helperText = selectedTerm
    ? `Manual term selected: ${selectedTerm.label}.`
    : suggestedLabel
      ? hasSuggestedTerm
        ? `Suggested by date: ${suggestedLabel}.`
        : `Suggested by date: ${suggestedLabel}. It will be created on save if needed.`
    : 'Pick a date to auto-suggest a term.';
  const termOptions = [
    <option key="auto" value="">
      {termsLoading ? 'Loading terms...' : 'Auto from event date'}
    </option>,
    ...terms.map((term: AcademicTerm) => (
      <option key={term.id} value={term.id}>
        {term.label}
      </option>
    )),
  ];
  const children = [
    <label key="label" className={labelCls}>Academic Term</label>,
    <select
      key="select"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={inputCls}
    >
      {termOptions}
    </select>,
    <p key="helper" className="mt-1 text-xs text-zinc-500">
      {helperText}
    </p>,
  ];

  if (termsError) {
    children.push(
      <p key="error" className="mt-1 text-xs text-amber-500">
        Terms could not be loaded. The event can still be saved if Supabase can infer the term from its date.
      </p>
    );
  }

  return (
    <div>
      {children}
    </div>
  );
}

export default function AdminEvents() {
  const { events, refreshEvents } = useEvents();
  const { terms, loading: termsLoading, error: termsError, refreshTerms } = useAcademicTerms();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [newEvent, setNewEvent] = useState<Partial<Event>>(EMPTY_EVENT);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [selectedEventOriginalImageUrl, setSelectedEventOriginalImageUrl] = useState<string | null>(null);
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

  const getTermLabel = (termId?: string | null, dateString?: string | null) => {
    const term = termId ? terms.find((item) => item.id === termId) : null;
    return term?.label ?? getSuggestedTermLabel(dateString) ?? 'Unassigned';
  };

  const resolveAcademicTermId = async (dateString?: string | null, selectedTermId?: string | null) => {
    if (selectedTermId) return selectedTermId;
    if (!dateString) return null;

    const existingTerm = findTermForDate(dateString, terms);
    if (existingTerm) return existingTerm.id;

    const ensuredTerm = await academicTermsRepository.ensureTermForDate(dateString);
    return ensuredTerm?.id ?? null;
  };

  const handleNewEventDateChange = (dateValue: string) => {
    const suggestedTerm = findTermForDate(dateValue, terms);
    setNewEvent({
      ...newEvent,
      date: dateValue,
      academic_term_id: suggestedTerm?.id ?? null,
    });
  };

  const handleSelectedEventDateChange = (dateValue: string) => {
    if (!selectedEvent) return;
    const suggestedTerm = findTermForDate(dateValue, terms);
    setSelectedEvent({
      ...selectedEvent,
      date: dateValue,
      academic_term_id: suggestedTerm?.id ?? null,
    });
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
    onDrop, accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] }, maxFiles: 1, maxSize: 10 * 1024 * 1024,
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
    onDrop: onEditDrop, accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] }, maxFiles: 1, maxSize: 10 * 1024 * 1024,
  });

  async function uploadImage(file: File): Promise<string> {
    const preparedFile = await prepareImageForUpload(file, 'event');
    const fileExt = getUploadExtension(preparedFile);
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const { error } = await supabase.storage.from('event_images').upload(fileName, preparedFile, {
      cacheControl: '31536000',
      contentType: preparedFile.type,
    });
    if (error) throw error;
    const { data } = supabase.storage.from('event_images').getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function removeEventImage(url?: string | null) {
    const objectName = extractSupabasePublicObjectName(url, 'event_images');
    if (objectName) await supabase.storage.from('event_images').remove([objectName]);
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.name || !newEvent.description || !newEvent.date || !newEvent.location) return;
    try {
      setUploading(true);
      const imageUrl = imageFile ? await uploadImage(imageFile) : null;
      const checkInCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const academicTermId = await resolveAcademicTermId(newEvent.date, newEvent.academic_term_id);
      const { error } = await supabase.from('events').insert([{
        name: newEvent.name, description: newEvent.description,
        date: new Date(newEvent.date!).toISOString(), location: newEvent.location,
        event_type: newEvent.event_type, check_in_form_url: newEvent.check_in_form_url || '',
        points: newEvent.points, image_url: imageUrl,
        check_in_code: checkInCode, is_code_expired: false,
        academic_term_id: academicTermId,
      }]);
      if (error) throw error;
      toast.success('Event created');
      setNewEvent(EMPTY_EVENT); setImageFile(null); setImagePreview(null);
      refreshTerms();
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
      await removeEventImage(eventToDelete.image_url);
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
      let imageUrlToRemove: string | null = null;
      if (editImageFile) {
        imageUrl = await uploadImage(editImageFile);
        imageUrlToRemove = selectedEventOriginalImageUrl;
      } else if (!imageUrl && selectedEventOriginalImageUrl) {
        imageUrlToRemove = selectedEventOriginalImageUrl;
      }
      const academicTermId = await resolveAcademicTermId(selectedEvent.date, selectedEvent.academic_term_id);
      const { error } = await supabase.from('events').update({
        name: selectedEvent.name, description: selectedEvent.description,
        date: new Date(selectedEvent.date).toISOString(), location: selectedEvent.location,
        event_type: selectedEvent.event_type, points: selectedEvent.points,
        image_url: imageUrl, check_in_code: selectedEvent.check_in_code,
        is_code_expired: selectedEvent.is_code_expired,
        check_in_form_url: selectedEvent.check_in_form_url || '',
        academic_term_id: academicTermId,
      }).eq('id', selectedEvent.id);
      if (error) throw error;
      await removeEventImage(imageUrlToRemove);
      toast.success('Event updated');
      setEditImageFile(null); setEditImagePreview(null); setSelectedEvent(null); setSelectedEventOriginalImageUrl(null);
      refreshTerms();
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
    <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-start sm:p-5 transition-colors hover:bg-[var(--color-surface2)] last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
      {event.image_url && (
        <img src={event.image_url} alt={event.name} className="h-40 w-full shrink-0 rounded border object-cover sm:h-16 sm:w-16" style={{ borderColor: 'var(--color-border)' }} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-base font-bold sm:text-sm sm:font-semibold" style={{ color: 'var(--color-text)' }}>{event.name}</p>
        <p className="mt-1 line-clamp-2 text-xs sm:line-clamp-1" style={{ color: 'var(--color-text2)' }}>{event.description}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px]" style={{ color: 'var(--color-text3)' }}>
            {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <span className="rounded border px-1.5 py-0.5 font-mono text-[10px]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)' }}>
            {getTermLabel(event.academic_term_id, event.date)}
          </span>
          <span className="rounded border px-1.5 py-0.5 font-mono text-[10px]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)' }}>
            {EVENT_TYPE_LABELS[event.event_type]}
          </span>
          <span className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{event.points} pts</span>
        </div>
      </div>
      <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
        <button
          onClick={() => {
            const suggestedTerm = findTermForDate(event.date, terms);
            setSelectedEvent({
              ...event,
              academic_term_id: event.academic_term_id ?? suggestedTerm?.id ?? null,
            });
            setSelectedEventOriginalImageUrl(event.image_url ?? null);
            setEditImageFile(null);
            setEditImagePreview(null);
          }}
          className="flex-1 rounded border px-4 py-2 text-xs font-medium transition-colors hover:bg-[var(--color-surface2)] sm:flex-none sm:px-3 sm:py-1.5"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
        >
          Edit
        </button>
        <button
          onClick={() => setEventToDelete(event)}
          className="flex-1 rounded border border-red-900/30 px-4 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-600 hover:text-white sm:flex-none sm:px-3 sm:py-1.5"
        >
          Delete
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Events" />

      <div className="border-b px-6 py-6 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-8 sm:py-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="mb-4 sm:mb-0">
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>Events</h1>
          <p className="mt-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>{events.length} events total</p>
        </div>
        {/* Tab toggle */}
        <div className="inline-flex overflow-hidden rounded border" style={{ borderColor: 'var(--color-border)' }}>
          {(['create', 'manage'] as const).map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="font-sans text-[13px] font-semibold transition-colors duration-150 sm:text-sm"
              style={{ padding: '8px 16px', fontWeight: activeTab === tab ? 600 : 500, background: activeTab === tab ? 'var(--color-surface2)' : 'transparent', color: activeTab === tab ? 'var(--color-text)' : 'var(--color-text2)', borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none', cursor: 'pointer' }}>
              {tab === 'create' ? 'Create Event' : `Manage (${events.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="scrapbook-paper overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          {activeTab === 'create' ? (
            <div className="p-6 sm:p-8">
              <h2 className="mb-6 font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>Create Event</h2>
              <form onSubmit={handleCreateEvent} className="space-y-5">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:gap-6">
                  <div><label className={labelCls}>Title *</label><input type="text" value={newEvent.name} onChange={e => setNewEvent({...newEvent, name: e.target.value})} className={inputCls} required placeholder="Spring GBM" /></div>
                  <div><label className={labelCls}>Location *</label><input type="text" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} className={inputCls} required placeholder="Price Center Ballroom" /></div>
                  <div><label className={labelCls}>Date & Time *</label><input type="datetime-local" value={newEvent.date} onChange={e => handleNewEventDateChange(e.target.value)} className={inputCls} required /></div>
                  <div>
                    <label className={labelCls}>Event Type *</label>
                    <select value={newEvent.event_type} onChange={e => setNewEvent({...newEvent, event_type: e.target.value as Event['event_type']})} className={inputCls} required>
                      {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Points *</label><input type="number" value={newEvent.points} onChange={e => setNewEvent({...newEvent, points: Number(e.target.value)})} min="0" max="1000" className={inputCls} required /></div>
                  <div><label className={labelCls}>Check-in Form URL</label><input type="url" value={newEvent.check_in_form_url} onChange={e => setNewEvent({...newEvent, check_in_form_url: e.target.value})} className={inputCls} placeholder="https://forms.google.com/..." /></div>
                  <AcademicTermSelect
                    value={newEvent.academic_term_id}
                    date={newEvent.date}
                    terms={terms}
                    termsLoading={termsLoading}
                    termsError={termsError}
                    onChange={(termId) => setNewEvent({ ...newEvent, academic_term_id: termId })}
                  />
                </div>
                <div><label className={labelCls}>Description *</label><textarea value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} className={inputCls} rows={4} required placeholder="Describe the event." /></div>
                <div>
                  <label className={labelCls}>Image</label>
                  <div {...getRootProps()} className={`mt-2 flex flex-col items-center justify-center border border-dashed rounded-lg p-8 cursor-pointer transition-colors ${isDragActive ? 'border-[var(--brand)] bg-[var(--brand)]/5' : 'border-[var(--color-border)] hover:bg-[var(--color-surface2)]'}`}>
                    <input {...getInputProps()} />
                    {imagePreview
                      ? <img src={imagePreview} alt="Preview" className="max-h-48 rounded object-cover shadow-sm" />
                      : <p className="text-xs" style={{ color: 'var(--color-text3)' }}>Drag and drop or click to upload</p>}
                  </div>
                  {imageFile && <button type="button" className="mt-2 text-xs font-semibold text-red-500 hover:text-red-600" onClick={() => { setImageFile(null); setImagePreview(null); }}>Remove image</button>}
                </div>
                <div className="pt-2">
                  <button type="submit" disabled={uploading} className="vsa-btn-primary w-full py-3 disabled:opacity-50">
                    {uploading ? 'Creating...' : 'Create Event'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div>
              <div className="border-b px-6 py-5 sm:px-8" style={{ borderColor: 'var(--color-border)' }}>
                <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>Manage Events</h2>
              </div>
              {upcomingEvents.length === 0 && pastEvents.length === 0 && (
                <p className="py-12 text-center text-sm" style={{ color: 'var(--color-text3)' }}>No events yet.</p>
              )}
              {upcomingEvents.length > 0 && (
                <div className="mb-2">
                  <div className="border-b bg-[var(--color-surface2)] px-4 py-2" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>Upcoming ({upcomingEvents.length})</p>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {upcomingEvents.map((e: Event) => <EventRow key={e.id} event={e} />)}
                  </div>
                </div>
              )}
              {pastEvents.length > 0 && (
                <div>
                  <div className="border-y bg-[var(--color-surface2)] px-4 py-2" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>Past ({pastEvents.length})</p>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {pastEvents.map((e: Event) => <EventRow key={e.id} event={e} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-6 lg:p-8">
            <div className="scrapbook-paper my-8 w-full max-w-2xl" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              <div className="flex items-center justify-between border-b px-6 py-5" style={{ borderColor: 'var(--color-border)' }}>
                <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>Edit Event</h2>
                <button onClick={() => setSelectedEvent(null)} className="text-2xl leading-none transition-colors hover:text-[var(--color-text)]" style={{ color: 'var(--color-text3)' }}>&times;</button>
              </div>
              <form onSubmit={handleEditSubmit} className="space-y-5 p-6 sm:p-8">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:gap-6">
                  <div><label className={labelCls}>Title *</label><input type="text" value={selectedEvent.name} onChange={e => setSelectedEvent({...selectedEvent, name: e.target.value})} className={inputCls} required /></div>
                  <div><label className={labelCls}>Location *</label><input type="text" value={selectedEvent.location} onChange={e => setSelectedEvent({...selectedEvent, location: e.target.value})} className={inputCls} required /></div>
                  <div><label className={labelCls}>Date & Time *</label><input type="datetime-local" value={formatDateForInput(selectedEvent.date)} onChange={e => handleSelectedEventDateChange(e.target.value)} className={inputCls} required /></div>
                  <div>
                    <label className={labelCls}>Event Type *</label>
                    <select value={selectedEvent.event_type} onChange={e => setSelectedEvent({...selectedEvent, event_type: e.target.value as Event['event_type']})} className={inputCls} required>
                      {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Points *</label><input type="number" value={selectedEvent.points} onChange={e => setSelectedEvent({...selectedEvent, points: Number(e.target.value)})} min="0" max="1000" className={inputCls} required /></div>
                  <div><label className={labelCls}>Check-in Form URL</label><input type="url" value={selectedEvent.check_in_form_url || ''} onChange={e => setSelectedEvent({...selectedEvent, check_in_form_url: e.target.value})} className={inputCls} /></div>
                  <AcademicTermSelect
                    value={selectedEvent.academic_term_id}
                    date={selectedEvent.date}
                    terms={terms}
                    termsLoading={termsLoading}
                    termsError={termsError}
                    onChange={(termId) => setSelectedEvent({ ...selectedEvent, academic_term_id: termId })}
                  />
                </div>
                <div><label className={labelCls}>Description *</label><textarea value={selectedEvent.description} onChange={e => setSelectedEvent({...selectedEvent, description: e.target.value})} className={inputCls} rows={4} required /></div>
                <div>
                  <label className={labelCls}>Check-in Code</label>
                  <div className="mt-1 flex gap-2">
                    <input type="text" value={selectedEvent.check_in_code || ''} onChange={e => setSelectedEvent({...selectedEvent, check_in_code: e.target.value})} className={`${inputCls} mt-0 font-mono tracking-widest`} />
                    <button type="button" onClick={handleCopyCode} className={`shrink-0 rounded border px-4 py-2 text-sm font-semibold transition-colors ${copiedCode ? 'border-emerald-600 bg-emerald-600/20 text-emerald-600 dark:text-emerald-400' : 'bg-[var(--color-surface2)] hover:bg-[var(--color-surface)]'}`} style={{ borderColor: copiedCode ? '' : 'var(--color-border)', color: copiedCode ? '' : 'var(--color-text)' }}>
                      {copiedCode ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm" style={{ color: 'var(--color-text2)' }}>
                    <input type="checkbox" checked={selectedEvent.is_code_expired} onChange={e => setSelectedEvent({...selectedEvent, is_code_expired: e.target.checked})} className="rounded border-[var(--color-border)] bg-[var(--color-surface2)] text-[var(--brand)] focus:ring-[var(--brand)]" />
                    Mark code as expired
                  </label>
                </div>
                <div>
                  <label className={labelCls}>Image</label>
                  {selectedEvent.image_url && !editImagePreview && (
                    <div className="mb-4 mt-2">
                      <img src={selectedEvent.image_url} alt={selectedEvent.name} className="h-48 w-full rounded border object-cover shadow-sm sm:w-auto sm:min-w-[320px]" style={{ borderColor: 'var(--color-border)' }} />
                      <button type="button" className="mt-2 text-xs font-semibold text-red-500 hover:text-red-600" onClick={() => setSelectedEvent({...selectedEvent, image_url: ''})}>Remove image</button>
                    </div>
                  )}
                  <div {...getEditRootProps()} className={`flex flex-col items-center justify-center border border-dashed rounded-lg p-6 cursor-pointer transition-colors ${isEditDragActive ? 'border-[var(--brand)] bg-[var(--brand)]/5' : 'border-[var(--color-border)] hover:bg-[var(--color-surface2)]'}`}>
                    <input {...getEditInputProps()} />
                    {editImagePreview
                      ? <img src={editImagePreview} alt="New preview" className="max-h-40 rounded object-cover shadow-sm" />
                      : <p className="text-xs" style={{ color: 'var(--color-text3)' }}>Drag and drop or click to replace image</p>}
                  </div>
                  {editImageFile && <button type="button" className="mt-2 text-xs font-semibold text-red-500 hover:text-red-600" onClick={() => { setEditImageFile(null); setEditImagePreview(null); }}>Remove new image</button>}
                </div>
                <div className="flex flex-col gap-3 pt-4 sm:flex-row-reverse sm:justify-start">
                  <button type="submit" disabled={editUploading} className="vsa-btn-primary sm:px-8 disabled:opacity-50">
                    {editUploading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={() => setSelectedEvent(null)} className="rounded border bg-transparent px-6 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--color-surface2)]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
                    Cancel
                  </button>
                </div>
              </form>
              <div className="border-t p-6 sm:p-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
                <ManualCheckIn eventId={selectedEvent.id} onSuccess={refreshEvents} />
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {eventToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="scrapbook-paper w-full max-w-sm p-6 sm:p-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              <h3 className="mb-3 font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>Delete Event</h3>
              <p className="mb-2 font-sans text-[15px]" style={{ color: 'var(--color-text)' }}>Delete <span className="font-bold">"{eventToDelete.name}"</span>?</p>
              <p className="mb-6 font-sans text-xs leading-relaxed text-red-500">This cannot be undone. Attendance records will remain.</p>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button onClick={() => setEventToDelete(null)} className="rounded border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--color-surface2)]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>Cancel</button>
                <button onClick={handleDeleteConfirm} className="rounded bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700">Delete Event</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
