import React, { useRef } from 'react';
import { EventCard } from '../components/EventCard';
import { useEvents } from '../hooks/useEvents';
import { PageTitle } from '../components/PageTitle';
import { motion } from 'framer-motion';
import { RevealOnScrollWrapper } from '../components/RevealOnScrollWrapper';

export function Events() {
  const { events, loading, error } = useEvents();

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
    <div className="container mx-auto px-4 py-8 text-white">
      <h1 className="text-3xl font-bold mb-4">Upcoming Events</h1>
      {events.length === 0 ? (
        <RevealOnScrollWrapper>
          <div className="bg-gray-800 shadow rounded-lg p-6">
            <p className="text-gray-300">No events scheduled at this time.</p>
            <p className="text-gray-300 mt-2">Check back soon for upcoming events!</p>
          </div>
        </RevealOnScrollWrapper>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events
            .slice()
            .sort((a, b) => {
              const now = new Date();
              const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
              const dateA = new Date(a.date);
              const dateB = new Date(b.date);
              
              // If both events are in the past (more than 1 day ago), sort by most recent first
              if (dateA < oneDayAgo && dateB < oneDayAgo) {
                return dateB.getTime() - dateA.getTime();
              }
              
              // If one event is in the past and one is upcoming, put upcoming first
              if (dateA < oneDayAgo) return 1;
              if (dateB < oneDayAgo) return -1;
              
              // If both events are upcoming, sort by earliest first
              return dateA.getTime() - dateB.getTime();
            })
            .map(event => (
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
  );
} 