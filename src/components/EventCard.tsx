import { format } from 'date-fns';
import { Event } from '../types';
import { Modal } from './Modal';
import { useState } from 'react';
import { CountdownTimer } from './CountdownTimer';

export interface EventCardProps {
  event: Event;
  onCheckIn: () => void;
}

export function EventCard({ event, onCheckIn }: EventCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);


  const handleSaveToCalendar = () => {
    if (!event.date) return;

    const startDate = new Date(event.date);
    // Set end time to 2 hours after start time by default
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

    // Format dates for Google Calendar URL
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/-|:|\.\d+/g, '');
    };

    // Create Google Calendar URL
    const googleCalendarUrl = new URL('https://calendar.google.com/calendar/render');
    googleCalendarUrl.searchParams.append('action', 'TEMPLATE');
    googleCalendarUrl.searchParams.append('text', event.name);
    googleCalendarUrl.searchParams.append('dates', `${formatDate(startDate)}/${formatDate(endDate)}`);
    googleCalendarUrl.searchParams.append('details', event.description);
    googleCalendarUrl.searchParams.append('location', event.location || '');

    // Open Google Calendar in a new tab
    window.open(googleCalendarUrl.toString(), '_blank');
  };

  let dateString = '';
  let isUpcoming = false;
  if (event.date) {
    const dateObj = new Date(event.date);
    if (!isNaN(dateObj.getTime())) {
      dateString = format(dateObj, 'MMMM d, yyyy');
      isUpcoming = dateObj > new Date();
    }
  }

  return (
    <>
      <div className="bg-gray-800 rounded-lg shadow-xl p-6">
        {event.image_url && (
          <img src={event.image_url} alt={event.name} className="w-full h-48 object-cover rounded-md mb-4" />
        )}
        <h3 className="text-xl font-semibold mb-2 text-white">{event.name}</h3>
        <p className="text-gray-300 mb-4">{event.description}</p>
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-400">
                {dateString || 'Date TBD'}
              </p>
              <p className="text-sm text-gray-400">{event.location}</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center space-x-2"
              disabled={!event.date}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              <span>Save to Calendar</span>
            </button>
          </div>
          {isUpcoming && event.date && (
            <div className="mt-2">
              <p className="text-sm text-gray-400 mb-2">Event starts in:</p>
              <CountdownTimer
                targetDate={new Date(event.date)}
                onComplete={() => {
                  // You could add any logic here when the countdown completes
                  console.log('Event has started!');
                }}
              />
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleSaveToCalendar}
        title="Add to Calendar"
        message={`Would you like to add "${event.name}" to your Google Calendar?`}
        confirmText="Add to Calendar"
        cancelText="Cancel"
      />
    </>
  );
} 