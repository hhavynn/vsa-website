import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAdminExternalEvents, useUpsertExternalEvent, useDeleteExternalEvent } from '../../hooks/useExternalEvents';
import { useAdminUVSASchools } from '../../hooks/useUVSASchools';
import { ExternalEvent } from '../../types';
import { PageTitle } from '../../components/common/PageTitle';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge, BadgeColor } from '../../components/ui/Badge';
import { 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaSave, 
  FaTimes, 
  FaCalendarAlt, 
  FaMapMarkerAlt 
} from 'react-icons/fa';
import { format } from 'date-fns';

// Icon components cast to any to avoid TS JSX errors
const PlusIcon = FaPlus as any;
const EditIcon = FaEdit as any;
const TrashIcon = FaTrash as any;
const SaveIcon = FaSave as any;
const TimesIcon = FaTimes as any;
const CalendarIcon = FaCalendarAlt as any;
const MapPinIcon = FaMapMarkerAlt as any;

const EMPTY_EVENT: Partial<ExternalEvent> = {
  title: '',
  event_type: '',
  description: '',
  points: 4,
  status: 'draft',
  is_featured: false,
  confidence_level: 'high',
};

const inputCls = 'mt-1 block w-full rounded border px-3 py-2.5 text-[15px] sm:py-2 sm:text-sm focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] bg-[var(--color-surface2)] border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text3)]';
const labelCls = 'block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)]';

const STATUS_COLOR: Record<string, BadgeColor> = {
  draft: 'gray',
  upcoming: 'green',
  past: 'blue',
  historical: 'yellow',
  canceled: 'red',
};

export default function AdminExternalEvents() {
  const { events, loading, refreshEvents } = useAdminExternalEvents();
  const { schools } = useAdminUVSASchools();
  const upsertMutation = useUpsertExternalEvent();
  const deleteMutation = useDeleteExternalEvent();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ExternalEvent>>(EMPTY_EVENT);
  const [isAdding, setIsAdding] = useState(false);

  const handleEdit = (event: ExternalEvent) => {
    setEditingId(event.id);
    setFormData(event);
    setIsAdding(false);
  };

  const handleAdd = () => {
    setEditingId(null);
    setFormData(EMPTY_EVENT);
    setIsAdding(true);
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData(EMPTY_EVENT);
    setIsAdding(false);
  };

  const handleSave = async () => {
    try {
      if (!formData.title || !formData.uvsa_school_id) {
        toast.error('Event title and host school are required');
        return;
      }

      // Ensure uvsa_school relation is not sent back to Supabase
      const { uvsa_school, ...payload } = formData as any;

      await upsertMutation.mutateAsync(payload);
      toast.success(editingId ? 'Event updated' : 'Event added');
      handleCancel();
      refreshEvents();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save event');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Event deleted');
      refreshEvents();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete event');
    }
  };

  if (loading && events.length === 0) return <div className="p-8 text-center">Loading events...</div>;

  return (
    <div className="vsa-container py-8 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div className="flex flex-col gap-1">
          <PageTitle title="Manage External Events" />
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>
            External Events
          </h1>
          <p className="font-sans text-sm text-[var(--color-text3)]">{events.length} events managed</p>
        </div>
        <Button onClick={handleAdd} className="flex gap-2">
          <PlusIcon size={18} /> Add Event
        </Button>
      </div>

      {(isAdding || editingId) && (
        <Card className="mb-12 p-6 scrapbook-paper">
          <h3 className="font-serif text-xl mb-6">
            {isAdding ? 'Add New External Event' : `Edit ${formData.title}`}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Event Title</label>
                <input
                  className={inputCls}
                  value={formData.title || ''}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Mount Jamprov"
                />
              </div>
              <div>
                <label className={labelCls}>Host School</label>
                <select
                  className={inputCls}
                  value={formData.uvsa_school_id || ''}
                  onChange={e => setFormData({ ...formData, uvsa_school_id: e.target.value })}
                >
                  <option value="">Select a school</option>
                  {schools.map(school => (
                    <option key={school.id} value={school.id}>{school.school_name} ({school.short_name})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Event Type</label>
                  <input
                    className={inputCls}
                    value={formData.event_type || ''}
                    onChange={e => setFormData({ ...formData, event_type: e.target.value })}
                    placeholder="e.g. Competition"
                  />
                </div>
                <div>
                  <label className={labelCls}>Points</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={formData.points || 4}
                    onChange={e => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Date</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={formData.date || ''}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>Location</label>
                  <input
                    className={inputCls}
                    value={formData.location || ''}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. SDSU Campus"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select
                  className={inputCls}
                  value={formData.status || 'draft'}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="draft">Draft</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="past">Past</option>
                  <option value="historical">Historical</option>
                  <option value="canceled">Canceled</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelCls}>RSVP / Source URL</label>
                <input
                  className={inputCls}
                  value={formData.rsvp_url || ''}
                  onChange={e => setFormData({ ...formData, rsvp_url: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Instagram URL</label>
                <input
                  className={inputCls}
                  value={formData.instagram_url || ''}
                  onChange={e => setFormData({ ...formData, instagram_url: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  className={`${inputCls} h-24`}
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_featured || false}
                    onChange={e => setFormData({ ...formData, is_featured: e.target.checked })}
                    className="rounded border-gray-300 text-[var(--brand)] focus:ring-[var(--brand)]"
                  />
                  <span className="text-sm font-medium">Featured</span>
                </label>
              </div>
              <div>
                <label className={labelCls}>Internal / Source Notes</label>
                <textarea
                  className={`${inputCls} h-16 text-xs`}
                  value={formData.source_notes || ''}
                  onChange={e => setFormData({ ...formData, source_notes: e.target.value })}
                  placeholder="Verification notes, source of info, etc."
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
            <Button variant="outline" onClick={handleCancel} className="flex gap-2">
              <TimesIcon size={18} /> Cancel
            </Button>
            <Button onClick={handleSave} className="flex gap-2" loading={upsertMutation.isLoading}>
              <SaveIcon size={18} /> Save Event
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {events.map(event => (
          <div key={event.id} className="scrapbook-paper p-4 flex items-center justify-between border" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-10 h-10 rounded bg-[var(--surface2)] flex items-center justify-center font-bold text-[var(--brand)] flex-shrink-0">
                {event.uvsa_school?.short_name[0] || '?'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold truncate">{event.title}</h4>
                  <Badge label={event.status} color={STATUS_COLOR[event.status] || 'gray'} />
                  {event.is_featured && <Badge label="Featured" color="yellow" />}
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--text3)] mt-1">
                  <span className="font-medium text-[var(--text2)]">{event.uvsa_school?.short_name}</span>
                  {event.date && (
                    <span className="flex items-center gap-1">
                      <CalendarIcon size={12} /> {format(new Date(event.date), 'MMM d, yyyy')}
                    </span>
                  )}
                  {event.location && (
                    <span className="flex items-center gap-1">
                      <MapPinIcon size={12} /> {event.location}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              <Button variant="outline" size="sm" onClick={() => handleEdit(event)} className="flex gap-2">
                <EditIcon size={16} /> Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDelete(event.id)} className="text-red-500 hover:text-red-600">
                <TrashIcon size={16} />
              </Button>
            </div>
          </div>
        ))}
        {events.length === 0 && (
          <div className="p-12 text-center border-dashed border-2 rounded-xl" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[var(--text3)]">No external events found. Click "Add Event" to create one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
