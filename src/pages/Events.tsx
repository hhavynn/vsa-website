import React from 'react';
import { EventCard } from '../components/EventCard';
import { useEvents } from '../hooks/useEvents';
import { PageTitle } from '../components/PageTitle';

export function Events() {
  const { events, loading, error } = useEvents();

  if (loading) {
    return (
      <>
        <PageTitle title="Events" />
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-6">Events</h1>
          <p className="text-gray-600">Loading events...</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-6">Events</h1>
        <p className="text-red-600">Error loading events: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 text-white">
      <h1 className="text-3xl font-bold mb-4">Upcoming Events</h1>
      <p>This is the events page. More content coming soon!</p>
      {events.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-gray-600">No events scheduled at this time.</p>
          <p className="text-gray-600 mt-2">Check back soon for upcoming events!</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map(event => (
            <EventCard
              key={event.id}
              event={event}
              onCheckIn={() => {
                // TODO: Implement check-in functionality
                console.log('Checking in to event:', event.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
} 