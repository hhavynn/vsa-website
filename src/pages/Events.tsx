import React from 'react';
import { EventCard } from '../components/EventCard';
import { useEvents } from '../hooks/useEvents';
import { PageTitle } from '../components/PageTitle';
import { RevealOnScrollWrapper } from '../components/RevealOnScrollWrapper';

export function Events() {
  const { events, loading, error } = useEvents();
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Split events into upcoming and past
  const upcomingEvents = events
    .filter(event => new Date(event.date) >= oneDayAgo)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pastEvents = events
    .filter(event => new Date(event.date) < oneDayAgo)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (loading) {
    return (
      <>
        <PageTitle title="Events" />
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-6 text-white">Events</h1>
          <p className="text-gray-400">Loading events...</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-6 text-white">Events</h1>
        <p className="text-red-400">Error loading events: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white transition-colors duration-300">
      {/* Upcoming Events Section */}
      <div className="mb-12 bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 text-gray-900 dark:text-white">
        <h2 className="text-2xl font-bold mb-4">Upcoming Events ({upcomingEvents.length})</h2>
        <p className="mb-6 text-gray-400">{upcomingEvents.length} event{upcomingEvents.length !== 1 ? 's' : ''} coming up</p>
        {upcomingEvents.length === 0 ? (
          <RevealOnScrollWrapper>
            <div className="bg-gray-800 shadow rounded-lg p-6">
              <p className="text-gray-300">No upcoming events at this time.</p>
              <p className="text-gray-300 mt-2">Check back soon for new events!</p>
            </div>
          </RevealOnScrollWrapper>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map(event => (
              <RevealOnScrollWrapper key={event.id}>
                <EventCard
                  event={event}
                  onCheckIn={() => {
                    // TODO: Implement check-in functionality
                    console.log('Checking in to event:', event.id);
                  }}
                />
              </RevealOnScrollWrapper>
            ))}
          </div>
        )}
      </div>
      {/* Divider */}
      <div className="border-t border-gray-700 my-12"></div>
      {/* Past Events Section */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 text-gray-900 dark:text-white">
        <h2 className="text-2xl font-bold mb-4">Past Events ({pastEvents.length})</h2>
        <p className="mb-6 text-gray-400">{pastEvents.length} event{pastEvents.length !== 1 ? 's' : ''} in the past</p>
        {pastEvents.length === 0 ? (
          <RevealOnScrollWrapper>
            <div className="bg-gray-800 shadow rounded-lg p-6">
              <p className="text-gray-300">No past events yet.</p>
            </div>
          </RevealOnScrollWrapper>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pastEvents.map(event => (
              <RevealOnScrollWrapper key={event.id}>
                <EventCard
                  event={event}
                  onCheckIn={() => {
                    // TODO: Implement check-in functionality
                    console.log('Checking in to event:', event.id);
                  }}
                />
              </RevealOnScrollWrapper>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 