import { useState } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { supabase } from '../../lib/supabase';
import { Event } from '../../types';
import { GenerateCheckInCode } from '../../components/Admin/GenerateCheckInCode';

type EventType = 'general_event' | 'wildn_culture' | 'vcn_dance_practice' | 'vcn_attendance';

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  general_event: 'General Event/GBM (+10 points)',
  wildn_culture: 'WildnCulture Attendance (+30 points)',
  vcn_dance_practice: 'VCN Dance Practice Attendance (+5 points)',
  vcn_attendance: 'VCN Attendance (+10 points)'
};

export function AdminEvents() {
  const { events, loading, error, refreshEvents } = useEvents();
  const [isCreating, setIsCreating] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: '',
    description: '',
    date: '',
    location: '',
    event_type: 'general_event' as EventType,
    check_in_form_url: ''
  });

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('events')
        .insert([{
          ...newEvent,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      if (error) throw error;

      // Reset form
      setNewEvent({
        name: '',
        description: '',
        date: '',
        location: '',
        event_type: 'general_event',
        check_in_form_url: ''
      });
      setIsCreating(false);
      // Refresh events list
      refreshEvents();
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Failed to create event. Please try again.');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;

    try {
      console.log('Attempting to delete event:', eventId);
      const { data, error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)
        .select();  // Add select() to get the deleted data

      if (error) {
        console.error('Supabase delete error:', error);
        throw error;
      }

      console.log('Delete response:', data);
      
      // Refresh events list after successful deletion
      await refreshEvents();
      console.log('Events list refreshed');
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event. Please try again.');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Admin Events</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-bold mb-4">Create Event</h2>
          <form onSubmit={handleCreateEvent} className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Create New Event</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Event Name</label>
                <input
                  type="text"
                  value={newEvent.name}
                  onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  rows={3}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <input
                  type="datetime-local"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Location</label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Event Type</label>
                <select
                  value={newEvent.event_type}
                  onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value as EventType })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
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
                <label className="block text-sm font-medium text-gray-700">Check-in Form URL</label>
                <input
                  type="url"
                  value={newEvent.check_in_form_url}
                  onChange={(e) => setNewEvent({ ...newEvent, check_in_form_url: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                  placeholder="https://docs.google.com/forms/d/e/..."
                />
              </div>
              <button
                type="submit"
                className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              >
                Create Event
              </button>
            </div>
          </form>
        </div>

        <div>
          <GenerateCheckInCode />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Events List</h2>
        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-semibold">{event.title}</h3>
                  <p className="text-gray-600 mt-2">{event.description}</p>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-gray-500">Date: {new Date(event.date).toLocaleString()}</p>
                    <p className="text-sm text-gray-500">Location: {event.location}</p>
                    <p className="text-sm text-gray-500">Type: {EVENT_TYPE_LABELS[event.event_type as EventType]}</p>
                    <p className="text-sm text-gray-500">Points: {event.points}</p>
                    <p className="text-sm text-gray-500">
                      Check-in Form: <a href={event.check_in_form_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{event.check_in_form_url}</a>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteEvent(event.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 