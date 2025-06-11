import { format } from 'date-fns';
import { CheckInButton } from './CheckInButton';

type Event = {
  id: string;
  name: string;
  description: string | null;
  date: string;
  location: string | null;
  points: number;
};

type EventCardProps = {
  event: Event;
};

export function EventCard({ event }: EventCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{event.name}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {format(new Date(event.date), 'MMMM d, yyyy h:mm a')}
            </p>
          </div>
          <div className="flex items-center">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {event.points} points
            </span>
          </div>
        </div>

        {event.description && (
          <p className="mt-3 text-gray-600">{event.description}</p>
        )}

        {event.location && (
          <p className="mt-2 text-sm text-gray-500">
            📍 {event.location}
          </p>
        )}

        <div className="mt-4">
          <CheckInButton eventId={event.id} />
        </div>
      </div>
    </div>
  );
} 