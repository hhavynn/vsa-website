import { format } from 'date-fns';
import { Event } from '../types';

export interface EventCardProps {
  event: Event;
  onCheckIn: () => void;
}

export function EventCard({ event, onCheckIn }: EventCardProps) {
  const handleCheckIn = () => {
    // Open the Google Form in a new tab
    window.open(event.check_in_form_url, '_blank');
    // Call the onCheckIn callback for any additional logic
    onCheckIn();
  };

  let dateString = '';
  if (event.date) {
    const dateObj = new Date(event.date);
    if (!isNaN(dateObj.getTime())) {
      dateString = format(dateObj, 'MMMM d, yyyy');
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl p-6">
      {event.image_url && (
        <img src={event.image_url} alt={event.title} className="w-full h-48 object-cover rounded-md mb-4" />
      )}
      <h3 className="text-xl font-semibold mb-2 text-white">{event.title}</h3>
      <p className="text-gray-300 mb-4">{event.description}</p>
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-400">
            {dateString || 'Date TBD'}
          </p>
          <p className="text-sm text-gray-400">{event.location}</p>
        </div>
        <button
          onClick={handleCheckIn}
          className="bg-indigo-700 text-white px-4 py-2 rounded hover:bg-indigo-800 transition-colors"
        >
          Sign Up
        </button>
      </div>
    </div>
  );
} 