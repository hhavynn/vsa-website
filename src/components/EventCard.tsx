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

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold mb-2">{event.title}</h3>
      <p className="text-gray-600 mb-4">{event.description}</p>
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-500">
            {format(new Date(event.date), 'MMMM d, yyyy')}
          </p>
          <p className="text-sm text-gray-500">{event.location}</p>
        </div>
        <button
          onClick={handleCheckIn}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
        >
          Check In
        </button>
      </div>
    </div>
  );
} 